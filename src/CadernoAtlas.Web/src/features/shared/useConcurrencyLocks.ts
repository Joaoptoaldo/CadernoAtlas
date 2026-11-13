import { useRef, useCallback, useMemo } from 'react'

export interface ConcurrencyLocks {
  demandCreationInProgressRef: React.MutableRefObject<boolean>
  demandUpdateInProgressRef: React.MutableRefObject<boolean>
  availabilityCreationInProgressRef: React.MutableRefObject<boolean>
  confirmationInProgressRef: React.MutableRefObject<boolean>
  taskMutationInProgressRef: React.MutableRefObject<boolean>
  studySessionMutationInProgressRef: React.MutableRefObject<boolean>
  dataMutationInProgressRef: React.MutableRefObject<boolean>
  setDemandCreationInProgress: (value: boolean) => void
  setDemandUpdateInProgress: (value: boolean) => void
  setAvailabilityCreationInProgress: (value: boolean) => void
  setConfirmationInProgress: (value: boolean) => void
  setTaskMutationInProgress: (value: boolean) => void
  setStudySessionMutationInProgress: (value: boolean) => void
  setDataMutationInProgress: (value: boolean) => void
}

export function useConcurrencyLocks(): ConcurrencyLocks {
  const demandCreationInProgressRef = useRef(false)
  const demandUpdateInProgressRef = useRef(false)
  const availabilityCreationInProgressRef = useRef(false)
  const confirmationInProgressRef = useRef(false)
  const taskMutationInProgressRef = useRef(false)
  const studySessionMutationInProgressRef = useRef(false)
  const dataMutationInProgressRef = useRef(false)

  const setDemandCreationInProgress = useCallback((value: boolean) => {
    demandCreationInProgressRef.current = value
  }, [])

  const setDemandUpdateInProgress = useCallback((value: boolean) => {
    demandUpdateInProgressRef.current = value
  }, [])

  const setAvailabilityCreationInProgress = useCallback((value: boolean) => {
    availabilityCreationInProgressRef.current = value
  }, [])

  const setConfirmationInProgress = useCallback((value: boolean) => {
    confirmationInProgressRef.current = value
  }, [])

  const setTaskMutationInProgress = useCallback((value: boolean) => {
    taskMutationInProgressRef.current = value
  }, [])

  const setStudySessionMutationInProgress = useCallback((value: boolean) => {
    studySessionMutationInProgressRef.current = value
  }, [])

  const setDataMutationInProgress = useCallback((value: boolean) => {
    dataMutationInProgressRef.current = value
  }, [])

  return useMemo(() => ({
    demandCreationInProgressRef,
    demandUpdateInProgressRef,
    availabilityCreationInProgressRef,
    confirmationInProgressRef,
    taskMutationInProgressRef,
    studySessionMutationInProgressRef,
    dataMutationInProgressRef,
    setDemandCreationInProgress,
    setDemandUpdateInProgress,
    setAvailabilityCreationInProgress,
    setConfirmationInProgress,
    setTaskMutationInProgress,
    setStudySessionMutationInProgress,
    setDataMutationInProgress,
  }), [
    demandCreationInProgressRef,
    demandUpdateInProgressRef,
    availabilityCreationInProgressRef,
    confirmationInProgressRef,
    taskMutationInProgressRef,
    studySessionMutationInProgressRef,
    dataMutationInProgressRef,
    setDemandCreationInProgress,
    setDemandUpdateInProgress,
    setAvailabilityCreationInProgress,
    setConfirmationInProgress,
    setTaskMutationInProgress,
    setStudySessionMutationInProgress,
    setDataMutationInProgress,
  ])
}