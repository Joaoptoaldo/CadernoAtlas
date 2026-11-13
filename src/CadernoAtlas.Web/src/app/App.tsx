import { useState } from 'react'
import '../App.css'

import {
  apiGet,
  apiPost,
  isHttpError,
} from '../apiClient'

import type { Availability, CreateAvailabilityRequest } from '../features/availability/availabilityTypes'
import type { LoadState } from '../features/shared/loadState'
import { usePlanningWorkflow } from '../features/planning/usePlanningWorkflow'
import { useDemandMutations } from '../features/demands/useDemandMutations'
import { useDemandList } from '../features/demands/useDemandList'
import { useConcurrencyLocks } from '../features/shared/useConcurrencyLocks'
import { getInitialWeek, toIsoDate, useWeekNavigation } from '../features/planning/useWeekNavigation'
import { useStudySessions } from '../features/study-sessions/useStudySessions'
import { useStudySessionMutations } from '../features/study-sessions/useStudySessionMutations'
import { hasAnyUncertainTransition } from '../features/study-sessions/useStudySessionUncertainTransitions'
import type { StudySession, StudySessionDemand, StudySessionListItem, StudySessionRequest, StudySessionTask, StudySessionTransition } from '../features/study-sessions/studySessionTypes'

import { minutesFromTime } from '../utils/planningFormatters'
import type { DemandTask } from '../features/demands/ManageDemandTasks'
import AppLayout from './AppLayout'
import PlanningPage from '../pages/PlanningPage'
import DemandsPage from '../pages/DemandsPage'
import DashboardPage from '../pages/DashboardPage'
import StudySessionsPage from '../pages/StudySessionsPage'
import type { NavigationSection } from './navigation/navigationItems'

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

function shouldInvalidatePreviewOnError(error: unknown): boolean {
  if (!isHttpError(error)) return true
  return error.status === 404 || error.status === 408 || error.status === 409 || error.status === 429 || error.status >= 500
}

function loadDemandTasks(demandId: number, signal: AbortSignal): Promise<DemandTask[]> {
  return apiGet<DemandTask[]>(`/api/demandas-academicas/${demandId}/tarefas`, signal)
}

function App() {
  const [activeSection, setActiveSection] = useState<NavigationSection>('planning')
  const [availabilityState, setAvailabilityState] = useState<LoadState<Availability[]>>({ status: 'loading', data: null, error: null })
  const [availabilityReloadToken, setAvailabilityReloadToken] = useState(0)
  const [isDemandFormOpen, setIsDemandFormOpen] = useState(false)
  const [isCreatingAvailability, setIsCreatingAvailability] = useState(false)
  const [availabilityOutcomeUnknown, setAvailabilityOutcomeUnknown] = useState(false)
  const [creationOutcomeUnknown, setCreationOutcomeUnknown] = useState(false)
  const [editingOutcomeUnknown, setEditingOutcomeUnknown] = useState(false)
  const [monday, setMonday] = useState(getInitialWeek)
  const [todayIso] = useState(() => toIsoDate(new Date()))
  const mondayIso = toIsoDate(monday)
  const concurrencyLocks = useConcurrencyLocks()
  const hasUncertainTransitions = () => hasAnyUncertainTransition()

  const {
    demandState,
    allDemandsState,
    setDemandState,
    setAllDemandsState,
    setDemandReloadToken,
    reconcileAllDemands,
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
    onRefreshStudySessions: async () => {
      await reconcileStudySessions()
    },
    getErrorMessage,
    hasUncertainTransitions,
  })

  const {
    changeWeek,
    selectCurrentWeek,
    refreshAvailabilityNow,
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
    refreshAllDemands,
    reconcileAllDemands,
    setDemandState,
    setAllDemandsState,
    setDemandReloadToken,
  })

  const {
    sessionsState,
    setSessionsReloadToken,
    reconcileStudySessions,
  } = useStudySessions({
    apiGet,
    getErrorMessage,
  })
  const { createSession, updateSession, transitionSession, deleteSession, isMutating: isStudySessionMutating, isUncertain, isDeleteUncertain } = useStudySessionMutations({
    refresh: async () => {
      await reconcileStudySessions()
    },
    invalidatePreview,
    concurrencyLocks,
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
      concurrencyLocks.taskMutationInProgressRef.current ||
      concurrencyLocks.studySessionMutationInProgressRef.current
    ) {
      return
    }

    invalidatePreview()
    setDemandState((previous) => ({ ...previous, status: 'loading', error: null }))
    setAvailabilityState((previous) => ({ ...previous, status: 'loading', error: null }))
    setDemandReloadToken((value) => value + 1)
    setAvailabilityReloadToken((value) => value + 1)
  }

  function refreshDemands(): void {
    if (concurrencyLocks.dataMutationInProgressRef.current) return

    clearPreview()
    setDemandState((previous) => ({
      ...previous,
      status: 'loading',
      error: null,
    }))
    setDemandReloadToken((value) => value + 1)
  }

  async function refreshAllDemands(): Promise<void> {
    if (concurrencyLocks.dataMutationInProgressRef.current && !concurrencyLocks.demandCreationInProgressRef.current && !concurrencyLocks.demandUpdateInProgressRef.current) return
    await reconcileAllDemands()
  }

  async function refreshAvailability(): Promise<void> {
    try {
      await refreshAvailabilityNow()
    } catch (error) {
      // Se for erro de lock, re-throw para o formulário tratar
      // Evita rejection não tratado se for erro de lock já esperado
      if (error instanceof Error && error.message.includes('em andamento')) {
        return
      }
      throw error
    }
  }

  async function createAvailability(request: CreateAvailabilityRequest): Promise<void> {
    if (concurrencyLocks.availabilityCreationInProgressRef.current) {
      throw new Error('Já existe um cadastro de disponibilidade em andamento.')
    }
    if (concurrencyLocks.dataMutationInProgressRef.current) {
      throw new Error('Aguarde a operação em andamento antes de cadastrar uma disponibilidade.')
    }

    concurrencyLocks.setAvailabilityCreationInProgress(true)
    concurrencyLocks.setDataMutationInProgress(true)
    setIsCreatingAvailability(true)

    try {
      await apiPost<Availability, CreateAvailabilityRequest>(
        '/api/disponibilidades-estudo',
        request,
      )
      invalidatePreview()
      setAvailabilityState((previous) => ({ ...previous, status: 'loading', error: null }))
      setAvailabilityReloadToken((value) => value + 1)
      setAvailabilityOutcomeUnknown(false)
    } catch (error: unknown) {
      if (shouldInvalidatePreviewOnError(error)) {
        invalidatePreview()
      }
      // Classificar erros 408, 429, 5xx, rede como outcomeUnknown
      if (!isHttpError(error) || error.status === 408 || error.status === 429 || error.status >= 500) {
        setAvailabilityOutcomeUnknown(true)
      }
      throw error
    } finally {
      concurrencyLocks.setAvailabilityCreationInProgress(false)
      concurrencyLocks.setDataMutationInProgress(false)
      setIsCreatingAvailability(false)
    }
  }

  function refreshAllDataOnly(): void {
    setDemandState((previous) => ({ ...previous, status: 'loading', error: null }))
    setAvailabilityState((previous) => ({ ...previous, status: 'loading', error: null }))
    setDemandReloadToken((value) => value + 1)
    setAvailabilityReloadToken((value) => value + 1)
  }

  async function reconcileCreation(): Promise<void> {
    clearPreview()
    await reconcileAllDemands()
    setDemandReloadToken((v) => v + 1)
  }

  async function reconcileEditing(): Promise<void> {
    clearPreview()
    await reconcileAllDemands()
    setDemandReloadToken((v) => v + 1)
  }

  async function reconcileSessionCreation(): Promise<StudySessionListItem[]> {
    return await reconcileStudySessions()
  }

  async function reconcileSessionEditing(): Promise<StudySessionListItem[]> {
    return await reconcileStudySessions()
  }

  const studySessionDemands: StudySessionDemand[] = (allDemandsState.data ?? []).map((demand) => ({
    id: demand.id,
    titulo: demand.titulo,
  }))

  function loadStudySessionTasks(demandId: number, signal: AbortSignal): Promise<StudySessionTask[]> {
    return loadDemandTasks(demandId, signal)
  }

  const isTaskMutationInProgress = isCreatingTask || isUpdatingTask || isDeletingTask

  return (
    <AppLayout activeSection={activeSection} onNavigate={setActiveSection}>
      <PlanningPage
        hidden={activeSection !== 'planning'}
        monday={monday}
        todayIso={todayIso}
        demandState={demandState}
        availabilityState={availabilityState}
        previewState={previewState}
        confirmState={confirmState}
        isConfirming={isConfirming}
        activeDemandCount={activeDemandCount}
        needsEstimateCount={needsEstimateCount}
        totalAvailabilityMinutes={totalAvailabilityMinutes}
        isDemandFormOpen={isDemandFormOpen}
        isCreatingDemand={isCreatingDemand}
        isCreatingAvailability={isCreatingAvailability}
        isUpdatingDemand={isUpdatingDemand}
        isTaskMutationInProgress={isTaskMutationInProgress}
        isCreatingTask={isCreatingTask}
        isUpdatingTask={isUpdatingTask}
        isDeletingTask={isDeletingTask}
        isStudySessionMutating={isStudySessionMutating}
        availabilityOutcomeUnknown={availabilityOutcomeUnknown}
        creationOutcomeUnknown={creationOutcomeUnknown}
        editingOutcomeUnknown={editingOutcomeUnknown}
        setIsDemandFormOpen={setIsDemandFormOpen}
        setCreationOutcomeUnknown={setCreationOutcomeUnknown}
        setAvailabilityOutcomeUnknown={setAvailabilityOutcomeUnknown}
        refreshAll={refreshAll}
        generatePreview={generatePreview}
        changeWeek={changeWeek}
        selectCurrentWeek={selectCurrentWeek}
        createDemand={createDemand}
        reconcileCreation={reconcileCreation}
        refreshDemands={refreshDemands}
        refreshAvailability={refreshAvailability}
        createAvailability={createAvailability}
        clearPreview={clearPreview}
        confirmPreview={confirmPreview}
      />
      <DemandsPage hidden={activeSection !== 'demands'} state={allDemandsState} onRetry={refreshAllDemands} onUpdate={updateDemand} onLoadTasks={loadDemandTasks} isUpdatingDemand={isUpdatingDemand} onCreateTask={createDemandTask} isCreatingTask={isCreatingTask} isUpdatingTask={isUpdatingDemand || isDeletingTask} onUpdateTask={updateDemandTask} isDeletingTask={isDeletingTask} onDeleteTask={deleteDemandTask} onReconcileDemands={reconcileEditing} demandOutcomeUnknown={editingOutcomeUnknown} onDemandOutcomeUnknownChange={setEditingOutcomeUnknown} />
      {activeSection === 'dashboard' && <DashboardPage hidden={false} sessionsState={sessionsState} weekStart={monday} onNavigateToSessions={() => setActiveSection('study-sessions')} onRetry={() => setSessionsReloadToken((v) => v + 1)} />}
      {activeSection === 'study-sessions' && <StudySessionsPage hidden={false} state={sessionsState} onRetry={() => setSessionsReloadToken((v) => v + 1)} demands={studySessionDemands} onLoadTasks={loadStudySessionTasks} onCreate={async (request: StudySessionRequest) => { await createSession(request); setCreationOutcomeUnknown(false) }} onReconcile={reconcileSessionCreation} creationOutcomeUnknown={creationOutcomeUnknown} onCreationOutcomeUnknownChange={setCreationOutcomeUnknown} onUpdate={async (id: number, request: StudySessionRequest) => { await updateSession(id, request); setEditingOutcomeUnknown(false) }} onReconcileEdit={reconcileSessionEditing} onEditOutcomeUnknownChange={setEditingOutcomeUnknown} onTransition={(id: number, transition: StudySessionTransition): Promise<StudySession> => transitionSession(id, transition)} onDelete={deleteSession} isTransitioning={isStudySessionMutating} isUncertain={isUncertain} isDeleteUncertain={isDeleteUncertain} getErrorMessage={getErrorMessage} />}
    </AppLayout>
  )
}

export default App
