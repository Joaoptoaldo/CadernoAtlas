import { useRef, useState, type FormEvent } from 'react'

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
  onReconcile: () => Promise<void>
  disabled: boolean
  outcomeUnknown: boolean
  onOutcomeUnknownChange: (value: boolean) => void
}

export default function CreateAvailabilityForm({
  weekStart,
  weekEnd,
  todayIso,
  onCreate,
  onCancel,
  onReconcile,
  disabled,
  outcomeUnknown,
  onOutcomeUnknownChange,
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
  const [isReconciling, setIsReconciling] = useState(false)
  const submissionInProgressRef = useRef(false)
  const controlsDisabled = disabled || isSubmitting || isReconciling

  function getHttpStatus(error: unknown): number | null {
    if (typeof error !== 'object' || error === null || !('status' in error)) return null
    return typeof error.status === 'number' ? error.status : null
  }

  function getApiMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault()
    if (submissionInProgressRef.current || (outcomeUnknown && !isReconciling)) return

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

    submissionInProgressRef.current = true
    setError(null)
    setIsSubmitting(true)
    onOutcomeUnknownChange(false)

    try {
      await onCreate({
        data: date,
        horaInicio: startTime,
        horaFim: endTime,
      })

      onCancel()
    } catch (submissionError: unknown) {
      const status = getHttpStatus(submissionError)
      // Se for erro de concorrência local (Error sem status), mostrar a mensagem original
      const isLocalConcurrencyError = status === null && submissionError instanceof Error &&
        (submissionError.message.includes('em andamento') || submissionError.message.includes('Aguarde'))
      if (isLocalConcurrencyError) {
        setError(getApiMessage(submissionError, 'Não foi possível cadastrar a disponibilidade. Tente novamente.'))
      } else if (status === null || status === 408 || status === 429 || status >= 500) {
        onOutcomeUnknownChange(true)
        setError('Não foi possível confirmar se a disponibilidade foi cadastrada. Consulte a lista antes de decidir se tentará novamente.')
      } else if (status === 404) {
        setError('A semana consultada não está mais disponível.')
      } else if (status === 409) {
        setError(getApiMessage(submissionError, 'Já existe uma disponibilidade sobreposta.'))
      } else if (status === 400) {
        setError(getApiMessage(submissionError, 'Revise os dados informados e tente novamente.'))
      } else {
        setError(getApiMessage(submissionError, 'Não foi possível cadastrar a disponibilidade. Tente novamente.'))
      }
    } finally {
      submissionInProgressRef.current = false
      setIsSubmitting(false)
    }
  }

  async function reconcileOutcome(): Promise<void> {
    if (isReconciling) return
    setIsReconciling(true)
    setError(null)
    try {
      await onReconcile()
      // Reconciliação bem-sucedida: liberar estado incerto global e fechar formulário
      onOutcomeUnknownChange(false)
      onCancel()
    } catch (reconcileError) {
      // Falha na reconciliação: manter estado incerto, formulário aberto, mostrar erro
      setError(getApiMessage(reconcileError, 'Não foi possível consultar os horários. Tente novamente.'))
    } finally {
      setIsReconciling(false)
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
      {outcomeUnknown && (
        <div className="task-uncertain-guidance">
          <p>A consulta reduz a incerteza, mas não garante que uma requisição anterior ainda em processamento não seja concluída depois.</p>
          <button className="text-button" type="button" disabled={controlsDisabled} onClick={() => void reconcileOutcome()}>
            {isReconciling ? 'Consultando horários…' : 'Consultar horários antes de tentar novamente'}
          </button>
        </div>
      )}
      <div className="create-demand-form-actions">
        <button
          className="button button-secondary"
          type="button"
          onClick={onCancel}
          disabled={controlsDisabled || outcomeUnknown}
        >
          Cancelar
        </button>

        <button
          className="button button-primary"
          type="submit"
          disabled={controlsDisabled || (outcomeUnknown && !isReconciling)}
        >
          {isSubmitting ? 'Salvando...' : 'Salvar horário'}
        </button>
      </div>
    </form>
  )
}
