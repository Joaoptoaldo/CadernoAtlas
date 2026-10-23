import { describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderApp } from './helpers/renderApp.jsx'
import { setupFetch } from './helpers/fetchMocks.js'

describe('Tarefas de demandas', () => {
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


  it('cria uma tarefa com o contrato da API, limpa o formulário e atualiza a lista', async () => {
    const fetchMock = setupFetch()
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Demandas acadêmicas' }))
    await screen.findByText('Demanda gerenciada ativa')
    fireEvent.click(screen.getByRole('button', { name: 'Ver tarefas de Demanda gerenciada ativa' }))
    await screen.findByText('Nenhuma tarefa cadastrada para esta demanda.')
    fireEvent.click(screen.getByRole('button', { name: 'Nova tarefa' }))

    fireEvent.change(screen.getByLabelText('Título da tarefa'), { target: { value: '  Ler capítulo  ' } })
    fireEvent.change(screen.getByLabelText('Descrição (opcional)'), { target: { value: '  Fazer anotações  ' } })
    fireEvent.change(screen.getByLabelText('Esforço estimado em minutos (opcional)'), { target: { value: '45' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar tarefa' }))

    expect(await screen.findByRole('heading', { name: 'Ler capítulo', level: 4 })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/demandas-academicas/1/tarefas', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ titulo: 'Ler capítulo', descricao: 'Fazer anotações', esforcoEstimadoMinutos: 45 }),
    }))
    expect(fetchMock.getTaskRequests(1)).toBe(2)
    expect(screen.getByLabelText('Título da tarefa')).toHaveValue('')
    expect(screen.getByLabelText('Descrição (opcional)')).toHaveValue('')
    expect(screen.getByLabelText('Esforço estimado em minutos (opcional)')).toHaveValue(null)
    expect(fetchMock.getTaskPostRequests()).toBe(1)
  })


  it('bloqueia prévia, confirmação, atualização e outros cadastros durante o POST da tarefa', async () => {
    let releaseTask
    const taskGate = new Promise((resolve) => { releaseTask = resolve })
    const fetchMock = setupFetch({ taskCreateGate: taskGate })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: /Gerar pr/ }))
    expect(await screen.findByText('Revisar anatomia')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Nova demanda' }))
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Demanda concorrente' } })
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Importância'), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Novo horário' }))
    const availabilityTimes = document.querySelectorAll('#create-availability-form input[type="time"]')
    fireEvent.change(availabilityTimes[0], { target: { value: '13:00' } })
    fireEvent.change(availabilityTimes[1], { target: { value: '14:00' } })

    fireEvent.click(screen.getByRole('button', { name: 'Demandas acadêmicas' }))
    await screen.findByText('Demanda gerenciada ativa')
    fireEvent.click(screen.getByRole('button', { name: 'Ver tarefas de Demanda gerenciada ativa' }))
    await screen.findByText('Nenhuma tarefa cadastrada para esta demanda.')
    fireEvent.click(screen.getByRole('button', { name: 'Nova tarefa' }))
    fireEvent.change(screen.getByLabelText('Título da tarefa'), { target: { value: 'Tarefa pendente' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar tarefa' }))
    await waitFor(() => expect(fetchMock.getTaskPostRequests()).toBe(1))
    fireEvent.submit(document.getElementById('create-task-form-1'))
    expect(fetchMock.getTaskPostRequests()).toBe(1)

    const priorDemandGets = fetchMock.getDemandListRequests()
    const priorAllDemandGets = fetchMock.getAllDemandRequests()
    const priorAvailabilityGets = fetchMock.getAvailabilityRequests()
    fireEvent.click(screen.getByRole('button', { name: 'Planejamento semanal' }))
    const refreshButton = screen.getByRole('button', { name: 'Atualizar dados' })
    const previewButton = screen.getByRole('button', { name: 'Gerar prévia' })
    const confirmButton = screen.getByRole('button', { name: 'Confirmar planejamento' })
    expect(refreshButton).toBeDisabled()
    expect(previewButton).toBeDisabled()
    expect(confirmButton).toBeDisabled()
    refreshButton.disabled = false
    previewButton.disabled = false
    confirmButton.disabled = false
    fireEvent.click(refreshButton)
    fireEvent.click(previewButton)
    fireEvent.click(confirmButton)
    fireEvent.submit(document.getElementById('create-demand-form'))
    fireEvent.submit(document.getElementById('create-availability-form'))

    expect(fetchMock.getDemandListRequests()).toBe(priorDemandGets)
    expect(fetchMock.getAllDemandRequests()).toBe(priorAllDemandGets)
    expect(fetchMock.getAvailabilityRequests()).toBe(priorAvailabilityGets)
    expect(fetchMock.getDemandPostRequests()).toBe(0)
    expect(fetchMock.getAvailabilityPostRequests()).toBe(0)
    expect(fetchMock.getPreviewRequests()).toBe(1)
    expect(fetchMock.getConfirmationPostRequests()).toBe(0)

    releaseTask()
    expect(await screen.findByText('Tarefa criada.')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Confirmar planejamento' })).not.toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Gerar prévia' }))
    expect(await screen.findByText('Revisar anatomia')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar planejamento' }))
    expect(await screen.findByText('Planejamento confirmado')).toBeInTheDocument()
    expect(fetchMock.getTaskPostRequests()).toBe(1)
    expect(fetchMock.getPreviewRequests()).toBe(2)
    expect(fetchMock.getConfirmationPostRequests()).toBe(1)
  })


  it('valida e normaliza os campos antes de enviar a tarefa', async () => {
    const fetchMock = setupFetch()
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Demandas acadêmicas' }))
    await screen.findByText('Demanda gerenciada ativa')
    fireEvent.click(screen.getByRole('button', { name: 'Ver tarefas de Demanda gerenciada ativa' }))
    await screen.findByText('Nenhuma tarefa cadastrada para esta demanda.')
    fireEvent.click(screen.getByRole('button', { name: 'Nova tarefa' }))
    const title = screen.getByLabelText('Título da tarefa')
    fireEvent.change(title, { target: { value: '  x ' } })
    fireEvent.submit(title.closest('form'))
    expect(await screen.findByRole('alert')).toHaveTextContent('entre 2 e 150 caracteres')
    expect(fetchMock.getTaskPostRequests()).toBe(0)

    fireEvent.change(title, { target: { value: 'Tarefa válida' } })
    fireEvent.change(screen.getByLabelText('Esforço estimado em minutos (opcional)'), { target: { value: '1.5' } })
    fireEvent.submit(title.closest('form'))
    expect(await screen.findByRole('alert')).toHaveTextContent('número inteiro maior que zero')
    expect(fetchMock.getTaskPostRequests()).toBe(0)
  })


  it('preserva os campos após HTTP 400 e permite corrigir a tarefa', async () => {
    const fetchMock = setupFetch({ taskCreateResponses: [
      { status: 400, data: { detail: 'O título informado não é válido.' } },
      null,
    ] })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: /Gerar pr/ }))
    expect(await screen.findByText('Revisar anatomia')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Demandas acadêmicas' }))
    await screen.findByText('Demanda gerenciada ativa')
    fireEvent.click(screen.getByRole('button', { name: 'Ver tarefas de Demanda gerenciada ativa' }))
    await screen.findByText('Nenhuma tarefa cadastrada para esta demanda.')
    fireEvent.click(screen.getByRole('button', { name: 'Nova tarefa' }))
    fireEvent.change(screen.getByLabelText('Título da tarefa'), { target: { value: 'Tarefa corrigível' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar tarefa' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('O título informado não é válido.')
    expect(screen.getByLabelText('Título da tarefa')).toHaveValue('Tarefa corrigível')
    expect(fetchMock.getTaskPostRequests()).toBe(1)
    fireEvent.click(screen.getByRole('button', { name: 'Planejamento semanal' }))
    expect(screen.getByRole('button', { name: 'Confirmar planejamento' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Demandas acadêmicas' }))
    fireEvent.change(screen.getByLabelText('Título da tarefa'), { target: { value: 'Tarefa corrigida' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar tarefa' }))
    expect(await screen.findByRole('heading', { name: 'Tarefa corrigida', level: 4 })).toBeInTheDocument()
    expect(fetchMock.getTaskPostRequests()).toBe(2)
  })


  it.each([
    { status: 404, message: 'A demanda não foi encontrada ou não está mais disponível.' },
    { status: 409, message: 'Reabra a demanda antes de adicionar novas tarefas.' },
  ])('preserva o contexto e invalida a prévia após HTTP $status ao criar tarefa', async ({ status, message }) => {
    setupFetch({ taskCreateResponse: { status, data: { detail: message } } })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: /Gerar pr/ }))
    expect(await screen.findByText('Revisar anatomia')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Demandas acadêmicas' }))
    await screen.findByText('Demanda gerenciada ativa')
    fireEvent.click(screen.getByRole('button', { name: 'Ver tarefas de Demanda gerenciada ativa' }))
    await screen.findByText('Nenhuma tarefa cadastrada para esta demanda.')
    fireEvent.click(screen.getByRole('button', { name: 'Nova tarefa' }))
    fireEvent.change(screen.getByLabelText('Título da tarefa'), { target: { value: 'Tarefa mantida' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar tarefa' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(screen.getByLabelText('Título da tarefa')).toHaveValue('Tarefa mantida')
    fireEvent.click(screen.getByRole('button', { name: 'Planejamento semanal' }))
    expect(screen.queryByRole('button', { name: 'Confirmar planejamento' })).not.toBeInTheDocument()
  })


  it('exige consulta explícita antes de decidir reenviar após resultado desconhecido', async () => {
    const fetchMock = setupFetch({ taskCreateNetworkFailures: 1 })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Demandas acadêmicas' }))
    await screen.findByText('Demanda gerenciada ativa')
    fireEvent.click(screen.getByRole('button', { name: 'Ver tarefas de Demanda gerenciada ativa' }))
    await screen.findByText('Nenhuma tarefa cadastrada para esta demanda.')
    fireEvent.click(screen.getByRole('button', { name: 'Nova tarefa' }))
    fireEvent.change(screen.getByLabelText('Título da tarefa'), { target: { value: 'Tarefa incerta' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar tarefa' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível confirmar se a tarefa foi criada')
    expect(screen.getByRole('button', { name: 'Salvar tarefa' })).toBeDisabled()
    expect(fetchMock.getTaskPostRequests()).toBe(1)
    fireEvent.click(screen.getByRole('button', { name: 'Consultar tarefas antes de tentar novamente' }))
    expect(await screen.findByText(/Consulta concluída\. Revise a lista/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salvar tarefa' })).toBeEnabled()
    expect(fetchMock.getTaskPostRequests()).toBe(1)
    expect(screen.getByText(/não garante que uma requisição anterior/)).toBeInTheDocument()
  })


  it('trata HTTP 500 como resultado desconhecido sem repetir automaticamente o POST', async () => {
    const fetchMock = setupFetch({ taskCreateResponse: { status: 500, data: { detail: 'Falha temporária.' } } })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: /Gerar pr/ }))
    expect(await screen.findByText('Revisar anatomia')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Demandas acadêmicas' }))
    await screen.findByText('Demanda gerenciada ativa')
    fireEvent.click(screen.getByRole('button', { name: 'Ver tarefas de Demanda gerenciada ativa' }))
    await screen.findByText('Nenhuma tarefa cadastrada para esta demanda.')
    fireEvent.click(screen.getByRole('button', { name: 'Nova tarefa' }))
    fireEvent.change(screen.getByLabelText('Título da tarefa'), { target: { value: 'Tarefa com resposta 500' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar tarefa' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível confirmar se a tarefa foi criada')
    expect(fetchMock.getTaskPostRequests()).toBe(1)
    fireEvent.click(screen.getByRole('button', { name: 'Planejamento semanal' }))
    expect(screen.queryByRole('button', { name: 'Confirmar planejamento' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Demandas acadêmicas' }))
    fireEvent.click(screen.getByRole('button', { name: 'Consultar tarefas antes de tentar novamente' }))
    expect(await screen.findByText(/Consulta concluída\. Revise a lista/)).toBeInTheDocument()
    expect(fetchMock.getTaskPostRequests()).toBe(1)
  })


  it('não confunde POST 201 com falha quando a consulta posterior falha', async () => {
    const fetchMock = setupFetch({
      taskResponseQueues: { 1: [null, { status: 503, data: { detail: 'Falha ao atualizar a lista.' } }] },
    })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Demandas acadêmicas' }))
    await screen.findByText('Demanda gerenciada ativa')
    fireEvent.click(screen.getByRole('button', { name: 'Ver tarefas de Demanda gerenciada ativa' }))
    await screen.findByText('Nenhuma tarefa cadastrada para esta demanda.')
    fireEvent.click(screen.getByRole('button', { name: 'Nova tarefa' }))
    fireEvent.change(screen.getByLabelText('Título da tarefa'), { target: { value: 'POST confirmado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar tarefa' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Tarefa criada, mas a lista não foi atualizada')
    expect(screen.queryByText('Não foi possível confirmar se a tarefa foi criada')).not.toBeInTheDocument()
    expect(fetchMock.getTaskPostRequests()).toBe(1)
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByRole('heading', { name: 'POST confirmado', level: 4 })).toBeInTheDocument()
    expect(fetchMock.getTaskPostRequests()).toBe(1)
  })


  it('aborta a consulta de tarefas ao recolher a demanda e suprime AbortError', async () => {
    const taskGate = new Promise(() => {})
    const fetchMock = setupFetch({
      taskGates: { 1: taskGate },
      taskAbortOnSignal: true,
    })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Demandas acadêmicas' }))
    await screen.findByText('Demanda gerenciada ativa')
    fireEvent.click(screen.getByRole('button', { name: 'Ver tarefas de Demanda gerenciada ativa' }))
    const taskRequest = fetchMock.mock.calls.find(([url]) => String(url) === '/api/demandas-academicas/1/tarefas')
    const signal = taskRequest[1].signal
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar tarefas de Demanda gerenciada ativa' }))
    expect(signal.aborted).toBe(true)
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Tarefas de Demanda gerenciada ativa' })).not.toBeInTheDocument())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })


  it('não deixa criar tarefas em demandas concluídas ou canceladas', async () => {
    setupFetch()
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Demandas acadêmicas' }))
    await screen.findByText('Demanda gerenciada ativa')
    fireEvent.click(screen.getByRole('button', { name: 'Ver tarefas de Trabalho concluído' }))
    await screen.findByText('Nenhuma tarefa cadastrada para esta demanda.')
    expect(screen.queryByRole('button', { name: 'Nova tarefa' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar tarefa' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ver tarefas de Tarefa cancelada' }))
    await screen.findByText('Nenhuma tarefa cadastrada para esta demanda.')
    expect(screen.queryByRole('button', { name: 'Nova tarefa' })).not.toBeInTheDocument()
  })

  it('abre e cancela a edição sem alterar a tarefa', async () => {
    const task = { id: 7, demandaAcademicaId: 1, titulo: 'Tarefa atual', descricao: 'Descrição atual', ordem: 1, esforcoEstimadoMinutos: 45, situacao: 1 }
    const fetchMock = setupFetch({ tasksByDemand: { 1: [task] } })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Demandas acadêmicas' }))
    await screen.findByText('Demanda gerenciada ativa')
    fireEvent.click(screen.getByRole('button', { name: 'Ver tarefas de Demanda gerenciada ativa' }))
    await screen.findByRole('heading', { name: 'Tarefa atual', level: 4 })
    fireEvent.click(screen.getByRole('button', { name: 'Editar tarefa' }))

    expect(screen.getByLabelText('Título da tarefa')).toHaveValue('Tarefa atual')
    expect(screen.getByLabelText('Descrição da tarefa')).toHaveValue('Descrição atual')
    expect(screen.getByLabelText('Posição da tarefa')).toHaveValue(2)
    expect(screen.getByLabelText('Esforço estimado da tarefa em minutos')).toHaveValue(45)
    expect(screen.getByLabelText('Situação da tarefa')).toHaveValue('1')

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar edição' }))
    expect(screen.getByRole('heading', { name: 'Tarefa atual', level: 4 })).toBeInTheDocument()
    expect(screen.queryByLabelText('Título da tarefa')).not.toBeInTheDocument()
    expect(fetchMock.getTaskPutRequests()).toBe(0)
  })

  it('envia o DTO completo ao PUT, converte posição e atualiza a lista e a prévia', async () => {
    const task = { id: 7, demandaAcademicaId: 1, titulo: 'Tarefa atual', descricao: null, ordem: 0, esforcoEstimadoMinutos: null, situacao: 0 }
    const fetchMock = setupFetch({ tasksByDemand: { 1: [
      task,
      { id: 8, demandaAcademicaId: 1, titulo: 'Outra tarefa', descricao: null, ordem: 1, esforcoEstimadoMinutos: null, situacao: 0 },
    ] } })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: /Gerar pr/ }))
    expect(await screen.findByText('Revisar anatomia')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Demandas acadêmicas' }))
    await screen.findByText('Demanda gerenciada ativa')
    fireEvent.click(screen.getByRole('button', { name: 'Ver tarefas de Demanda gerenciada ativa' }))
    await screen.findByRole('heading', { name: 'Tarefa atual', level: 4 })
    fireEvent.click(screen.getAllByRole('button', { name: 'Editar tarefa' })[0])
    fireEvent.change(screen.getByLabelText('Título da tarefa'), { target: { value: 'Tarefa atualizada' } })
    fireEvent.change(screen.getByLabelText('Descrição da tarefa'), { target: { value: 'Detalhes novos' } })
    fireEvent.change(screen.getByLabelText('Posição da tarefa'), { target: { value: '3' } })
    fireEvent.change(screen.getByLabelText('Esforço estimado da tarefa em minutos'), { target: { value: '90' } })
    fireEvent.change(screen.getByLabelText('Situação da tarefa'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar tarefa' }))

    expect(await screen.findByRole('heading', { name: 'Tarefa atualizada', level: 4 })).toBeInTheDocument()
    expect(screen.getByText('Etapa 2')).toBeInTheDocument()
    expect(screen.getByText('90 min')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Tarefas de Demanda gerenciada ativa' })).toHaveTextContent('Concluída')
    expect(within(screen.getByRole('region', { name: 'Tarefas de Demanda gerenciada ativa' })).getAllByRole('heading', { level: 4 }).map((heading) => heading.textContent)).toEqual(['Outra tarefa', 'Tarefa atualizada'])
    expect(fetchMock).toHaveBeenCalledWith('/api/demandas-academicas/1/tarefas/7', expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({
        titulo: 'Tarefa atualizada',
        descricao: 'Detalhes novos',
        ordem: 2,
        esforcoEstimadoMinutos: 90,
        situacao: 2,
      }),
    }))
    expect(fetchMock.getTaskPutRequests()).toBe(1)
    expect(fetchMock.getTaskRequests(1)).toBe(2)
    fireEvent.click(screen.getByRole('button', { name: 'Planejamento semanal' }))
    expect(screen.queryByRole('button', { name: 'Confirmar planejamento' })).not.toBeInTheDocument()
  })

  it('preserva os campos e a prévia quando o PUT é rejeitado com HTTP 400', async () => {
    const task = { id: 7, demandaAcademicaId: 1, titulo: 'Tarefa atual', descricao: null, ordem: 0, esforcoEstimadoMinutos: 30, situacao: 0 }
    const fetchMock = setupFetch({
      tasksByDemand: { 1: [task] },
      taskUpdateResponse: { status: 400, data: { detail: 'A situação informada não é válida.' } },
    })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: /Gerar pr/ }))
    expect(await screen.findByText('Revisar anatomia')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Demandas acadêmicas' }))
    await screen.findByText('Demanda gerenciada ativa')
    fireEvent.click(screen.getByRole('button', { name: 'Ver tarefas de Demanda gerenciada ativa' }))
    await screen.findByRole('heading', { name: 'Tarefa atual', level: 4 })
    fireEvent.click(screen.getByRole('button', { name: 'Editar tarefa' }))
    fireEvent.change(screen.getByLabelText('Título da tarefa'), { target: { value: 'Alteração mantida' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar tarefa' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('A situação informada não é válida.')
    expect(screen.getByLabelText('Título da tarefa')).toHaveValue('Alteração mantida')
    expect(fetchMock.getTaskPutRequests()).toBe(1)
    fireEvent.click(screen.getByRole('button', { name: 'Planejamento semanal' }))
    expect(screen.getByRole('button', { name: 'Confirmar planejamento' })).toBeEnabled()
  })

  it.each([
    { status: 404, message: 'A tarefa não foi encontrada.' },
    { status: 409, message: 'Reabra a demanda antes de reabrir uma tarefa.' },
  ])('preserva o formulário e invalida a prévia em HTTP $status no PUT', async ({ status, message }) => {
    const task = { id: 7, demandaAcademicaId: 1, titulo: 'Tarefa atual', descricao: null, ordem: 0, esforcoEstimadoMinutos: null, situacao: 0 }
    setupFetch({ tasksByDemand: { 1: [task] }, taskUpdateResponse: { status, data: { detail: message } } })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: /Gerar pr/ }))
    expect(await screen.findByText('Revisar anatomia')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Demandas acadêmicas' }))
    await screen.findByText('Demanda gerenciada ativa')
    fireEvent.click(screen.getByRole('button', { name: 'Ver tarefas de Demanda gerenciada ativa' }))
    await screen.findByRole('heading', { name: 'Tarefa atual', level: 4 })
    fireEvent.click(screen.getByRole('button', { name: 'Editar tarefa' }))
    fireEvent.change(screen.getByLabelText('Título da tarefa'), { target: { value: 'Valor preservado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar tarefa' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(screen.getByLabelText('Título da tarefa')).toHaveValue('Valor preservado')
    fireEvent.click(screen.getByRole('button', { name: 'Planejamento semanal' }))
    expect(screen.queryByRole('button', { name: 'Confirmar planejamento' })).not.toBeInTheDocument()
  })

  it('exige consulta explícita antes de repetir o PUT após falha de rede', async () => {
    const task = { id: 7, demandaAcademicaId: 1, titulo: 'Tarefa atual', descricao: null, ordem: 0, esforcoEstimadoMinutos: null, situacao: 0 }
    const fetchMock = setupFetch({ tasksByDemand: { 1: [task] }, taskUpdateNetworkFailures: 1 })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Demandas acadêmicas' }))
    await screen.findByText('Demanda gerenciada ativa')
    fireEvent.click(screen.getByRole('button', { name: 'Ver tarefas de Demanda gerenciada ativa' }))
    await screen.findByRole('heading', { name: 'Tarefa atual', level: 4 })
    fireEvent.click(screen.getByRole('button', { name: 'Editar tarefa' }))
    fireEvent.change(screen.getByLabelText('Título da tarefa'), { target: { value: 'Tentativa incerta' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar tarefa' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível confirmar se a tarefa foi atualizada')
    expect(screen.getByRole('button', { name: 'Salvar tarefa' })).toBeDisabled()
    expect(fetchMock.getTaskPutRequests()).toBe(1)
    fireEvent.click(screen.getByRole('button', { name: 'Consultar tarefas antes de tentar novamente' }))
    await waitFor(() => expect(fetchMock.getTaskRequests(1)).toBe(2))
    expect(screen.getByRole('button', { name: 'Salvar tarefa' })).toBeEnabled()
    expect(fetchMock.getTaskPutRequests()).toBe(1)
  })

  it('trata HTTP 500 como resultado incerto e não repete o PUT automaticamente', async () => {
    const task = { id: 7, demandaAcademicaId: 1, titulo: 'Tarefa atual', descricao: null, ordem: 0, esforcoEstimadoMinutos: null, situacao: 0 }
    const fetchMock = setupFetch({
      tasksByDemand: { 1: [task] },
      taskUpdateResponse: { status: 500, data: { detail: 'Falha temporária ao atualizar.' } },
    })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Demandas acadêmicas' }))
    await screen.findByText('Demanda gerenciada ativa')
    fireEvent.click(screen.getByRole('button', { name: 'Ver tarefas de Demanda gerenciada ativa' }))
    await screen.findByRole('heading', { name: 'Tarefa atual', level: 4 })
    fireEvent.click(screen.getByRole('button', { name: 'Editar tarefa' }))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar tarefa' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível confirmar se a tarefa foi atualizada')
    expect(screen.getByRole('button', { name: 'Salvar tarefa' })).toBeDisabled()
    expect(fetchMock.getTaskPutRequests()).toBe(1)
    fireEvent.click(screen.getByRole('button', { name: 'Consultar tarefas antes de tentar novamente' }))
    await waitFor(() => expect(fetchMock.getTaskRequests(1)).toBe(2))
    expect(fetchMock.getTaskPutRequests()).toBe(1)
  })

  it('bloqueia operações incompatíveis durante o PUT e libera o fluxo após sucesso', async () => {
    const task = { id: 7, demandaAcademicaId: 1, titulo: 'Tarefa atual', descricao: null, ordem: 0, esforcoEstimadoMinutos: null, situacao: 0 }
    let releaseUpdate
    const updateGate = new Promise((resolve) => { releaseUpdate = resolve })
    const fetchMock = setupFetch({ tasksByDemand: { 1: [task] }, taskUpdateGate: updateGate })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: /Gerar pr/ }))
    expect(await screen.findByText('Revisar anatomia')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Nova demanda' }))
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Cadastro bloqueado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Novo horário' }))
    const availabilityTimes = document.querySelectorAll('#create-availability-form input[type="time"]')
    fireEvent.change(availabilityTimes[0], { target: { value: '13:00' } })
    fireEvent.change(availabilityTimes[1], { target: { value: '14:00' } })

    fireEvent.click(screen.getByRole('button', { name: 'Demandas acadêmicas' }))
    await screen.findByText('Demanda gerenciada ativa')
    fireEvent.click(screen.getByRole('button', { name: 'Ver tarefas de Demanda gerenciada ativa' }))
    await screen.findByRole('heading', { name: 'Tarefa atual', level: 4 })
    fireEvent.click(screen.getByRole('button', { name: 'Editar tarefa' }))
    fireEvent.change(screen.getByLabelText('Título da tarefa'), { target: { value: 'Tarefa atualizada' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar tarefa' }))
    await waitFor(() => expect(fetchMock.getTaskPutRequests()).toBe(1))
    expect(screen.getByRole('button', { name: 'Salvando…' })).toBeDisabled()
    fireEvent.submit(screen.getByLabelText('Título da tarefa').closest('form'))
    expect(fetchMock.getTaskPutRequests()).toBe(1)

    const counts = {
      demands: fetchMock.getDemandListRequests(),
      allDemands: fetchMock.getAllDemandRequests(),
      availability: fetchMock.getAvailabilityRequests(),
      previews: fetchMock.getPreviewRequests(),
    }
    fireEvent.click(screen.getByRole('button', { name: 'Planejamento semanal' }))
    const refresh = screen.getByRole('button', { name: 'Atualizar dados' })
    const preview = screen.getByRole('button', { name: 'Gerar prévia' })
    refresh.disabled = false
    preview.disabled = false
    fireEvent.click(refresh)
    fireEvent.click(preview)
    fireEvent.submit(document.getElementById('create-demand-form'))
    fireEvent.submit(document.getElementById('create-availability-form'))

    expect(screen.getByRole('button', { name: 'Confirmar planejamento' })).toBeDisabled()
    const confirm = screen.getByRole('button', { name: 'Confirmar planejamento' })
    confirm.disabled = false
    fireEvent.click(confirm)
    expect(fetchMock.getDemandListRequests()).toBe(counts.demands)
    expect(fetchMock.getAllDemandRequests()).toBe(counts.allDemands)
    expect(fetchMock.getAvailabilityRequests()).toBe(counts.availability)
    expect(fetchMock.getPreviewRequests()).toBe(counts.previews)
    expect(fetchMock.getDemandPostRequests()).toBe(0)
    expect(fetchMock.getAvailabilityPostRequests()).toBe(0)
    expect(fetchMock.getConfirmationPostRequests()).toBe(0)

    releaseUpdate()
    fireEvent.click(screen.getByRole('button', { name: 'Demandas acadêmicas' }))
    expect(await screen.findByRole('heading', { name: 'Tarefa atualizada', level: 4 })).toBeInTheDocument()
    expect(fetchMock.getTaskPutRequests()).toBe(1)
    fireEvent.click(screen.getByRole('button', { name: 'Planejamento semanal' }))
    fireEvent.click(screen.getByRole('button', { name: 'Gerar prévia' }))
    expect(await screen.findByText('Revisar anatomia')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar planejamento' }))
    expect(await screen.findByText('Planejamento confirmado')).toBeInTheDocument()
    expect(fetchMock.getConfirmationPostRequests()).toBe(1)
  })


})
