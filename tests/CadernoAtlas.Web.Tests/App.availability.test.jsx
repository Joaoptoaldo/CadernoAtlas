import { describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderApp } from './helpers/renderApp.jsx'
import { setupFetch, getCurrentMondayIso, toIsoDate } from './helpers/fetchMocks.js'

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

    // Aguarda o erro ser renderizado
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


  it('mantém o bloqueio de confirmação ao tentar novamente o carregamento das disponibilidades', async () => {
    let releaseConfirmation
    const confirmationGate = new Promise((resolve) => { releaseConfirmation = resolve })
    const fetchMock = setupFetch({
      availabilityFailures: 1,
      confirmationGate,
      postResponse: {
        status: 500,
        data: { detail: 'Falha temporária ao confirmar.' },
      },
    })
    renderApp()

    expect(await screen.findByText('Falha temporária ao carregar horários')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Gerar pr/ }))
    expect(await screen.findByText('Revisar anatomia')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Novo horário' }))
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: getCurrentMondayIso() } })
    fireEvent.change(screen.getByLabelText('Horário inicial'), { target: { value: '10:00' } })
    fireEvent.change(screen.getByLabelText('Horário final'), { target: { value: '12:00' } })

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar planejamento' }))
    expect(await screen.findByRole('button', { name: 'Confirmando…' })).toBeDisabled()

    const availabilityPanel = screen.getByRole('heading', { name: 'Disponibilidade' }).closest('.availability-panel')
    fireEvent.click(within(availabilityPanel).getByRole('button', { name: 'Tentar novamente' }))
    expect(fetchMock.getAvailabilityRequests()).toBe(1)
    expect(screen.getByRole('button', { name: 'Confirmando…' })).toBeInTheDocument()
    expect(screen.getByLabelText('Data')).toBeDisabled()

    const submitButton = screen.getByRole('button', { name: 'Salvar horário' })
    submitButton.disabled = false
    fireEvent.click(submitButton)
    expect(fetchMock.getAvailabilityPostRequests()).toBe(0)
    expect(fetchMock.getConfirmationPostRequests()).toBe(1)

    releaseConfirmation()

    expect(
      await screen.findByText(/Não foi possível verificar se o planejamento foi salvo/),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Data')).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Salvar horário' })).toBeEnabled()

    fireEvent.click(within(availabilityPanel).getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByText('09:00–11:00')).toBeInTheDocument()
    expect(fetchMock.getAvailabilityRequests()).toBe(2)

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

      // Verifica estado de resultado incerto
      expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível confirmar se a disponibilidade foi cadastrada')
      expect(screen.getByRole('heading', { name: 'Novo horário de estudo' })).toBeInTheDocument()

      // Clica em reconciliar
      fireEvent.click(screen.getByRole('button', { name: 'Consultar horários antes de tentar novamente' }))

      // Verifica que formulário permanece aberto enquanto GET pendente
      expect(screen.getByRole('heading', { name: 'Novo horário de estudo' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Consultando horários…' })).toBeInTheDocument()

      // Libera o GET com dados (a lista original tem 09:00–11:00)
      resolveReconcileGet()

      // Verifica que formulário fecha e lista atualizada aparece (com o horário original 09:00–11:00)
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

      // Primeiro erro: resultado incerto no POST
      expect(await screen.findByText((content) => content.includes('Não foi possível confirmar se a disponibilidade foi cadastrada'))).toBeInTheDocument()

      // Tenta reconciliar
      fireEvent.click(screen.getByRole('button', { name: 'Consultar horários antes de tentar novamente' }))

      // Verifica que formulário permanece aberto com mensagem de erro da reconciliação (form-error)
      // O erro é definido assincronamente após o onReconcile falhar
      // Primeiro verifica se existe algum alerta com o texto esperado
      const alerts = await screen.findAllByRole('alert')
      const formError = alerts.find(a => a.textContent.includes('Failed to fetch'))
      expect(formError).toBeDefined()
      expect(screen.getByRole('heading', { name: 'Novo horário de estudo' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Consultar horários antes de tentar novamente' })).toBeInTheDocument()
      expect(fetchMock.getAvailabilityPostRequests()).toBe(1)

      // Botão permanece habilitado para nova tentativa de reconciliação
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

      // Tenta fechar pelo botão Cancelar - deve estar desabilitado
      const cancelButton = screen.getByRole('button', { name: 'Cancelar' })
      expect(cancelButton).toBeDisabled()

      // Tenta trocar de semana - deve estar desabilitado
      const nextWeekButton = screen.getByRole('button', { name: 'Próxima semana' })
      expect(nextWeekButton).toBeDisabled()

      const prevWeekButton = screen.getByRole('button', { name: 'Semana anterior' })
      expect(prevWeekButton).toBeDisabled()

      const currentWeekButton = screen.getByRole('button', { name: 'Semana atual' })
      expect(currentWeekButton).toBeDisabled()

      // Botão atualizar dados também desabilitado
      const refreshButton = screen.getByRole('button', { name: 'Atualizar dados' })
      expect(refreshButton).toBeDisabled()

      // Botão nova demanda também desabilitado
      const newDemandButton = screen.getByRole('button', { name: 'Nova demanda' })
      expect(newDemandButton).toBeDisabled()

      // POST não deve ser reenviado
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

      // Aciona reconciliação
      fireEvent.click(screen.getByRole('button', { name: 'Consultar horários antes de tentar novamente' }))

      // Formulário deve permanecer aberto enquanto GET pendente
      expect(screen.getByRole('heading', { name: 'Novo horário de estudo' })).toBeInTheDocument()

      // Libera GET
      resolveReconcileGet()

      // Aguarda reconciliação completar e formulário fechar
      expect(await screen.findByText('09:00–11:00')).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Novo horário de estudo' })).not.toBeInTheDocument()

      // POST não foi reenviado
      expect(fetchMock.getAvailabilityPostRequests()).toBe(1)

      // Estado incerto global deve ter sido liberado - botões habilitados
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

      // Abre formulário de disponibilidade ANTES de iniciar a confirmação
      fireEvent.click(screen.getByRole('button', { name: 'Novo horário' }))
      fireEvent.change(screen.getByLabelText('Data'), { target: { value: getCurrentMondayIso() } })
      fireEvent.change(screen.getByLabelText('Horário inicial'), { target: { value: '10:00' } })
      fireEvent.change(screen.getByLabelText('Horário final'), { target: { value: '12:00' } })

      // Inicia confirmação para criar o lock
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar planejamento' }))
      expect(await screen.findByRole('button', { name: 'Confirmando…' })).toBeDisabled()

      const submitAvailabilityButton = screen.getByRole('button', { name: 'Salvar horário' })
      submitAvailabilityButton.disabled = false
      fireEvent.click(submitAvailabilityButton)

      // POST resulta em erro de concorrência (lock ativo)
      expect(await screen.findByRole('alert')).toHaveTextContent('Aguarde a operação em andamento antes de cadastrar uma disponibilidade.')

      // Formulário deve permanecer aberto (não fechou)
      expect(screen.getByRole('heading', { name: 'Novo horário de estudo' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Salvar horário' })).toBeInTheDocument()

      // O botão de reconciliação NÃO aparece para erros de lock local
      // pois outcomeUnknown não é definido para erros de concorrência local
      expect(screen.queryByRole('button', { name: 'Consultar horários antes de tentar novamente' })).not.toBeInTheDocument()

      releaseConfirmation()
    })


    it('bloqueia reconciliação quando criação de demanda está em andamento', async () => {
      // Configurar mock para permitir controlar tanto o POST de disponibilidade quanto o de demanda
      let releaseDemandCreate
      const demandCreateGate = new Promise((resolve) => { releaseDemandCreate = resolve })
      const fetchMock = setupFetch({
        availabilityPostResponse: { status: 500, data: { detail: 'Falha temporária.' } },
        createGate: demandCreateGate,
      })
      renderApp()

      // 1. Iniciar criação de demanda (lock ativo)
      fireEvent.click(screen.getByRole('button', { name: 'Nova demanda' }))
      fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Demanda concorrente' } })
      fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: '0' } })
      fireEvent.change(screen.getByLabelText('Importância'), { target: { value: '2' } })
      fireEvent.click(screen.getByRole('button', { name: 'Salvar demanda' }))

      // A criação de demanda está pendente (lock ativo)
      expect(screen.getByRole('button', { name: 'Salvando...' })).toBeInTheDocument()

      // 2. Tentar criar disponibilidade enquanto demanda sendo criada
      fireEvent.click(screen.getByRole('button', { name: 'Novo horário' }))
      fireEvent.change(screen.getByLabelText('Data'), { target: { value: getCurrentMondayIso() } })
      fireEvent.change(screen.getByLabelText('Horário inicial'), { target: { value: '10:00' } })
      fireEvent.change(screen.getByLabelText('Horário final'), { target: { value: '12:00' } })
      fireEvent.click(screen.getByRole('button', { name: 'Salvar horário' }))

      // POST de disponibilidade deve falhar com erro de lock
      expect(await screen.findByRole('alert')).toHaveTextContent('Aguarde a operação em andamento antes de cadastrar uma disponibilidade.')

      // Formulário de disponibilidade permanece aberto
      expect(screen.getByRole('heading', { name: 'Novo horário de estudo' })).toBeInTheDocument()

      // 3. Liberar o lock de demanda
      releaseDemandCreate()
      await screen.findByRole('alert')

      // Fechar formulário de demanda se ainda aberto
      const closeDemandButton = screen.queryByRole('button', { name: 'Cancelar' })
      if (closeDemandButton && !closeDemandButton.disabled) {
        fireEvent.click(closeDemandButton)
      }

      // 4. Criar disponibilidade com erro 500 -> outcomeUnknown
      fireEvent.click(screen.getByRole('button', { name: 'Novo horário' }))
      fireEvent.change(screen.getByLabelText('Data'), { target: { value: getCurrentMondayIso() } })
      fireEvent.change(screen.getByLabelText('Horário inicial'), { target: { value: '10:00' } })
      fireEvent.change(screen.getByLabelText('Horário final'), { target: { value: '12:00' } })
      fireEvent.click(screen.getByRole('button', { name: 'Salvar horário' }))

      // POST de disponibilidade resulta em erro 500 -> outcomeUnknown
      expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível confirmar se a disponibilidade foi cadastrada')

      // 5. Verificar que o POST não foi reenviado
      expect(fetchMock.getAvailabilityPostRequests()).toBe(1)
    })
  })
})
