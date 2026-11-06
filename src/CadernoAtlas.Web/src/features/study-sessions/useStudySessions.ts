import { useEffect, useState, useCallback, useRef } from 'react'
import { apiGet } from '../../apiClient'
import type { LoadState } from '../shared/loadState'
import type { StudySessionListItem } from './studySessionTypes'

interface UseStudySessionsOptions {
  apiGet: typeof apiGet
  getErrorMessage: (error: unknown, fallback: string) => string
}

interface UseStudySessionsReturn {
  sessionsState: LoadState<StudySessionListItem[]>
  setSessionsState: React.Dispatch<React.SetStateAction<LoadState<StudySessionListItem[]>>>
  setSessionsReloadToken: React.Dispatch<React.SetStateAction<number>>
  sessionsReloadToken: number
  loadStudySessions: (filters?: { dataDe?: string; dataAte?: string; situacao?: string }) => void
  reconcileStudySessions: () => Promise<StudySessionListItem[]>
}

export function useStudySessions(options: UseStudySessionsOptions): UseStudySessionsReturn {
  const { apiGet, getErrorMessage } = options

  const [sessionsState, setSessionsState] = useState<LoadState<StudySessionListItem[]>>({
    status: 'loading',
    data: null,
    error: null,
  })
  const [sessionsReloadToken, setSessionsReloadToken] = useState(0)
  const sessionsRequestIdRef = useRef(0)
  const currentFiltersRef = useRef<{ dataDe?: string; dataAte?: string; situacao?: string }>({})

  const buildQueryString = (filters?: { dataDe?: string; dataAte?: string; situacao?: string }): string => {
    const params = new URLSearchParams()
    if (filters?.dataDe) params.append('dataDe', filters.dataDe)
    if (filters?.dataAte) params.append('dataAte', filters.dataAte)
    if (filters?.situacao) params.append('situacao', filters.situacao)
    const query = params.toString()
    return query ? `?${query}` : ''
  }

  const loadStudySessions = useCallback((filters?: { dataDe?: string; dataAte?: string; situacao?: string }) => {
    const controller = new AbortController()
    const requestId = ++sessionsRequestIdRef.current

    const filtersToUse = filters ?? currentFiltersRef.current
    if (filters) {
      currentFiltersRef.current = filters
    }
    const queryString = buildQueryString(filtersToUse)
    apiGet<StudySessionListItem[]>(`/api/sessoes-estudo${queryString}`, controller.signal)
      .then((data) => {
        if (requestId !== sessionsRequestIdRef.current) return
        setSessionsState({ status: 'success', data, error: null })
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') return
        if (requestId !== sessionsRequestIdRef.current) return
        setSessionsState((previous) => ({
          ...previous,
          status: 'error',
          error: getErrorMessage(error, 'Verifique se a API está em execução e tente novamente.'),
        }))
      })

    return () => controller.abort()
  }, [apiGet, getErrorMessage])

  const reconcileStudySessions = useCallback(async () => {
    const controller = new AbortController()
    const requestId = ++sessionsRequestIdRef.current

    setSessionsState((prev) => ({ ...prev, status: 'loading', error: null }))

    try {
      const data = await apiGet<StudySessionListItem[]>(`/api/sessoes-estudo${buildQueryString(currentFiltersRef.current)}`, controller.signal)
      if (requestId !== sessionsRequestIdRef.current) {
        throw new Error('Requisição obsoleta')
      }
      setSessionsState({ status: 'success', data, error: null })
      return data
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw error
      }
      if (requestId !== sessionsRequestIdRef.current) {
        throw new Error('Requisição obsoleta')
      }
      const message = getErrorMessage(error, 'Não foi possível consultar as sessões de estudo. Tente novamente.')
      setSessionsState((prev) => ({ ...prev, status: 'error', error: message }))
      throw error
    } finally {
      controller.abort()
    }
  }, [apiGet, getErrorMessage])

  useEffect(() => {
    return loadStudySessions()
  }, [sessionsReloadToken, loadStudySessions])

  return {
    sessionsState,
    setSessionsState,
    setSessionsReloadToken,
    sessionsReloadToken,
    loadStudySessions,
    reconcileStudySessions,
  }
}