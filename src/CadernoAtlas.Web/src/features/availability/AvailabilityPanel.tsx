import { useMemo, useState } from 'react'
import Icon from '../../components/ui/Icon'
import StatusMessage from '../../components/ui/StatusMessage'
import CreateAvailabilityForm from './CreateAvailabilityForm'
import type { Availability, AvailabilityPanelProps } from './availabilityTypes'
import { formatMinutes, shiftDays, minutesFromTime } from '../../utils/planningFormatters'

const DAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

function getWeekDays(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, index) => shiftDays(monday, index))
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function AvailabilityPanel({
  state,
  monday,
  onRetry,
  todayIso,
  onCreate,
  onReconcile,
  isCreating,
  isConfirming,
  isUpdatingDemand,
  isCreatingTask,
  isUpdatingTask,
  isDeletingTask,
  outcomeUnknown,
  onOutcomeUnknownChange,
}: AvailabilityPanelProps) {
  const taskMutationInProgress = isCreatingTask || isUpdatingTask || isDeletingTask
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
        aria-controls={isFormOpen ? 'create-availability-form' : undefined}
        disabled={isCreating || isConfirming || isUpdatingDemand || taskMutationInProgress || outcomeUnknown}
        onClick={() => {
          if (isCreating || isConfirming || isUpdatingDemand || taskMutationInProgress || outcomeUnknown) return
          setIsFormOpen((open) => !open)
        }}
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
          onReconcile={onReconcile}
          disabled={isConfirming || isUpdatingDemand || taskMutationInProgress}
          outcomeUnknown={outcomeUnknown}
          onOutcomeUnknownChange={onOutcomeUnknownChange}
        />
      )}

      {state.status === 'loading' ? (
        <div className="loading-lines" aria-label="Carregando dados" role="status">
          {Array.from({ length: 3 }, (_, index) => (
            <div className="loading-row" key={index}>
              <span className="skeleton skeleton-icon" />
              <span className="loading-row-copy">
                <span className="skeleton skeleton-title" />
                <span className="skeleton skeleton-detail" />
              </span>
            </div>
          ))}
        </div>
      ) : state.status === 'error' && !state.data ? (
        <StatusMessage title="Não foi possível carregar os horários" description={state.error} onRetry={isUpdatingDemand || taskMutationInProgress ? undefined : onRetry} compact />
      ) : (
        <>
          {state.status === 'error' && state.data && (
            <StatusMessage title="Os horários podem estar desatualizados" description={state.error} onRetry={isUpdatingDemand || taskMutationInProgress ? undefined : onRetry} compact />
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