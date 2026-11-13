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
  availabilityOutcomeUnknown: boolean
  concurrencyLocks: Pick<
    ConcurrencyLocks,
    'confirmationInProgressRef' | 'demandUpdateInProgressRef' | 'demandCreationInProgressRef' | 'availabilityCreationInProgressRef' | 'taskMutationInProgressRef' | 'studySessionMutationInProgressRef' | 'dataMutationInProgressRef' | 'setDataMutationInProgress'
  >
  onRefreshAllDataOnly: () => void
  onRefreshStudySessions: () => Promise<void>
  getErrorMessage: (error: unknown, fallback: string) => string
  hasUncertainTransitions: () => boolean
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
    availabilityOutcomeUnknown,
    onRefreshAllDataOnly,
    onRefreshStudySessions,
    getErrorMessage,
    hasUncertainTransitions,
  } = options

  const {
    confirmationInProgressRef,
    demandUpdateInProgressRef,
    demandCreationInProgressRef,
    availabilityCreationInProgressRef,
    taskMutationInProgressRef,
    studySessionMutationInProgressRef,
    dataMutationInProgressRef,
    setDataMutationInProgress,
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
    if (dataMutationInProgressRef.current) return
    invalidatePreview()
  }, [dataMutationInProgressRef, invalidatePreview])

  const generatePreview = useCallback(async () => {
    if (
      availabilityOutcomeUnknown ||
      demandCreationInProgressRef.current ||
      availabilityCreationInProgressRef.current ||
      confirmationInProgressRef.current ||
      demandUpdateInProgressRef.current ||
      taskMutationInProgressRef.current ||
      studySessionMutationInProgressRef.current ||
      dataMutationInProgressRef.current ||
      hasUncertainTransitions()
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
  }, [
    mondayIso,
    availabilityOutcomeUnknown,
    demandCreationInProgressRef,
    availabilityCreationInProgressRef,
    confirmationInProgressRef,
    demandUpdateInProgressRef,
    taskMutationInProgressRef,
    studySessionMutationInProgressRef,
    dataMutationInProgressRef,
    getErrorMessage,
    hasUncertainTransitions,
  ])

  const confirmPreview = useCallback(async () => {
    const proposta = previewState.data
    if (
      !proposta ||
      availabilityOutcomeUnknown ||
      dataMutationInProgressRef.current ||
      confirmationInProgressRef.current ||
      demandUpdateInProgressRef.current ||
      demandCreationInProgressRef.current ||
      availabilityCreationInProgressRef.current ||
      taskMutationInProgressRef.current ||
      studySessionMutationInProgressRef.current ||
      (confirmState.status === 'error' && !confirmState.canRetry)
    ) return

    if (hasUncertainTransitions()) {
      setConfirmState({
        status: 'error',
        data: null,
        error: 'Existem transições de sessões de estudo não reconciliadas. Reconcilie as sessões antes de confirmar o planejamento.',
        canRetry: false,
      })
      return
    }

    confirmationInProgressRef.current = true
    setDataMutationInProgress(true)
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
      try {
        await onRefreshStudySessions()
      } catch {
        // A confirmação já foi aceita; a lista mantém o erro para uma consulta explícita.
      }
      onRefreshAllDataOnly()
    } catch (error: unknown) {
      const isConflict = isHttpError(error) && error.status === 409
      const outcomeUnknown = !isHttpError(error) || error.status === 408 || error.status === 429 || error.status >= 500

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
        try {
          await onRefreshStudySessions()
        } catch {
          // A lista mantém o erro de reconciliação; a confirmação continua incerta.
        }
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
      setDataMutationInProgress(false)
    }
  }, [
    previewState.data,
    confirmState,
    availabilityOutcomeUnknown,
    confirmationInProgressRef,
    demandUpdateInProgressRef,
    demandCreationInProgressRef,
    availabilityCreationInProgressRef,
    taskMutationInProgressRef,
    studySessionMutationInProgressRef,
    dataMutationInProgressRef,
    setDataMutationInProgress,
    getErrorMessage,
    onRefreshAllDataOnly,
    onRefreshStudySessions,
    hasUncertainTransitions,
  ])

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