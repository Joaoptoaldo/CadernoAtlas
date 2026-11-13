import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useStudySessionsData } from '../../../src/CadernoAtlas.Web/src/features/study-sessions/useStudySessionsData'

afterEach(() => {
  vi.useRealTimers()
})

const weekStart = new Date(2026, 10, 9)

function session(overrides = {}) {
  return {
    id: 1,
    titulo: 'Sessão',
    dataPlanejada: '2026-11-10',
    horaInicioPlanejada: '10:00:00',
    duracaoPlanejadaMinutos: 60,
    duracaoRealMinutos: null,
    situacao: 0,
    demandaAcademicaId: 1,
    tarefaDemandaId: null,
    concluidaEm: null,
    ...overrides,
  }
}

function renderData(sessions) {
  return renderHook(() => useStudySessionsData({
    sessionsState: { status: 'success', data: sessions, error: null },
    weekStart,
  })).result.current
}

describe('useStudySessionsData', () => {
  it('agrega apenas sessões planejadas da semana selecionada', () => {
    const data = renderData([
      session({ id: 1, duracaoPlanejadaMinutos: 90, demandaAcademicaId: 1 }),
      session({ id: 2, dataPlanejada: '2026-11-15', duracaoPlanejadaMinutos: 30, demandaAcademicaId: null }),
      session({ id: 3, dataPlanejada: '2026-11-16', duracaoPlanejadaMinutos: 120 }),
      session({ id: 4, dataPlanejada: '2026-11-08', duracaoPlanejadaMinutos: 120 }),
      session({ id: 5, situacao: 2, duracaoPlanejadaMinutos: 120 }),
    ])

    expect(data.plannedCount).toBe(2)
    expect(data.totalPlannedMinutes).toBe(120)
    expect(data.distributionByDemand).toEqual([
      { demandId: 1, demandTitle: 'Demanda #1', count: 1, percentage: 50 },
      { demandId: null, demandTitle: 'Sem demanda', count: 1, percentage: 50 },
    ])
  })

  it('ordena e limita a lista de sessões planejadas a cinco itens', () => {
    const data = renderData(Array.from({ length: 6 }, (_, index) => session({
      id: index + 1,
      dataPlanejada: `2026-11-${String(10 + index).padStart(2, '0')}`,
      horaInicioPlanejada: '10:00:00',
    })))

    expect(data.upcomingSessions).toHaveLength(5)
    expect(data.upcomingSessions.map((item) => item.id)).toEqual([1, 2, 3, 4, 5])
  })

  it('ignora horários passados ao escolher a próxima sessão', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-10T15:01:00-03:00'))

    const data = renderData([
      session({ id: 1, horaInicioPlanejada: '09:00:00' }),
      session({ id: 2, horaInicioPlanejada: '15:00:00' }),
      session({ id: 3, horaInicioPlanejada: '16:00:00' }),
    ])

    expect(data.nextSession?.id).toBe(3)
  })

  it('conta conclusões pela data efetiva no fuso de São Paulo', () => {
    const data = renderData([
      session({ id: 1, dataPlanejada: '2026-11-10', situacao: 2, concluidaEm: '2026-11-16T02:30:00Z' }),
      session({ id: 2, dataPlanejada: '2026-11-16', situacao: 2, concluidaEm: '2026-11-15T23:59:59Z' }),
      session({ id: 3, dataPlanejada: '2026-11-10', situacao: 2, concluidaEm: null }),
      session({ id: 4, dataPlanejada: '2026-11-10', situacao: 2, concluidaEm: '2026-11-16T03:00:00Z' }),
    ])

    expect(data.completedThisWeek).toBe(2)
  })

  it('inclui os dois limites da semana nas agregações', () => {
    const data = renderData([
      session({ id: 1, dataPlanejada: '2026-11-09' }),
      session({ id: 2, dataPlanejada: '2026-11-15' }),
    ])

    expect(data.plannedCount).toBe(2)
    expect(data.upcomingSessions.map((item) => item.dataPlanejada)).toEqual(['2026-11-09', '2026-11-15'])
  })

  it('atualiza nextSession quando o horário avança', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-10T15:01:00-03:00'))

    const { result, rerender } = renderHook(
      ({ sessions }) => useStudySessionsData({
        sessionsState: { status: 'success', data: sessions, error: null },
        weekStart,
      }),
      { initialProps: { sessions: [
        session({ id: 1, horaInicioPlanejada: '15:00:00' }),
        session({ id: 2, horaInicioPlanejada: '16:00:00' }),
      ]}}
    )

    // Inicialmente nextSession deve ser a sessão das 15:00 (já passou)
    // waitFor para garantir que o hook processou o tempo
    expect(result.current.nextSession?.id).toBe(2)

    // Avança o relógio para 16:01
    vi.advanceTimersByTime(60 * 60 * 1000)
    vi.setSystemTime(new Date('2026-11-10T16:01:00-03:00'))

    // Força re-render para captar o novo horário
    rerender({ sessions: [
      session({ id: 1, horaInicioPlanejada: '15:00:00' }),
      session({ id: 2, horaInicioPlanejada: '16:00:00' }),
    ]})

    // Agora nextSession deve ser null pois todas passaram
    expect(result.current.nextSession).toBeNull()
  })

  it('limpa o intervalo ao desmontar o hook', () => {
    vi.useFakeTimers()

    const { unmount } = renderHook(() => useStudySessionsData({
      sessionsState: { status: 'success', data: [], error: null },
      weekStart,
    }))

    // Spy no clearInterval
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval')

    unmount()

    expect(clearIntervalSpy).toHaveBeenCalled()
    clearIntervalSpy.mockRestore()
  })
})
