import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderApp } from '../helpers/renderApp.jsx'
import { setupFetch, getCurrentMondayIso } from '../helpers/fetchMocks.js'

describe('Demandas acadêmicas — Edição', () => {
  it('atualiza a demanda com PUT completo, recarrega dados e invalida a prévia', async () => {
    const fetchMock = setupFetch()
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: /Gerar pr/ }))
    expect(await screen.findByText('Revisar anatomia')).toBeInTheDocument()
    const priorListCount = fetchMock.getDemandListRequests()
    fireEvent.click(screen.getByRole('button', { name: 'Demandas acadêmicas' }))
    const managementPanel = within(screen.getByRole('region', { name: 'Demandas acadêmicas' }))
    await managementPanel.findByText('Demanda gerenciada ativa')
    fireEvent.click(managementPanel.getAllByRole('button', { name: 'Editar demanda' })[0])

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Anatomia revisada' } })
    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Conteúdo atualizado' } })
    fireEvent.change(screen.getByLabelText('Tipo da demanda'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Importância da demanda'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Prazo da demanda'), { target: { value: '2026-11-15' } })
    fireEvent.change(screen.getByLabelText('Esforço da demanda'), { target: { value: '75' } })
    fireEvent.change(screen.getByLabelText('Situação da demanda'), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    expect(await managementPanel.findByText('Anatomia revisada')).toBeInTheDocument()
    expect(fetchMock.getDemandPutRequests()).toBe(1)
    expect(fetchMock).toHaveBeenCalledWith('/api/demandas-academicas/1', expect.objectContaining({
      method: 'PUT',
      headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ titulo: 'Anatomia revisada', descricao: 'Conteúdo atualizado', tipo: 1, prazo: '2026-11-15', importancia: 1, esforcoEstimadoMinutos: 75, situacao: 1 }),
    }))
    expect(fetchMock.getAllDemandRequests()).toBeGreaterThan(1)
    expect(fetchMock.getDemandListRequests()).toBeGreaterThan(priorListCount)
    fireEvent.click(screen.getByRole('button', { name: 'Planejamento semanal' }))
    expect(screen.queryByRole('button', { name: 'Confirmar planejamento' })).not.toBeInTheDocument()
  })

  it('bloqueia o planejamento durante PUT pendente e libera o fluxo ao concluir', async () => {
    let releaseUpdate
    const updateGate = new Promise((resolve) => {
      releaseUpdate = resolve
    })
    const fetchMock = setupFetch({ updateGate })
    renderApp()

    fireEvent.click(screen.getByRole('button', { name: 'Gerar prévia' }))
    expect(await screen.findByText('Revisar anatomia')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Nova demanda' }))
    fireEvent.change(within(document.getElementById('create-demand-form')).getByLabelText('Título'), { target: { value: 'Cadastro durante PUT' } })
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Importância'), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Novo horário' }))
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: getCurrentMondayIso() } })
    fireEvent.change(screen.getByLabelText('Horário inicial'), { target: { value: '10:00' } })
    fireEvent.change(screen.getByLabelText('Horário final'), { target: { value: '12:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Demandas acadêmicas' }))
    const managementPanel = within(screen.getByRole('region', { name: 'Demandas acadêmicas' }))
    await managementPanel.findByText('Demanda gerenciada ativa')
    fireEvent.click(managementPanel.getAllByRole('button', { name: 'Editar demanda' })[0])
    fireEvent.change(managementPanel.getByLabelText('Título'), { target: { value: 'Anatomia atualizada' } })
    fireEvent.click(managementPanel.getByRole('button', { name: 'Salvar alterações' }))

    expect(await screen.findByRole('button', { name: 'Salvando…' })).toBeDisabled()
    expect(fetchMock.getDemandPutRequests()).toBe(1)
    const demandRequestsBefore = fetchMock.getDemandListRequests()
    const allDemandRequestsBefore = fetchMock.getAllDemandRequests()
    const availabilityRequestsBefore = fetchMock.getAvailabilityRequests()
    const demandPostsBefore = fetchMock.getDemandPostRequests()
    const availabilityPostsBefore = fetchMock.getAvailabilityPostRequests()
    fireEvent.click(screen.getByRole('button', { name: 'Planejamento semanal' }))
    const previewButton = screen.getByRole('button', { name: 'Gerar prévia' })
    const confirmButton = screen.getByRole('button', { name: 'Confirmar planejamento' })
    const refreshButton = screen.getByRole('button', { name: 'Atualizar dados' })
    expect(previewButton).toBeDisabled()
    expect(confirmButton).toBeDisabled()
    expect(refreshButton).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Salvar demanda' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Salvar horário' })).toBeDisabled()

    refreshButton.disabled = false
    fireEvent.click(refreshButton)
    previewButton.disabled = false
    fireEvent.click(previewButton)
    confirmButton.disabled = false
    fireEvent.click(confirmButton)
    fireEvent.submit(document.getElementById('create-demand-form'))
    fireEvent.submit(document.getElementById('create-availability-form'))
    expect(fetchMock.getPreviewRequests()).toBe(1)
    expect(fetchMock.getConfirmationPostRequests()).toBe(0)
    expect(fetchMock.getDemandPutRequests()).toBe(1)
    expect(fetchMock.getDemandListRequests()).toBe(demandRequestsBefore)
    expect(fetchMock.getAllDemandRequests()).toBe(allDemandRequestsBefore)
    expect(fetchMock.getAvailabilityRequests()).toBe(availabilityRequestsBefore)
    expect(fetchMock.getDemandPostRequests()).toBe(demandPostsBefore)
    expect(fetchMock.getAvailabilityPostRequests()).toBe(availabilityPostsBefore)

    releaseUpdate()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Gerar prévia' })).toBeEnabled())
    expect(screen.getByRole('button', { name: 'Salvar demanda' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Salvar horário' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Confirmar planejamento' })).not.toBeInTheDocument()
    expect(fetchMock.getDemandPutRequests()).toBe(1)

    fireEvent.click(screen.getByRole('button', { name: 'Gerar prévia' }))
    expect(await screen.findByText('Revisar anatomia')).toBeInTheDocument()
    expect(fetchMock.getPreviewRequests()).toBe(2)
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar planejamento' }))
    expect(await screen.findByText('Planejamento confirmado')).toBeInTheDocument()
    expect(fetchMock.getConfirmationPostRequests()).toBe(1)
  })

  it('libera o bloqueio e mantém o formulário disponível após falha do PUT', async () => {
    const fetchMock = setupFetch({ updateFailures: 1 })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Demandas acadêmicas' }))
    const managementPanel = within(screen.getByRole('region', { name: 'Demandas acadêmicas' }))
    await managementPanel.findByText('Demanda gerenciada ativa')
    fireEvent.click(managementPanel.getAllByRole('button', { name: 'Editar demanda' })[0])
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Título mantido após erro' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível confirmar se a demanda foi atualizada. Consulte a lista antes de decidir se tentará novamente.')
    expect(screen.getByLabelText('Título')).toHaveValue('Título mantido após erro')
    expect(screen.getByRole('button', { name: 'Consultar demandas antes de tentar novamente' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salvar alterações' })).toBeDisabled()
    expect(fetchMock.getDemandPutRequests()).toBe(1)

    fireEvent.click(screen.getByRole('button', { name: 'Consultar demandas antes de tentar novamente' }))
    await managementPanel.findByText('Demanda gerenciada ativa')
    expect(fetchMock.getDemandPutRequests()).toBe(1)
  })

  it('preserva os campos e a regra de tarefas pendentes quando a API rejeita conclusão com HTTP 400', async () => {
    setupFetch({ updateResponse: { status: 400, data: { detail: 'Conclua ou resolva todas as tarefas antes de concluir a demanda.' } } })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Demandas acadêmicas' }))
    await screen.findByText('Demanda gerenciada ativa')
    fireEvent.click(screen.getAllByRole('button', { name: 'Editar demanda' })[0])
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Demanda ainda com tarefas' } })
    fireEvent.change(screen.getByLabelText('Situação da demanda'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Conclua ou resolva todas as tarefas antes de concluir a demanda.')
    expect(screen.getByLabelText('Título')).toHaveValue('Demanda ainda com tarefas')
    expect(screen.getByLabelText('Situação da demanda')).toHaveValue('2')
  })

  it('mantém a edição recuperável quando a demanda atualizada retorna HTTP 404', async () => {
    setupFetch({ updateResponse: { status: 404, data: { detail: 'Demanda não encontrada.' } } })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Demandas acadêmicas' }))
    await screen.findByText('Demanda gerenciada ativa')
    fireEvent.click(screen.getAllByRole('button', { name: 'Editar demanda' })[0])
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Título preservado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Demanda não encontrada.')
    expect(screen.getByLabelText('Título')).toHaveValue('Título preservado')
  })

  it('edição: reconciliação usa GET direto e não incrementa token de recarga', async () => {
    const fetchMock = setupFetch()
    renderApp()

    fireEvent.click(screen.getByRole('button', { name: 'Gerar prévia' }))
    expect(await screen.findByText('Revisar anatomia')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Demandas acadêmicas' }))
    const managementPanel = within(screen.getByRole('region', { name: 'Demandas acadêmicas' }))
    await managementPanel.findByText('Demanda gerenciada ativa')

    const allDemandRequestsBefore = fetchMock.getAllDemandRequests()
    fireEvent.click(managementPanel.getAllByRole('button', { name: 'Editar demanda' })[0])
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Anatomia atualizada' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    await waitFor(() => expect(fetchMock.getAllDemandRequests()).toBe(allDemandRequestsBefore + 1))

    expect(fetchMock.getAllDemandRequests()).toBe(allDemandRequestsBefore + 1)
  })

  it('exibe erro da API e preserva os valores preenchidos na edição', async () => {
    const fetchMock = setupFetch({
      updateResponse: { status: 400, data: { detail: 'Falha temporária ao atualizar a demanda.' } },
    })
    renderApp()

    fireEvent.click(screen.getByRole('button', { name: 'Demandas acadêmicas' }))
    const managementPanel = within(screen.getByRole('region', { name: 'Demandas acadêmicas' }))
    await managementPanel.findByText('Demanda gerenciada ativa')
    fireEvent.click(managementPanel.getAllByRole('button', { name: 'Editar demanda' })[0])
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Título erro API' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Falha temporária ao atualizar a demanda.')
    expect(screen.getByLabelText('Título')).toHaveValue('Título erro API')
    expect(fetchMock.getDemandPutRequests()).toBe(1)
  })
})