import { useEffect, useState, useRef } from 'react'
import { apiGet, isHttpError } from '../../apiClient'
import { isMutationSyncError } from '../shared/mutationOutcome'
import { useStudySessionUncertainTransitions } from './useStudySessionUncertainTransitions'
import {
  getSituacaoPresentation,
  type StudySession,
  type StudySessionDetailProps,
  type StudySessionTransition,
} from './studySessionTypes'
import StudySessionForm from './StudySessionForm'

const defaultGetErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message ? error.message : fallback

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

export default function StudySessionDetail({ sessionId, onClose, demands, onLoadTasks, onUpdate, onReconcile, onEditOutcomeUnknownChange, onTransition, isTransitioning, getErrorMessage }: StudySessionDetailProps) {
  const [session, setSession] = useState<StudySession | null>(null)
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [errorStatus, setErrorStatus] = useState<number | null>(null)
  const [editing, setEditing] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)
  const [transitioning, setTransitioning] = useState(false)
  const [transitionError, setTransitionError] = useState<string | null>(null)
  const [outcomeUnknown, setOutcomeUnknown] = useState(false)
  const [synchronizationFailed, setSynchronizationFailed] = useState(false)
  const [reconciling, setReconciling] = useState(false)
  const requestIdRef = useRef(0)
  const resolveErrorMessage = getErrorMessage ?? defaultGetErrorMessage

  // Verificar se há transição incerta persistida para esta sessão
  const { isUncertain, clearUncertain } = useStudySessionUncertainTransitions()
  const hasUncertainForSession = isUncertain(sessionId)

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

  async function handleTransition(transition: StudySessionTransition): Promise<void> {
    // Verificar se há transição incerta pendente para esta sessão
    if (hasUncertainForSession) {
      setTransitionError('Esta sessão possui uma transição não reconciliada. Reconcilie antes de tentar uma nova transição.')
      return
    }

    if (transition === 'cancelar' && !window.confirm('Cancelar esta sessão de estudo? Ela será marcada como cancelada.')) return
    if (transition === 'concluir' && !window.confirm('Concluir esta sessão de estudo?')) return
    setTransitioning(true)
    setTransitionError(null)
    setOutcomeUnknown(false)
    setSynchronizationFailed(false)
    onEditOutcomeUnknownChange(false)
    try {
      const updated = await onTransition(sessionId, transition)
      setSession(updated)
      // Sucesso - limpar estados de erro
      setOutcomeUnknown(false)
      setSynchronizationFailed(false)
      onEditOutcomeUnknownChange(false)
    } catch (transitionFailure: unknown) {
      const status = isHttpError(transitionFailure) ? transitionFailure.status : null
      if (isMutationSyncError(transitionFailure)) {
        // Operação confirmada, mas falha ao atualizar a lista
        setSynchronizationFailed(true)
        setOutcomeUnknown(false)
        onEditOutcomeUnknownChange(false)
        setTransitionError(transitionFailure.message)
      } else if (status === null || status === 408 || status === 429 || status >= 500) {
        // Resultado incerto - falha de rede ou timeout
        setOutcomeUnknown(true)
        onEditOutcomeUnknownChange(true)
        setSynchronizationFailed(false)
        setTransitionError('Não foi possível confirmar o resultado da operação. Consulte a lista antes de decidir se tentará novamente.')
      } else if (status === 404) {
        // 404 definitivo vindo da mutação: sessão não encontrada
        setOutcomeUnknown(false)
        onEditOutcomeUnknownChange(false)
        setSynchronizationFailed(false)
        setTransitionError('A sessão informada não foi encontrada.')
      } else {
        setOutcomeUnknown(false)
        onEditOutcomeUnknownChange(false)
        setSynchronizationFailed(false)
        setTransitionError(transitionFailure instanceof Error ? transitionFailure.message : 'Não foi possível atualizar a situação da sessão.')
      }
    } finally {
      setTransitioning(false)
    }
  }

  async function reconcile(): Promise<void> {
    if (reconciling) return
    setReconciling(true)
    setTransitionError(null)
    try {
      // Consultar GET /api/sessoes-estudo/{id} para obter o estado individual da sessão
      const individual = await apiGet<StudySession>(`/api/sessoes-estudo/${sessionId}`)
      setSession(individual)
      // Bloqueios só são liberados depois que o estado atual é conhecido
      clearUncertain(sessionId)
      setOutcomeUnknown(false)
      setSynchronizationFailed(false)
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
          {(outcomeUnknown || synchronizationFailed || hasUncertainForSession) && (
            <div className="task-uncertain-guidance">
              <p>{synchronizationFailed ? 'A operação foi confirmada, mas a lista não pôde ser atualizada. Consulte as sessões para sincronizar os dados; não é necessário reenviar a operação.' : 'O resultado da operação é incerto. Esta sessão possui uma transição não reconciliada. Consulte as sessões antes de tentar novamente para evitar alterações duplicadas.'}</p>
              <button className="text-button" type="button" disabled={reconciling} onClick={() => void reconcile()}>
                {reconciling ? 'Consultando sessões…' : synchronizationFailed ? 'Atualizar lista de sessões' : 'Consultar sessões antes de tentar novamente'}
              </button>
            </div>
          )}
          <div className="study-session-detail-actions">
            {session.situacao === 0 && <button className="button button-primary" type="button" disabled={transitioning || isTransitioning || outcomeUnknown || synchronizationFailed || hasUncertainForSession} onClick={() => void handleTransition('iniciar')}>{transitioning ? 'Iniciando…' : 'Iniciar sessão'}</button>}
            {session.situacao === 1 && <button className="button button-primary" type="button" disabled={transitioning || isTransitioning || outcomeUnknown || synchronizationFailed || hasUncertainForSession} onClick={() => void handleTransition('concluir')}>{transitioning ? 'Concluindo…' : 'Concluir sessão'}</button>}
            {(session.situacao === 0 || session.situacao === 1) && <button className="button button-secondary" type="button" disabled={transitioning || isTransitioning || outcomeUnknown || synchronizationFailed || hasUncertainForSession} onClick={() => void handleTransition('cancelar')}>Cancelar sessão</button>}
            {session.situacao === 0 && <button className="button button-secondary" type="button" disabled={transitioning || isTransitioning || outcomeUnknown || synchronizationFailed || hasUncertainForSession} onClick={() => setEditing(true)}>Editar sessão</button>}
            {session.situacao !== 0 && <span className="study-session-edit-notice">Sessões {getSituacaoPresentation(session.situacao).label.toLowerCase()} não podem ser editadas.</span>}
            {transitionError && <p className="form-error" role="alert">{transitionError}</p>}
            <button className="button button-secondary" onClick={onClose}>Fechar</button>
          </div>
        </div>
      </div>
    </div>
  )
}