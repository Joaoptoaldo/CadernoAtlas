import { describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderApp } from './helpers/renderApp.jsx'
import { setupFetch, getCurrentMondayIso } from './helpers/fetchMocks.js'

describe('Demandas acadêmicas', () => {
  it('lista demandas ativas, concluídas e canceladas na gestão completa', async () => {
    setupFetch()
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Demandas acadêmicas' }))

    expect(await screen.findByRole('heading', { name: 'Demandas acadêmicas', level: 2 })).toBeInTheDocument()
    expect(await screen.findByText('Demanda gerenciada ativa')).toBeInTheDocument()
    expect(screen.getByText('Trabalho concluído')).toBeInTheDocument()
    expect(screen.getByText('Tarefa cancelada')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Excluir/ })).not.toBeInTheDocument()
  })


  it('filtra a lista completa por situação, tipo, importância e prazo máximo', async () => {
    setupFetch()
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Demandas acadêmicas' }))
    await screen.findByText('Demanda gerenciada ativa')

    fireEvent.change(screen.getByLabelText('Filtrar por situação'), { target: { value: '3' } })
    expect(screen.getByText('Tarefa cancelada')).toBeInTheDocument()
    expect(screen.queryByText('Demanda gerenciada ativa')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Filtrar por tipo'), { target: { value: '4' } })
    fireEvent.change(screen.getByLabelText('Filtrar por importância'), { target: { value: '0' } })
    fireEvent.change(screen.getByLabelText('Filtrar por prazo máximo'), { target: { value: '2026-12-01' } })
    expect(screen.getByText('Tarefa cancelada')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Filtrar por prazo máximo'), { target: { value: '2026-11-30' } })
    expect(screen.queryByText('Tarefa cancelada')).not.toBeInTheDocument()
    expect(screen.getByText('Nenhuma demanda encontrada')).toBeInTheDocument()
  })


  it('filtra demandas por tipo independentemente dos outros filtros', async () => {
    setupFetch()
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Demandas acadêmicas' }))
    await screen.findByText('Demanda gerenciada ativa')

    fireEvent.change(screen.getByLabelText('Filtrar por tipo'), { target: { value: '1' } })

    expect(screen.getByText('Trabalho concluído')).toBeInTheDocument()
    expect(screen.queryByText('Demanda gerenciada ativa')).not.toBeInTheDocument()
    expect(screen.queryByText('Tarefa cancelada')).not.toBeInTheDocument()
  })


  it('filtra demandas por importância independentemente dos outros filtros', async () => {
    setupFetch()
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Demandas acadêmicas' }))
    await screen.findByText('Demanda gerenciada ativa')

    fireEvent.change(screen.getByLabelText('Filtrar por importância'), { target: { value: '0' } })

    expect(screen.getByText('Tarefa cancelada')).toBeInTheDocument()
    expect(screen.queryByText('Demanda gerenciada ativa')).not.toBeInTheDocument()
    expect(screen.queryByText('Trabalho concluído')).not.toBeInTheDocument()
  })


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

    // Contorna o estado visual para confirmar que os handlers também bloqueiam chamadas.
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
    // Botão de reconciliação deve estar presente
    expect(screen.getByRole('button', { name: 'Consultar demandas antes de tentar novamente' })).toBeInTheDocument()
    // Botão de salvar deve estar desabilitado até reconciliação
    expect(screen.getByRole('button', { name: 'Salvar alterações' })).toBeDisabled()
    expect(fetchMock.getDemandPutRequests()).toBe(1)

    // Após reconciliação bem-sucedida, o formulário deve fechar
    fireEvent.click(screen.getByRole('button', { name: 'Consultar demandas antes de tentar novamente' }))
    await managementPanel.findByText('Demanda gerenciada ativa')
    expect(fetchMock.getDemandPutRequests()).toBe(1)
  })


  it('mostra lista vazia e permite recuperar falha de rede ao carregar demandas', async () => {
    const fetchMock = setupFetch({ allDemands: [], allDemandFailures: 1 })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Demandas acadêmicas' }))
    expect(await screen.findByText('Falha temporária na lista completa.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByText('Nenhuma demanda encontrada')).toBeInTheDocument()
    expect(fetchMock.getAllDemandRequests()).toBe(2)
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


    it('impede atualizar os dados durante o cadastro de demanda', async () => {
    let releaseCreate
    const createGate = new Promise((resolve) => {
      releaseCreate = resolve
    })

    const fetchMock = setupFetch({ createGate })
    renderApp()

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
    renderApp()

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
  
})