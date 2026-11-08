import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within, findByText, render } from '@testing-library/react'
import { renderApp } from './helpers/renderApp.jsx'
import { setupFetch, studySessionFixture } from './helpers/fetchMocks.js'
import StudySessionsPanel from '../../src/CadernoAtlas.Web/src/features/study-sessions/StudySessionsPanel'
import { clearAllUncertainTransitions } from '../../src/CadernoAtlas.Web/src/features/study-sessions/useStudySessionUncertainTransitions'
import { clearAllUncertainDeletions } from '../../src/CadernoAtlas.Web/src/features/study-sessions/useStudySessionUncertainDeletions'

describe('Sessões de estudo', () => {
  beforeEach(() => {
    // Limpa tanto sessionStorage quanto cache em memória para isolamento total entre testes
    clearAllUncertainTransitions()
    clearAllUncertainDeletions()
  })

  it('distingue sessão criada de falha ao atualizar a lista e não repete o POST', async () => {
    // 1. Initial load quando clica na aba "Sessões de estudo"
    // 2. Pré-criação GET no handleSubmit (para correlação)
    // 3. Reconciliação GET (após POST) falha com erro de rede
    const fetchMock = setupFetch({
      studySessions: [studySessionFixture],
      studySessionListQueues: {
        '/api/sessoes-estudo': [
          { data: [studySessionFixture] }, // 1. carga inicial da aba
          { data: [studySessionFixture] }, // 2. pré-criação GET
          { error: new TypeError('Failed to fetch') }, // 3. reconciliação falha
        ],
      },
    })
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

  // ===== TESTES DE REGRESSÃO PARA CORREÇÕES DA PR #20 =====

  it('preserva MutationSyncError quando transição confirmada mas GET da lista falha', async () => {
    // Teste: transição POST bem-sucedida, mas falha ao atualizar a lista (refresh)
    const initial = { ...studySessionFixture, titulo: 'Sessão para transição', situacao: 0 }
    const fetchMock = setupFetch({
      studySessions: [initial],
      studySessionDetails: { 1: initial },
      studySessionReconcileFailures: 1, // GET da lista falha na reconciliação
    })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão para transição')
    // Abrir detalhes
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalhes da sessão Sessão para transição' }))
    const modal = await screen.findByRole('dialog')
    await waitFor(() => expect(within(modal).queryByText('Carregando…')).not.toBeInTheDocument())
    // Verificar estado inicial (Planejada)
    expect(within(modal).getByText('Planejada', { selector: '.study-session-status' })).toBeInTheDocument()
    // Clicar em Iniciar - POST bem-sucedido
    fireEvent.click(within(modal).getByRole('button', { name: 'Iniciar sessão' }))

    // Verifica que o erro de sincronização é mostrado (operação confirmada, lista não atualizada)
    // O erro aparece no painel de sessões (lista), não no modal
    // Primeiro, verificar que a transição foi feita (POST chamado)
    expect(fetchMock.getStudySessionTransitionRequests()).toBe(1)

    // O erro de sincronização deve aparecer no painel principal (lista de sessões)
    expect(await screen.findByText(/A transição foi confirmada, mas a lista não pôde ser atualizada/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument()
  })

  it('mantém estado de resultado incerto persistente para transição com POST e GET de reconciliação falhando', async () => {
    // Teste: POST falha com erro de rede, GET individual de reconciliação também falha (status 503)
    const initial = { ...studySessionFixture, titulo: 'Sessão incerta persistente', situacao: 0 }
    const fetchMock = setupFetch({
      studySessions: [initial],
      studySessionTransitionNetworkFailures: { '1/iniciar': 1 },
      studySessionDetailsQueues: {
        1: [
          initial, // 1ª chamada: modal abre e carrega a sessão planejada
          { status: 503, data: { detail: 'Falha temporária ao carregar a sessão.' } }, // 2ª chamada: reconciliação automática pós-POST falha
          initial, // 3ª chamada: reabertura do modal
        ],
      },
    })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão incerta persistente')
    // Abrir detalhes para ver o erro de transição
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalhes da sessão Sessão incerta persistente' }))
    const modal = await screen.findByRole('dialog')
    await waitFor(() => expect(within(modal).queryByText('Carregando…')).not.toBeInTheDocument())
    // Verificar estado inicial (o modal carrega da lista)
    expect(within(modal).getByText('Planejada', { selector: '.study-session-status' })).toBeInTheDocument()
    fireEvent.click(within(modal).getByRole('button', { name: 'Iniciar sessão' }))

    // Verifica estado incerto no modal de detalhes
    expect(await within(modal).findByText(/resultado da operação é incerto/)).toBeInTheDocument()
    // Botão de transição fica bloqueado
    await waitFor(() => expect(within(modal).getByRole('button', { name: 'Iniciar sessão' })).toBeDisabled())
    expect(fetchMock.getStudySessionTransitionRequests()).toBe(1)

    // O botão de reconciliação explícita deve estar disponível no modal
    expect(within(modal).getByRole('button', { name: 'Consultar sessões antes de tentar novamente' })).toBeInTheDocument()

    // Fechar modal e reabrir: o resultado incerto permanece registrado
    const closeButtons = within(modal).getAllByRole('button', { name: 'Fechar' })
    fireEvent.click(closeButtons[closeButtons.length - 1])
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    // Reabrir modal da mesma sessão
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalhes da sessão Sessão incerta persistente' }))
    const reopenedModal = await screen.findByRole('dialog')
    await waitFor(() => expect(within(reopenedModal).queryByText('Carregando…')).not.toBeInTheDocument())

    // O estado incerto permanece persistido e a transição continua bloqueada
    expect(within(reopenedModal).getByText(/resultado da operação é incerto/)).toBeInTheDocument()
    expect(within(reopenedModal).getByRole('button', { name: 'Iniciar sessão' })).toBeDisabled()
    expect(within(reopenedModal).getByRole('button', { name: 'Consultar sessões antes de tentar novamente' })).toBeInTheDocument()
  })

  it('reconciliação explícita bem-sucedida libera bloqueios sem repetir POST', async () => {
    // Teste: POST falha com erro de rede, reconciliação automática falha,
    // estado incerto persiste e bloqueia, reconciliação explícita consulta GET individual,
    // esclarece estado e libera os bloqueios sem repetir o POST
    const initial = { ...studySessionFixture, titulo: 'Sessão para reconciliação explícita', situacao: 0 }
    const reconciled = { ...initial, situacao: 1, inicioRealEm: '2026-11-06T15:00:00Z' }
    const fetchMock = setupFetch({
      studySessions: [initial],
      studySessionTransitionNetworkFailures: { '1/iniciar': 1 },
      studySessionDetailsQueues: {
        1: [
          initial, // 1ª chamada: modal abre com Planejada
          { status: 503, data: { detail: 'Falha temporária ao reconciliar' } }, // 2ª chamada: reconciliação automática falha
          reconciled, // 3ª chamada: reconciliação explícita tem sucesso com situacao 1
        ],
      },
    })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão para reconciliação explícita')
    // Abrir detalhes para fazer a transição
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalhes da sessão Sessão para reconciliação explícita' }))
    const modal = await screen.findByRole('dialog')
    await waitFor(() => expect(within(modal).queryByText('Carregando…')).not.toBeInTheDocument())
    // Verificar estado inicial (Planejada)
    expect(within(modal).getByText('Planejada', { selector: '.study-session-status' })).toBeInTheDocument()
    // Aguardar o botão de transição aparecer (dados carregados)
    const startButton = await within(modal).findByRole('button', { name: 'Iniciar sessão' })
    fireEvent.click(startButton)

    // Estado incerto inicial no modal (POST falhou, reconciliação automática falhou)
    expect(await within(modal).findByText(/resultado da operação é incerto/)).toBeInTheDocument()
    expect(fetchMock.getStudySessionTransitionRequests()).toBe(1)

    // Botão de reconciliação explícita deve estar disponível e transição bloqueada
    expect(within(modal).getByRole('button', { name: 'Consultar sessões antes de tentar novamente' })).toBeInTheDocument()
    expect(within(modal).getByRole('button', { name: 'Iniciar sessão' })).toBeDisabled()

    // Clicar em reconciliação explícita consulta GET /api/sessoes-estudo/1
    fireEvent.click(within(modal).getByRole('button', { name: 'Consultar sessões antes de tentar novamente' }))

    // Após reconciliação explícita bem-sucedida:
    // 1. Estado atualizado para Em andamento
    expect(await within(modal).findByText('Em andamento', { selector: '.study-session-status' })).toBeInTheDocument()
    // 2. Bloqueio liberado (aviso de incerteza desaparece)
    expect(within(modal).queryByText(/resultado da operação é incerto/)).not.toBeInTheDocument()
    // 3. Botão de transição seguinte (Concluir sessão) fica habilitado
    expect(within(modal).getByRole('button', { name: 'Concluir sessão' })).not.toBeDisabled()
    // 4. POST NÃO repetido
    expect(fetchMock.getStudySessionTransitionRequests()).toBe(1)
  })

  it('criação confirmada com falha de sincronização e atualização posterior não duplica a sessão', async () => {
    // 1. Initial load quando clica na aba "Sessões de estudo"
    // 2. Pré-criação GET no handleSubmit (para correlação)
    // 3. Reconciliação GET (após POST) falha com erro de rede
    const fetchMock = setupFetch({
      studySessions: [],
      studySessionListQueues: {
        '/api/sessoes-estudo': [
          { data: [] }, // 1. carga inicial da aba
          { data: [] }, // 2. pré-criação GET
          { error: new TypeError('Failed to fetch') }, // 3. reconciliação falha
        ],
      },
    })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByRole('heading', { name: 'Sessões de estudo', level: 2 })
    fireEvent.click(screen.getByRole('button', { name: 'Nova sessão de estudo' }))
    const form = screen.getByRole('heading', { name: 'Nova sessão de estudo' }).closest('form')
    fireEvent.change(within(form).getByLabelText('Título'), { target: { value: 'Sessão não duplicada' } })
    fireEvent.change(within(form).getByLabelText('Data planejada'), { target: { value: '2026-11-20' } })
    fireEvent.change(within(form).getByLabelText('Horário de início'), { target: { value: '09:30' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Criar sessão' }))

    // Verifica erro de sincronização
    expect((await screen.findAllByText(/A sessão foi criada, mas a lista não pôde ser atualizada/)).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Atualizar lista de sessões' })).toBeInTheDocument()
    expect(fetchMock.getStudySessionPostRequests()).toBe(1)

    // Atualizar a lista - segunda chamada GET falha, terceira (após clicar) deve ter sucesso
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar lista de sessões' }))
    expect(await screen.findByText('Sessão não duplicada')).toBeInTheDocument()
    expect(fetchMock.getStudySessionPostRequests()).toBe(1) // Não duplicar POST
  })

  it('libera locks corretamente após sucesso de transição', async () => {
    const session1 = { ...studySessionFixture, id: 1, titulo: 'Sessão 1', situacao: 0 }
    const session2 = { ...studySessionFixture, id: 2, titulo: 'Sessão 2', situacao: 0 }
    const fetchMock = setupFetch({ studySessions: [session1, session2] })
    renderApp()

    // Mock para confirmação de dialog
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    // 1. Transição bem-sucedida na Sessão 1
    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão 1')
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalhes da sessão Sessão 1' }))
    await screen.findByRole('dialog')
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Iniciar sessão' }))
    await waitFor(() => expect(fetchMock.getStudySessionTransitionRequests()).toBe(1))
    expect(await within(screen.getByRole('dialog')).findByText('Em andamento', { selector: '.study-session-status' })).toBeInTheDocument()

    // Locks liberados - pode fazer outra transição na mesma sessão (concluir)
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Concluir sessão' }))
    await waitFor(() => expect(fetchMock.getStudySessionTransitionRequests()).toBe(2))
    expect(await within(screen.getByRole('dialog')).findByText('Concluída', { selector: '.study-session-status' })).toBeInTheDocument()

    // Fechar modal - usar o botão "Fechar" do rodapé (não o ícone do cabeçalho)
    const closeButtons = within(screen.getByRole('dialog')).getAllByRole('button', { name: 'Fechar' })
    fireEvent.click(closeButtons[closeButtons.length - 1])
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    // 2. Transição bem-sucedida na Sessão 2 (locks liberados entre sessões)
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalhes da sessão Sessão 2' }))
    await screen.findByRole('dialog')
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Iniciar sessão' }))
    await waitFor(() => expect(fetchMock.getStudySessionTransitionRequests()).toBe(3))
    expect(await within(screen.getByRole('dialog')).findByText('Em andamento', { selector: '.study-session-status' })).toBeInTheDocument()

    expect(fetchMock.getStudySessionTransitionRequests()).toBe(3)
  })

  it('protege o planejamento semanal bloqueando geração e confirmação enquanto houver transição incerta', async () => {
    const initial = { ...studySessionFixture, titulo: 'Sessão com transição incerta', situacao: 0 }
    const fetchMock = setupFetch({
      studySessions: [initial],
      studySessionTransitionNetworkFailures: { '1/iniciar': 1 },
      studySessionDetailsQueues: {
        1: [
          initial,
          { status: 503, data: { detail: 'Falha temporária' } },
        ],
      },
    })
    renderApp()

    // 1. Gerar prévia inicial do planejamento
    fireEvent.click(screen.getByRole('button', { name: /Gerar pr/ }))
    expect(await screen.findByText('Revisar anatomia')).toBeInTheDocument()

    // 2. Navegar para Sessões de estudo e provocar transição incerta
    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão com transição incerta')
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalhes da sessão Sessão com transição incerta' }))
    const modal = await screen.findByRole('dialog')
    await waitFor(() => expect(within(modal).queryByText('Carregando…')).not.toBeInTheDocument())
    fireEvent.click(within(modal).getByRole('button', { name: 'Iniciar sessão' }))
    expect(await within(modal).findByText(/resultado da operação é incerto/)).toBeInTheDocument()

    // 3. Fechar modal da sessão
    const closeButtons = within(modal).getAllByRole('button', { name: 'Fechar' })
    fireEvent.click(closeButtons[closeButtons.length - 1])
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    // 4. Retornar ao Planejamento semanal
    fireEvent.click(screen.getByRole('button', { name: 'Planejamento semanal' }))

    // 5. A transição incerta invalidou a prévia e bloqueia nova geração
    const previewRequestsBefore = fetchMock.getPreviewRequests()
    fireEvent.click(screen.getByRole('button', { name: /Gerar pr/ }))
    // A requisição de prévia é bloqueada porque há transição incerta pendente
    expect(fetchMock.getPreviewRequests()).toBe(previewRequestsBefore)
  })

  it('criação incerta seguida de GET da lista com sucesso, mas sem evidência da criação: formulário continua bloqueado', async () => {
    const fetchMock = setupFetch({
      studySessions: [],
      studySessionCreateNetworkFailures: 1,
      studySessionListQueues: {
        '/api/sessoes-estudo?': [{ data: [] }, { data: [] }],
      },
    })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByRole('heading', { name: 'Sessões de estudo', level: 2 })

    // Abre formulário de criação
    fireEvent.click(screen.getByRole('button', { name: 'Nova sessão de estudo' }))
    const form = screen.getByRole('heading', { name: 'Nova sessão de estudo' }).closest('form')
    fireEvent.change(within(form).getByLabelText('Título'), { target: { value: 'Sessão sem evidência' } })
    fireEvent.change(within(form).getByLabelText('Data planejada'), { target: { value: '2026-11-20' } })
    fireEvent.change(within(form).getByLabelText('Horário de início'), { target: { value: '09:30' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Criar sessão' }))

    // O POST falha por rede; o formulário entra em resultado incerto
    expect(await within(form).findByText(/resultado da operação é incerto/)).toBeInTheDocument()
    expect(within(form).getByRole('button', { name: 'Criar sessão' })).toBeDisabled()
    expect(fetchMock.getStudySessionPostRequests()).toBe(1)

    // Clica em consultar sessões antes de tentar novamente (GET da lista retorna 200, mas vazia)
    fireEvent.click(within(form).getByRole('button', { name: 'Consultar sessões antes de tentar novamente' }))

    // Sem evidência da criação na lista consultada:
    // O formulário continua aberto e bloqueado, alertando que o resultado ainda é incerto
    expect(await within(form).findByText(/Não foi possível confirmar a criação da sessão na lista consultada/)).toBeInTheDocument()
    expect(within(form).getByRole('button', { name: 'Criar sessão' })).toBeDisabled()
    expect(within(form).getByRole('button', { name: 'Consultar sessões antes de tentar novamente' })).toBeInTheDocument()
    // Nenhum novo POST foi disparado
    expect(fetchMock.getStudySessionPostRequests()).toBe(1)
  })

  it('criação confirmada com falha de sincronização: atualizar a lista fecha o formulário sem repetir POST', async () => {
    // 1. Initial load quando clica na aba "Sessões de estudo"
    // 2. Pré-criação GET no handleSubmit (para correlação)
    // 3. Reconciliação GET (após POST) falha com erro de rede
    const fetchMock = setupFetch({
      studySessions: [],
      studySessionListQueues: {
        '/api/sessoes-estudo': [
          { data: [] }, // 1. carga inicial da aba
          { data: [] }, // 2. pré-criação GET
          { error: new TypeError('Failed to fetch') }, // 3. reconciliação falha
        ],
      },
    })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByRole('heading', { name: 'Sessões de estudo', level: 2 })

    fireEvent.click(screen.getByRole('button', { name: 'Nova sessão de estudo' }))
    const form = screen.getByRole('heading', { name: 'Nova sessão de estudo' }).closest('form')
    fireEvent.change(within(form).getByLabelText('Título'), { target: { value: 'Sessão confirmada sync fail' } })
    fireEvent.change(within(form).getByLabelText('Data planejada'), { target: { value: '2026-11-20' } })
    fireEvent.change(within(form).getByLabelText('Horário de início'), { target: { value: '09:30' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Criar sessão' }))

    // Erro de sincronização da lista exibido no formulário
    expect((await screen.findAllByText(/A sessão foi criada, mas a lista não pôde ser atualizada/)).length).toBeGreaterThan(0)
    expect(within(form).getByRole('button', { name: 'Atualizar lista de sessões' })).toBeInTheDocument()
    expect(within(form).getByRole('button', { name: 'Criar sessão' })).toBeDisabled()
    expect(fetchMock.getStudySessionPostRequests()).toBe(1)

    // Clica em atualizar a lista
    fireEvent.click(within(form).getByRole('button', { name: 'Atualizar lista de sessões' }))

    // Como foi confirmado com sucesso, a lista é sincronizada e o formulário fecha automaticamente
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Nova sessão de estudo' })).not.toBeInTheDocument()
    })
    // A sessão aparece na lista e o POST não foi repetido
    expect(await screen.findByText('Sessão confirmada sync fail')).toBeInTheDocument()
    expect(fetchMock.getStudySessionPostRequests()).toBe(1)
  })

  it('erro 404 definitivo na transição: não registra uma incerteza inexistente', async () => {
    const session = { ...studySessionFixture, id: 1, titulo: 'Sessão para transição 404', situacao: 0 }
    const fetchMock = setupFetch({
      studySessions: [session],
      studySessionDetails: { 1: session },
      studySessionTransitionResponses: {
        '1/iniciar': { status: 404, data: { detail: 'Sessão não encontrada.' } },
      },
    })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão para transição 404')

    fireEvent.click(screen.getByRole('button', { name: 'Ver detalhes da sessão Sessão para transição 404' }))
    const modal = await screen.findByRole('dialog')
    await waitFor(() => expect(within(modal).queryByText('Carregando…')).not.toBeInTheDocument())

    fireEvent.click(within(modal).getByRole('button', { name: 'Iniciar sessão' }))

    // O erro 404 definitivo é exibido e NÃO é classificado como resultado incerto
    expect(await within(modal).findByText('A sessão informada não foi encontrada.')).toBeInTheDocument()
    expect(within(modal).queryByText(/resultado da operação é incerto/)).not.toBeInTheDocument()
    expect(within(modal).queryByRole('button', { name: 'Consultar sessões antes de tentar novamente' })).not.toBeInTheDocument()

    // Fechar modal
    const closeButtons = within(modal).getAllByRole('button', { name: 'Fechar' })
    fireEvent.click(closeButtons[closeButtons.length - 1])
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    // Verificar que o planejamento semanal NÃO foi bloqueado por incerteza inexistente
    fireEvent.click(screen.getByRole('button', { name: 'Planejamento semanal' }))
    const previewRequestsBefore = fetchMock.getPreviewRequests()
    fireEvent.click(screen.getByRole('button', { name: /Gerar pr/ }))
    // A requisição de prévia ocorre normalmente
    await waitFor(() => expect(fetchMock.getPreviewRequests()).toBe(previewRequestsBefore + 1))
  })

  it('POST incerto seguido de GET individual retornando estado diferente do esperado: a incerteza permanece até uma reconciliação explícita', async () => {
    const initial = { ...studySessionFixture, id: 1, titulo: 'Sessão estado divergente', situacao: 0 }
    const reconciled = { ...initial, situacao: 1, inicioRealEm: '2026-11-06T15:00:00Z' }
    const fetchMock = setupFetch({
      studySessions: [initial],
      studySessionTransitionNetworkFailures: { '1/iniciar': 1 },
      studySessionDetailsQueues: {
        1: [
          initial, // 1ª: abertura do modal (Planejada)
          initial, // 2ª: reconciliação automática pós-timeout (continua Planejada = 0, diferente do esperado 1)
          reconciled, // 3ª: reconciliação explícita manual (agora Em andamento = 1)
        ],
      },
    })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão estado divergente')

    fireEvent.click(screen.getByRole('button', { name: 'Ver detalhes da sessão Sessão estado divergente' }))
    const modal = await screen.findByRole('dialog')
    await waitFor(() => expect(within(modal).queryByText('Carregando…')).not.toBeInTheDocument())

    fireEvent.click(within(modal).getByRole('button', { name: 'Iniciar sessão' }))

    // Como o GET pós-POST retornou situacao: 0 (não confirmou 'iniciar'), o erro de incerteza permanece
    expect(await within(modal).findByText(/resultado da operação é incerto/)).toBeInTheDocument()
    expect(within(modal).getByRole('button', { name: 'Iniciar sessão' })).toBeDisabled()
    expect(within(modal).getByRole('button', { name: 'Consultar sessões antes de tentar novamente' })).toBeInTheDocument()

    // O usuário clica na reconciliação explícita
    fireEvent.click(within(modal).getByRole('button', { name: 'Consultar sessões antes de tentar novamente' }))

    // Agora o GET individual retorna o estado atualizado (1), liberando os bloqueios
    expect(await within(modal).findByText('Em andamento', { selector: '.study-session-status' })).toBeInTheDocument()
    expect(within(modal).queryByText(/resultado da operação é incerto/)).not.toBeInTheDocument()
    expect(within(modal).getByRole('button', { name: 'Concluir sessão' })).not.toBeDisabled()
    expect(fetchMock.getStudySessionTransitionRequests()).toBe(1) // Nunca repetiu POST
  })

  it('confirmação do planejamento é bloqueada enquanto houver transição incerta, mesmo que uma prévia já tenha sido gerada', async () => {
    // Session com transição incerta simulada
    sessionStorage.setItem('cadernoatlas:uncertain-session-transitions', JSON.stringify([{
      sessionId: 1,
      transition: 'iniciar',
      expectedStatus: 1,
      timestamp: Date.now(),
    }]))

    const fetchMock = setupFetch()
    renderApp()

    // Ao tentar gerar ou confirmar com incerteza presente:
    const confirmationRequestsBefore = fetchMock.getConfirmationPostRequests()
    const previewRequestsBefore = fetchMock.getPreviewRequests()

    // Gerar prévia deve ser bloqueado
    fireEvent.click(screen.getByRole('button', { name: /Gerar pr/ }))
    expect(fetchMock.getPreviewRequests()).toBe(previewRequestsBefore)
    expect(fetchMock.getConfirmationPostRequests()).toBe(confirmationRequestsBefore)
  })

  it('após reconciliação individual bem-sucedida, planejamento e transições voltam a funcionar sem repetir o POST', async () => {
    const initial = { ...studySessionFixture, id: 1, titulo: 'Sessão para desbloqueio completo', situacao: 0 }
    const reconciled = { ...initial, situacao: 1, inicioRealEm: '2026-11-06T15:00:00Z' }
    const fetchMock = setupFetch({
      studySessions: [initial],
      studySessionTransitionNetworkFailures: { '1/iniciar': 1 },
      studySessionDetailsQueues: {
        1: [
          initial,
          { status: 503, data: { detail: 'Timeout pós POST' } },
          reconciled, // reconciliação explícita no modal
        ],
      },
    })
    renderApp()

    // 1. Iniciar transição que se torna incerta
    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão para desbloqueio completo')
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalhes da sessão Sessão para desbloqueio completo' }))
    const modal = await screen.findByRole('dialog')
    await waitFor(() => expect(within(modal).queryByText('Carregando…')).not.toBeInTheDocument())
    fireEvent.click(within(modal).getByRole('button', { name: 'Iniciar sessão' }))
    expect(await within(modal).findByText(/resultado da operação é incerto/)).toBeInTheDocument()

    // 2. Reconciliação explícita no modal
    fireEvent.click(within(modal).getByRole('button', { name: 'Consultar sessões antes de tentar novamente' }))
    expect(await within(modal).findByText('Em andamento', { selector: '.study-session-status' })).toBeInTheDocument()
    expect(within(modal).queryByText(/resultado da operação é incerto/)).not.toBeInTheDocument()

    // Fechar modal
    const closeButtons = within(modal).getAllByRole('button', { name: 'Fechar' })
    fireEvent.click(closeButtons[closeButtons.length - 1])
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    // 3. Planejamento semanal volta a funcionar normalmente
    fireEvent.click(screen.getByRole('button', { name: 'Planejamento semanal' }))
    const previewRequestsBefore = fetchMock.getPreviewRequests()
    fireEvent.click(screen.getByRole('button', { name: /Gerar pr/ }))
    await waitFor(() => expect(fetchMock.getPreviewRequests()).toBe(previewRequestsBefore + 1))
    expect(await screen.findByText('Revisar anatomia')).toBeInTheDocument()

    // 4. Confirmar planejamento funciona sem erro de incerteza
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar planejamento' }))
    expect(await screen.findByText(/Planejamento confirmado/)).toBeInTheDocument()

    // 5. POST de transição NUNCA foi repetido (continua exatamente 1)
    expect(fetchMock.getStudySessionTransitionRequests()).toBe(1)
  })

  it('isola estado de incerteza entre testes: clearAllUncertainTransitions limpa sessionStorage e cache em memória', async () => {
    // Este teste verifica que clearAllUncertainTransitions() limpa corretamente
    // tanto o sessionStorage quanto o cache em memória (memoryCache)

    const { hasAnyUncertainTransition, registerUncertain: _registerUncertain } = await import('../../src/CadernoAtlas.Web/src/features/study-sessions/useStudySessionUncertainTransitions')

    // Verificar estado inicial limpo
    expect(hasAnyUncertainTransition()).toBe(false)

    // Simular registro de incerteza (como faria um teste anterior)
    sessionStorage.setItem('cadernoatlas:uncertain-session-transitions', JSON.stringify([{
      sessionId: 999,
      transition: 'iniciar',
      expectedStatus: 1,
      timestamp: Date.now(),
    }]))

    // Antes de chamar clearAllUncertainTransitions, deve haver incerteza
    expect(hasAnyUncertainTransition()).toBe(true)

    // Chamar clearAllUncertainTransitions (o que beforeEach faz entre testes)
    clearAllUncertainTransitions()

    // Após limpar, não deve haver incerteza
    expect(hasAnyUncertainTransition()).toBe(false)
  })

  // Testes de exclusão de sessão

  it('exclui sessão planejada com sucesso (204) e remove da lista', async () => {
    const session = { ...studySessionFixture, titulo: 'Sessão para excluir', situacao: 0 }
    const fetchMock = setupFetch({
      studySessions: [session],
      studySessionDeleteResponse: { status: 204, data: null },
    })
    renderApp()

    // Mock para confirmar o dialog de exclusão
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão para excluir')

    // Excluir via botão no card
    const deleteButton = screen.getByRole('button', { name: 'Excluir' })
    fireEvent.click(deleteButton)

    // Confirma no dialog
    await waitFor(() => expect(fetchMock.getStudySessionDeleteRequests()).toBe(1))
    expect(await screen.findByText('Nenhuma sessão de estudo encontrada')).toBeInTheDocument()
    expect(screen.queryByText('Sessão para excluir')).not.toBeInTheDocument()
  })

  it('trata 404 na exclusão: sessão não encontrada dispara reconciliação', async () => {
    const session = { ...studySessionFixture, titulo: 'Sessão inexistente', situacao: 0 }
    const fetchMock = setupFetch({
      studySessions: [session],
      studySessionDeleteResponse: { status: 404, data: { detail: 'Sessão de estudo não encontrada.' } },
      studySessionListQueues: {
        '/api/sessoes-estudo': [
          { data: [session] }, // 1. carga inicial
          { data: [] }, // 2. refresh após reconciliação
        ],
      },
    })
    renderApp()

    // Mock para confirmar o dialog de exclusão
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão inexistente')

    const deleteButton = screen.getByRole('button', { name: 'Excluir' })
    fireEvent.click(deleteButton)

    // DELETE foi chamado uma vez
    await waitFor(() => expect(fetchMock.getStudySessionDeleteRequests()).toBe(1))

    // Reconciliação automática atualiza a lista e remove a sessão
    await screen.findByText('Nenhuma sessão de estudo encontrada')
    expect(screen.queryByText('Sessão inexistente')).not.toBeInTheDocument()
  })

  it('trata 409 na exclusão: sessão não é planejada', async () => {
    const session = { ...studySessionFixture, id: 2, titulo: 'Sessão em andamento', situacao: 1 } // Em andamento
    const fetchMock = setupFetch({
      studySessions: [session],
      studySessionDeleteResponse: { status: 409, data: { detail: 'Somente sessões planejadas podem ser excluídas.' } },
    })
    renderApp()

    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão em andamento')

    // Botão Excluir só aparece para situacao === 0
    expect(screen.queryByRole('button', { name: 'Excluir' })).not.toBeInTheDocument()
    expect(fetchMock.getStudySessionDeleteRequests()).toBe(0)
  })

  it('preserva MutationSyncError quando exclusão confirmada mas GET da lista falha', async () => {
    // Teste: DELETE bem-sucedido (204), mas falha ao atualizar a lista (refresh)
    const session = { ...studySessionFixture, titulo: 'Sessão para excluir com sync fail', situacao: 0 }
    const fetchMock = setupFetch({
      studySessions: [session],
      studySessionDeleteResponse: { status: 204, data: null },
      studySessionListQueues: {
        '/api/sessoes-estudo': [
          { data: [session] }, // 1. carga inicial
          { error: new TypeError('Failed to fetch') }, // 2. reconciliação falha (GET lista após DELETE)
        ],
      },
    })
    renderApp()

    // Mock para confirmar o dialog de exclusão
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão para excluir com sync fail')

    // Excluir via card
    const deleteButton = screen.getByRole('button', { name: 'Excluir' })
    fireEvent.click(deleteButton)

    // DELETE foi chamado uma vez
    await waitFor(() => expect(fetchMock.getStudySessionDeleteRequests()).toBe(1))

    // Erro de sincronização aparece no painel
    expect(await screen.findByText(/A exclusão foi confirmada, mas a lista não pôde ser atualizada/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument()

    // Clicar em tentar novamente - segunda chamada GET deve ter sucesso
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))

    // Sessão removida da lista e POST não duplicado
    expect(await screen.findByText('Nenhuma sessão de estudo encontrada')).toBeInTheDocument()
    expect(fetchMock.getStudySessionDeleteRequests()).toBe(1)
  })

  it('sessão idêntica preexistente e criação incerta: não assume confirmação automática', async () => {
    // Cenário: já existe uma sessão com os mesmos dados do formulário
    // Tentativa de criar sessão idêntica resulta em POST incerto (falha de rede)
    // A listagem retorna a sessão preexistente — isso NÃO deve ser considerado evidência da nova criação

    const preexistingSession = {
      id: 42,
      titulo: 'Sessão duplicada',
      dataPlanejada: '2026-11-20',
      horaInicioPlanejada: '09:30:00',
      duracaoPlanejadaMinutos: 60,
      duracaoRealMinutos: null,
      situacao: 0,
      demandaAcademicaId: null,
      tarefaDemandaId: null,
      observacoes: null,
      criadoEm: '2026-11-01T10:00:00Z',
      inicioRealEm: null,
      concluidaEm: null,
      canceladaEm: null,
    }

    const fetchMock = setupFetch({
      studySessions: [preexistingSession],
      studySessionCreateNetworkFailures: 1, // POST falha por rede (resultado incerto)
      studySessionListQueues: {
        '/api/sessoes-estudo?': [{ data: [preexistingSession] }],
      },
    })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByRole('heading', { name: 'Sessões de estudo', level: 2 })

    // Verificar que a sessão preexistente já está na lista
    expect(screen.getByText('Sessão duplicada')).toBeInTheDocument()

    // Tentar criar sessão idêntica
    fireEvent.click(screen.getByRole('button', { name: 'Nova sessão de estudo' }))
    const form = screen.getByRole('heading', { name: 'Nova sessão de estudo' }).closest('form')
    fireEvent.change(within(form).getByLabelText('Título'), { target: { value: 'Sessão duplicada' } })
    fireEvent.change(within(form).getByLabelText('Data planejada'), { target: { value: '2026-11-20' } })
    fireEvent.change(within(form).getByLabelText('Horário de início'), { target: { value: '09:30' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Criar sessão' }))

    // POST falha por rede = estado incerto
    expect(await within(form).findByText(/resultado da operação é incerto/)).toBeInTheDocument()
    expect(within(form).getByRole('button', { name: 'Criar sessão' })).toBeDisabled()
    expect(fetchMock.getStudySessionPostRequests()).toBe(1)

    // Consultar sessões (lista retorna a sessão preexistente)
    fireEvent.click(within(form).getByRole('button', { name: 'Consultar sessões antes de tentar novamente' }))

    // A implementação NÃO deve assumir que a sessão preexistente confirma a NOVA criação
    // Sem ID de solicitação ou idempotência na API, não há garantia causal
    expect(await within(form).findByText(/Não foi possível confirmar a criação da sessão na lista consultada/)).toBeInTheDocument()
    expect(within(form).getByRole('button', { name: 'Criar sessão' })).toBeDisabled()
    expect(within(form).getByRole('button', { name: 'Consultar sessões antes de tentar novamente' })).toBeInTheDocument()

    // Nenhum novo POST disparado
    expect(fetchMock.getStudySessionPostRequests()).toBe(1)
  })

  it('falha de rede durante DELETE registra incerteza de exclusão', async () => {
    const session = { ...studySessionFixture, titulo: 'Sessão para excluir com rede', situacao: 0 }
    const fetchMock = setupFetch({
      studySessions: [session],
      studySessionDeleteNetworkFailures: 1, // Falha de rede no DELETE
    })
    renderApp()

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão para excluir com rede')

    const deleteButton = screen.getByRole('button', { name: 'Excluir' })
    fireEvent.click(deleteButton)

    // DELETE chamado uma vez
    await waitFor(() => expect(fetchMock.getStudySessionDeleteRequests()).toBe(1))

    // Painel mostra erro de rede
    expect(await screen.findByRole('alert')).toHaveTextContent(/Failed to fetch/)

    // Abrir modal para ver a incerteza registrada
    fireEvent.click(screen.getByRole('button', { name: /Ver detalhes/ }))
    await screen.findByRole('heading', { name: 'Sessão para excluir com rede' })

    // Mensagem de incerteza aparece no modal
    expect(await screen.findByText(/resultado da exclusão é incerto/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Consultar sessão antes de tentar novamente' })).toBeInTheDocument()

    // Botão Excluir no card deve ficar desabilitado (isDeleteUncertain)
    expect(screen.getByRole('button', { name: 'Excluir' })).toBeDisabled()
  })

  it('fechar e reabrir modal preserva incerteza de exclusão', async () => {
    const session = { ...studySessionFixture, titulo: 'Sessão persistir incerteza', situacao: 0 }
    const fetchMock = setupFetch({
      studySessions: [session],
      studySessionDeleteNetworkFailures: 1,
    })
    renderApp()

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão persistir incerteza')

    // Abrir modal
    fireEvent.click(screen.getByRole('button', { name: /Ver detalhes/ }))
    await screen.findByRole('heading', { name: 'Sessão persistir incerteza' })

    // Tentar excluir - falha de rede
    const deleteButtonModal = screen.getByRole('button', { name: 'Excluir sessão' })
    fireEvent.click(deleteButtonModal)

    // Mensagem de incerteza
    await screen.findByText(/resultado da exclusão é incerto/)

    // Fechar modal (botão icon-button com aria-label "Fechar")
    const closeButtons = screen.getAllByRole('button', { name: 'Fechar' })
    fireEvent.click(closeButtons[0]) // icon-button

    // Reabrir modal
    fireEvent.click(screen.getByRole('button', { name: /Ver detalhes/ }))
    await screen.findByRole('heading', { name: 'Sessão persistir incerteza' })

    // Incerteza deve persistir - botão Excluir sessão desabilitado
    expect(screen.getByRole('button', { name: 'Excluir sessão' })).toBeDisabled()
    expect(screen.getByText(/resultado da exclusão é incerto/)).toBeInTheDocument()
  })

  it('botão do card permanece bloqueado quando há incerteza de exclusão', async () => {
    const session = { ...studySessionFixture, titulo: 'Sessão card bloqueado', situacao: 0 }
    const fetchMock = setupFetch({
      studySessions: [session],
      studySessionDeleteNetworkFailures: 1,
    })
    renderApp()

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão card bloqueado')

    // Excluir via card - falha de rede
    const deleteButton = screen.getByRole('button', { name: 'Excluir' })
    fireEvent.click(deleteButton)

    await waitFor(() => expect(fetchMock.getStudySessionDeleteRequests()).toBe(1))

    // Botão Excluir do card deve estar desabilitado
    expect(screen.getByRole('button', { name: 'Excluir' })).toBeDisabled()
  })

  it('GET individual 404 confirma exclusão e atualiza a lista', async () => {
    const session = { ...studySessionFixture, id: 1, titulo: 'Sessão 404 confirma', situacao: 0 }
    const fetchMock = setupFetch({
      studySessions: [session],
      studySessionDeleteResponse: { status: 404, data: { detail: 'Sessão de estudo não encontrada.' } },
      studySessionDetailsQueues: {
        '1': [
          { status: 200, data: { ...session } }, // 1. carga inicial do modal - sessão existe
          { status: 404, data: { detail: 'Sessão de estudo não encontrada.' } }, // 2. reconciliação - 404 confirma exclusão
        ],
      },
      studySessionListQueues: {
        '/api/sessoes-estudo': [
          { data: [session] }, // 1. carga inicial
          { data: [] }, // 2. refresh após reconciliação
        ],
      },
    })
    renderApp()

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão 404 confirma')

    // Abrir modal e tentar excluir - recebe 404, dispara reconciliação automática
    fireEvent.click(screen.getByRole('button', { name: /Ver detalhes/ }))
    await screen.findByRole('heading', { name: 'Sessão 404 confirma' })

    const deleteButtonModal = screen.getByRole('button', { name: 'Excluir sessão' })
    fireEvent.click(deleteButtonModal)

    // Deve fazer reconciliação automática (GET individual) - 404 confirma exclusão
    // Modal fecha automaticamente após sincronização, lista atualizada
    await screen.findByText('Nenhuma sessão de estudo encontrada')

    // DELETE chamado apenas uma vez
    expect(fetchMock.getStudySessionDeleteRequests()).toBe(1)
  })

  it('GET individual 200 mantém a sessão e atualiza seu estado', async () => {
    const session = { ...studySessionFixture, id: 1, titulo: 'Sessão 200 mantem', situacao: 0 }
    const sessionAfterDelete = { ...session, situacao: 1 } // Mudou para Em andamento
    const fetchMock = setupFetch({
      studySessions: [session],
      studySessionDeleteResponse: { status: 204, data: null },
      studySessionDetailsQueues: {
        '1': [
          { status: 200, data: { ...session } }, // 1. carga inicial do modal - sessão existe
          { status: 200, data: sessionAfterDelete }, // 2. reconciliação - 200 sessão ainda existe
        ],
      },
      studySessionListQueues: {
        '/api/sessoes-estudo': [
          { data: [session] }, // 1. carga inicial
          { data: [sessionAfterDelete] }, // 2. refresh após reconciliação
        ],
      },
      studySessionDeleteNetworkFailures: 1, // Simula falha de rede para forçar incerteza
    })
    renderApp()

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão 200 mantem')

    // Abrir modal e tentar excluir - falha de rede dispara incerteza
    fireEvent.click(screen.getByRole('button', { name: /Ver detalhes/ }))
    await screen.findByRole('heading', { name: 'Sessão 200 mantem' })

    const deleteButtonModal = screen.getByRole('button', { name: 'Excluir sessão' })
    fireEvent.click(deleteButtonModal)

    // Mensagem de incerteza aparece
    await screen.findByText(/resultado da exclusão é incerto/)

    // Reconciliação via botão - GET individual retorna 200 com sessão atualizada
    fireEvent.click(screen.getByRole('button', { name: 'Consultar sessão antes de tentar novamente' }))

    // Sessão deve ainda existir mas com estado atualizado (Em andamento)
    // Procurar o status no modal (detail view)
    const modal = screen.getByRole('dialog', { name: /Sessão 200 mantem/i })
    await findByText(modal, 'Em andamento')
    // Botão Excluir sessão não deve mais existir (situacao !== 0)
    expect(screen.queryByRole('button', { name: 'Excluir sessão' })).not.toBeInTheDocument()
  })

  it('falha de rede durante reconciliação preserva o bloqueio', async () => {
    const session = { ...studySessionFixture, id: 1, titulo: 'Sessão rede reconciliação', situacao: 0 }
    const fetchMock = setupFetch({
      studySessions: [session],
      studySessionDeleteNetworkFailures: 1,
      studySessionDetailsQueues: {
        '1': [
          { status: 200, data: { ...session } }, // 1. carga inicial do modal - sessão existe
          { error: new TypeError('Failed to fetch') }, // 2. GET individual falha de rede
        ],
      },
    })
    renderApp()

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão rede reconciliação')

    // Abrir modal
    fireEvent.click(screen.getByRole('button', { name: /Ver detalhes/ }))
    await screen.findByRole('heading', { name: 'Sessão rede reconciliação' })

    // Tentar excluir - falha de rede
    const deleteButtonModal = screen.getByRole('button', { name: 'Excluir sessão' })
    fireEvent.click(deleteButtonModal)

    // Mensagem de incerteza
    await screen.findByText(/resultado da exclusão é incerto/)

    // Tentar reconciliação via modal - falha de rede
    fireEvent.click(screen.getByRole('button', { name: 'Consultar sessão antes de tentar novamente' }))

    // Bloqueio deve persistir
    expect(screen.getByRole('button', { name: 'Excluir sessão' })).toBeDisabled()
    expect(screen.getByText(/resultado da exclusão é incerto/)).toBeInTheDocument()
  })

  it('HTTP 409 após sessão carregada como Planejada', async () => {
    const session = { ...studySessionFixture, id: 2, titulo: 'Sessão 409', situacao: 0 }
    const fetchMock = setupFetch({
      studySessions: [session],
      studySessionDeleteResponse: { status: 409, data: { detail: 'Somente sessões planejadas podem ser excluídas.' } },
    })
    renderApp()

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão 409')

    // Abrir modal
    fireEvent.click(screen.getByRole('button', { name: /Ver detalhes/ }))
    await screen.findByRole('heading', { name: 'Sessão 409' })

    // Tentar excluir - recebe 409
    const deleteButtonModal = screen.getByRole('button', { name: 'Excluir sessão' })
    fireEvent.click(deleteButtonModal)

    // Erro 409 deve aparecer
    await screen.findByRole('alert')
    expect(screen.getByRole('alert')).toHaveTextContent(/Somente sessões planejadas podem ser excluídas/)

    // DELETE chamado uma vez
    expect(fetchMock.getStudySessionDeleteRequests()).toBe(1)
  })

  it('cancelamento da confirmação não envia DELETE', async () => {
    const session = { ...studySessionFixture, titulo: 'Sessão cancelar confirmação', situacao: 0 }
    const fetchMock = setupFetch({
      studySessions: [session],
    })
    renderApp()

    // Mock confirm para retornar false (cancelar)
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão cancelar confirmação')

    // Tentar excluir via card
    const deleteButton = screen.getByRole('button', { name: 'Excluir' })
    fireEvent.click(deleteButton)

    // DELETE não deve ser chamado
    expect(fetchMock.getStudySessionDeleteRequests()).toBe(0)
    expect(screen.getByText('Sessão cancelar confirmação')).toBeInTheDocument()
  })

  it('falha na atualização da lista não provoca segundo DELETE', async () => {
    const session = { ...studySessionFixture, titulo: 'Sessão sync fail', situacao: 0 }
    const fetchMock = setupFetch({
      studySessions: [session],
      studySessionDeleteResponse: { status: 204, data: null },
      studySessionListQueues: {
        '/api/sessoes-estudo': [
          { data: [session] }, // 1. carga inicial
          { error: new TypeError('Failed to fetch') }, // 2. refresh falha
          { data: [] }, // 3. retry sucesso
        ],
      },
    })
    renderApp()

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão sync fail')

    // Excluir via card
    const deleteButton = screen.getByRole('button', { name: 'Excluir' })
    fireEvent.click(deleteButton)

    // DELETE chamado uma vez
    await waitFor(() => expect(fetchMock.getStudySessionDeleteRequests()).toBe(1))

    // Erro de sincronização
    expect(await screen.findByText(/A exclusão foi confirmada, mas a lista não pôde ser atualizada/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument()

    // Tentar novamente
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))

    // Sessão removida e DELETE NÃO duplicado
    await screen.findByText('Nenhuma sessão de estudo encontrada')
    expect(fetchMock.getStudySessionDeleteRequests()).toBe(1)
  })

  // testes de regressão

  it('modal permanece aberto quando exclusão confirmada mas atualização da lista falha (reconcileDelete)', async () => {
    // Teste: DELETE bem-sucedido (204), mas falha ao atualizar a lista (refresh) no modal
    const session = { ...studySessionFixture, id: 1, titulo: 'Sessão modal sync fail', situacao: 0 }
    const fetchMock = setupFetch({
      studySessions: [session],
      studySessionDetailsQueues: {
        '1': [
          { status: 200, data: session }, // 1. carga inicial do modal
          { status: 404, data: { detail: 'Sessão de estudo não encontrada.' } }, // 2. reconciliação GET individual - sessão excluída
        ],
      },
      studySessionDeleteResponse: { status: 204, data: null },
      studySessionListQueues: {
        '/api/sessoes-estudo': [
          { data: [session] }, // 1. carga inicial
          { error: new TypeError('Failed to fetch') }, // 2. refresh falha na reconciliação
          { data: [] }, // 3. retry sucesso
        ],
      },
    })
    renderApp()

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão modal sync fail')

    // Abrir modal
    fireEvent.click(screen.getByRole('button', { name: /Ver detalhes/ }))
    await screen.findByRole('heading', { name: 'Sessão modal sync fail' })

    // Excluir no modal - DELETE sucesso, mas refresh falha
    const deleteButtonModal = screen.getByRole('button', { name: 'Excluir sessão' })
    fireEvent.click(deleteButtonModal)

    // DELETE chamado uma vez
    await waitFor(() => expect(fetchMock.getStudySessionDeleteRequests()).toBe(1))

    // Modal deve permanecer aberto (não fechar prematuramente)
    // E mostrar mensagem de sincronização falhou no transitionError
    await screen.findByText(/A exclusão foi confirmada, mas a lista não pôde ser atualizada. Failed to fetch/)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    // Clicar em atualizar - segunda chamada GET deve ter sucesso
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar lista de sessões' }))

    // Modal fecha após sincronização bem-sucedida
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(fetchMock.getStudySessionDeleteRequests()).toBe(1)
  })

  it('MutationSyncError desabilita novo DELETE no card e oferece apenas atualização da lista', async () => {
    const session = { ...studySessionFixture, titulo: 'Sessão mutation sync', situacao: 0 }
    const fetchMock = setupFetch({
      studySessions: [session],
      studySessionDeleteResponse: { status: 204, data: null },
      studySessionListQueues: {
        '/api/sessoes-estudo': [
          { data: [session] }, // 1. carga inicial
          { error: new TypeError('Failed to fetch') }, // 2. refresh falha
        ],
      },
    })
    renderApp()

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão mutation sync')

    // Excluir via card - DELETE sucesso, refresh falha
    const deleteButton = screen.getByRole('button', { name: 'Excluir' })
    fireEvent.click(deleteButton)

    // DELETE chamado uma vez
    await waitFor(() => expect(fetchMock.getStudySessionDeleteRequests()).toBe(1))

    // Botão "Excluir" deve ser substituído por "Atualizar lista de sessões"
    expect(screen.queryByRole('button', { name: 'Excluir' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Atualizar lista de sessões' })).toBeInTheDocument()
    expect(await screen.findByText(/A exclusão foi confirmada, mas a lista não pôde ser atualizada/)).toBeInTheDocument()

    // Clicar em atualizar
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar lista de sessões' }))
    await screen.findByText('Nenhuma sessão de estudo encontrada')

    // DELETE NÃO duplicado
    expect(fetchMock.getStudySessionDeleteRequests()).toBe(1)
  })

  it('DELETE 404 no card dispara reconciliação automática e atualiza listagem', async () => {
    const session = { ...studySessionFixture, titulo: 'Sessão 404 card', situacao: 0 }
    const fetchMock = setupFetch({
      studySessions: [session],
      studySessionDeleteResponse: { status: 404, data: { detail: 'Sessão de estudo não encontrada.' } },
      studySessionListQueues: {
        '/api/sessoes-estudo': [
          { data: [session] }, // 1. carga inicial
          { data: [] }, // 2. refresh após reconciliação
        ],
      },
    })
    renderApp()

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão 404 card')

    // Excluir via card - DELETE 404
    const deleteButton = screen.getByRole('button', { name: 'Excluir' })
    fireEvent.click(deleteButton)

    // DELETE chamado uma vez
    await waitFor(() => expect(fetchMock.getStudySessionDeleteRequests()).toBe(1))

    // Reconciliação automática remove a sessão da lista
    await screen.findByText('Nenhuma sessão de estudo encontrada')
    expect(screen.queryByText('Sessão 404 card')).not.toBeInTheDocument()

    // DELETE NÃO duplicado
    expect(fetchMock.getStudySessionDeleteRequests()).toBe(1)
  })

  it('DELETE 404 no card com falha na atualização da lista marca sync failed', async () => {
    const session = { ...studySessionFixture, titulo: 'Sessão 404 sync fail', situacao: 0 }
    const fetchMock = setupFetch({
      studySessions: [session],
      studySessionDeleteResponse: { status: 404, data: { detail: 'Sessão de estudo não encontrada.' } },
      studySessionListQueues: {
        '/api/sessoes-estudo': [
          { data: [session] }, // 1. carga inicial
          { error: new TypeError('Failed to fetch') }, // 2. refresh falha
          { data: [] }, // 3. retry sucesso
        ],
      },
    })
    renderApp()

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão 404 sync fail')

    // Excluir via card - DELETE 404
    const deleteButton = screen.getByRole('button', { name: 'Excluir' })
    fireEvent.click(deleteButton)

    // DELETE chamado uma vez
    await waitFor(() => expect(fetchMock.getStudySessionDeleteRequests()).toBe(1))

    // Botão "Excluir" substituído por "Atualizar lista de sessões"
    expect(screen.queryByRole('button', { name: 'Excluir' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Atualizar lista de sessões' })).toBeInTheDocument()
    expect(await screen.findByText(/A sessão foi excluída, mas a lista não pôde ser atualizada/)).toBeInTheDocument()

    // Clicar em atualizar
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar lista de sessões' }))
    await screen.findByText('Nenhuma sessão de estudo encontrada')

    // DELETE NÃO duplicado
    expect(fetchMock.getStudySessionDeleteRequests()).toBe(1)
  })

  it('resultado incerto registrado no card é refletido imediatamente no modal sem fechá-lo', async () => {
    const session = { ...studySessionFixture, titulo: 'Sessão incerteza cross', situacao: 0 }
    const fetchMock = setupFetch({
      studySessions: [session],
      studySessionDetails: { 1: session },
      studySessionDeleteNetworkFailures: 1, // Falha de rede no DELETE
    })
    renderApp()

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão incerteza cross')

    // Abrir modal primeiro
    fireEvent.click(screen.getByRole('button', { name: /Ver detalhes/ }))
    await screen.findByRole('heading', { name: 'Sessão incerteza cross' })
    // Verificar que botão Excluir sessão está habilitado inicialmente
    expect(screen.getByRole('button', { name: 'Excluir sessão' })).not.toBeDisabled()

    // Fechar modal
    const closeButtons = screen.getAllByRole('button', { name: 'Fechar' })
    fireEvent.click(closeButtons[0])
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    // Excluir via card - falha de rede
    const deleteButton = screen.getByRole('button', { name: 'Excluir' })
    fireEvent.click(deleteButton)

    await waitFor(() => expect(fetchMock.getStudySessionDeleteRequests()).toBe(1))

    // Reabrir modal - incerteza deve estar refletida imediatamente
    fireEvent.click(screen.getByRole('button', { name: /Ver detalhes/ }))
    await screen.findByRole('heading', { name: 'Sessão incerteza cross' })

    // Botão Excluir sessão deve estar desabilitado (isDeleteUncertain)
    expect(screen.getByRole('button', { name: 'Excluir sessão' })).toBeDisabled()
    expect(screen.getByText(/resultado da exclusão é incerto/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Consultar sessão antes de tentar novamente' })).toBeInTheDocument()
  })

  it('reconciliação bem-sucedida no modal libera bloqueios apropriados', async () => {
    const session = { ...studySessionFixture, id: 1, titulo: 'Sessão reconciliação sucesso', situacao: 0 }
    const reconciled = { ...session, situacao: 1 } // Sessão ainda existe mas mudou para Em andamento
    const fetchMock = setupFetch({
      studySessions: [session],
      studySessionDetailsQueues: {
        '1': [
          { status: 200, data: { ...session } }, // 1. carga inicial do modal
          { status: 200, data: reconciled }, // 2. reconciliação - 200 sessão existe com estado diferente
        ],
      },
      studySessionListQueues: {
        '/api/sessoes-estudo': [
          { data: [session] }, // 1. carga inicial
          { data: [reconciled] }, // 2. refresh após reconciliação
        ],
      },
      studySessionDeleteNetworkFailures: 1, // Simula falha de rede para forçar incerteza
    })
    renderApp()

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão reconciliação sucesso')

    // Abrir modal
    fireEvent.click(screen.getByRole('button', { name: /Ver detalhes/ }))
    await screen.findByRole('heading', { name: 'Sessão reconciliação sucesso' })

    // Tentar excluir - falha de rede
    const deleteButtonModal = screen.getByRole('button', { name: 'Excluir sessão' })
    fireEvent.click(deleteButtonModal)

    // Mensagem de incerteza aparece
    await screen.findByText(/resultado da exclusão é incerto/)
    expect(screen.getByRole('button', { name: 'Excluir sessão' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Consultar sessão antes de tentar novamente' })).toBeInTheDocument()

    // Reconciliação via botão - GET individual retorna 200 com sessão atualizada
    fireEvent.click(screen.getByRole('button', { name: 'Consultar sessão antes de tentar novamente' }))

    // Sessão ainda existe mas mudou para Em andamento
    const modal = screen.getByRole('dialog', { name: /Sessão reconciliação sucesso/i })
    await findByText(modal, 'Em andamento')
    // Mensagem de incerteza desaparece
    expect(screen.queryByText(/resultado da exclusão é incerto/)).not.toBeInTheDocument()
    // Botão Excluir sessão não deve mais existir (situacao !== 0)
    expect(screen.queryByRole('button', { name: 'Excluir sessão' })).not.toBeInTheDocument()
    // Botão de transição seguinte (Concluir sessão) fica habilitado
    expect(screen.getByRole('button', { name: 'Concluir sessão' })).not.toBeDisabled()

    // DELETE NÃO repetido
    expect(fetchMock.getStudySessionDeleteRequests()).toBe(1)
  })

  it('falhas durante reconciliação no modal não liberam bloqueios indevidamente', async () => {
    const session = { ...studySessionFixture, id: 1, titulo: 'Sessão falha reconciliação', situacao: 0 }
    const fetchMock = setupFetch({
      studySessions: [session],
      studySessionDetailsQueues: {
        '1': [
          { status: 200, data: { ...session } }, // 1. carga inicial do modal
          { error: new TypeError('Failed to fetch') }, // 2. reconciliação falha de rede
        ],
      },
      studySessionDeleteNetworkFailures: 1,
    })
    renderApp()

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão falha reconciliação')

    // Abrir modal
    fireEvent.click(screen.getByRole('button', { name: /Ver detalhes/ }))
    await screen.findByRole('heading', { name: 'Sessão falha reconciliação' })

    // Tentar excluir - falha de rede
    const deleteButtonModal = screen.getByRole('button', { name: 'Excluir sessão' })
    fireEvent.click(deleteButtonModal)

    // Mensagem de incerteza
    await screen.findByText(/resultado da exclusão é incerto/)

    // Tentar reconciliação via modal - falha de rede
    fireEvent.click(screen.getByRole('button', { name: 'Consultar sessão antes de tentar novamente' }))

    // Aguardar a reconciliação falhar (o botão volta ao estado anterior após falha)
    await screen.findByText(/resultado da exclusão é incerto/)

    // Bloqueio deve persistir
    expect(screen.getByRole('button', { name: 'Excluir sessão' })).toBeDisabled()
    expect(screen.getByText(/resultado da exclusão é incerto/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Consultar sessão antes de tentar novamente' })).toBeInTheDocument()
  })

  // Testes de regressão para correção do estado de sincronização

  it('GET individual 200: sessão continua existindo e interface não informa exclusão confirmada', async () => {
    const session = { ...studySessionFixture, id: 1, titulo: 'Sessão existe', situacao: 0 }
    const reconciled = { ...session, situacao: 1 } // Sessão mudou para Em andamento
    const fetchMock = setupFetch({
      studySessions: [session],
      studySessionDetailsQueues: {
        '1': [
          { status: 200, data: { ...session } }, // 1. carga inicial do modal
          { status: 200, data: reconciled }, // 2. reconciliação - GET 200, sessão existe
        ],
      },
      studySessionListQueues: {
        '/api/sessoes-estudo': [
          { data: [session] }, // 1. carga inicial
          { data: [reconciled] }, // 2. refresh após reconciliação
        ],
      },
      studySessionDeleteNetworkFailures: 1, // Força incerteza inicial
    })
    renderApp()

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão existe')

    // Abrir modal
    fireEvent.click(screen.getByRole('button', { name: /Ver detalhes/ }))
    await screen.findByRole('heading', { name: 'Sessão existe' })

    // Tentar excluir - falha de rede
    const deleteButtonModal = screen.getByRole('button', { name: 'Excluir sessão' })
    fireEvent.click(deleteButtonModal)

    // Mensagem de incerteza aparece
    await screen.findByText(/resultado da exclusão é incerto/)
    expect(screen.getByRole('button', { name: 'Excluir sessão' })).toBeDisabled()

    // Reconciliação via botão - GET individual retorna 200 com sessão atualizada
    fireEvent.click(screen.getByRole('button', { name: 'Consultar sessão antes de tentar novamente' }))

    // Sessão existe mas mudou para Em andamento
    const modal = screen.getByRole('dialog', { name: /Sessão existe/i })
    await findByText(modal, 'Em andamento')
    // Mensagem NÃO deve dizer "exclusão confirmada"
    expect(screen.queryByText(/exclusão foi confirmada/)).not.toBeInTheDocument()
    // Mensagem de incerteza desaparece
    expect(screen.queryByText(/resultado da exclusão é incerto/)).not.toBeInTheDocument()
    // Botão Excluir sessão não deve mais existir (situacao !== 0)
    expect(screen.queryByRole('button', { name: 'Excluir sessão' })).not.toBeInTheDocument()
    // Botão de transição seguinte (Concluir sessão) fica habilitado
    expect(screen.getByRole('button', { name: 'Concluir sessão' })).not.toBeDisabled()

    // DELETE NÃO repetido
    expect(fetchMock.getStudySessionDeleteRequests()).toBe(1)
  })

  it('GET individual 200 com falha na atualização da lista: mensagem corresponde à situação real', async () => {
    const session = { ...studySessionFixture, id: 1, titulo: 'Sessão falha lista', situacao: 0 }
    const reconciled = { ...session, situacao: 1 }
    const fetchMock = setupFetch({
      studySessions: [session],
      studySessionDetailsQueues: {
        '1': [
          { status: 200, data: { ...session } }, // 1. carga inicial do modal
          { status: 200, data: reconciled }, // 2. reconciliação - GET 200, sessão existe
        ],
      },
      studySessionListQueues: {
        '/api/sessoes-estudo': [
          { data: [session] }, // 1. carga inicial
          { error: new TypeError('Failed to fetch') }, // 2. refresh falha
          { data: [reconciled] }, // 3. retry sucesso
        ],
      },
      studySessionDeleteNetworkFailures: 1,
    })
    renderApp()

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão falha lista')

    // Abrir modal
    fireEvent.click(screen.getByRole('button', { name: /Ver detalhes/ }))
    await screen.findByRole('heading', { name: 'Sessão falha lista' })

    // Tentar excluir - falha de rede
    const deleteButtonModal = screen.getByRole('button', { name: 'Excluir sessão' })
    fireEvent.click(deleteButtonModal)

    await screen.findByText(/resultado da exclusão é incerto/)

    // Reconciliação - GET individual 200, mas refresh falha
    fireEvent.click(screen.getByRole('button', { name: 'Consultar sessão antes de tentar novamente' }))

    // Deve mostrar que a sessão ainda existe, mas a lista não atualizou
    await screen.findByText(/A sessão ainda existe, mas a lista não pôde ser atualizada/)
    expect(screen.queryByText(/exclusão foi confirmada/)).not.toBeInTheDocument()

    // Tentar novamente - segunda atualização deve ter sucesso
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar lista de sessões' }))
    await findByText(screen.getByRole('dialog', { name: /Sessão falha lista/i }), 'Em andamento')
    expect(screen.queryByText(/A sessão ainda existe, mas a lista não pôde ser atualizada/)).not.toBeInTheDocument()
  })

  it('enquanto deleteSyncFailed ativo, iniciar e cancelar estão desabilitados no card', async () => {
    const session = { ...studySessionFixture, titulo: 'Sessão sync failed', situacao: 0 }
    const fetchMock = setupFetch({
      studySessions: [session],
      studySessionDeleteResponse: { status: 204, data: null },
      studySessionListQueues: {
        '/api/sessoes-estudo': [
          { data: [session] }, // 1. carga inicial
          { error: new TypeError('Failed to fetch') }, // 2. refresh falha
        ],
      },
    })
    renderApp()

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão sync failed')

    // Excluir via card - DELETE sucesso, refresh falha
    const deleteButton = screen.getByRole('button', { name: 'Excluir' })
    fireEvent.click(deleteButton)

    await waitFor(() => expect(fetchMock.getStudySessionDeleteRequests()).toBe(1))

    // Botão "Excluir" substituído por "Atualizar lista de sessões"
    expect(screen.getByRole('button', { name: 'Atualizar lista de sessões' })).toBeInTheDocument()

    // Botões "Iniciar" e "Cancelar" devem estar desabilitados
    expect(screen.getByRole('button', { name: 'Iniciar' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()
  })

  it('após reconciliação bem-sucedida, operações voltam a funcionar', async () => {
    const session = { ...studySessionFixture, titulo: 'Sessão reconciliação ok', situacao: 0 }
    const fetchMock = setupFetch({
      studySessions: [session],
      studySessionDeleteResponse: { status: 204, data: null },
      studySessionListQueues: {
        '/api/sessoes-estudo': [
          { data: [session] }, // 1. carga inicial
          { error: new TypeError('Failed to fetch') }, // 2. refresh falha
          { data: [] }, // 3. retry sucesso - sessão removida
        ],
      },
    })
    renderApp()

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão reconciliação ok')

    // Excluir via card - DELETE sucesso, refresh falha
    const deleteButton = screen.getByRole('button', { name: 'Excluir' })
    fireEvent.click(deleteButton)

    await waitFor(() => expect(fetchMock.getStudySessionDeleteRequests()).toBe(1))

    // Botão "Excluir" substituído, iniciar/cancelar desabilitados
    expect(screen.getByRole('button', { name: 'Atualizar lista de sessões' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Iniciar' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()

    // Clicar em atualizar - lista sincroniza com sucesso
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar lista de sessões' }))
    await screen.findByText('Nenhuma sessão de estudo encontrada')

    // DELETE NÃO duplicado
    expect(fetchMock.getStudySessionDeleteRequests()).toBe(1)
  })

  // Testes de regressão: exclusões simultâneas e falha real de rede

  it('exclusões simultâneas no painel mantêm estados isolados por sessão', async () => {
    let rejectSession1
    let resolveSession2

    const promise1 = new Promise((_, rej) => { rejectSession1 = rej })
    const promise2 = new Promise((res) => { resolveSession2 = res })

    const onDeleteMock = vi.fn((id) => {
      if (id === 1) return promise1
      if (id === 2) return promise2
      return Promise.resolve()
    })

    const onReconcileMock = vi.fn().mockResolvedValue()

    const session1 = { ...studySessionFixture, id: 1, titulo: 'Sessão 1 Concorrente', situacao: 0 }
    const session2 = { ...studySessionFixture, id: 2, titulo: 'Sessão 2 Concorrente', situacao: 0 }

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(
      <StudySessionsPanel
        state={{ status: 'success', data: [session1, session2], error: null }}
        onRetry={vi.fn()}
        demands={[]}
        onLoadTasks={vi.fn().mockResolvedValue([])}
        onCreate={vi.fn()}
        onReconcile={onReconcileMock}
        creationOutcomeUnknown={false}
        onCreationOutcomeUnknownChange={vi.fn()}
        onUpdate={vi.fn()}
        onReconcileEdit={vi.fn()}
        onEditOutcomeUnknownChange={vi.fn()}
        onTransition={vi.fn()}
        onDelete={onDeleteMock}
        isTransitioning={false}
        isUncertain={() => false}
        isDeleteUncertain={() => false}
      />
    )

    const cards = screen.getAllByRole('article')
    const card1 = cards.find((c) => within(c).queryByText('Sessão 1 Concorrente'))
    const card2 = cards.find((c) => within(c).queryByText('Sessão 2 Concorrente'))

    const deleteBtn1 = within(card1).getByRole('button', { name: 'Excluir' })
    const deleteBtn2 = within(card2).getByRole('button', { name: 'Excluir' })

    // Inicia exclusão da sessão 1
    fireEvent.click(deleteBtn1)
    expect(onDeleteMock).toHaveBeenCalledWith(1)

    // Inicia exclusão da sessão 2 simultaneamente
    fireEvent.click(deleteBtn2)
    expect(onDeleteMock).toHaveBeenCalledWith(2)

    // Ambas estão em andamento com indicador individual
    expect(within(card1).getByRole('button', { name: 'Excluindo…' })).toBeDisabled()
    expect(within(card2).getByRole('button', { name: 'Excluindo…' })).toBeDisabled()

    // Falha na sessão 1
    rejectSession1(new Error('Falha de rede na sessão 1'))
    await waitFor(() => {
      expect(within(card1).getByText('Falha de rede na sessão 1')).toBeInTheDocument()
    })

    // Sessão 2 continua em andamento e NÃO foi afetada pelo erro da sessão 1
    expect(within(card2).queryByText('Falha de rede na sessão 1')).not.toBeInTheDocument()
    expect(within(card2).getByRole('button', { name: 'Excluindo…' })).toBeDisabled()

    // Conclusão com sucesso da sessão 2
    resolveSession2()
    await waitFor(() => {
      expect(within(card2).getByRole('button', { name: 'Excluir' })).toBeInTheDocument()
    })

    // O aviso de erro da sessão 1 continua visível e isolado apenas em sua sessão
    expect(within(card1).getByText('Falha de rede na sessão 1')).toBeInTheDocument()
    expect(within(card2).queryByText('Falha de rede na sessão 1')).not.toBeInTheDocument()
  })

  it('falha de sincronização em uma sessão não interfere no estado da outra sessão', async () => {
    const session1 = { ...studySessionFixture, id: 1, titulo: 'Sessão 1 Sync Fail', situacao: 0 }
    const session2 = { ...studySessionFixture, id: 2, titulo: 'Sessão 2 Sucesso', situacao: 0 }

    const fetchMock = setupFetch({
      studySessions: [session1, session2],
      studySessionListQueues: {
        '/api/sessoes-estudo': [
          { data: [session1, session2] }, // carga inicial
          { error: new TypeError('Failed to fetch') }, // refresh após delete de session1 falha
          { data: [session1] }, // refresh após delete de session2 sucesso
        ],
      },
    })

    renderApp()
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão 1 Sync Fail')
    await screen.findByText('Sessão 2 Sucesso')

    const cards = screen.getAllByRole('article')
    const card1 = cards.find((c) => within(c).queryByText('Sessão 1 Sync Fail'))
    const card2 = cards.find((c) => within(c).queryByText('Sessão 2 Sucesso'))

    // Exclui sessão 1 (DELETE 204, mas refresh falha)
    fireEvent.click(within(card1).getByRole('button', { name: 'Excluir' }))
    await waitFor(() => expect(fetchMock.getStudySessionDeleteRequests()).toBe(1))

    // Sessão 1 mostra botão de atualização de sync
    await waitFor(() => {
      expect(within(card1).getByRole('button', { name: 'Atualizar lista de sessões' })).toBeInTheDocument()
    })
    // Aviso de falha na sincronização exibido na sessão 1
    expect(within(card1).getByText(/A exclusão foi confirmada, mas a lista não pôde ser atualizada/)).toBeInTheDocument()

    // Sessão 2 continua com seu próprio estado e NÃO exibe o aviso da sessão 1
    expect(within(card2).queryByText(/A exclusão foi confirmada, mas a lista não pôde ser atualizada/)).not.toBeInTheDocument()
    expect(within(card2).getByRole('button', { name: 'Excluir' })).toBeInTheDocument()
    expect(within(card2).queryByRole('button', { name: 'Atualizar lista de sessões' })).not.toBeInTheDocument()

    // Exclui sessão 2 com sucesso
    fireEvent.click(within(card2).getByRole('button', { name: 'Excluir' }))
    await waitFor(() => expect(fetchMock.getStudySessionDeleteRequests()).toBe(2))

    // Sessão 2 foi excluída, e sessão 1 continua mantendo seu estado de sync failed isoladamente
    await waitFor(() => {
      expect(screen.queryByText('Sessão 2 Sucesso')).not.toBeInTheDocument()
    })
    expect(screen.getByText('Sessão 1 Sync Fail')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Atualizar lista de sessões' })).toBeInTheDocument()
  })

  it('falha real de rede (throw new Error) não interpreta como excluída, preserva incerteza e permite reconciliação', async () => {
    const session = { ...studySessionFixture, id: 1, titulo: 'Sessão Falha Real Rede', situacao: 0 }

    const fetchMock = setupFetch({
      studySessions: [session],
      studySessionDeleteResponses: {
        1: { error: new Error('Network error') },
      },
      studySessionDetailsQueues: {
        '1': [
          { status: 200, data: session }, // 1. carga inicial do modal
          { status: 404, data: { detail: 'Sessão de estudo não encontrada.' } }, // 2. reconciliação bem-sucedida (404)
        ],
      },
      studySessionListQueues: {
        '/api/sessoes-estudo': [
          { data: [session] }, // 1. carga inicial
          { data: [] }, // 2. refresh após reconciliação
        ],
      },
    })

    renderApp()
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão Falha Real Rede')

    // Abrir modal de detalhes
    fireEvent.click(screen.getByRole('button', { name: /Ver detalhes/ }))
    await screen.findByRole('heading', { name: 'Sessão Falha Real Rede' })

    // Tentar exclusão - fetch lança new Error("Network error")
    const deleteButtonModal = screen.getByRole('button', { name: 'Excluir sessão' })
    fireEvent.click(deleteButtonModal)

    // Interface não deve interpretar como exclusão confirmada
    expect(screen.queryByText(/A exclusão foi confirmada/)).not.toBeInTheDocument()

    // Preserva estado de incerteza
    await screen.findByText(/resultado da exclusão é incerto/i)
    expect(screen.getByRole('button', { name: 'Excluir sessão' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Iniciar sessão' })).toBeDisabled()

    // Botão de reconciliação disponível
    const reconcileBtn = screen.getByRole('button', { name: 'Consultar sessão antes de tentar novamente' })
    expect(reconcileBtn).toBeInTheDocument()

    // Tentar reconciliação - GET 404 confirma exclusão e fecha modal
    fireEvent.click(reconcileBtn)

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    // Lista atualizada sem a sessão
    await screen.findByText('Nenhuma sessão de estudo encontrada')

    // Não houve segundo DELETE
    expect(fetchMock.getStudySessionDeleteRequests()).toBe(1)
  })
})
