import { describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderApp } from '../helpers/renderApp.jsx'
import { setupFetch, getCurrentMondayIso, toIsoDate } from '../helpers/fetchMocks.js'

describe('Disponibilidades de estudo', () => {
  it('mostra o estado vazio quando não há horários cadastrados', async () => {
    setupFetch({ availability: [] })
    renderApp()

    expect(
      await screen.findByText('Nenhum horário cadastrado'),
    ).toBeInTheDocument()

    expect(
      screen.getByText(
        'Esta semana ainda não tem janelas de estudo registradas.',
      ),
    ).toBeInTheDocument()

    expect(
      await screen.findByRole('heading', { name: 'Prova de Anatomia' }),
    ).toBeInTheDocument()

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('abre o cadastro de disponibilidade com os limites da semana exibida', async () => {
    setupFetch()
    renderApp()

    const openButton = screen.getByRole('button', { name: 'Novo horário' })
    expect(openButton).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(openButton)

    expect(screen.getByRole('button', { name: 'Fechar formulário' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('heading', { name: 'Novo horário de estudo' })).toBeInTheDocument()
    expect(screen.getByLabelText('Data')).toHaveAttribute('min', getCurrentMondayIso())
    const sunday = new Date(`${getCurrentMondayIso()}T00:00:00`)
    sunday.setDate(sunday.getDate() + 6)
    expect(screen.getByLabelText('Data')).toHaveAttribute('max', toIsoDate(sunday))
  })

  it('reinicia a data do formulário ao trocar a semana', () => {
    setupFetch()
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Novo horário' }))
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: getCurrentMondayIso() } })
    fireEvent.click(screen.getByRole('button', { name: 'Próxima semana' }))

    const nextMonday = new Date(`${getCurrentMondayIso()}T00:00:00`)
    nextMonday.setDate(nextMonday.getDate() + 7)
    const nextMondayIso = toIsoDate(nextMonday)
    expect(screen.getByLabelText('Data')).toHaveValue(nextMondayIso)
    expect(screen.getByLabelText('Data')).toHaveAttribute('min', nextMondayIso)
  })

  it('cria disponibilidade, atualiza somente a lista semanal e invalida a prévia', async () => {
    const fetchMock = setupFetch()
    renderApp()

    fireEvent.click(screen.getByRole('button', { name: /Gerar pr/ }))
    expect(await screen.findByText('Revisar anatomia')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Novo horário' }))
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: getCurrentMondayIso() } })
    fireEvent.change(screen.getByLabelText('Horário inicial'), { target: { value: '10:00' } })
    fireEvent.change(screen.getByLabelText('Horário final'), { target: { value: '12:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar horário' }))

    expect(await screen.findByText('10:00–12:00')).toBeInTheDocument()
    expect(screen.queryByText('Revisar anatomia')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Gerar pr/ })).toBeInTheDocument()
    const post = fetchMock.mock.calls.find(([url, options]) => String(url) === '/api/disponibilidades-estudo' && options?.method === 'POST')
    expect(JSON.parse(post[1].body)).toEqual({ data: getCurrentMondayIso(), horaInicio: '10:00', horaFim: '12:00' })
    expect(fetchMock.getAvailabilityRequests()).toBe(2)
    expect(fetchMock.getDemandListRequests()).toBe(1)
  })

  it('mantém o cadastro aberto e impede duplicidade enquanto a criação está pendente', async () => {
    let releaseCreate
    const availabilityCreateGate = new Promise((resolve) => { releaseCreate = resolve })
    const fetchMock = setupFetch({ availabilityCreateGate })
    renderApp()

    fireEvent.click(screen.getByRole('button', { name: /Gerar pr/ }))
    expect(await screen.findByText('Revisar anatomia')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Novo horário' }))
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: getCurrentMondayIso() } })
    fireEvent.change(screen.getByLabelText('Horário inicial'), { target: { value: '10:00' } })
    fireEvent.change(screen.getByLabelText('Horário final'), { target: { value: '12:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar horário' }))

    const closeButton = screen.getByRole('button', { name: 'Fechar formulário' })
    const submitButton = screen.getByRole('button', { name: 'Salvando...' })
    const nextWeekButton = screen.getByRole('button', { name: 'Próxima semana' })
    const refreshButton = screen.getByRole('button', { name: 'Atualizar dados' })
    const previewButton = screen.getByRole('button', { name: 'Gerar prévia' })
    const confirmButton = screen.getByRole('button', { name: 'Confirmar planejamento' })
    expect(closeButton).toBeDisabled()
    expect(submitButton).toBeDisabled()
    expect(nextWeekButton).toBeDisabled()
    expect(refreshButton).toBeDisabled()
    expect(previewButton).toBeDisabled()
    expect(confirmButton).toBeDisabled()
    expect(screen.getByText('Revisar anatomia')).toBeInTheDocument()
    expect(screen.queryByText('10:00–12:00')).not.toBeInTheDocument()

    refreshButton.disabled = false
    previewButton.disabled = false
    confirmButton.disabled = false
    fireEvent.click(closeButton)
    fireEvent.click(submitButton)
    fireEvent.click(nextWeekButton)
    fireEvent.click(refreshButton)
    fireEvent.click(previewButton)
    fireEvent.click(confirmButton)
    expect(screen.getByRole('heading', { name: 'Novo horário de estudo' })).toBeInTheDocument()
    expect(fetchMock.getAvailabilityPostRequests()).toBe(1)
    expect(fetchMock.getAvailabilityRequests()).toBe(1)
    expect(fetchMock.getDemandListRequests()).toBe(1)
    expect(fetchMock.getConfirmationPostRequests()).toBe(0)
    expect(fetchMock.mock.calls.filter(([url]) => String(url).startsWith('/api/planejamento-semanal/previa?'))).toHaveLength(1)

    releaseCreate()

    expect(await screen.findByText('10:00–12:00')).toBeInTheDocument()
    expect(screen.queryByText('Revisar anatomia')).not.toBeInTheDocument()
    expect(fetchMock.getAvailabilityPostRequests()).toBe(1)
    expect(fetchMock.getAvailabilityRequests()).toBe(2)
    expect(fetchMock.getDemandListRequests()).toBe(1)
    expect(refreshButton).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Gerar prévia' })).toBeEnabled()
  })

  it('bloqueia o cadastro de disponibilidade enquanto a confirmação está pendente', async () => {
    let releaseConfirmation
    const confirmationGate = new Promise((resolve) => { releaseConfirmation = resolve })
    const fetchMock = setupFetch({ confirmationGate })
    renderApp()

    fireEvent.click(screen.getByRole('button', { name: /Gerar pr/ }))
    expect(await screen.findByText('Revisar anatomia')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Novo horário' }))
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: getCurrentMondayIso() } })
    fireEvent.change(screen.getByLabelText('Horário inicial'), { target: { value: '10:00' } })
    fireEvent.change(screen.getByLabelText('Horário final'), { target: { value: '12:00' } })

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar planejamento' }))
    expect(await screen.findByRole('button', { name: 'Confirmando…' })).toBeDisabled()

    expect(screen.getByRole('button', { name: 'Fechar formulário' })).toBeDisabled()
    expect(screen.getByLabelText('Data')).toBeDisabled()
    expect(screen.getByLabelText('Horário inicial')).toBeDisabled()
    expect(screen.getByLabelText('Horário final')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Salvar horário' })).toBeDisabled()

    const submitAvailabilityButton = screen.getByRole('button', { name: 'Salvar horário' })
    submitAvailabilityButton.disabled = false
    fireEvent.click(submitAvailabilityButton)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Aguarde a operação em andamento antes de cadastrar uma disponibilidade.',
    )
    expect(fetchMock.getAvailabilityPostRequests()).toBe(0)
    expect(fetchMock.getConfirmationPostRequests()).toBe(1)

    const toggleAvailabilityForm = screen.getByRole('button', { name: 'Fechar formulário' })
    toggleAvailabilityForm.disabled = false
    fireEvent.click(toggleAvailabilityForm)
    expect(screen.getByRole('heading', { name: 'Novo horário de estudo' })).toBeInTheDocument()

    releaseConfirmation()

    expect(await screen.findByText('Planejamento confirmado')).toBeInTheDocument()
    expect(screen.getByLabelText('Data')).toBeEnabled()
    expect(screen.getByLabelText('Horário inicial')).toBeEnabled()
    expect(screen.getByLabelText('Horário final')).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Salvar horário' })).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: 'Salvar horário' }))
    expect(await screen.findByText('10:00–12:00')).toBeInTheDocument()
    expect(fetchMock.getConfirmationPostRequests()).toBe(1)
    expect(fetchMock.getAvailabilityPostRequests()).toBe(1)
  })

  it.each([
    [409, 'Já existe uma disponibilidade sobreposta.'],
    [400, 'A data informada é inválida.'],
    [408, 'Não foi possível confirmar se a disponibilidade foi cadastrada. Consulte a lista antes de decidir se tentará novamente.'],
    [429, 'Não foi possível confirmar se a disponibilidade foi cadastrada. Consulte a lista antes de decidir se tentará novamente.'],
    [500, 'Não foi possível confirmar se a disponibilidade foi cadastrada. Consulte a lista antes de decidir se tentará novamente.'],
  ])('preserva os campos e informa erro HTTP %i ao cadastrar disponibilidade', async (status, detail) => {
    setupFetch({ availabilityPostResponse: { status, data: { detail } } })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Novo horário' }))
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: getCurrentMondayIso() } })
    fireEvent.change(screen.getByLabelText('Horário inicial'), { target: { value: '13:00' } })
    fireEvent.change(screen.getByLabelText('Horário final'), { target: { value: '14:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar horário' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(detail)
    expect(screen.getByLabelText('Data')).toHaveValue(getCurrentMondayIso())
    expect(screen.getByLabelText('Horário inicial')).toHaveValue('13:00')
    expect(screen.getByLabelText('Horário final')).toHaveValue('14:00')
    expect(screen.getByRole('heading', { name: 'Novo horário de estudo' })).toBeInTheDocument()
  })

  it('impede cadastro duplicado enquanto a requisição está em andamento', async () => {
    let releaseCreate
    const availabilityCreateGate = new Promise((resolve) => { releaseCreate = resolve })
    const fetchMock = setupFetch({
      availabilityCreateGate, availabilityPostResponse: {
      status: 201,
      data: {
        id: 12,
        data: getCurrentMondayIso(),
        horaInicio: '15:00:00',
        horaFim: '16:00:00',
      }
    }
   } )
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Novo horário' }))
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: getCurrentMondayIso() } })
    fireEvent.change(screen.getByLabelText('Horário inicial'), { target: { value: '15:00' } })
    fireEvent.change(screen.getByLabelText('Horário final'), { target: { value: '16:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar horário' }))
    expect(screen.getByRole('button', { name: 'Salvando...' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Salvando...' }))
    expect(fetchMock.getAvailabilityPostRequests()).toBe(1)
    releaseCreate()
    expect(
      await screen.findByText('15:00–16:00'),
    ).toBeInTheDocument()
  })

  it('rejeita horário final anterior ao inicial sem chamar a API', async () => {
    const fetchMock = setupFetch()
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Novo horário' }))
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: getCurrentMondayIso() } })
    fireEvent.change(screen.getByLabelText('Horário inicial'), { target: { value: '16:00' } })
    fireEvent.change(screen.getByLabelText('Horário final'), { target: { value: '15:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar horário' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('O horário final deve ser posterior ao horário inicial.')
    expect(fetchMock.getAvailabilityPostRequests()).toBe(0)
  })

  describe('Reconciliação de resultado incerto (HTTP 500)', () => {
    it('aguarda a conclusão do GET de reconciliação antes de fechar o formulário', async () => {
      let resolveReconcileGet
      const reconcileGetGate = new Promise((resolve) => { resolveReconcileGet = resolve })
      const fetchMock = setupFetch({
        availabilityPostResponse: { status: 500, data: { detail: 'Falha temporária.' } },
        availabilityFailures: 0,
        availabilityGetGate: reconcileGetGate,
      })
      renderApp()

      fireEvent.click(screen.getByRole('button', { name: 'Novo horário' }))
      fireEvent.change(screen.getByLabelText('Data'), { target: { value: getCurrentMondayIso() } })
      fireEvent.change(screen.getByLabelText('Horário inicial'), { target: { value: '10:00' } })
      fireEvent.change(screen.getByLabelText('Horário final'), { target: { value: '12:00' } })
      fireEvent.click(screen.getByRole('button', { name: 'Salvar horário' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível confirmar se a disponibilidade foi cadastrada')
      expect(screen.getByRole('heading', { name: 'Novo horário de estudo' })).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Consultar horários antes de tentar novamente' }))

      expect(screen.getByRole('heading', { name: 'Novo horário de estudo' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Consultando horários…' })).toBeInTheDocument()

      resolveReconcileGet()

      expect(await screen.findByText('09:00–11:00')).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Novo horário de estudo' })).not.toBeInTheDocument()
      expect(fetchMock.getAvailabilityPostRequests()).toBe(1)
    })

    it('mantém formulário aberto e mostra erro quando reconciliação falha', async () => {
      const reconcileGetError = new TypeError('Failed to fetch')
      const fetchMock = setupFetch({
        availabilityPostResponse: { status: 500, data: { detail: 'Falha temporária.' } },
        availabilityGetGate: Promise.reject(reconcileGetError),
      })
      renderApp()

      fireEvent.click(screen.getByRole('button', { name: 'Novo horário' }))
      fireEvent.change(screen.getByLabelText('Data'), { target: { value: getCurrentMondayIso() } })
      fireEvent.change(screen.getByLabelText('Horário inicial'), { target: { value: '10:00' } })
      fireEvent.change(screen.getByLabelText('Horário final'), { target: { value: '12:00' } })
      fireEvent.click(screen.getByRole('button', { name: 'Salvar horário' }))

      expect(await screen.findByText((content) => content.includes('Não foi possível confirmar se a disponibilidade foi cadastrada'))).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Consultar horários antes de tentar novamente' }))

      const alerts = await screen.findAllByRole('alert')
      const formError = alerts.find(a => a.textContent.includes('Failed to fetch'))
      expect(formError).toBeDefined()
      expect(screen.getByRole('heading', { name: 'Novo horário de estudo' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Consultar horários antes de tentar novamente' })).toBeInTheDocument()
      expect(fetchMock.getAvailabilityPostRequests()).toBe(1)

      expect(screen.getByRole('button', { name: 'Consultar horários antes de tentar novamente' })).not.toBeDisabled()
    })

    it('impede fechar formulário e trocar de semana enquanto resultado incerto', async () => {
      const fetchMock = setupFetch({
        availabilityPostResponse: { status: 500, data: { detail: 'Falha temporária.' } },
      })
      renderApp()

      fireEvent.click(screen.getByRole('button', { name: 'Novo horário' }))
      fireEvent.change(screen.getByLabelText('Data'), { target: { value: getCurrentMondayIso() } })
      fireEvent.change(screen.getByLabelText('Horário inicial'), { target: { value: '10:00' } })
      fireEvent.change(screen.getByLabelText('Horário final'), { target: { value: '12:00' } })
      fireEvent.click(screen.getByRole('button', { name: 'Salvar horário' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível confirmar se a disponibilidade foi cadastrada')

      const cancelButton = screen.getByRole('button', { name: 'Cancelar' })
      expect(cancelButton).toBeDisabled()

      const nextWeekButton = screen.getByRole('button', { name: 'Próxima semana' })
      expect(nextWeekButton).toBeDisabled()

      const prevWeekButton = screen.getByRole('button', { name: 'Semana anterior' })
      expect(prevWeekButton).toBeDisabled()

      const currentWeekButton = screen.getByRole('button', { name: 'Semana atual' })
      expect(currentWeekButton).toBeDisabled()

      const refreshButton = screen.getByRole('button', { name: 'Atualizar dados' })
      expect(refreshButton).toBeDisabled()

      const newDemandButton = screen.getByRole('button', { name: 'Nova demanda' })
      expect(newDemandButton).toBeDisabled()

      expect(fetchMock.getAvailabilityPostRequests()).toBe(1)
    })

    it('não reenvia POST automaticamente após reconciliação bem-sucedida', async () => {
      let resolveReconcileGet
      const reconcileGetGate = new Promise((resolve) => { resolveReconcileGet = resolve })
      const fetchMock = setupFetch({
        availabilityPostResponse: { status: 500, data: { detail: 'Falha temporária.' } },
        availabilityFailures: 0,
        availabilityGetGate: reconcileGetGate,
      })
      renderApp()

      fireEvent.click(screen.getByRole('button', { name: 'Novo horário' }))
      fireEvent.change(screen.getByLabelText('Data'), { target: { value: getCurrentMondayIso() } })
      fireEvent.change(screen.getByLabelText('Horário inicial'), { target: { value: '10:00' } })
      fireEvent.change(screen.getByLabelText('Horário final'), { target: { value: '12:00' } })
      fireEvent.click(screen.getByRole('button', { name: 'Salvar horário' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível confirmar se a disponibilidade foi cadastrada')
      expect(fetchMock.getAvailabilityPostRequests()).toBe(1)

      fireEvent.click(screen.getByRole('button', { name: 'Consultar horários antes de tentar novamente' }))

      expect(screen.getByRole('heading', { name: 'Novo horário de estudo' })).toBeInTheDocument()

      resolveReconcileGet()

      expect(await screen.findByText('09:00–11:00')).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Novo horário de estudo' })).not.toBeInTheDocument()

      expect(fetchMock.getAvailabilityPostRequests()).toBe(1)

      const nextWeekButton = screen.getByRole('button', { name: 'Próxima semana' })
      expect(nextWeekButton).toBeEnabled()
      const newDemandButton = screen.getByRole('button', { name: 'Nova demanda' })
      expect(newDemandButton).toBeEnabled()
    })

    it('não considera bloqueio por lock como reconciliação bem-sucedida', async () => {
      let releaseConfirmation
      const confirmationGate = new Promise((resolve) => { releaseConfirmation = resolve })
      setupFetch({ confirmationGate })
      renderApp()

      fireEvent.click(screen.getByRole('button', { name: /Gerar pr/ }))
      expect(await screen.findByText('Revisar anatomia')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Novo horário' }))
      fireEvent.change(screen.getByLabelText('Data'), { target: { value: getCurrentMondayIso() } })
      fireEvent.change(screen.getByLabelText('Horário inicial'), { target: { value: '10:00' } })
      fireEvent.change(screen.getByLabelText('Horário final'), { target: { value: '12:00' } })

      fireEvent.click(screen.getByRole('button', { name: 'Confirmar planejamento' }))
      expect(await screen.findByRole('button', { name: 'Confirmando…' })).toBeDisabled()

      const submitAvailabilityButton = screen.getByRole('button', { name: 'Salvar horário' })
      submitAvailabilityButton.disabled = false
      fireEvent.click(submitAvailabilityButton)

      expect(await screen.findByRole('alert')).toHaveTextContent('Aguarde a operação em andamento antes de cadastrar uma disponibilidade.')

      expect(screen.getByRole('heading', { name: 'Novo horário de estudo' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Salvar horário' })).toBeInTheDocument()

      expect(screen.queryByRole('button', { name: 'Consultar horários antes de tentar novamente' })).not.toBeInTheDocument()

      releaseConfirmation()
    })
  })
})