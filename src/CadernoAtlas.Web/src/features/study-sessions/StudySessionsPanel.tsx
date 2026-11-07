import { useMemo, useState } from 'react'
import StatusMessage from '../../components/ui/StatusMessage'
import StudySessionForm from './StudySessionForm'
import StudySessionDetail from './StudySessionDetail'
import {
  getSituacaoPresentation,
  matchesSituacaoFilter,
  situacaoOptions,
  type StudySessionTransition,
  type StudySessionsPanelProps,
} from './studySessionTypes'

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).format(date).replace('.', '')
}

function formatTime(timeStr: string): string {
  return timeStr.slice(0, 5)
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins}min`
  if (mins === 0) return `${hours}h`
  return `${hours}h${String(mins).padStart(2, '0')}`
}

export default function StudySessionsPanel({
  state,
  onRetry,
  demands,
  onLoadTasks,
  onCreate,
  onReconcile,
  creationOutcomeUnknown,
  onCreationOutcomeUnknownChange,
  onUpdate,
  onReconcileEdit,
  onEditOutcomeUnknownChange,
  onTransition,
  isTransitioning,
  getErrorMessage,
}: StudySessionsPanelProps) {
  const [dataDeFilter, setDataDeFilter] = useState('')
  const [dataAteFilter, setDataAteFilter] = useState('')
  const [situacaoFilter, setSituacaoFilter] = useState('')
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [transitioningSessionId, setTransitioningSessionId] = useState<number | null>(null)
  const [transitionError, setTransitionError] = useState<string | null>(null)

  const filteredSessions = useMemo(() => {
    if (!state.data) return []
    return state.data.filter((session) => {
      if (dataDeFilter && session.dataPlanejada < dataDeFilter) return false
      if (dataAteFilter && session.dataPlanejada > dataAteFilter) return false
      if (!matchesSituacaoFilter(session.situacao, situacaoFilter)) return false
      return true
    })
  }, [state.data, dataDeFilter, dataAteFilter, situacaoFilter])

  const clearFilters = () => {
    setDataDeFilter('')
    setDataAteFilter('')
    setSituacaoFilter('')
  }

  const hasFilters = dataDeFilter || dataAteFilter || situacaoFilter
  const getDemandTitle = (id: number): string =>
    demands.find((demand) => demand.id === id)?.titulo ?? `Demanda acadêmica #${id}`

  async function handleTransition(id: number, transition: StudySessionTransition): Promise<void> {
    if (transition === 'cancelar' && !window.confirm('Cancelar esta sessão de estudo? Ela será marcada como cancelada.')) return
    if (transition === 'concluir' && !window.confirm('Concluir esta sessão de estudo?')) return
    setTransitioningSessionId(id)
    setTransitionError(null)
    try {
      await onTransition(id, transition)
    } catch (error: unknown) {
      setTransitionError(error instanceof Error ? error.message : 'Não foi possível atualizar a situação da sessão.')
    } finally {
      setTransitioningSessionId(null)
    }
  }

  return (
    <section className="panel study-sessions-panel" aria-labelledby="study-sessions-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">SESSÕES DE ESTUDO</p>
          <h2 id="study-sessions-title">Sessões de estudo</h2>
          <p className="panel-description">Consulte as sessões planejadas, em andamento, concluídas ou canceladas.</p>
        </div>
        <button className="button button-primary" type="button" onClick={() => setIsCreating(true)}>Nova sessão de estudo</button>
      </div>

      {isCreating && (
        <StudySessionForm
          mode="create"
          demands={demands}
          onLoadTasks={onLoadTasks}
          onSubmit={onCreate}
          onCancel={() => setIsCreating(false)}
          onReconcile={async () => { await onReconcile(); }}
          outcomeUnknown={creationOutcomeUnknown}
          onOutcomeUnknownChange={onCreationOutcomeUnknownChange}
        />
      )}

      <div className="study-sessions-filters" aria-label="Filtros de sessões de estudo">
        <label className="form-field">Data inicial
          <input
            aria-label="Filtrar por data inicial"
            type="date"
            value={dataDeFilter}
            onChange={(event) => setDataDeFilter(event.target.value)}
          />
        </label>
        <label className="form-field">Data final
          <input
            aria-label="Filtrar por data final"
            type="date"
            value={dataAteFilter}
            onChange={(event) => setDataAteFilter(event.target.value)}
          />
        </label>
        <label className="form-field">Filtrar situação
          <select
            aria-label="Filtrar sessões por situação"
            value={situacaoFilter}
            onChange={(event) => setSituacaoFilter(event.target.value)}
          >
            <option value="">Todas</option>
            {situacaoOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        {hasFilters && (
          <button className="button button-secondary clear-filters-button" type="button" onClick={clearFilters}>
            Limpar filtros
          </button>
        )}
      </div>

      {state.status === 'loading' && !state.data && <p role="status">Carregando sessões de estudo…</p>}
      {state.status === 'error' && !state.data && (
        <StatusMessage
          title="Não foi possível carregar as sessões de estudo"
          description={state.error ?? 'Tente novamente.'}
          onRetry={onRetry}
        />
      )}
      {state.status === 'error' && state.data && (
        <StatusMessage
          title="A lista pode estar desatualizada"
          description={state.error ?? 'Tente novamente.'}
          onRetry={onRetry}
          compact
        />
      )}
      {state.data && filteredSessions.length === 0 && (
        <div className="empty-state">
          <h3>Nenhuma sessão de estudo encontrada</h3>
          <p>{hasFilters ? 'Ajuste os filtros ou aguarde novas sessões serem criadas.' : 'As sessões de estudo aparecerão aqui quando forem cadastradas.'}</p>
        </div>
      )}
      {filteredSessions.map((session) => {
        const situacaoPresentation = getSituacaoPresentation(session.situacao)
        return (
          <article className="study-session-card" key={session.id}>
            <div className="study-session-header">
              <div>
                <h3>{session.titulo}</h3>
                <div className="study-session-meta">
                  <span className="study-session-date">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    {formatDate(session.dataPlanejada)}
                  </span>
                  <span className="study-session-time">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    {formatTime(session.horaInicioPlanejada)} ({formatDuration(session.duracaoPlanejadaMinutos)})
                  </span>
                  {session.duracaoRealMinutos !== null && session.duracaoRealMinutos !== session.duracaoPlanejadaMinutos && (
                    <span className="study-session-real-duration">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                      Real: {formatDuration(session.duracaoRealMinutos)}
                    </span>
                  )}
                </div>
              </div>
              <span className={`study-session-status ${situacaoPresentation.className}`}>
                {situacaoPresentation.label}
              </span>
            </div>

            {session.demandaAcademicaId && (
              <div className="study-session-link">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                <span><span>Demanda acadêmica #{session.demandaAcademicaId}</span> <strong>{getDemandTitle(session.demandaAcademicaId)}</strong></span>
              </div>
            )}
            {session.tarefaDemandaId && (
              <div className="study-session-link">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 11l3 3L22 4" />
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7" />
                </svg>
                <span>Tarefa #{session.tarefaDemandaId}</span>
              </div>
            )}

            <div className="study-session-actions">
              <button
                type="button"
                className="button button-secondary button-small"
                onClick={() => setSelectedSessionId(session.id)}
                aria-label={`Ver detalhes da sessão ${session.titulo}`}
              >
                Ver detalhes
              </button>
              {session.situacao === 0 && (
                <>
                  <button type="button" className="button button-primary button-small" disabled={isTransitioning || transitioningSessionId !== null} onClick={() => void handleTransition(session.id, 'iniciar')}>
                    {transitioningSessionId === session.id ? 'Iniciando…' : 'Iniciar'}
                  </button>
                  <button type="button" className="button button-secondary button-small" disabled={isTransitioning || transitioningSessionId !== null} onClick={() => void handleTransition(session.id, 'cancelar')}>
                    Cancelar
                  </button>
                </>
              )}
              {session.situacao === 1 && (
                <>
                  <button type="button" className="button button-primary button-small" disabled={isTransitioning || transitioningSessionId !== null} onClick={() => void handleTransition(session.id, 'concluir')}>
                    {transitioningSessionId === session.id ? 'Concluindo…' : 'Concluir'}
                  </button>
                  <button type="button" className="button button-secondary button-small" disabled={isTransitioning || transitioningSessionId !== null} onClick={() => void handleTransition(session.id, 'cancelar')}>
                    Cancelar
                  </button>
                </>
              )}
            </div>
            {transitionError && transitioningSessionId === null && <p className="form-error" role="alert">{transitionError}</p>}
          </article>
        )
      })}

      {selectedSessionId !== null && (
        <StudySessionDetail
          key={selectedSessionId}
          sessionId={selectedSessionId}
          onClose={() => setSelectedSessionId(null)}
          demands={demands}
          onLoadTasks={onLoadTasks}
          onUpdate={onUpdate}
          onReconcile={async () => { await onReconcileEdit(); }}
          onEditOutcomeUnknownChange={onEditOutcomeUnknownChange}
          onTransition={onTransition}
          isTransitioning={isTransitioning}
          getErrorMessage={getErrorMessage}
        />
      )}
    </section>
  )
}
