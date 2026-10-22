import Icon from '../../components/ui/Icon'
import { formatMinutes } from '../../utils/planningFormatters'

export interface AcademicDemand {
  id?: number
  titulo?: string
  descricao?: string | null
  tipo?: number
  importancia?: number
  esforcoEstimadoMinutos?: number | null
}

export interface PrioritizedDemand extends AcademicDemand {
  demanda?: AcademicDemand | null
  faixaUrgencia?: string | null
  diasAtePrazo?: number | null
  justificativa?: string | null
}

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

interface DemandCardProps {
  item: PrioritizedDemand
}

export default function DemandCard({ item }: DemandCardProps) {
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