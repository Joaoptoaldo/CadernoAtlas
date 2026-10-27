import { useRef, useState, type FormEvent } from 'react'

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
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isReconciling, setIsReconciling] = useState(false)
  const [outcomeUnknown, setOutcomeUnknown] = useState(initialOutcomeUnknown)
  const submissionInProgressRef = useRef(false)
  const controlsDisabled = disabled || isSubmitting || isReconciling

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

    if (trimmedTitle.length < 2) {
      setError('O título deve ter pelo menos 2 caracteres.')
      return
    }

    if (type === '' || importance === '') {
      setError('Selecione o tipo e a importância da demanda.')
      return
    }

    if (
      effortMinutes !== null &&
      (!Number.isInteger(effortMinutes) || effortMinutes <= 0)
    ) {
      setError('O esforço estimado deve ser um número inteiro maior que zero.')
      return
    }

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
      if (isLocalConcurrencyError) {
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
    setError(null)
    try {
      await onReconcile()
      // Reconciliação bem-sucedida: liberar estado incerto global e fechar formulário
      onOutcomeUnknownChange(false)
      setOutcomeUnknown(false)
      onCancel()
    } catch (reconcileError) {
      // Falha na reconciliação: manter estado incerto, formulário aberto, mostrar erro
      setError(getApiMessage(reconcileError, 'Não foi possível consultar as demandas. Tente novamente.'))
    } finally {
      setIsReconciling(false)
    }
  }

  return (
    <form id="create-demand-form" className="create-demand-form" onSubmit={handleSubmit}>
      <div className="create-demand-form-heading">
        <h3 id="create-demand-title">Nova demanda acadêmica</h3>
        <p>Registre uma prova, um trabalho ou outra atividade importante.</p>
      </div>

      <div className="create-demand-form-grid">
        <label className="form-field form-field-full">
          Título
          <input
            autoFocus
            required
            minLength={2}
            disabled={controlsDisabled}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Ex.: Prova de Anatomia"
          />
        </label>

        <label className="form-field">
          Tipo
          <select
            required
            disabled={controlsDisabled}
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            <option value="">Selecione o tipo</option>
            <option value="0">Prova</option>
            <option value="1">Trabalho</option>
            <option value="2">APG</option>
            <option value="3">TCC</option>
            <option value="4">Outro</option>
          </select>
        </label>

        <label className="form-field">
          Importância
          <select
            required
            disabled={controlsDisabled}
            value={importance}
            onChange={(event) => setImportance(event.target.value)}
          >
            <option value="">Selecione a importância</option>
            <option value="0">Baixa</option>
            <option value="1">Média</option>
            <option value="2">Alta</option>
          </select>
        </label>

        <label className="form-field">
          Prazo (opcional)
          <input
            type="date"
            disabled={controlsDisabled}
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
          />
        </label>

        <label className="form-field">
          Esforço estimado em minutos (opcional)
          <input
            type="number"
            disabled={controlsDisabled}
            min={1}
            step={1}
            value={effort}
            onChange={(event) => setEffort(event.target.value)}
            placeholder="Ex.: 90"
          />
        </label>

        <label className="form-field form-field-full">
          Descrição (opcional)
          <textarea
            rows={3}
            disabled={controlsDisabled}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Detalhes que ajudem a identificar a demanda."
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
            {isReconciling ? 'Consultando demandas…' : 'Consultar demandas antes de tentar novamente'}
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
          {isSubmitting ? 'Salvando...' : 'Salvar demanda'}
        </button>
      </div>
    </form>
  )
}
