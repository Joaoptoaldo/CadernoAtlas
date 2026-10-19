import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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
  previewOverrides = {},
} = {}) {
  let remainingDemandFailures = demandFailures
  let currentDemands = demands
  let createdDemand = false
  let demandListRequests = 0
  let availabilityRequests = 0

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
      return jsonResponse(availability)
    }

    if (path === '/api/demandas-academicas' && init.method === 'POST') {
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
      return jsonResponse(postResponse.data, postResponse.status)
    }

    return jsonResponse({ title: 'Rota de teste não configurada.' }, 404)
  })

  vi.stubGlobal('fetch', fetchMock)
  fetchMock.getDemandListRequests = () => demandListRequests
  fetchMock.getAvailabilityRequests = () => availabilityRequests
  return fetchMock
}

describe('Planejamento semanal', () => {
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
    setupFetch({ demandFailures: 1 })
    render(<App />)

    expect(await screen.findByText('Falha temporária')).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Tentar novamente' }),
    )

    expect(
      await screen.findByRole('heading', { name: 'Prova de Anatomia' }),
    ).toBeInTheDocument()
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

  it('mantém a prévia e permite tentar novamente quando a confirmação falha', async () => {
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

    expect(alert).toHaveTextContent('O planejamento não foi confirmado')
    expect(alert).toHaveTextContent(
      'Falha temporária ao salvar o planejamento.',
    )

    expect(
      screen.getByRole('button', { name: 'Confirmar planejamento' }),
    ).toBeEnabled()

    expect(
      screen.getByRole('button', { name: 'Tentar novamente' }),
    ).toBeInTheDocument()

    expect(
      screen.queryByText('Planejamento confirmado'),
    ).not.toBeInTheDocument()

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/planejamento-semanal/confirmar',
      expect.objectContaining({ method: 'POST' }),
    )
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
