import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import App from '../../src/CadernoAtlas.Web/src/App'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function toIsoDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getCurrentMondayIso() {
  const date = new Date()
  date.setHours(0, 0, 0, 0)

  if (date.getDay() === 0) {
    date.setDate(date.getDate() + 1)
  }

  date.setDate(date.getDate() - ((date.getDay() + 6) % 7))
  return toIsoDate(date)
}

const demandFixture = {
  demanda: {
    id: 1,
    titulo: 'Prova de Anatomia',
    tipo: 0,
    descricao: 'Revisar os sistemas do corpo humano',
    esforcoEstimadoMinutos: 120,
    importancia: 2,
  },
  faixaUrgencia: 'Até 3 dias',
  diasAtePrazo: 3,
  justificativa: 'Demanda prioritária para a semana.',
}

function buildPreview(inicioSemana) {
  return {
    inicioSemana,
    agora: '2026-10-18T10:00:00-03:00',
    propostaId: 'proposta-teste-123',
    alocacoes: [
      {
        dataPlanejada: inicioSemana,
        horaInicio: '09:00:00',
        duracaoPlanejadaMinutos: 60,
        demandaAcademicaId: 1,
        tarefaDemandaId: null,
        titulo: 'Revisar anatomia',
      },
    ],
    naoAlocadas: [
      {
        demandaAcademicaId: 2,
        tarefaDemandaId: null,
        titulo: 'Preparar seminário',
        descricao: 'Revisar os conceitos que ainda faltam.',
        motivo: 2,
      },
    ],
  }
}

function jsonResponse(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  }
}

function setupFetch({
  demands = [demandFixture],
  availability = [
    {
      id: 10,
      data: getCurrentMondayIso(),
      horaInicio: '09:00:00',
      horaFim: '11:00:00',
    },
  ],
  demandFailures = 0,
  availabilityFailures = 0,
  availabilityPostResponse = {
    status: 201,
    data: {
      id: 11,
      data: getCurrentMondayIso(),
      horaInicio: '10:00:00',
      horaFim: '12:00:00',
    },
  },
  availabilityCreateGate,
  createResponse = {
    status: 201,
    data: {
      id: 2,
      titulo: 'Trabalho de Fisiologia',
      descricao: null,
      tipo: 1,
      prazo: null,
      importancia: 2,
      esforcoEstimadoMinutos: 90,
      situacao: 0,
      criadoEm: '2026-10-18T12:00:00Z',
    },
  },
  createGate,
  postResponse = {
    status: 200,
    data: { sessoesCriadas: [{ id: 101 }] },
  },
  confirmationGate,
  previewOverrides = {},
} = {}) {
  let remainingDemandFailures = demandFailures
  let remainingAvailabilityFailures = availabilityFailures
  let currentDemands = demands
  let createdDemand = false
  let demandListRequests = 0
  let demandPostRequests = 0
  let availabilityRequests = 0
  let availabilityPostRequests = 0
  let confirmationPostRequests = 0
  let currentAvailability = availability

  const fetchMock = vi.fn(async (input, init = {}) => {
    const path = String(input)

    if (path === '/api/demandas-academicas/priorizadas') {
      demandListRequests += 1
      if (remainingDemandFailures > 0) {
        remainingDemandFailures -= 1
        return jsonResponse(
          { detail: 'Falha temporária' },
          503,
        )
      }

      return jsonResponse(createdDemand ? [...currentDemands, {
        demanda: createResponse.data,
        faixaUrgencia: 'Até 7 dias',
        diasAtePrazo: null,
        justificativa: 'Nova demanda cadastrada.',
      }] : currentDemands)
    }

    if (path.startsWith('/api/disponibilidades-estudo?')) {
      availabilityRequests += 1
      if (remainingAvailabilityFailures > 0) {
        remainingAvailabilityFailures -= 1
        return jsonResponse(
          { detail: 'Falha temporária ao carregar horários' },
          503,
        )
      }
      return jsonResponse(currentAvailability)
    }

    if (path === '/api/disponibilidades-estudo' && init.method === 'POST') {
      availabilityPostRequests += 1
      if (availabilityCreateGate) await availabilityCreateGate
      if (availabilityPostResponse.status >= 200 && availabilityPostResponse.status < 300) {
        currentAvailability = [...currentAvailability, availabilityPostResponse.data]
      }
      return jsonResponse(availabilityPostResponse.data, availabilityPostResponse.status)
    }

    if (path === '/api/demandas-academicas' && init.method === 'POST') {
      demandPostRequests += 1
      if (createGate) await createGate
      if (createResponse.status >= 200 && createResponse.status < 300) {
        createdDemand = true
      }
      return jsonResponse(createResponse.data, createResponse.status)
    }

    if (path.startsWith('/api/planejamento-semanal/previa?')) {
      const url = new URL(path, 'http://localhost')
      const inicioSemana = url.searchParams.get('inicioSemana')
      return jsonResponse({
        ...buildPreview(inicioSemana),
        ...previewOverrides,
      })
    }

    if (
      path === '/api/planejamento-semanal/confirmar' &&
      init.method === 'POST'
    ) {
      confirmationPostRequests += 1
      if (confirmationGate) await confirmationGate
      return jsonResponse(postResponse.data, postResponse.status)
    }

    return jsonResponse({ title: 'Rota de teste não configurada.' }, 404)
  })

  vi.stubGlobal('fetch', fetchMock)
  fetchMock.getDemandListRequests = () => demandListRequests
  fetchMock.getDemandPostRequests = () => demandPostRequests
  fetchMock.getAvailabilityRequests = () => availabilityRequests
  fetchMock.getAvailabilityPostRequests = () => availabilityPostRequests
  fetchMock.getConfirmationPostRequests = () => confirmationPostRequests
  return fetchMock
}

describe('Planejamento semanal', () => {
    it('impede atualizar os dados durante o cadastro de demanda', async () => {
    let releaseCreate
    const createGate = new Promise((resolve) => {
      releaseCreate = resolve
    })

    const fetchMock = setupFetch({ createGate })
    render(<App />)

    expect(
      await screen.findByText('Prova de Anatomia'),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Gerar prévia' }))
    expect(await screen.findByText('Revisar anatomia')).toBeInTheDocument()

    const demandRequestsBefore = fetchMock.getDemandListRequests()
    const availabilityRequestsBefore = fetchMock.getAvailabilityRequests()

    fireEvent.click(screen.getByRole('button', { name: 'Nova demanda' }))
    fireEvent.change(screen.getByLabelText('Título'), {
      target: { value: 'Trabalho de Fisiologia' },
    })
    fireEvent.change(screen.getByLabelText('Tipo'), {
      target: { value: '1' },
    })
    fireEvent.change(screen.getByLabelText('Importância'), {
      target: { value: '2' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar demanda' }))

    expect(
      await screen.findByRole('button', { name: 'Salvando...' }),
    ).toBeDisabled()

    const refreshButton = screen.getByRole('button', {
      name: 'Atualizar dados',
    })

    expect(refreshButton).toBeDisabled()

    // Simula a tentativa de contornar o bloqueio visual.
    refreshButton.disabled = false
    fireEvent.click(refreshButton)

    expect(fetchMock.getDemandListRequests()).toBe(demandRequestsBefore)
    expect(fetchMock.getAvailabilityRequests()).toBe(availabilityRequestsBefore)
    expect(screen.getByText('Revisar anatomia')).toBeInTheDocument()

    releaseCreate()

    expect(
      await screen.findByRole('heading', { name: 'Trabalho de Fisiologia' }),
    ).toBeInTheDocument()

    expect(fetchMock.getDemandListRequests()).toBe(demandRequestsBefore + 1)
    expect(fetchMock.getAvailabilityRequests()).toBe(availabilityRequestsBefore)
    expect(screen.queryByText('Revisar anatomia')).not.toBeInTheDocument()
  })
    it('mostra o estado vazio quando não há demandas ativas', async () => {
    setupFetch({ demands: [] })
    render(<App />)

    expect(
      await screen.findByText('Nenhuma demanda ativa por enquanto'),
    ).toBeInTheDocument()

    expect(
      screen.getByText(
        'Quando você cadastrar provas, trabalhos ou outras demandas, elas aparecerão aqui.',
      ),
    ).toBeInTheDocument()

    expect(
      screen.getByRole('button', { name: 'Nova demanda' }),
    ).toBeInTheDocument()

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('mostra o estado vazio quando não há horários cadastrados', async () => {
    setupFetch({ availability: [] })
    render(<App />)

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
    render(<App />)

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
    render(<App />)
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
    render(<App />)

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
    render(<App />)

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
    render(<App />)

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
    const toggleAvailabilityForm = screen.getByRole('button', { name: 'Fechar formulário' })
    toggleAvailabilityForm.disabled = false
    fireEvent.click(toggleAvailabilityForm)
    expect(screen.getByRole('heading', { name: 'Novo horário de estudo' })).toBeInTheDocument()
    expect(fetchMock.getAvailabilityPostRequests()).toBe(0)
    expect(fetchMock.getConfirmationPostRequests()).toBe(1)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Aguarde a confirmação do planejamento antes de cadastrar uma disponibilidade.',
    )

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
    render(<App />)

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
    [500, 'Falha temporária ao salvar o horário.'],
  ])('preserva os campos e informa erro HTTP %i ao cadastrar disponibilidade', async (status, detail) => {
    setupFetch({ availabilityPostResponse: { status, data: { detail } } })
    render(<App />)
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
    render(<App />)
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
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Novo horário' }))
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: getCurrentMondayIso() } })
    fireEvent.change(screen.getByLabelText('Horário inicial'), { target: { value: '16:00' } })
    fireEvent.change(screen.getByLabelText('Horário final'), { target: { value: '15:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar horário' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('O horário final deve ser posterior ao horário inicial.')
    expect(fetchMock.getAvailabilityPostRequests()).toBe(0)
  })

  it('exibe as demandas e a disponibilidade retornadas pela API', async () => {
    setupFetch()
    render(<App />)

    expect(
      await screen.findByRole('heading', { name: 'Prova de Anatomia' }),
    ).toBeInTheDocument()

    expect(
      screen.getByText('Revisar os sistemas do corpo humano'),
    ).toBeInTheDocument()

    expect(
      screen.getByRole('heading', { name: 'Disponibilidade' }),
    ).toBeInTheDocument()
  })

  it('permite tentar novamente depois de uma falha ao carregar demandas', async () => {
    const fetchMock = setupFetch({ demandFailures: 1 })
    render(<App />)

    expect(await screen.findByText('Falha temporária')).toBeInTheDocument()
    expect(fetchMock.getDemandListRequests()).toBe(1)
    expect(fetchMock.getAvailabilityRequests()).toBe(1)

    fireEvent.click(
      screen.getByRole('button', { name: 'Tentar novamente' }),
    )

    expect(
      await screen.findByRole('heading', { name: 'Prova de Anatomia' }),
    ).toBeInTheDocument()
    expect(fetchMock.getDemandListRequests()).toBe(2)
    expect(fetchMock.getAvailabilityRequests()).toBe(1)
  })

  it('tenta novamente apenas disponibilidades sem recarregar as demandas', async () => {
    const fetchMock = setupFetch({ availabilityFailures: 1 })
    render(<App />)

    expect(
      await screen.findByRole('heading', { name: 'Prova de Anatomia' }),
    ).toBeInTheDocument()
    expect(await screen.findByText('Falha temporária ao carregar horários')).toBeInTheDocument()
    expect(fetchMock.getDemandListRequests()).toBe(1)
    expect(fetchMock.getAvailabilityRequests()).toBe(1)

    fireEvent.click(
      screen.getByRole('button', { name: 'Tentar novamente' }),
    )

    expect(await screen.findByText('09:00–11:00')).toBeInTheDocument()
    expect(fetchMock.getDemandListRequests()).toBe(1)
    expect(fetchMock.getAvailabilityRequests()).toBe(2)
  })

  it('exibe as atividades sugeridas e as não alocadas sem salvá-las', async () => {
    const fetchMock = setupFetch()
    render(<App />)

    fireEvent.click(
      screen.getByRole('button', { name: /Gerar pr/ }),
    )

    expect(await screen.findByText('Revisar anatomia')).toBeInTheDocument()
    expect(screen.getByText('Preparar seminário')).toBeInTheDocument()
    expect(
      screen.getByText('Sem disponibilidade na semana'),
    ).toBeInTheDocument()

    const confirmationWasSent = fetchMock.mock.calls.some(
      ([url, options]) =>
        String(url) === '/api/planejamento-semanal/confirmar' &&
        options?.method === 'POST',
    )

    expect(confirmationWasSent).toBe(false)
  })

  it('informa quando nenhuma sessão pode ser alocada e impede a confirmação', async () => {
    const fetchMock = setupFetch({
      previewOverrides: {
        alocacoes: [],
      },
    })

    render(<App />)

    fireEvent.click(
      screen.getByRole('button', { name: /Gerar pr/ }),
    )

    expect(
      await screen.findByText('Nenhuma sessão sugerida'),
    ).toBeInTheDocument()

    expect(
      screen.getByText('Preparar seminário'),
    ).toBeInTheDocument()

    expect(
      screen.getByText('Revisar os conceitos que ainda faltam.'),
    ).toBeInTheDocument()

    const confirmButton = screen.getByRole('button', {
      name: 'Confirmar planejamento',
    })

    expect(confirmButton).toBeDisabled()

    fireEvent.click(confirmButton)

    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/planejamento-semanal/confirmar',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('envia os dados da prévia ao confirmar o planejamento', async () => {
    const fetchMock = setupFetch()
    render(<App />)

    fireEvent.click(
      screen.getByRole('button', { name: /Gerar pr/ }),
    )

    expect(await screen.findByText('Revisar anatomia')).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Confirmar planejamento' }),
    )

    expect(
      await screen.findByText('Planejamento confirmado'),
    ).toBeInTheDocument()

    const confirmationCall = fetchMock.mock.calls.find(
      ([url, options]) =>
        String(url) === '/api/planejamento-semanal/confirmar' &&
        options?.method === 'POST',
    )

    expect(confirmationCall).toBeDefined()

    const sentPayload = JSON.parse(confirmationCall[1].body)
    const expectedPreview = buildPreview(getCurrentMondayIso())

    expect(sentPayload).toEqual({
      inicioSemana: expectedPreview.inicioSemana,
      agora: expectedPreview.agora,
      propostaId: expectedPreview.propostaId,
      alocacoes: expectedPreview.alocacoes,
    })
  })

  it('exige uma nova prévia quando a conexão falha durante a confirmação', async () => {
    const fetchMock = setupFetch()
    const originalFetch = fetchMock.getMockImplementation()

    fetchMock.mockImplementation(async (input, init = {}) => {
      if (
        String(input) === '/api/planejamento-semanal/confirmar' &&
        init.method === 'POST'
      ) {
        throw new TypeError('Failed to fetch')
      }

      return originalFetch(input, init)
    })

    render(<App />)

    fireEvent.click(
      screen.getByRole('button', { name: /Gerar pr/ }),
    )

    expect(
      await screen.findByText('Revisar anatomia'),
    ).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Confirmar planejamento' }),
    )

    const alert = await screen.findByRole('alert')

    expect(alert).toHaveTextContent(
      'Não foi possível verificar se o planejamento foi salvo',
    )

    expect(
      screen.queryByRole('button', { name: 'Confirmar planejamento' }),
    ).not.toBeInTheDocument()

    const confirmationRequests = () =>
      fetchMock.mock.calls.filter(
        ([url, options]) =>
          String(url) === '/api/planejamento-semanal/confirmar' &&
          options?.method === 'POST',
      )

    expect(confirmationRequests()).toHaveLength(1)

    fireEvent.click(
      screen.getByRole('button', { name: 'Tentar novamente' }),
    )

    expect(
      await screen.findByText('Revisar anatomia'),
    ).toBeInTheDocument()

    const previewRequests = fetchMock.mock.calls.filter(([url]) =>
      String(url).startsWith('/api/planejamento-semanal/previa?'),
    )

    expect(previewRequests).toHaveLength(2)
    expect(confirmationRequests()).toHaveLength(1)
  })
  it('informa quando a confirmação encontra um conflito HTTP 409', async () => {
    setupFetch({
      postResponse: {
        status: 409,
        data: {
          title: 'Conflito',
          detail: 'A proposta não pode mais ser confirmada.',
        },
      },
    })

    render(<App />)

    fireEvent.click(
      screen.getByRole('button', { name: /Gerar pr/ }),
    )

    expect(await screen.findByText('Revisar anatomia')).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Confirmar planejamento' }),
    )

    const alert = await screen.findByRole('alert')

    expect(alert).toHaveTextContent('Prévia desatualizada')
    expect(alert).toHaveTextContent(
      'Esta prévia ficou desatualizada ou os horários entraram em conflito.',
    )
    expect(alert).toHaveTextContent(
      'O planejamento não foi salvo. Nenhuma sessão desta proposta foi criada.',
    )

    expect(
      screen.queryByText('Planejamento confirmado'),
    ).not.toBeInTheDocument()

    expect(
      screen.queryByRole('button', { name: 'Confirmar planejamento' }),
    ).not.toBeInTheDocument()

    expect(
      screen.getByRole('button', { name: 'Tentar novamente' }),
    ).toBeInTheDocument()
  })

  it('não permite reenviar a mesma prévia após erro HTTP 400 na confirmação', async () => {
    const fetchMock = setupFetch({
      postResponse: {
        status: 400,
        data: {
          detail: 'A proposta enviada é inválida.',
        },
      },
    })

    render(<App />)

    fireEvent.click(
      screen.getByRole('button', { name: /Gerar pr/ }),
    )

    expect(
      await screen.findByText('Revisar anatomia'),
    ).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Confirmar planejamento' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A proposta enviada é inválida.',
    )

    expect(
      screen.queryByRole('button', { name: 'Tentar novamente' }),
    ).not.toBeInTheDocument()

    expect(
      screen.getByRole('button', { name: 'Confirmar planejamento' }),
    ).toBeDisabled()

    const confirmationRequests = fetchMock.mock.calls.filter(
      ([url, options]) =>
        String(url) === '/api/planejamento-semanal/confirmar' &&
        options?.method === 'POST',
    )

    expect(confirmationRequests).toHaveLength(1)
  })

  it('exige uma nova prévia quando a confirmação retorna HTTP 500', async () => {
    const fetchMock = setupFetch({
      postResponse: {
        status: 500,
        data: {
          detail: 'Falha temporária ao salvar o planejamento.',
        },
      },
    })

    render(<App />)

    fireEvent.click(
      screen.getByRole('button', { name: /Gerar pr/ }),
    )

    expect(
      await screen.findByText('Revisar anatomia'),
    ).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Confirmar planejamento' }),
    )

    const alert = await screen.findByRole('alert')

    expect(alert).toHaveTextContent(
      'Não foi possível verificar se o planejamento foi salvo',
    )

    expect(
      screen.queryByRole('button', { name: 'Confirmar planejamento' }),
    ).not.toBeInTheDocument()

    expect(
      screen.getByRole('button', { name: 'Tentar novamente' }),
    ).toBeInTheDocument()

    expect(
      screen.queryByText('Planejamento confirmado'),
    ).not.toBeInTheDocument()

    const confirmationRequests = () =>
      fetchMock.mock.calls.filter(
        ([url, options]) =>
          String(url) === '/api/planejamento-semanal/confirmar' &&
          options?.method === 'POST',
      )

    expect(confirmationRequests()).toHaveLength(1)

    fireEvent.click(
      screen.getByRole('button', { name: 'Tentar novamente' }),
    )

    expect(
      await screen.findByText('Revisar anatomia'),
    ).toBeInTheDocument()

    const previewRequests = fetchMock.mock.calls.filter(([url]) =>
      String(url).startsWith('/api/planejamento-semanal/previa?'),
    )

    expect(previewRequests).toHaveLength(2)
    expect(confirmationRequests()).toHaveLength(1)
  })

  it('abre e preenche o formulário de nova demanda', async () => {
    setupFetch()
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Nova demanda' }))

    expect(screen.getByRole('heading', { name: 'Nova demanda acadêmica' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Trabalho de Fisiologia' } })
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Importância'), { target: { value: '2' } })

    expect(screen.getByLabelText('Título')).toHaveValue('Trabalho de Fisiologia')
    expect(screen.getByLabelText('Tipo')).toHaveValue('1')
    expect(screen.getByLabelText('Importância')).toHaveValue('2')
  })

  it('envia o payload do contrato e atualiza a lista após criar a demanda', async () => {
    const fetchMock = setupFetch()
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /Gerar pr/ }))
    expect(await screen.findByText('Revisar anatomia')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Nova demanda' }))
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: '  Trabalho de Fisiologia  ' } })
    fireEvent.change(screen.getByLabelText('Descrição (opcional)'), { target: { value: '  Preparar apresentação  ' } })
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Importância'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Prazo (opcional)'), { target: { value: '2026-11-05' } })
    fireEvent.change(screen.getByLabelText('Esforço estimado em minutos (opcional)'), { target: { value: '90' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar demanda' }))

    expect(await screen.findByRole('heading', { name: 'Trabalho de Fisiologia' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Nova demanda acadêmica' })).not.toBeInTheDocument()
    expect(screen.queryByText('Revisar anatomia')).not.toBeInTheDocument()
    expect(screen.getByText('Gere uma proposta com base nas demandas, nos horários disponíveis e nas sessões já existentes. Você revisa antes de salvar.')).toBeInTheDocument()

    const createCall = fetchMock.mock.calls.find(
      ([url, options]) => String(url) === '/api/demandas-academicas' && options?.method === 'POST',
    )
    expect(createCall).toBeDefined()
    expect(JSON.parse(createCall[1].body)).toEqual({
      titulo: 'Trabalho de Fisiologia',
      descricao: 'Preparar apresentação',
      tipo: 1,
      prazo: '2026-11-05',
      importancia: 2,
      esforcoEstimadoMinutos: 90,
    })
    expect(fetchMock.getDemandListRequests()).toBe(2)
    expect(fetchMock.getAvailabilityRequests()).toBe(1)
  })

  it('impede confirmar ou gerar prévia durante o cadastro de demanda e libera o novo fluxo após concluir', async () => {
    let releaseCreate
    const createGate = new Promise((resolve) => { releaseCreate = resolve })
    const fetchMock = setupFetch({ createGate })
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Gerar prévia' }))
    expect(await screen.findByText('Revisar anatomia')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Nova demanda' }))
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Trabalho de Fisiologia' } })
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Importância'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar demanda' }))
    expect(await screen.findByRole('button', { name: 'Salvando...' })).toBeDisabled()

    const confirmButton = screen.getByRole('button', { name: 'Confirmar planejamento' })
    const previewButton = screen.getByRole('button', { name: 'Gerar prévia' })
    expect(confirmButton).toBeDisabled()
    expect(previewButton).toBeDisabled()

    confirmButton.disabled = false
    previewButton.disabled = false
    fireEvent.click(confirmButton)
    fireEvent.click(previewButton)

    expect(fetchMock.getConfirmationPostRequests()).toBe(0)
    expect(fetchMock.getDemandPostRequests()).toBe(1)
    expect(fetchMock.mock.calls.filter(([url]) => String(url).startsWith('/api/planejamento-semanal/previa?'))).toHaveLength(1)

    releaseCreate()

    expect(await screen.findByRole('heading', { name: 'Trabalho de Fisiologia' })).toBeInTheDocument()
    expect(screen.queryByText('Revisar anatomia')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirmar planejamento' })).not.toBeInTheDocument()
    expect(fetchMock.getDemandPostRequests()).toBe(1)

    fireEvent.click(screen.getByRole('button', { name: 'Gerar prévia' }))
    expect(await screen.findByText('Revisar anatomia')).toBeInTheDocument()
    expect(fetchMock.mock.calls.filter(([url]) => String(url).startsWith('/api/planejamento-semanal/previa?'))).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar planejamento' }))
    expect(await screen.findByText('Planejamento confirmado')).toBeInTheDocument()
    expect(fetchMock.getConfirmationPostRequests()).toBe(1)
  })

  it('exibe erro da API e preserva os valores preenchidos', async () => {
    setupFetch({
      createResponse: {
        status: 400,
        data: { detail: 'O prazo informado é inválido.' },
      },
    })
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /Gerar pr/ }))
    expect(await screen.findByText('Revisar anatomia')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Nova demanda' }))
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Prova de Bioquímica' } })
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: '0' } })
    fireEvent.change(screen.getByLabelText('Importância'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Prazo (opcional)'), { target: { value: '2026-10-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar demanda' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('O prazo informado é inválido.')
    expect(screen.getByLabelText('Título')).toHaveValue('Prova de Bioquímica')
    expect(screen.getByLabelText('Tipo')).toHaveValue('0')
    expect(screen.getByLabelText('Importância')).toHaveValue('1')
    expect(screen.getByLabelText('Prazo (opcional)')).toHaveValue('2026-10-01')
    expect(screen.getByRole('heading', { name: 'Nova demanda acadêmica' })).toBeInTheDocument()
    expect(screen.getByText('Revisar anatomia')).toBeInTheDocument()
  })

  it('impede envios duplicados enquanto a requisição está em andamento', async () => {
    let releaseCreate
    const createGate = new Promise((resolve) => {
      releaseCreate = resolve
    })
    const fetchMock = setupFetch({ createGate })
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Nova demanda' }))
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Prova de Histologia' } })
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: '0' } })
    fireEvent.change(screen.getByLabelText('Importância'), { target: { value: '1' } })

    const submitButton = screen.getByRole('button', { name: 'Salvar demanda' })
    fireEvent.click(submitButton)
    expect(screen.getByRole('button', { name: 'Salvando...' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Salvando...' }))

    expect(fetchMock.mock.calls.filter(
      ([url, options]) => String(url) === '/api/demandas-academicas' && options?.method === 'POST',
    )).toHaveLength(1)
    releaseCreate()
    expect(await screen.findByRole('heading', { name: 'Trabalho de Fisiologia' })).toBeInTheDocument()
  })
})
