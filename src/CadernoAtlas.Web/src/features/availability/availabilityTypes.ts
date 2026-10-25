import type { LoadState } from '../shared/loadState'

export interface Availability {
  id: number
  data: string
  horaInicio: string
  horaFim: string
}

export interface CreateAvailabilityRequest {
  data: string
  horaInicio: string
  horaFim: string
}

export interface AvailabilityPanelProps {
  state: LoadState<Availability[]>
  monday: Date
  onRetry: () => void
  todayIso: string
  onCreate: (request: CreateAvailabilityRequest) => Promise<void>
  onReconcile: () => Promise<void>
  isCreating: boolean
  isConfirming: boolean
  isUpdatingDemand: boolean
  isCreatingTask: boolean
  isUpdatingTask: boolean
  isDeletingTask: boolean
  outcomeUnknown: boolean
  onOutcomeUnknownChange: (value: boolean) => void
}