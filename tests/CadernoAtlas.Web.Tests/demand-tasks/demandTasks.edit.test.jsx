import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderApp } from '../helpers/renderApp.jsx'
import { setupFetch } from '../helpers/fetchMocks.js'

describe('Tarefas de demandas — Edição e Exclusão', () => {
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
    expect(screen.getByLabelText('Posição da tarefa')).toHaveValue(1)
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
    expect(screen.queryByRole('button', { name: 'Salvar tarefa' })).not.toBeInTheDocument()
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

  it.each([
    [408, 'Não foi possível confirmar se a tarefa foi atualizada. Consulte a lista antes de decidir se tentará novamente.'],
    [429, 'Não foi possível confirmar se a tarefa foi atualizada. Consulte a lista antes de decidir se tentará novamente.'],
  ])('trata HTTP %i na edição de tarefa como resultado incerto', async (status, message) => {
    const task = { id: 7, demandaAcademicaId: 1, titulo: 'Tarefa atual', descricao: null, ordem: 0, esforcoEstimadoMinutos: null, situacao: 0 }
    const fetchMock = setupFetch({
      tasksByDemand: { 1: [task] },
      taskUpdateResponse: { status, data: { detail: 'Falha temporária ao atualizar.' } },
    })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Demandas acadêmicas' }))
    await screen.findByText('Demanda gerenciada ativa')
    fireEvent.click(screen.getByRole('button', { name: 'Ver tarefas de Demanda gerenciada ativa' }))
    await screen.findByRole('heading', { name: 'Tarefa atual', level: 4 })
    fireEvent.click(screen.getByRole('button', { name: 'Editar tarefa' }))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar tarefa' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(screen.getByRole('button', { name: 'Salvar tarefa' })).toBeDisabled()
    expect(fetchMock.getTaskPutRequests()).toBe(1)
    fireEvent.click(screen.getByRole('button', { name: 'Consultar tarefas antes de tentar novamente' }))
    await waitFor(() => expect(fetchMock.getTaskRequests(1)).toBe(2))
    expect(fetchMock.getTaskPutRequests()).toBe(1)
  })

  it('bloqueia operações de tarefa enquanto o PUT está em andamento e libera o fluxo após sucesso', async () => {
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

  it('confirma a exclusão e atualiza a lista de tarefas após sucesso', async () => {
    const tasks = [
      { id: 31, demandaAcademicaId: 1, titulo: 'Tarefa a excluir', descricao: null, ordem: 0, esforcoEstimadoMinutos: null, situacao: 0 },
      { id: 32, demandaAcademicaId: 1, titulo: 'Tarefa preservada', descricao: null, ordem: 1, esforcoEstimadoMinutos: null, situacao: 0 },
    ]
    const fetchMock = setupFetch({ tasksByDemand: { 1: tasks } })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Demandas acadêmicas' }))
    await screen.findByText('Demanda gerenciada ativa')
    fireEvent.click(screen.getByRole('button', { name: 'Ver tarefas de Demanda gerenciada ativa' }))
    const taskRegion = await screen.findByRole('region', { name: 'Tarefas de Demanda gerenciada ativa' })
    await within(taskRegion).findByRole('heading', { name: 'Tarefa a excluir', level: 4 })

    // Clica no botão "Excluir tarefa" - abre o modal
    fireEvent.click(within(taskRegion).getByRole('button', { name: 'Excluir tarefa Tarefa a excluir' }))

    // Confirma no modal
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))

    await waitFor(() => expect(fetchMock.getTaskDeleteRequests()).toBe(1))
    expect(await within(taskRegion).findByRole('heading', { name: 'Tarefa preservada', level: 4 })).toBeInTheDocument()
    await waitFor(() => expect(within(taskRegion).queryByRole('heading', { name: 'Tarefa a excluir', level: 4 })).not.toBeInTheDocument())
    expect(fetchMock.getTaskRequests(1)).toBe(2)
  })

  it('não envia DELETE quando a confirmação de exclusão é cancelada', async () => {
    const task = { id: 33, demandaAcademicaId: 1, titulo: 'Tarefa não removida', descricao: null, ordem: 0, esforcoEstimadoMinutos: null, situacao: 0 }
    const fetchMock = setupFetch({ tasksByDemand: { 1: [task] } })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Demandas acadêmicas' }))
    await screen.findByText('Demanda gerenciada ativa')
    fireEvent.click(screen.getByRole('button', { name: 'Ver tarefas de Demanda gerenciada ativa' }))
    const taskRegion = await screen.findByRole('region', { name: 'Tarefas de Demanda gerenciada ativa' })
    await within(taskRegion).findByRole('heading', { name: 'Tarefa não removida', level: 4 })

    // Clica no botão "Excluir tarefa" - abre o modal
    fireEvent.click(within(taskRegion).getByRole('button', { name: 'Excluir tarefa Tarefa não removida' }))

    // Cancela no modal
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(fetchMock.getTaskDeleteRequests()).toBe(0)
    expect(within(taskRegion).getByRole('heading', { name: 'Tarefa não removida', level: 4 })).toBeInTheDocument()
  })

  it.each([
    ['falha de rede', { taskDeleteNetworkFailures: 1 }],
    ['erro HTTP 503', { taskDeleteResponse: { status: 503, data: { detail: 'Falha temporária ao excluir.' } } }],
  ])('exige consultar as tarefas antes de repetir o DELETE após %s', async (_description, deleteOptions) => {
    const task = { id: 34, demandaAcademicaId: 1, titulo: 'Tarefa com resultado incerto', descricao: null, ordem: 0, esforcoEstimadoMinutos: null, situacao: 0 }
    const fetchMock = setupFetch({ tasksByDemand: { 1: [task] }, ...deleteOptions })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Demandas acadêmicas' }))
    await screen.findByText('Demanda gerenciada ativa')
    fireEvent.click(screen.getByRole('button', { name: 'Ver tarefas de Demanda gerenciada ativa' }))
    const taskRegion = await screen.findByRole('region', { name: 'Tarefas de Demanda gerenciada ativa' })
    await within(taskRegion).findByRole('heading', { name: 'Tarefa com resultado incerto', level: 4 })

    // Clica no botão "Excluir tarefa" - abre o modal
    fireEvent.click(within(taskRegion).getByRole('button', { name: 'Excluir tarefa Tarefa com resultado incerto' }))

    // Confirma no modal
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível confirmar se a tarefa foi excluída')
    expect(fetchMock.getTaskDeleteRequests()).toBe(1)
    fireEvent.click(screen.getByRole('button', { name: 'Consultar tarefas antes de tentar novamente' }))
    await waitFor(() => expect(fetchMock.getTaskRequests(1)).toBe(2))
    expect(fetchMock.getTaskDeleteRequests()).toBe(1)
    expect(within(taskRegion).getByRole('heading', { name: 'Tarefa com resultado incerto', level: 4 })).toBeInTheDocument()
    expect(within(taskRegion).getByRole('button', { name: 'Excluir tarefa Tarefa com resultado incerto' })).toBeEnabled()
  })

  it('bloqueia operações de tarefa enquanto o DELETE está em andamento', async () => {
    let releaseDelete
    const deleteGate = new Promise((resolve) => { releaseDelete = resolve })
    const task = { id: 35, demandaAcademicaId: 1, titulo: 'Tarefa em exclusão', descricao: null, ordem: 0, esforcoEstimadoMinutos: null, situacao: 0 }
    const fetchMock = setupFetch({ tasksByDemand: { 1: [task] }, taskDeleteGate: deleteGate })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Demandas acadêmicas' }))
    await screen.findByText('Demanda gerenciada ativa')
    fireEvent.click(screen.getByRole('button', { name: 'Ver tarefas de Demanda gerenciada ativa' }))
    const taskRegion = await screen.findByRole('region', { name: 'Tarefas de Demanda gerenciada ativa' })
    await within(taskRegion).findByRole('heading', { name: 'Tarefa em exclusão', level: 4 })

    // Clica no botão "Excluir tarefa" - abre o modal
    fireEvent.click(within(taskRegion).getByRole('button', { name: 'Excluir tarefa Tarefa em exclusão' }))

    // Confirma no modal
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))

    await waitFor(() => expect(fetchMock.getTaskDeleteRequests()).toBe(1))

    expect(within(taskRegion).getByRole('button', { name: 'Excluir tarefa Tarefa em exclusão' })).toBeDisabled()
    expect(within(taskRegion).getByRole('button', { name: 'Nova tarefa' })).toBeDisabled()

    releaseDelete()
    await waitFor(() => expect(within(taskRegion).queryByRole('heading', { name: 'Tarefa em exclusão', level: 4 })).not.toBeInTheDocument())
    expect(fetchMock.getTaskDeleteRequests()).toBe(1)
  })

  it('diferencia exclusão confirmada de falha ao atualizar a lista', async () => {
    const tasks = [
      { id: 36, demandaAcademicaId: 1, titulo: 'Tarefa a excluir', descricao: null, ordem: 0, esforcoEstimadoMinutos: null, situacao: 0 },
      { id: 37, demandaAcademicaId: 1, titulo: 'Tarefa preservada', descricao: null, ordem: 1, esforcoEstimadoMinutos: null, situacao: 0 },
    ]
    const fetchMock = setupFetch({
      tasksByDemand: { 1: tasks },
      taskResponseQueues: { 1: [null, { status: 503, data: { detail: 'Falha ao atualizar a lista.' } }] },
    })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Demandas acadêmicas' }))
    await screen.findByText('Demanda gerenciada ativa')
    fireEvent.click(screen.getByRole('button', { name: 'Ver tarefas de Demanda gerenciada ativa' }))
    const taskRegion = await screen.findByRole('region', { name: 'Tarefas de Demanda gerenciada ativa' })
    await within(taskRegion).findByRole('heading', { name: 'Tarefa a excluir', level: 4 })

    // Clica no botão "Excluir tarefa" - abre o modal
    fireEvent.click(within(taskRegion).getByRole('button', { name: 'Excluir tarefa Tarefa a excluir' }))

    // Confirma no modal
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))

    await waitFor(() => expect(fetchMock.getTaskDeleteRequests()).toBe(1))
    expect(await screen.findByRole('alert')).toHaveTextContent('Tarefa excluída, mas a lista não foi atualizada')
    expect(await screen.findByRole('alert')).toHaveTextContent('Falha ao atualizar a lista')
    expect(within(taskRegion).getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument()
    expect(fetchMock.getTaskDeleteRequests()).toBe(1)
  })

  it.each([
    ['HTTP 404', { taskDeleteResponse: { status: 404, data: { detail: 'Tarefa não encontrada.' } } }],
    ['HTTP 409', { taskDeleteResponse: { status: 409, data: { detail: 'Reabra a demanda antes de excluir a tarefa.' } } }],
  ])('não repete DELETE automaticamente após %s e exige reconciliação', async (_description, deleteOptions) => {
    const task = { id: 38, demandaAcademicaId: 1, titulo: 'Tarefa com erro definitivo', descricao: null, ordem: 0, esforcoEstimadoMinutos: null, situacao: 0 }
    const fetchMock = setupFetch({ tasksByDemand: { 1: [task] }, ...deleteOptions })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Demandas acadêmicas' }))
    await screen.findByText('Demanda gerenciada ativa')
    fireEvent.click(screen.getByRole('button', { name: 'Ver tarefas de Demanda gerenciada ativa' }))
    const taskRegion = await screen.findByRole('region', { name: 'Tarefas de Demanda gerenciada ativa' })
    await within(taskRegion).findByRole('heading', { name: 'Tarefa com erro definitivo', level: 4 })

    // Clica no botão "Excluir tarefa" - abre o modal
    fireEvent.click(within(taskRegion).getByRole('button', { name: 'Excluir tarefa Tarefa com erro definitivo' }))

    // Confirma no modal
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(deleteOptions.taskDeleteResponse.data.detail)
    expect(fetchMock.getTaskDeleteRequests()).toBe(1)
    expect(within(taskRegion).getByRole('button', { name: 'Atualizar lista de tarefas' })).toBeInTheDocument()
    expect(within(taskRegion).getByRole('button', { name: 'Excluir tarefa Tarefa com erro definitivo' })).toBeDisabled()
  })
})