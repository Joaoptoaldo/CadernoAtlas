import { useMemo } from 'react'
import type { LoadState } from '../shared/loadState'
import type { StudySessionListItem } from './studySessionTypes'

interface UseStudySessionsDataOptions {
  sessionsState: LoadState<StudySessionListItem[]>
  weekStart: Date
}

interface DemandDistributionItem {
  demandId: number | null
  demandTitle: string
  count: number
  percentage: number
}

interface UpcomingSession {
  id: number
  titulo: string
  dataPlanejada: string
  horaInicioPlanejada: string
  duracaoPlanejadaMinutos: number
  demandaAcademicaId: number | null
}

interface UseStudySessionsDataReturn {
  plannedCount: number
  completedThisWeek: number
  totalPlannedMinutes: number
  nextSession: UpcomingSession | null
  distributionByDemand: DemandDistributionItem[]
  upcomingSessions: UpcomingSession[]
  isLoading: boolean
  isError: boolean
  errorMessage: string | null
}

function isThisWeek(dateStr: string, weekStart: Date): boolean {
  const date = new Date(dateStr + 'T00:00:00')
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)
  return date >= weekStart && date <= weekEnd
}

export function useStudySessionsData({
  sessionsState,
  weekStart,
}: UseStudySessionsDataOptions): UseStudySessionsDataReturn {
  const sessions = sessionsState.data ?? []

  const plannedCount = useMemo(
    () => sessions.filter((s) => s.situacao === 0).length,
    [sessions]
  )

  const completedThisWeek = useMemo(
    () =>
      sessions.filter(
        (s) => s.situacao === 2 && isThisWeek(s.dataPlanejada, weekStart)
      ).length,
    [sessions, weekStart]
  )

  const totalPlannedMinutes = useMemo(
    () =>
      sessions.reduce((sum, s) => sum + s.duracaoPlanejadaMinutos, 0),
    [sessions]
  )

  const nextSession = useMemo(() => {
    const planned = sessions
      .filter((s) => s.situacao === 0)
      .sort((a, b) => {
        const dateA = new Date(a.dataPlanejada + 'T' + a.horaInicioPlanejada).getTime()
        const dateB = new Date(b.dataPlanejada + 'T' + b.horaInicioPlanejada).getTime()
        return dateA - dateB
      })
    if (planned.length === 0) return null
    const s = planned[0]
    return {
      id: s.id,
      titulo: s.titulo,
      dataPlanejada: s.dataPlanejada,
      horaInicioPlanejada: s.horaInicioPlanejada,
      duracaoPlanejadaMinutos: s.duracaoPlanejadaMinutos,
      demandaAcademicaId: s.demandaAcademicaId,
    }
  }, [sessions])

  const distributionByDemand = useMemo(() => {
    const plannedSessions = sessions.filter((s) => s.situacao === 0)
    const total = plannedSessions.length
    if (total === 0) return []

    const grouped = new Map<number | null, { count: number; title: string }>()
    plannedSessions.forEach((s) => {
      const key = s.demandaAcademicaId
      const existing = grouped.get(key) ?? { count: 0, title: key ? `Demanda #${key}` : 'Sem demanda' }
      existing.count += 1
      grouped.set(key, existing)
    })

    return Array.from(grouped.entries())
      .map(([demandId, { count, title }]) => ({
        demandId,
        demandTitle: title,
        count,
        percentage: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count)
  }, [sessions])

  const upcomingSessions = useMemo(() => {
    return sessions
      .filter((s) => s.situacao === 0)
      .sort((a, b) => {
        const dateA = new Date(a.dataPlanejada + 'T' + a.horaInicioPlanejada).getTime()
        const dateB = new Date(b.dataPlanejada + 'T' + b.horaInicioPlanejada).getTime()
        return dateA - dateB
      })
      .slice(0, 5)
      .map((s) => ({
        id: s.id,
        titulo: s.titulo,
        dataPlanejada: s.dataPlanejada,
        horaInicioPlanejada: s.horaInicioPlanejada,
        duracaoPlanejadaMinutos: s.duracaoPlanejadaMinutos,
        demandaAcademicaId: s.demandaAcademicaId,
      }))
  }, [sessions])

  return {
    plannedCount,
    completedThisWeek,
    totalPlannedMinutes,
    nextSession,
    distributionByDemand,
    upcomingSessions,
    isLoading: sessionsState.status === 'loading',
    isError: sessionsState.status === 'error',
    errorMessage: sessionsState.error,
  }
}