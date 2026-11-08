import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderApp } from '../helpers/renderApp.jsx'
import { setupFetch, studySessionFixture } from '../helpers/fetchMocks.js'
import { clearAllUncertainTransitions } from '../../../src/CadernoAtlas.Web/src/features/study-sessions/useStudySessionUncertainTransitions'
import { clearAllUncertainDeletions } from '../../../src/CadernoAtlas.Web/src/features/study-sessions/useStudySessionUncertainDeletions'

describe('Sessões de estudo — Listagem', () => {
  beforeEach(() => {
    clearAllUncertainTransitions()
    clearAllUncertainDeletions()
  })

  it('carrega e lista as sessões com as 4 situações e exibe os respectivos rótulos', async () => {
    setupFetch({
      studySessions: [
        { id: 1, titulo: 'Sessão Planejada', dataPlanejada: '2026-11-10', horaInicioPlanejada: '14:00:00', duracaoPlanejadaMinutos: 90, duracaoRealMinutos: null, situacao: 0, demandaAcademicaId: 1, tarefaDemandaId: null },
        { id: 2, titulo: 'Sessão Em Andamento', dataPlanejada: '2026-11-11', horaInicioPlanejada: '10:00:00', duracaoPlanejadaMinutos: 60, duracaoRealMinutos: null, situacao: 1, demandaAcademicaId: null, tarefaDemandaId: null },
        { id: 3, titulo: 'Sessão Concluída', dataPlanejada: '2026-11-12', horaInicioPlanejada: '10:00:00', duracaoPlanejadaMinutos: 60, duracaoRealMinutos: 55, situacao: 2, demandaAcademicaId: null, tarefaDemandaId: 3 },
        { id: 4, titulo: 'Sessão Cancelada', dataPlanejada: '2026-11-13', horaInicioPlanejada: '16:00:00', duracaoPlanejadaMinutos: 45, duracaoRealMinutos: null, situacao: 3, demandaAcademicaId: null, tarefaDemandaId: null },
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
    setupFetch({ studySessions: [] })
    renderApp()

    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))

    expect(await screen.findByRole('heading', { name: 'Sessões de estudo', level: 2 })).toBeInTheDocument()
    expect(await screen.findByText('Nenhuma sessão de estudo encontrada')).toBeInTheDocument()
    expect(screen.getByText('As sessões de estudo aparecerão aqui quando forem cadastradas.')).toBeInTheDocument()
  })

  it('filtra as sessões por situação (0, 1, 2, 3) e por intervalo de datas', async () => {
    setupFetch({
      studySessions: [
        { id: 1, titulo: 'Sessão 1 Planejada', dataPlanejada: '2026-11-10', horaInicioPlanejada: '09:00:00', duracaoPlanejadaMinutos: 60, duracaoRealMinutos: null, situacao: 0, demandaAcademicaId: null, tarefaDemandaId: null },
        { id: 2, titulo: 'Sessão 2 Em Andamento', dataPlanejada: '2026-11-12', horaInicioPlanejada: '11:00:00', duracaoPlanejadaMinutos: 60, duracaoRealMinutos: null, situacao: 1, demandaAcademicaId: null, tarefaDemandaId: null },
        { id: 3, titulo: 'Sessão 3 Concluída', dataPlanejada: '2026-11-15', horaInicioPlanejada: '14:00:00', duracaoPlanejadaMinutos: 90, duracaoRealMinutos: 80, situacao: 2, demandaAcademicaId: null, tarefaDemandaId: null },
        { id: 4, titulo: 'Sessão 4 Cancelada', dataPlanejada: '2026-11-20', horaInicioPlanejada: '16:00:00', duracaoPlanejadaMinutos: 45, duracaoRealMinutos: null, situacao: 3, demandaAcademicaId: null, tarefaDemandaId: null },
      ],
    })
    renderApp()

    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    expect(await screen.findByText('Sessão 1 Planejada')).toBeInTheDocument()

    const situacaoSelect = screen.getByLabelText('Filtrar sessões por situação')

    fireEvent.change(situacaoSelect, { target: { value: 'Planejada' } })
    expect(screen.getByText('Sessão 1 Planejada')).toBeInTheDocument()
    expect(screen.queryByText('Sessão 2 Em Andamento')).not.toBeInTheDocument()

    fireEvent.change(situacaoSelect, { target: { value: 'EmAndamento' } })
    expect(screen.queryByText('Sessão 1 Planejada')).not.toBeInTheDocument()
    expect(screen.getByText('Sessão 2 Em Andamento')).toBeInTheDocument()

    fireEvent.change(situacaoSelect, { target: { value: 'Concluida' } })
    expect(screen.getByText('Sessão 3 Concluída')).toBeInTheDocument()

    fireEvent.change(situacaoSelect, { target: { value: 'Cancelada' } })
    expect(screen.getByText('Sessão 4 Cancelada')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }))
    expect(screen.getByText('Sessão 1 Planejada')).toBeInTheDocument()
    expect(screen.getByText('Sessão 2 Em Andamento')).toBeInTheDocument()
    expect(screen.getByText('Sessão 3 Concluída')).toBeInTheDocument()
    expect(screen.getByText('Sessão 4 Cancelada')).toBeInTheDocument()

    const dataDeInput = screen.getByLabelText('Filtrar por data inicial')
    fireEvent.change(dataDeInput, { target: { value: '2026-11-12' } })
    expect(screen.queryByText('Sessão 1 Planejada')).not.toBeInTheDocument()
    expect(screen.getByText('Sessão 2 Em Andamento')).toBeInTheDocument()

    const dataAteInput = screen.getByLabelText('Filtrar por data final')
    fireEvent.change(dataAteInput, { target: { value: '2026-11-16' } })
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
    const sessionInProgress = {
      id: 2,
      titulo: 'Estudo Ativo de Fisiologia',
      dataPlanejada: '2026-11-10',
      horaInicioPlanejada: '15:30:00',
      duracaoPlanejadaMinutos: 120,
      duracaoRealMinutos: 60,
      situacao: 1,
      demandaAcademicaId: 2,
      tarefaDemandaId: null,
      observacoes: 'Foco no sistema cardiovascular',
      criadoEm: '2026-11-01T10:00:00Z',
      inicioRealEm: '2026-11-10T15:30:00Z',
      concluidaEm: null,
      canceladaEm: null,
    }

    setupFetch({
      studySessions: [sessionInProgress],
      studySessionDetails: { 2: sessionInProgress },
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

    const closeButtons = within(modal).getAllByRole('button', { name: 'Fechar' })
    fireEvent.click(closeButtons[0])
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('renderiza com segurança quando a situação possui valor desconhecido', async () => {
    const unknownSession = {
      id: 99,
      titulo: 'Sessão com status desconhecido',
      dataPlanejada: '2026-11-10',
      horaInicioPlanejada: '10:00:00',
      duracaoPlanejadaMinutos: 60,
      duracaoRealMinutos: null,
      situacao: 99,
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
      studySessionDetails: { 99: unknownSession },
    })
    renderApp()

    fireEvent.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    expect(await screen.findByText('Sessão com status desconhecido')).toBeInTheDocument()

    const statusBadge = screen.getByText('Desconhecida', { selector: '.study-session-status' })
    expect(statusBadge).toHaveClass('study-session-status-desconhecida')

    const viewDetailsButton = screen.getByRole('button', { name: 'Ver detalhes da sessão Sessão com status desconhecido' })
    fireEvent.click(viewDetailsButton)

    const modal = await screen.findByRole('dialog')
    expect(await within(modal).findByRole('heading', { name: 'Sessão com status desconhecido' })).toBeInTheDocument()
    const modalStatus = within(modal).getByText('Desconhecida', { selector: '.study-session-status' })
    expect(modalStatus).toHaveClass('study-session-status-desconhecida')

    const closeButtons = within(modal).getAllByRole('button', { name: 'Fechar' })
    fireEvent.click(closeButtons[0])
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('trata adequadamente quando a sessão consultada não é encontrada (404)', async () => {
    setupFetch({
      studySessions: [
        { id: 999, titulo: 'Sessão que foi removida', dataPlanejada: '2026-11-10', horaInicioPlanejada: '10:00:00', duracaoPlanejadaMinutos: 60, duracaoRealMinutos: null, situacao: 0, demandaAcademicaId: null, tarefaDemandaId: null },
      ],
      studySessionDetails: { 999: { status: 404, data: { title: 'Sessão de estudo não encontrada.' } } },
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

    const closeButtons = within(modal).getAllByRole('button', { name: 'Fechar' })
    fireEvent.click(closeButtons[0])
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})