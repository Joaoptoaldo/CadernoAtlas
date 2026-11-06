import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useStudySessions } from '../../src/CadernoAtlas.Web/src/features/study-sessions/useStudySessions'

afterEach(() => vi.clearAllMocks())

const getErrorMessage = (error, fallback) => error instanceof Error ? error.message : fallback

describe('useStudySessions', () => {
  it('aborta as consultas em andamento ao desmontar', () => {
    const apiGet = vi.fn((_path, _signal) => new Promise(() => {}))
    const { unmount } = renderHook(() => useStudySessions({ apiGet, getErrorMessage }))

    expect(apiGet).toHaveBeenCalledTimes(1)
    const signal = apiGet.mock.calls[0][1]
    expect(signal instanceof AbortSignal).toBe(true)
    unmount()
    expect(signal.aborted).toBe(true)
  })

  it('ignora resultados de um cliente anterior depois que o loader muda', async () => {
    let resolveOld
    const oldApiGet = vi.fn((_path) => new Promise((resolve) => {
      resolveOld = resolve
    }))
    const newApiGet = vi.fn((_path) => Promise.resolve([
      { id: 2, titulo: 'Atual', dataPlanejada: '2026-11-10', horaInicioPlanejada: '09:00:00', duracaoPlanejadaMinutos: 60, duracaoRealMinutos: null, situacao: 0, demandaAcademicaId: null, tarefaDemandaId: null },
    ]))
    const { result, rerender } = renderHook(
      ({ apiGet }) => useStudySessions({ apiGet, getErrorMessage }),
      { initialProps: { apiGet: oldApiGet } },
    )

    rerender({ apiGet: newApiGet })
    await waitFor(() => expect(result.current.sessionsState.status).toBe('success'))
    expect(result.current.sessionsState.data[0].titulo).toBe('Atual')

    await act(async () => {
      resolveOld([{ id: 1, titulo: 'Obsoleta', dataPlanejada: '2026-11-09', horaInicioPlanejada: '09:00:00', duracaoPlanejadaMinutos: 60, duracaoRealMinutos: null, situacao: 0, demandaAcademicaId: null, tarefaDemandaId: null }])
    })

    expect(result.current.sessionsState.data[0].titulo).toBe('Atual')
  })

  it('carrega lista de sessões com sucesso', async () => {
    const apiGet = vi.fn((_path) => Promise.resolve([
      { id: 1, titulo: 'Revisar Anatomia', dataPlanejada: '2026-11-10', horaInicioPlanejada: '09:00:00', duracaoPlanejadaMinutos: 90, duracaoRealMinutos: null, situacao: 0, demandaAcademicaId: 1, tarefaDemandaId: null },
      { id: 2, titulo: 'Resolver exercícios', dataPlanejada: '2026-11-11', horaInicioPlanejada: '14:00:00', duracaoPlanejadaMinutos: 60, duracaoRealMinutos: 55, situacao: 2, demandaAcademicaId: null, tarefaDemandaId: 2 },
    ]))
    const { result } = renderHook(() => useStudySessions({ apiGet, getErrorMessage }))

    await waitFor(() => expect(result.current.sessionsState.status).toBe('success'))
    expect(result.current.sessionsState.data).toHaveLength(2)
    expect(result.current.sessionsState.data[0].titulo).toBe('Revisar Anatomia')
    expect(result.current.sessionsState.data[1].situacao).toBe(2)
  })

  it('exibe estado vazio quando não há sessões', async () => {
    const apiGet = vi.fn((_path) => Promise.resolve([]))
    const { result } = renderHook(() => useStudySessions({ apiGet, getErrorMessage }))

    await waitFor(() => expect(result.current.sessionsState.status).toBe('success'))
    expect(result.current.sessionsState.data).toHaveLength(0)
  })

  it('trata falha na consulta', async () => {
    const apiGet = vi.fn((_path) => Promise.reject(new TypeError('Failed to fetch')))
    const { result } = renderHook(() => useStudySessions({ apiGet, getErrorMessage }))

    await waitFor(() => expect(result.current.sessionsState.status).toBe('error'))

    expect(result.current.sessionsState.error).toBe('Failed to fetch')
  })

  it('reconcilia sessões sob demanda', async () => {
    const apiGet = vi.fn((_path) => Promise.resolve([
      { id: 1, titulo: 'Sessão 1', dataPlanejada: '2026-11-10', horaInicioPlanejada: '09:00:00', duracaoPlanejadaMinutos: 60, duracaoRealMinutos: null, situacao: 0, demandaAcademicaId: null, tarefaDemandaId: null },
    ]))
    const { result } = renderHook(() => useStudySessions({ apiGet, getErrorMessage }))

    await waitFor(() => expect(result.current.sessionsState.status).toBe('success'))

    const data = await act(async () => {
      return await result.current.reconcileStudySessions()
    })

    expect(data).toHaveLength(1)
    expect(data[0].titulo).toBe('Sessão 1')
    expect(apiGet).toHaveBeenCalledTimes(2)
  })

  it('aplica filtros na URL da requisição', async () => {
    let callCount = 0
    const apiGet = vi.fn((path) => {
      callCount++
      if (callCount > 1) {
        expect(path).toContain('dataDe=2026-11-10')
        expect(path).toContain('dataAte=2026-11-15')
        expect(path).toContain('situacao=Planejada')
      }
      return Promise.resolve([])
    })
    const { result } = renderHook(() => useStudySessions({ apiGet, getErrorMessage }))

    await waitFor(() => expect(result.current.sessionsState.status).toBe('success'))

    result.current.loadStudySessions({ dataDe: '2026-11-10', dataAte: '2026-11-15', situacao: 'Planejada' })
    await waitFor(() => expect(result.current.sessionsState.status).toBe('success'))
    expect(apiGet).toHaveBeenCalledTimes(2)
  })
})