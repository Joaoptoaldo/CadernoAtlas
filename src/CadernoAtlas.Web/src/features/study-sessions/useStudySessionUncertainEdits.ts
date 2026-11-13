import { useCallback, useEffect, useState } from 'react'
import type { StudySessionRequest } from './studySessionTypes'

export interface UncertainStudySessionEdit {
  sessionId: number
  request: StudySessionRequest
  timestamp: number
}

const STORAGE_KEY = 'cadernoatlas:uncertain-session-edits'

let memoryCache: UncertainStudySessionEdit[] = []

const listeners = new Set<() => void>()

function notifyListeners(): void {
  listeners.forEach((listener) => listener())
}

function isValidRequest(value: unknown): value is StudySessionRequest {
  if (typeof value !== 'object' || value === null) return false

  const request = value as Record<string, unknown>

  const isValidId = (id: unknown): boolean =>
    id === null ||
    (typeof id === 'number' && Number.isInteger(id) && id > 0)

  return (
    typeof request.titulo === 'string' &&
    typeof request.dataPlanejada === 'string' &&
    typeof request.horaInicioPlanejada === 'string' &&
    typeof request.duracaoPlanejadaMinutos === 'number' &&
    Number.isInteger(request.duracaoPlanejadaMinutos) &&
    request.duracaoPlanejadaMinutos >= 1 &&
    request.duracaoPlanejadaMinutos <= 1440 &&
    isValidId(request.demandaAcademicaId) &&
    isValidId(request.tarefaDemandaId) &&
    (request.observacoes === null || typeof request.observacoes === 'string') &&
    (request.observacoes === null || request.observacoes.length <= 1000)
  )
}

function isValidUncertainEdit(item: unknown): item is UncertainStudySessionEdit {
  if (typeof item !== 'object' || item === null) return false

  const candidate = item as Record<string, unknown>

  return (
    typeof candidate.sessionId === 'number' &&
    Number.isInteger(candidate.sessionId) &&
    candidate.sessionId > 0 &&
    isValidRequest(candidate.request) &&
    typeof candidate.timestamp === 'number' &&
    Number.isFinite(candidate.timestamp)
  )
}

function loadFromStorage(): UncertainStudySessionEdit[] {
  try {
    // Se o storage inteiro foi limpo, descartar também o cache em memória.
    if (sessionStorage.length === 0) {
      memoryCache = []
      return []
    }

    const stored = sessionStorage.getItem(STORAGE_KEY)

    if (!stored) {
      return memoryCache
    }

    const parsed: unknown = JSON.parse(stored)

    if (Array.isArray(parsed)) {
      const valid = parsed.filter(isValidUncertainEdit)
      memoryCache = valid
      return valid
    }
  } catch {
    // Preservar o cache em memória se o storage estiver indisponível.
  }

  return memoryCache
}

function saveToStorage(edits: UncertainStudySessionEdit[]): void {
  memoryCache = edits

  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(edits))
  } catch {
    // Manter o registro em memória caso o storage falhe.
  }

  notifyListeners()
}

export function clearAllUncertainEdits(): void {
  memoryCache = []

  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignorar indisponibilidade do storage.
  }

  notifyListeners()
}

export function clearUncertainEditForSession(sessionId: number): void {
  const current = loadFromStorage()
  const next = current.filter((edit) => edit.sessionId !== sessionId)

  saveToStorage(next)
}

export function useStudySessionUncertainEdits() {
  // A versão provoca nova renderização quando outra instância altera o cache.
  const [, setVersion] = useState(0)

  const forceUpdate = useCallback(() => {
    setVersion((version) => version + 1)
  }, [])

  useEffect(() => {
    listeners.add(forceUpdate)

    return () => {
      listeners.delete(forceUpdate)
    }
  }, [forceUpdate])

  const registerUncertainEdit = useCallback(
    (sessionId: number, request: StudySessionRequest): void => {
      const current = loadFromStorage()

      const next = [
        ...current.filter((edit) => edit.sessionId !== sessionId),
        {
          sessionId,
          request: { ...request },
          timestamp: Date.now(),
        },
      ]

      saveToStorage(next)
    },
    []
  )

  const clearUncertainEdit = useCallback((sessionId: number): void => {
    const current = loadFromStorage()
    const next = current.filter((edit) => edit.sessionId !== sessionId)

    saveToStorage(next)
  }, [])

  const getUncertainEditForSession = useCallback(
    (sessionId: number): UncertainStudySessionEdit | null => {
      return loadFromStorage().find((edit) => edit.sessionId === sessionId) ?? null
    },
    []
  )

  const isUncertainEdit = useCallback(
    (sessionId: number): boolean => {
      return getUncertainEditForSession(sessionId) !== null
    },
    [getUncertainEditForSession]
  )

  const uncertainEdits = loadFromStorage()

  return {
    uncertainEdits,
    registerUncertainEdit,
    clearUncertainEdit,
    getUncertainEditForSession,
    isUncertainEdit,
    hasAnyUncertainEdit: uncertainEdits.length > 0,
  }
}
