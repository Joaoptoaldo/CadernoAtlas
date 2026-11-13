import type { ComponentProps } from 'react'
import PlanningPreview from '../features/planning/PlanningPreview'
import Icon from '../components/ui/Icon'
import StatusMessage from '../components/ui/StatusMessage'
import EmptyState from '../components/ui/EmptyState'
import CreateDemandForm from '../features/demands/CreateDemandForm'
import DemandCard from '../features/demands/DemandCard'
import AvailabilityPanel from '../features/availability/AvailabilityPanel'
import type { LoadState } from '../features/shared/loadState'
import type { Availability } from '../features/availability/availabilityTypes'
import type { PrioritizedDemand } from '../features/demands/DemandCard'
import type { CreateDemandRequest } from '../features/demands/CreateDemandForm'
import { formatMinutes, formatWeekRange } from '../utils/planningFormatters'

interface PlanningPageProps {
  hidden: boolean
  data: {
    monday: Date
    todayIso: string
    demandState: LoadState<PrioritizedDemand[]>
    availabilityState: LoadState<Availability[]>
    previewState: ComponentProps<typeof PlanningPreview>['previewState']
    confirmState: ComponentProps<typeof PlanningPreview>['confirmState']
    activeDemandCount: number
    needsEstimateCount: number
    totalAvailabilityMinutes: number
    isDemandFormOpen: boolean
  }
  status: {
    isConfirming: boolean
    isCreatingDemand: boolean
    isCreatingAvailability: boolean
    isUpdatingDemand: boolean
    isTaskMutationInProgress: boolean
    isCreatingTask: boolean
    isUpdatingTask: boolean
    isDeletingTask: boolean
    isStudySessionMutating: boolean
    availabilityOutcomeUnknown: boolean
    creationOutcomeUnknown: boolean
    editingOutcomeUnknown: boolean
  }
  actions: {
    setIsDemandFormOpen: (open: boolean) => void
    setCreationOutcomeUnknown: (value: boolean) => void
    refreshAll: () => void
    generatePreview: () => Promise<void>
    changeWeek: (days: number) => void
    selectCurrentWeek: () => void
    createDemand: (request: CreateDemandRequest) => Promise<void>
    reconcileCreation: () => Promise<void>
    refreshDemands: () => void
    refreshAvailability: () => Promise<void>
    createAvailability: ComponentProps<typeof AvailabilityPanel>['onCreate']
    reconcileAvailability: () => Promise<void>
    clearPreview: () => void
    confirmPreview: () => Promise<void>
  }
}

export default function PlanningPage(props: PlanningPageProps) {
  const { hidden, ...page } = props
  const {
    data: {
    monday, todayIso, demandState, availabilityState, previewState, confirmState,
    activeDemandCount, needsEstimateCount, totalAvailabilityMinutes, isDemandFormOpen,
    },
    status: {
    isConfirming, isCreatingDemand, isCreatingAvailability, isUpdatingDemand, isTaskMutationInProgress,
    isCreatingTask, isUpdatingTask, isDeletingTask, isStudySessionMutating, availabilityOutcomeUnknown, creationOutcomeUnknown,
    editingOutcomeUnknown,
    },
    actions: {
    setIsDemandFormOpen,
    setCreationOutcomeUnknown,
    refreshAll,
    generatePreview,
    changeWeek,
    selectCurrentWeek,
    createDemand,
    reconcileCreation,
    refreshDemands,
    refreshAvailability,
    createAvailability,
    reconcileAvailability,
    clearPreview,
    confirmPreview,
    },
  } = page
  return (
    <div hidden={hidden}>
      <section className="page-heading">
        <div><h1>Planejamento semanal</h1><p className="page-subtitle">Organize suas demandas em uma semana possível.</p></div>
        <div className="page-heading-actions">
          <button className="button button-secondary refresh-button" onClick={refreshAll} disabled={isCreatingDemand || isConfirming || isCreatingAvailability || isUpdatingDemand || isTaskMutationInProgress || availabilityOutcomeUnknown || creationOutcomeUnknown || editingOutcomeUnknown}><Icon name="refresh" size={16} /><span>Atualizar dados</span></button>
          <button className="button button-primary generate-preview-button" onClick={generatePreview}
          disabled={
            previewState.status === 'loading' ||
            isConfirming ||
            isCreatingDemand ||
            isCreatingAvailability ||
            isUpdatingDemand ||
            isTaskMutationInProgress ||
            availabilityOutcomeUnknown
          }
          ><Icon name={previewState.status === 'loading' ? 'clock' : 'calendar'} size={16} /><span>{previewState.status === 'loading' ? 'Gerando prévia…' : 'Gerar prévia'}</span></button>
        </div>
      </section>
      <section className="week-toolbar" aria-label="Semana selecionada">
        <div className="week-toolbar-label"><span className="toolbar-icon"><Icon name="calendarDays" size={18} /></span><div><span className="toolbar-caption">SEMANA SELECIONADA</span><strong>{formatWeekRange(monday)}</strong></div></div>
        <div className="week-controls"><button className="icon-button" disabled={isConfirming || isCreatingAvailability || isUpdatingDemand || isTaskMutationInProgress || availabilityOutcomeUnknown || creationOutcomeUnknown || editingOutcomeUnknown} onClick={() => changeWeek(-7)} aria-label="Semana anterior" title="Semana anterior"><Icon name="chevronLeft" size={18} /></button><button className="button button-week" disabled={isConfirming || isCreatingAvailability || isUpdatingDemand || isTaskMutationInProgress || availabilityOutcomeUnknown || creationOutcomeUnknown || editingOutcomeUnknown} onClick={selectCurrentWeek}>Semana atual</button><button className="icon-button" disabled={isConfirming || isCreatingAvailability || isUpdatingDemand || isTaskMutationInProgress || availabilityOutcomeUnknown || creationOutcomeUnknown || editingOutcomeUnknown} onClick={() => changeWeek(7)} aria-label="Próxima semana" title="Próxima semana"><Icon name="chevronRight" size={18} /></button></div>
      </section>
      <section className="summary-grid" aria-label="Resumo da semana">
        <div className="summary-card"><span className="summary-icon summary-icon-green"><Icon name="book" size={18} /></span><div><span className="summary-label">Demandas ativas</span><strong>{demandState.data ? activeDemandCount : '—'}</strong></div><span className="summary-helper">na sua lista</span></div>
        <div className="summary-card"><span className="summary-icon summary-icon-sand"><Icon name="clock" size={18} /></span><div><span className="summary-label">Disponibilidade</span><strong>{availabilityState.data ? formatMinutes(totalAvailabilityMinutes) : '—'}</strong></div><span className="summary-helper">nesta semana</span></div>
        <div className="summary-card"><span className="summary-icon summary-icon-lilac"><Icon name="alert" size={18} /></span><div><span className="summary-label">A estimar</span><strong>{demandState.data ? needsEstimateCount : '—'}</strong></div><span className="summary-helper">sem esforço definido</span></div>
      </section>
      <div className="content-grid"><section className="panel priorities-panel"><div className="panel-heading"><div><p className="eyebrow">O QUE MERECE ATENÇÃO</p><h2>Prioridades acadêmicas</h2><p className="panel-description">Demandas ativas ordenadas pela prioridade da API.</p></div><div className="priorities-panel-actions"><span className="count-badge">{demandState.data ? activeDemandCount : '…'}</span><button className="button button-primary new-demand-button" type="button" aria-expanded={isDemandFormOpen} aria-controls={isDemandFormOpen ? 'create-demand-form' : undefined} disabled={isUpdatingDemand || isTaskMutationInProgress || availabilityOutcomeUnknown || creationOutcomeUnknown} onClick={() => setIsDemandFormOpen(true)}>Nova demanda</button></div></div>
        {isDemandFormOpen && <CreateDemandForm onCreate={createDemand} onCancel={() => setIsDemandFormOpen(false)} onReconcile={reconcileCreation} onOutcomeUnknownChange={setCreationOutcomeUnknown} disabled={isUpdatingDemand || isTaskMutationInProgress} outcomeUnknown={creationOutcomeUnknown} />}
        {demandState.status === 'loading' && !demandState.data ? (
          <div className="loading-placeholder" aria-label="Carregando demandas" role="status" aria-live="polite">
            <div className="placeholder-glow">
              {[...Array(4)].map((_, index) => (
                <div key={index} className="d-flex gap-3 p-3 border rounded" aria-hidden="true">
                  <div className="placeholder placeholder-wave" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
                  <div className="d-flex flex-column justify-content-center gap-2 flex-1">
                    <div className="placeholder placeholder-wave" style={{ width: '60%', height: '12px', borderRadius: '4px' }} />
                    <div className="placeholder placeholder-wave" style={{ width: '40%', height: '10px', borderRadius: '4px' }} />
                  </div>
                </div>
              ))}
            </div>
            <span className="visually-hidden">Carregando demandas</span>
          </div>
        ) : demandState.status === 'error' && !demandState.data ? <StatusMessage title="Não foi possível carregar as demandas" description={demandState.error} onRetry={isUpdatingDemand || isTaskMutationInProgress ? undefined : refreshDemands} variant="danger" /> : <>{demandState.status === 'error' && demandState.data && <StatusMessage title="Os dados podem estar desatualizados" description={demandState.error} onRetry={isUpdatingDemand || isTaskMutationInProgress ? undefined : refreshDemands} compact variant="warning" />}{activeDemandCount === 0 ? (
          <EmptyState
            title="Nenhuma demanda ativa por enquanto"
            description="Quando você cadastrar provas, trabalhos ou outras demandas, elas aparecerão aqui."
            icon="book"
          />
        ) : (
          <div className="demand-list">{demandState.data?.map((item, index) => { const demand = item.demanda ?? item; return <DemandCard item={item} key={demand.id ?? `${demand.titulo}-${index}`} /> })}</div>
        )}</>}
        <div className="panel-bottom-note"><span className="small-check"><Icon name="check" size={13} /></span>A ordem reflete os prazos, a importância e a situação de cada demanda.</div>
      </section>      <div className="right-column"><AvailabilityPanel state={availabilityState} monday={monday} onRetry={refreshAvailability} todayIso={todayIso} onCreate={createAvailability} onReconcile={reconcileAvailability} isCreating={isCreatingAvailability} isConfirming={isConfirming} isUpdatingDemand={isUpdatingDemand} isCreatingTask={isCreatingTask} isUpdatingTask={isUpdatingTask} isDeletingTask={isDeletingTask} outcomeUnknown={availabilityOutcomeUnknown} /><PlanningPreview availabilityOutcomeUnknown={availabilityOutcomeUnknown} previewState={previewState} confirmState={confirmState} isConfirming={isConfirming} isCreatingDemand={isCreatingDemand} isCreatingAvailability={isCreatingAvailability} isUpdatingDemand={isUpdatingDemand} isCreatingTask={isCreatingTask} isUpdatingTask={isUpdatingTask} isDeletingTask={isDeletingTask} isStudySessionMutating={isStudySessionMutating} clearPreview={clearPreview} confirmPreview={confirmPreview} generatePreview={generatePreview} /></div></div>
      <footer className="page-footer"><span>CadernoAtlas <span className="footer-separator">·</span> Planejamento semanal</span></footer>
    </div>
  )
}
