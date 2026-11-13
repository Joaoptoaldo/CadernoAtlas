import { useCallback, useRef, useState } from 'react'
import { apiPost, isHttpError } from '../../apiClient'
import type { Availability, CreateAvailabilityRequest } from './availabilityTypes'
import type { LoadState } from '../shared/loadState'
import type { ConcurrencyLocks } from '../shared/useConcurrencyLocks'

interface UseAvailabilityMutationsOptions {
  concurrencyLocks: Pick<
    ConcurrencyLocks,
    | 'availabilityCreationInProgressRef'
    | 'dataMutationInProgressRef'
    | 'setAvailabilityCreationInProgress'
    | 'setDataMutationInProgress'
  >
  invalidatePreview: () => void
  setAvailabilityState: React.Dispatch<
    React.SetStateAction<LoadState<Availability[]>>
  >
  setAvailabilityReloadToken: React.Dispatch<React.SetStateAction<number>>
  setOutcomeUnknown: (value: boolean) => void
  refreshAvailabilityNow: () => Promise<Availability[] | null>
}

interface UseAvailabilityMutationsReturn {
  isCreatingAvailability: boolean
  createAvailability: (request: CreateAvailabilityRequest) => Promise<void>
  reconcileAvailability: () => Promise<void>
}

function shouldInvalidatePreviewOnError(error: unknown): boolean {
  if (!isHttpError(error)) return true

  return (
    error.status === 404 ||
    error.status === 408 ||
    error.status === 409 ||
    error.status === 429 ||
    error.status >= 500
  )
}

function normalizeTime(time: string): string {
  return time.slice(0, 5)
}

export function useAvailabilityMutations(
  options: UseAvailabilityMutationsOptions,
): UseAvailabilityMutationsReturn {
  const {
    concurrencyLocks,
    invalidatePreview,
    setAvailabilityState,
    setAvailabilityReloadToken,
    setOutcomeUnknown,
    refreshAvailabilityNow,
  } = options

  const [isCreatingAvailability, setIsCreatingAvailability] = useState(false)
  const uncertainRequestRef = useRef<CreateAvailabilityRequest | null>(null)

  const createAvailability = useCallback(async (
    request: CreateAvailabilityRequest,
  ) => {
    if (uncertainRequestRef.current !== null) {
      throw new Error(
        'Existe um cadastro com resultado incerto. Consulte os horários antes de tentar novamente.',
      )
    }

    if (concurrencyLocks.availabilityCreationInProgressRef.current) {
      throw new Error('Já existe um cadastro de disponibilidade em andamento.')
    }

    if (concurrencyLocks.dataMutationInProgressRef.current) {
      throw new Error(
        'Aguarde a operação em andamento antes de cadastrar uma disponibilidade.',
      )
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
      setAvailabilityState((previous) => ({
        ...previous,
        status: 'loading',
        error: null,
      }))
      setAvailabilityReloadToken((value) => value + 1)
      uncertainRequestRef.current = null
      setOutcomeUnknown(false)
    } catch (error: unknown) {
      if (shouldInvalidatePreviewOnError(error)) {
        invalidatePreview()
      }

      const hasUnknownOutcome =
        !isHttpError(error) ||
        error.status === 408 ||
        error.status === 429 ||
        error.status >= 500

      if (hasUnknownOutcome) {
        uncertainRequestRef.current = request
        setOutcomeUnknown(true)
      }

      throw error
    } finally {
      concurrencyLocks.setAvailabilityCreationInProgress(false)
      concurrencyLocks.setDataMutationInProgress(false)
      setIsCreatingAvailability(false)
    }
  }, [
    concurrencyLocks,
    invalidatePreview,
    setAvailabilityState,
    setAvailabilityReloadToken,
    setOutcomeUnknown,
  ])

  const reconcileAvailability = useCallback(async () => {
    const uncertainRequest = uncertainRequestRef.current

    if (!uncertainRequest) {
      throw new Error('Não existe um cadastro pendente de reconciliação.')
    }

    const availability = await refreshAvailabilityNow()

    if (availability === null) {
      throw new Error(
        'A consulta não pôde ser concluída com uma resposta atualizada. Consulte novamente.',
      )
    }

    const requestWasFound = availability.some((item) =>
      item.data === uncertainRequest.data &&
      normalizeTime(item.horaInicio) === normalizeTime(uncertainRequest.horaInicio) &&
      normalizeTime(item.horaFim) === normalizeTime(uncertainRequest.horaFim),
    )

    if (!requestWasFound) {
      throw new Error(
        'O horário informado ainda não aparece na lista. O resultado do cadastro continua incerto. Consulte novamente antes de tentar cadastrar.',
      )
    }

    uncertainRequestRef.current = null
    setOutcomeUnknown(false)
  }, [refreshAvailabilityNow, setOutcomeUnknown])

  return {
    isCreatingAvailability,
    createAvailability,
    reconcileAvailability,
  }
}
