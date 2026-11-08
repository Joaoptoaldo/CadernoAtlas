import { useRef, useState } from 'react'
import { apiGet, apiPost, apiPut, apiDelete, HttpError, isHttpError } from '../../apiClient'
import type { StudySession, StudySessionRequest, StudySessionTransition } from './studySessionTypes'
import type { ConcurrencyLocks } from '../shared/useConcurrencyLocks'
import { MutationSyncError } from '../shared/mutationOutcome'
import { useStudySessionUncertainTransitions } from './useStudySessionUncertainTransitions'
import { useStudySessionUncertainDeletions } from './useStudySessionUncertainDeletions'

interface UseStudySessionMutationsOptions {
  refresh: () => Promise<void>
  invalidatePreview: () => void
  concurrencyLocks: Pick<ConcurrencyLocks, 'confirmationInProgressRef' | 'studySessionMutationInProgressRef' | 'dataMutationInProgressRef' | 'setStudySessionMutationInProgress' | 'setDataMutationInProgress'>
}

export function useStudySessionMutations({ refresh, invalidatePreview, concurrencyLocks }: UseStudySessionMutationsOptions) {
  const [isMutating, setIsMutating] = useState(false)
  const mutationRef = useRef(false)
  const { dataMutationInProgressRef, setStudySessionMutationInProgress, setDataMutationInProgress } = concurrencyLocks

  // Registro persistente de transições incertas
  const { registerUncertain, clearUncertain, isUncertain } = useStudySessionUncertainTransitions()
  // Registro persistente de exclusões incertas
  const { registerDeleteUncertain, clearDeleteUncertain, isDeleteUncertain } = useStudySessionUncertainDeletions()

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
    // Impedir transição se houver transição incerta não reconciliada para esta sessão
    if (isUncertain(id)) {
      throw new Error('Esta sessão possui uma transição não reconciliada. Reconcilie antes de tentar uma nova transição.')
    }
    // Impedir transição se houver exclusão incerta não reconciliada para esta sessão
    if (isDeleteUncertain(id)) {
      throw new Error('Esta sessão possui uma exclusão não reconciliada. Reconcilie antes de tentar uma nova transição.')
    }
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
      // Sucesso total - limpar qualquer registro de incerteza
      clearUncertain(id, transition)
      return session
    } catch (error: unknown) {
      if (error instanceof MutationSyncError) throw error
      const uncertain = !isHttpError(error) || error.status === 408 || error.status === 429 || error.status >= 500
      if (!uncertain) throw error
      invalidatePreview()

      // Registrar transição incerta persistentemente
      registerUncertain(id, transition)

      try {
        const reconciled = await apiGet<StudySession>(`/api/sessoes-estudo/${id}`)
        const expectedStatus = transition === 'iniciar' ? 1 : transition === 'concluir' ? 2 : 3
        if (reconciled.situacao === expectedStatus) {
          try {
            await refresh()
          } catch (error: unknown) {
            // Preservar MutationSyncError - a transição foi confirmada pelo GET individual
            throw new MutationSyncError(`A transição foi confirmada, mas a lista não pôde ser atualizada. ${error instanceof Error ? error.message : 'Tente atualizar a lista novamente.'}`)
          }
          // Reconciliação automática confirmada - limpar registro
          clearUncertain(id, transition)
          return reconciled
        }
        // GET individual retornou estado diferente do esperado.
        // Como o POST original teve resultado incerto, não podemos confirmar se a transição
        // falhou ou se o GET está desatualizado. Preservar erro original de outcome uncertain.
        throw error
      } catch (reconciliationError: unknown) {
        // Se o GET individual falhar (rede, 404, etc.), o resultado permanece incerto
        // Não transformar em MutationSyncError - manter o erro original de outcome uncertain
        if (reconciliationError instanceof HttpError) {
          if (reconciliationError.status === 409) throw reconciliationError
          // Se o GET individual falhou por rede (408, 429, 5xx) ou 404, o resultado permanece incerto
          if (reconciliationError.status === 404 || reconciliationError.status === 408 || reconciliationError.status === 429 || reconciliationError.status >= 500) {
            throw error // Preservar erro original de outcome uncertain
          }
        }
        // Para outros erros de reconciliação (não HttpError = rede), também preservar erro original
        throw error
      }
    } finally {
      mutationRef.current = false
      setStudySessionMutationInProgress(false)
      setDataMutationInProgress(false)
      setIsMutating(false)
    }
  }

  async function deleteSession(id: number): Promise<void> {
    // Verificar se há transição incerta pendente para esta sessão
    if (isUncertain(id)) {
      throw new Error('Esta sessão possui uma transição não reconciliada. Reconcilie antes de tentar excluir.')
    }
    // Verificar se há exclusão incerta pendente para esta sessão
    if (isDeleteUncertain(id)) {
      throw new Error('Esta sessão possui uma exclusão não reconciliada. Reconcilie antes de tentar excluir novamente.')
    }
    if (mutationRef.current || dataMutationInProgressRef.current) throw new Error('Aguarde a operação de planejamento ou sessão de estudo em andamento.')
    mutationRef.current = true
    setStudySessionMutationInProgress(true)
    setDataMutationInProgress(true)
    setIsMutating(true)
    try {
      await apiDelete(`/api/sessoes-estudo/${id}`)
      invalidatePreview()
      try {
        await refresh()
      } catch (error: unknown) {
        throw new MutationSyncError(`A exclusão foi confirmada, mas a lista não pôde ser atualizada. ${error instanceof Error ? error.message : 'Tente atualizar a lista novamente.'}`)
      }
      // Sucesso total - limpar qualquer registro de incerteza para esta sessão
      clearUncertain(id)
      clearDeleteUncertain(id)
    } catch (error: unknown) {
      if (error instanceof MutationSyncError) throw error
      // Para DELETE, registramos incerteza de exclusão apenas para erros de rede.
      // Isso evita reenvio automático e permite reconciliação explícita via GET.
      if (!isHttpError(error) || error.status === 408 || error.status === 429 || error.status >= 500) {
        invalidatePreview()
        registerDeleteUncertain(id)
      }
      throw error
    } finally {
      mutationRef.current = false
      setStudySessionMutationInProgress(false)
      setDataMutationInProgress(false)
      setIsMutating(false)
    }
  }

  return { isMutating, createSession, updateSession, transitionSession, deleteSession, isUncertain, isDeleteUncertain, registerDeleteUncertain, clearDeleteUncertain }
}
