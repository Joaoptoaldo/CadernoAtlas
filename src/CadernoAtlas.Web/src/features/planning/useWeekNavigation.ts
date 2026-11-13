import { useEffect, useCallback, useRef } from 'react'
import { apiGet } from '../../apiClient'
import { shiftDays } from '../../utils/planningFormatters'
import type { LoadState } from '../shared/loadState'
import type { Availability } from '../../features/availability/availabilityTypes'
import type { ConcurrencyLocks } from '../shared/useConcurrencyLocks'

interface UseWeekNavigationOptions {
  monday: Date
  setMonday: React.Dispatch<React.SetStateAction<Date>>
  concurrencyLocks: Pick<
    ConcurrencyLocks,
    'confirmationInProgressRef' | 'demandUpdateInProgressRef' | 'demandCreationInProgressRef' | 'taskMutationInProgressRef' | 'dataMutationInProgressRef'
  >
  clearPreview: () => void
  setAvailabilityState: React.Dispatch<React.SetStateAction<LoadState<Availability[]>>>
  availabilityReloadToken: number
  getErrorMessage: (error: unknown, fallback: string) => string
}

interface UseWeekNavigationReturn {
  monday: Date
  mondayIso: string
  sundayIso: string
  changeWeek: (days: number) => void
  selectCurrentWeek: () => void
  refreshAvailabilityNow: () => Promise<Availability[] | null>
}

export function toIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getInitialWeek(): Date {
  const today = new Date()
  const anchor = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  if (anchor.getDay() === 0) anchor.setDate(anchor.getDate() + 1)
  anchor.setDate(anchor.getDate() - ((anchor.getDay() + 6) % 7))
  return anchor
}

export function useWeekNavigation(options: UseWeekNavigationOptions): UseWeekNavigationReturn {
  const {
    monday,
    setMonday,
    concurrencyLocks,
    clearPreview,
    setAvailabilityState,
    availabilityReloadToken,
    getErrorMessage,
  } = options

  const mondayIso = toIsoDate(monday)
  const sundayIso = toIsoDate(shiftDays(monday, 6))

  // Request ID to track and discard stale responses
  const requestIdRef = useRef(0)

  const fetchAvailabilityForCurrentWeek = useCallback(async (): Promise<Availability[] | null> => {
    const requestId = ++requestIdRef.current
    const controller = new AbortController()
    const query = new URLSearchParams({ dataDe: mondayIso, dataAte: sundayIso })

    try {
      const data = await apiGet<Availability[]>(
        `/api/disponibilidades-estudo?${query.toString()}`,
        controller.signal,
      )

      if (requestId !== requestIdRef.current) {
        return null
      }

      setAvailabilityState({ status: 'success', data, error: null })
      return data
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        return null
      }

      if (requestId !== requestIdRef.current) {
        return null
      }

      setAvailabilityState((previous) => ({
        ...previous,
        status: 'error',
        error: getErrorMessage(
          error,
          'Verifique se a API está em execução e tente novamente.',
        ),
      }))

      throw error
    }
  }, [mondayIso, sundayIso, setAvailabilityState, getErrorMessage])

  useEffect(() => {
    const requestId = ++requestIdRef.current
    const controller = new AbortController()
    const query = new URLSearchParams({ dataDe: mondayIso, dataAte: sundayIso })

    apiGet<Availability[]>(`/api/disponibilidades-estudo?${query.toString()}`, controller.signal)
      .then((data) => {
        // Only apply if this is still the latest request
        if (requestId === requestIdRef.current) {
          setAvailabilityState({ status: 'success', data, error: null })
        }
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') return
        // Only apply error if this is still the latest request
        if (requestId === requestIdRef.current) {
          setAvailabilityState((previous) => ({
            ...previous,
            status: 'error',
            error: getErrorMessage(error, 'Verifique se a API está em execução e tente novamente.'),
          }))
        }
      })

    return () => controller.abort()
  }, [mondayIso, sundayIso, availabilityReloadToken, setAvailabilityState, getErrorMessage])

  const changeWeek = useCallback((days: number) => {
    if (concurrencyLocks.dataMutationInProgressRef.current) return

    clearPreview()
    setAvailabilityState((previous) => ({ ...previous, status: 'loading', error: null }))
    setMonday((current) => shiftDays(current, days))
  }, [concurrencyLocks, clearPreview, setAvailabilityState, setMonday])

  const selectCurrentWeek = useCallback(() => {
    if (concurrencyLocks.dataMutationInProgressRef.current) return

    const currentWeek = getInitialWeek()
    if (toIsoDate(currentWeek) === mondayIso) return
    clearPreview()
    setAvailabilityState((previous) => ({ ...previous, status: 'loading', error: null }))
    setMonday(currentWeek)
  }, [concurrencyLocks, clearPreview, mondayIso, setAvailabilityState, setMonday])

  const refreshAvailabilityNow = useCallback(async (): Promise<Availability[] | null> => {
    if (concurrencyLocks.dataMutationInProgressRef.current) {
      throw new Error('Reconciliação bloqueada por outra operação em andamento.')
    }
    clearPreview()
    setAvailabilityState((previous) => ({ ...previous, status: 'loading', error: null }))

    return fetchAvailabilityForCurrentWeek()
  }, [
    concurrencyLocks,
    clearPreview,
    setAvailabilityState,
    fetchAvailabilityForCurrentWeek,
  ])

  return {
    monday,
    mondayIso,
    sundayIso,
    changeWeek,
    selectCurrentWeek,
    refreshAvailabilityNow,
  }
}