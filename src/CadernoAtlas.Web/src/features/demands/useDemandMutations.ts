import { useState, useCallback } from 'react'
import { apiDelete, apiPost, apiPut, isHttpError } from '../../apiClient'
import type { CreateDemandRequest } from './CreateDemandForm'
import type { UpdateDemandRequest } from './ManageDemandsPanel'
import type { CreateDemandTaskRequest } from './CreateDemandTaskForm'
import type { UpdateDemandTaskRequest, DemandTask } from './ManageDemandTasks'
import type { LoadState } from '../shared/loadState'
import type { ConcurrencyLocks } from '../shared/useConcurrencyLocks'

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
    'availabilityCreationInProgressRef' | 'confirmationInProgressRef' | 'taskMutationInProgressRef' |
    'setDemandCreationInProgress' | 'setDemandUpdateInProgress' |
    'setAvailabilityCreationInProgress' | 'setConfirmationInProgress' | 'setTaskMutationInProgress'
  >
  invalidatePreview: () => void
  clearPreview: () => void
  refreshAllDemands: () => void
  setDemandState: React.Dispatch<React.SetStateAction<LoadState<any>>>
  setAllDemandsState: React.Dispatch<React.SetStateAction<LoadState<any>>>
  setDemandReloadToken: React.Dispatch<React.SetStateAction<number>>
  setAllDemandsReloadToken: React.Dispatch<React.SetStateAction<number>>
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
    clearPreview,
    refreshAllDemands,
    setDemandState,
    setAllDemandsState,
    setDemandReloadToken,
    setAllDemandsReloadToken,
  } = options

  const {
    demandCreationInProgressRef,
    demandUpdateInProgressRef,
    availabilityCreationInProgressRef,
    confirmationInProgressRef,
    taskMutationInProgressRef,
    setDemandCreationInProgress,
    setDemandUpdateInProgress,
    setTaskMutationInProgress,
  } = concurrencyLocks

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
    ) {
      throw new Error('Aguarde a operação em andamento antes de cadastrar uma demanda.')
    }

    setDemandCreationInProgress(true)
    setIsCreatingDemand(true)

    try {
      await apiPost<unknown, CreateDemandRequest>('/api/demandas-academicas', request)
      clearPreview()
      setDemandState((prev) => ({ ...prev, status: 'loading', error: null }))
      setDemandReloadToken((v) => v + 1)
      refreshAllDemands()
    } catch (error: unknown) {
      if (shouldInvalidatePreviewOnError(error)) invalidatePreview()
      throw error
    } finally {
      setDemandCreationInProgress(false)
      setIsCreatingDemand(false)
    }
  }, [
    demandCreationInProgressRef,
    availabilityCreationInProgressRef,
    confirmationInProgressRef,
    demandUpdateInProgressRef,
    taskMutationInProgressRef,
    clearPreview,
    invalidatePreview,
    setDemandState,
    setDemandReloadToken,
    refreshAllDemands,
    setDemandCreationInProgress,
  ])

  const updateDemand = useCallback(async (id: number, request: UpdateDemandRequest) => {
    if (
      confirmationInProgressRef.current ||
      demandCreationInProgressRef.current ||
      availabilityCreationInProgressRef.current ||
      demandUpdateInProgressRef.current ||
      taskMutationInProgressRef.current
    ) {
      throw new Error('Aguarde a operação em andamento antes de atualizar uma demanda.')
    }

    setDemandUpdateInProgress(true)
    setIsUpdatingDemand(true)
    try {
      await apiPut<unknown, UpdateDemandRequest>(`/api/demandas-academicas/${id}`, request)
      invalidatePreview()
      setDemandState((prev) => ({ ...prev, status: 'loading', error: null }))
      setDemandReloadToken((v) => v + 1)
      setAllDemandsState((prev) => ({ ...prev, status: 'loading', error: null }))
      setAllDemandsReloadToken((v) => v + 1)
    } catch (error: unknown) {
      if (shouldInvalidatePreviewOnError(error)) invalidatePreview()
      throw error
    } finally {
      setDemandUpdateInProgress(false)
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
    setAllDemandsReloadToken,
    setDemandUpdateInProgress,
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
    ) {
      throw new Error('Aguarde a operação em andamento antes de cadastrar uma tarefa.')
    }

    setTaskMutationInProgress(true)
    setIsCreatingTask(true)
    try {
      await apiPost<DemandTask, CreateDemandTaskRequest>(`/api/demandas-academicas/${demandId}/tarefas`, request)
      invalidatePreview()
    } catch (error: unknown) {
      if (shouldInvalidatePreviewOnError(error)) invalidatePreview()
      throw error
    } finally {
      setTaskMutationInProgress(false)
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
    ) {
      throw new Error('Aguarde a operação em andamento antes de atualizar uma tarefa.')
    }

    setTaskMutationInProgress(true)
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
    ) {
      throw new Error('Aguarde a operação em andamento antes de excluir uma tarefa.')
    }

    setTaskMutationInProgress(true)
    setIsDeletingTask(true)
    try {
      await apiDelete(`/api/demandas-academicas/${demandId}/tarefas/${taskId}`)
      invalidatePreview()
    } catch (error: unknown) {
      if (shouldInvalidatePreviewOnError(error)) invalidatePreview()
      throw error
    } finally {
      setTaskMutationInProgress(false)
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