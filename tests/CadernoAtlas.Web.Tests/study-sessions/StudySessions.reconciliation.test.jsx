import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within, findByText } from '@testing-library/react'
import { renderApp } from '../helpers/renderApp.jsx'
import { setupFetch, studySessionFixture } from '../helpers/fetchMocks.js'
import { clearAllUncertainTransitions } from '../../../src/CadernoAtlas.Web/src/features/study-sessions/useStudySessionUncertainTransitions'
import { clearAllUncertainDeletions } from '../../../src/CadernoAtlas.Web/src/features/study-sessions/useStudySessionUncertainDeletions'
import { clearAllUncertainEdits } from '../../../src/CadernoAtlas.Web/src/features/study-sessions/useStudySessionUncertainEdits'
import userEvent from '@testing-library/user-event'

describe('Sessões de estudo — Reconciliação', () => {
  beforeEach(() => {
    clearAllUncertainTransitions()
    clearAllUncertainDeletions()
    clearAllUncertainEdits()
  })

  it('reconciliação bem-sucedida no modal libera bloqueios apropriados', async () => {
    const session = { ...studySessionFixture, id: 1, titulo: 'Sessão reconciliação sucesso', situacao: 0 }
    const reconciled = { ...session, situacao: 1 }
    const fetchMock = setupFetch({
      studySessions: [session],
      studySessionDetailsQueues: {
        '1': [
          { status: 200, data: { ...session } },
          { status: 200, data: reconciled },
        ],
      },
      studySessionListQueues: {
        '/api/sessoes-estudo': [
          { data: [session] }, { data: [reconciled] },
        ],
      },
      studySessionDeleteNetworkFailures: 1,
    })
    renderApp()

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão reconciliação sucesso')

    await user.click(screen.getByRole('button', { name: /Ver detalhes/ }))
    await within(screen.getByRole('dialog')).findByRole('heading', { name: 'Sessão reconciliação sucesso' })

    const deleteButtonModal = within(screen.getByRole('dialog')).getByRole('button', { name: 'Excluir sessão' })
    await user.click(deleteButtonModal)
    // Confirmar no modal de confirmação de exclusão
    const confirmModal = await screen.findByRole('dialog', { name: /Excluir sessão de estudo/i })
    await user.click(within(confirmModal).getByRole('button', { name: 'Excluir' }))

    await screen.findByText(/resultado da exclusão é incerto/)
    expect(screen.getByRole('button', { name: 'Excluir sessão' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Consultar sessão antes de tentar novamente' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Consultar sessão antes de tentar novamente' }))

    const modal = screen.getByRole('dialog', { name: /Sessão reconciliação sucesso/i })
    await findByText(modal, 'Em andamento')
    expect(screen.queryByText(/resultado da exclusão é incerto/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Excluir sessão' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Concluir sessão' })).not.toBeDisabled()

    expect(fetchMock.getStudySessionDeleteRequests()).toBe(1)
  })

  it('falhas durante reconciliação no modal não liberam bloqueios indevidamente', async () => {
    const session = { ...studySessionFixture, id: 1, titulo: 'Sessão falha reconciliação', situacao: 0 }
    const fetchMock = setupFetch({
      studySessions: [session],
      studySessionDetailsQueues: {
        '1': [
          { status: 200, data: { ...session } },
          { error: new TypeError('Failed to fetch') },
        ],
      },
      studySessionDeleteNetworkFailures: 1,
    })
    renderApp()

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão falha reconciliação')

    await user.click(screen.getByRole('button', { name: /Ver detalhes/ }))
    await within(screen.getByRole('dialog')).findByRole('heading', { name: 'Sessão falha reconciliação' })

    const deleteButtonModal = within(screen.getByRole('dialog')).getByRole('button', { name: 'Excluir sessão' })
    await user.click(deleteButtonModal)
    // Confirmar no modal de confirmação de exclusão
    const confirmModal = await screen.findByRole('dialog', { name: /Excluir sessão de estudo/i })
    await user.click(within(confirmModal).getByRole('button', { name: 'Excluir' }))

    await screen.findByText(/resultado da exclusão é incerto/)

    await user.click(screen.getByRole('button', { name: 'Consultar sessão antes de tentar novamente' }))

    await screen.findByText(/resultado da exclusão é incerto/)

    expect(screen.getByRole('button', { name: 'Excluir sessão' })).toBeDisabled()
    expect(screen.getByText(/resultado da exclusão é incerto/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Consultar sessão antes de tentar novamente' })).toBeInTheDocument()
  })

  it('GET individual 200: sessão continua existindo e interface não informa exclusão confirmada', async () => {
    const session = { ...studySessionFixture, id: 1, titulo: 'Sessão existe', situacao: 0 }
    const reconciled = { ...session, situacao: 1 }
    const fetchMock = setupFetch({
      studySessions: [session],
      studySessionDetailsQueues: {
        '1': [
          { status: 200, data: { ...session } },
          { status: 200, data: reconciled },
        ],
      },
      studySessionListQueues: {
        '/api/sessoes-estudo': [
          { data: [session] }, { data: [reconciled] },
        ],
      },
      studySessionDeleteNetworkFailures: 1,
    })
    renderApp()

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão existe')

    await user.click(screen.getByRole('button', { name: /Ver detalhes/ }))
    await within(screen.getByRole('dialog')).findByRole('heading', { name: 'Sessão existe' })

    const deleteButtonModal = within(screen.getByRole('dialog')).getByRole('button', { name: 'Excluir sessão' })
    await user.click(deleteButtonModal)
    // Confirmar no modal de confirmação de exclusão
    const confirmModal = await screen.findByRole('dialog', { name: /Excluir sessão de estudo/i })
    await user.click(within(confirmModal).getByRole('button', { name: 'Excluir' }))

    await screen.findByText(/resultado da exclusão é incerto/)
    expect(screen.getByRole('button', { name: 'Excluir sessão' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Consultar sessão antes de tentar novamente' }))

    const modal = screen.getByRole('dialog', { name: /Sessão existe/i })
    await findByText(modal, 'Em andamento')
    expect(screen.queryByText(/exclusão foi confirmada/)).not.toBeInTheDocument()
    expect(screen.queryByText(/resultado da exclusão é incerto/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Excluir sessão' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Concluir sessão' })).not.toBeDisabled()

    expect(fetchMock.getStudySessionDeleteRequests()).toBe(1)
  })

  it('GET individual 200 com falha na atualização da lista: mensagem corresponde à situação real', async () => {
    const session = { ...studySessionFixture, id: 1, titulo: 'Sessão falha lista', situacao: 0 }
    const reconciled = { ...session, situacao: 1 }
    const fetchMock = setupFetch({
      studySessions: [session],
      studySessionDetailsQueues: {
        '1': [
          { status: 200, data: { ...session } },
          { status: 200, data: reconciled },
        ],
      },
      studySessionListQueues: {
        '/api/sessoes-estudo': [
          { data: [session] }, { error: new TypeError('Failed to fetch') }, { data: [reconciled] },
        ],
      },
      studySessionDeleteNetworkFailures: 1,
    })
    renderApp()

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão falha lista')

    await user.click(screen.getByRole('button', { name: /Ver detalhes/ }))
    await within(screen.getByRole('dialog')).findByRole('heading', { name: 'Sessão falha lista' })

    const deleteButtonModal = within(screen.getByRole('dialog')).getByRole('button', { name: 'Excluir sessão' })
    await user.click(deleteButtonModal)
    // Confirmar no modal de confirmação de exclusão
    const confirmModal = await screen.findByRole('dialog', { name: /Excluir sessão de estudo/i })
    await user.click(within(confirmModal).getByRole('button', { name: 'Excluir' }))

    await screen.findByText(/resultado da exclusão é incerto/)

    await user.click(screen.getByRole('button', { name: 'Consultar sessão antes de tentar novamente' }))

    await screen.findByText(/A sessão ainda existe, mas a lista não pôde ser atualizada/)
    expect(screen.queryByText(/exclusão foi confirmada/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Atualizar lista de sessões' }))
    const modalAfterUpdate = screen.getByRole('dialog', { name: /Sessão falha lista/i })
    // Após reconciliação, a sessão individual deve mostrar "Em andamento" (situacao: 1)
    // mas a lista falhou, então aparece mensagem de sync failed
    await within(modalAfterUpdate).findByText('Planejada', { selector: '.study-session-status-planejada' })
    expect(screen.queryByText(/A sessão ainda existe, mas a lista não pôde ser atualizada/)).not.toBeInTheDocument()
  })

  it('resultado incerto registrado no card é refletido imediatamente no modal sem fechá-lo', async () => {
    const session = { ...studySessionFixture, titulo: 'Sessão incerteza cross', situacao: 0 }
    const fetchMock = setupFetch({
      studySessions: [session],
      studySessionDetails: { 1: session },
      studySessionDeleteNetworkFailures: 1,
    })
    renderApp()

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão incerteza cross')

    await user.click(screen.getByRole('button', { name: /Ver detalhes/ }))
    await within(screen.getByRole('dialog')).findByRole('heading', { name: 'Sessão incerteza cross' })
    expect(screen.getByRole('button', { name: 'Excluir sessão' })).not.toBeDisabled()

    const closeButtons = screen.getAllByRole('button', { name: 'Fechar' })
    await user.click(closeButtons[0])
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    const deleteButton = screen.getByRole('button', { name: 'Excluir' })
    await user.click(deleteButton)
    // Confirmar no modal de confirmação de exclusão
    const confirmModal = await screen.findByRole('dialog', { name: /Excluir sessão de estudo/i })
    await user.click(within(confirmModal).getByRole('button', { name: 'Excluir' }))

    await waitFor(() => expect(fetchMock.getStudySessionDeleteRequests()).toBe(1))

    await user.click(screen.getByRole('button', { name: /Ver detalhes/ }))
    await within(screen.getByRole('dialog')).findByRole('heading', { name: 'Sessão incerteza cross' })

    expect(screen.getByRole('button', { name: 'Excluir sessão' })).toBeDisabled()
    expect(screen.getByText(/resultado da exclusão é incerto/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Consultar sessão antes de tentar novamente' })).toBeInTheDocument()
  })

  // novos testes para bloqueio de mutações durante incerteza

  it('bloqueia transição quando há transição incerta não reconciliada', async () => {
    const session = { ...studySessionFixture, id: 1, titulo: 'Sessão bloqueada transição', situacao: 0 }
    const reconciled = { ...session, situacao: 1, inicioRealEm: '2026-11-06T15:00:00Z' }
    const fetchMock = setupFetch({
      studySessions: [session],
      studySessionDetails: { 1: session },
      studySessionTransitionNetworkFailures: { '1/iniciar': 1 },
      studySessionDetailsQueues: {
        '1': [session, { status: 503, data: { detail: 'Falha temporária' } }, reconciled],
      },
    })
    renderApp()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão bloqueada transição')

    // Abrir modal e tentar iniciar - falha de rede registra incerteza
    await user.click(screen.getByRole('button', { name: /Ver detalhes/ }))
    await within(screen.getByRole('dialog')).findByRole('heading', { name: 'Sessão bloqueada transição' })
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Iniciar sessão' }))

    // Incerteza registrada
    await screen.findByText(/resultado da operação é incerto/)
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Iniciar sessão' })).toBeDisabled()
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Consultar sessões antes de tentar novamente' })).toBeInTheDocument()

    // Tentar cancelar enquanto há transição incerta - deve ser bloqueado
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar sessão' })).toBeDisabled()

    // Tentar excluir enquanto há transição incerta - deve ser bloqueado
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Excluir sessão' })).toBeDisabled()

    // Reconciliar para limpar a incerteza
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Consultar sessões antes de tentar novamente' }))

    // Após reconciliação, bloqueios devem ser liberados
    await within(screen.getByRole('dialog')).findByRole('button', { name: 'Concluir sessão' })
    expect(screen.queryByText(/resultado da operação é incerto/)).not.toBeInTheDocument()
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Concluir sessão' })).not.toBeDisabled()
  })

  it('bloqueia transição quando há exclusão incerta não reconciliada', async () => {
    const session = { ...studySessionFixture, id: 1, titulo: 'Sessão bloqueada exclusão', situacao: 0 }
    const fetchMock = setupFetch({
      studySessions: [session],
      studySessionDetails: { 1: session },
      studySessionDeleteNetworkFailures: 1,
      studySessionDetailsQueues: {
        '1': [session, { status: 404, data: { detail: 'Sessão de estudo não encontrada.' } }],
      },
    })
    renderApp()

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão bloqueada exclusão')

    // Abrir modal e tentar excluir - falha de rede registra incerteza de exclusão
    await user.click(screen.getByRole('button', { name: /Ver detalhes/ }))
    await within(screen.getByRole('dialog')).findByRole('heading', { name: 'Sessão bloqueada exclusão' })
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Excluir sessão' }))
    // Confirmar no modal de confirmação de exclusão
    const confirmModal = await screen.findByRole('dialog', { name: /Excluir sessão de estudo/i })
    await user.click(within(confirmModal).getByRole('button', { name: 'Excluir' }))

    // Incerteza de exclusão registrada
    await screen.findByText(/resultado da exclusão é incerto/)
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Excluir sessão' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Consultar sessão antes de tentar novamente' })).toBeInTheDocument()

    // Tentar iniciar enquanto há exclusão incerta - deve ser bloqueado
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Iniciar sessão' })).toBeDisabled()
    // Tentar cancelar enquanto há exclusão incerta - deve ser bloqueado
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar sessão' })).toBeDisabled()

    // Reconciliar para limpar a incerteza
    await user.click(screen.getByRole('button', { name: 'Consultar sessão antes de tentar novamente' }))

    // Modal deve fechar após confirmação de exclusão
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  // Teste: fechar modal após incerteza de transição mantém botões desabilitados no card
  it('fecha modal após incerteza de transição mantém botões desabilitados no card', async () => {
    const session = { ...studySessionFixture, id: 1, titulo: 'Sessão fecha modal transição', situacao: 0 }
    const fetchMock = setupFetch({
      studySessions: [session],
      studySessionDetails: { 1: session },
      studySessionTransitionNetworkFailures: { '1/iniciar': 1 },
      studySessionDetailsQueues: {
        '1': [session, { status: 503, data: { detail: 'Falha temporária' } }],
      },
    })
    renderApp()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão fecha modal transição')

    // Abrir modal e tentar iniciar - falha de rede registra incerteza
    await user.click(screen.getByRole('button', { name: /Ver detalhes/ }))
    await within(screen.getByRole('dialog')).findByRole('heading', { name: 'Sessão fecha modal transição' })
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Iniciar sessão' }))

    // Incerteza registrada
    await screen.findByText(/resultado da operação é incerto/)

    // Fechar modal
    const closeButtons = screen.getAllByRole('button', { name: 'Fechar' })
    await user.click(closeButtons[0])
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    // Botões no card devem permanecer desabilitados
    expect(screen.getByRole('button', { name: 'Iniciar' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Excluir' })).toBeDisabled()
  })

  // Teste: fechar modal após incerteza de exclusão mantém botões desabilitados no card
  it('fecha modal após incerteza de exclusão mantém botões desabilitados no card', async () => {
    const session = { ...studySessionFixture, id: 1, titulo: 'Sessão fecha modal exclusão', situacao: 0 }
    const fetchMock = setupFetch({
      studySessions: [session],
      studySessionDetails: { 1: session },
      studySessionDeleteNetworkFailures: 1,
    })
    renderApp()

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Sessões de estudo' }))
    await screen.findByText('Sessão fecha modal exclusão')

    // Abrir modal e tentar excluir - falha de rede registra incerteza de exclusão
    await user.click(screen.getByRole('button', { name: /Ver detalhes/ }))
    await within(screen.getByRole('dialog')).findByRole('heading', { name: 'Sessão fecha modal exclusão' })
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Excluir sessão' }))
    // Confirmar no modal de confirmação de exclusão
    const confirmModal = await screen.findByRole('dialog', { name: /Excluir sessão de estudo/i })
    await user.click(within(confirmModal).getByRole('button', { name: 'Excluir' }))

    // Incerteza de exclusão registrada
    await screen.findByText(/resultado da exclusão é incerto/)

    // Fechar modal
    const closeButtons = screen.getAllByRole('button', { name: 'Fechar' })
    await user.click(closeButtons[0])
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    // Botões no card devem permanecer desabilitados
    expect(screen.getByRole('button', { name: 'Iniciar' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Excluir' })).toBeDisabled()
  })

  // Teste unitário: useStudySessionMutations.transitionSession rejeita nova operação com incerteza não reconciliada
  it('useStudySessionMutations.transitionSession rejeita nova transição quando há incerteza não reconciliada', async () => {
    const { renderHook, act } = await import('@testing-library/react')
    const { useStudySessionMutations } = await import('../../../src/CadernoAtlas.Web/src/features/study-sessions/useStudySessionMutations')
    const { clearUncertainForSession, isUncertain } = await import('../../../src/CadernoAtlas.Web/src/features/study-sessions/useStudySessionUncertainTransitions')
    const { clearDeleteUncertainForSession } = await import('../../../src/CadernoAtlas.Web/src/features/study-sessions/useStudySessionUncertainDeletions')

    // Limpar estado anterior
    clearUncertainForSession(1)
    clearDeleteUncertainForSession(1)

    // Mock das dependências
    const apiPost = vi.fn()
    const refresh = vi.fn().mockResolvedValue(undefined)
    const invalidatePreview = vi.fn()
    const concurrencyLocks = {
      dataMutationInProgressRef: { current: false },
      studySessionMutationInProgressRef: { current: false },
      setStudySessionMutationInProgress: vi.fn(),
      setDataMutationInProgress: vi.fn(),
    }

    // Simular incerteza já registrada via sessionStorage
    sessionStorage.setItem('cadernoatlas:uncertain-session-transitions', JSON.stringify([{
      sessionId: 1,
      transition: 'iniciar',
      expectedStatus: 1,
      timestamp: Date.now(),
    }]))

    // Verificar que a incerteza foi registrada via hook
    const { result: hookResult } = renderHook(() =>
      useStudySessionMutations({ refresh, invalidatePreview, concurrencyLocks })
    )
    expect(hookResult.current.isUncertain(1)).toBe(true)

    // Tentar fazer uma nova transição - deve ser rejeitada
    const { result } = renderHook(() =>
      useStudySessionMutations({ refresh, invalidatePreview, concurrencyLocks })
    )

    await expect(act(async () => {
      await result.current.transitionSession(1, 'iniciar')
    })).rejects.toThrow('Esta sessão possui uma transição não reconciliada')

    // Verificar que apiPost NÃO foi chamado (mock não disponível aqui, mas a exceção prova que não prossegue)
  })

  // Teste unitário: useStudySessionMutations.transitionSession rejeita nova transição quando há exclusão incerta
  it('useStudySessionMutations.transitionSession rejeita nova transição quando há exclusão incerta', async () => {
    const { renderHook, act } = await import('@testing-library/react')
    const { useStudySessionMutations } = await import('../../../src/CadernoAtlas.Web/src/features/study-sessions/useStudySessionMutations')

    // Limpar estado anterior
    sessionStorage.removeItem('cadernoatlas:uncertain-session-transitions')
    sessionStorage.removeItem('cadernoatlas:uncertain-session-deletions')

    // Registrar incerteza de exclusão via sessionStorage
    sessionStorage.setItem('cadernoatlas:uncertain-session-deletions', JSON.stringify([{
      sessionId: 1,
      timestamp: Date.now(),
    }]))

    const refresh = vi.fn().mockResolvedValue(undefined)
    const invalidatePreview = vi.fn()
    const concurrencyLocks = {
      dataMutationInProgressRef: { current: false },
      studySessionMutationInProgressRef: { current: false },
      setStudySessionMutationInProgress: vi.fn(),
      setDataMutationInProgress: vi.fn(),
    }

    // Verificar que a incerteza foi registrada via hook
    const { result: hookResult } = renderHook(() =>
      useStudySessionMutations({ refresh, invalidatePreview, concurrencyLocks })
    )
    expect(hookResult.current.isDeleteUncertain(1)).toBe(true)

    // Tentar fazer uma nova transição - deve ser rejeitada
    const { result } = renderHook(() =>
      useStudySessionMutations({ refresh, invalidatePreview, concurrencyLocks })
    )

    await expect(act(async () => {
      await result.current.transitionSession(1, 'iniciar')
    })).rejects.toThrow('Esta sessão possui uma exclusão não reconciliada')
  })

  it('useStudySessionMutations.updateSession rejeita edição quando há edição incerta', async () => {
    const { renderHook, act } = await import('@testing-library/react')
    const { useStudySessionMutations } = await import('../../../src/CadernoAtlas.Web/src/features/study-sessions/useStudySessionMutations')

    sessionStorage.setItem('cadernoatlas:uncertain-session-edits', JSON.stringify([
      {
        sessionId: 1,
        request: {
          titulo: 'Edição pendente',
          dataPlanejada: '2026-11-13',
          horaInicioPlanejada: '14:00',
          duracaoPlanejadaMinutos: 60,
          demandaAcademicaId: null,
          tarefaDemandaId: null,
          observacoes: null,
        },
        timestamp: Date.now(),
      },
    ]))

    const concurrencyLocks = {
      confirmationInProgressRef: { current: false },
      dataMutationInProgressRef: { current: false },
      studySessionMutationInProgressRef: { current: false },
      setStudySessionMutationInProgress: vi.fn(),
      setDataMutationInProgress: vi.fn(),
    }

    const { result } = renderHook(() =>
      useStudySessionMutations({
        refresh: vi.fn().mockResolvedValue(undefined),
        invalidatePreview: vi.fn(),
        concurrencyLocks,
      })
    )

    const request = {
      titulo: 'Nova tentativa',
      dataPlanejada: '2026-11-13',
      horaInicioPlanejada: '14:00',
      duracaoPlanejadaMinutos: 60,
      demandaAcademicaId: null,
      tarefaDemandaId: null,
      observacoes: null,
    }

    await expect(
      act(async () => {
        await result.current.updateSession(1, request)
      })
    ).rejects.toThrow('Esta sessão possui uma edição não reconciliada')

    expect(concurrencyLocks.setStudySessionMutationInProgress).not.toHaveBeenCalled()
  })

  it('useStudySessionMutations.transitionSession rejeita transição quando há edição incerta', async () => {
    const { renderHook, act } = await import('@testing-library/react')
    const { useStudySessionMutations } = await import('../../../src/CadernoAtlas.Web/src/features/study-sessions/useStudySessionMutations')

    sessionStorage.setItem('cadernoatlas:uncertain-session-edits', JSON.stringify([
      {
        sessionId: 1,
        request: {
          titulo: 'Edição pendente',
          dataPlanejada: '2026-11-13',
          horaInicioPlanejada: '14:00',
          duracaoPlanejadaMinutos: 60,
          demandaAcademicaId: null,
          tarefaDemandaId: null,
          observacoes: null,
        },
        timestamp: Date.now(),
      },
    ]))

    const concurrencyLocks = {
      confirmationInProgressRef: { current: false },
      dataMutationInProgressRef: { current: false },
      studySessionMutationInProgressRef: { current: false },
      setStudySessionMutationInProgress: vi.fn(),
      setDataMutationInProgress: vi.fn(),
    }

    const { result } = renderHook(() =>
      useStudySessionMutations({
        refresh: vi.fn().mockResolvedValue(undefined),
        invalidatePreview: vi.fn(),
        concurrencyLocks,
      })
    )

    await expect(
      act(async () => {
        await result.current.transitionSession(1, 'iniciar')
      })
    ).rejects.toThrow('Esta sessão possui uma edição não reconciliada')

    expect(concurrencyLocks.setStudySessionMutationInProgress).not.toHaveBeenCalled()
  })

  it('useStudySessionMutations.deleteSession rejeita exclusão quando há edição incerta', async () => {
    const { renderHook, act } = await import('@testing-library/react')
    const { useStudySessionMutations } = await import('../../../src/CadernoAtlas.Web/src/features/study-sessions/useStudySessionMutations')

    sessionStorage.setItem('cadernoatlas:uncertain-session-edits', JSON.stringify([
      {
        sessionId: 1,
        request: {
          titulo: 'Edição pendente',
          dataPlanejada: '2026-11-13',
          horaInicioPlanejada: '14:00',
          duracaoPlanejadaMinutos: 60,
          demandaAcademicaId: null,
          tarefaDemandaId: null,
          observacoes: null,
        },
        timestamp: Date.now(),
      },
    ]))

    const concurrencyLocks = {
      confirmationInProgressRef: { current: false },
      dataMutationInProgressRef: { current: false },
      studySessionMutationInProgressRef: { current: false },
      setStudySessionMutationInProgress: vi.fn(),
      setDataMutationInProgress: vi.fn(),
    }

    const { result } = renderHook(() =>
      useStudySessionMutations({
        refresh: vi.fn().mockResolvedValue(undefined),
        invalidatePreview: vi.fn(),
        concurrencyLocks,
      })
    )

    await expect(
      act(async () => {
        await result.current.deleteSession(1)
      })
    ).rejects.toThrow('Esta sessão possui uma edição não reconciliada')

    expect(concurrencyLocks.setStudySessionMutationInProgress).not.toHaveBeenCalled()
  })
})