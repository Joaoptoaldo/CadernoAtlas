import { useEffect, useMemo, useState } from 'react'
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
  const weekStartIso = toIsoDate(weekStart)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)
  return dateStr >= weekStartIso && dateStr <= toIsoDate(weekEnd)
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toLocalDateTime(dateStr: string, timeStr: string): number {
  const [year, month, day] = dateStr.split('-').map(Number)
  const [hours, minutes, seconds = 0] = timeStr.split(':').map(Number)
  return Date.UTC(year, month - 1, day, hours, minutes, seconds)
}

function getSaoPauloDateParts(date: Date): { year: number; month: number; day: number; hours: number; minutes: number; seconds: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, Number(value)]))
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hours: values.hour,
    minutes: values.minute,
    seconds: values.second,
  }
}

function getSaoPauloDateIso(date: Date): string {
  const { year, month, day } = getSaoPauloDateParts(date)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function isCompletionInWeek(dateStr: string | null, weekStart: Date): boolean {
  return dateStr ? isThisWeek(getSaoPauloDateIso(new Date(dateStr)), weekStart) : false
}

export function useStudySessionsData({
  sessionsState,
  weekStart,
}: UseStudySessionsDataOptions): UseStudySessionsDataReturn {
  const sessions = useMemo(() => sessionsState.data ?? [], [sessionsState.data])
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const intervalId = setInterval(() => {
      setNow(new Date())
    }, 60000)

    return () => clearInterval(intervalId)
  }, [])

  const plannedCount = useMemo(
    () => sessions.filter((s) => s.situacao === 0 && isThisWeek(s.dataPlanejada, weekStart)).length,
    [sessions, weekStart]
  )

  const completedThisWeek = useMemo(
    () =>
      sessions.filter(
        (s) => s.situacao === 2 && isCompletionInWeek(s.concluidaEm, weekStart)
      ).length,
    [sessions, weekStart]
  )

  const totalPlannedMinutes = useMemo(
    () =>
      sessions
        .filter((s) => s.situacao === 0 && isThisWeek(s.dataPlanejada, weekStart))
        .reduce((sum, s) => sum + s.duracaoPlanejadaMinutos, 0),
    [sessions, weekStart]
  )

  const nextSession = useMemo(() => {
    const nowParts = getSaoPauloDateParts(now)
    const nowKey = Date.UTC(nowParts.year, nowParts.month - 1, nowParts.day, nowParts.hours, nowParts.minutes, nowParts.seconds)
    const planned = [...sessions]
      .filter((s) => s.situacao === 0 && isThisWeek(s.dataPlanejada, weekStart))
      .sort((a, b) => {
        return toLocalDateTime(a.dataPlanejada, a.horaInicioPlanejada) - toLocalDateTime(b.dataPlanejada, b.horaInicioPlanejada)
      })
      .filter((s) => toLocalDateTime(s.dataPlanejada, s.horaInicioPlanejada) >= nowKey)
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
  }, [now, sessions, weekStart])

  const distributionByDemand = useMemo(() => {
    const plannedSessions = sessions.filter((s) => s.situacao === 0 && isThisWeek(s.dataPlanejada, weekStart))
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
  }, [sessions, weekStart])

  const upcomingSessions = useMemo(() => {
    return [...sessions]
      .filter((s) => s.situacao === 0 && isThisWeek(s.dataPlanejada, weekStart))
      .sort((a, b) => {
        return toLocalDateTime(a.dataPlanejada, a.horaInicioPlanejada) - toLocalDateTime(b.dataPlanejada, b.horaInicioPlanejada)
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
  }, [sessions, weekStart])

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