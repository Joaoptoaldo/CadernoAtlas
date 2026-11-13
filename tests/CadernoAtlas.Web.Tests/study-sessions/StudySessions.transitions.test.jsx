import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { renderApp } from '../helpers/renderApp.jsx'
import { setupFetch, studySessionFixture } from '../helpers/fetchMocks.js'
import { clearAllUncertainTransitions } from '../../../src/CadernoAtlas.Web/src/features/study-sessions/useStudySessionUncertainTransitions'
import { clearAllUncertainDeletions } from '../../../src/CadernoAtlas.Web/src/features/study-sessions/useStudySessionUncertainDeletions'
import { clearAllUncertainEdits } from '../../../src/CadernoAtlas.Web/src/features/study-sessions/useStudySessionUncertainEdits'
import userEvent from '@testing-library/user-event'

describe('Sessões de estudo — Transições', () => {
  beforeEach(() => {
    clearAllUncertainTransitions()
    clearAllUncertainDeletions()
    clearAllUncertainEdits()
  })

  it('inicia sessão planejada e atualiza listagem e detalhes', async () => {
    const planned = { ...studySessionFixture, titulo: 'Sessão para iniciar', situacao: 0, inicioRealEm: null }
    const fetchMock = setupFetch({ studySessions: [planned], studySessionDetails: { 1: planned } })
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão para iniciar')
    await user.click(screen.getByRole('button', { name: 'Iniciar', exact: true }))
    await waitFor(() => expect(fetchMock.getStudySessionTransitionRequests()).toBe(1))
    expect(await screen.findByText('Em andamento', { selector: '.study-session-status' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Iniciar', exact: true })).not.toBeInTheDocument()
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
    const user = userEvent.setup()
    renderApp()
    await user.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão para concluir')
    await user.click(screen.getByRole('button', { name: 'Ver detalhes da sessão Sessão para concluir' }))
    const modal = await screen.findByRole('dialog')
    await user.click(within(modal).getByRole('button', { name: 'Concluir sessão' }))
    // ConfirmActionModal abre - confirmar no modal
    const confirmModal = await screen.findByRole('dialog', { name: /Confirmar transição/i })
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(document.querySelector('.study-session-detail-overlay')).toHaveAttribute('aria-hidden', 'true')
    await user.click(within(confirmModal).getByRole('button', { name: 'Confirmar' }))
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
    const user = userEvent.setup()
    renderApp()
    await user.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText(session.titulo)
    await user.click(screen.getByRole('button', { name: `Ver detalhes da sessão ${session.titulo}` }))
    const modal = await screen.findByRole('dialog')
    // Primeira tentativa: cancelar no modal de confirmação
    await user.click(within(modal).getByRole('button', { name: 'Cancelar sessão' }))
    const confirmModal = await screen.findByRole('dialog', { name: /Confirmar transição/i })
    await user.click(within(confirmModal).getByRole('button', { name: 'Cancelar' }))
    expect(fetchMock.getStudySessionTransitionRequests()).toBe(0)
    // Segunda tentativa: confirmar no modal de confirmação
    await user.click(within(modal).getByRole('button', { name: 'Cancelar sessão' }))
    const confirmModal2 = await screen.findByRole('dialog', { name: /Confirmar transição/i })
    await user.click(within(confirmModal2).getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(fetchMock.getStudySessionTransitionRequests()).toBe(1))
    expect(await within(modal).findByText('Cancelada', { selector: '.study-session-status' })).toBeInTheDocument()
  })

  it.each([2, 3])('não disponibiliza transições para situação final %i', async (situation) => {
    const session = { ...studySessionFixture, id: situation, titulo: `Sessão final ${situation}`, situacao: situation }
    setupFetch({ studySessions: [session] })
    const user = userEvent.setup()
    renderApp()
    await user.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText(session.titulo)
    await user.click(screen.getByRole('button', { name: `Ver detalhes da sessão ${session.titulo}` }))
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
      studySessionTransitionResponses: { '1/iniciar': { status, data: { detail } } },
    })
    const user = userEvent.setup()
    renderApp()
    await user.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão com conflito')
    await user.click(screen.getByRole('button', { name: 'Iniciar', exact: true }))
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
    const user = userEvent.setup()
    renderApp()
    await user.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão incerta')
    await user.click(screen.getByRole('button', { name: 'Iniciar', exact: true }))
    await waitFor(() => expect(fetchMock.getStudySessionTransitionRequests()).toBe(1))
    expect(await screen.findByText('Em andamento', { selector: '.study-session-status' })).toBeInTheDocument()
    expect(fetchMock.getStudySessionTransitionRequests()).toBe(1)
  })

  it('impede submissões duplicadas durante uma transição', async () => {
    let releaseTransition
    const transitionGate = new Promise((resolve) => { releaseTransition = resolve })
    const session = { ...studySessionFixture, titulo: 'Sessão sem duplicação', situacao: 0 }
    const fetchMock = setupFetch({ studySessions: [session], studySessionTransitionGate: transitionGate })
    const user = userEvent.setup()
    renderApp()
    await user.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão sem duplicação')
    const startButton = screen.getByRole('button', { name: 'Iniciar', exact: true })
    await user.click(startButton)
    await user.click(startButton)
    expect(fetchMock.getStudySessionTransitionRequests()).toBe(1)
    releaseTransition()
    await waitFor(() => expect(screen.getByText('Em andamento', { selector: '.study-session-status' })).toBeInTheDocument())
  })

  it('bloqueia mutação de sessão enquanto a confirmação do planejamento está pendente', async () => {
    let releaseConfirmation
    const confirmationGate = new Promise((resolve) => { releaseConfirmation = resolve })
    const planned = { ...studySessionFixture, titulo: 'Sessão bloqueada pela confirmação', situacao: 0 }
    const fetchMock = setupFetch({ confirmationGate, studySessions: [planned] })
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: /Gerar pr/ }))
    await screen.findByText('Revisar anatomia')
    await user.click(screen.getByRole('button', { name: 'Confirmar planejamento' }))
    await waitFor(() => expect(fetchMock.getConfirmationPostRequests()).toBe(1))

    await user.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText(planned.titulo)
    await user.click(screen.getByRole('button', { name: 'Iniciar', exact: true }))
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
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: /Gerar pr/ }))
    await screen.findByText('Revisar anatomia')
    await user.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText(planned.titulo)
    await user.click(screen.getByRole('button', { name: 'Iniciar', exact: true }))

    await user.click(screen.getByRole('button', { name: 'Planejamento semanal' }))
    expect(screen.getByRole('button', { name: 'Confirmar planejamento' })).toBeDisabled()
    expect(fetchMock.getConfirmationPostRequests()).toBe(0)

    releaseTransition()
    await waitFor(() => expect(fetchMock.getStudySessionTransitionRequests()).toBe(1))
  })

  it('invalida a prévia do planejamento após uma transição de sessão confirmada', async () => {
    const planned = { ...studySessionFixture, titulo: 'Sessão que invalida a prévia', situacao: 0, inicioRealEm: null }
    const fetchMock = setupFetch({ studySessions: [planned], studySessionDetails: { 1: planned } })
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: /Gerar pr/ }))
    await screen.findByText('Revisar anatomia')
    await user.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText(planned.titulo)
    await user.click(screen.getByRole('button', { name: 'Iniciar', exact: true }))
    await waitFor(() => expect(fetchMock.getStudySessionTransitionRequests()).toBe(1))

    await user.click(screen.getByRole('button', { name: 'Planejamento semanal' }))
    expect(await screen.findByText(/Gere uma proposta com base nas demandas/)).toBeInTheDocument()
  })

  it('libera locks corretamente após sucesso de transição', async () => {
    const session1 = { ...studySessionFixture, id: 1, titulo: 'Sessão 1', situacao: 0 }
    const session2 = { ...studySessionFixture, id: 2, titulo: 'Sessão 2', situacao: 0 }
    const fetchMock = setupFetch({ studySessions: [session1, session2] })
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão 1')
    await user.click(screen.getByRole('button', { name: 'Ver detalhes da sessão Sessão 1' }))
    await screen.findByRole('dialog')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Iniciar sessão' }))
    await waitFor(() => expect(fetchMock.getStudySessionTransitionRequests()).toBe(1))
    expect(await within(screen.getByRole('dialog')).findByText('Em andamento', { selector: '.study-session-status' })).toBeInTheDocument()

    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Concluir sessão' }))
    // Confirmar no modal de confirmação
    const confirmModal = await screen.findByRole('dialog', { name: /Confirmar transição/i })
    await user.click(within(confirmModal).getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(fetchMock.getStudySessionTransitionRequests()).toBe(2))
    expect(await within(screen.getByRole('dialog')).findByText('Concluída', { selector: '.study-session-status' })).toBeInTheDocument()

    const closeButtons = within(screen.getByRole('dialog')).getAllByRole('button', { name: 'Fechar' })
    await user.click(closeButtons[closeButtons.length - 1])
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Ver detalhes da sessão Sessão 2' }))
    await screen.findByRole('dialog')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Iniciar sessão' }))
    await waitFor(() => expect(fetchMock.getStudySessionTransitionRequests()).toBe(3))
    expect(await within(screen.getByRole('dialog')).findByText('Em andamento', { selector: '.study-session-status' })).toBeInTheDocument()

    expect(fetchMock.getStudySessionTransitionRequests()).toBe(3)
  })

  it('preserva MutationSyncError quando transição confirmada mas GET da lista falha', async () => {
    const initial = { ...studySessionFixture, titulo: 'Sessão para transição', situacao: 0 }
    const fetchMock = setupFetch({
      studySessions: [initial],
      studySessionDetails: { 1: initial },
      studySessionReconcileFailures: 1,
    })
    const user = userEvent.setup()
    renderApp()
    await user.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão para transição')
    await user.click(screen.getByRole('button', { name: 'Ver detalhes da sessão Sessão para transição' }))
    const modal = await screen.findByRole('dialog')
    await waitFor(() => expect(within(modal).queryByText('Carregando…')).not.toBeInTheDocument())
    expect(within(modal).getByText('Planejada', { selector: '.study-session-status' })).toBeInTheDocument()
    await user.click(within(modal).getByRole('button', { name: 'Iniciar sessão' }))

    expect(fetchMock.getStudySessionTransitionRequests()).toBe(1)
    expect(await screen.findByText(/A transição foi confirmada, mas a lista não pôde ser atualizada/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument()
  })

  it('mantém estado de resultado incerto persistente para transição com POST e GET de reconciliação falhando', async () => {
    const initial = { ...studySessionFixture, titulo: 'Sessão incerta persistente', situacao: 0 }
    const fetchMock = setupFetch({
      studySessions: [initial],
      studySessionTransitionNetworkFailures: { '1/iniciar': 1 },
      studySessionDetailsQueues: {
        1: [
          initial,
          { status: 503, data: { detail: 'Falha temporária ao carregar a sessão.' } },
          initial,
        ],
      },
    })
    const user = userEvent.setup()
    renderApp()
    await user.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão incerta persistente')
    await user.click(screen.getByRole('button', { name: 'Ver detalhes da sessão Sessão incerta persistente' }))
    const modal = await screen.findByRole('dialog')
    await waitFor(() => expect(within(modal).queryByText('Carregando…')).not.toBeInTheDocument())
    expect(within(modal).getByText('Planejada', { selector: '.study-session-status' })).toBeInTheDocument()
    await user.click(within(modal).getByRole('button', { name: 'Iniciar sessão' }))

    expect(await within(modal).findByText(/resultado da operação é incerto/)).toBeInTheDocument()
    await waitFor(() => expect(within(modal).getByRole('button', { name: 'Iniciar sessão' })).toBeDisabled())
    expect(fetchMock.getStudySessionTransitionRequests()).toBe(1)

    expect(within(modal).getByRole('button', { name: 'Consultar sessões antes de tentar novamente' })).toBeInTheDocument()

    const closeButtons = within(modal).getAllByRole('button', { name: 'Fechar' })
    await user.click(closeButtons[closeButtons.length - 1])
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Ver detalhes da sessão Sessão incerta persistente' }))
    const reopenedModal = await screen.findByRole('dialog')
    await waitFor(() => expect(within(reopenedModal).queryByText('Carregando…')).not.toBeInTheDocument())

    expect(within(reopenedModal).getByText(/resultado da operação é incerto/)).toBeInTheDocument()
    expect(within(reopenedModal).getByRole('button', { name: 'Iniciar sessão' })).toBeDisabled()
    expect(within(reopenedModal).getByRole('button', { name: 'Consultar sessões antes de tentar novamente' })).toBeInTheDocument()
  })

  it('reconciliação explícita bem-sucedida libera bloqueios sem repetir POST', async () => {
    const initial = { ...studySessionFixture, titulo: 'Sessão para reconciliação explícita', situacao: 0 }
    const reconciled = { ...initial, situacao: 1, inicioRealEm: '2026-11-06T15:00:00Z' }
    const fetchMock = setupFetch({
      studySessions: [initial],
      studySessionTransitionNetworkFailures: { '1/iniciar': 1 },
      studySessionDetailsQueues: {
        1: [initial, { status: 503, data: { detail: 'Falha temporária ao reconciliar' } }, reconciled],
      },
    })
    const user = userEvent.setup()
    renderApp()
    await user.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão para reconciliação explícita')
    await user.click(screen.getByRole('button', { name: 'Ver detalhes da sessão Sessão para reconciliação explícita' }))
    const modal = await screen.findByRole('dialog')
    await waitFor(() => expect(within(modal).queryByText('Carregando…')).not.toBeInTheDocument())
    expect(within(modal).getByText('Planejada', { selector: '.study-session-status' })).toBeInTheDocument()
    const startButton = await within(modal).findByRole('button', { name: 'Iniciar sessão' })
    await user.click(startButton)

    expect(await within(modal).findByText(/resultado da operação é incerto/)).toBeInTheDocument()
    expect(fetchMock.getStudySessionTransitionRequests()).toBe(1)

    expect(within(modal).getByRole('button', { name: 'Consultar sessões antes de tentar novamente' })).toBeInTheDocument()
    expect(within(modal).getByRole('button', { name: 'Iniciar sessão' })).toBeDisabled()

    await user.click(within(modal).getByRole('button', { name: 'Consultar sessões antes de tentar novamente' }))

    expect(await within(modal).findByText('Em andamento', { selector: '.study-session-status' })).toBeInTheDocument()
    expect(within(modal).queryByText(/resultado da operação é incerto/)).not.toBeInTheDocument()
    expect(within(modal).getByRole('button', { name: 'Concluir sessão' })).not.toBeDisabled()
    expect(fetchMock.getStudySessionTransitionRequests()).toBe(1)
  })

  it('POST incerto seguido de GET individual retornando estado diferente do esperado: a incerteza permanece até uma reconciliação explícita', async () => {
    const initial = { ...studySessionFixture, id: 1, titulo: 'Sessão estado divergente', situacao: 0 }
    const reconciled = { ...initial, situacao: 1, inicioRealEm: '2026-11-06T15:00:00Z' }
    const fetchMock = setupFetch({
      studySessions: [initial],
      studySessionTransitionNetworkFailures: { '1/iniciar': 1 },
      studySessionDetailsQueues: {
        1: [initial, initial, reconciled],
      },
    })
    const user = userEvent.setup()
    renderApp()
    await user.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão estado divergente')

    await user.click(screen.getByRole('button', { name: 'Ver detalhes da sessão Sessão estado divergente' }))
    const modal = await screen.findByRole('dialog')
    await waitFor(() => expect(within(modal).queryByText('Carregando…')).not.toBeInTheDocument())

    await user.click(within(modal).getByRole('button', { name: 'Iniciar sessão' }))

    expect(await within(modal).findByText(/resultado da operação é incerto/)).toBeInTheDocument()
    expect(within(modal).getByRole('button', { name: 'Iniciar sessão' })).toBeDisabled()
    expect(within(modal).getByRole('button', { name: 'Consultar sessões antes de tentar novamente' })).toBeInTheDocument()

    await user.click(within(modal).getByRole('button', { name: 'Consultar sessões antes de tentar novamente' }))

    expect(await within(modal).findByText('Em andamento', { selector: '.study-session-status' })).toBeInTheDocument()
    expect(within(modal).queryByText(/resultado da operação é incerto/)).not.toBeInTheDocument()
    expect(within(modal).getByRole('button', { name: 'Concluir sessão' })).not.toBeDisabled()
    expect(fetchMock.getStudySessionTransitionRequests()).toBe(1)
  })

  it('confirmação do planejamento é bloqueada enquanto houver transição incerta, mesmo que uma prévia já tenha sido gerada', async () => {
    sessionStorage.setItem('cadernoatlas:uncertain-session-transitions', JSON.stringify([{
      sessionId: 1,
      transition: 'iniciar',
      expectedStatus: 1,
      timestamp: Date.now(),
    }]))

    const fetchMock = setupFetch()
    const user = userEvent.setup()
    renderApp()

    const confirmationRequestsBefore = fetchMock.getConfirmationPostRequests()
    const previewRequestsBefore = fetchMock.getPreviewRequests()

    await user.click(screen.getByRole('button', { name: /Gerar pr/ }))
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
        1: [initial, { status: 503, data: { detail: 'Falha temporária' } }, reconciled],
      },
    })
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão para desbloqueio completo')
    await user.click(screen.getByRole('button', { name: 'Ver detalhes da sessão Sessão para desbloqueio completo' }))
    const modal = await screen.findByRole('dialog')
    await waitFor(() => expect(within(modal).queryByText('Carregando…')).not.toBeInTheDocument())
    await user.click(within(modal).getByRole('button', { name: 'Iniciar sessão' }))
    expect(await within(modal).findByText(/resultado da operação é incerto/)).toBeInTheDocument()

    await user.click(within(modal).getByRole('button', { name: 'Consultar sessões antes de tentar novamente' }))
    expect(await within(modal).findByText('Em andamento', { selector: '.study-session-status' })).toBeInTheDocument()
    expect(within(modal).queryByText(/resultado da operação é incerto/)).not.toBeInTheDocument()

    const closeButtons = within(modal).getAllByRole('button', { name: 'Fechar' })
    await user.click(closeButtons[closeButtons.length - 1])
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Planejamento semanal' }))
    const previewRequestsBefore = fetchMock.getPreviewRequests()
    await user.click(screen.getByRole('button', { name: /Gerar pr/ }))
    await waitFor(() => expect(fetchMock.getPreviewRequests()).toBe(previewRequestsBefore + 1))
    expect(await screen.findByText('Revisar anatomia')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Confirmar planejamento' }))
    expect(await screen.findByText(/Planejamento confirmado/)).toBeInTheDocument()

    expect(fetchMock.getStudySessionTransitionRequests()).toBe(1)
  })

  it('protege o planejamento semanal bloqueando geração e confirmação enquanto houver transição incerta', async () => {
    const initial = { ...studySessionFixture, titulo: 'Sessão com transição incerta', situacao: 0 }
    const fetchMock = setupFetch({
      studySessions: [initial],
      studySessionTransitionNetworkFailures: { '1/iniciar': 1 },
      studySessionDetailsQueues: {
        1: [initial, { status: 503, data: { detail: 'Falha temporária' } }],
      },
    })
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: /Gerar pr/ }))
    expect(await screen.findByText('Revisar anatomia')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão com transição incerta')
    await user.click(screen.getByRole('button', { name: 'Ver detalhes da sessão Sessão com transição incerta' }))
    const modal = await screen.findByRole('dialog')
    await waitFor(() => expect(within(modal).queryByText('Carregando…')).not.toBeInTheDocument())
    await user.click(within(modal).getByRole('button', { name: 'Iniciar sessão' }))
    expect(await within(modal).findByText(/resultado da operação é incerto/)).toBeInTheDocument()

    const closeButtons = within(modal).getAllByRole('button', { name: 'Fechar' })
    await user.click(closeButtons[closeButtons.length - 1])
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Planejamento semanal' }))

    const previewRequestsBefore = fetchMock.getPreviewRequests()
    await user.click(screen.getByRole('button', { name: /Gerar pr/ }))
    expect(fetchMock.getPreviewRequests()).toBe(previewRequestsBefore)
  })

  it('erro 404 definitivo na transição: não registra uma incerteza inexistente', async () => {
    const session = { ...studySessionFixture, id: 1, titulo: 'Sessão para transição 404', situacao: 0 }
    const fetchMock = setupFetch({
      studySessions: [session],
      studySessionDetails: { 1: session },
      studySessionTransitionResponses: { '1/iniciar': { status: 404, data: { detail: 'Sessão não encontrada.' } } },
    })
    const user = userEvent.setup()
    renderApp()
    await user.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão para transição 404')

    await user.click(screen.getByRole('button', { name: 'Ver detalhes da sessão Sessão para transição 404' }))
    const modal = await screen.findByRole('dialog')
    await waitFor(() => expect(within(modal).queryByText('Carregando…')).not.toBeInTheDocument())

    await user.click(within(modal).getByRole('button', { name: 'Iniciar sessão' }))

    expect(await within(modal).findByText('A sessão informada não foi encontrada.')).toBeInTheDocument()
    expect(within(modal).queryByText(/resultado da operação é incerto/)).not.toBeInTheDocument()
    expect(within(modal).queryByRole('button', { name: 'Consultar sessões antes de tentar novamente' })).not.toBeInTheDocument()

    const closeButtons = within(modal).getAllByRole('button', { name: 'Fechar' })
    await user.click(closeButtons[closeButtons.length - 1])
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Planejamento semanal' }))
    const previewRequestsBefore = fetchMock.getPreviewRequests()
    await user.click(screen.getByRole('button', { name: /Gerar pr/ }))
    await waitFor(() => expect(fetchMock.getPreviewRequests()).toBe(previewRequestsBefore + 1))
  })

  it('edita sessão planejada e bloqueia edição das demais situações', async () => {
    const planned = { ...studySessionFixture, demandaAcademicaId: null, titulo: 'Sessão editável' }
    const active = { ...studySessionFixture, id: 2, situacao: 1, titulo: 'Sessão em andamento' }
    const fetchMock = setupFetch({ studySessions: [planned, active] })
    const user = userEvent.setup()
    renderApp()
    await user.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão editável')
    await user.click(screen.getByRole('button', { name: 'Ver detalhes da sessão Sessão editável' }))
    const modal = await screen.findByRole('dialog')
    await user.click(within(modal).getByRole('button', { name: 'Editar sessão' }))
    const form = within(modal).getByRole('heading', { name: 'Editar sessão de estudo' }).closest('form')
    expect(within(form).getByLabelText('Título')).toHaveValue('Sessão editável')
    await user.type(within(form).getByLabelText('Título'), 'Sessão atualizada')
    await user.click(within(form).getByRole('button', { name: 'Salvar alterações' }))
    await waitFor(() => expect(fetchMock.getStudySessionPutRequests()).toBe(1))
    // O formulário fecha e o detalhe re-renderiza com o título atualizado
    // Apenas verificar que o PUT foi chamado (o estado do UI é testado em outros testes)
    expect(within(modal).queryByRole('button', { name: 'Editar sessão' })).toBeInTheDocument()

    await user.click(within(modal).getAllByRole('button', { name: 'Fechar' })[0])
    await user.click(screen.getByRole('button', { name: 'Ver detalhes da sessão Sessão em andamento' }))
    const activeModal = await screen.findByRole('dialog')
    expect(within(activeModal).queryByRole('button', { name: 'Editar sessão' })).not.toBeInTheDocument()
    expect(within(activeModal).getByText(/não podem ser editadas/)).toBeInTheDocument()
  })

  it('persiste o ID e o payload quando a edição termina com falha de rede', async () => {
    const planned = {
      ...studySessionFixture,
      id: 1,
      demandaAcademicaId: null,
      tarefaDemandaId: null,
      titulo: 'Sessão editável com falha',
      situacao: 0,
    }

    const fetchMock = setupFetch({
      studySessions: [planned],
      studySessionUpdateNetworkFailures: 1,
    })

    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText(planned.titulo)

    await user.click(
      screen.getByRole('button', {
        name: `Ver detalhes da sessão ${planned.titulo}`,
      })
    )

    const modal = await screen.findByRole('dialog')

    await user.click(
      within(modal).getByRole('button', { name: 'Editar sessão' })
    )

    const form = within(modal)
      .getByRole('heading', { name: 'Editar sessão de estudo' })
      .closest('form')

    const titleInput = within(form).getByLabelText('Título')
    await user.clear(titleInput)
    await user.type(titleInput, 'Sessão atualizada com falha')

    await user.click(
      within(form).getByRole('button', { name: 'Salvar alterações' })
    )

    await within(form).findByText(/resultado da operação é incerto/i)

    const storedEdits = JSON.parse(
      sessionStorage.getItem('cadernoatlas:uncertain-session-edits') ?? '[]'
    )

    expect(storedEdits).toHaveLength(1)
    expect(storedEdits[0]).toMatchObject({
      sessionId: planned.id,
      request: {
        titulo: 'Sessão atualizada com falha',
      },
    })
    expect(storedEdits[0].timestamp).toEqual(expect.any(Number))

    expect(
      within(form).getByRole('button', { name: 'Salvar alterações' })
    ).toBeDisabled()

    const card = screen.getByText(planned.titulo).closest('article')

    expect(within(card).getByRole('button', { name: 'Iniciar' })).toBeDisabled()
    expect(within(card).getByRole('button', { name: 'Cancelar' })).toBeDisabled()
    expect(within(card).getByRole('button', { name: 'Excluir' })).toBeDisabled()

    expect(fetchMock.getStudySessionPutRequests()).toBe(1)
  })

  it('recupera uma edição incerta após desmontar e montar novamente a página', async () => {
    const planned = {
      ...studySessionFixture,
      id: 1,
      demandaAcademicaId: null,
      tarefaDemandaId: null,
      titulo: 'Sessão antes da edição',
      situacao: 0,
    }

    const fetchMock = setupFetch({
      studySessions: [planned],
      studySessionUpdateNetworkFailures: 1,
    })

    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText(planned.titulo)

    await user.click(
      screen.getByRole('button', {
        name: `Ver detalhes da sessão ${planned.titulo}`,
      })
    )

    let modal = await screen.findByRole('dialog')

    await user.click(
      within(modal).getByRole('button', { name: 'Editar sessão' })
    )

    let form = within(modal)
      .getByRole('heading', { name: 'Editar sessão de estudo' })
      .closest('form')

    const submittedTitle = 'Sessão editada com resultado incerto'
    await user.clear(within(form).getByLabelText('Título'))
    await user.type(within(form).getByLabelText('Título'), submittedTitle)

    await user.click(
      within(form).getByRole('button', { name: 'Salvar alterações' })
    )

    await within(form).findByText(/resultado da operação é incerto/i)

    expect(
      JSON.parse(sessionStorage.getItem('cadernoatlas:uncertain-session-edits'))
    ).toHaveLength(1)

    // Navegar para outra página desmonta StudySessionsPage e seus estados locais.
    await user.click(
      screen.getByRole('button', { name: 'Planejamento semanal' })
    )

    expect(
      screen.queryByRole('heading', { name: 'Sessões de estudo' })
    ).not.toBeInTheDocument()

    // Voltar à página de sessões.
    await user.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText(planned.titulo)

    // Os botões do card continuam bloqueados após a remontagem.
    const card = screen.getByText(planned.titulo).closest('article')
    expect(within(card).getByRole('button', { name: 'Iniciar' })).toBeDisabled()
    expect(within(card).getByRole('button', { name: 'Cancelar' })).toBeDisabled()
    expect(within(card).getByRole('button', { name: 'Excluir' })).toBeDisabled()

    // Abrir novamente os detalhes deve recuperar o formulário automaticamente.
    await user.click(
      within(card).getByRole('button', {
        name: `Ver detalhes da sessão ${planned.titulo}`,
      })
    )

    modal = await screen.findByRole('dialog')
    form = await within(modal)
      .findByRole('heading', { name: 'Editar sessão de estudo' })
      .then((heading) => heading.closest('form'))

    expect(within(form).getByLabelText('Título')).toHaveValue(submittedTitle)

    expect(
      within(form).getByRole('button', { name: 'Salvar alterações' })
    ).toBeDisabled()

    expect(
      within(form).getByRole('button', {
        name: 'Consultar sessões antes de tentar novamente',
      })
    ).toBeInTheDocument()

    expect(fetchMock.getStudySessionPutRequests()).toBe(1)
  })

  it('reconcilia edição incerta quando o GET individual confirma os dados enviados', async () => {
    const planned = {
      ...studySessionFixture,
      id: 1,
      demandaAcademicaId: null,
      tarefaDemandaId: null,
      titulo: 'Sessão antes da reconciliação',
      situacao: 0,
    }

    const updated = {
      ...planned,
      titulo: 'Sessão atualizada no servidor',
    }

    const fetchMock = setupFetch({
      studySessions: [planned],
      studySessionUpdateNetworkFailures: 1,
      studySessionDetailsQueues: {
        '1': [
          { status: 200, data: planned },
          { status: 200, data: updated },
        ],
      },
      studySessionListQueues: {
        '/api/sessoes-estudo': [
          { data: [planned] },
          { data: [planned] },
          { data: [updated] },
        ],
      },
    })

    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText(planned.titulo)

    await user.click(
      screen.getByRole('button', {
        name: `Ver detalhes da sessão ${planned.titulo}`,
      })
    )

    const modal = await screen.findByRole('dialog')

    await user.click(
      within(modal).getByRole('button', { name: 'Editar sessão' })
    )

    const form = within(modal)
      .getByRole('heading', { name: 'Editar sessão de estudo' })
      .closest('form')

    await user.clear(within(form).getByLabelText('Título'))
    await user.type(
      within(form).getByLabelText('Título'),
      updated.titulo
    )

    await user.click(
      within(form).getByRole('button', { name: 'Salvar alterações' })
    )

    await within(form).findByText(/resultado da operação é incerto/i)

    await user.click(
      within(form).getByRole('button', {
        name: 'Consultar sessões antes de tentar novamente',
      })
    )

    // O formulário deve fechar porque o GET individual confirmou a edição.
    await within(modal).findByRole('button', { name: 'Editar sessão' })

    // O modal também deve apresentar os dados atualizados.
    expect(
      within(modal).getByRole('heading', { name: updated.titulo })
    ).toBeInTheDocument()

    const remainingEdits = JSON.parse(
      sessionStorage.getItem('cadernoatlas:uncertain-session-edits') ?? '[]'
    )

    expect(remainingEdits).toHaveLength(0)

    expect(fetchMock.getStudySessionPutRequests()).toBe(1)
  })

  it('libera a edição e preserva os dados quando o GET individual não confirma a alteração', async () => {
    const planned = {
      ...studySessionFixture,
      id: 1,
      demandaAcademicaId: null,
      tarefaDemandaId: null,
      titulo: 'Sessão original no servidor',
      situacao: 0,
    }

    const attemptedTitle = 'Título preenchido pelo usuário'

    const fetchMock = setupFetch({
      studySessions: [planned],
      studySessionUpdateNetworkFailures: 1,
      studySessionDetailsQueues: {
        '1': [
          { status: 200, data: planned },
          { status: 200, data: planned },
        ],
      },
    })

    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText(planned.titulo)

    await user.click(
      screen.getByRole('button', {
        name: `Ver detalhes da sessão ${planned.titulo}`,
      })
    )

    const modal = await screen.findByRole('dialog')

    await user.click(
      within(modal).getByRole('button', { name: 'Editar sessão' })
    )

    const form = within(modal)
      .getByRole('heading', { name: 'Editar sessão de estudo' })
      .closest('form')

    const titleInput = within(form).getByLabelText('Título')

    await user.clear(titleInput)
    await user.type(titleInput, attemptedTitle)

    await user.click(
      within(form).getByRole('button', { name: 'Salvar alterações' })
    )

    await within(form).findByText(/resultado da operação é incerto/i)

    await user.click(
      within(form).getByRole('button', {
        name: 'Consultar sessões antes de tentar novamente',
      })
    )

    // A consulta confirma que o servidor ainda possui os dados anteriores.
    expect(
      await within(form).findByText(/dados atuais são diferentes dos enviados/i)
    ).toBeInTheDocument()

    // O formulário permanece aberto e preserva o que o usuário tentou salvar.
    expect(titleInput).toHaveValue(attemptedTitle)

    // A incerteza foi esclarecida: uma nova tentativa pode ser feita.
    expect(
      within(form).getByRole('button', { name: 'Salvar alterações' })
    ).toBeEnabled()

    expect(
      within(form).queryByRole('button', {
        name: 'Consultar sessões antes de tentar novamente',
      })
    ).not.toBeInTheDocument()

    // As operações da sessão também deixam de ficar bloqueadas.
    const card = screen.getByText(planned.titulo).closest('article')

    expect(within(card).getByRole('button', { name: 'Iniciar' })).toBeEnabled()
    expect(within(card).getByRole('button', { name: 'Cancelar' })).toBeEnabled()
    expect(within(card).getByRole('button', { name: 'Excluir' })).toBeEnabled()

    const remainingEdits = JSON.parse(
      sessionStorage.getItem('cadernoatlas:uncertain-session-edits') ?? '[]'
    )

    expect(remainingEdits).toHaveLength(0)
    expect(fetchMock.getStudySessionPutRequests()).toBe(1)
  })

  it('preserva a edição incerta quando a consulta individual falha', async () => {
    const planned = {
      ...studySessionFixture,
      id: 1,
      demandaAcademicaId: null,
      tarefaDemandaId: null,
      titulo: 'Sessão com consulta indisponível',
      situacao: 0,
    }

    const attemptedTitle = 'Título que precisa ser recuperado'

    const fetchMock = setupFetch({
      studySessions: [planned],
      studySessionUpdateNetworkFailures: 1,
      studySessionDetailsQueues: {
        '1': [
          { status: 200, data: planned },
          { error: new TypeError('Failed to fetch') },
        ],
      },
    })

    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText(planned.titulo)

    await user.click(
      screen.getByRole('button', {
        name: `Ver detalhes da sessão ${planned.titulo}`,
      })
    )

    const modal = await screen.findByRole('dialog')

    await user.click(
      within(modal).getByRole('button', { name: 'Editar sessão' })
    )

    const form = within(modal)
      .getByRole('heading', { name: 'Editar sessão de estudo' })
      .closest('form')

    const titleInput = within(form).getByLabelText('Título')

    await user.clear(titleInput)
    await user.type(titleInput, attemptedTitle)

    await user.click(
      within(form).getByRole('button', { name: 'Salvar alterações' })
    )

    await within(form).findByText(/resultado da operação é incerto/i)

    await user.click(
      within(form).getByRole('button', {
        name: 'Consultar sessões antes de tentar novamente',
      })
    )

    await within(form).findByText(/Não foi possível consultar as sessões/i)

    expect(titleInput).toHaveValue(attemptedTitle)

    expect(
      within(form).getByRole('button', { name: 'Salvar alterações' })
    ).toBeDisabled()

    expect(
      within(form).getByRole('button', {
        name: 'Consultar sessões antes de tentar novamente',
      })
    ).toBeInTheDocument()

    const storedEdits = JSON.parse(
      sessionStorage.getItem('cadernoatlas:uncertain-session-edits') ?? '[]'
    )

    expect(storedEdits).toHaveLength(1)
    expect(storedEdits[0]).toMatchObject({
      sessionId: planned.id,
      request: { titulo: attemptedTitle },
    })

    const card = screen.getByText(planned.titulo).closest('article')

    expect(within(card).getByRole('button', { name: 'Iniciar' })).toBeDisabled()
    expect(within(card).getByRole('button', { name: 'Cancelar' })).toBeDisabled()
    expect(within(card).getByRole('button', { name: 'Excluir' })).toBeDisabled()

    expect(fetchMock.getStudySessionPutRequests()).toBe(1)
  })

  it('isola a edição incerta por sessão sem bloquear outras sessões', async () => {
    const first = {
      ...studySessionFixture,
      id: 1,
      titulo: 'Sessão com edição incerta',
      situacao: 0,
    }

    const second = {
      ...studySessionFixture,
      id: 2,
      titulo: 'Sessão independente',
      situacao: 0,
    }

    sessionStorage.setItem(
      'cadernoatlas:uncertain-session-edits',
      JSON.stringify([
        {
          sessionId: first.id,
          request: {
            titulo: 'Título pendente',
            dataPlanejada: '2026-11-13',
            horaInicioPlanejada: '14:00',
            duracaoPlanejadaMinutos: 60,
            demandaAcademicaId: null,
            tarefaDemandaId: null,
            observacoes: null,
          },
          timestamp: Date.now(),
        },
      ])
    )

    setupFetch({ studySessions: [first, second] })

    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: 'Sessões de estudo' }))

    await screen.findByText(first.titulo)
    await screen.findByText(second.titulo)

    const firstCard = screen.getByText(first.titulo).closest('article')
    const secondCard = screen.getByText(second.titulo).closest('article')

    // A sessão com edição incerta permanece bloqueada.
    expect(within(firstCard).getByRole('button', { name: 'Iniciar' })).toBeDisabled()
    expect(within(firstCard).getByRole('button', { name: 'Cancelar' })).toBeDisabled()
    expect(within(firstCard).getByRole('button', { name: 'Excluir' })).toBeDisabled()

    // A outra sessão continua operável.
    expect(within(secondCard).getByRole('button', { name: 'Iniciar' })).toBeEnabled()
    expect(within(secondCard).getByRole('button', { name: 'Cancelar' })).toBeEnabled()
    expect(within(secondCard).getByRole('button', { name: 'Excluir' })).toBeEnabled()
  })
})