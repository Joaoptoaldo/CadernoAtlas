import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useDemandList } from '../../src/CadernoAtlas.Web/src/features/demands/useDemandList'

afterEach(() => vi.clearAllMocks())

const getErrorMessage = (error, fallback) => error instanceof Error ? error.message : fallback

describe('useDemandList', () => {
  it('aborta as consultas em andamento ao desmontar', () => {
    const apiGet = vi.fn((_path, _signal) => new Promise(() => {}))
    const { unmount } = renderHook(() => useDemandList({ apiGet, getErrorMessage }))

    expect(apiGet).toHaveBeenCalledTimes(2)
    const signals = apiGet.mock.calls.map((call) => call[1])
    expect(signals.every((signal) => signal instanceof AbortSignal)).toBe(true)
    unmount()
    expect(signals.every((signal) => signal.aborted)).toBe(true)
  })

  it('ignora resultados de um cliente anterior depois que o loader muda', async () => {
    let resolveOldPrioritized
    let resolveOldAll
    const oldApiGet = vi.fn((path) => new Promise((resolve) => {
      if (path.endsWith('/priorizadas')) resolveOldPrioritized = resolve
      else resolveOldAll = resolve
    }))
    const newApiGet = vi.fn((path) => Promise.resolve(
      path.endsWith('/priorizadas')
        ? [{ demanda: { id: 2, titulo: 'Atual' } }]
        : [{ id: 2, titulo: 'Lista atual' }],
    ))
    const { result, rerender } = renderHook(
      ({ apiGet }) => useDemandList({ apiGet, getErrorMessage }),
      { initialProps: { apiGet: oldApiGet } },
    )

    rerender({ apiGet: newApiGet })
    await waitFor(() => expect(result.current.demandState.status).toBe('success'))
    expect(result.current.demandState.data[0].demanda.titulo).toBe('Atual')
    expect(result.current.allDemandsState.status).toBe('success')

    await act(async () => {
      resolveOldPrioritized([{ demanda: { id: 1, titulo: 'Obsoleta' } }])
      resolveOldAll([{ id: 1, titulo: 'Lista obsoleta' }])
    })

    expect(result.current.demandState.data[0].demanda.titulo).toBe('Atual')
    expect(result.current.allDemandsState.data[0].titulo).toBe('Lista atual')
  })
})
