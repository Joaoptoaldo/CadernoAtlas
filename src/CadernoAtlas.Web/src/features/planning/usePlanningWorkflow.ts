import { useRef, useState, useCallback } from 'react'
import { apiGet, apiPost, isHttpError } from '../../apiClient'
import type { PlanningData, PreviewState, ConfirmState, ConfirmationData } from './PlanningPreview'
import type { ConcurrencyLocks } from '../shared/useConcurrencyLocks'

export interface PlanningConfirmationRequest {
  inicioSemana: PlanningData['inicioSemana']
  agora: PlanningData['agora']
  propostaId: PlanningData['propostaId']
  alocacoes: PlanningData['alocacoes']
}

interface UsePlanningWorkflowOptions {
  mondayIso: string
  concurrencyLocks: Pick<
    ConcurrencyLocks,
    'confirmationInProgressRef' | 'demandUpdateInProgressRef' | 'demandCreationInProgressRef' | 'availabilityCreationInProgressRef' | 'taskMutationInProgressRef'
  >
  onRefreshAllDataOnly: () => void
  getErrorMessage: (error: unknown, fallback: string) => string
}

interface UsePlanningWorkflowReturn {
  previewState: PreviewState
  confirmState: ConfirmState
  isConfirming: boolean
  generatePreview: () => Promise<void>
  confirmPreview: () => Promise<void>
  clearPreview: () => void
  invalidatePreview: () => void
}

export function usePlanningWorkflow(options: UsePlanningWorkflowOptions): UsePlanningWorkflowReturn {
  const {
    mondayIso,
    concurrencyLocks,
    onRefreshAllDataOnly,
    getErrorMessage,
  } = options

  const {
    confirmationInProgressRef,
    demandUpdateInProgressRef,
    demandCreationInProgressRef,
    availabilityCreationInProgressRef,
    taskMutationInProgressRef,
  } = concurrencyLocks

  const [previewState, setPreviewState] = useState<PreviewState>({ status: 'idle', data: null, error: null })
  const [confirmState, setConfirmState] = useState<ConfirmState>({ status: 'idle', data: null, error: null })
  const previewRequestRef = useRef<number>(0)

  const isConfirming = confirmState.status === 'loading'

  const invalidatePreview = useCallback(() => {
    previewRequestRef.current += 1
    setPreviewState({ status: 'idle', data: null, error: null })
    setConfirmState({ status: 'idle', data: null, error: null })
  }, [])

  const clearPreview = useCallback(() => {
    if (confirmationInProgressRef.current || demandUpdateInProgressRef.current || taskMutationInProgressRef.current) return
    invalidatePreview()
  }, [confirmationInProgressRef, demandUpdateInProgressRef, taskMutationInProgressRef, invalidatePreview])

  const generatePreview = useCallback(async () => {
    if (
      demandCreationInProgressRef.current ||
      availabilityCreationInProgressRef.current ||
      confirmationInProgressRef.current ||
      demandUpdateInProgressRef.current ||
      taskMutationInProgressRef.current
    ) return

    const requestId = ++previewRequestRef.current
    const requestedMonday = mondayIso
    setPreviewState({ status: 'loading', data: null, error: null })
    setConfirmState({ status: 'idle', data: null, error: null })

    try {
      const data = await apiGet<PlanningData>(`/api/planejamento-semanal/previa?inicioSemana=${requestedMonday}`)
      if (requestId !== previewRequestRef.current) return
      setPreviewState({ status: 'success', data, error: null })
    } catch (error: unknown) {
      if (requestId !== previewRequestRef.current) return
      setPreviewState({
        status: 'error',
        data: null,
        error: getErrorMessage(error, 'Verifique se a API está disponível e tente novamente.'),
      })
    }
  }, [mondayIso, demandCreationInProgressRef, availabilityCreationInProgressRef, confirmationInProgressRef, demandUpdateInProgressRef, taskMutationInProgressRef, getErrorMessage])

  const confirmPreview = useCallback(async () => {
    const proposta = previewState.data
    if (
      !proposta ||
      confirmationInProgressRef.current ||
      demandUpdateInProgressRef.current ||
      demandCreationInProgressRef.current ||
      availabilityCreationInProgressRef.current ||
      taskMutationInProgressRef.current ||
      (confirmState.status === 'error' && !confirmState.canRetry)
    ) return

    confirmationInProgressRef.current = true
    setConfirmState({ status: 'loading', data: null, error: null })
    try {
      const request: PlanningConfirmationRequest = {
        inicioSemana: proposta.inicioSemana,
        agora: proposta.agora,
        propostaId: proposta.propostaId,
        alocacoes: proposta.alocacoes,
      }
      const result = await apiPost<ConfirmationData, PlanningConfirmationRequest>('/api/planejamento-semanal/confirmar', request)
      setConfirmState({ status: 'success', data: result, error: null })
      setPreviewState({ status: 'confirmed', data: proposta, error: null })
      onRefreshAllDataOnly()
    } catch (error: unknown) {
      const isConflict = isHttpError(error) && error.status === 409
      const outcomeUnknown = !isHttpError(error) || error.status >= 500

      if (isConflict) {
        setPreviewState({
          status: 'error',
          data: null,
          error: 'Esta prévia ficou desatualizada ou os horários entraram em conflito. Gere uma nova prévia antes de confirmar.',
        })

        setConfirmState({
          status: 'error',
          data: null,
          error: 'O planejamento não foi salvo. Nenhuma sessão desta proposta foi criada.',
          canRetry: false,
        })
        return
      }

      if (outcomeUnknown) {
        setPreviewState({
          status: 'error',
          data: null,
          error: 'Não foi possível verificar se o planejamento foi salvo. Gere uma nova prévia antes de confirmar novamente.',
        })

        setConfirmState({ status: 'idle', data: null, error: null })
        return
      }

      setConfirmState({
        status: 'error',
        data: null,
        error: getErrorMessage(error, 'Não foi possível confirmar o planejamento.'),
        canRetry: !(isHttpError(error) && error.status === 400),
      })
    } finally {
      confirmationInProgressRef.current = false
    }
  }, [previewState.data, confirmState, confirmationInProgressRef, demandUpdateInProgressRef, demandCreationInProgressRef, availabilityCreationInProgressRef, taskMutationInProgressRef, getErrorMessage, onRefreshAllDataOnly])

  return {
    previewState,
    confirmState,
    isConfirming,
    generatePreview,
    confirmPreview,
    clearPreview,
    invalidatePreview,
  }
}