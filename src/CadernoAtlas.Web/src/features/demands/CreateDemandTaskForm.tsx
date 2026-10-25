import { useRef, useState } from 'react'

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
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isReconciling, setIsReconciling] = useState(false)
  const [outcomeUnknown, setOutcomeUnknown] = useState(false)
  const [reconciliationComplete, setReconciliationComplete] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const submissionInProgressRef = useRef(false)
  const controlsDisabled = disabled || isSubmitting || isReconciling

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (submissionInProgressRef.current || controlsDisabled || (outcomeUnknown && !reconciliationComplete)) return

    const trimmedTitle = title.trim()
    const effortMinutes = effort.trim() === '' ? null : Number(effort)

    if (trimmedTitle.length < 2 || trimmedTitle.length > 150) {
      setFormError('O título deve ter entre 2 e 150 caracteres após remover espaços excedentes.')
      return
    }
    if (description.length > 1000) {
      setFormError('A descrição deve ter no máximo 1000 caracteres.')
      return
    }
    if (effortMinutes !== null && (!Number.isInteger(effortMinutes) || effortMinutes <= 0)) {
      setFormError('O esforço estimado deve ser um número inteiro maior que zero.')
      return
    }

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
    <form id={`create-task-form-${demandId}`} className="create-task-form" onSubmit={handleSubmit}>
      <label className="form-field">Título da tarefa
        <input required minLength={2} maxLength={150} disabled={controlsDisabled} value={title} onChange={(event) => setTitle(event.target.value)} />
      </label>
      <label className="form-field">Descrição (opcional)
        <textarea maxLength={1000} rows={2} disabled={controlsDisabled} value={description} onChange={(event) => setDescription(event.target.value)} />
      </label>
      <label className="form-field">Esforço estimado em minutos (opcional)
        <input type="number" min={1} step={1} disabled={controlsDisabled} value={effort} onChange={(event) => setEffort(event.target.value)} />
      </label>
      {isSubmitting && <p role="status">Salvando tarefa…</p>}
      {successMessage && <p className="task-create-success" role="status">{successMessage}</p>}
      {formError && <p className="form-error" role="alert">{formError}</p>}
      {outcomeUnknown && (
        <div className="task-uncertain-guidance">
          <p>A consulta reduz a incerteza, mas não garante que uma requisição anterior ainda em processamento não seja concluída depois.</p>
          {!reconciliationComplete ? (
            <button className="text-button" type="button" disabled={controlsDisabled} onClick={() => void reconcileOutcome()}>
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
