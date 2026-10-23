import { useState } from 'react'
import './App.css'
import PlanningPreview from './features/planning/PlanningPreview'
import Icon from './components/ui/Icon'
import StatusMessage from './components/ui/StatusMessage'

import {
  apiGet,
  apiPost,
} from './apiClient'

import CreateDemandForm from './features/demands/CreateDemandForm'
import ManageDemandsPanel from './features/demands/ManageDemandsPanel'
import type { DemandTask } from './features/demands/ManageDemandTasks'
import DemandCard from './features/demands/DemandCard'
import AvailabilityPanel from './features/availability/AvailabilityPanel'
import type { Availability, CreateAvailabilityRequest } from './features/availability/availabilityTypes'
import type { LoadState } from './features/shared/loadState'
import { usePlanningWorkflow } from './features/planning/usePlanningWorkflow'
import { useDemandMutations } from './features/demands/useDemandMutations'
import { useDemandList } from './features/demands/useDemandList'
import { useConcurrencyLocks } from './features/shared/useConcurrencyLocks'
import { getInitialWeek, toIsoDate, useWeekNavigation } from './features/planning/useWeekNavigation'

import {
  formatMinutes,
  formatWeekRange,
  minutesFromTime,
} from './utils/planningFormatters'

interface LoadingLinesProps {
  count?: number
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

function loadDemandTasks(demandId: number, signal: AbortSignal): Promise<DemandTask[]> {
  return apiGet<DemandTask[]>(`/api/demandas-academicas/${demandId}/tarefas`, signal)
}

function LoadingLines({ count = 3 }: LoadingLinesProps) {
  return (
    <div className="loading-lines" aria-label="Carregando dados" role="status">
      {Array.from({ length: count }, (_, index) => (
        <div className="loading-row" key={index}>
          <span className="skeleton skeleton-icon" />
          <span className="loading-row-copy">
            <span className="skeleton skeleton-title" />
            <span className="skeleton skeleton-detail" />
          </span>
        </div>
      ))}
    </div>
  )
}

function App() {
  const [activeSection, setActiveSection] = useState<'planning' | 'demands'>('planning')
  const [availabilityState, setAvailabilityState] = useState<LoadState<Availability[]>>({ status: 'loading', data: null, error: null })
  const [availabilityReloadToken, setAvailabilityReloadToken] = useState(0)
  const [isDemandFormOpen, setIsDemandFormOpen] = useState(false)
  const [isCreatingAvailability, setIsCreatingAvailability] = useState(false)

  // Week navigation state is owned by App and shared with the navigation hook.
  // Keeping one source of truth ensures the panels and API query use the same week.
  // Navigation callbacks still invalidate the current planning preview.
  const [monday, setMonday] = useState(getInitialWeek)
  const [todayIso] = useState(() => toIsoDate(new Date()))
  const mondayIso = toIsoDate(monday)

  const concurrencyLocks = useConcurrencyLocks()

  const {
    demandState,
    allDemandsState,
    setDemandState,
    setAllDemandsState,
    setDemandReloadToken,
    setAllDemandsReloadToken,
  } = useDemandList({
    apiGet,
    getErrorMessage,
  })

  const {
    previewState,
    confirmState,
    isConfirming,
    generatePreview,
    confirmPreview,
    clearPreview,
    invalidatePreview,
  } = usePlanningWorkflow({
    mondayIso,
    concurrencyLocks,
    onRefreshAllDataOnly: refreshAllDataOnly,
    getErrorMessage,
  })

  const {
    changeWeek,
    selectCurrentWeek,
  } = useWeekNavigation({
    monday,
    setMonday,
    concurrencyLocks,
    clearPreview,
    setAvailabilityState,
    availabilityReloadToken,
    getErrorMessage,
  })

  const {
    isCreatingDemand,
    isUpdatingDemand,
    isCreatingTask,
    isUpdatingTask,
    isDeletingTask,
    createDemand,
    updateDemand,
    createDemandTask,
    updateDemandTask,
    deleteDemandTask,
  } = useDemandMutations({
    concurrencyLocks,
    invalidatePreview,
    clearPreview,
    refreshAllDemands,
    setDemandState,
    setAllDemandsState,
    setDemandReloadToken,
    setAllDemandsReloadToken,
  })

  const activeDemandCount = (demandState.data ?? []).length
  const needsEstimateCount = (demandState.data ?? []).filter((item) => {
    const demand = item.demanda ?? item
    return demand.esforcoEstimadoMinutos == null
  }).length
  const totalAvailabilityMinutes = (availabilityState.data ?? []).reduce((total, item) => {
    return total + Math.max(0, minutesFromTime(item.horaFim) - minutesFromTime(item.horaInicio))
  }, 0)

  function refreshAll(): void {
    if (
      concurrencyLocks.demandCreationInProgressRef.current ||
      concurrencyLocks.availabilityCreationInProgressRef.current ||
      concurrencyLocks.confirmationInProgressRef.current ||
      concurrencyLocks.demandUpdateInProgressRef.current ||
      concurrencyLocks.taskMutationInProgressRef.current
    ) {
      return
    }

    clearPreview()
    setDemandState((previous) => ({ ...previous, status: 'loading', error: null }))
    setAvailabilityState((previous) => ({ ...previous, status: 'loading', error: null }))
    setDemandReloadToken((value) => value + 1)
    setAvailabilityReloadToken((value) => value + 1)
  }

  function refreshDemands(): void {
    if (concurrencyLocks.confirmationInProgressRef.current || concurrencyLocks.demandUpdateInProgressRef.current || concurrencyLocks.taskMutationInProgressRef.current) return

    clearPreview()
    setDemandState((previous) => ({
      ...previous,
      status: 'loading',
      error: null,
    }))
    setDemandReloadToken((value) => value + 1)
  }

  function refreshAllDemands(): void {
    if (concurrencyLocks.demandUpdateInProgressRef.current || concurrencyLocks.taskMutationInProgressRef.current || concurrencyLocks.confirmationInProgressRef.current) return
    setAllDemandsState((previous) => ({ ...previous, status: 'loading', error: null }))
    setAllDemandsReloadToken((value) => value + 1)
  }

  function refreshAvailability(): void {
    if (concurrencyLocks.confirmationInProgressRef.current || concurrencyLocks.demandUpdateInProgressRef.current || concurrencyLocks.taskMutationInProgressRef.current) return

    clearPreview()
    setAvailabilityState((previous) => ({
      ...previous,
      status: 'loading',
      error: null,
    }))
    setAvailabilityReloadToken((value) => value + 1)
  }

  async function createAvailability(request: CreateAvailabilityRequest): Promise<void> {
    if (concurrencyLocks.availabilityCreationInProgressRef.current) {
      throw new Error('Já existe um cadastro de disponibilidade em andamento.')
    }
    if (concurrencyLocks.confirmationInProgressRef.current || concurrencyLocks.demandUpdateInProgressRef.current || concurrencyLocks.taskMutationInProgressRef.current) {
      throw new Error('Aguarde a confirmação do planejamento antes de cadastrar uma disponibilidade.')
    }

    concurrencyLocks.setAvailabilityCreationInProgress(true)
    setIsCreatingAvailability(true)

    try {
      await apiPost<Availability, CreateAvailabilityRequest>(
        '/api/disponibilidades-estudo',
        request,
      )
      clearPreview()
      setAvailabilityState((previous) => ({ ...previous, status: 'loading', error: null }))
      setAvailabilityReloadToken((value) => value + 1)
    } finally {
      concurrencyLocks.setAvailabilityCreationInProgress(false)
      setIsCreatingAvailability(false)
    }
  }

  function refreshAllDataOnly(): void {
    setDemandState((previous) => ({ ...previous, status: 'loading', error: null }))
    setAvailabilityState((previous) => ({ ...previous, status: 'loading', error: null }))
    setDemandReloadToken((value) => value + 1)
    setAvailabilityReloadToken((value) => value + 1)
  }

  const isTaskMutationInProgress = isCreatingTask || isUpdatingTask

  return (
    <div className="app-shell">
      <a className="skip-link" href="#planejamento">Pular para o conteúdo</a>
      <aside className="sidebar">
        <a className="brand" href="#planejamento" aria-label="CadernoAtlas, planejamento semanal" onClick={() => setActiveSection('planning')}>
          <span className="brand-mark"><span /><span /><span /></span>
          <span className="brand-wordmark">Caderno<span>Atlas</span></span>
        </a>

        <div className="sidebar-section-label">ESPAÇO DE ESTUDO</div>
        <nav className="side-nav" aria-label="Navegação principal">
          <button className={`nav-item nav-item-button ${activeSection === 'planning' ? 'nav-item-active' : ''}`} type="button" aria-current={activeSection === 'planning' ? 'page' : undefined} onClick={() => setActiveSection('planning')} aria-label="Planejamento semanal">
            <Icon name="calendar" size={18} />
            <span>Planejamento semanal</span>
          </button>
          <button className={`nav-item nav-item-button ${activeSection === 'demands' ? 'nav-item-active' : ''}`} type="button" aria-current={activeSection === 'demands' ? 'page' : undefined} onClick={() => setActiveSection('demands')} aria-label="Demandas acadêmicas">
            <Icon name="book" size={18} />
            <span>Demandas acadêmicas</span>
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-note-mark"><Icon name="check" size={17} /></div>
          <p>Uma semana possível.</p>
          <span>Seu planejamento deve caber na sua rotina, não o contrário.</span>
          <div className="sidebar-version">CADERNOATLAS <span>·</span> MVP</div>
        </div>
      </aside>

      <main className="main-area" id="planejamento" tabIndex={-1}>
        <header className="topbar">
          <span className="breadcrumb">{activeSection === 'planning' ? <>Planejamento <span>/</span> Visão semanal</> : <>Demandas acadêmicas <span>/</span> Gestão</>}</span>
          <div className="topbar-status"><span className="status-dot" /> Dados da API</div>
        </header>

        <div className="page-content">
          <div hidden={activeSection !== 'planning'}>
          <section className="page-heading">
            <div>
              <p className="eyebrow">SEU ESPAÇO DE ESTUDO</p>
              <h1>Planejamento semanal</h1>
              <p className="page-subtitle">Organize suas demandas em uma semana possível.</p>
            </div>
            <div className="page-heading-actions">
              <button className="button button-secondary refresh-button" onClick={refreshAll} disabled={isCreatingDemand || isConfirming || isCreatingAvailability || isUpdatingDemand || isTaskMutationInProgress}>
                <Icon name="refresh" size={16} />
                <span>Atualizar dados</span>
              </button>
              <button className="button button-primary generate-preview-button" onClick={generatePreview} disabled={previewState.status === 'loading' || isConfirming || isCreatingDemand || isCreatingAvailability || isUpdatingDemand || isTaskMutationInProgress}>
                <Icon name={previewState.status === 'loading' ? 'clock' : 'calendar'} size={16} />
                <span>{previewState.status === 'loading' ? 'Gerando prévia…' : 'Gerar prévia'}</span>
              </button>
            </div>
          </section>

          <section className="week-toolbar" aria-label="Semana selecionada">
            <div className="week-toolbar-label">
              <span className="toolbar-icon"><Icon name="calendarDays" size={18} /></span>
              <div>
                <span className="toolbar-caption">SEMANA SELECIONADA</span>
                <strong>{formatWeekRange(monday)}</strong>
              </div>
            </div>
            <div className="week-controls">
              <button className="icon-button" disabled={isConfirming || isCreatingAvailability || isUpdatingDemand || isTaskMutationInProgress} onClick={() => changeWeek(-7)} aria-label="Semana anterior" title="Semana anterior">
                <Icon name="chevronLeft" size={18} />
              </button>
              <button className="button button-week" disabled={isConfirming || isCreatingAvailability || isUpdatingDemand || isTaskMutationInProgress} onClick={selectCurrentWeek}>Semana atual</button>
              <button className="icon-button" disabled={isConfirming || isCreatingAvailability || isUpdatingDemand || isTaskMutationInProgress} onClick={() => changeWeek(7)} aria-label="Próxima semana" title="Próxima semana">
                <Icon name="chevronRight" size={18} />
              </button>
            </div>
          </section>

          <section className="summary-grid" aria-label="Resumo da semana">
            <div className="summary-card">
              <span className="summary-icon summary-icon-green"><Icon name="book" size={18} /></span>
              <div><span className="summary-label">Demandas ativas</span><strong>{demandState.data ? activeDemandCount : '—'}</strong></div>
              <span className="summary-helper">na sua lista</span>
            </div>
            <div className="summary-card">
              <span className="summary-icon summary-icon-sand"><Icon name="clock" size={18} /></span>
              <div><span className="summary-label">Disponibilidade</span><strong>{availabilityState.data ? formatMinutes(totalAvailabilityMinutes) : '—'}</strong></div>
              <span className="summary-helper">nesta semana</span>
            </div>
            <div className="summary-card">
              <span className="summary-icon summary-icon-lilac"><Icon name="alert" size={18} /></span>
              <div><span className="summary-label">A estimar</span><strong>{demandState.data ? needsEstimateCount : '—'}</strong></div>
              <span className="summary-helper">sem esforço definido</span>
            </div>
          </section>

          <div className="content-grid">
            <section className="panel priorities-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">O QUE MERECE ATENÇÃO</p>
                  <h2>Prioridades acadêmicas</h2>
                  <p className="panel-description">Demandas ativas ordenadas pela prioridade da API.</p>
                </div>
                <div className="priorities-panel-actions">
                  <span className="count-badge">{demandState.data ? activeDemandCount : '…'}</span>
                  <button
                    className="button button-primary new-demand-button"
                    type="button"
                    aria-expanded={isDemandFormOpen}
                    aria-controls={isDemandFormOpen ? 'create-demand-form' : undefined}
                    disabled={isUpdatingDemand || isTaskMutationInProgress}
                    onClick={() => setIsDemandFormOpen(true)}
                  >
                    Nova demanda
                  </button>
                </div>
              </div>

              {isDemandFormOpen && (
                <CreateDemandForm
                  onCreate={createDemand}
                  onCancel={() => setIsDemandFormOpen(false)}
                  disabled={isUpdatingDemand || isTaskMutationInProgress}
                />
              )}

              {demandState.status === 'loading' && !demandState.data ? (
                <LoadingLines count={4} />
              ) : demandState.status === 'error' && !demandState.data ? (
                <StatusMessage title="Não foi possível carregar as demandas" description={demandState.error} onRetry={isUpdatingDemand || isTaskMutationInProgress ? undefined : refreshDemands} />
              ) : (
                <>
                  {demandState.status === 'error' && demandState.data && (
                    <StatusMessage title="Os dados podem estar desatualizados" description={demandState.error} onRetry={isUpdatingDemand || isTaskMutationInProgress ? undefined : refreshDemands} compact />
                  )}
                  {activeDemandCount === 0 ? (
                    <div className="empty-state">
                      <span className="empty-state-icon"><Icon name="empty" size={23} /></span>
                      <h3>Nenhuma demanda ativa por enquanto</h3>
                      <p>Quando você cadastrar provas, trabalhos ou outras demandas, elas aparecerão aqui.</p>
                    </div>
                  ) : (
                    <div className="demand-list">
                      {demandState.data?.map((item, index) => {
                        const demand = item.demanda ?? item
                        return <DemandCard item={item} key={demand.id ?? `${demand.titulo}-${index}`} />
                      })}
                    </div>
                  )}
                </>
              )}
              <div className="panel-bottom-note">
                <span className="small-check">
                  <Icon name="check" size={13} />
                </span>
                A ordem reflete os prazos, a importância e a situação de cada demanda.
              </div>
            </section>

              <div className="right-column">
                <AvailabilityPanel state={availabilityState} monday={monday} onRetry={refreshAvailability} todayIso={todayIso} onCreate={createAvailability} isCreating={isCreatingAvailability} isConfirming={isConfirming} isUpdatingDemand={isUpdatingDemand} isCreatingTask={isCreatingTask} isUpdatingTask={isUpdatingTask || isDeletingTask} />

                <PlanningPreview
                  previewState={previewState}
                  confirmState={confirmState}
                  isConfirming={isConfirming}
                  isCreatingDemand={isCreatingDemand}
                  isCreatingAvailability={isCreatingAvailability}
                  isUpdatingDemand={isUpdatingDemand}
                  isCreatingTask={isCreatingTask}
                  isUpdatingTask={isUpdatingTask || isDeletingTask}
                  clearPreview={clearPreview}
                  confirmPreview={confirmPreview}
                  generatePreview={generatePreview}
                />
              </div>
            </div>

            <footer className="page-footer">
              <span>Feito para uma rotina real, não para uma agenda perfeita.</span>
              <span>CadernoAtlas <span className="footer-separator">·</span> Planejamento semanal</span>
            </footer>
            </div>
            <div hidden={activeSection !== 'demands'}>
              <section className="page-heading">
                <div>
                  <p className="eyebrow">SEU ESPAÇO DE ESTUDO</p>
                  <h1>Demandas acadêmicas</h1>
                  <p className="page-subtitle">Consulte, filtre e atualize suas demandas.</p>
                </div>
              </section>
              <ManageDemandsPanel state={allDemandsState} onRetry={refreshAllDemands} onUpdate={updateDemand} onLoadTasks={loadDemandTasks} isUpdatingDemand={isUpdatingDemand} onCreateTask={createDemandTask} isCreatingTask={isCreatingTask} isUpdatingTask={isUpdatingTask || isDeletingTask} onUpdateTask={updateDemandTask} isDeletingTask={isDeletingTask} onDeleteTask={deleteDemandTask} />
              <footer className="page-footer">
                <span>Demandas organizadas para uma rotina real.</span>
                <span>CadernoAtlas <span className="footer-separator">·</span> Demandas acadêmicas</span>
              </footer>
            </div>
          </div>
      </main>
    </div>
  )
}

export default App