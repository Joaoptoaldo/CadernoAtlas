import { useEffect, useState, useCallback } from 'react'
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
    'confirmationInProgressRef' | 'demandUpdateInProgressRef' | 'taskMutationInProgressRef'
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
  todayIso: string
  changeWeek: (days: number) => void
  selectCurrentWeek: () => void
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

  const [todayIso] = useState(() => toIsoDate(new Date()))

  const mondayIso = toIsoDate(monday)
  const sundayIso = toIsoDate(shiftDays(monday, 6))

  useEffect(() => {
    const controller = new AbortController()
    const query = new URLSearchParams({ dataDe: mondayIso, dataAte: sundayIso })

    apiGet<Availability[]>(`/api/disponibilidades-estudo?${query.toString()}`, controller.signal)
      .then((data) => setAvailabilityState({ status: 'success', data, error: null }))
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') return
        setAvailabilityState((previous) => ({
          ...previous,
          status: 'error',
          error: getErrorMessage(error, 'Verifique se a API está em execução e tente novamente.'),
        }))
      })

    return () => controller.abort()
  }, [mondayIso, sundayIso, availabilityReloadToken, setAvailabilityState, getErrorMessage])

  const changeWeek = useCallback((days: number) => {
    if (concurrencyLocks.confirmationInProgressRef.current || concurrencyLocks.demandUpdateInProgressRef.current || concurrencyLocks.taskMutationInProgressRef.current) return

    clearPreview()
    setAvailabilityState((previous) => ({ ...previous, status: 'loading', error: null }))
    setMonday((current) => shiftDays(current, days))
  }, [concurrencyLocks, clearPreview, setAvailabilityState, setMonday])

  const selectCurrentWeek = useCallback(() => {
    if (concurrencyLocks.confirmationInProgressRef.current || concurrencyLocks.demandUpdateInProgressRef.current || concurrencyLocks.taskMutationInProgressRef.current) return

    const currentWeek = getInitialWeek()
    if (toIsoDate(currentWeek) === mondayIso) return
    clearPreview()
    setAvailabilityState((previous) => ({ ...previous, status: 'loading', error: null }))
    setMonday(currentWeek)
  }, [concurrencyLocks, clearPreview, mondayIso, setAvailabilityState, setMonday])

  return {
    monday,
    mondayIso,
    sundayIso,
    todayIso,
    changeWeek,
    selectCurrentWeek,
  }
}