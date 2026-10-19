const NON_ALLOCATION_LABELS: Record<number | string, string> = {
  0: 'Estimativa ausente',
  1: 'Estimativa inválida',
  2: 'Sem disponibilidade na semana',
  3: 'Duração maior que qualquer disponibilidade',
  4: 'Horário ocupado por sessão existente',
  5: 'Capacidade consumida por atividades prioritárias',
  EstimativaAusente: 'Estimativa ausente',
  EstimativaInvalida: 'Estimativa inválida',
  SemDisponibilidadeNaSemana: 'Sem disponibilidade na semana',
  DuracaoMaiorQueQualquerDisponibilidade: 'Duração maior que qualquer disponibilidade',
  HorarioOcupadoPorSessaoExistente: 'Horário ocupado por sessão existente',
  CapacidadeConsumidaPorAtividadesPrioritarias: 'Capacidade consumida por atividades prioritárias',
}

export function parseIsoDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function shiftDays(date: Date, days: number): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  result.setDate(result.getDate() + days)
  return result
}

function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
  }).format(date).replace('.', '')
}

export function formatWeekRange(monday: Date): string {
  const sunday = shiftDays(monday, 6)
  const sameMonth = monday.getMonth() === sunday.getMonth()
  const sameYear = monday.getFullYear() === sunday.getFullYear()

  if (sameMonth && sameYear) {
    return `${monday.getDate()}–${sunday.getDate()} de ${new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(sunday)}`
  }

  return `${formatShortDate(monday)} – ${formatShortDate(sunday)} ${sunday.getFullYear()}`
}

export function formatClockEnd(startTime: string, durationMinutes: number): string {
  const total = minutesFromTime(startTime) + durationMinutes
  const normalized = total % (24 * 60)
  const hours = Math.floor(normalized / 60)
  const minutes = normalized % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

export function reasonLabel(value: number | string | null | undefined): string {
  if (value == null) return 'Não foi possível alocar esta atividade'
  return NON_ALLOCATION_LABELS[value] ?? 'Não foi possível alocar esta atividade'
}

export function formatMinutes(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes))
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  if (hours === 0) return `${remainder}min`
  if (remainder === 0) return `${hours}h`
  return `${hours}h${String(remainder).padStart(2, '0')}`
}

export function minutesFromTime(value: unknown): number {
  if (typeof value !== 'string') return 0
  const [hours, minutes] = value.split(':').map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0
  return hours * 60 + minutes
}
