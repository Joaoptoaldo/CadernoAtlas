import { useEffect, useRef, useState, type FormEvent } from 'react'
import { apiGet, isHttpError } from '../../apiClient'
import { isMutationSyncError } from '../shared/mutationOutcome'
import type { StudySessionDemand, StudySessionListItem, StudySessionRequest, StudySessionTask } from './studySessionTypes'

interface StudySessionFormProps {
  mode: 'create' | 'edit'
  initialValue?: StudySessionRequest
  demands: StudySessionDemand[]
  onLoadTasks: (demandId: number, signal: AbortSignal) => Promise<StudySessionTask[]>
  onSubmit: (request: StudySessionRequest) => Promise<void>
  onCancel: () => void
  onReconcile: () => Promise<StudySessionListItem[] | void>
  outcomeUnknown: boolean
  onOutcomeUnknownChange: (value: boolean) => void
}

const emptyRequest: StudySessionRequest = {
  titulo: '',
  dataPlanejada: '',
  horaInicioPlanejada: '',
  duracaoPlanejadaMinutos: 60,
  demandaAcademicaId: null,
  tarefaDemandaId: null,
  observacoes: null,
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

export default function StudySessionForm({
  mode,
  initialValue,
  demands,
  onLoadTasks,
  onSubmit,
  onCancel,
  onReconcile,
  outcomeUnknown: initialOutcomeUnknown,
  onOutcomeUnknownChange,
}: StudySessionFormProps) {
  const [form, setForm] = useState<StudySessionRequest>(() => {
    if (!initialValue) return emptyRequest
    return initialValue.tarefaDemandaId === null
      ? initialValue
      : { ...initialValue, demandaAcademicaId: null }
  })
  const [tasks, setTasks] = useState<StudySessionTask[]>([])
  const [tasksStatus, setTasksStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [outcomeUnknown, setOutcomeUnknown] = useState(initialOutcomeUnknown)
  const [synchronizationFailed, setSynchronizationFailed] = useState(false)
  const [reconciling, setReconciling] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const submitRef = useRef(false)
  const lastSubmittedRequestRef = useRef<StudySessionRequest | null>(null)
  const existingSessionIdsRef = useRef<Set<number>>(new Set())
  const tasksRequestRef = useRef(0)
  const controlsDisabled = submitting || reconciling
  const preservedTaskOnly = form.tarefaDemandaId !== null && form.demandaAcademicaId === null

  useEffect(() => {
    if (form.demandaAcademicaId === null) {
      return
    }

    const requestId = ++tasksRequestRef.current
    const controller = new AbortController()
    onLoadTasks(form.demandaAcademicaId, controller.signal)
      .then((data) => {
        if (requestId !== tasksRequestRef.current) return
        setTasks(data)
        setTasksStatus('success')
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof Error && loadError.name === 'AbortError') return
        if (requestId !== tasksRequestRef.current) return
        setTasksStatus('error')
        setError(getErrorMessage(loadError, 'Não foi possível carregar as tarefas da demanda.'))
      })
    return () => controller.abort()
  }, [form.demandaAcademicaId, onLoadTasks])

  function updateForm(changes: Partial<StudySessionRequest>): void {
    if ('demandaAcademicaId' in changes) {
      setTasks([])
      setTasksStatus(changes.demandaAcademicaId === null ? 'idle' : 'loading')
    }
    setForm((current) => ({ ...current, ...changes }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (submitRef.current || controlsDisabled || outcomeUnknown) return

    const title = form.titulo.trim()
    if (title.length < 2 || title.length > 150) {
      setError('O título deve ter entre 2 e 150 caracteres.')
      return
    }
    if (!form.dataPlanejada || !form.horaInicioPlanejada) {
      setError('Informe a data e o horário planejados.')
      return
    }
    if (!Number.isInteger(form.duracaoPlanejadaMinutos) || form.duracaoPlanejadaMinutos < 1 || form.duracaoPlanejadaMinutos > 1440) {
      setError('A duração deve ser um número inteiro entre 1 e 1.440 minutos.')
      return
    }
    if ((form.observacoes?.length ?? 0) > 1000) {
      setError('As observações devem ter no máximo 1.000 caracteres.')
      return
    }

    // Antes de tentar criar, registrar IDs das sessões existentes para correlação posterior
    try {
      const currentList = await apiGet<StudySessionListItem[]>('/api/sessoes-estudo')
      existingSessionIdsRef.current = new Set(currentList.map((s) => s.id))
    } catch {
      // Se não conseguir consultar, mantém conjunto vazio (todas as sessões na lista final serão consideradas novas)
      existingSessionIdsRef.current = new Set()
    }

    const submittedData: StudySessionRequest = {
      ...form,
      titulo: title,
      observacoes: form.observacoes?.trim() || null,
    }
    lastSubmittedRequestRef.current = submittedData

    submitRef.current = true
    setSubmitting(true)
    setError(null)
    setOutcomeUnknown(false)
    setSynchronizationFailed(false)
    onOutcomeUnknownChange(false)
    try {
      await onSubmit(submittedData)
      // Operação confirmada com sucesso - fechar o formulário
      onCancel()
    } catch (submitError: unknown) {
      const status = isHttpError(submitError) ? submitError.status : null
      if (isMutationSyncError(submitError)) {
        // Operação confirmada pelo backend, mas falha ao atualizar a lista local
        setSynchronizationFailed(true)
        setOutcomeUnknown(false)
        onOutcomeUnknownChange(false)
        setError(submitError.message)
      } else if (status === null || status === 408 || status === 429 || status >= 500) {
        // Resultado incerto - falha de rede ou timeout
        setOutcomeUnknown(true)
        onOutcomeUnknownChange(true)
        setSynchronizationFailed(false)
        setError('Não foi possível confirmar o resultado da operação. Consulte a lista antes de decidir se tentará novamente.')
      } else if (status === 404) {
        setError('A sessão ou o vínculo informado não foi encontrado.')
      } else if (status === 409) {
        setError(getErrorMessage(submitError, 'A sessão não pode ser editada ou se sobrepõe a outra sessão.'))
      } else if (status === 400) {
        setError(getErrorMessage(submitError, 'Revise os dados informados e tente novamente.'))
      } else {
        setError(getErrorMessage(submitError, 'Não foi possível salvar a sessão.'))
      }
    } finally {
      submitRef.current = false
      setSubmitting(false)
    }
  }

  async function reconcile(): Promise<void> {
    if (reconciling) return
    setReconciling(true)
    setError(null)
    try {
      const wasSyncFailed = synchronizationFailed
      const reconcileResult = await onReconcile()

      if (wasSyncFailed) {
        // Criação já confirmada pela API; lista foi sincronizada com sucesso.
        // Fechar formulário para evitar duplicar a sessão com um segundo POST.
        setOutcomeUnknown(false)
        setSynchronizationFailed(false)
        onOutcomeUnknownChange(false)
        onCancel()
        return
      }

      // Resultado realmente incerto: o POST não foi confirmado pela API.
      // Uma simples resposta 200 da listagem não deve liberar o formulário automaticamente.
      // Identificar se existe evidência confiável para correlacionar a criação original com uma sessão na lista.
      let sessionsList: StudySessionListItem[] = []
      if (Array.isArray(reconcileResult)) {
        sessionsList = reconcileResult
      } else {
        try {
          sessionsList = await apiGet<StudySessionListItem[]>('/api/sessoes-estudo')
        } catch {
          // Se não conseguir consultar a listagem, mantém lista vazia
        }
      }

      const submitted = lastSubmittedRequestRef.current
      const existingIds = existingSessionIdsRef.current

      // Apenas considerar sessões que NÃO existiam antes do POST como evidência potencial
      const newSessions = sessionsList.filter((session) => !existingIds.has(session.id))

      const correlatedSession = submitted
        ? newSessions.find((session) => {
            const sameTitle = session.titulo.trim().toLowerCase() === submitted.titulo.trim().toLowerCase()
            const sameDate = session.dataPlanejada === submitted.dataPlanejada
            const sameStartTime = session.horaInicioPlanejada.slice(0, 5) === submitted.horaInicioPlanejada.slice(0, 5)
            const sameDuration = session.duracaoPlanejadaMinutos === submitted.duracaoPlanejadaMinutos
            const sameDemand = session.demandaAcademicaId === submitted.demandaAcademicaId
            const sameTask = session.tarefaDemandaId === submitted.tarefaDemandaId
            return sameTitle && sameDate && sameStartTime && sameDuration && sameDemand && sameTask
          })
        : null

      if (correlatedSession) {
        // Evidência confiável encontrada na lista: a sessão realmente foi criada no backend.
        setOutcomeUnknown(false)
        setSynchronizationFailed(false)
        onOutcomeUnknownChange(false)
        onCancel()
      } else {
        // Sem evidência suficiente: não foi possível confirmar se a sessão foi criada.
        // Manter o bloqueio de envio e informar que o resultado ainda não foi esclarecido.
        setOutcomeUnknown(true)
        onOutcomeUnknownChange(true)
        setSynchronizationFailed(false)
        setError('Não foi possível confirmar a criação da sessão na lista consultada. O resultado continua incerto; não reenvie para evitar duplicidade.')
      }
    } catch (reconcileError: unknown) {
      setError(getErrorMessage(reconcileError, 'Não foi possível consultar as sessões. Tente novamente.'))
    } finally {
      setReconciling(false)
    }
  }

  return (
    <form className="study-session-form" onSubmit={handleSubmit}>
      <div className="study-session-form-heading">
        <h3>{mode === 'create' ? 'Nova sessão de estudo' : 'Editar sessão de estudo'}</h3>
        <p>Informe os dados planejados. A situação é definida pela API.</p>
      </div>
      <div className="create-demand-form-grid">
        <label className="form-field form-field-full">Título
          <input autoFocus required minLength={2} maxLength={150} disabled={controlsDisabled} value={form.titulo} onChange={(event) => updateForm({ titulo: event.target.value })} />
        </label>
        <label className="form-field">Data planejada
          <input required type="date" disabled={controlsDisabled} value={form.dataPlanejada} onChange={(event) => updateForm({ dataPlanejada: event.target.value })} />
        </label>
        <label className="form-field">Horário de início
          <input required type="time" disabled={controlsDisabled} value={form.horaInicioPlanejada.slice(0, 5)} onChange={(event) => updateForm({ horaInicioPlanejada: event.target.value })} />
        </label>
        <label className="form-field">Duração planejada (minutos)
          <input required type="number" min={1} max={1440} step={1} disabled={controlsDisabled} value={form.duracaoPlanejadaMinutos} onChange={(event) => updateForm({ duracaoPlanejadaMinutos: Number(event.target.value) })} />
        </label>
        <label className="form-field">Demanda acadêmica (opcional)
          <select disabled={controlsDisabled || preservedTaskOnly} value={form.demandaAcademicaId ?? ''} onChange={(event) => updateForm({ demandaAcademicaId: event.target.value ? Number(event.target.value) : null, tarefaDemandaId: null })}>
            <option value="">Sem demanda</option>
            {demands.map((demand) => <option key={demand.id} value={demand.id}>{demand.titulo}</option>)}
          </select>
        </label>
        <label className="form-field">Tarefa (opcional)
          <select disabled={controlsDisabled || form.demandaAcademicaId === null || tasksStatus === 'loading'} value={form.tarefaDemandaId ?? ''} onChange={(event) => updateForm({ tarefaDemandaId: event.target.value ? Number(event.target.value) : null, demandaAcademicaId: null })}>
            <option value="">{preservedTaskOnly ? `Tarefa vinculada (#${form.tarefaDemandaId})` : form.demandaAcademicaId === null ? 'Selecione uma demanda primeiro' : tasksStatus === 'loading' ? 'Carregando tarefas…' : 'Sem tarefa'}</option>
            {tasks.map((task) => <option key={task.id} value={task.id}>{task.titulo}</option>)}
          </select>
          {preservedTaskOnly && <small className="form-help">O proprietário desta tarefa não está disponível na resposta da sessão; o vínculo será preservado.</small>}
        </label>
        <label className="form-field form-field-full">Observações (opcional)
          <textarea maxLength={1000} rows={3} disabled={controlsDisabled} value={form.observacoes ?? ''} onChange={(event) => updateForm({ observacoes: event.target.value })} />
        </label>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {(outcomeUnknown || synchronizationFailed) && (
        <div role="alert" aria-live="assertive" className="alert alert-warning task-uncertain-guidance">
          <p>{synchronizationFailed ? 'A sessão foi criada, mas a lista não pôde ser atualizada. Consulte as sessões para sincronizar os dados; não é necessário reenviar a operação.' : 'O resultado da operação é incerto. Não reenvie automaticamente para evitar alterações duplicadas.'}</p>
          <button className="text-button" type="button" disabled={controlsDisabled} onClick={reconcile}>
            {reconciling ? 'Consultando sessões…' : synchronizationFailed ? 'Atualizar lista de sessões' : 'Consultar sessões antes de tentar novamente'}
          </button>
        </div>
      )}
      <div className="create-demand-form-actions">
        <button className="button button-secondary" type="button" disabled={controlsDisabled} onClick={onCancel}>Cancelar</button>
        <button className="button button-primary" type="submit" disabled={controlsDisabled || outcomeUnknown || synchronizationFailed}>
          {submitting ? 'Salvando…' : mode === 'create' ? 'Criar sessão' : 'Salvar alterações'}
        </button>
      </div>
    </form>
  )
}
