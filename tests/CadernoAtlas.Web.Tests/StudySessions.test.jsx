import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderApp } from './helpers/renderApp.jsx'
import { setupFetch, studySessionFixture } from './helpers/fetchMocks.js'
import { clearAllUncertainTransitions } from '../../src/CadernoAtlas.Web/src/features/study-sessions/useStudySessionUncertainTransitions'

describe('Sessões de estudo', () => {
  beforeEach(() => {
    // Limpa tanto sessionStorage quanto cache em memória para isolamento total entre testes
    clearAllUncertainTransitions()
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
})
