import { useRef, useState } from 'react'
import { apiGet, apiPost, apiPut, HttpError, isHttpError } from '../../apiClient'
import type { StudySession, StudySessionRequest, StudySessionTransition } from './studySessionTypes'
import type { ConcurrencyLocks } from '../shared/useConcurrencyLocks'
import { MutationSyncError } from '../shared/mutationOutcome'

interface UseStudySessionMutationsOptions {
  refresh: () => Promise<void>
  invalidatePreview: () => void
  concurrencyLocks: Pick<ConcurrencyLocks, 'confirmationInProgressRef' | 'studySessionMutationInProgressRef' | 'dataMutationInProgressRef' | 'setStudySessionMutationInProgress' | 'setDataMutationInProgress'>
}

export function useStudySessionMutations({ refresh, invalidatePreview, concurrencyLocks }: UseStudySessionMutationsOptions) {
  const [isMutating, setIsMutating] = useState(false)
  const mutationRef = useRef(false)
  const { dataMutationInProgressRef, setStudySessionMutationInProgress, setDataMutationInProgress } = concurrencyLocks

  async function createSession(request: StudySessionRequest): Promise<void> {
    if (mutationRef.current || dataMutationInProgressRef.current) throw new Error('Aguarde a operação de planejamento ou sessão de estudo em andamento.')
    mutationRef.current = true
    setStudySessionMutationInProgress(true)
    setDataMutationInProgress(true)
    setIsMutating(true)
    try {
      await apiPost<StudySession, StudySessionRequest>('/api/sessoes-estudo', request)
      invalidatePreview()
      try {
        await refresh()
      } catch (error: unknown) {
        throw new MutationSyncError(`A sessão foi criada, mas a lista não pôde ser atualizada. ${error instanceof Error ? error.message : 'Tente atualizar a lista novamente.'}`)
      }
    } catch (error: unknown) {
      if (!(error instanceof MutationSyncError) && (!isHttpError(error) || error.status === 408 || error.status === 429 || error.status >= 500)) {
        invalidatePreview()
      }
      throw error
    } finally {
      mutationRef.current = false
      setStudySessionMutationInProgress(false)
      setDataMutationInProgress(false)
      setIsMutating(false)
    }
  }

  async function updateSession(id: number, request: StudySessionRequest): Promise<void> {
    if (mutationRef.current || dataMutationInProgressRef.current) throw new Error('Aguarde a operação de planejamento ou sessão de estudo em andamento.')
    mutationRef.current = true
    setStudySessionMutationInProgress(true)
    setDataMutationInProgress(true)
    setIsMutating(true)
    try {
      await apiPut<StudySession, StudySessionRequest>(`/api/sessoes-estudo/${id}`, request)
      invalidatePreview()
      try {
        await refresh()
      } catch (error: unknown) {
        throw new MutationSyncError(`A sessão foi atualizada, mas a lista não pôde ser atualizada. ${error instanceof Error ? error.message : 'Tente atualizar a lista novamente.'}`)
      }
    } catch (error: unknown) {
      if (!(error instanceof MutationSyncError) && (!isHttpError(error) || error.status === 408 || error.status === 429 || error.status >= 500)) {
        invalidatePreview()
      }
      throw error
    } finally {
      mutationRef.current = false
      setStudySessionMutationInProgress(false)
      setDataMutationInProgress(false)
      setIsMutating(false)
    }
  }

  async function transitionSession(id: number, transition: StudySessionTransition): Promise<StudySession> {
    if (mutationRef.current || dataMutationInProgressRef.current) throw new Error('Aguarde a operação de planejamento ou sessão de estudo em andamento.')
    mutationRef.current = true
    setStudySessionMutationInProgress(true)
    setDataMutationInProgress(true)
    setIsMutating(true)
    const path = `/api/sessoes-estudo/${id}/${transition}`
    try {
      const session = await apiPost<StudySession, Record<string, never>>(path, {})
      invalidatePreview()
      try {
        await refresh()
      } catch (error: unknown) {
        throw new MutationSyncError(`A transição foi confirmada, mas a lista não pôde ser atualizada. ${error instanceof Error ? error.message : 'Tente atualizar a lista novamente.'}`)
      }
      return session
    } catch (error: unknown) {
      if (error instanceof MutationSyncError) throw error
      const uncertain = !isHttpError(error) || error.status === 408 || error.status === 429 || error.status >= 500
      if (!uncertain) throw error
      invalidatePreview()

      try {
        const reconciled = await apiGet<StudySession>(`/api/sessoes-estudo/${id}`)
        const expectedStatus = transition === 'iniciar' ? 1 : transition === 'concluir' ? 2 : 3
        if (reconciled.situacao === expectedStatus) {
          try {
            await refresh()
          } catch (error: unknown) {
            throw new MutationSyncError(`A transição foi confirmada, mas a lista não pôde ser atualizada. ${error instanceof Error ? error.message : 'Tente atualizar a lista novamente.'}`)
          }
          return reconciled
        }
        throw new HttpError('A sessão permanece no estado anterior. Você pode tentar a transição novamente explicitamente.', 409)
      } catch (reconciliationError: unknown) {
        if (reconciliationError instanceof HttpError && reconciliationError.status === 409) throw reconciliationError
        throw error
      }
    } finally {
      mutationRef.current = false
      setStudySessionMutationInProgress(false)
      setDataMutationInProgress(false)
      setIsMutating(false)
    }
  }

  return { isMutating, createSession, updateSession, transitionSession }
}
