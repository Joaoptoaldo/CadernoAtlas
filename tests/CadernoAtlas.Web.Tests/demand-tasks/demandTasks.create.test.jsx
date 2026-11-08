import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderApp } from '../helpers/renderApp.jsx'
import { setupFetch } from '../helpers/fetchMocks.js'

describe('Tarefas de demandas — Criação', () => {
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

  it.each([
    [408, 'Não foi possível confirmar se a tarefa foi criada. Consulte a lista antes de decidir se tentará novamente.'],
    [429, 'Não foi possível confirmar se a tarefa foi criada. Consulte a lista antes de decidir se tentará novamente.'],
  ])('trata HTTP %i na criação de tarefa como resultado incerto', async (status, message) => {
    const fetchMock = setupFetch({ taskCreateResponse: { status, data: { detail: 'Falha temporária.' } } })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: /Gerar pr/ }))
    expect(await screen.findByText('Revisar anatomia')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Demandas acadêmicas' }))
    await screen.findByText('Demanda gerenciada ativa')
    fireEvent.click(screen.getByRole('button', { name: 'Ver tarefas de Demanda gerenciada ativa' }))
    await screen.findByText('Nenhuma tarefa cadastrada para esta demanda.')
    fireEvent.click(screen.getByRole('button', { name: 'Nova tarefa' }))
    fireEvent.change(screen.getByLabelText('Título da tarefa'), { target: { value: `Tarefa com resposta ${status}` } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar tarefa' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(screen.getByRole('button', { name: 'Salvar tarefa' })).toBeDisabled()
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
})