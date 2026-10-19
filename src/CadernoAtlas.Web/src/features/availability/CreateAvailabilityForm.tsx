import { useState, type FormEvent } from 'react'

export interface CreateAvailabilityRequest {
  data: string
  horaInicio: string
  horaFim: string
}

interface CreateAvailabilityFormProps {
  weekStart: string
  weekEnd: string
  todayIso: string
  onCreate: (request: CreateAvailabilityRequest) => Promise<void>
  onCancel: () => void
  disabled: boolean
}

export default function CreateAvailabilityForm({
  weekStart,
  weekEnd,
  todayIso,
  onCreate,
  onCancel,
  disabled,
}: CreateAvailabilityFormProps) {
  const initialDate =
    todayIso >= weekStart && todayIso <= weekEnd
      ? todayIso
      : weekStart

  const [date, setDate] = useState(initialDate)
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault()
    if (isSubmitting) return

    if (!date || !startTime || !endTime) {
      setError('Preencha a data e os dois horários.')
      return
    }

    if (date < weekStart || date > weekEnd) {
      setError('Selecione uma data dentro da semana exibida.')
      return
    }

    if (endTime <= startTime) {
      setError(
        'O horário final deve ser posterior ao horário inicial.',
      )
      return
    }

    setError(null)
    setIsSubmitting(true)

    try {
      await onCreate({
        data: date,
        horaInicio: startTime,
        horaFim: endTime,
      })

      onCancel()
    } catch (submissionError: unknown) {
      setError(
        submissionError instanceof Error && submissionError.message
          ? submissionError.message
          : 'Não foi possível cadastrar a disponibilidade. Tente novamente.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form
      id="create-availability-form"
      className="create-demand-form"
      onSubmit={handleSubmit}
    >
      <div className="create-demand-form-heading">
        <h3 id="create-availability-title">Novo horário de estudo</h3>
        <p>
          Informe quando você estará disponível para estudar nesta
          semana.
        </p>
      </div>

      <div className="create-demand-form-grid">
        <label className="form-field form-field-full">
          Data
          <input
            type="date"
            required
            disabled={disabled}
            min={weekStart}
            max={weekEnd}
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>

        <label className="form-field">
          Horário inicial
          <input
            type="time"
            required
            disabled={disabled}
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
          />
        </label>

        <label className="form-field">
          Horário final
          <input
            type="time"
            required
            disabled={disabled}
            value={endTime}
            onChange={(event) => setEndTime(event.target.value)}
          />
        </label>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="create-demand-form-actions">
        <button
          className="button button-secondary"
          type="button"
          onClick={onCancel}
          disabled={disabled || isSubmitting}
        >
          Cancelar
        </button>

        <button
          className="button button-primary"
          type="submit"
          disabled={disabled || isSubmitting}
        >
          {isSubmitting ? 'Salvando...' : 'Salvar horário'}
        </button>
      </div>
    </form>
  )
}
