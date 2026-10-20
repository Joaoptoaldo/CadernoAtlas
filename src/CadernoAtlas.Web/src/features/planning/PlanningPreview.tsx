
import {
  formatClockEnd,
  formatMinutes,
  formatWeekRange,
  parseIsoDate,
  reasonLabel,
} from '../../utils/planningFormatters'

export interface PlannedAllocation {
  demandaAcademicaId: number | null
  tarefaDemandaId: number | null
  titulo: string
  dataPlanejada: string
  horaInicio: string
  duracaoPlanejadaMinutos: number
}

export interface UnallocatedActivity {
  demandaAcademicaId: number | null
  tarefaDemandaId: number | null
  titulo: string
  motivo: number | string
  descricao: string
}

export interface PlanningData {
  inicioSemana: string
  agora: string
  propostaId: string
  alocacoes: PlannedAllocation[]
  naoAlocadas: UnallocatedActivity[]
}

export interface CreatedSession {
  id: number
}

export interface ConfirmationData {
  sessoesCriadas: CreatedSession[]
}

export type PreviewState =
  | { status: 'idle' | 'loading'; data: null; error: null }
  | { status: 'error'; data: null; error: string }
  | { status: 'success' | 'confirmed'; data: PlanningData; error: null }

export type ConfirmState =
  | { status: 'idle' | 'loading'; data: null; error: null }
  | { status: 'error'; data: null; error: string; canRetry: boolean }
  | { status: 'success'; data: ConfirmationData; error: null }

export interface PlanningPreviewProps {
  previewState: PreviewState
  confirmState: ConfirmState
  isConfirming: boolean
  isCreatingDemand: boolean
  isCreatingAvailability: boolean
  isUpdatingDemand: boolean
  isCreatingTask: boolean
  isUpdatingTask: boolean
  clearPreview: () => void
  confirmPreview: () => void
  generatePreview: () => void
}

type IconName = 'calendar' | 'check' | 'clock' | 'alert'

export interface IconProps {
  name: IconName
  size?: number
}

function Icon({ name, size = 18 }: IconProps) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  }

  const shapes = {
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    alert: <><path d="m10.3 3.9-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.1l-8-14a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4m0 4h.01" /></>,
  }

  return <svg {...common}>{shapes[name]}</svg>
}

export default function PlanningPreview({
  previewState,
  confirmState,
  isConfirming,
  isCreatingDemand,
  isCreatingAvailability,
  isUpdatingDemand,
  isCreatingTask,
  isUpdatingTask,
  clearPreview,
  confirmPreview,
  generatePreview,
}: PlanningPreviewProps) {
  return (
    <section className="next-step-panel planning-panel">
      <div className="next-step-top">
        <span className="next-step-icon"><Icon name="calendar" size={18} /></span>
        <span className="next-step-label">PLANEJAMENTO DA SEMANA</span>
      </div>
      <div className="planning-heading-row">
        <h2>Seu plano da semana</h2>
        {previewState.status === 'success' && <span className="preview-badge">Prévia não salva</span>}
        {previewState.status === 'confirmed' && <span className="confirmed-badge">Confirmado</span>}
      </div>

      {previewState.status === 'idle' && (
        <>
          <p>Gere uma proposta com base nas demandas, nos horários disponíveis e nas sessões já existentes. Você revisa antes de salvar.</p>
          <div className="next-step-footnote"><Icon name="check" size={15} /> Gerar a prévia não cria sessões.</div>
        </>
      )}

      {previewState.status === 'loading' && (
        <div className="planning-progress" role="status">
          <span className="planning-spinner" />
          <div><strong>Calculando uma semana possível</strong><p>A API está cruzando suas demandas, disponibilidades e sessões existentes.</p></div>
        </div>
      )}

      {previewState.status === 'error' && (
        <div className="status-message status-message-compact" role="alert">
          <span className="status-icon"><Icon name="alert" size={18} /></span>
          <div className="status-copy">
            <strong>
              {previewState.error.includes(
                'não foi possível verificar se o planejamento foi salvo',
              )
                ? 'Resultado da confirmação desconhecido'
                : previewState.error.includes('desatualizada') ||
                    previewState.error.includes('conflito')
                  ? 'Prévia desatualizada'
                  : 'Não foi possível obter uma prévia'}
            </strong>
            <p>
              {confirmState.status === 'error' && confirmState.error
                ? `${previewState.error} ${confirmState.error}`
                : previewState.error}
            </p>
            <button className="text-button" onClick={generatePreview} disabled={isUpdatingDemand || isCreatingTask || isUpdatingTask}>Tentar novamente</button>
          </div>
        </div>
      )}

      {(previewState.status === 'success' || previewState.status === 'confirmed') && (
        <>
          <p className="planning-intro">Confira o que cabe na semana de {formatWeekRange(parseIsoDate(previewState.data.inicioSemana))}. As atividades sem horário continuam listadas abaixo, com o motivo.</p>
          {previewState.data.alocacoes.length === 0 ? (
            <div className="planning-empty"><strong>Nenhuma sessão sugerida</strong><p>Não há atividades que possam ser alocadas nos horários disponíveis desta semana.</p></div>
          ) : (
            <>
            <div className="planned-total"><span>Sessões sugeridas</span><strong>{previewState.data.alocacoes.length} · {formatMinutes(previewState.data.alocacoes.reduce((total, session) => total + session.duracaoPlanejadaMinutos, 0))}</strong></div>
            <div className="planned-session-list">
              {previewState.data.alocacoes.map((session, index) => (
                <article className="planned-session-card" key={`${session.dataPlanejada}-${session.horaInicio}-${session.demandaAcademicaId ?? 'd'}-${session.tarefaDemandaId ?? 't'}-${index}`}>
                  <div className="planned-session-date"><span>{new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(parseIsoDate(session.dataPlanejada)).replace('.', '')}</span><strong>{String(parseIsoDate(session.dataPlanejada).getDate()).padStart(2, '0')}</strong></div>
                  <div className="planned-session-main"><strong>{session.titulo}</strong><span><Icon name="clock" size={13} /> {session.horaInicio.slice(0, 5)}–{formatClockEnd(session.horaInicio, session.duracaoPlanejadaMinutos)} · {formatMinutes(session.duracaoPlanejadaMinutos)}</span></div>
                </article>
              ))}
            </div>
            </>
          )}

          {previewState.data.naoAlocadas.length > 0 && (
            <div className="unallocated-section">
              <div className="unallocated-heading"><strong>Atividades não alocadas</strong><span>{previewState.data.naoAlocadas.length}</span></div>
              {previewState.data.naoAlocadas.map((item, index) => (
                <article className="unallocated-card" key={`${item.demandaAcademicaId ?? 'd'}-${item.tarefaDemandaId ?? 't'}-${item.titulo}-${index}`}>
                  <div><strong>{item.titulo}</strong><span className="unallocated-reason">{reasonLabel(item.motivo)}</span></div>
                  <p>{item.descricao}</p>
                </article>
              ))}
            </div>
          )}

          {confirmState.status === 'error' && (
            <div className="status-message status-message-compact" role="alert">
              <span className="status-icon"><Icon name="alert" size={18} /></span>
              <div className="status-copy">
                <strong>O planejamento não foi confirmado</strong>
                <p>{confirmState.error}</p>
                {confirmState.canRetry && (
                  <button className="text-button" onClick={confirmPreview}>Tentar novamente</button>
                )}
              </div>
            </div>
          )}

          {previewState.status === 'confirmed' && confirmState.status === 'success' && (
            <div className="confirmation-success" role="status">
              <span className="confirmation-icon"><Icon name="check" size={16} /></span>
              <div><strong>Planejamento confirmado</strong><p>{confirmState.data.sessoesCriadas.length} {confirmState.data.sessoesCriadas.length === 1 ? 'sessão foi salva' : 'sessões foram salvas'} como sessões planejadas.</p></div>
            </div>
          )}

          {previewState.status === 'success' && (
            <div className="planning-actions">
              <button className="button button-secondary" onClick={clearPreview} disabled={isConfirming || isUpdatingDemand || isCreatingTask || isUpdatingTask}>Descartar prévia</button>
              <button className="button button-primary confirm-button" onClick={confirmPreview} disabled={isConfirming || isCreatingDemand || isCreatingAvailability || isUpdatingDemand || isCreatingTask || isUpdatingTask || (confirmState.status === 'error' && !confirmState.canRetry) || previewState.data.alocacoes.length === 0}>
                {isConfirming ? 'Confirmando…' : 'Confirmar planejamento'}
              </button>
            </div>
          )}
          {previewState.status === 'confirmed' && (
            <button className="button button-secondary planning-regenerate" onClick={clearPreview} disabled={isUpdatingDemand || isCreatingTask || isUpdatingTask}>Gerar outra prévia</button>
          )}
        </>
      )}
    </section>
  )
}
