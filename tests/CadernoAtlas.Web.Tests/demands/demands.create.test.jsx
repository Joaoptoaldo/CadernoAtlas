import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderApp } from '../helpers/renderApp.jsx'
import { setupFetch, getCurrentMondayIso } from '../helpers/fetchMocks.js'

describe('Demandas acadêmicas — Criação', () => {
  it('abre e preenche o formulário de nova demanda', async () => {
    setupFetch()
    renderApp()

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
    renderApp()

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

  it('informa mutação confirmada quando a atualização posterior da lista falha e permite atualizar sem novo POST', async () => {
    const fetchMock = setupFetch({
      allDemandReconcileFailures: 1,
      createResponse: {
        status: 201,
        data: {
          id: 2,
          titulo: 'Demanda confirmada',
          descricao: null,
          tipo: 1,
          prazo: null,
          importancia: 2,
          esforcoEstimadoMinutos: 90,
          situacao: 0,
          criadoEm: '2026-10-18T12:00:00Z',
        },
      },
      allDemands: [
        { id: 1, titulo: 'Demanda gerenciada ativa', descricao: 'Resumo para ficha de estudo', tipo: 0, prazo: '2026-11-01', importancia: 2, esforcoEstimadoMinutos: 120, situacao: 0, criadoEm: '2026-10-01T10:00:00Z' },
        { id: 3, titulo: 'Trabalho concluído', descricao: null, tipo: 1, prazo: null, importancia: 1, esforcoEstimadoMinutos: null, situacao: 2, criadoEm: '2026-09-01T10:00:00Z' },
        { id: 4, titulo: 'Tarefa cancelada', descricao: null, tipo: 4, prazo: '2026-12-01', importancia: 0, esforcoEstimadoMinutos: 30, situacao: 3, criadoEm: '2026-09-02T10:00:00Z' },
      ],
    })
    renderApp()

    fireEvent.click(screen.getByRole('button', { name: 'Nova demanda' }))
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Demanda confirmada' } })
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Importância'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar demanda' }))

    expect((await screen.findAllByText(/A demanda foi criada, mas a lista não pôde ser atualizada/)).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Atualizar lista de demandas' })).toBeInTheDocument()
    expect(fetchMock.getDemandPostRequests()).toBe(1)

    fireEvent.click(screen.getByRole('button', { name: 'Atualizar lista de demandas' }))

    expect(await screen.findByText('Demanda confirmada')).toBeInTheDocument()
    expect(fetchMock.getDemandPostRequests()).toBe(1)
  })

  it('impede confirmar ou gerar prévia durante o cadastro de demanda e libera o novo fluxo após concluir', async () => {
    let releaseCreate
    const createGate = new Promise((resolve) => { releaseCreate = resolve })
    const fetchMock = setupFetch({ createGate })
    renderApp()

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
    renderApp()

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
    renderApp()

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

  it('reconciliação de criação bem-sucedida atualiza a lista completa e recarrega a lista priorizada pelo endpoint correto', async () => {
    const fetchMock = setupFetch()
    renderApp()

    fireEvent.click(screen.getByRole('button', { name: /Gerar pr/ }))
    expect(await screen.findByText('Revisar anatomia')).toBeInTheDocument()

    const priorListRequestsBefore = fetchMock.getDemandListRequests()
    const allDemandRequestsBefore = fetchMock.getAllDemandRequests()

    fireEvent.click(screen.getByRole('button', { name: 'Nova demanda' }))
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Trabalho de Fisiologia' } })
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Importância'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar demanda' }))

    expect(await screen.findByRole('heading', { name: 'Trabalho de Fisiologia' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Nova demanda acadêmica' })).not.toBeInTheDocument()

    expect(fetchMock.getAllDemandRequests()).toBeGreaterThan(allDemandRequestsBefore)
    expect(fetchMock.getDemandListRequests()).toBeGreaterThan(priorListRequestsBefore)
  })

  it('falha na reconciliação de criação: mantém estado incerto, não libera o fluxo e não repete o POST', { timeout: 15000 }, async () => {
    const fetchMock = setupFetch({
      createResponse: { status: 503, data: { detail: 'Falha temporária de rede' } },
      allDemandReconcileFailures: 1
    })
    renderApp()

    fireEvent.click(screen.getByRole('button', { name: /Gerar pr/ }))
    expect(await screen.findByText('Revisar anatomia')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Nova demanda' }))
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Trabalho incerto' } })
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Importância'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar demanda' }))

    await waitFor(() => expect(screen.getByText(/Não foi possível confirmar/)).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Consultar demandas antes de tentar novamente' })).toBeInTheDocument()

    expect(screen.getByRole('button', { name: 'Salvar demanda' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Consultar demandas antes de tentar novamente' }))
    await waitFor(() => {
      const alert = screen.getByRole('alert')
      expect(alert.textContent).toMatch(/Falha tempor[aá]ria na lista completa\.?/i)
    }, { timeout: 10000 })

    expect(fetchMock.getDemandPostRequests()).toBe(1)
  })

  it('concorrência: resposta antiga não substitui estado da reconciliação mais recente', async () => {
    let releaseReconcile
    const reconcileGate = new Promise((resolve) => { releaseReconcile = resolve })
    const expectedDemand = {
      id: 2,
      titulo: 'Demanda rápida',
      descricao: null,
      tipo: 1,
      prazo: null,
      importancia: 2,
      esforcoEstimadoMinutos: null,
      situacao: 0,
      criadoEm: '2026-10-18T12:00:00Z',
    }
    const fetchMock = setupFetch({
      createResponse: { error: new TypeError('Failed to fetch') },
      allDemandReconcileGate: reconcileGate,
      allDemands: [
        { id: 1, titulo: 'Demanda gerenciada ativa', descricao: 'Resumo para ficha de estudo', tipo: 0, prazo: '2026-11-01', importancia: 2, esforcoEstimadoMinutos: 120, situacao: 0, criadoEm: '2026-10-01T10:00:00Z' },
        expectedDemand,
        { id: 3, titulo: 'Trabalho concluído', descricao: null, tipo: 1, prazo: null, importancia: 1, esforcoEstimadoMinutos: null, situacao: 2, criadoEm: '2026-09-01T10:00:00Z' },
        { id: 4, titulo: 'Tarefa cancelada', descricao: null, tipo: 4, prazo: '2026-12-01', importancia: 0, esforcoEstimadoMinutos: 30, situacao: 3, criadoEm: '2026-09-02T10:00:00Z' },
      ]
    })
    renderApp()

    fireEvent.click(screen.getByRole('button', { name: 'Gerar prévia' }))
    expect(await screen.findByText('Revisar anatomia')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Nova demanda' }))
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Demanda rápida' } })
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Importância'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar demanda' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/Não foi possível confirmar/)
    expect(screen.getByRole('button', { name: 'Consultar demandas antes de tentar novamente' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Consultar demandas antes de tentar novamente' }))
    const postRequestsBefore = fetchMock.getDemandPostRequests()
    expect(postRequestsBefore).toBe(1)

    releaseReconcile()

    fireEvent.click(screen.getByRole('button', { name: 'Demandas acadêmicas' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Demanda rápida' })).toBeInTheDocument())

    expect(fetchMock.getDemandPostRequests()).toBe(1)
  })
})