import { useEffect, useState, useCallback, useRef } from 'react'
import { apiGet } from '../../apiClient'
import type { LoadState } from '../shared/loadState.ts'
import type { PrioritizedDemand } from './DemandCard'
import type { AcademicDemandRecord } from './ManageDemandsPanel'

interface UseDemandListOptions {
  apiGet: typeof apiGet
  getErrorMessage: (error: unknown, fallback: string) => string
}

interface UseDemandListReturn {
  demandState: LoadState<PrioritizedDemand[]>
  allDemandsState: LoadState<AcademicDemandRecord[]>
  demandReloadToken: number
  allDemandsReloadToken: number
  setDemandState: React.Dispatch<React.SetStateAction<LoadState<PrioritizedDemand[]>>>
  setAllDemandsState: React.Dispatch<React.SetStateAction<LoadState<AcademicDemandRecord[]>>>
  setDemandReloadToken: React.Dispatch<React.SetStateAction<number>>
  setAllDemandsReloadToken: React.Dispatch<React.SetStateAction<number>>
}

export function useDemandList(options: UseDemandListOptions): UseDemandListReturn {
  const { apiGet, getErrorMessage } = options

  const [demandState, setDemandState] = useState<LoadState<PrioritizedDemand[]>>({
    status: 'loading',
    data: null,
    error: null,
  })
  const [allDemandsState, setAllDemandsState] = useState<LoadState<AcademicDemandRecord[]>>({
    status: 'loading',
    data: null,
    error: null,
  })
  const [demandReloadToken, setDemandReloadToken] = useState(0)
  const [allDemandsReloadToken, setAllDemandsReloadToken] = useState(0)
  const demandRequestIdRef = useRef(0)
  const allDemandsRequestIdRef = useRef(0)

  const loadPrioritizedDemands = useCallback(() => {
    const controller = new AbortController()
    const requestId = ++demandRequestIdRef.current

    apiGet<PrioritizedDemand[]>('/api/demandas-academicas/priorizadas', controller.signal)
      .then((data) => {
        if (requestId !== demandRequestIdRef.current) return
        setDemandState({ status: 'success', data, error: null })
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') return
        if (requestId !== demandRequestIdRef.current) return
        setDemandState((previous) => ({
          ...previous,
          status: 'error',
          error: getErrorMessage(error, 'Verifique se a API está em execução e tente novamente.'),
        }))
      })

    return () => controller.abort()
  }, [apiGet, getErrorMessage])

  const loadAllDemands = useCallback(() => {
    const controller = new AbortController()
    const requestId = ++allDemandsRequestIdRef.current

    apiGet<AcademicDemandRecord[]>('/api/demandas-academicas', controller.signal)
      .then((data) => {
        if (requestId !== allDemandsRequestIdRef.current) return
        setAllDemandsState({ status: 'success', data, error: null })
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') return
        if (requestId !== allDemandsRequestIdRef.current) return
        setAllDemandsState((previous) => ({
          ...previous,
          status: 'error',
          error: getErrorMessage(error, 'Verifique se a API está em execução e tente novamente.'),
        }))
      })

    return () => controller.abort()
  }, [apiGet, getErrorMessage])

  useEffect(() => {
    return loadPrioritizedDemands()
  }, [demandReloadToken, loadPrioritizedDemands])

  useEffect(() => {
    return loadAllDemands()
  }, [allDemandsReloadToken, loadAllDemands])

  return {
    demandState,
    allDemandsState,
    demandReloadToken,
    allDemandsReloadToken,
    setDemandState,
    setAllDemandsState,
    setDemandReloadToken,
    setAllDemandsReloadToken,
  }
}