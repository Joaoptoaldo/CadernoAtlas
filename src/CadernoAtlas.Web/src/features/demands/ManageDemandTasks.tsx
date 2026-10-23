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
  isDeletingTask: boolean
  onLoad: (demandId: number, signal: AbortSignal) => Promise<DemandTask[]>
  onCreate: (demandId: number, request: CreateDemandTaskRequest) => Promise<void>
  onUpdate: (demandId: number, taskId: number, request: UpdateDemandTaskRequest) => Promise<DemandTask>
  onDelete: (demandId: number, taskId: number) => Promise<void>
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

function taskLoadError(error: unknown, creationConfirmed: boolean, deletionConfirmed = false): TaskLoadState {
  if (deletionConfirmed) {
    return {
      status: 'error',
      title: 'Tarefa excluída, mas a lista não foi atualizada',
      message: `A exclusão foi confirmada pela API, mas não foi possível recarregar as tarefas. ${errorMessage(error)}`,
    }
  }

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
  isDeletingTask,
  onLoad,
  onCreate,
  onUpdate,
  onDelete,
}: ManageDemandTasksProps) {
  const [state, setState] = useState<TaskLoadState>({ status: 'loading' })
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [creationConfirmed, setCreationConfirmed] = useState(false)
  const [deletionConfirmed, setDeletionConfirmed] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null)
  const [deletingTaskId, setDeletingTaskId] = useState<number | null>(null)
  const [deletionError, setDeletionError] = useState<{
    taskId: number
    message: string
    requiresReconciliation: boolean
    outcomeUnknown: boolean
  } | null>(null)
  const requestSequenceRef = useRef(0)
  const activeControllerRef = useRef<AbortController | null>(null)
  const creationConfirmedRef = useRef(false)
  const deletionConfirmedRef = useRef(false)
  const deletingTaskIdRef = useRef<number | null>(null)
  const mutationInProgress = isCreatingTask || isUpdatingTask || isDeletingTask
  const taskReconciliationRequired = deletionError?.requiresReconciliation ?? false

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
        deletionConfirmedRef.current = false
        setCreationConfirmed(false)
        setDeletionConfirmed(false)
        setDeletionError(null)
      }
      return requestId === requestSequenceRef.current && !controller.signal.aborted
    } catch (error: unknown) {
      if (requestId !== requestSequenceRef.current || controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) return false
      setState(taskLoadError(error, creationConfirmedRef.current, deletionConfirmedRef.current))
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
        deletionConfirmedRef.current = false
        setCreationConfirmed(false)
        setDeletionConfirmed(false)
        setDeletionError(null)
      })
      .catch((error: unknown) => {
        if (requestId !== requestSequenceRef.current || controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) return
        setState(taskLoadError(error, creationConfirmedRef.current, deletionConfirmedRef.current))
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

  function updateSucceeded(): void {
    // A API normaliza a ordem e reposiciona as tarefas irmãs; recarregar evita
    // manter na interface uma projeção local divergente do estado persistido.
    setEditingTaskId(null)
    setState({ status: 'loading' })
    void requestTasks()
  }


  async function deleteTask(task: DemandTask): Promise<void> {
    if (
      mutationInProgress ||
      deletingTaskIdRef.current !== null ||
      editingTaskId !== null ||
      isCreateOpen ||
      taskReconciliationRequired
    ) return

    const confirmed = window.confirm(
      `Excluir a tarefa "${task.titulo}"?\n\nEsta ação não pode ser desfeita. As sessões de estudo vinculadas continuarão existindo, mas perderão o vínculo com esta tarefa.`,
    )
    if (!confirmed) return

    deletingTaskIdRef.current = task.id
    setDeletingTaskId(task.id)
    setDeletionError(null)
    try {
      await onDelete(demandId, task.id)
      deletionConfirmedRef.current = true
      setDeletionConfirmed(true)
      setState({ status: 'loading' })
      void requestTasks()
    } catch (error: unknown) {
      const status = typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number'
        ? error.status
        : null
      const outcomeUnknown = status === null || status === 408 || status === 429 || status >= 500
      const requiresReconciliation = outcomeUnknown || status === 404 || status === 409
      setDeletionError({
        taskId: task.id,
        message: outcomeUnknown
          ? 'Não foi possível confirmar se a tarefa foi excluída. Consulte a lista antes de decidir se tentará novamente.'
          : error instanceof Error && error.message
            ? error.message
            : 'Não foi possível excluir a tarefa. Tente novamente.',
        requiresReconciliation,
        outcomeUnknown,
      })
    } finally {
      deletingTaskIdRef.current = null
      setDeletingTaskId(null)
    }
  }

  async function reconcileDeletion(): Promise<void> {
    if (!deletionError?.requiresReconciliation || isDeletingTask) return
    const taskId = deletionError.taskId
    setState({ status: 'loading' })
    const refreshed = await requestTasks()
    if (refreshed) {
      setDeletionError(null)
      return
    }
    setDeletionError((current) => current?.taskId === taskId
      ? { ...current, message: `${current.message} A lista não foi atualizada; consulte novamente antes de repetir a exclusão.` }
      : current)
  }

  return (
    <section className="managed-tasks-panel" id={`demand-tasks-${demandId}`} aria-label={`Tarefas de ${demandTitle}`}>
      {deletionError && (
        <div className="task-delete-error" role="alert">
          <p>{deletionError.message}</p>
          {deletionError.requiresReconciliation && (
            <button
              type="button"
              className="text-button"
              disabled={isDeletingTask || isCreatingTask || isUpdatingTask}
              onClick={() => void reconcileDeletion()}
            >
              {deletionError.outcomeUnknown
                ? 'Consultar tarefas antes de tentar novamente'
                : 'Atualizar lista de tarefas'}
            </button>
          )}
        </div>
      )}
      {canCreateTasks && (
        <>
          <button
            className="button button-secondary task-create-toggle"
            type="button"
            aria-expanded={isCreateOpen}
            aria-controls={isCreateOpen ? `create-task-form-${demandId}` : undefined}
            disabled={mutationInProgress || taskReconciliationRequired || editingTaskId !== null}
            onClick={() => setIsCreateOpen((open) => !open)}
          >
            {isCreateOpen ? 'Fechar cadastro' : 'Nova tarefa'}
          </button>
          {isCreateOpen && (
            <CreateDemandTaskForm
              key={demandId}
              demandId={demandId}
              disabled={mutationInProgress || taskReconciliationRequired || editingTaskId !== null}
              onCreate={onCreate}
              onCreated={creationSucceeded}
              onReconcile={reconcileTasks}
            />
          )}
        </>
      )}
      {creationConfirmed && state.status === 'loading' && <p className="task-create-success" role="status">Tarefa criada. Atualizando a lista…</p>}
      {deletionConfirmed && state.status === 'loading' && <p className="task-create-success" role="status">Tarefa excluída. Atualizando a lista…</p>}
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
          {state.data.map((task, index) => (
            <li className="managed-task-card" key={task.id}>
              <div className="managed-task-heading">
                <h4>{task.titulo}</h4>
                <span className="managed-task-status">{situationLabels[task.situacao] ?? 'Situação desconhecida'}</span>
              </div>
              <p>{task.descricao || 'Descrição não informada'}</p>
              <div className="managed-task-details">
                <span>Etapa {index + 1}</span>
                <span>{task.esforcoEstimadoMinutos == null ? 'Esforço não estimado' : `${task.esforcoEstimadoMinutos} min`}</span>
              </div>
              {editingTaskId === task.id ? (
                <EditDemandTaskForm
                  task={task}
                  initialOrder={index}
                  demandId={demandId}
                  disabled={mutationInProgress || taskReconciliationRequired}
                  onCancel={() => setEditingTaskId(null)}
                  onUpdate={onUpdate}
                  onUpdated={updateSucceeded}
                  onReconcile={reconcileTasks}
                />
              ) : (
                canCreateTasks && (
                  <div className="managed-task-actions">
                    <button
                      className="button button-secondary"
                      type="button"
                      disabled={mutationInProgress || taskReconciliationRequired || editingTaskId !== null || isCreateOpen}
                      onClick={() => setEditingTaskId(task.id)}
                    >
                      Editar tarefa
                    </button>
                    <button
                      className="button button-secondary"
                      type="button"
                      aria-label={`Excluir tarefa ${task.titulo}`}
                      disabled={mutationInProgress || taskReconciliationRequired || editingTaskId !== null || isCreateOpen}
                      onClick={() => void deleteTask(task)}
                    >
                      {deletingTaskId === task.id ? 'Excluindo…' : 'Excluir tarefa'}
                    </button>
                  </div>
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
  initialOrder,
  demandId,
  disabled,
  onCancel,
  onUpdate,
  onUpdated,
  onReconcile,
}: {
  task: DemandTask
  initialOrder: number
  demandId: number
  disabled: boolean
  onCancel: () => void
  onUpdate: ManageDemandTasksProps['onUpdate']
  onUpdated: (task: DemandTask) => void
  onReconcile: () => Promise<boolean>
}) {
  const [titulo, setTitulo] = useState(task.titulo)
  const [descricao, setDescricao] = useState(task.descricao ?? '')
  const [ordem, setOrdem] = useState(String(initialOrder + 1))
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
