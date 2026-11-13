import { useRef, useState, type FormEvent } from 'react'
import { isMutationSyncError } from '../shared/mutationOutcome'
import FieldError from '../../components/ui/FieldError'
import ProcessingState from '../../components/ui/ProcessingState'

export type DemandType = 0 | 1 | 2 | 3 | 4
export type DemandImportance = 0 | 1 | 2

export interface CreateDemandRequest {
  titulo: string
  descricao: string | null
  tipo: DemandType
  prazo: string | null
  importancia: DemandImportance
  esforcoEstimadoMinutos: number | null
}

interface CreateDemandFormProps {
  onCreate: (request: CreateDemandRequest) => Promise<void>
  onCancel: () => void
  onReconcile: () => Promise<void>
  onOutcomeUnknownChange: (value: boolean) => void
  disabled?: boolean
  outcomeUnknown?: boolean
}

interface FieldErrors {
  title?: string
  type?: string
  importance?: string
  effort?: string
}

export default function CreateDemandForm({
  onCreate,
  onCancel,
  onReconcile,
  onOutcomeUnknownChange,
  disabled = false,
  outcomeUnknown: initialOutcomeUnknown = false,
}: CreateDemandFormProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [importance, setImportance] = useState('')
  const [effort, setEffort] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isReconciling, setIsReconciling] = useState(false)
  const [outcomeUnknown, setOutcomeUnknown] = useState(initialOutcomeUnknown)
  const [synchronizationFailed, setSynchronizationFailed] = useState(false)
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

  function getHttpStatus(error: unknown): number | null {
    if (typeof error !== 'object' || error === null || !('status' in error)) return null
    return typeof error.status === 'number' ? error.status : null
  }

  function getApiMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (submissionInProgressRef.current || (outcomeUnknown && !isReconciling)) return

    const trimmedTitle = title.trim()
    const effortMinutes = effort.trim() === '' ? null : Number(effort)
    const newFieldErrors: FieldErrors = {}

    if (trimmedTitle.length < 2) {
      newFieldErrors.title = 'O título deve ter pelo menos 2 caracteres.'
    }
    if (type === '' || importance === '') {
      if (type === '') newFieldErrors.type = 'Selecione o tipo.'
      if (importance === '') newFieldErrors.importance = 'Selecione a importância.'
    }
    if (
      effortMinutes !== null &&
      (!Number.isInteger(effortMinutes) || effortMinutes <= 0)
    ) {
      newFieldErrors.effort = 'O esforço estimado deve ser um número inteiro maior que zero.'
    }

    if (Object.keys(newFieldErrors).length > 0) {
      setFieldErrors(newFieldErrors)
      return
    }

    setFieldErrors({})
    const request: CreateDemandRequest = {
      titulo: trimmedTitle,
      descricao: description.trim() || null,
      tipo: Number(type) as DemandType,
      prazo: dueDate || null,
      importancia: Number(importance) as DemandImportance,
      esforcoEstimadoMinutos: effortMinutes,
    }

    submissionInProgressRef.current = true
    setError(null)
    setIsSubmitting(true)
    setSynchronizationFailed(false)
    onOutcomeUnknownChange(false)
    setOutcomeUnknown(false)

    try {
      await onCreate(request)
      setTitle('')
      setDescription('')
      setType('')
      setDueDate('')
      setImportance('')
      setEffort('')
      onCancel()
    } catch (submissionError: unknown) {
      const status = getHttpStatus(submissionError)
      // Se for erro de concorrência local (Error sem status), mostrar a mensagem original
      const isLocalConcurrencyError = status === null && submissionError instanceof Error &&
        (submissionError.message.includes('em andamento') || submissionError.message.includes('Aguarde'))
      if (isMutationSyncError(submissionError)) {
        setSynchronizationFailed(true)
        setError(submissionError.message)
      } else if (isLocalConcurrencyError) {
        setError(getApiMessage(submissionError, 'Não foi possível cadastrar a demanda. Tente novamente.'))
      } else if (status === null || status === 408 || status === 429 || status >= 500) {
        onOutcomeUnknownChange(true)
        setOutcomeUnknown(true)
        setError('Não foi possível confirmar se a demanda foi cadastrada. Consulte a lista antes de decidir se tentará novamente.')
      } else {
        setError(getApiMessage(submissionError, 'Não foi possível cadastrar a demanda. Tente novamente.'))
      }
    } finally {
      submissionInProgressRef.current = false
      setIsSubmitting(false)
    }
  }

  async function reconcileOutcome(): Promise<void> {
    if (isReconciling) return
    setIsReconciling(true)

    try {
      await onReconcile()
      // Reconciliação bem-sucedida: liberar estado incerto global e fechar formulário
      onOutcomeUnknownChange(false)
      setOutcomeUnknown(false)
      setSynchronizationFailed(false)
      onCancel()
    } catch (reconcileError) {
      // Falha na reconciliação: manter estado incerto, formulário aberto, mostrar erro
      setError(getApiMessage(reconcileError, 'Não foi possível consultar as demandas. Tente novamente.'))
    } finally {
      setIsReconciling(false)
    }
  }

  return (
    <form id="create-demand-form" className="create-demand-form" onSubmit={handleSubmit} noValidate>
      <div className="create-demand-form-heading">
        <h3 id="create-demand-title">Nova demanda acadêmica</h3>
        <p>Registre uma prova, um trabalho ou outra atividade importante.</p>
      </div>

      <div className="create-demand-form-grid">
        <div className="form-field form-field-full">
          <label htmlFor="create-demand-title-input">Título</label>
          <input
            id="create-demand-title-input"
            autoFocus
            required
            minLength={2}
            disabled={controlsDisabled}
            value={title}
            onChange={(event) => {
              setTitle(event.target.value)
              clearFieldError('title')
            }}
            placeholder="Ex.: Prova de Anatomia"
            className={`form-control ${fieldErrors.title ? 'is-invalid' : ''}`}
            aria-invalid={fieldErrors.title ? 'true' : 'false'}
            aria-describedby={fieldErrors.title ? 'create-demand-title-error' : undefined}
          />
          {fieldErrors.title && (
            <FieldError id="create-demand-title-error" message={fieldErrors.title} />
          )}
        </div>

        <div className="form-field">
          <label htmlFor="create-demand-type-input">Tipo</label>
          <select
            id="create-demand-type-input"
            required
            disabled={controlsDisabled}
            value={type}
            onChange={(event) => {
              setType(event.target.value)
              clearFieldError('type')
            }}
            className={`form-control ${fieldErrors.type ? 'is-invalid' : ''}`}
            aria-invalid={fieldErrors.type ? 'true' : 'false'}
            aria-describedby={fieldErrors.type ? 'create-demand-type-error' : undefined}
          >
            <option value="">Selecione o tipo</option>
            <option value="0">Prova</option>
            <option value="1">Trabalho</option>
            <option value="2">APG</option>
            <option value="3">TCC</option>
            <option value="4">Outro</option>
          </select>
          {fieldErrors.type && (
            <FieldError id="create-demand-type-error" message={fieldErrors.type} />
          )}
        </div>

        <div className="form-field">
          <label htmlFor="create-demand-importance-input">Importância</label>
          <select
            id="create-demand-importance-input"
            required
            disabled={controlsDisabled}
            value={importance}
            onChange={(event) => {
              setImportance(event.target.value)
              clearFieldError('importance')
            }}
            className={`form-control ${fieldErrors.importance ? 'is-invalid' : ''}`}
            aria-invalid={fieldErrors.importance ? 'true' : 'false'}
            aria-describedby={fieldErrors.importance ? 'create-demand-importance-error' : undefined}
          >
            <option value="">Selecione a importância</option>
            <option value="0">Baixa</option>
            <option value="1">Média</option>
            <option value="2">Alta</option>
          </select>
          {fieldErrors.importance && (
            <FieldError id="create-demand-importance-error" message={fieldErrors.importance} />
          )}
        </div>

        <div className="form-field">
          <label htmlFor="create-demand-dueDate-input">Prazo (opcional)</label>
          <input
            id="create-demand-dueDate-input"
            type="date"
            disabled={controlsDisabled}
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            className="form-control"
          />
        </div>

        <div className="form-field">
          <label htmlFor="create-demand-effort-input">Esforço estimado em minutos (opcional)</label>
          <input
            id="create-demand-effort-input"
            type="number"
            disabled={controlsDisabled}
            min={1}
            step={1}
            value={effort}
            onChange={(event) => {
              setEffort(event.target.value)
              clearFieldError('effort')
            }}
            placeholder="Ex.: 90"
            className={`form-control ${fieldErrors.effort ? 'is-invalid' : ''}`}
            aria-invalid={fieldErrors.effort ? 'true' : 'false'}
            aria-describedby={fieldErrors.effort ? 'create-demand-effort-error' : undefined}
          />
          {fieldErrors.effort && (
            <FieldError id="create-demand-effort-error" message={fieldErrors.effort} />
          )}
        </div>

        <div className="form-field form-field-full">
          <label htmlFor="create-demand-description-input">Descrição (opcional)</label>
          <textarea
            id="create-demand-description-input"
            rows={3}
            disabled={controlsDisabled}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Detalhes que ajudem a identificar a demanda."
            className="form-control"
          />
        </div>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <ProcessingState message="Salvando..." isActive={isSubmitting} ariaLabel="Salvando demanda" />
      {(outcomeUnknown || synchronizationFailed) && (
        <div className="task-uncertain-guidance">
          <p>{synchronizationFailed ? 'A demanda foi criada, mas a lista não pôde ser atualizada. Consulte a lista novamente; não é necessário cadastrá-la outra vez.' : 'A consulta reduz a incerteza, mas não garante que uma requisição anterior ainda em processamento não seja concluída depois.'}</p>
          <button className="text-button" type="button" disabled={controlsDisabled} onClick={reconcileOutcome}>
            {isReconciling ? 'Consultando demandas…' : synchronizationFailed ? 'Atualizar lista de demandas' : 'Consultar demandas antes de tentar novamente'}
          </button>
        </div>
      )}
      <div className="create-demand-form-actions">
        <button
          className="button button-secondary"
          type="button"
          onClick={onCancel}
          disabled={controlsDisabled || outcomeUnknown || synchronizationFailed}
        >
          Cancelar
        </button>

        <button
          className="button button-primary"
          type="submit"
          disabled={controlsDisabled || outcomeUnknown || synchronizationFailed}
        >
          {isSubmitting ? 'Salvando...' : 'Salvar demanda'}
        </button>
      </div>
    </form>
  )
}
