import { useState, useCallback, useEffect } from 'react'

interface UncertainDeletion {
  sessionId: number
  timestamp: number
}

const STORAGE_KEY = 'cadernoatlas:uncertain-session-deletions'

let memoryCache: UncertainDeletion[] = []

const listeners = new Set<() => void>()

function notifyListeners(): void {
  listeners.forEach((listener) => listener())
}

function isValidUncertainDeletion(item: unknown): item is UncertainDeletion {
  if (typeof item !== 'object' || item === null) return false
  const candidate = item as Record<string, unknown>
  return (
    typeof candidate.sessionId === 'number' &&
    Number.isInteger(candidate.sessionId) &&
    candidate.sessionId > 0 &&
    typeof candidate.timestamp === 'number' &&
    Number.isFinite(candidate.timestamp)
  )
}

function loadFromStorage(): UncertainDeletion[] {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    if (!stored) {
      return memoryCache
    }
    const parsed = JSON.parse(stored)
    if (Array.isArray(parsed)) {
      const valid = parsed.filter(isValidUncertainDeletion)
      memoryCache = valid
      return valid
    }
  } catch {
    // Ignora erros de parsing ou storage indisponível; preserva memoryCache
  }
  return memoryCache
}

function saveToStorage(deletions: UncertainDeletion[]): void {
  memoryCache = deletions
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(deletions))
  } catch {
    // Ignora erros de storage
  }
  notifyListeners()
}

export function clearAllUncertainDeletions(): void {
  memoryCache = []
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignora erros de storage
  }
  notifyListeners()
}

export function clearDeleteUncertainForSession(sessionId: number): void {
  const current = loadFromStorage()
  const next = current.filter((d) => d.sessionId !== sessionId)
  saveToStorage(next)
}

export function useStudySessionUncertainDeletions() {
  const [uncertainDeletions, setUncertainDeletions] = useState<UncertainDeletion[]>(() =>
    loadFromStorage()
  )

  const [, setVersion] = useState(0)
  const forceUpdate = useCallback(() => {
    setVersion((v) => v + 1)
  }, [])

  useEffect(() => {
    listeners.add(forceUpdate)
    return () => {
      listeners.delete(forceUpdate)
    }
  }, [forceUpdate])

  const registerDeleteUncertain = useCallback((sessionId: number): void => {
    setUncertainDeletions((prev) => {
      const exists = prev.some((d) => d.sessionId === sessionId)
      if (exists) return prev
      const next = [...prev, { sessionId, timestamp: Date.now() }]
      saveToStorage(next)
      return next
    })
  }, [])

  const clearDeleteUncertain = useCallback((sessionId: number): void => {
    setUncertainDeletions((prev) => {
      const next = prev.filter((d) => d.sessionId !== sessionId)
      saveToStorage(next)
      return next
    })
  }, [])

  const isDeleteUncertain = useCallback(
    (sessionId: number): boolean => {
      const current = loadFromStorage()
      return current.some((d) => d.sessionId === sessionId)
    },
    []
  )

  const hasAnyDeleteUncertain = uncertainDeletions.length > 0 || loadFromStorage().length > 0

  return {
    uncertainDeletions,
    registerDeleteUncertain,
    clearDeleteUncertain,
    isDeleteUncertain,
    hasAnyDeleteUncertain,
  }
}