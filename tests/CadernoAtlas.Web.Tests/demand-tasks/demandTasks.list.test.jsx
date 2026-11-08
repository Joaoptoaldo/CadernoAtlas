import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderApp } from '../helpers/renderApp.jsx'
import { setupFetch } from '../helpers/fetchMocks.js'

describe('Tarefas de demandas — Listagem', () => {
  it('carrega tarefas somente ao expandir a demanda selecionada', async () => {
    const fetchMock = setupFetch()
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Demandas acadêmicas' }))
    await screen.findByText('Demanda gerenciada ativa')

    expect(fetchMock.getTaskRequests()).toBe(0)

    const expandButton = screen.getByRole('button', { name: 'Ver tarefas de Demanda gerenciada ativa' })
    expect(expandButton).toHaveAttribute('aria-expanded', 'false')
    expect(expandButton).not.toHaveAttribute('aria-controls')
    fireEvent.click(expandButton)

    expect(await screen.findByText('Nenhuma tarefa cadastrada para esta demanda.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ocultar tarefas de Demanda gerenciada ativa' })).toHaveAttribute('aria-controls', 'demand-tasks-1')
    expect(fetchMock.getTaskRequests(1)).toBe(1)
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/demandas-academicas/1/tarefas',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('exibe as tarefas na ordem recebida, com campos e situação compreensíveis', async () => {
    setupFetch({
      tasksByDemand: {
        1: [
          { id: 9, demandaAcademicaId: 1, titulo: 'Segunda etapa', descricao: 'Revisar os apontamentos.', ordem: 1, esforcoEstimadoMinutos: 45, situacao: 1 },
          { id: 8, demandaAcademicaId: 1, titulo: 'Primeira etapa', descricao: null, ordem: 0, esforcoEstimadoMinutos: null, situacao: 0 },
        ],
      },
    })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Demandas acadêmicas' }))
    await screen.findByText('Demanda gerenciada ativa')
    fireEvent.click(screen.getByRole('button', { name: 'Ver tarefas de Demanda gerenciada ativa' }))

    const taskRegion = await screen.findByRole('region', { name: 'Tarefas de Demanda gerenciada ativa' })
    const taskHeadings = within(taskRegion).getAllByRole('heading', { level: 4 })
    expect(taskHeadings.map((heading) => heading.textContent)).toEqual(['Segunda etapa', 'Primeira etapa'])
    expect(within(taskRegion).getByText('Revisar os apontamentos.')).toBeInTheDocument()
    expect(within(taskRegion).getByText('Etapa 2')).toBeInTheDocument()
    expect(within(taskRegion).getByText('45 min')).toBeInTheDocument()
    expect(within(taskRegion).getByText('Em andamento')).toBeInTheDocument()
    expect(within(taskRegion).getByText('Descrição não informada')).toBeInTheDocument()
    expect(within(taskRegion).getByText('Esforço não estimado')).toBeInTheDocument()
    expect(within(taskRegion).getByText('Pendente')).toBeInTheDocument()
  })

  it('reposiciona a tarefa editada e atualiza a ordem exibida das demais', async () => {
    setupFetch({
      tasksByDemand: {
        1: [
          { id: 1, demandaAcademicaId: 1, titulo: 'Primeira etapa', descricao: null, ordem: 0, esforcoEstimadoMinutos: null, situacao: 0 },
          { id: 2, demandaAcademicaId: 1, titulo: 'Segunda etapa', descricao: null, ordem: 1, esforcoEstimadoMinutos: null, situacao: 0 },
          { id: 3, demandaAcademicaId: 1, titulo: 'Terceira etapa', descricao: null, ordem: 2, esforcoEstimadoMinutos: null, situacao: 0 },
        ],
      },
    })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Demandas acadêmicas' }))
    await screen.findByText('Demanda gerenciada ativa')
    fireEvent.click(screen.getByRole('button', { name: 'Ver tarefas de Demanda gerenciada ativa' }))

    const taskRegion = await screen.findByRole('region', { name: 'Tarefas de Demanda gerenciada ativa' })
    fireEvent.click(within(taskRegion).getAllByRole('button', { name: 'Editar tarefa' })[0])
    fireEvent.change(within(taskRegion).getByLabelText('Posição da tarefa'), { target: { value: '3' } })
    fireEvent.click(within(taskRegion).getByRole('button', { name: 'Salvar tarefa' }))

    await waitFor(() => {
      expect(within(taskRegion).getAllByRole('heading', { level: 4 }).map((heading) => heading.textContent)).toEqual([
        'Segunda etapa', 'Terceira etapa', 'Primeira etapa',
      ])
    })
    expect(within(taskRegion).getAllByText(/^Etapa /).map((label) => label.textContent)).toEqual([
      'Etapa 1', 'Etapa 2', 'Etapa 3',
    ])
  })

  it('torna observável o carregamento enquanto a consulta de tarefas está pendente', async () => {
    let resolveTasks
    const taskGate = new Promise((resolve) => { resolveTasks = resolve })
    const fetchMock = setupFetch({ taskGates: { 1: taskGate } })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Demandas acadêmicas' }))
    await screen.findByText('Demanda gerenciada ativa')
    fireEvent.click(screen.getByRole('button', { name: 'Ver tarefas de Demanda gerenciada ativa' }))

    expect(screen.getByRole('status')).toHaveTextContent('Carregando tarefas')
    expect(fetchMock.getTaskRequests(1)).toBe(1)

    resolveTasks()
    expect(await screen.findByText('Nenhuma tarefa cadastrada para esta demanda.')).toBeInTheDocument()
  })

  it('apresenta falha de rede e recupera a consulta por nova tentativa', async () => {
    const fetchMock = setupFetch({
      taskResponseQueues: {
        1: [
          { error: new TypeError('Failed to fetch') },
          { status: 200, data: [{ id: 2, demandaAcademicaId: 1, titulo: 'Revisar conteúdo', descricao: null, ordem: 0, esforcoEstimadoMinutos: 30, situacao: 0 }] },
        ],
      },
    })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Demandas acadêmicas' }))
    await screen.findByText('Demanda gerenciada ativa')
    fireEvent.click(screen.getByRole('button', { name: 'Ver tarefas de Demanda gerenciada ativa' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar as tarefas')
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))

    expect(await screen.findByRole('heading', { name: 'Revisar conteúdo', level: 4 })).toBeInTheDocument()
    expect(fetchMock.getTaskRequests(1)).toBe(2)
  })

  it('trata HTTP 404 como demanda inexistente, não como lista vazia', async () => {
    setupFetch({ taskResponses: { 1: { status: 404, data: { detail: 'Demanda não encontrada.' } } } })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Demandas acadêmicas' }))
    await screen.findByText('Demanda gerenciada ativa')
    fireEvent.click(screen.getByRole('button', { name: 'Ver tarefas de Demanda gerenciada ativa' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Demanda não encontrada')
    expect(screen.queryByText('Nenhuma tarefa cadastrada para esta demanda.')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument()
  })

  it('mantém o contexto e permite repetir a consulta após uma resposta HTTP de falha', async () => {
    const fetchMock = setupFetch({
      taskResponseQueues: {
        1: [
          { status: 503, data: { detail: 'Falha temporária ao consultar tarefas.' } },
          { status: 200, data: [{ id: 5, demandaAcademicaId: 1, titulo: 'Tarefa recuperada', descricao: null, ordem: 0, esforcoEstimadoMinutos: null, situacao: 2 }] },
        ],
      },
    })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Demandas acadêmicas' }))
    await screen.findByText('Demanda gerenciada ativa')
    fireEvent.click(screen.getByRole('button', { name: 'Ver tarefas de Demanda gerenciada ativa' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Falha temporária ao consultar tarefas.')

    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))

    expect(await screen.findByRole('heading', { name: 'Tarefa recuperada', level: 4 })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Tarefas de Demanda gerenciada ativa' })).toBeInTheDocument()
    expect(fetchMock.getTaskRequests(1)).toBe(2)
  })

  it('troca a lista quando outra demanda é expandida', async () => {
    setupFetch({
      tasksByDemand: {
        1: [{ id: 1, demandaAcademicaId: 1, titulo: 'Tarefa da demanda ativa', descricao: null, ordem: 0, esforcoEstimadoMinutos: null, situacao: 0 }],
        3: [{ id: 3, demandaAcademicaId: 3, titulo: 'Tarefa da demanda concluída', descricao: null, ordem: 0, esforcoEstimadoMinutos: null, situacao: 2 }],
      },
    })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Demandas acadêmicas' }))
    await screen.findByText('Demanda gerenciada ativa')
    fireEvent.click(screen.getByRole('button', { name: 'Ver tarefas de Demanda gerenciada ativa' }))
    expect(await screen.findByRole('heading', { name: 'Tarefa da demanda ativa', level: 4 })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Ver tarefas de Trabalho concluído' }))

    expect(await screen.findByRole('heading', { name: 'Tarefa da demanda concluída', level: 4 })).toBeInTheDocument()
    expect(screen.queryByText('Tarefa da demanda ativa')).not.toBeInTheDocument()
  })

  it('ignora uma resposta tardia da demanda que deixou de estar selecionada', async () => {
    let resolveFirstDemand
    const firstDemandGate = new Promise((resolve) => { resolveFirstDemand = resolve })
    const fetchMock = setupFetch({
      taskGates: { 1: firstDemandGate },
      tasksByDemand: {
        1: [{ id: 1, demandaAcademicaId: 1, titulo: 'Resposta antiga', descricao: null, ordem: 0, esforcoEstimadoMinutos: null, situacao: 0 }],
        3: [{ id: 3, demandaAcademicaId: 3, titulo: 'Resposta atual', descricao: null, ordem: 0, esforcoEstimadoMinutos: null, situacao: 0 }],
      },
    })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Demandas acadêmicas' }))
    await screen.findByText('Demanda gerenciada ativa')
    fireEvent.click(screen.getByRole('button', { name: 'Ver tarefas de Demanda gerenciada ativa' }))
    expect(screen.getByRole('status')).toHaveTextContent('Carregando tarefas')
    const previousRequest = fetchMock.mock.calls.find(([url]) => String(url) === '/api/demandas-academicas/1/tarefas')
    const previousSignal = previousRequest[1].signal
    expect(previousSignal).toBeInstanceOf(AbortSignal)

    fireEvent.click(screen.getByRole('button', { name: 'Ver tarefas de Trabalho concluído' }))
    expect(previousSignal.aborted).toBe(true)
    expect(await screen.findByRole('heading', { name: 'Resposta atual', level: 4 })).toBeInTheDocument()

    resolveFirstDemand()
    await waitFor(() => expect(screen.queryByText('Resposta antiga')).not.toBeInTheDocument())
    expect(screen.getByRole('heading', { name: 'Resposta atual', level: 4 })).toBeInTheDocument()
  })

  it('mantém uma única lista correta durante o ciclo de efeitos do StrictMode', async () => {
    const fetchMock = setupFetch({
      tasksByDemand: {
        1: [{ id: 1, demandaAcademicaId: 1, titulo: 'Lista sob StrictMode', descricao: null, ordem: 0, esforcoEstimadoMinutos: null, situacao: 0 }],
      },
    })
    renderApp({ strict: true })
    fireEvent.click(screen.getByRole('button', { name: 'Demandas acadêmicas' }))
    await screen.findByText('Demanda gerenciada ativa')
    fireEvent.click(screen.getByRole('button', { name: 'Ver tarefas de Demanda gerenciada ativa' }))

    expect(await screen.findByRole('heading', { name: 'Lista sob StrictMode', level: 4 })).toBeInTheDocument()
    const taskRequests = fetchMock.mock.calls.filter(([url]) => String(url) === '/api/demandas-academicas/1/tarefas')
    expect(taskRequests).toHaveLength(2)
    expect(taskRequests[0][1].signal).toBeInstanceOf(AbortSignal)
    expect(taskRequests[0][1].signal.aborted).toBe(true)
    expect(taskRequests[1][1].signal.aborted).toBe(false)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('consulta uma vez por expansão e atualiza novamente somente ao reabrir', async () => {
    const fetchMock = setupFetch({
      tasksByDemand: {
        1: [{ id: 1, demandaAcademicaId: 1, titulo: 'Tarefa repetível', descricao: null, ordem: 0, esforcoEstimadoMinutos: null, situacao: 0 }],
      },
    })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Demandas acadêmicas' }))
    await screen.findByText('Demanda gerenciada ativa')
    const toggle = screen.getByRole('button', { name: 'Ver tarefas de Demanda gerenciada ativa' })
    fireEvent.click(toggle)
    expect(await screen.findByRole('heading', { name: 'Tarefa repetível', level: 4 })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Filtrar por situação'), { target: { value: '0' } })
    expect(fetchMock.getTaskRequests(1)).toBe(1)

    fireEvent.click(screen.getByRole('button', { name: 'Ocultar tarefas de Demanda gerenciada ativa' }))
    fireEvent.click(screen.getByRole('button', { name: 'Ver tarefas de Demanda gerenciada ativa' }))
    expect(await screen.findByRole('heading', { name: 'Tarefa repetível', level: 4 })).toBeInTheDocument()
    expect(fetchMock.getTaskRequests(1)).toBe(2)
  })
})