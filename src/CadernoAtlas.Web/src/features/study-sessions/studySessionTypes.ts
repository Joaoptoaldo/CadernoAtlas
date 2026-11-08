import type { LoadState } from '../shared/loadState'

export type SituacaoSessaoEstudo = 0 | 1 | 2 | 3

export const SituacaoSessaoEstudoEnum = {
  Planejada: 0,
  EmAndamento: 1,
  Concluida: 2,
  Cancelada: 3,
} as const

export interface SituacaoPresentation {
  label: string
  className: string
  queryValue: string
}

export const SITUACAO_PRESENTATION: Record<SituacaoSessaoEstudo, SituacaoPresentation> = {
  0: {
    label: 'Planejada',
    className: 'study-session-status-planejada',
    queryValue: 'Planejada',
  },
  1: {
    label: 'Em andamento',
    className: 'study-session-status-emandamento',
    queryValue: 'EmAndamento',
  },
  2: {
    label: 'Concluída',
    className: 'study-session-status-concluida',
    queryValue: 'Concluida',
  },
  3: {
    label: 'Cancelada',
    className: 'study-session-status-cancelada',
    queryValue: 'Cancelada',
  },
}

export const UNKNOWN_SITUACAO_PRESENTATION: SituacaoPresentation = {
  label: 'Desconhecida',
  className: 'study-session-status-desconhecida',
  queryValue: '',
}

export function getSituacaoPresentation(situacao: unknown): SituacaoPresentation {
  if (typeof situacao === 'number' && situacao in SITUACAO_PRESENTATION) {
    return SITUACAO_PRESENTATION[situacao as SituacaoSessaoEstudo]
  }
  return UNKNOWN_SITUACAO_PRESENTATION
}

export interface SituacaoOption {
  value: string
  label: string
  numericValue: SituacaoSessaoEstudo
}

export const situacaoOptions: SituacaoOption[] = [
  { value: 'Planejada', label: 'Planejada', numericValue: 0 },
  { value: 'EmAndamento', label: 'Em andamento', numericValue: 1 },
  { value: 'Concluida', label: 'Concluída', numericValue: 2 },
  { value: 'Cancelada', label: 'Cancelada', numericValue: 3 },
]

export const SITUACAO_QUERY_TO_NUMERIC: Record<string, SituacaoSessaoEstudo> = {
  Planejada: 0,
  EmAndamento: 1,
  Concluida: 2,
  Cancelada: 3,
  '0': 0,
  '1': 1,
  '2': 2,
  '3': 3,
}

export function matchesSituacaoFilter(sessionSituacao: unknown, filterValue: string): boolean {
  if (!filterValue) return true
  if (filterValue in SITUACAO_QUERY_TO_NUMERIC) {
    return sessionSituacao === SITUACAO_QUERY_TO_NUMERIC[filterValue]
  }
  const numeric = Number(filterValue)
  if (!Number.isNaN(numeric)) {
    return sessionSituacao === numeric
  }
  return false
}

export interface StudySession {
  id: number
  titulo: string
  dataPlanejada: string
  horaInicioPlanejada: string
  duracaoPlanejadaMinutos: number
  duracaoRealMinutos: number | null
  situacao: SituacaoSessaoEstudo
  demandaAcademicaId: number | null
  tarefaDemandaId: number | null
  observacoes: string | null
  criadoEm: string
  inicioRealEm: string | null
  concluidaEm: string | null
  canceladaEm: string | null
}

export interface StudySessionListItem {
  id: number
  titulo: string
  dataPlanejada: string
  horaInicioPlanejada: string
  duracaoPlanejadaMinutos: number
  duracaoRealMinutos: number | null
  situacao: SituacaoSessaoEstudo
  demandaAcademicaId: number | null
  tarefaDemandaId: number | null
}

export interface StudySessionRequest {
  titulo: string
  dataPlanejada: string
  horaInicioPlanejada: string
  duracaoPlanejadaMinutos: number
  demandaAcademicaId: number | null
  tarefaDemandaId: number | null
  observacoes: string | null
}

export interface StudySessionDemand {
  id: number
  titulo: string
}

export interface StudySessionTask {
  id: number
  demandaAcademicaId: number
  titulo: string
}

export type StudySessionTransition = 'iniciar' | 'concluir' | 'cancelar'

export interface StudySessionTransitionProps {
  id: number
  transition: StudySessionTransition
  session: StudySession
}

export interface StudySessionsPanelProps {
  state: LoadState<StudySessionListItem[]>
  onRetry: () => void
  demands: StudySessionDemand[]
  onLoadTasks: (demandId: number, signal: AbortSignal) => Promise<StudySessionTask[]>
  onCreate: (request: StudySessionRequest) => Promise<void>
  onReconcile: () => Promise<StudySessionListItem[] | void>
  creationOutcomeUnknown: boolean
  onCreationOutcomeUnknownChange: (value: boolean) => void
  onUpdate: (id: number, request: StudySessionRequest) => Promise<void>
  onReconcileEdit: () => Promise<StudySessionListItem[] | void>
  onEditOutcomeUnknownChange: (value: boolean) => void
  onTransition: (id: number, transition: StudySessionTransition) => Promise<StudySession>
  onDelete: (id: number) => Promise<void>
  isTransitioning: boolean
  isUncertain: (id: number) => boolean
  isDeleteUncertain: (id: number) => boolean
  getErrorMessage?: (error: unknown, fallback: string) => string
}

export interface StudySessionDetailProps {
  sessionId: number
  onClose: () => void
  demands: StudySessionDemand[]
  onLoadTasks: (demandId: number, signal: AbortSignal) => Promise<StudySessionTask[]>
  onUpdate: (id: number, request: StudySessionRequest) => Promise<void>
  onReconcile: () => Promise<StudySessionListItem[] | void>
  onEditOutcomeUnknownChange: (value: boolean) => void
  onTransition: (id: number, transition: StudySessionTransition) => Promise<StudySession>
  onDelete: (id: number) => Promise<void>
  isTransitioning: boolean
  isUncertain: (id: number) => boolean
  isDeleteUncertain: (id: number) => boolean
  onReconcileDelete?: () => Promise<StudySessionListItem[] | void>
  getErrorMessage?: (error: unknown, fallback: string) => string
}
