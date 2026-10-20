import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import StatusMessage from '../../components/ui/StatusMessage'
import CreateDemandTaskForm, { type CreateDemandTaskRequest } from './CreateDemandTaskForm'

export interface DemandTask {
  id: number
  demandaAcademicaId: number
  titulo: string
  descricao: string | null
  ordem: number
  esforcoEstimadoMinutos: number | null
  situacao: number
}

export interface UpdateDemandTaskRequest {
  titulo: string
  descricao: string | null
  ordem: number
  esforcoEstimadoMinutos: number | null
  situacao: number
}

interface ManageDemandTasksProps {
  demandId: number
  demandTitle: string
  canCreateTasks: boolean
  isCreatingTask: boolean
  isUpdatingTask: boolean
  onLoad: (demandId: number, signal: AbortSignal) => Promise<DemandTask[]>
  onCreate: (demandId: number, request: CreateDemandTaskRequest) => Promise<void>
  onUpdate: (demandId: number, taskId: number, request: UpdateDemandTaskRequest) => Promise<DemandTask>
}

type TaskLoadState =
  | { status: 'loading' }
  | { status: 'success'; data: DemandTask[] }
  | { status: 'error'; title: string; message: string }

const situationLabels: Record<number, string> = {
  0: 'Pendente',
  1: 'Em andamento',
  2: 'Concluída',
}

function isNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'status' in error && error.status === 404
}

function errorMessage(error: unknown): string {
  if (error instanceof TypeError) {
    return 'Verifique sua conexão e tente carregar as tarefas novamente.'
  }
  return error instanceof Error && error.message
    ? error.message
    : 'Ocorreu um erro ao consultar as tarefas. Tente novamente.'
}

function taskLoadError(error: unknown, creationConfirmed: boolean): TaskLoadState {
  if (creationConfirmed) {
    return {
      status: 'error',
      title: 'Tarefa criada, mas a lista não foi atualizada',
      message: `A criação foi confirmada pela API, mas não foi possível recarregar as tarefas. ${errorMessage(error)}`,
    }
  }

  const notFound = isNotFound(error)
  return {
    status: 'error',
    title: notFound ? 'Demanda não encontrada' : 'Não foi possível carregar as tarefas',
    message: notFound
      ? 'A demanda não está mais disponível. Atualize a lista e tente novamente.'
      : errorMessage(error),
  }
}

export default function ManageDemandTasks({
  demandId,
  demandTitle,
  canCreateTasks,
  isCreatingTask,
  isUpdatingTask,
  onLoad,
  onCreate,
  onUpdate,
}: ManageDemandTasksProps) {
  const [state, setState] = useState<TaskLoadState>({ status: 'loading' })
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [creationConfirmed, setCreationConfirmed] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null)
  const requestSequenceRef = useRef(0)
  const activeControllerRef = useRef<AbortController | null>(null)
  const creationConfirmedRef = useRef(false)
  const mutationInProgress = isCreatingTask || isUpdatingTask

  const requestTasks = useCallback(async (): Promise<boolean> => {
    activeControllerRef.current?.abort()
    const controller = new AbortController()
    activeControllerRef.current = controller
    const requestId = ++requestSequenceRef.current

    try {
      const data = await onLoad(demandId, controller.signal)
      if (requestId === requestSequenceRef.current && !controller.signal.aborted) {
        setState({ status: 'success', data })
        creationConfirmedRef.current = false
        setCreationConfirmed(false)
      }
      return requestId === requestSequenceRef.current && !controller.signal.aborted
    } catch (error: unknown) {
      if (requestId !== requestSequenceRef.current || controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) return false
      setState(taskLoadError(error, creationConfirmedRef.current))
      return false
    }
  }, [demandId, onLoad])

  useEffect(() => {
    const controller = new AbortController()
    const requestId = ++requestSequenceRef.current
    activeControllerRef.current = controller
    onLoad(demandId, controller.signal)
      .then((data) => {
        if (requestId !== requestSequenceRef.current || controller.signal.aborted) return
        setState({ status: 'success', data })
        creationConfirmedRef.current = false
        setCreationConfirmed(false)
      })
      .catch((error: unknown) => {
        if (requestId !== requestSequenceRef.current || controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) return
        setState(taskLoadError(error, creationConfirmedRef.current))
      })
    return () => {
      requestSequenceRef.current += 1
      activeControllerRef.current?.abort()
    }
  }, [demandId, onLoad])

  const reconcileTasks = useCallback(async (): Promise<boolean> => {
    setState({ status: 'loading' })
    return requestTasks()
  }, [requestTasks])

  function retryTasks(): void {
    setState({ status: 'loading' })
    void requestTasks()
  }

  function creationSucceeded(): void {
    creationConfirmedRef.current = true
    setCreationConfirmed(true)
    setState({ status: 'loading' })
    void requestTasks()
  }

  function updateSucceeded(updatedTask: DemandTask): void {
    setState((current) => current.status === 'success'
      ? {
          status: 'success',
          data: current.data
            .map((task) => task.id === updatedTask.id ? updatedTask : task)
            .sort((left, right) => left.ordem - right.ordem || left.id - right.id),
        }
      : current)
    setEditingTaskId(null)
  }

  return (
    <section className="managed-tasks-panel" id={`demand-tasks-${demandId}`} aria-label={`Tarefas de ${demandTitle}`}>
      {canCreateTasks && (
        <>
          <button
            className="button button-secondary task-create-toggle"
            type="button"
            aria-expanded={isCreateOpen}
            aria-controls={isCreateOpen ? `create-task-form-${demandId}` : undefined}
            disabled={mutationInProgress || editingTaskId !== null}
            onClick={() => setIsCreateOpen((open) => !open)}
          >
            {isCreateOpen ? 'Fechar cadastro' : 'Nova tarefa'}
          </button>
          {isCreateOpen && (
            <CreateDemandTaskForm
              key={demandId}
              demandId={demandId}
              disabled={mutationInProgress || editingTaskId !== null}
              onCreate={onCreate}
              onCreated={creationSucceeded}
              onReconcile={reconcileTasks}
            />
          )}
        </>
      )}
      {creationConfirmed && state.status === 'loading' && <p className="task-create-success" role="status">Tarefa criada. Atualizando a lista…</p>}
      {state.status === 'loading' && <p className="managed-tasks-loading" role="status">Carregando tarefas…</p>}
      {state.status === 'error' && (
        <StatusMessage
          title={state.title}
          description={state.message}
          onRetry={isCreatingTask ? undefined : retryTasks}
          compact
        />
      )}
      {state.status === 'success' && state.data.length === 0 && (
        <p className="managed-tasks-empty">Nenhuma tarefa cadastrada para esta demanda.</p>
      )}
      {state.status === 'success' && state.data.length > 0 && (
        <ol className="managed-task-list">
          {state.data.map((task) => (
            <li className="managed-task-card" key={task.id}>
              <div className="managed-task-heading">
                <h4>{task.titulo}</h4>
                <span className="managed-task-status">{situationLabels[task.situacao] ?? 'Situação desconhecida'}</span>
              </div>
              <p>{task.descricao || 'Descrição não informada'}</p>
              <div className="managed-task-details">
                <span>Etapa {task.ordem + 1}</span>
                <span>{task.esforcoEstimadoMinutos == null ? 'Esforço não estimado' : `${task.esforcoEstimadoMinutos} min`}</span>
              </div>
              {editingTaskId === task.id ? (
                <EditDemandTaskForm
                  task={task}
                  demandId={demandId}
                  disabled={mutationInProgress}
                  onCancel={() => setEditingTaskId(null)}
                  onUpdate={onUpdate}
                  onUpdated={updateSucceeded}
                  onReconcile={reconcileTasks}
                />
              ) : (
                canCreateTasks && (
                  <button
                    className="button button-secondary"
                    type="button"
                    disabled={mutationInProgress || editingTaskId !== null || isCreateOpen}
                    onClick={() => setEditingTaskId(task.id)}
                  >
                    Editar tarefa
                  </button>
                )
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function EditDemandTaskForm({
  task,
  demandId,
  disabled,
  onCancel,
  onUpdate,
  onUpdated,
  onReconcile,
}: {
  task: DemandTask
  demandId: number
  disabled: boolean
  onCancel: () => void
  onUpdate: ManageDemandTasksProps['onUpdate']
  onUpdated: (task: DemandTask) => void
  onReconcile: () => Promise<boolean>
}) {
  const [titulo, setTitulo] = useState(task.titulo)
  const [descricao, setDescricao] = useState(task.descricao ?? '')
  const [ordem, setOrdem] = useState(String(task.ordem + 1))
  const [esforco, setEsforco] = useState(task.esforcoEstimadoMinutos == null ? '' : String(task.esforcoEstimadoMinutos))
  const [situacao, setSituacao] = useState(String(task.situacao))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [outcomeUnknown, setOutcomeUnknown] = useState(false)
  const [reconciled, setReconciled] = useState(false)
  const savingRef = useRef(false)
  const controlsDisabled = disabled || saving

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (savingRef.current || controlsDisabled || (outcomeUnknown && !reconciled)) return
    const trimmedTitle = titulo.trim()
    const effortValue = esforco.trim() === '' ? null : Number(esforco)
    const position = Number(ordem)
    if (trimmedTitle.length < 2 || trimmedTitle.length > 150) {
      setError('O título deve ter entre 2 e 150 caracteres.')
      return
    }
    if (descricao.length > 1000) {
      setError('A descrição deve ter no máximo 1000 caracteres.')
      return
    }
    if (!Number.isInteger(position) || position < 1) {
      setError('A posição deve ser um número inteiro maior que zero.')
      return
    }
    if (effortValue !== null && (!Number.isInteger(effortValue) || effortValue <= 0)) {
      setError('O esforço estimado deve ser um número inteiro maior que zero.')
      return
    }

    savingRef.current = true
    setSaving(true)
    setError(null)
    setOutcomeUnknown(false)
    setReconciled(false)
    try {
      const updated = await onUpdate(demandId, task.id, {
        titulo: trimmedTitle,
        descricao: descricao.trim() || null,
        ordem: position - 1,
        esforcoEstimadoMinutos: effortValue,
        situacao: Number(situacao),
      })
      onUpdated(updated)
    } catch (updateError: unknown) {
      const status = typeof updateError === 'object' && updateError !== null && 'status' in updateError && typeof updateError.status === 'number'
        ? updateError.status
        : null
      if (status === null || status >= 500) {
        setOutcomeUnknown(true)
        setError('Não foi possível confirmar se a tarefa foi atualizada. Consulte a lista antes de decidir se tentará novamente.')
      } else {
        const message = updateError instanceof Error ? updateError.message : 'Não foi possível atualizar a tarefa.'
        setError(message)
      }
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  async function reconcile(): Promise<void> {
    setError(null)
    try {
      if (await onReconcile()) {
        setReconciled(true)
        setError('Consulta concluída. Revise os dados da tarefa antes de tentar novamente.')
      } else {
        setError('A lista não pôde ser atualizada. Tente consultar novamente antes de reenviar.')
      }
    } catch {
      setError('A lista não pôde ser atualizada. Tente consultar novamente antes de reenviar.')
    }
  }

  return (
    <form className="create-task-form edit-task-form" onSubmit={(event) => void submit(event)}>
      <label className="form-field">Título da tarefa
        <input required minLength={2} maxLength={150} disabled={controlsDisabled} value={titulo} onChange={(event) => setTitulo(event.target.value)} />
      </label>
      <label className="form-field">Descrição da tarefa
        <textarea maxLength={1000} rows={2} disabled={controlsDisabled} value={descricao} onChange={(event) => setDescricao(event.target.value)} />
      </label>
      <label className="form-field">Posição da tarefa
        <input type="number" min={1} step={1} disabled={controlsDisabled} value={ordem} onChange={(event) => setOrdem(event.target.value)} />
      </label>
      <label className="form-field">Esforço estimado da tarefa em minutos
        <input type="number" min={1} step={1} disabled={controlsDisabled} value={esforco} onChange={(event) => setEsforco(event.target.value)} />
      </label>
      <label className="form-field">Situação da tarefa
        <select disabled={controlsDisabled} value={situacao} onChange={(event) => setSituacao(event.target.value)}>
          <option value="0">Pendente</option>
          <option value="1">Em andamento</option>
          <option value="2">Concluída</option>
        </select>
      </label>
      {saving && <p role="status">Salvando tarefa…</p>}
      {error && <p role="alert">{error}</p>}
      {outcomeUnknown && (
        <button type="button" className="text-button" disabled={saving} onClick={() => void reconcile()}>
          Consultar tarefas antes de tentar novamente
        </button>
      )}
      <div className="create-demand-form-actions">
        <button className="button button-secondary" type="button" disabled={controlsDisabled} onClick={onCancel}>Cancelar edição</button>
        <button className="button button-primary" type="submit" disabled={controlsDisabled || (outcomeUnknown && !reconciled)}>{saving ? 'Salvando…' : 'Salvar tarefa'}</button>
      </div>
    </form>
  )
}
