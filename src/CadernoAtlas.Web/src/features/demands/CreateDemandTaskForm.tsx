import { useRef, useState, type FormEvent } from 'react'
import FieldError from '../../components/ui/FieldError'
import ProcessingState from '../../components/ui/ProcessingState'

export interface CreateDemandTaskRequest {
  titulo: string
  descricao: string | null
  esforcoEstimadoMinutos: number | null
}

interface CreateDemandTaskFormProps {
  demandId: number
  disabled?: boolean
  onCreate: (demandId: number, request: CreateDemandTaskRequest) => Promise<unknown>
  onCreated: () => void
  onReconcile: () => Promise<boolean>
}

interface FieldErrors {
  title?: string
  description?: string
  effort?: string
}

function getHttpStatus(error: unknown): number | null {
  if (typeof error !== 'object' || error === null || !('status' in error)) return null
  return typeof error.status === 'number' ? error.status : null
}

function getApiMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

export default function CreateDemandTaskForm({
  demandId,
  disabled = false,
  onCreate,
  onCreated,
  onReconcile,
}: CreateDemandTaskFormProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [effort, setEffort] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isReconciling, setIsReconciling] = useState(false)
  const [outcomeUnknown, setOutcomeUnknown] = useState(false)
  const [reconciliationComplete, setReconciliationComplete] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const submissionInProgressRef = useRef(false)
  const controlsDisabled = disabled || isSubmitting || isReconciling

  function clearFieldError(field: keyof FieldErrors): void {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (submissionInProgressRef.current || controlsDisabled || (outcomeUnknown && !reconciliationComplete)) return

    const trimmedTitle = title.trim()
    const effortMinutes = effort.trim() === '' ? null : Number(effort)
    const newFieldErrors: FieldErrors = {}

    if (trimmedTitle.length < 2 || trimmedTitle.length > 150) {
      newFieldErrors.title = 'O título deve ter entre 2 e 150 caracteres após remover espaços excedentes.'
    }
    if (description.length > 1000) {
      newFieldErrors.description = 'A descrição deve ter no máximo 1000 caracteres.'
    }
    if (effortMinutes !== null && (!Number.isInteger(effortMinutes) || effortMinutes <= 0)) {
      newFieldErrors.effort = 'O esforço estimado deve ser um número inteiro maior que zero.'
    }

    if (Object.keys(newFieldErrors).length > 0) {
      setFieldErrors(newFieldErrors)
      return
    }

    setFieldErrors({})
    submissionInProgressRef.current = true
    setIsSubmitting(true)
    setFormError(null)
    setSuccessMessage(null)
    setOutcomeUnknown(false)
    setReconciliationComplete(false)

    try {
      await onCreate(demandId, {
        titulo: trimmedTitle,
        descricao: description.trim() || null,
        esforcoEstimadoMinutos: effortMinutes,
      })
      setTitle('')
      setDescription('')
      setEffort('')
      setSuccessMessage('Tarefa criada.')
      onCreated()
    } catch (error: unknown) {
      const status = getHttpStatus(error)
      if (status === null || status === 408 || status === 429 || status >= 500) {
        setOutcomeUnknown(true)
        setFormError('Não foi possível confirmar se a tarefa foi criada. Consulte a lista antes de decidir se tentará novamente.')
      } else if (status === 404) {
        setFormError('A demanda não foi encontrada ou não está mais disponível.')
      } else if (status === 409) {
        setFormError(getApiMessage(error, 'A situação atual da demanda não permite adicionar tarefas.'))
      } else if (status === 400) {
        setFormError(getApiMessage(error, 'Revise os dados informados e tente novamente.'))
      } else {
        setFormError(getApiMessage(error, 'Não foi possível criar a tarefa.'))
      }
    } finally {
      submissionInProgressRef.current = false
      setIsSubmitting(false)
    }
  }

  async function reconcileOutcome(): Promise<void> {
    setIsReconciling(true)
    setFormError(null)
    try {
      const refreshed = await onReconcile()
      if (refreshed) {
        setReconciliationComplete(true)
        setFormError(null)
      } else {
        setFormError('A lista não pôde ser atualizada. Tente consultar novamente antes de reenviar.')
      }
    } finally {
      setIsReconciling(false)
    }
  }

  return (
    <form
      id={`create-task-form-${demandId}`}
      className="create-task-form"
      onSubmit={handleSubmit}
      noValidate
    >
      <div className="form-field">
        <label htmlFor={`title-${demandId}`}>Título da tarefa</label>
        <input
          id={`title-${demandId}`}
          required
          minLength={2}
          maxLength={150}
          disabled={controlsDisabled}
          value={title}
          onChange={(event) => {
            setTitle(event.target.value)
            clearFieldError('title')
          }}
          className={`form-control ${fieldErrors.title ? 'is-invalid' : ''}`}
          aria-invalid={fieldErrors.title ? 'true' : 'false'}
          aria-describedby={fieldErrors.title ? `title-error-${demandId}` : undefined}
        />
        {fieldErrors.title && (
          <FieldError id={`title-error-${demandId}`} message={fieldErrors.title} />
        )}
      </div>
      <div className="form-field">
        <label htmlFor={`description-${demandId}`}>Descrição (opcional)</label>
        <textarea
          id={`description-${demandId}`}
          maxLength={1000}
          rows={2}
          disabled={controlsDisabled}
          value={description}
          onChange={(event) => {
            setDescription(event.target.value)
            clearFieldError('description')
          }}
          className={`form-control ${fieldErrors.description ? 'is-invalid' : ''}`}
          aria-invalid={fieldErrors.description ? 'true' : 'false'}
          aria-describedby={fieldErrors.description ? `description-error-${demandId}` : undefined}
        />
        {fieldErrors.description && (
          <FieldError id={`description-error-${demandId}`} message={fieldErrors.description} />
        )}
      </div>
      <div className="form-field">
        <label htmlFor={`effort-${demandId}`}>Esforço estimado em minutos (opcional)</label>
        <input
          id={`effort-${demandId}`}
          type="number"
          min={1}
          step={1}
          disabled={controlsDisabled}
          value={effort}
          onChange={(event) => {
            setEffort(event.target.value)
            clearFieldError('effort')
          }}
          className={`form-control ${fieldErrors.effort ? 'is-invalid' : ''}`}
          aria-invalid={fieldErrors.effort ? 'true' : 'false'}
          aria-describedby={fieldErrors.effort ? `effort-error-${demandId}` : undefined}
        />
        {fieldErrors.effort && (
          <FieldError id={`effort-error-${demandId}`} message={fieldErrors.effort} />
        )}
      </div>
      {isSubmitting && <p role="status">Salvando tarefa…</p>}
      <ProcessingState message="Salvando..." isActive={isSubmitting} ariaLabel="Salvando tarefa" />
      {successMessage && <p className="task-create-success" role="status">{successMessage}</p>}
      {formError && <p className="form-error" role="alert">{formError}</p>}
      {outcomeUnknown && (
        <div className="task-uncertain-guidance">
          <p>A consulta reduz a incerteza, mas não garante que uma requisição anterior ainda em processamento não seja concluída depois.</p>
          {!reconciliationComplete ? (
            <button className="text-button" type="button" disabled={controlsDisabled} onClick={reconcileOutcome}>
              {isReconciling ? 'Consultando tarefas…' : 'Consultar tarefas antes de tentar novamente'}
            </button>
          ) : (
            <p role="status">Consulta concluída. Revise a lista antes de decidir se tentará criar novamente.</p>
          )}
        </div>
      )}
      <div className="create-demand-form-actions">
        <button className="button button-primary" type="submit" disabled={controlsDisabled || (outcomeUnknown && !reconciliationComplete)}>
          {isSubmitting ? 'Salvando…' : 'Salvar tarefa'}
        </button>
      </div>
    </form>
  )
}
