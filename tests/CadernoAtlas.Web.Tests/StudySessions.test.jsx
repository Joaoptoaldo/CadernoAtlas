import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderApp } from './helpers/renderApp.jsx'
import { setupFetch, studySessionFixture } from './helpers/fetchMocks.js'

describe('Sessões de estudo', () => {
  it('distingue sessão criada de falha ao atualizar a lista e não repete o POST', async () => {
    const fetchMock = setupFetch({ studySessionReconcileFailures: 1 })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText(studySessionFixture.titulo)

    fireEvent.click(screen.getByRole('button', { name: 'Nova sessão de estudo' }))
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Sessão confirmada' } })
    fireEvent.change(screen.getByLabelText('Data planejada'), { target: { value: '2026-11-15' } })
    fireEvent.change(screen.getByLabelText('Horário de início'), { target: { value: '16:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar sessão' }))

    expect((await screen.findAllByText(/A sessão foi criada, mas a lista não pôde ser atualizada/)).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Atualizar lista de sessões' })).toBeInTheDocument()
    expect(fetchMock.getStudySessionPostRequests()).toBe(1)

    fireEvent.click(screen.getByRole('button', { name: 'Atualizar lista de sessões' }))
    expect(await screen.findByText('Sessão confirmada')).toBeInTheDocument()
    expect(fetchMock.getStudySessionPostRequests()).toBe(1)
  })
  it('carrega e lista as sessões de estudo com as 4 situações numéricas (0, 1, 2, 3) e exibe os respectivos rótulos', async () => {
    setupFetch({
      studySessions: [
        {
          id: 1,
          titulo: 'Sessão Planejada',
          dataPlanejada: '2026-11-10',
          horaInicioPlanejada: '14:00:00',
          duracaoPlanejadaMinutos: 90,
          duracaoRealMinutos: null,
          situacao: 0, // Planejada
          demandaAcademicaId: 1,
          tarefaDemandaId: null,
        },
        {
          id: 2,
          titulo: 'Sessão Em Andamento',
          dataPlanejada: '2026-11-11',
          horaInicioPlanejada: '10:00:00',
          duracaoPlanejadaMinutos: 60,
          duracaoRealMinutos: null,
          situacao: 1, // Em andamento
          demandaAcademicaId: null,
          tarefaDemandaId: null,
        },
        {
          id: 3,
          titulo: 'Sessão Concluída',
          dataPlanejada: '2026-11-12',
          horaInicioPlanejada: '10:00:00',
          duracaoPlanejadaMinutos: 60,
          duracaoRealMinutos: 55,
          situacao: 2, // Concluída
          demandaAcademicaId: null,
          tarefaDemandaId: 3,
        },
        {
          id: 4,
          titulo: 'Sessão Cancelada',
          dataPlanejada: '2026-11-13',
          horaInicioPlanejada: '16:00:00',
          duracaoPlanejadaMinutos: 45,
          duracaoRealMinutos: null,
          situacao: 3, // Cancelada
          demandaAcademicaId: null,
          tarefaDemandaId: null,
        },
      ],
    })
    renderApp()

    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))

    expect(await screen.findByRole('heading', { name: 'Sessões de estudo', level: 2 })).toBeInTheDocument()
    expect(await screen.findByText('Sessão Planejada')).toBeInTheDocument()
    expect(screen.getByText('Sessão Em Andamento')).toBeInTheDocument()
    expect(screen.getByText('Sessão Concluída')).toBeInTheDocument()
    expect(screen.getByText('Sessão Cancelada')).toBeInTheDocument()

    const statusPlanejada = screen.getByText('Planejada', { selector: '.study-session-status' })
    expect(statusPlanejada).toHaveClass('study-session-status-planejada')

    const statusEmAndamento = screen.getByText('Em andamento', { selector: '.study-session-status' })
    expect(statusEmAndamento).toHaveClass('study-session-status-emandamento')

    const statusConcluida = screen.getByText('Concluída', { selector: '.study-session-status' })
    expect(statusConcluida).toHaveClass('study-session-status-concluida')

    const statusCancelada = screen.getByText('Cancelada', { selector: '.study-session-status' })
    expect(statusCancelada).toHaveClass('study-session-status-cancelada')

    expect(screen.getByText('Demanda acadêmica #1')).toBeInTheDocument()
    expect(screen.getByText('Tarefa #3')).toBeInTheDocument()
  })

  it('exibe estado vazio quando não há sessões de estudo', async () => {
    setupFetch({
      studySessions: [],
    })
    renderApp()

    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))

    expect(await screen.findByRole('heading', { name: 'Sessões de estudo', level: 2 })).toBeInTheDocument()
    expect(await screen.findByText('Nenhuma sessão de estudo encontrada')).toBeInTheDocument()
    expect(screen.getByText('As sessões de estudo aparecerão aqui quando forem cadastradas.')).toBeInTheDocument()
  })

  it('filtra as sessões funcionando para todas as quatro situações (0, 1, 2 e 3)', async () => {
    setupFetch({
      studySessions: [
        {
          id: 1,
          titulo: 'Sessão 1 Planejada',
          dataPlanejada: '2026-11-10',
          horaInicioPlanejada: '09:00:00',
          duracaoPlanejadaMinutos: 60,
          duracaoRealMinutos: null,
          situacao: 0,
          demandaAcademicaId: null,
          tarefaDemandaId: null,
        },
        {
          id: 2,
          titulo: 'Sessão 2 Em Andamento',
          dataPlanejada: '2026-11-12',
          horaInicioPlanejada: '11:00:00',
          duracaoPlanejadaMinutos: 60,
          duracaoRealMinutos: null,
          situacao: 1,
          demandaAcademicaId: null,
          tarefaDemandaId: null,
        },
        {
          id: 3,
          titulo: 'Sessão 3 Concluída',
          dataPlanejada: '2026-11-15',
          horaInicioPlanejada: '14:00:00',
          duracaoPlanejadaMinutos: 90,
          duracaoRealMinutos: 80,
          situacao: 2,
          demandaAcademicaId: null,
          tarefaDemandaId: null,
        },
        {
          id: 4,
          titulo: 'Sessão 4 Cancelada',
          dataPlanejada: '2026-11-20',
          horaInicioPlanejada: '16:00:00',
          duracaoPlanejadaMinutos: 45,
          duracaoRealMinutos: null,
          situacao: 3,
          demandaAcademicaId: null,
          tarefaDemandaId: null,
        },
      ],
    })
    renderApp()

    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    expect(await screen.findByText('Sessão 1 Planejada')).toBeInTheDocument()

    const situacaoSelect = screen.getByLabelText('Filtrar sessões por situação')

    // 1. Filtrar por Planejada (0)
    fireEvent.change(situacaoSelect, { target: { value: 'Planejada' } })
    expect(screen.getByText('Sessão 1 Planejada')).toBeInTheDocument()
    expect(screen.queryByText('Sessão 2 Em Andamento')).not.toBeInTheDocument()
    expect(screen.queryByText('Sessão 3 Concluída')).not.toBeInTheDocument()
    expect(screen.queryByText('Sessão 4 Cancelada')).not.toBeInTheDocument()

    // 2. Filtrar por EmAndamento (1)
    fireEvent.change(situacaoSelect, { target: { value: 'EmAndamento' } })
    expect(screen.queryByText('Sessão 1 Planejada')).not.toBeInTheDocument()
    expect(screen.getByText('Sessão 2 Em Andamento')).toBeInTheDocument()
    expect(screen.queryByText('Sessão 3 Concluída')).not.toBeInTheDocument()
    expect(screen.queryByText('Sessão 4 Cancelada')).not.toBeInTheDocument()

    // 3. Filtrar por Concluida (2)
    fireEvent.change(situacaoSelect, { target: { value: 'Concluida' } })
    expect(screen.queryByText('Sessão 1 Planejada')).not.toBeInTheDocument()
    expect(screen.queryByText('Sessão 2 Em Andamento')).not.toBeInTheDocument()
    expect(screen.getByText('Sessão 3 Concluída')).toBeInTheDocument()
    expect(screen.queryByText('Sessão 4 Cancelada')).not.toBeInTheDocument()

    // 4. Filtrar por Cancelada (3)
    fireEvent.change(situacaoSelect, { target: { value: 'Cancelada' } })
    expect(screen.queryByText('Sessão 1 Planejada')).not.toBeInTheDocument()
    expect(screen.queryByText('Sessão 2 Em Andamento')).not.toBeInTheDocument()
    expect(screen.queryByText('Sessão 3 Concluída')).not.toBeInTheDocument()
    expect(screen.getByText('Sessão 4 Cancelada')).toBeInTheDocument()

    // Limpar filtros
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }))
    expect(screen.getByText('Sessão 1 Planejada')).toBeInTheDocument()
    expect(screen.getByText('Sessão 2 Em Andamento')).toBeInTheDocument()
    expect(screen.getByText('Sessão 3 Concluída')).toBeInTheDocument()
    expect(screen.getByText('Sessão 4 Cancelada')).toBeInTheDocument()

    // Filtrar por intervalo de datas
    const dataDeInput = screen.getByLabelText('Filtrar por data inicial')
    fireEvent.change(dataDeInput, { target: { value: '2026-11-12' } })
    expect(screen.queryByText('Sessão 1 Planejada')).not.toBeInTheDocument()
    expect(screen.getByText('Sessão 2 Em Andamento')).toBeInTheDocument()
    expect(screen.getByText('Sessão 3 Concluída')).toBeInTheDocument()
    expect(screen.getByText('Sessão 4 Cancelada')).toBeInTheDocument()

    const dataAteInput = screen.getByLabelText('Filtrar por data final')
    fireEvent.change(dataAteInput, { target: { value: '2026-11-16' } })
    expect(screen.queryByText('Sessão 1 Planejada')).not.toBeInTheDocument()
    expect(screen.getByText('Sessão 2 Em Andamento')).toBeInTheDocument()
    expect(screen.getByText('Sessão 3 Concluída')).toBeInTheDocument()
    expect(screen.queryByText('Sessão 4 Cancelada')).not.toBeInTheDocument()
  })

  it('exibe mensagem de erro e permite tentar novamente quando a consulta falha', async () => {
    setupFetch({
      studySessionFailures: 1,
      studySessions: [studySessionFixture],
    })
    renderApp()

    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))

    expect(await screen.findByText('Não foi possível carregar as sessões de estudo')).toBeInTheDocument()
    const retryButton = screen.getByRole('button', { name: 'Tentar novamente' })
    expect(retryButton).toBeInTheDocument()

    fireEvent.click(retryButton)
    expect(await screen.findByText('Revisão de Biologia Celular')).toBeInTheDocument()
  })

  it('consulta os detalhes de uma sessão individual exibindo corretamente a situação', async () => {
    const sessionInProgess = {
      id: 2,
      titulo: 'Estudo Ativo de Fisiologia',
      dataPlanejada: '2026-11-10',
      horaInicioPlanejada: '15:30:00',
      duracaoPlanejadaMinutos: 120,
      duracaoRealMinutos: 60,
      situacao: 1, // Em andamento
      demandaAcademicaId: 2,
      tarefaDemandaId: null,
      observacoes: 'Foco no sistema cardiovascular',
      criadoEm: '2026-11-01T10:00:00Z',
      inicioRealEm: '2026-11-10T15:30:00Z',
      concluidaEm: null,
      canceladaEm: null,
    }

    setupFetch({
      studySessions: [sessionInProgess],
      studySessionDetails: {
        2: sessionInProgess,
      },
    })
    renderApp()

    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    expect(await screen.findByText('Estudo Ativo de Fisiologia')).toBeInTheDocument()

    const viewDetailsButton = screen.getByRole('button', { name: 'Ver detalhes da sessão Estudo Ativo de Fisiologia' })
    fireEvent.click(viewDetailsButton)

    const modal = await screen.findByRole('dialog')
    expect(within(modal).getByRole('heading', { name: 'Estudo Ativo de Fisiologia' })).toBeInTheDocument()
    expect(within(modal).getByText('Foco no sistema cardiovascular')).toBeInTheDocument()
    expect(within(modal).getByText('2 h')).toBeInTheDocument()
    expect(within(modal).getByText('#2')).toBeInTheDocument()

    const statusBadge = within(modal).getByText('Em andamento', { selector: '.study-session-status' })
    expect(statusBadge).toHaveClass('study-session-status-emandamento')

    // Fechar modal
    const closeButtons = within(modal).getAllByRole('button', { name: 'Fechar' })
    fireEvent.click(closeButtons[0])
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('renderiza com segurança sem lançar exceção quando a situação possui valor desconhecido', async () => {
    const unknownSession = {
      id: 99,
      titulo: 'Sessão com status desconhecido',
      dataPlanejada: '2026-11-10',
      horaInicioPlanejada: '10:00:00',
      duracaoPlanejadaMinutos: 60,
      duracaoRealMinutos: null,
      situacao: 99, // Valor desconhecido / futuro
      demandaAcademicaId: null,
      tarefaDemandaId: null,
      observacoes: 'Sessão com enum inesperado',
      criadoEm: '2026-11-01T10:00:00Z',
      inicioRealEm: null,
      concluidaEm: null,
      canceladaEm: null,
    }

    setupFetch({
      studySessions: [unknownSession],
      studySessionDetails: {
        99: unknownSession,
      },
    })
    renderApp()

    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    expect(await screen.findByText('Sessão com status desconhecido')).toBeInTheDocument()

    // Não lança exceção e exibe rótulo defensivo 'Desconhecida'
    const statusBadge = screen.getByText('Desconhecida', { selector: '.study-session-status' })
    expect(statusBadge).toHaveClass('study-session-status-desconhecida')

    // Ao consultar detalhes, também renderiza defensivamente
    const viewDetailsButton = screen.getByRole('button', { name: 'Ver detalhes da sessão Sessão com status desconhecido' })
    fireEvent.click(viewDetailsButton)

    const modal = await screen.findByRole('dialog')
    expect(await within(modal).findByRole('heading', { name: 'Sessão com status desconhecido' })).toBeInTheDocument()
    const modalStatus = within(modal).getByText('Desconhecida', { selector: '.study-session-status' })
    expect(modalStatus).toHaveClass('study-session-status-desconhecida')

    // Fechar modal
    const closeButtons = within(modal).getAllByRole('button', { name: 'Fechar' })
    fireEvent.click(closeButtons[0])
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('trata adequadamente quando a sessão consultada não é encontrada (404)', async () => {
    setupFetch({
      studySessions: [
        {
          id: 999,
          titulo: 'Sessão que foi removida',
          dataPlanejada: '2026-11-10',
          horaInicioPlanejada: '10:00:00',
          duracaoPlanejadaMinutos: 60,
          duracaoRealMinutos: null,
          situacao: 0,
          demandaAcademicaId: null,
          tarefaDemandaId: null,
        },
      ],
      studySessionDetails: {
        999: {
          status: 404,
          data: { title: 'Sessão de estudo não encontrada.' },
        },
      },
    })

    renderApp()

    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    expect(await screen.findByText('Sessão que foi removida')).toBeInTheDocument()

    const viewDetailsButton = screen.getByRole('button', { name: 'Ver detalhes da sessão Sessão que foi removida' })
    fireEvent.click(viewDetailsButton)

    const modal = await screen.findByRole('dialog')
    expect(await within(modal).findByRole('heading', { name: 'Sessão não encontrada' })).toBeInTheDocument()
    expect(within(modal).getByText('A sessão informada não foi encontrada')).toBeInTheDocument()
    expect(within(modal).getByText('A sessão de estudo solicitada não existe ou foi removida.')).toBeInTheDocument()

    // Fechar pelo botão fechar da mensagem de erro
    const closeButtons = within(modal).getAllByRole('button', { name: 'Fechar' })
    fireEvent.click(closeButtons[0])
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('cria uma sessão sem vínculo e envia somente os campos aceitos pela API', async () => {
    const fetchMock = setupFetch({ studySessions: [] })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByRole('heading', { name: 'Sessões de estudo', level: 2 })
    fireEvent.click(screen.getByRole('button', { name: 'Nova sessão de estudo' }))

    const form = screen.getByRole('heading', { name: 'Nova sessão de estudo' }).closest('form')
    fireEvent.change(within(form).getByLabelText('Título'), { target: { value: 'Revisar fisiologia' } })
    fireEvent.change(within(form).getByLabelText('Data planejada'), { target: { value: '2026-11-20' } })
    fireEvent.change(within(form).getByLabelText('Horário de início'), { target: { value: '09:30' } })
    fireEvent.change(within(form).getByLabelText('Duração planejada (minutos)'), { target: { value: '45' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Criar sessão' }))

    await waitFor(() => expect(fetchMock.getStudySessionPostRequests()).toBe(1))
    expect(fetchMock).toHaveBeenCalledWith('/api/sessoes-estudo', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        titulo: 'Revisar fisiologia',
        dataPlanejada: '2026-11-20',
        horaInicioPlanejada: '09:30',
        duracaoPlanejadaMinutos: 45,
        demandaAcademicaId: null,
        tarefaDemandaId: null,
        observacoes: null,
      }),
    }))
    expect(await screen.findByText('Revisar fisiologia')).toBeInTheDocument()
  })

  it('carrega tarefas somente da demanda selecionada e não envia demanda e tarefa juntas', async () => {
    const fetchMock = setupFetch({
      studySessions: [],
      tasksByDemand: {
        1: [{ id: 8, demandaAcademicaId: 1, titulo: 'Lista de exercícios', descricao: null, ordem: 0, esforcoEstimadoMinutos: 30, situacao: 0 }],
      },
    })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByRole('heading', { name: 'Sessões de estudo', level: 2 })
    fireEvent.click(screen.getByRole('button', { name: 'Nova sessão de estudo' }))
    const form = screen.getByRole('heading', { name: 'Nova sessão de estudo' }).closest('form')
    fireEvent.change(within(form).getByLabelText('Demanda acadêmica (opcional)'), { target: { value: '1' } })
    expect(await within(form).findByRole('option', { name: 'Lista de exercícios' })).toBeInTheDocument()
    fireEvent.change(within(form).getByLabelText('Tarefa (opcional)'), { target: { value: '8' } })
    fireEvent.change(within(form).getByLabelText('Título'), { target: { value: 'Resolver lista' } })
    fireEvent.change(within(form).getByLabelText('Data planejada'), { target: { value: '2026-11-20' } })
    fireEvent.change(within(form).getByLabelText('Horário de início'), { target: { value: '09:30' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Criar sessão' }))

    await waitFor(() => expect(fetchMock.getStudySessionPostRequests()).toBe(1))
    expect(fetchMock).toHaveBeenCalledWith('/api/sessoes-estudo', expect.objectContaining({
      body: expect.stringContaining('"demandaAcademicaId":null'),
    }))
    expect(fetchMock).toHaveBeenCalledWith('/api/sessoes-estudo', expect.objectContaining({
      body: expect.stringContaining('"tarefaDemandaId":8'),
    }))
  })

  it('edita sessão planejada e bloqueia edição das demais situações', async () => {
    const planned = { ...studySessionFixture, demandaAcademicaId: null, titulo: 'Sessão editável' }
    const active = { ...studySessionFixture, id: 2, situacao: 1, titulo: 'Sessão em andamento' }
    const fetchMock = setupFetch({ studySessions: [planned, active] })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão editável')
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalhes da sessão Sessão editável' }))
    const modal = await screen.findByRole('dialog')
    fireEvent.click(within(modal).getByRole('button', { name: 'Editar sessão' }))
    const form = within(modal).getByRole('heading', { name: 'Editar sessão de estudo' }).closest('form')
    expect(within(form).getByLabelText('Título')).toHaveValue('Sessão editável')
    fireEvent.change(within(form).getByLabelText('Título'), { target: { value: 'Sessão atualizada' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Salvar alterações' }))
    await waitFor(() => expect(fetchMock.getStudySessionPutRequests()).toBe(1))
    expect(await within(modal).findByRole('heading', { name: 'Sessão atualizada' })).toBeInTheDocument()
    expect(within(modal).queryByRole('button', { name: 'Editar sessão' })).toBeInTheDocument()

    fireEvent.click(within(modal).getAllByRole('button', { name: 'Fechar' })[0])
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalhes da sessão Sessão em andamento' }))
    const activeModal = await screen.findByRole('dialog')
    expect(within(activeModal).queryByRole('button', { name: 'Editar sessão' })).not.toBeInTheDocument()
    expect(within(activeModal).getByText(/não podem ser editadas/)).toBeInTheDocument()
  })

  it('mantém criação incerta sem repetir POST automaticamente', async () => {
    const fetchMock = setupFetch({ studySessions: [], studySessionCreateNetworkFailures: 1 })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByRole('heading', { name: 'Sessões de estudo', level: 2 })
    fireEvent.click(screen.getByRole('button', { name: 'Nova sessão de estudo' }))
    const form = screen.getByRole('heading', { name: 'Nova sessão de estudo' }).closest('form')
    fireEvent.change(within(form).getByLabelText('Título'), { target: { value: 'Sessão incerta' } })
    fireEvent.change(within(form).getByLabelText('Data planejada'), { target: { value: '2026-11-20' } })
    fireEvent.change(within(form).getByLabelText('Horário de início'), { target: { value: '09:30' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Criar sessão' }))
    expect(await within(form).findByText(/resultado da operação é incerto/)).toBeInTheDocument()
    expect(fetchMock.getStudySessionPostRequests()).toBe(1)
    expect(within(form).getByRole('button', { name: 'Criar sessão' })).toBeDisabled()
  })

  it('inicia sessão planejada e atualiza listagem e detalhes', async () => {
    const planned = { ...studySessionFixture, titulo: 'Sessão para iniciar', situacao: 0, inicioRealEm: null }
    const fetchMock = setupFetch({ studySessions: [planned], studySessionDetails: { 1: planned } })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão para iniciar')
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar', exact: true }))
    await waitFor(() => expect(fetchMock.getStudySessionTransitionRequests()).toBe(1))
    expect(await screen.findByText('Em andamento', { selector: '.study-session-status' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Iniciar', exact: true })).not.toBeInTheDocument()
  })

  it('invalida a prévia do planejamento após uma transição de sessão confirmada', async () => {
    const planned = { ...studySessionFixture, titulo: 'Sessão que invalida a prévia', situacao: 0, inicioRealEm: null }
    const fetchMock = setupFetch({ studySessions: [planned], studySessionDetails: { 1: planned } })
    renderApp()

    fireEvent.click(screen.getByRole('button', { name: /Gerar pr/ }))
    await screen.findByText('Revisar anatomia')
    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText(planned.titulo)
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar', exact: true }))
    await waitFor(() => expect(fetchMock.getStudySessionTransitionRequests()).toBe(1))

    fireEvent.click(screen.getByRole('button', { name: 'Planejamento semanal' }))
    expect(await screen.findByText(/Gere uma proposta com base nas demandas/)).toBeInTheDocument()
  })

  it('conclui uma sessão em andamento e preserva duração real zero e metadados', async () => {
    const active = { ...studySessionFixture, titulo: 'Sessão para concluir', situacao: 1, inicioRealEm: '2026-11-06T15:00:00Z', duracaoRealMinutos: 0 }
    const fetchMock = setupFetch({
      studySessions: [active],
      studySessionDetails: { 1: active },
      studySessionTransitionResponses: {
        '1/concluir': { status: 200, data: { ...active, situacao: 2, concluidaEm: '2026-11-06T15:00:00Z', duracaoRealMinutos: 0 } },
      },
    })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão para concluir')
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalhes da sessão Sessão para concluir' }))
    const modal = await screen.findByRole('dialog')
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    fireEvent.click(within(modal).getByRole('button', { name: 'Concluir sessão' }))
    await waitFor(() => expect(fetchMock.getStudySessionTransitionRequests()).toBe(1))
    expect(await within(modal).findByText('Concluída', { selector: '.study-session-status' })).toBeInTheDocument()
    expect(within(modal).getByText('0 min')).toBeInTheDocument()
    expect(within(modal).queryByRole('button', { name: 'Concluir sessão' })).not.toBeInTheDocument()
  })

  it.each([
    ['planejada', 0],
    ['em andamento', 1],
  ])('cancela sessão %s somente após confirmação', async (_label, situation) => {
    const session = { ...studySessionFixture, titulo: `Sessão cancelável ${situation}`, situacao: situation }
    const fetchMock = setupFetch({ studySessions: [session], studySessionDetails: { 1: session } })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText(session.titulo)
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    fireEvent.click(screen.getAllByRole('button', { name: 'Cancelar' })[0])
    expect(fetchMock.getStudySessionTransitionRequests()).toBe(0)
    vi.mocked(window.confirm).mockReturnValue(true)
    fireEvent.click(screen.getAllByRole('button', { name: 'Cancelar' })[0])
    await waitFor(() => expect(fetchMock.getStudySessionTransitionRequests()).toBe(1))
    expect(await screen.findByText('Cancelada', { selector: '.study-session-status' })).toBeInTheDocument()
  })

  it.each([2, 3])('não disponibiliza transições para situação final %i', async (situation) => {
    const session = { ...studySessionFixture, id: situation, titulo: `Sessão final ${situation}`, situacao: situation }
    setupFetch({ studySessions: [session] })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText(session.titulo)
    fireEvent.click(screen.getByRole('button', { name: `Ver detalhes da sessão ${session.titulo}` }))
    const modal = await screen.findByRole('dialog')
    expect(within(modal).queryByRole('button', { name: 'Iniciar sessão' })).not.toBeInTheDocument()
    expect(within(modal).queryByRole('button', { name: 'Concluir sessão' })).not.toBeInTheDocument()
    expect(within(modal).queryByRole('button', { name: 'Cancelar sessão' })).not.toBeInTheDocument()
  })

  it.each([
    [404, 'Sessão não encontrada.'],
    [409, 'Somente sessões planejadas podem ser iniciadas.'],
  ])('trata %i sem atualizar a situação', async (status, detail) => {
    const session = { ...studySessionFixture, titulo: 'Sessão com conflito', situacao: 0 }
    const fetchMock = setupFetch({
      studySessions: [session],
      studySessionTransitionResponses: {
        '1/iniciar': { status, data: { detail } },
      },
    })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão com conflito')
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar', exact: true }))
    expect(await screen.findByRole('alert')).toHaveTextContent(detail)
    expect(fetchMock.getStudySessionTransitionRequests()).toBe(1)
    expect(screen.getByText('Planejada', { selector: '.study-session-status' })).toBeInTheDocument()
  })

  it('reconcilia falha de rede sem repetir o POST', async () => {
    const initial = { ...studySessionFixture, titulo: 'Sessão incerta', situacao: 0 }
    const reconciled = { ...initial, situacao: 1, inicioRealEm: '2026-11-06T15:00:00Z' }
    const fetchMock = setupFetch({
      studySessions: [initial],
      studySessionTransitionNetworkFailures: { '1/iniciar': 1 },
      studySessionReconciliationDetails: { 1: reconciled },
    })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão incerta')
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar', exact: true }))
    await waitFor(() => expect(fetchMock.getStudySessionTransitionRequests()).toBe(1))
    expect(await screen.findByText('Em andamento', { selector: '.study-session-status' })).toBeInTheDocument()
    expect(fetchMock.getStudySessionTransitionRequests()).toBe(1)
  })

  it('impede submissões duplicadas durante uma transição', async () => {
    let releaseTransition
    const transitionGate = new Promise((resolve) => { releaseTransition = resolve })
    const session = { ...studySessionFixture, titulo: 'Sessão sem duplicação', situacao: 0 }
    const fetchMock = setupFetch({ studySessions: [session], studySessionTransitionGate: transitionGate })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão sem duplicação')
    const startButton = screen.getByRole('button', { name: 'Iniciar', exact: true })
    fireEvent.click(startButton)
    fireEvent.click(startButton)
    expect(fetchMock.getStudySessionTransitionRequests()).toBe(1)
    releaseTransition()
    await waitFor(() => expect(screen.getByText('Em andamento', { selector: '.study-session-status' })).toBeInTheDocument())
  })

  it('bloqueia mutação de sessão enquanto a confirmação do planejamento está pendente', async () => {
    let releaseConfirmation
    const confirmationGate = new Promise((resolve) => { releaseConfirmation = resolve })
    const planned = { ...studySessionFixture, titulo: 'Sessão bloqueada pela confirmação', situacao: 0 }
    const fetchMock = setupFetch({ confirmationGate, studySessions: [planned] })
    renderApp()

    fireEvent.click(screen.getByRole('button', { name: /Gerar pr/ }))
    await screen.findByText('Revisar anatomia')
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar planejamento' }))
    await waitFor(() => expect(fetchMock.getConfirmationPostRequests()).toBe(1))

    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText(planned.titulo)
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar', exact: true }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/operação de planejamento/)
    expect(fetchMock.getStudySessionTransitionRequests()).toBe(0)

    releaseConfirmation()
    await screen.findByText('Planejamento confirmado')
  })

  it('bloqueia confirmação enquanto uma mutação de sessão está pendente', async () => {
    let releaseTransition
    const transitionGate = new Promise((resolve) => { releaseTransition = resolve })
    const planned = { ...studySessionFixture, titulo: 'Sessão bloqueando confirmação', situacao: 0 }
    const fetchMock = setupFetch({ studySessionTransitionGate: transitionGate, studySessions: [planned] })
    renderApp()

    fireEvent.click(screen.getByRole('button', { name: /Gerar pr/ }))
    await screen.findByText('Revisar anatomia')
    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText(planned.titulo)
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar', exact: true }))

    fireEvent.click(screen.getByRole('button', { name: 'Planejamento semanal' }))
    expect(screen.getByRole('button', { name: 'Confirmar planejamento' })).toBeDisabled()
    expect(fetchMock.getConfirmationPostRequests()).toBe(0)

    releaseTransition()
    await waitFor(() => expect(fetchMock.getStudySessionTransitionRequests()).toBe(1))
  })
})
