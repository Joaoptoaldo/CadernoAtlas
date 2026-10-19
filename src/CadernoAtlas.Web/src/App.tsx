import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import PlanningPreview from './features/planning/PlanningPreview'
import Icon from './components/ui/Icon'
import StatusMessage from './components/ui/StatusMessage'

import CreateDemandForm, {
  type CreateDemandRequest,
} from './features/demands/CreateDemandForm'
import CreateAvailabilityForm, {
  type CreateAvailabilityRequest,
} from './features/availability/CreateAvailabilityForm'

import type {
  ConfirmationData,
  ConfirmState,
  PlanningData,
  PreviewState,
} from './features/planning/PlanningPreview'

import {
  formatMinutes,
  formatWeekRange,
  minutesFromTime,
  shiftDays,
} from './utils/planningFormatters'

interface AcademicDemand {
  id?: number
  titulo?: string
  descricao?: string | null
  tipo?: number
  importancia?: number
  esforcoEstimadoMinutos?: number | null
}

interface PrioritizedDemand extends AcademicDemand {
  demanda?: AcademicDemand | null
  faixaUrgencia?: string | null
  diasAtePrazo?: number | null
  justificativa?: string | null
}

interface Availability {
  id: number
  data: string
  horaInicio: string
  horaFim: string
}

class HttpError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'HttpError'
  }
}

interface ProblemDetails {
  detail?: unknown
  title?: unknown
  errors?: unknown
}

interface PlanningConfirmationRequest {
  inicioSemana: PlanningData['inicioSemana']
  agora: PlanningData['agora']
  propostaId: PlanningData['propostaId']
  alocacoes: PlanningData['alocacoes']
}

interface CreatedDemandResponse {
  id: number
  titulo: string
  descricao: string | null
  tipo: number
  prazo: string | null
  importancia: number
  esforcoEstimadoMinutos: number | null
  situacao: number
  criadoEm: string
}

type LoadState<T> =
  | { status: 'loading'; data: T | null; error: null }
  | { status: 'success'; data: T; error: null }
  | { status: 'error'; data: T | null; error: string }

interface LoadingLinesProps {
  count?: number
}

interface DemandCardProps {
  item: PrioritizedDemand
}

interface AvailabilityPanelProps {
  state: LoadState<Availability[]>
  monday: Date
  onRetry: () => void
  todayIso: string
  onCreate: (request: CreateAvailabilityRequest) => Promise<void>
  isCreating: boolean
}

const DAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const TYPE_LABELS: Record<number, string> = {
  0: 'Prova',
  1: 'Trabalho',
  2: 'APG',
  3: 'TCC',
  4: 'Outro',
}
const IMPORTANCE_LABELS: Record<number, string> = {
  0: 'Baixa',
  1: 'Média',
  2: 'Alta',
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getInitialWeek(): Date {
  const today = new Date()
  const anchor = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  // No domingo, começa pela próxima semana para que o plano não abra quase vazio.
  if (anchor.getDay() === 0) anchor.setDate(anchor.getDate() + 1)
  anchor.setDate(anchor.getDate() - ((anchor.getDay() + 6) % 7))
  return anchor
}

function getWeekDays(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, index) => shiftDays(monday, index))
}

function typeLabel(type: number | undefined): string {
  return type === undefined ? 'Outro' : TYPE_LABELS[type] ?? 'Outro'
}

function importanceLabel(value: number | undefined): string {
  return value === undefined ? 'Não definida' : IMPORTANCE_LABELS[value] ?? 'Não definida'
}

function importanceClass(value: number | undefined): string {
  if (Number(value) === 2) return 'importance-high'
  if (Number(value) === 0) return 'importance-low'
  return 'importance-medium'
}

function getDeadlineLabel(item: PrioritizedDemand): string {
  if (item.diasAtePrazo == null) return 'Sem prazo definido'
  if (item.diasAtePrazo < 0) {
    const days = Math.abs(item.diasAtePrazo)
    return `Atrasada há ${days} ${days === 1 ? 'dia' : 'dias'}`
  }
  if (item.diasAtePrazo === 0) return 'Vence hoje'
  if (item.diasAtePrazo === 1) return 'Vence amanhã'
  return `Prazo em ${item.diasAtePrazo} dias`
}

function priorityClass(value: string): string {
  if (value === 'Atrasada' || value === 'Vence hoje') return 'urgency-urgent'
  if (value === 'Até 3 dias' || value === 'Até 7 dias') return 'urgency-soon'
  return 'urgency-normal'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isProblemDetails(value: unknown): value is ProblemDetails {
  return isRecord(value)
}

function getProblemMessage(problem: unknown, fallback: string): string {
  if (!isProblemDetails(problem)) return fallback
  if (typeof problem.detail === 'string') return problem.detail
  if (typeof problem.title === 'string') return problem.title
  return fallback
}

function isHttpError(error: unknown): error is HttpError {
  return error instanceof Error && 'status' in error && typeof error.status === 'number'
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

async function apiGet<TResponse>(path: string, signal?: AbortSignal): Promise<TResponse> {
  const response = await fetch(path, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  })

  if (!response.ok) {
    let message = `A API respondeu com o status ${response.status}.`
    try {
      const problem: unknown = await response.json()
      message = getProblemMessage(problem, message)
    } catch {
      // Algumas respostas de erro não possuem corpo JSON.
    }
    throw new HttpError(message, response.status)
  }

  return response.json() as Promise<TResponse>
}


async function apiPost<TResponse, TBody extends object>(path: string, body: TBody): Promise<TResponse> {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    let message = `A API respondeu com o status ${response.status}.`
    try {
      const problem: unknown = await response.json()
      message = getProblemMessage(problem, message)
      if (isProblemDetails(problem) && isRecord(problem.errors)) {
        const validationMessage = Object.values(problem.errors)
          .flatMap((value) => Array.isArray(value) ? value : [value])
          .find((value): value is string => typeof value === 'string' && Boolean(value))
        if (validationMessage) message = validationMessage
      }
    } catch {
      // Algumas respostas de erro não possuem corpo JSON.
    }
    throw new HttpError(message, response.status)
  }

  return response.json() as Promise<TResponse>
}

function LoadingLines({ count = 3 }: LoadingLinesProps) {
  return (
    <div className="loading-lines" aria-label="Carregando dados" role="status">
      {Array.from({ length: count }, (_, index) => (
        <div className="loading-row" key={index}>
          <span className="skeleton skeleton-icon" />
          <span className="loading-row-copy">
            <span className="skeleton skeleton-title" />
            <span className="skeleton skeleton-detail" />
          </span>
        </div>
      ))}
    </div>
  )
}

function DemandCard({ item }: DemandCardProps) {
  const demand = item.demanda ?? item
  const label = typeLabel(demand.tipo)
  const urgency = item.faixaUrgencia ?? 'Sem classificação'
  const estimatedMinutes = demand.esforcoEstimadoMinutos

  return (
    <article className="demand-card">
      <div className="demand-card-top">
        <span className="type-chip">{label}</span>
        <span className={`urgency-chip ${priorityClass(urgency)}`}>{urgency}</span>
      </div>
      <h3>{demand.titulo}</h3>
      {demand.descricao && <p className="demand-description">{demand.descricao}</p>}
      <div className="demand-meta">
        <span className="meta-item"><Icon name="calendar" size={15} />{getDeadlineLabel(item)}</span>
        <span className={`importance-chip ${importanceClass(demand.importancia)}`}>
          <span className="importance-dot" />{importanceLabel(demand.importancia)}
        </span>
        <span className="meta-item effort-meta">
          <Icon name="clock" size={15} />
          {estimatedMinutes == null ? 'A estimar' : formatMinutes(estimatedMinutes)}
        </span>
      </div>
      {item.justificativa && <p className="demand-justification">{item.justificativa}</p>}
    </article>
  )
}

function AvailabilityPanel({ state, monday, onRetry, todayIso, onCreate, isCreating }: AvailabilityPanelProps) {
  const [isFormOpen, setIsFormOpen] = useState(false)
  const weekStart = toIsoDate(monday)
  const weekEnd = toIsoDate(shiftDays(monday, 6))
  const days = useMemo(() => getWeekDays(monday), [monday])
  const grouped = useMemo(() => {
    const result = new Map<string, Availability[]>(days.map((day) => [toIsoDate(day), []]))
    for (const item of state.data ?? []) {
      const dayAvailability = result.get(item.data)
      if (dayAvailability) dayAvailability.push(item)
    }
    return result
  }, [days, state.data])

  const minutesByDay = days.map((day) => {
    const records = grouped.get(toIsoDate(day)) ?? []
    return records.reduce((total, record) => {
      return total + Math.max(0, minutesFromTime(record.horaFim) - minutesFromTime(record.horaInicio))
    }, 0)
  })
  const totalMinutes = minutesByDay.reduce((total, minutes) => total + minutes, 0)
  const maxMinutes = Math.max(1, ...minutesByDay)

  return (
    <section className="panel availability-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">SUA ROTINA</p>
          <h2>Disponibilidade</h2>
        </div>
        <span className="panel-heading-icon"><Icon name="calendarDays" size={19} /></span>
      </div>

      <button
        className="button button-secondary"
        type="button"
        aria-expanded={isFormOpen}
        disabled={isCreating}
        onClick={() => setIsFormOpen((open) => !open)}
      >
        {isFormOpen ? 'Fechar formulário' : 'Novo horário'}
      </button>

      {isFormOpen && (
        <CreateAvailabilityForm
          key={weekStart}
          weekStart={weekStart}
          weekEnd={weekEnd}
          todayIso={todayIso}
          onCreate={onCreate}
          onCancel={() => setIsFormOpen(false)}
        />
      )}

      {state.status === 'loading' ? (
        <LoadingLines count={3} />
      ) : state.status === 'error' && !state.data ? (
        <StatusMessage title="Não foi possível carregar os horários" description={state.error} onRetry={onRetry} compact />
      ) : (
        <>
          {state.status === 'error' && state.data && (
            <StatusMessage title="Os horários podem estar desatualizados" description={state.error} onRetry={onRetry} compact />
          )}
          <div className="availability-total">
            <span className="availability-total-number">{formatMinutes(totalMinutes)}</span>
            <span className="availability-total-label">disponíveis nesta semana</span>
          </div>
          <div className="weekly-bars" aria-label="Minutos disponíveis por dia">
            {days.map((day, index) => {
              const iso = toIsoDate(day)
              const minutes = minutesByDay[index]
              const isToday = todayIso === iso
              const height = minutes === 0 ? 4 : Math.max(10, (minutes / maxMinutes) * 48)
              return (
                <div className={`weekly-bar-day ${isToday ? 'is-today' : ''}`} key={iso}>
                  <div className="bar-track">
                    <div className={`bar-fill ${minutes > 0 ? 'has-time' : ''}`} style={{ height: `${height}px` }} />
                  </div>
                  <span className="bar-day-label">{DAY_LABELS[index]}</span>
                  <span className="bar-day-hours">{minutes ? formatMinutes(minutes) : '—'}</span>
                </div>
              )
            })}
          </div>
          {(!state.data || state.data.length === 0) ? (
            <div className="inline-empty">
              <span className="inline-empty-icon"><Icon name="clock" size={18} /></span>
              <div>
                <strong>Nenhum horário cadastrado</strong>
                <p>Esta semana ainda não tem janelas de estudo registradas.</p>
              </div>
            </div>
          ) : (
            <div className="availability-list">
              <p className="list-label">HORÁRIOS DA SEMANA</p>
              {days.map((day, index) => {
                const records = grouped.get(toIsoDate(day)) ?? []
                if (!records.length) return null
                return (
                  <div className="availability-day-row" key={toIsoDate(day)}>
                    <div className="availability-day-date">
                      <strong>{DAY_LABELS[index]}</strong>
                      <span>{String(day.getDate()).padStart(2, '0')}</span>
                    </div>
                    <div className="availability-day-slots">
                      {records.map((record) => (
                        <span className="time-slot" key={record.id}>
                          {record.horaInicio.slice(0, 5)}–{record.horaFim.slice(0, 5)}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
      <p className="panel-footnote">O planejamento considera apenas os horários que você cadastrou.</p>
    </section>
  )
}

function App() {
  const [monday, setMonday] = useState(getInitialWeek)
  const [todayIso] = useState(() => toIsoDate(new Date()))
  const [demandState, setDemandState] = useState<LoadState<PrioritizedDemand[]>>({ status: 'loading', data: null, error: null })
  const [availabilityState, setAvailabilityState] = useState<LoadState<Availability[]>>({ status: 'loading', data: null, error: null })
  const [demandReloadToken, setDemandReloadToken] = useState(0)
  const [availabilityReloadToken, setAvailabilityReloadToken] = useState(0)
  const [isDemandFormOpen, setIsDemandFormOpen] = useState(false)
  const [isCreatingAvailability, setIsCreatingAvailability] = useState(false)
  const [previewState, setPreviewState] = useState<PreviewState>({ status: 'idle', data: null, error: null })
  const [confirmState, setConfirmState] = useState<ConfirmState>({ status: 'idle', data: null, error: null })
  const previewRequestRef = useRef<number>(0)
  const availabilityCreationInProgressRef = useRef(false)

  useEffect(() => {
    const controller = new AbortController()

    apiGet<PrioritizedDemand[]>('/api/demandas-academicas/priorizadas', controller.signal)
      .then((data) => setDemandState({ status: 'success', data, error: null }))
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') return
        setDemandState((previous) => ({
          ...previous,
          status: 'error',
          error: getErrorMessage(error, 'Verifique se a API está em execução e tente novamente.'),
        }))
      })

    return () => controller.abort()
  }, [demandReloadToken])

  const mondayIso = toIsoDate(monday)
  const sundayIso = toIsoDate(shiftDays(monday, 6))

  useEffect(() => {
    const controller = new AbortController()
    const query = new URLSearchParams({ dataDe: mondayIso, dataAte: sundayIso })

    apiGet<Availability[]>(`/api/disponibilidades-estudo?${query.toString()}`, controller.signal)
      .then((data) => setAvailabilityState({ status: 'success', data, error: null }))
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') return
        setAvailabilityState((previous) => ({
          ...previous,
          status: 'error',
          error: getErrorMessage(error, 'Verifique se a API está em execução e tente novamente.'),
        }))
      })

    return () => controller.abort()
  }, [mondayIso, sundayIso, availabilityReloadToken])

  const activeDemandCount = (demandState.data ?? []).length
  const needsEstimateCount = (demandState.data ?? []).filter((item) => {
    const demand = item.demanda ?? item
    return demand.esforcoEstimadoMinutos == null
  }).length
  const totalAvailabilityMinutes = (availabilityState.data ?? []).reduce((total, item) => {
    return total + Math.max(0, minutesFromTime(item.horaFim) - minutesFromTime(item.horaInicio))
  }, 0)

  function clearPreview(): void {
    previewRequestRef.current += 1
    setPreviewState({ status: 'idle', data: null, error: null })
    setConfirmState({ status: 'idle', data: null, error: null })
  }

  function changeWeek(days: number): void {
    clearPreview()
    setAvailabilityState((previous) => ({ ...previous, status: 'loading', error: null }))
    setMonday((current) => shiftDays(current, days))
  }

  function selectCurrentWeek(): void {
    clearPreview()
    const currentWeek = getInitialWeek()
    if (toIsoDate(currentWeek) === mondayIso) return
    setAvailabilityState((previous) => ({ ...previous, status: 'loading', error: null }))
    setMonday(currentWeek)
  }

  function refreshAll(): void {
    clearPreview()
    setDemandState((previous) => ({ ...previous, status: 'loading', error: null }))
    setAvailabilityState((previous) => ({ ...previous, status: 'loading', error: null }))
    setDemandReloadToken((value) => value + 1)
    setAvailabilityReloadToken((value) => value + 1)
  }

  function refreshDemands(): void {
    clearPreview()
    setDemandState((previous) => ({
      ...previous,
      status: 'loading',
      error: null,
    }))
    setDemandReloadToken((value) => value + 1)
  }

  function refreshAvailability(): void {
    clearPreview()
    setAvailabilityState((previous) => ({
      ...previous,
      status: 'loading',
      error: null,
    }))
    setAvailabilityReloadToken((value) => value + 1)
  }

  async function createDemand(request: CreateDemandRequest): Promise<void> {
    await apiPost<CreatedDemandResponse, CreateDemandRequest>('/api/demandas-academicas', request)
    clearPreview()
    setDemandState((previous) => ({ ...previous, status: 'loading', error: null }))
    setDemandReloadToken((value) => value + 1)
  }

  async function createAvailability(request: CreateAvailabilityRequest): Promise<void> {
    if (availabilityCreationInProgressRef.current) {
      throw new Error('Já existe um cadastro de disponibilidade em andamento.')
    }

    availabilityCreationInProgressRef.current = true
    setIsCreatingAvailability(true)

    try {
      await apiPost<Availability, CreateAvailabilityRequest>(
        '/api/disponibilidades-estudo',
        request,
      )
      clearPreview()
      setAvailabilityState((previous) => ({ ...previous, status: 'loading', error: null }))
      setAvailabilityReloadToken((value) => value + 1)
    } finally {
      availabilityCreationInProgressRef.current = false
      setIsCreatingAvailability(false)
    }
  }

  async function generatePreview(): Promise<void> {
    const requestId = ++previewRequestRef.current
    const requestedMonday = mondayIso
    setPreviewState({ status: 'loading', data: null, error: null })
    setConfirmState({ status: 'idle', data: null, error: null })

    try {
      const data = await apiGet<PlanningData>(`/api/planejamento-semanal/previa?inicioSemana=${requestedMonday}`)
      if (requestId !== previewRequestRef.current) return
      setPreviewState({ status: 'success', data, error: null })
    } catch (error: unknown) {
      if (requestId !== previewRequestRef.current) return
      setPreviewState({
        status: 'error',
        data: null,
        error: getErrorMessage(error, 'Verifique se a API está disponível e tente novamente.'),
      })
    }
  }

  async function confirmPreview(): Promise<void> {
    const proposta = previewState.data
    if (
      !proposta ||
      confirmState.status === 'loading' ||
      (confirmState.status === 'error' && !confirmState.canRetry)
    ) return

    setConfirmState({ status: 'loading', data: null, error: null })
    try {
      const request: PlanningConfirmationRequest = {
        inicioSemana: proposta.inicioSemana,
        agora: proposta.agora,
        propostaId: proposta.propostaId,
        alocacoes: proposta.alocacoes,
      }
      const result = await apiPost<ConfirmationData, PlanningConfirmationRequest>('/api/planejamento-semanal/confirmar', request)
      setConfirmState({ status: 'success', data: result, error: null })
      setPreviewState({ status: 'confirmed', data: proposta, error: null })
      refreshAllDataOnly()
    } catch (error: unknown) {
      const isConflict = isHttpError(error) && error.status === 409
      const outcomeUnknown =
        !isHttpError(error) || error.status >= 500

      if (isConflict) {
        setPreviewState({
          status: 'error',
          data: null,
          error: 'Esta prévia ficou desatualizada ou os horários entraram em conflito. Gere uma nova prévia antes de confirmar.',
        })

        setConfirmState({
          status: 'error',
          data: null,
          error: 'O planejamento não foi salvo. Nenhuma sessão desta proposta foi criada.',
          canRetry: false,
        })

        return
      }

      if (outcomeUnknown) {
        setPreviewState({
          status: 'error',
          data: null,
          error: 'Não foi possível verificar se o planejamento foi salvo. Gere uma nova prévia antes de confirmar novamente.',
        })

        setConfirmState({ status: 'idle', data: null, error: null })

        return
      }

      setConfirmState({
        status: 'error',
        data: null,
        error: getErrorMessage(error, 'Não foi possível confirmar o planejamento.'),
        canRetry: !(isHttpError(error) && error.status === 400),
      })
    }
  }

  function refreshAllDataOnly(): void {
    setDemandState((previous) => ({ ...previous, status: 'loading', error: null }))
    setAvailabilityState((previous) => ({ ...previous, status: 'loading', error: null }))
    setDemandReloadToken((value) => value + 1)
    setAvailabilityReloadToken((value) => value + 1)
  }

  const isConfirming = confirmState.status === 'loading'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#inicio" aria-label="CadernoAtlas, início">
          <span className="brand-mark"><span /><span /><span /></span>
          <span className="brand-wordmark">Caderno<span>Atlas</span></span>
        </a>

        <div className="sidebar-section-label">ESPAÇO DE ESTUDO</div>
        <nav className="side-nav" aria-label="Navegação principal">
          <a className="nav-item nav-item-active" href="#planejamento" aria-current="page" aria-label="Planejamento semanal">
            <Icon name="calendar" size={18} />
            <span>Planejamento semanal</span>
          </a>
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-note-mark"><Icon name="check" size={17} /></div>
          <p>Uma semana possível.</p>
          <span>Seu planejamento deve caber na sua rotina, não o contrário.</span>
          <div className="sidebar-version">CADERNOATLAS <span>·</span> MVP</div>
        </div>
      </aside>

      <main className="main-area" id="planejamento">
        <header className="topbar">
          <span className="breadcrumb">Planejamento <span>/</span> Visão semanal</span>
          <div className="topbar-status"><span className="status-dot" /> Dados da API</div>
        </header>

        <div className="page-content">
          <section className="page-heading">
            <div>
              <p className="eyebrow">SEU ESPAÇO DE ESTUDO</p>
              <h1>Planejamento semanal</h1>
              <p className="page-subtitle">Organize suas demandas em uma semana possível.</p>
            </div>
            <div className="page-heading-actions">
              <button className="button button-secondary refresh-button" onClick={refreshAll} disabled={isConfirming}>
                <Icon name="refresh" size={16} />
                <span>Atualizar dados</span>
              </button>
              <button className="button button-primary generate-preview-button" onClick={generatePreview} disabled={previewState.status === 'loading' || isConfirming}>
                <Icon name={previewState.status === 'loading' ? 'clock' : 'calendar'} size={16} />
                <span>{previewState.status === 'loading' ? 'Gerando prévia…' : 'Gerar prévia'}</span>
              </button>
            </div>
          </section>

          <section className="week-toolbar" aria-label="Semana selecionada">
            <div className="week-toolbar-label">
              <span className="toolbar-icon"><Icon name="calendarDays" size={18} /></span>
              <div>
                <span className="toolbar-caption">SEMANA SELECIONADA</span>
                <strong>{formatWeekRange(monday)}</strong>
              </div>
            </div>
            <div className="week-controls">
              <button className="icon-button" disabled={isConfirming || isCreatingAvailability} onClick={() => changeWeek(-7)} aria-label="Semana anterior" title="Semana anterior">
                <Icon name="chevronLeft" size={18} />
              </button>
              <button className="button button-week" disabled={isConfirming || isCreatingAvailability} onClick={selectCurrentWeek}>Semana atual</button>
              <button className="icon-button" disabled={isConfirming || isCreatingAvailability} onClick={() => changeWeek(7)} aria-label="Próxima semana" title="Próxima semana">
                <Icon name="chevronRight" size={18} />
              </button>
            </div>
          </section>

          <section className="summary-grid" aria-label="Resumo da semana">
            <div className="summary-card">
              <span className="summary-icon summary-icon-green"><Icon name="book" size={18} /></span>
              <div><span className="summary-label">Demandas ativas</span><strong>{demandState.data ? activeDemandCount : '—'}</strong></div>
              <span className="summary-helper">na sua lista</span>
            </div>
            <div className="summary-card">
              <span className="summary-icon summary-icon-sand"><Icon name="clock" size={18} /></span>
              <div><span className="summary-label">Disponibilidade</span><strong>{availabilityState.data ? formatMinutes(totalAvailabilityMinutes) : '—'}</strong></div>
              <span className="summary-helper">nesta semana</span>
            </div>
            <div className="summary-card">
              <span className="summary-icon summary-icon-lilac"><Icon name="alert" size={18} /></span>
              <div><span className="summary-label">A estimar</span><strong>{demandState.data ? needsEstimateCount : '—'}</strong></div>
              <span className="summary-helper">sem esforço definido</span>
            </div>
          </section>

          <div className="content-grid">
            <section className="panel priorities-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">O QUE MERECE ATENÇÃO</p>
                  <h2>Prioridades acadêmicas</h2>
                  <p className="panel-description">Demandas ativas ordenadas pela prioridade da API.</p>
                </div>
                <div className="priorities-panel-actions">
                  <span className="count-badge">{demandState.data ? activeDemandCount : '…'}</span>
                  <button
                    className="button button-primary new-demand-button"
                    type="button"
                    aria-expanded={isDemandFormOpen}
                    aria-controls="create-demand-form"
                    onClick={() => setIsDemandFormOpen(true)}
                  >
                    Nova demanda
                  </button>
                </div>
              </div>

              {isDemandFormOpen && (
                <CreateDemandForm
                  onCreate={createDemand}
                  onCancel={() => setIsDemandFormOpen(false)}
                />
              )}

              {demandState.status === 'loading' && !demandState.data ? (
                <LoadingLines count={4} />
              ) : demandState.status === 'error' && !demandState.data ? (
                <StatusMessage title="Não foi possível carregar as demandas" description={demandState.error} onRetry={refreshDemands} />
              ) : (
                <>
                  {demandState.status === 'error' && demandState.data && (
                    <StatusMessage title="Os dados podem estar desatualizados" description={demandState.error} onRetry={refreshDemands} compact />
                  )}
                  {activeDemandCount === 0 ? (
                    <div className="empty-state">
                      <span className="empty-state-icon"><Icon name="empty" size={23} /></span>
                      <h3>Nenhuma demanda ativa por enquanto</h3>
                      <p>Quando você cadastrar provas, trabalhos ou outras demandas, elas aparecerão aqui.</p>
                    </div>
                  ) : (
                    <div className="demand-list">
                      {demandState.data?.map((item, index) => {
                        const demand = item.demanda ?? item
                        return <DemandCard item={item} key={demand.id ?? `${demand.titulo}-${index}`} />
                      })}
                    </div>
                  )}
                </>
              )}
              <div className="panel-bottom-note"><span className="small-check"><Icon name="check" size={13} /></span> A ordem reflete os prazos, a importância e a situação de cada demanda.</div>
            </section>

            <div className="right-column">
              <AvailabilityPanel state={availabilityState} monday={monday} onRetry={refreshAvailability} todayIso={todayIso} onCreate={createAvailability} isCreating={isCreatingAvailability} />

              <PlanningPreview
                previewState={previewState}
                confirmState={confirmState}
                isConfirming={isConfirming}
                clearPreview={clearPreview}
                confirmPreview={confirmPreview}
                generatePreview={generatePreview}
              />
            </div>
          </div>

          <footer className="page-footer">
            <span>Feito para uma rotina real, não para uma agenda perfeita.</span>
            <span>CadernoAtlas <span className="footer-separator">·</span> Planejamento semanal</span>
          </footer>
        </div>
      </main>
    </div>
  )
}

export default App
