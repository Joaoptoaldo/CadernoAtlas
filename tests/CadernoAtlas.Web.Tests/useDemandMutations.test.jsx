import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { apiPost, apiPut } from '../../src/CadernoAtlas.Web/src/apiClient'
import { useDemandMutations } from '../../src/CadernoAtlas.Web/src/features/demands/useDemandMutations'

vi.mock('../../src/CadernoAtlas.Web/src/apiClient', () => ({
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  isHttpError: (error) => error instanceof Error && 'status' in error && typeof error.status === 'number',
}))

function makeOptions() {
  const demandCreationInProgressRef = { current: false }
  const demandUpdateInProgressRef = { current: false }
  const availabilityCreationInProgressRef = { current: false }
  const confirmationInProgressRef = { current: false }
  const taskMutationInProgressRef = { current: false }
  const invalidatePreview = vi.fn()
  const locks = {
    demandCreationInProgressRef,
    demandUpdateInProgressRef,
    availabilityCreationInProgressRef,
    confirmationInProgressRef,
    taskMutationInProgressRef,
    setDemandCreationInProgress: (value) => { demandCreationInProgressRef.current = value },
    setDemandUpdateInProgress: (value) => { demandUpdateInProgressRef.current = value },
    setAvailabilityCreationInProgress: (value) => { availabilityCreationInProgressRef.current = value },
    setConfirmationInProgress: (value) => { confirmationInProgressRef.current = value },
    setTaskMutationInProgress: (value) => { taskMutationInProgressRef.current = value },
  }
  return {
    options: {
      concurrencyLocks: locks,
      invalidatePreview,
      clearPreview: vi.fn(),
      refreshAllDemands: vi.fn(),
      setDemandState: vi.fn(),
      setAllDemandsState: vi.fn(),
      setDemandReloadToken: vi.fn(),
      setAllDemandsReloadToken: vi.fn(),
    },
    locks,
    invalidatePreview,
  }
}

afterEach(() => vi.clearAllMocks())

describe('useDemandMutations', () => {
  it('bloqueia a criação de demanda enquanto uma disponibilidade está sendo criada', async () => {
    const { options, locks } = makeOptions()
    locks.availabilityCreationInProgressRef.current = true
    const { result } = renderHook(() => useDemandMutations(options))

    await act(async () => {
      await expect(result.current.createDemand({ titulo: 'Nova demanda' }))
        .rejects.toThrow('Aguarde a operação em andamento')
    })
    expect(apiPost).not.toHaveBeenCalled()
  })

  it('usa a mesma regra para não invalidar a prévia em erros HTTP 422 conhecidos', async () => {
    const { options, invalidatePreview } = makeOptions()
    const validationError = Object.assign(new Error('Dados inválidos'), { status: 422 })
    apiPost.mockRejectedValueOnce(validationError)
    apiPut.mockRejectedValueOnce(validationError)
    const { result } = renderHook(() => useDemandMutations(options))

    await act(async () => {
      await expect(result.current.createDemandTask(1, { titulo: 'Tarefa' })).rejects.toThrow('Dados inválidos')
    })
    await act(async () => {
      await expect(result.current.updateDemandTask(1, 2, { titulo: 'Tarefa', ordem: 0, situacao: 0 })).rejects.toThrow('Dados inválidos')
    })

    expect(invalidatePreview).not.toHaveBeenCalled()
  })

  it('invalida a prévia em erros de rede e respostas HTTP 5xx', async () => {
    const { options, invalidatePreview } = makeOptions()
    apiPost.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    apiPut.mockRejectedValueOnce(Object.assign(new Error('Falha temporária'), { status: 503 }))
    const { result } = renderHook(() => useDemandMutations(options))

    await act(async () => {
      await expect(result.current.createDemandTask(1, { titulo: 'Tarefa' })).rejects.toThrow('Failed to fetch')
    })
    await act(async () => {
      await expect(result.current.updateDemandTask(1, 2, { titulo: 'Tarefa', ordem: 0, situacao: 0 })).rejects.toThrow('Falha temporária')
    })

    expect(invalidatePreview).toHaveBeenCalledTimes(2)
  })
})
