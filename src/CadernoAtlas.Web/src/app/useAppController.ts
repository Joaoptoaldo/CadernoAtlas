import { useCallback, useState } from 'react'
import { apiGet } from '../apiClient'
import type { Availability } from '../features/availability/availabilityTypes'
import type { LoadState } from '../features/shared/loadState'
import { usePlanningWorkflow } from '../features/planning/usePlanningWorkflow'
import { useDemandMutations } from '../features/demands/useDemandMutations'
import { useDemandList } from '../features/demands/useDemandList'
import { useConcurrencyLocks } from '../features/shared/useConcurrencyLocks'
import { getInitialWeek, toIsoDate, useWeekNavigation } from '../features/planning/useWeekNavigation'
import { useStudySessions } from '../features/study-sessions/useStudySessions'
import { useStudySessionMutations } from '../features/study-sessions/useStudySessionMutations'
import { hasAnyUncertainTransition } from '../features/study-sessions/useStudySessionUncertainTransitions'
import { useAvailabilityMutations } from '../features/availability/useAvailabilityMutations'
import type {
  StudySession,
  StudySessionDemand,
  StudySessionRequest,
  StudySessionTransition,
} from '../features/study-sessions/studySessionTypes'
import { minutesFromTime } from '../utils/planningFormatters'
import type { DemandTask } from '../features/demands/ManageDemandTasks'
import type { NavigationSection } from './navigation/navigationItems'

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

function loadDemandTasks(demandId: number, signal: AbortSignal): Promise<DemandTask[]> {
  return apiGet<DemandTask[]>(`/api/demandas-academicas/${demandId}/tarefas`, signal)
}

export function useAppController() {
  const [activeSection, setActiveSection] = useState<NavigationSection>('planning')
  const [availabilityState, setAvailabilityState] = useState<LoadState<Availability[]>>({ status: 'loading', data: null, error: null })
  const [availabilityReloadToken, setAvailabilityReloadToken] = useState(0)
  const [isDemandFormOpen, setIsDemandFormOpen] = useState(false)
  const [availabilityOutcomeUnknown, setAvailabilityOutcomeUnknown] = useState(false)
  const [demandCreationOutcomeUnknown, setDemandCreationOutcomeUnknown] = useState(false)
  const [studySessionCreationOutcomeUnknown, setStudySessionCreationOutcomeUnknown] = useState(false)
  const [demandEditingOutcomeUnknown, setDemandEditingOutcomeUnknown] = useState(false)
  const [monday, setMonday] = useState(getInitialWeek)
  const [todayIso] = useState(() => toIsoDate(new Date()))
  const concurrencyLocks = useConcurrencyLocks()

  const hasUncertainTransitions = useCallback(() => hasAnyUncertainTransition(), [])

  const {
    demandState,
    allDemandsState,
    setDemandState,
    setDemandReloadToken,
    reconcileAllDemands,
  } = useDemandList({
    apiGet,
    getErrorMessage,
  })

  const {
    sessionsState,
    setSessionsReloadToken,
    reconcileStudySessions,
  } = useStudySessions({
    apiGet,
    getErrorMessage,
  })
  const refreshStudySessions = useCallback(async () => {
    await reconcileStudySessions()
  }, [reconcileStudySessions])

  const refreshAllDataOnly = useCallback(() => {
    setDemandState((previous) => ({ ...previous, status: 'loading', error: null }))
    setAvailabilityState((previous) => ({ ...previous, status: 'loading', error: null }))
    setDemandReloadToken((value) => value + 1)
    setAvailabilityReloadToken((value) => value + 1)
  }, [setDemandState, setDemandReloadToken])

  const refreshAllDemands = useCallback(async () => {
    if (concurrencyLocks.dataMutationInProgressRef.current && !concurrencyLocks.demandCreationInProgressRef.current && !concurrencyLocks.demandUpdateInProgressRef.current) return
    await reconcileAllDemands()
  }, [concurrencyLocks, reconcileAllDemands])

  const {
    previewState,
    confirmState,
    isConfirming,
    generatePreview,
    confirmPreview,
    clearPreview,
    invalidatePreview,
  } = usePlanningWorkflow({
    mondayIso: toIsoDate(monday),
    concurrencyLocks,
    availabilityOutcomeUnknown,
    onRefreshAllDataOnly: refreshAllDataOnly,
    onRefreshStudySessions: refreshStudySessions,
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
    isCreatingAvailability,
    createAvailability,
    reconcileAvailability,
  } = useAvailabilityMutations({
    concurrencyLocks,
    invalidatePreview,
    setAvailabilityState,
    setAvailabilityReloadToken,
    setOutcomeUnknown: setAvailabilityOutcomeUnknown,
    refreshAvailabilityNow,
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
    setDemandReloadToken,
  })

  const {
    createSession,
    updateSession,
    transitionSession,
    deleteSession,
    isMutating: isStudySessionMutating,
    isUncertain,
    isDeleteUncertain,
  } = useStudySessionMutations({
    refresh: refreshStudySessions,
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
  const isTaskMutationInProgress = isCreatingTask || isUpdatingTask || isDeletingTask

  const refreshAll = useCallback(() => {
    if (
      concurrencyLocks.demandCreationInProgressRef.current ||
      concurrencyLocks.availabilityCreationInProgressRef.current ||
      concurrencyLocks.confirmationInProgressRef.current ||
      concurrencyLocks.demandUpdateInProgressRef.current ||
      concurrencyLocks.taskMutationInProgressRef.current ||
      concurrencyLocks.studySessionMutationInProgressRef.current
    ) return

    invalidatePreview()
    setDemandState((previous) => ({ ...previous, status: 'loading', error: null }))
    setAvailabilityState((previous) => ({ ...previous, status: 'loading', error: null }))
    setDemandReloadToken((value) => value + 1)
    setAvailabilityReloadToken((value) => value + 1)
  }, [concurrencyLocks, invalidatePreview, setDemandState, setDemandReloadToken])

  const refreshAvailability = useCallback(async () => {
    try {
      await refreshAvailabilityNow()
    } catch (error) {
      // Uma tentativa comum de atualização não deve gerar rejeição
      // quando outra operação já está utilizando os dados.
      if (error instanceof Error && error.message.includes('em andamento')) {
        return
      }

      throw error
    }
  }, [refreshAvailabilityNow])

  const refreshDemands = useCallback(() => {
    if (concurrencyLocks.dataMutationInProgressRef.current) return

    clearPreview()
    setDemandState((previous) => ({ ...previous, status: 'loading', error: null }))
    setDemandReloadToken((value) => value + 1)
  }, [concurrencyLocks, clearPreview, setDemandState, setDemandReloadToken])

  const reconcileDemands = useCallback(async () => {
    clearPreview()
    await reconcileAllDemands()
    setDemandReloadToken((value) => value + 1)
  }, [clearPreview, reconcileAllDemands, setDemandReloadToken])

  const transitionStudySession = useCallback((id: number, transition: StudySessionTransition): Promise<StudySession> => transitionSession(id, transition), [transitionSession])

  const createStudySession = useCallback(async (request: StudySessionRequest) => {
    await createSession(request)
    setStudySessionCreationOutcomeUnknown(false)
  }, [createSession])

  const navigateToSessions = useCallback(() => setActiveSection('study-sessions'), [])
  const retrySessions = useCallback(() => setSessionsReloadToken((value) => value + 1), [setSessionsReloadToken])

  const studySessionDemands: StudySessionDemand[] = (allDemandsState.data ?? []).map((demand) => ({
    id: demand.id,
    titulo: demand.titulo,
  }))

  return {
    navigation: {
      activeSection,
      onNavigate: setActiveSection,
    },
    planningPage: {
      hidden: activeSection !== 'planning',
      data: {
        monday,
        todayIso,
        demandState,
        availabilityState,
        previewState,
        confirmState,
        activeDemandCount,
        needsEstimateCount,
        totalAvailabilityMinutes,
        isDemandFormOpen,
        refreshAvailability,
        createAvailability,
        reconcileAvailability,
        setAvailabilityOutcomeUnknown,
      },
      status: {
        isConfirming,
        isCreatingDemand,
        isCreatingAvailability,
        isUpdatingDemand,
        isTaskMutationInProgress,
        isCreatingTask,
        isUpdatingTask,
        isDeletingTask,
        isStudySessionMutating,
        availabilityOutcomeUnknown,
        creationOutcomeUnknown: demandCreationOutcomeUnknown,
        editingOutcomeUnknown: demandEditingOutcomeUnknown,
      },
      actions: {
        setIsDemandFormOpen,
        setCreationOutcomeUnknown: setDemandCreationOutcomeUnknown,
        refreshAll,
        generatePreview,
        changeWeek,
        selectCurrentWeek,
        createDemand,
        reconcileCreation: reconcileDemands,
        refreshDemands,
        refreshAvailability,
        createAvailability,
        reconcileAvailability,
        clearPreview,
        confirmPreview,
      },
    },
    demandsPage: {
      hidden: activeSection !== 'demands',
      state: allDemandsState,
      onRetry: refreshAllDemands,
      onUpdate: updateDemand,
      onLoadTasks: loadDemandTasks,
      isUpdatingDemand,
      onCreateTask: createDemandTask,
      isCreatingTask,
      isUpdatingTask: isUpdatingDemand || isDeletingTask,
      onUpdateTask: updateDemandTask,
      isDeletingTask,
      onDeleteTask: deleteDemandTask,
      onReconcileDemands: reconcileDemands,
      demandOutcomeUnknown: demandEditingOutcomeUnknown,
      onDemandOutcomeUnknownChange: setDemandEditingOutcomeUnknown,
    },
    dashboardPage: {
      sessionsState,
      weekStart: monday,
      onNavigateToSessions: navigateToSessions,
      onRetry: retrySessions,
    },
    studySessionsPage: {
      state: sessionsState,
      demands: studySessionDemands,
      onRetry: retrySessions,
      onLoadTasks: loadDemandTasks,
      onCreate: createStudySession,
      onReconcile: reconcileStudySessions,
      creationOutcomeUnknown: studySessionCreationOutcomeUnknown,
      onCreationOutcomeUnknownChange: setStudySessionCreationOutcomeUnknown,
      onUpdate: updateSession,
      onReconcileEdit: reconcileStudySessions,
      onTransition: transitionStudySession,
      onDelete: deleteSession,
      isTransitioning: isStudySessionMutating,
      isUncertain,
      isDeleteUncertain,
      getErrorMessage,
    },
  }

}
