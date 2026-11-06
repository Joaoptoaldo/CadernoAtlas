import { useState, useCallback } from 'react'
import { apiDelete, apiPost, apiPut, isHttpError } from '../../apiClient'
import type { CreateDemandRequest } from './CreateDemandForm'
import type { UpdateDemandRequest } from './ManageDemandsPanel'
import type { CreateDemandTaskRequest } from './CreateDemandTaskForm'
import type { UpdateDemandTaskRequest, DemandTask } from './ManageDemandTasks'
import type { LoadState } from '../shared/loadState'
import type { ConcurrencyLocks } from '../shared/useConcurrencyLocks'
import { MutationSyncError } from '../shared/mutationOutcome'

function shouldInvalidatePreviewOnError(error: unknown): boolean {
  // Erro de rede ou resultado incerto pode significar que a mutação foi persistida.
  if (!isHttpError(error)) return true

  // Erros que podem refletir conflito/estado alterado ou falha transitória.
  return error.status === 404 || error.status === 408 || error.status === 409 || error.status === 429 || error.status >= 500
}

export interface UseDemandMutationsOptions {
  concurrencyLocks: Pick<
    ConcurrencyLocks,
    'demandCreationInProgressRef' | 'demandUpdateInProgressRef' |
    'availabilityCreationInProgressRef' | 'confirmationInProgressRef' | 'taskMutationInProgressRef' | 'dataMutationInProgressRef' |
    'setDemandCreationInProgress' | 'setDemandUpdateInProgress' |
    'setAvailabilityCreationInProgress' | 'setConfirmationInProgress' | 'setTaskMutationInProgress' | 'setDataMutationInProgress'
  >
  invalidatePreview: () => void
  refreshAllDemands: () => Promise<void>
  reconcileAllDemands: () => Promise<import('./ManageDemandsPanel').AcademicDemandRecord[]>
  setDemandState: React.Dispatch<React.SetStateAction<LoadState<any>>>
  setAllDemandsState: React.Dispatch<React.SetStateAction<LoadState<any>>>
  setDemandReloadToken: React.Dispatch<React.SetStateAction<number>>
}

export interface UseDemandMutationsReturn {
  isCreatingDemand: boolean
  isUpdatingDemand: boolean
  isCreatingTask: boolean
  isUpdatingTask: boolean
  isDeletingTask: boolean
  createDemand: (request: CreateDemandRequest) => Promise<void>
  updateDemand: (id: number, request: UpdateDemandRequest) => Promise<void>
  createDemandTask: (demandId: number, request: CreateDemandTaskRequest) => Promise<void>
  updateDemandTask: (demandId: number, taskId: number, request: UpdateDemandTaskRequest) => Promise<DemandTask>
  deleteDemandTask: (demandId: number, taskId: number) => Promise<void>
}

export function useDemandMutations(options: UseDemandMutationsOptions): UseDemandMutationsReturn {
  const {
    concurrencyLocks,
    invalidatePreview,
    refreshAllDemands,
    reconcileAllDemands,
    setDemandState,
    setAllDemandsState,
    setDemandReloadToken,
  } = options

  const {
    demandCreationInProgressRef,
    demandUpdateInProgressRef,
    availabilityCreationInProgressRef,
    confirmationInProgressRef,
    taskMutationInProgressRef,
    dataMutationInProgressRef: providedDataMutationInProgressRef,
    setDemandCreationInProgress,
    setDemandUpdateInProgress,
    setTaskMutationInProgress,
    setDataMutationInProgress: providedSetDataMutationInProgress,
  } = concurrencyLocks
  const dataMutationInProgressRef = providedDataMutationInProgressRef ?? { current: false }
  const setDataMutationInProgress = providedSetDataMutationInProgress ?? (() => {})

  const [isCreatingDemand, setIsCreatingDemand] = useState(false)
  const [isUpdatingDemand, setIsUpdatingDemand] = useState(false)
  const [isCreatingTask, setIsCreatingTask] = useState(false)
  const [isUpdatingTask, setIsUpdatingTask] = useState(false)
  const [isDeletingTask, setIsDeletingTask] = useState(false)

  const createDemand = useCallback(async (request: CreateDemandRequest) => {
    if (demandCreationInProgressRef.current) {
      throw new Error('Já existe um cadastro de demanda em andamento.')
    }
    if (
      confirmationInProgressRef.current ||
      availabilityCreationInProgressRef.current ||
      demandUpdateInProgressRef.current ||
      taskMutationInProgressRef.current
      || dataMutationInProgressRef.current
    ) {
      throw new Error('Aguarde a operação em andamento antes de cadastrar uma demanda.')
    }

    setDemandCreationInProgress(true)
    setDataMutationInProgress(true)
    setIsCreatingDemand(true)

    try {
      await apiPost<unknown, CreateDemandRequest>('/api/demandas-academicas', request)
      invalidatePreview()
      setDemandState((prev) => ({ ...prev, status: 'loading', error: null }))
      setDemandReloadToken((v) => v + 1)
      try {
        await refreshAllDemands()
      } catch (error: unknown) {
        throw new MutationSyncError(
          `A demanda foi criada, mas a lista não pôde ser atualizada. ${error instanceof Error ? error.message : 'Tente atualizar a lista novamente.'}`,
        )
      }
    } catch (error: unknown) {
      if (shouldInvalidatePreviewOnError(error)) invalidatePreview()
      throw error
    } finally {
      setDemandCreationInProgress(false)
      setDataMutationInProgress(false)
      setIsCreatingDemand(false)
    }
  }, [
    demandCreationInProgressRef,
    availabilityCreationInProgressRef,
    confirmationInProgressRef,
    demandUpdateInProgressRef,
    taskMutationInProgressRef,
    invalidatePreview,
    setDemandState,
    setDemandReloadToken,
    refreshAllDemands,
    setDemandCreationInProgress,
    dataMutationInProgressRef,
    setDataMutationInProgress,
  ])

  const updateDemand = useCallback(async (id: number, request: UpdateDemandRequest) => {
    if (
      confirmationInProgressRef.current ||
      demandCreationInProgressRef.current ||
      availabilityCreationInProgressRef.current ||
      demandUpdateInProgressRef.current ||
      taskMutationInProgressRef.current
      || dataMutationInProgressRef.current
    ) {
      throw new Error('Aguarde a operação em andamento antes de atualizar uma demanda.')
    }

    setDemandUpdateInProgress(true)
    setDataMutationInProgress(true)
    setIsUpdatingDemand(true)
    try {
      await apiPut<unknown, UpdateDemandRequest>(`/api/demandas-academicas/${id}`, request)
      invalidatePreview()
      setDemandState((prev) => ({ ...prev, status: 'loading', error: null }))
      setDemandReloadToken((v) => v + 1)
      // Trigger reconciliation for all demands (single GET, no token increment)
      try {
        await reconcileAllDemands()
      } catch (error: unknown) {
        throw new MutationSyncError(
          `A demanda foi atualizada, mas a lista não pôde ser atualizada. ${error instanceof Error ? error.message : 'Tente atualizar a lista novamente.'}`,
        )
      }
    } catch (error: unknown) {
      if (shouldInvalidatePreviewOnError(error)) invalidatePreview()
      throw error
    } finally {
      setDemandUpdateInProgress(false)
      setDataMutationInProgress(false)
      setIsUpdatingDemand(false)
    }
  }, [
    confirmationInProgressRef,
    demandCreationInProgressRef,
    availabilityCreationInProgressRef,
    demandUpdateInProgressRef,
    taskMutationInProgressRef,
    invalidatePreview,
    setDemandState,
    setDemandReloadToken,
    setAllDemandsState,
    reconcileAllDemands,
    setDemandUpdateInProgress,
    dataMutationInProgressRef,
    setDataMutationInProgress,
  ])

  const createDemandTask = useCallback(async (demandId: number, request: CreateDemandTaskRequest) => {
    if (taskMutationInProgressRef.current) {
      throw new Error('Já existe um cadastro de tarefa em andamento.')
    }
    if (
      confirmationInProgressRef.current ||
      demandCreationInProgressRef.current ||
      demandUpdateInProgressRef.current ||
      availabilityCreationInProgressRef.current
      || dataMutationInProgressRef.current
    ) {
      throw new Error('Aguarde a operação em andamento antes de cadastrar uma tarefa.')
    }

    setTaskMutationInProgress(true)
    setDataMutationInProgress(true)
    setIsCreatingTask(true)
    try {
      await apiPost<DemandTask, CreateDemandTaskRequest>(`/api/demandas-academicas/${demandId}/tarefas`, request)
      invalidatePreview()
    } catch (error: unknown) {
      if (shouldInvalidatePreviewOnError(error)) invalidatePreview()
      throw error
    } finally {
      setTaskMutationInProgress(false)
      setDataMutationInProgress(false)
      setIsCreatingTask(false)
    }
  }, [
    taskMutationInProgressRef,
    confirmationInProgressRef,
    demandCreationInProgressRef,
    demandUpdateInProgressRef,
    availabilityCreationInProgressRef,
    invalidatePreview,
    setTaskMutationInProgress,
    dataMutationInProgressRef,
    setDataMutationInProgress,
  ])

  const updateDemandTask = useCallback(async (demandId: number, taskId: number, request: UpdateDemandTaskRequest) => {
    if (taskMutationInProgressRef.current) {
      throw new Error('Já existe uma alteração de tarefa em andamento.')
    }
    if (
      confirmationInProgressRef.current ||
      demandCreationInProgressRef.current ||
      demandUpdateInProgressRef.current ||
      availabilityCreationInProgressRef.current
      || dataMutationInProgressRef.current
    ) {
      throw new Error('Aguarde a operação em andamento antes de atualizar uma tarefa.')
    }

    setTaskMutationInProgress(true)
    setDataMutationInProgress(true)
    setIsUpdatingTask(true)
    try {
      const updated = await apiPut<DemandTask, UpdateDemandTaskRequest>(`/api/demandas-academicas/${demandId}/tarefas/${taskId}`, request)
      invalidatePreview()
      return updated
    } catch (error: unknown) {
      if (shouldInvalidatePreviewOnError(error)) invalidatePreview()
      throw error
    } finally {
      setTaskMutationInProgress(false)
      setDataMutationInProgress(false)
      setIsUpdatingTask(false)
    }
  }, [
    taskMutationInProgressRef,
    confirmationInProgressRef,
    demandCreationInProgressRef,
    demandUpdateInProgressRef,
    availabilityCreationInProgressRef,
    invalidatePreview,
    setTaskMutationInProgress,
    dataMutationInProgressRef,
    setDataMutationInProgress,
  ])

  const deleteDemandTask = useCallback(async (demandId: number, taskId: number) => {
    if (taskMutationInProgressRef.current) {
      throw new Error('Já existe uma mutação de tarefa em andamento.')
    }
    if (
      confirmationInProgressRef.current ||
      demandCreationInProgressRef.current ||
      demandUpdateInProgressRef.current ||
      availabilityCreationInProgressRef.current
      || dataMutationInProgressRef.current
    ) {
      throw new Error('Aguarde a operação em andamento antes de excluir uma tarefa.')
    }

    setTaskMutationInProgress(true)
    setDataMutationInProgress(true)
    setIsDeletingTask(true)
    try {
      await apiDelete(`/api/demandas-academicas/${demandId}/tarefas/${taskId}`)
      invalidatePreview()
    } catch (error: unknown) {
      if (shouldInvalidatePreviewOnError(error)) invalidatePreview()
      throw error
    } finally {
      setTaskMutationInProgress(false)
      setDataMutationInProgress(false)
      setIsDeletingTask(false)
    }
  }, [
    taskMutationInProgressRef,
    confirmationInProgressRef,
    demandCreationInProgressRef,
    demandUpdateInProgressRef,
    availabilityCreationInProgressRef,
    invalidatePreview,
    setTaskMutationInProgress,
    dataMutationInProgressRef,
    setDataMutationInProgress,
  ])

  return {
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
  }
}