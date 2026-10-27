import { useMemo, useRef, useState, type FormEvent } from 'react'
import StatusMessage from '../../components/ui/StatusMessage'
import ManageDemandTasks, { type DemandTask, type UpdateDemandTaskRequest } from './ManageDemandTasks'
import type { CreateDemandTaskRequest } from './CreateDemandTaskForm'

export interface AcademicDemandRecord {
  id: number
  titulo: string
  descricao: string | null
  tipo: number
  prazo: string | null
  importancia: number
  esforcoEstimadoMinutos: number | null
  situacao: number
  criadoEm: string
}

export interface UpdateDemandRequest {
  titulo: string
  descricao: string | null
  tipo: number
  prazo: string | null
  importancia: number
  esforcoEstimadoMinutos: number | null
  situacao: number
}

interface DemandListState {
  status: 'loading' | 'success' | 'error'
  data: AcademicDemandRecord[] | null
  error: string | null
}

interface ManageDemandsPanelProps {
  state: DemandListState
  onRetry: () => void
  onUpdate: (id: number, request: UpdateDemandRequest) => Promise<void>
  onLoadTasks: (demandId: number, signal: AbortSignal) => Promise<DemandTask[]>
  onCreateTask: (demandId: number, request: CreateDemandTaskRequest) => Promise<void>
  onUpdateTask: (demandId: number, taskId: number, request: UpdateDemandTaskRequest) => Promise<DemandTask>
  isUpdatingDemand: boolean
  isCreatingTask: boolean
  isUpdatingTask: boolean
  isDeletingTask: boolean
  onDeleteTask: (demandId: number, taskId: number) => Promise<void>
  onReconcileDemands: () => Promise<void>
  demandOutcomeUnknown: boolean
  onDemandOutcomeUnknownChange: (value: boolean) => void
}

const typeLabels = ['Prova', 'Trabalho', 'APG', 'TCC', 'Outro']
const importanceLabels = ['Baixa', 'Média', 'Alta']
const statusLabels = ['Pendente', 'Em andamento', 'Concluída', 'Cancelada']

export default function ManageDemandsPanel({ state, onRetry, onUpdate, onLoadTasks, onCreateTask, onUpdateTask, onDeleteTask, isUpdatingDemand, isCreatingTask, isUpdatingTask, isDeletingTask, onReconcileDemands, demandOutcomeUnknown, onDemandOutcomeUnknownChange }: ManageDemandsPanelProps) {
  const taskMutationInProgress = isCreatingTask || isUpdatingTask || isDeletingTask
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [importanceFilter, setImportanceFilter] = useState('')
  const [deadlineFilter, setDeadlineFilter] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<UpdateDemandRequest | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [expandedTaskDemandId, setExpandedTaskDemandId] = useState<number | null>(null)
  const [outcomeUnknown, setOutcomeUnknown] = useState(demandOutcomeUnknown)
  const [isReconciling, setIsReconciling] = useState(false)
  const [reconciliationComplete, setReconciliationComplete] = useState(false)
  const savingRef = useRef(false)
  const controlsDisabled = saving || isUpdatingDemand || isReconciling

  const filteredDemands = useMemo(() => (state.data ?? []).filter((demand) => (
    (statusFilter === '' || demand.situacao === Number(statusFilter)) &&
    (typeFilter === '' || demand.tipo === Number(typeFilter)) &&
    (importanceFilter === '' || demand.importancia === Number(importanceFilter)) &&
    (deadlineFilter === '' || (demand.prazo !== null && demand.prazo <= deadlineFilter))
  )), [state.data, statusFilter, typeFilter, importanceFilter, deadlineFilter])

  function getHttpStatus(error: unknown): number | null {
    if (typeof error !== 'object' || error === null || !('status' in error)) return null
    return typeof error.status === 'number' ? error.status : null
  }

  function getApiMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback
  }

  function beginEdit(demand: AcademicDemandRecord): void {
    setExpandedTaskDemandId(null)
    setEditingId(demand.id)
    setForm({
      titulo: demand.titulo,
      descricao: demand.descricao,
      tipo: demand.tipo,
      prazo: demand.prazo,
      importancia: demand.importancia,
      esforcoEstimadoMinutos: demand.esforcoEstimadoMinutos,
      situacao: demand.situacao,
    })
    setFormError(null)
    setOutcomeUnknown(false)
    setReconciliationComplete(false)
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (editingId === null || form === null || savingRef.current || controlsDisabled || (outcomeUnknown && !reconciliationComplete)) return
    const payload = { ...form, titulo: form.titulo.trim(), descricao: form.descricao?.trim() || null }
    if (payload.titulo.length < 2) {
      setFormError('O título deve ter pelo menos 2 caracteres.')
      return
    }
    savingRef.current = true
    setSaving(true)
    setFormError(null)
    setOutcomeUnknown(false)
    setReconciliationComplete(false)
    try {
      await onUpdate(editingId, payload)
      setEditingId(null)
      setForm(null)
      onDemandOutcomeUnknownChange(false)
    } catch (error: unknown) {
      const status = getHttpStatus(error)
      if (status === null || status === 408 || status === 429 || status >= 500) {
        setOutcomeUnknown(true)
        onDemandOutcomeUnknownChange(true)
        setFormError('Não foi possível confirmar se a demanda foi atualizada. Consulte a lista antes de decidir se tentará novamente.')
      } else {
        setFormError(getApiMessage(error, 'Não foi possível atualizar a demanda. Tente novamente.'))
      }
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  async function reconcileOutcome(): Promise<void> {
    if (isReconciling) return
    setIsReconciling(true)
    setFormError(null)
    try {
      await onReconcileDemands()
      // Reconciliação bem-sucedida: liberar estado incerto, fechar formulário
      setOutcomeUnknown(false)
      setReconciliationComplete(false)
      onDemandOutcomeUnknownChange(false)
      setEditingId(null)
      setForm(null)
    } catch (reconcileError) {
      // Falha na reconciliação: manter estado incerto, formulário aberto, mostrar erro
      setFormError(getApiMessage(reconcileError, 'Não foi possível consultar as demandas. Tente novamente.'))
    } finally {
      setIsReconciling(false)
    }
  }

  return (
    <section className="panel manage-demands-panel" aria-labelledby="manage-demands-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">ACOMPANHAMENTO ACADÊMICO</p>
          <h2 id="manage-demands-title">Demandas acadêmicas</h2>
          <p className="panel-description">Consulte e atualize suas demandas, incluindo as concluídas e canceladas.</p>
        </div>
      </div>

      <div className="demand-filters" aria-label="Filtros de demandas">
        <label className="form-field">Filtrar situação
          <select aria-label="Filtrar por situação" disabled={isUpdatingDemand || taskMutationInProgress} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">Todas</option>{statusLabels.map((label, index) => <option value={index} key={label}>{label}</option>)}
          </select>
        </label>
        <label className="form-field">Filtrar tipo
          <select aria-label="Filtrar por tipo" disabled={isUpdatingDemand || taskMutationInProgress} value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="">Todos</option>{typeLabels.map((label, index) => <option value={index} key={label}>{label}</option>)}
          </select>
        </label>
        <label className="form-field">Filtrar importância
          <select aria-label="Filtrar por importância" disabled={isUpdatingDemand || taskMutationInProgress} value={importanceFilter} onChange={(event) => setImportanceFilter(event.target.value)}>
            <option value="">Todas</option>{importanceLabels.map((label, index) => <option value={index} key={label}>{label}</option>)}
          </select>
        </label>
        <label className="form-field">Prazo até
          <input aria-label="Filtrar por prazo máximo" type="date" disabled={isUpdatingDemand || taskMutationInProgress} value={deadlineFilter} onChange={(event) => setDeadlineFilter(event.target.value)} />
        </label>
      </div>

      {state.status === 'loading' && !state.data && <p role="status">Carregando demandas…</p>}
      {state.status === 'error' && !state.data && <StatusMessage title="Não foi possível carregar as demandas" description={state.error ?? 'Tente novamente.'} onRetry={isUpdatingDemand || taskMutationInProgress ? undefined : onRetry} />}
      {state.status === 'error' && state.data && <StatusMessage title="A lista pode estar desatualizada" description={state.error ?? 'Tente novamente.'} onRetry={isUpdatingDemand || taskMutationInProgress ? undefined : onRetry} compact />}
      {state.data && filteredDemands.length === 0 && (
        <div className="empty-state"><h3>Nenhuma demanda encontrada</h3><p>Ajuste os filtros ou cadastre uma nova demanda.</p></div>
      )}
      {filteredDemands.map((demand) => (
        <article className="managed-demand-card" key={demand.id}>
          {editingId === demand.id && form ? (
            <form className="edit-demand-form" onSubmit={submitEdit}>
              <h3>Editar demanda</h3>
              <div className="create-demand-form-grid">
                <label className="form-field form-field-full">Título<input required minLength={2} maxLength={150} disabled={saving || isUpdatingDemand} value={form.titulo} onChange={(event) => setForm({ ...form, titulo: event.target.value })} /></label>
                <label className="form-field form-field-full">Descrição<textarea maxLength={1000} rows={3} disabled={saving || isUpdatingDemand} value={form.descricao ?? ''} onChange={(event) => setForm({ ...form, descricao: event.target.value || null })} /></label>
                <label className="form-field">Tipo<select aria-label="Tipo da demanda" disabled={saving || isUpdatingDemand} value={form.tipo} onChange={(event) => setForm({ ...form, tipo: Number(event.target.value) })}>{typeLabels.map((label, index) => <option value={index} key={label}>{label}</option>)}</select></label>
                <label className="form-field">Importância<select aria-label="Importância da demanda" disabled={saving || isUpdatingDemand} value={form.importancia} onChange={(event) => setForm({ ...form, importancia: Number(event.target.value) })}>{importanceLabels.map((label, index) => <option value={index} key={label}>{label}</option>)}</select></label>
                <label className="form-field">Prazo<input aria-label="Prazo da demanda" type="date" disabled={saving || isUpdatingDemand} value={form.prazo ?? ''} onChange={(event) => setForm({ ...form, prazo: event.target.value || null })} /></label>
                <label className="form-field">Esforço estimado em minutos<input aria-label="Esforço da demanda" type="number" min={1} step={1} disabled={saving || isUpdatingDemand} value={form.esforcoEstimadoMinutos ?? ''} onChange={(event) => setForm({ ...form, esforcoEstimadoMinutos: event.target.value === '' ? null : Number(event.target.value) })} /></label>
                <label className="form-field">Situação<select aria-label="Situação da demanda" disabled={saving || isUpdatingDemand} value={form.situacao} onChange={(event) => setForm({ ...form, situacao: Number(event.target.value) })}>{statusLabels.map((label, index) => <option value={index} key={label}>{label}</option>)}</select></label>
              </div>
              {formError && <p role="alert" className="form-error">{formError}</p>}
              {outcomeUnknown && (
                <div className="task-uncertain-guidance">
                  <p>A consulta reduz a incerteza, mas não garante que uma requisição anterior ainda em processamento não seja concluída depois.</p>
                  {!reconciliationComplete ? (
                    <button className="text-button" type="button" disabled={controlsDisabled} onClick={() => void reconcileOutcome()}>
                      {isReconciling ? 'Consultando demandas…' : 'Consultar demandas antes de tentar novamente'}
                    </button>
                  ) : (
                    <p role="status">Consulta concluída. Revise a lista antes de decidir se tentará novamente.</p>
                  )}
                </div>
              )}
              <div className="create-demand-form-actions">
                <button className="button button-secondary" type="button" disabled={controlsDisabled || outcomeUnknown} onClick={() => { setEditingId(null); setForm(null); setOutcomeUnknown(false); setReconciliationComplete(false); onDemandOutcomeUnknownChange(false); }}>Cancelar</button>
                <button className="button button-primary" type="submit" disabled={controlsDisabled || (outcomeUnknown && !reconciliationComplete)}>{saving || isUpdatingDemand ? 'Salvando…' : 'Salvar alterações'}</button>
              </div>
            </form>
          ) : (
            <>
              <div><h3>{demand.titulo}</h3><p>{demand.descricao || 'Sem descrição.'}</p></div>
              <dl className="managed-demand-details">
                <div><dt>Tipo</dt><dd>{typeLabels[demand.tipo] ?? 'Outro'}</dd></div>
                <div><dt>Importância</dt><dd>{importanceLabels[demand.importancia] ?? 'Média'}</dd></div>
                <div><dt>Situação</dt><dd>{statusLabels[demand.situacao] ?? 'Pendente'}</dd></div>
                <div><dt>Prazo</dt><dd>{demand.prazo ?? 'Sem prazo'}</dd></div>
                <div><dt>Esforço</dt><dd>{demand.esforcoEstimadoMinutos === null ? 'Não estimado' : `${demand.esforcoEstimadoMinutos} min`}</dd></div>
              </dl>
              <div className="managed-demand-actions">
                <button
                  className="button button-secondary"
                  type="button"
                  aria-label={`${expandedTaskDemandId === demand.id ? 'Ocultar' : 'Ver'} tarefas de ${demand.titulo}`}
                  aria-expanded={expandedTaskDemandId === demand.id}
                  aria-controls={expandedTaskDemandId === demand.id ? `demand-tasks-${demand.id}` : undefined}
                  disabled={isUpdatingDemand || taskMutationInProgress || editingId !== null}
                  onClick={() => setExpandedTaskDemandId((current) => current === demand.id ? null : demand.id)}
                >
                  {expandedTaskDemandId === demand.id ? 'Ocultar tarefas' : 'Ver tarefas'}
                </button>
                <button className="button button-secondary" type="button" disabled={isUpdatingDemand || taskMutationInProgress} onClick={() => beginEdit(demand)}>Editar demanda</button>
              </div>
              {expandedTaskDemandId === demand.id && (
                <ManageDemandTasks
                  key={demand.id}
                  demandId={demand.id}
                  demandTitle={demand.titulo}
                  canCreateTasks={demand.situacao === 0 || demand.situacao === 1}
                  isCreatingTask={isCreatingTask}
                  isUpdatingTask={isUpdatingTask}
                 isDeletingTask={isDeletingTask}
                  onLoad={onLoadTasks}
                  onCreate={onCreateTask}
                  onUpdate={onUpdateTask}
                 onDelete={onDeleteTask}
                />
              )}
            </>
          )}
        </article>
      ))}
    </section>
  )
}
