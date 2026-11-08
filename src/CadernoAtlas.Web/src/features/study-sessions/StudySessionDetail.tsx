import { useEffect, useState, useRef, useReducer, useCallback } from 'react'
import { apiGet, isHttpError } from '../../apiClient'
import { isMutationSyncError } from '../shared/mutationOutcome'
import { useStudySessionUncertainTransitions } from './useStudySessionUncertainTransitions'
import { useStudySessionUncertainDeletions } from './useStudySessionUncertainDeletions'
import {
  getSituacaoPresentation,
  type StudySession,
  type StudySessionDetailProps,
  type StudySessionTransition,
} from './studySessionTypes'
import StudySessionForm from './StudySessionForm'

const defaultGetErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message ? error.message : fallback

interface SyncState {
  outcomeUnknown: boolean
  synchronizationFailed: boolean
  deleteSyncFailed: boolean
  sessionExistsSyncFailed: boolean
}

type SyncAction =
  | { type: 'RESET' }
  | { type: 'SET_OUTCOME_UNKNOWN' }
  | { type: 'SET_TRANSITION_SYNC_FAILED' }
  | { type: 'SET_DELETE_SYNC_FAILED' }
  | { type: 'SET_SESSION_EXISTS_SYNC_FAILED' }

const initialSyncState: SyncState = {
  outcomeUnknown: false,
  synchronizationFailed: false,
  deleteSyncFailed: false,
  sessionExistsSyncFailed: false,
}

function syncReducer(_state: SyncState, action: SyncAction): SyncState {
  switch (action.type) {
    case 'RESET':
      return initialSyncState
    case 'SET_OUTCOME_UNKNOWN':
      return {
        outcomeUnknown: true,
        synchronizationFailed: false,
        deleteSyncFailed: false,
        sessionExistsSyncFailed: false,
      }
    case 'SET_TRANSITION_SYNC_FAILED':
      return {
        outcomeUnknown: false,
        synchronizationFailed: true,
        deleteSyncFailed: false,
        sessionExistsSyncFailed: false,
      }
    case 'SET_DELETE_SYNC_FAILED':
      return {
        outcomeUnknown: false,
        synchronizationFailed: true,
        deleteSyncFailed: true,
        sessionExistsSyncFailed: false,
      }
    case 'SET_SESSION_EXISTS_SYNC_FAILED':
      return {
        outcomeUnknown: false,
        synchronizationFailed: true,
        deleteSyncFailed: false,
        sessionExistsSyncFailed: true,
      }
    default:
      // Exhaustive check - will cause TypeScript error if new action types are added without handling
      const _exhaustive: never = action
      return _exhaustive
  }
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(date)
}

function formatTime(timeStr: string): string {
  return timeStr.slice(0, 5)
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins} min`
  if (mins === 0) return `${hours} h`
  return `${hours} h ${String(mins).padStart(2, '0')} min`
}

function formatDateTime(dateTimeStr: string | null): string | null {
  if (!dateTimeStr) return null
  const date = new Date(dateTimeStr)
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export default function StudySessionDetail({
  sessionId,
  onClose,
  demands,
  onLoadTasks,
  onUpdate,
  onReconcile,
  onEditOutcomeUnknownChange,
  onTransition,
  onDelete,
  isTransitioning,
  isUncertain: isUncertainProp,
  isDeleteUncertain: isDeleteUncertainProp,
  onReconcileDelete,
  getErrorMessage,
}: StudySessionDetailProps) {
  const [session, setSession] = useState<StudySession | null>(null)
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [errorStatus, setErrorStatus] = useState<number | null>(null)
  const [editing, setEditing] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)
  const [transitioning, setTransitioning] = useState(false)
  const [transitionError, setTransitionError] = useState<string | null>(null)
  const [{ outcomeUnknown, synchronizationFailed, deleteSyncFailed, sessionExistsSyncFailed }, dispatchSync] =
    useReducer(syncReducer, initialSyncState)
  const [reconciling, setReconciling] = useState(false)
  const requestIdRef = useRef(0)
  const resolveErrorMessage = getErrorMessage ?? defaultGetErrorMessage
  const reconcileDeleteAction = onReconcileDelete ?? onReconcile

  // Verificar se há transição incerta persistida para esta sessão
  const { isUncertain: isUncertainHook, clearUncertain } = useStudySessionUncertainTransitions()
  const hasUncertainForSession = isUncertainHook(sessionId) || isUncertainProp(sessionId)

  // Verificar se há exclusão incerta persistida para esta sessão
  const { isDeleteUncertain: isDeleteUncertainHook, clearDeleteUncertain } = useStudySessionUncertainDeletions()
  const hasDeleteUncertainForSession = isDeleteUncertainHook(sessionId) || isDeleteUncertainProp(sessionId)

  const handleDeleteSyncFailure = useCallback((message: string) => {
    dispatchSync({ type: 'SET_DELETE_SYNC_FAILED' })
    onEditOutcomeUnknownChange(false)
    setTransitionError(message)
  }, [onEditOutcomeUnknownChange])

  const shouldShowDeleteWarning =
    hasDeleteUncertainForSession ||
    deleteSyncFailed ||
    sessionExistsSyncFailed

  const shouldShowSyncGuidance =
    outcomeUnknown ||
    synchronizationFailed ||
    shouldShowDeleteWarning ||
    hasUncertainForSession

  const isAnyMutationBlocked =
    transitioning ||
    isTransitioning ||
    outcomeUnknown ||
    synchronizationFailed ||
    deleteSyncFailed ||
    sessionExistsSyncFailed ||
    hasUncertainForSession ||
    hasDeleteUncertainForSession

  const isDeleteBlocked = isAnyMutationBlocked

  const getGuidanceMessage = (): string => {
    if (sessionExistsSyncFailed) {
      return 'A sessão ainda existe. Consulte as sessões para sincronizar os dados.'
    }
    if (deleteSyncFailed) {
      return 'A exclusão foi confirmada, mas a lista não pôde ser atualizada. Atualize a listagem para sincronizar.'
    }
    if (hasDeleteUncertainForSession) {
      return 'O resultado da exclusão é incerto. Esta sessão possui uma exclusão não reconciliada. Consulte a sessão antes de tentar novamente.'
    }
    if (synchronizationFailed) {
      return 'A operação foi confirmada, mas a lista não pôde ser atualizada. Consulte as sessões para sincronizar os dados; não é necessário reenviar a operação.'
    }
    return 'O resultado da operação é incerto. Esta sessão possui uma transição não reconciliada. Consulte as sessões antes de tentar novamente para evitar alterações duplicadas.'
  }

  const getGuidanceButtonLabel = (): string => {
    if (reconciling) return 'Consultando sessão…'
    if (synchronizationFailed || deleteSyncFailed || sessionExistsSyncFailed) {
      return 'Atualizar lista de sessões'
    }
    if (hasDeleteUncertainForSession) {
      return 'Consultar sessão antes de tentar novamente'
    }
    return 'Consultar sessões antes de tentar novamente'
  }

  const handleTransition = useCallback(async (transition: StudySessionTransition): Promise<void> => {
    // Verificar se há transição incerta pendente para esta sessão
    if (hasUncertainForSession) {
      setTransitionError('Esta sessão possui uma transição não reconciliada. Reconcilie antes de tentar uma nova transição.')
      return
    }

    if (transition === 'cancelar' && !window.confirm('Cancelar esta sessão de estudo? Ela será marcada como cancelada.')) return
    if (transition === 'concluir' && !window.confirm('Concluir esta sessão de estudo?')) return
    setTransitioning(true)
    setTransitionError(null)
    dispatchSync({ type: 'RESET' })
    onEditOutcomeUnknownChange(false)
    try {
      const updated = await onTransition(sessionId, transition)
      setSession(updated)
      // Sucesso - limpar estados de erro
      dispatchSync({ type: 'RESET' })
      onEditOutcomeUnknownChange(false)
    } catch (transitionFailure: unknown) {
      const status = isHttpError(transitionFailure) ? transitionFailure.status : null
      if (isMutationSyncError(transitionFailure)) {
        // Operação confirmada, mas falha ao atualizar a lista
        dispatchSync({ type: 'SET_TRANSITION_SYNC_FAILED' })
        onEditOutcomeUnknownChange(false)
        setTransitionError(transitionFailure.message)
      } else if (status === null || status === 408 || status === 429 || status >= 500) {
        // Resultado incerto - falha de rede ou timeout
        dispatchSync({ type: 'SET_OUTCOME_UNKNOWN' })
        onEditOutcomeUnknownChange(true)
        setTransitionError('Não foi possível confirmar o resultado da operação. Consulte a lista antes de decidir se tentará novamente.')
      } else if (status === 404) {
        // 404 definitivo vindo da mutação: sessão não encontrada
        dispatchSync({ type: 'RESET' })
        onEditOutcomeUnknownChange(false)
        setTransitionError('A sessão informada não foi encontrada.')
      } else {
        dispatchSync({ type: 'RESET' })
        onEditOutcomeUnknownChange(false)
        setTransitionError(transitionFailure instanceof Error ? transitionFailure.message : 'Não foi possível atualizar a situação da sessão.')
      }
    } finally {
      setTransitioning(false)
    }
  }, [hasUncertainForSession, onEditOutcomeUnknownChange, onTransition, sessionId])

  const reconcileDelete = useCallback(async (): Promise<void> => {
    if (reconciling) return
    setReconciling(true)
    setTransitionError(null)
    try {
      // Consultar GET /api/sessoes-estudo/{id} para verificar estado atual
      const individual = await apiGet<StudySession>(`/api/sessoes-estudo/${sessionId}`)
      // 200: sessão ainda existe - a exclusão NÃO foi confirmada
      setSession(individual)
      // Bloqueios só são liberados depois que o estado atual é conhecido
      clearUncertain(sessionId)
      clearDeleteUncertain(sessionId)
      dispatchSync({ type: 'RESET' })
      onEditOutcomeUnknownChange(false)
      // Se ainda for planejada (situacao === 0), permitir nova tentativa
      if (individual.situacao !== 0) {
        setTransitionError('Esta sessão não está mais planejada e não pode ser excluída.')
      }
      try {
        await reconcileDeleteAction()
        // Sucesso na atualização da lista - limpar estados de falha
        dispatchSync({ type: 'RESET' })
        setTransitionError(null)
      } catch {
        // Falha ao atualizar lista - a sessão ainda existe (GET retornou 200)
        dispatchSync({ type: 'SET_SESSION_EXISTS_SYNC_FAILED' })
        setTransitionError('A sessão ainda existe, mas a lista não pôde ser atualizada. Atualize a listagem para sincronizar.')
      }
    } catch (reconcileError: unknown) {
      if (isHttpError(reconcileError) && reconcileError.status === 404) {
        // 404: exclusão confirmada - sessão não existe mais
        clearUncertain(sessionId)
        clearDeleteUncertain(sessionId)
        dispatchSync({ type: 'RESET' })
        onEditOutcomeUnknownChange(false)
        try {
          await reconcileDeleteAction()
          // Sucesso total - exclusão confirmada e lista sincronizada
          setTransitionError(null)
          onClose()
        } catch (syncError: unknown) {
          // Falha ao atualizar lista não anula a confirmação, mas mostra mensagem
          // Manter modal aberto para permitir nova tentativa de sincronização
          handleDeleteSyncFailure(
            `A exclusão foi confirmada, mas a lista não pôde ser atualizada. ${syncError instanceof Error ? syncError.message : 'Atualize a listagem para sincronizar.'}`
          )
        }
        return
      }
      // Falha de rede (408, 429, 5xx) ou outros erros: preservar incerteza
      // Não limpar outcomeUnknown - usuário deve poder tentar reconciliação novamente
      setTransitionError(resolveErrorMessage(reconcileError, 'Não foi possível consultar a sessão. Tente novamente.'))
    } finally {
      setReconciling(false)
    }
  }, [
    reconciling,
    sessionId,
    clearUncertain,
    clearDeleteUncertain,
    onEditOutcomeUnknownChange,
    reconcileDeleteAction,
    onClose,
    handleDeleteSyncFailure,
    resolveErrorMessage,
  ])

  const handleDelete = useCallback(async (): Promise<void> => {
    // Verificar se há transição incerta pendente para esta sessão
    if (hasUncertainForSession) {
      setTransitionError('Esta sessão possui uma transição não reconciliada. Reconcilie antes de tentar excluir.')
      return
    }
    // Verificar se há exclusão incerta pendente para esta sessão
    if (hasDeleteUncertainForSession) {
      setTransitionError('Esta sessão possui uma exclusão não reconciliada. Consulte a sessão antes de tentar novamente.')
      return
    }

    if (!window.confirm('Excluir esta sessão de estudo planejada? Esta ação não pode ser desfeita.')) return
    setTransitioning(true)
    setTransitionError(null)
    dispatchSync({ type: 'RESET' })
    onEditOutcomeUnknownChange(false)
    try {
      await onDelete(sessionId)
      // Sucesso na exclusão:
      // 1. Limpar estados de erro e sincronização relacionados à operação
      dispatchSync({ type: 'RESET' })
      setTransitionError(null)
      onEditOutcomeUnknownChange(false)
      // 2. Limpar informações temporárias de incerteza
      clearDeleteUncertain(sessionId)
      clearUncertain(sessionId)
      // 3. Executar onClose somente após a limpeza necessária
      onClose()
    } catch (deleteFailure: unknown) {
      const status = isHttpError(deleteFailure) ? deleteFailure.status : null
      if (isMutationSyncError(deleteFailure)) {
        // Operação confirmada, mas falha ao atualizar a lista
        handleDeleteSyncFailure(deleteFailure.message)
      } else if (status === 404) {
        // 404 definitivo do DELETE: sessão não encontrada - reconciliação explícita
        await reconcileDelete()
      } else if (status === null || status === 408 || status === 429 || status >= 500) {
        // Resultado incerto - falha de rede ou timeout
        dispatchSync({ type: 'SET_OUTCOME_UNKNOWN' })
        onEditOutcomeUnknownChange(true)
        setTransitionError('Não foi possível confirmar o resultado da exclusão. Consulte a sessão antes de tentar novamente.')
      } else if (status === 409) {
        // 409: sessão não é planejada
        dispatchSync({ type: 'RESET' })
        onEditOutcomeUnknownChange(false)
        setTransitionError(deleteFailure instanceof Error ? deleteFailure.message : 'Não é possível excluir esta sessão.')
      } else {
        dispatchSync({ type: 'RESET' })
        onEditOutcomeUnknownChange(false)
        setTransitionError(deleteFailure instanceof Error ? deleteFailure.message : 'Não foi possível excluir a sessão.')
      }
    } finally {
      setTransitioning(false)
    }
  }, [
    hasUncertainForSession,
    hasDeleteUncertainForSession,
    onEditOutcomeUnknownChange,
    onDelete,
    sessionId,
    clearDeleteUncertain,
    clearUncertain,
    onClose,
    handleDeleteSyncFailure,
    reconcileDelete,
  ])

  const reconcile = useCallback(async (): Promise<void> => {
    if (reconciling) return
    setReconciling(true)
    setTransitionError(null)
    try {
      // Consultar GET /api/sessoes-estudo/{id} para obter o estado individual da sessão
      const individual = await apiGet<StudySession>(`/api/sessoes-estudo/${sessionId}`)
      setSession(individual)
      // Bloqueios só são liberados depois que o estado atual é conhecido
      clearUncertain(sessionId)
      dispatchSync({ type: 'RESET' })
      onEditOutcomeUnknownChange(false)
      try {
        await onReconcile()
      } catch {
        // Falha ao atualizar lista não anula a confirmação do estado individual
      }
    } catch (reconcileError: unknown) {
      setTransitionError(resolveErrorMessage(reconcileError, 'Não foi possível consultar as sessões. Tente novamente.'))
    } finally {
      setReconciling(false)
    }
  }, [
    reconciling,
    sessionId,
    clearUncertain,
    onEditOutcomeUnknownChange,
    onReconcile,
    resolveErrorMessage,
  ])

  useEffect(() => {
    const controller = new AbortController()
    const requestId = ++requestIdRef.current

    apiGet<StudySession>(`/api/sessoes-estudo/${sessionId}`, controller.signal)
      .then((data) => {
        if (requestId !== requestIdRef.current) return
        setSession(data)
        setStatus('success')
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        if (requestId !== requestIdRef.current) return
        if (isHttpError(err)) {
          setErrorStatus(err.status)
        }
        const message = resolveErrorMessage(err, 'Não foi possível carregar os detalhes da sessão.')
        setError(message)
        setStatus('error')
      })

    return () => controller.abort()
  }, [sessionId, reloadToken, resolveErrorMessage])

  if (status === 'loading') {
    return (
      <div className="study-session-detail-overlay" role="dialog" aria-modal="true" aria-labelledby="detail-title">
        <div className="study-session-detail-panel">
          <div className="study-session-detail-header">
            <h2 id="detail-title">Carregando…</h2>
          </div>
          <div className="study-session-detail-content" role="status">
            <div className="loading-spinner" aria-label="Carregando detalhes da sessão" />
          </div>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    const isNotFound = errorStatus === 404
    return (
      <div className="study-session-detail-overlay" role="dialog" aria-modal="true" aria-labelledby="detail-title">
        <div className="study-session-detail-panel">
          <div className="study-session-detail-header">
            <h2 id="detail-title">{isNotFound ? 'Sessão não encontrada' : 'Erro ao carregar'}</h2>
            <button className="icon-button" onClick={onClose} aria-label="Fechar">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="study-session-detail-content">
            <div className="status-message status-message-compact" role="alert">
              <svg className="status-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m10.3 3.9-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.1l-8-14a2 2 0 0 0-3.4 0Z" />
                <path d="M12 9v4m0 4h.01" />
              </svg>
              <div className="status-copy">
                <strong>{isNotFound ? 'A sessão informada não foi encontrada' : 'Não foi possível carregar a sessão'}</strong>
                <p>{isNotFound ? 'A sessão de estudo solicitada não existe ou foi removida.' : error}</p>
                <button className="text-button" onClick={onClose}>Fechar</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  if (editing && session.situacao === 0) {
    return (
      <div className="study-session-detail-overlay" role="dialog" aria-modal="true" aria-labelledby="detail-title">
        <div className="study-session-detail-panel">
          <StudySessionForm
            mode="edit"
            initialValue={{
              titulo: session.titulo,
              dataPlanejada: session.dataPlanejada,
              horaInicioPlanejada: session.horaInicioPlanejada,
              duracaoPlanejadaMinutos: session.duracaoPlanejadaMinutos,
              demandaAcademicaId: session.demandaAcademicaId,
              tarefaDemandaId: session.tarefaDemandaId,
              observacoes: session.observacoes,
            }}
            demands={demands}
            onLoadTasks={onLoadTasks}
            onSubmit={async (request) => {
              await onUpdate(session.id, request)
              setEditing(false)
              setReloadToken((value) => value + 1)
            }}
            onCancel={() => setEditing(false)}
            onReconcile={onReconcile}
            outcomeUnknown={false}
            onOutcomeUnknownChange={onEditOutcomeUnknownChange}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="study-session-detail-overlay" role="dialog" aria-modal="true" aria-labelledby="detail-title">
      <div className="study-session-detail-panel">
        <div className="study-session-detail-header">
          <h2 id="detail-title">{session.titulo}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Fechar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="study-session-detail-content">
          <dl className="study-session-detail-grid">
            <div className="detail-row">
              <dt>Situação</dt>
              <dd>
                <span className={`study-session-status ${getSituacaoPresentation(session.situacao).className}`}>
                  {getSituacaoPresentation(session.situacao).label}
                </span>
              </dd>
            </div>
            <div className="detail-row">
              <dt>Data planejada</dt>
              <dd>{formatDate(session.dataPlanejada)}</dd>
            </div>
            <div className="detail-row">
              <dt>Horário de início</dt>
              <dd>{formatTime(session.horaInicioPlanejada)}</dd>
            </div>
            <div className="detail-row">
              <dt>Duração planejada</dt>
              <dd>{formatDuration(session.duracaoPlanejadaMinutos)}</dd>
            </div>
            {session.duracaoRealMinutos !== null && (
              <div className="detail-row">
                <dt>Duração real</dt>
                <dd>{formatDuration(session.duracaoRealMinutos)}</dd>
              </div>
            )}
            {session.demandaAcademicaId !== null && (
              <div className="detail-row">
                <dt>Demanda acadêmica</dt>
                <dd><span>#{session.demandaAcademicaId}</span> {demands.find((demand) => demand.id === session.demandaAcademicaId)?.titulo ?? 'Demanda acadêmica'}</dd>
              </div>
            )}
            {session.tarefaDemandaId !== null && (
              <div className="detail-row">
                <dt>Tarefa</dt>
                <dd>#{session.tarefaDemandaId}</dd>
              </div>
            )}
            {session.observacoes && (
              <div className="detail-row detail-row-full">
                <dt>Observações</dt>
                <dd>{session.observacoes}</dd>
              </div>
            )}
            <div className="detail-row">
              <dt>Criada em</dt>
              <dd>{formatDateTime(session.criadoEm)}</dd>
            </div>
            {session.inicioRealEm && (
              <div className="detail-row">
                <dt>Iniciada em</dt>
                <dd>{formatDateTime(session.inicioRealEm)}</dd>
              </div>
            )}
            {session.concluidaEm && (
              <div className="detail-row">
                <dt>Concluída em</dt>
                <dd>{formatDateTime(session.concluidaEm)}</dd>
              </div>
            )}
            {session.canceladaEm && (
              <div className="detail-row">
                <dt>Cancelada em</dt>
                <dd>{formatDateTime(session.canceladaEm)}</dd>
              </div>
            )}
          </dl>
          {shouldShowSyncGuidance && (
            <div className="task-uncertain-guidance" role="status" aria-live="polite">
              <p>{getGuidanceMessage()}</p>
              <button
                className="text-button"
                type="button"
                disabled={reconciling}
                onClick={() => void (shouldShowDeleteWarning ? reconcileDelete() : reconcile())}
              >
                {getGuidanceButtonLabel()}
              </button>
            </div>
          )}
          <div className="study-session-detail-actions">
            {session.situacao === 0 && (
              <button
                className="button button-primary"
                type="button"
                disabled={isAnyMutationBlocked}
                onClick={() => void handleTransition('iniciar')}
              >
                {transitioning ? 'Iniciando…' : 'Iniciar sessão'}
              </button>
            )}
            {session.situacao === 1 && (
              <button
                className="button button-primary"
                type="button"
                disabled={isAnyMutationBlocked}
                onClick={() => void handleTransition('concluir')}
              >
                {transitioning ? 'Concluindo…' : 'Concluir sessão'}
              </button>
            )}
            {(session.situacao === 0 || session.situacao === 1) && (
              <button
                className="button button-secondary"
                type="button"
                disabled={isAnyMutationBlocked}
                onClick={() => void handleTransition('cancelar')}
              >
                Cancelar sessão
              </button>
            )}
            {session.situacao === 0 && (
              <button
                className="button button-secondary"
                type="button"
                disabled={isAnyMutationBlocked}
                onClick={() => setEditing(true)}
              >
                Editar sessão
              </button>
            )}
            {session.situacao === 0 && (
              <button
                className="button button-secondary button-danger"
                type="button"
                disabled={isDeleteBlocked}
                onClick={() => void handleDelete()}
              >
                {transitioning ? 'Excluindo…' : 'Excluir sessão'}
              </button>
            )}
            {session.situacao !== 0 && (
              <span className="study-session-edit-notice">
                Sessões {getSituacaoPresentation(session.situacao).label.toLowerCase()} não podem ser editadas.
              </span>
            )}
            {transitionError && <p className="form-error" role="alert">{transitionError}</p>}
            <button className="button button-secondary" onClick={onClose}>Fechar</button>
          </div>
        </div>
      </div>
    </div>
  )
}