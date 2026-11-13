import { useStudySessionsData } from '../features/study-sessions/useStudySessionsData'
import type { LoadState } from '../features/shared/loadState'
import type { StudySessionListItem } from '../features/study-sessions/studySessionTypes'
import StatusMessage from '../components/ui/StatusMessage'
import EmptyState from '../components/ui/EmptyState'

interface DashboardProps {
  sessionsState: LoadState<StudySessionListItem[]>
  weekStart: Date
  onNavigateToSessions: () => void
  onRetry: () => void
}

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
  if (hours === 0) return `${mins} min`
  if (mins === 0) return `${hours} h`
  return `${hours} h ${String(mins).padStart(2, '0')} min`
}

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins} min`
  if (mins === 0) return `${hours} h`
  return `${hours} h ${String(mins).padStart(2, '0')} min`
}

export function Dashboard({ sessionsState, weekStart, onNavigateToSessions, onRetry }: DashboardProps) {
  const {
    plannedCount,
    completedThisWeek,
    totalPlannedMinutes,
    nextSession,
    distributionByDemand,
    upcomingSessions,
    isLoading,
    isError,
    errorMessage,
  } = useStudySessionsData({ sessionsState, weekStart })

  if (isLoading) {
    return (
      <div className="dashboard-scope">
        <div className="container-fluid py-3" role="status" aria-label="Carregando dashboard">
          <div className="d-flex justify-content-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Carregando dashboard</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="dashboard-scope">
        <div className="container-fluid py-3">
          <StatusMessage
            title="Erro ao carregar sessões"
            description={errorMessage ?? 'Tente novamente.'}
            onRetry={onRetry}
            variant="danger"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-scope">
      <div className="container-fluid py-3">
        <h2 className="h3 mb-3">Visão geral</h2>

        {/* Linha de KPIs */}
        <div className="row g-3 mb-4" aria-label="Indicadores principais">
          <div className="col-12 col-sm-6 col-lg-3">
            <div className="card h-100">
              <div className="card-body">
                <div className="text-muted small">Sessões planejadas</div>
                <div className="fs-3 fw-semibold text-primary">{plannedCount}</div>
              </div>
            </div>
          </div>
          <div className="col-12 col-sm-6 col-lg-3">
            <div className="card h-100">
              <div className="card-body">
                <div className="text-muted small">Concluídas nesta semana</div>
                <div className="fs-3 fw-semibold text-success">{completedThisWeek}</div>
              </div>
            </div>
          </div>
          <div className="col-12 col-sm-6 col-lg-3">
            <div className="card h-100">
              <div className="card-body">
                <div className="text-muted small">Tempo total planejado</div>
                <div className="fs-3 fw-semibold text-info">{formatMinutes(totalPlannedMinutes)}</div>
              </div>
            </div>
          </div>
          <div className="col-12 col-sm-6 col-lg-3">
            <div className="card h-100">
              <div className="card-body">
                <div className="text-muted small">Próxima sessão</div>
                <div className="fs-3 fw-semibold text-dark">
                  {nextSession ? (
                    <>
                      {formatDate(nextSession.dataPlanejada)} <span className="fw-normal fs-6 text-muted">às {formatTime(nextSession.horaInicioPlanejada)}</span>
                    </>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Conteúdo principal */}
        <div className="row g-3">
          <div className="col-12 col-lg-8">
            <div className="card">
              <div className="card-header d-flex justify-content-between align-items-center">
                <span>Sessões planejadas da semana</span>
                <button className="btn btn-sm btn-outline-secondary" type="button" aria-label="Ir para sessões de estudo" onClick={onNavigateToSessions}>
                  Ver todas
                </button>
              </div>
              <div className="card-body p-0">
                {upcomingSessions.length === 0 ? (
                  <EmptyState
                    title="Nenhuma sessão planejada para esta semana"
                    description="Cadastre sua primeira sessão de estudo para começar."
                    icon="calendar"
                  />
                ) : (
                  <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0" aria-label="Próximas sessões planejadas">
                      <thead className="table-light">
                        <tr>
                          <th scope="col">Sessão</th>
                          <th scope="col">Data</th>
                          <th scope="col">Horário</th>
                          <th scope="col">Duração</th>
                          <th scope="col">Demanda</th>
                        </tr>
                      </thead>
                      <tbody>
                        {upcomingSessions.map((session) => (
                          <tr key={session.id}>
                            <td>
                              <strong>{session.titulo}</strong>
                            </td>
                            <td>{formatDate(session.dataPlanejada)}</td>
                            <td>{formatTime(session.horaInicioPlanejada)}</td>
                            <td>{formatDuration(session.duracaoPlanejadaMinutos)}</td>
                            <td>
                              {session.demandaAcademicaId ? (
                                <span className="badge bg-light text-dark">Demanda #{session.demandaAcademicaId}</span>
                              ) : (
                                <span className="text-muted">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="col-12 col-lg-4">
            <div className="card h-100">
              <div className="card-header">Distribuição por demanda</div>
              <div className="card-body">
                {distributionByDemand.length === 0 ? (
                  <div className="text-center text-muted py-3">
                    Nenhuma sessão planejada para distribuir.
                  </div>
                ) : (
                  distributionByDemand.map((item, index) => (
                    <div key={index} className="mb-3">
                      <div className="d-flex justify-content-between small mb-1">
                        <span>{item.demandTitle}</span>
                        <span>{item.percentage}%</span>
                      </div>
                      <div className="progress" style={{ height: '8px' }} role="progressbar" aria-valuenow={item.percentage} aria-valuemin={0} aria-valuemax={100} aria-label={`${item.demandTitle}: ${item.percentage}% das sessões planejadas`}>
                        <div className="progress-bar bg-primary" style={{ width: `${item.percentage}%` }} />
                      </div>
                      <div className="small text-muted mt-1">{item.count} sessão{item.count !== 1 ? 'ões' : ''}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}