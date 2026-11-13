import { useState, useCallback, useEffect } from 'react'
import { apiGet } from '../../apiClient'
import type { StudySessionTransition } from './studySessionTypes'

interface UncertainTransition {
  sessionId: number
  transition: StudySessionTransition
  expectedStatus: number
  timestamp: number
}

const STORAGE_KEY = 'cadernoatlas:uncertain-session-transitions'
const VALID_TRANSITIONS: Set<string> = new Set(['iniciar', 'concluir', 'cancelar'])

let memoryCache: UncertainTransition[] = []

const listeners = new Set<() => void>()

function notifyListeners(): void {
  listeners.forEach((listener) => listener())
}

function isValidUncertainTransition(item: unknown): item is UncertainTransition {
  if (typeof item !== 'object' || item === null) return false
  const candidate = item as Record<string, unknown>
  return (
    typeof candidate.sessionId === 'number' &&
    Number.isInteger(candidate.sessionId) &&
    candidate.sessionId > 0 &&
    typeof candidate.transition === 'string' &&
    VALID_TRANSITIONS.has(candidate.transition) &&
    typeof candidate.expectedStatus === 'number' &&
    Number.isInteger(candidate.expectedStatus) &&
    [1, 2, 3].includes(candidate.expectedStatus) &&
    typeof candidate.timestamp === 'number' &&
    !Number.isNaN(candidate.timestamp)
  )
}

function loadFromStorage(): UncertainTransition[] {
  try {
    // Se o storage foi limpo explicitamente (length === 0), sincroniza cache em memória
    if (sessionStorage.length === 0) {
      memoryCache = []
      return []
    }
    const stored = sessionStorage.getItem(STORAGE_KEY)
    if (!stored) {
      return memoryCache
    }
    const parsed = JSON.parse(stored)
    if (Array.isArray(parsed)) {
      const valid = parsed.filter(isValidUncertainTransition)
      // Mantém memoryCache alinhado com dados válidos
      memoryCache = valid
      return valid
    }
  } catch {
    // Ignora erros de parsing; preserva memoryCache se existente para não liberar bloqueios indevidamente
  }
  return memoryCache
}

function saveToStorage(transitions: UncertainTransition[]): void {
  memoryCache = transitions
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(transitions))
  } catch {
    // Ignora erros de storage (quota, etc.) mantendo memoryCache
  }
  notifyListeners()
}

export function clearAllUncertainTransitions(): void {
  memoryCache = []
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignora erros de storage
  }
  notifyListeners()
}

export function clearUncertainForSession(sessionId: number, transition?: StudySessionTransition): void {
  const current = loadFromStorage()
  const next = current.filter((t) =>
    t.sessionId !== sessionId || (transition !== undefined && t.transition !== transition)
  )
  saveToStorage(next)
}

export function hasAnyUncertainTransition(): boolean {
  return loadFromStorage().length > 0 || memoryCache.length > 0
}

export function useStudySessionUncertainTransitions() {
  const [uncertainTransitions, setUncertainTransitions] = useState<UncertainTransition[]>(() =>
    loadFromStorage()
  )

  // Force update by incrementing a version counter
  const [, setVersion] = useState(0)
  const forceUpdate = useCallback(() => {
    setVersion((v) => v + 1)
  }, [])

  // Subscribe to cross-instance updates
  useEffect(() => {
    listeners.add(forceUpdate)
    return () => {
      listeners.delete(forceUpdate)
    }
  }, [forceUpdate])

  const registerUncertain = useCallback(
    (sessionId: number, transition: StudySessionTransition): void => {
      const current = loadFromStorage()

      const exists = current.some(
        (item) => item.sessionId === sessionId && item.transition === transition
      )

      if (exists) return

      const expectedStatus =
        transition === 'iniciar' ? 1 : transition === 'concluir' ? 2 : 3

      const next = [
        ...current,
        {
          sessionId,
          transition,
          expectedStatus,
          timestamp: Date.now(),
        },
      ]

      // Persistir e notificar fora da função de atualização do React.
      saveToStorage(next)
      setUncertainTransitions(next)
    },
    []
  )

  const clearUncertain = useCallback(
    (sessionId: number, transition?: StudySessionTransition): void => {
      const current = loadFromStorage()

      const next = current.filter(
        (item) =>
          item.sessionId !== sessionId ||
          (transition !== undefined && item.transition !== transition)
      )

      if (next.length === current.length) return

      // Persistir e notificar fora da função de atualização do React.
      saveToStorage(next)
      setUncertainTransitions(next)
    },
    []
  )

  const isUncertain = useCallback(
    (sessionId: number, transition?: StudySessionTransition): boolean => {
      const current = loadFromStorage()
      return current.some(
        (t) => t.sessionId === sessionId && (transition === undefined || t.transition === transition)
      )
    },
    []
  )

  const getUncertainForSession = useCallback(
    (sessionId: number): UncertainTransition[] => {
      const current = loadFromStorage()
      return current.filter((t) => t.sessionId === sessionId)
    },
    []
  )

  const hasAnyUncertain = uncertainTransitions.length > 0 || loadFromStorage().length > 0

  return {
    uncertainTransitions,
    registerUncertain,
    clearUncertain,
    isUncertain,
    getUncertainForSession,
    hasAnyUncertain,
  }
}

export async function reconcileUncertainTransition(
  sessionId: number,
  apiGetFn: typeof apiGet
): Promise<{ resolved: boolean; status?: number; error?: Error }> {
  try {
    const session = await apiGetFn<{ situacao: number }>(`/api/sessoes-estudo/${sessionId}`)
    return { resolved: true, status: session.situacao }
  } catch (error) {
    return { resolved: false, error: error instanceof Error ? error : new Error(String(error)) }
  }
}