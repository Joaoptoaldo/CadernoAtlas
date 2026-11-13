import ConfirmActionModal from '../../components/ui/ConfirmActionModal'
import type { StudySessionTransition } from './studySessionTypes'

interface SessionConfirmModalProps {
  open: boolean
  type: 'delete' | 'transition'
  transition?: StudySessionTransition
  onConfirm: () => void
  onCancel: () => void
  busy?: boolean
}

export default function SessionConfirmModal({
  open,
  type,
  transition,
  onConfirm,
  onCancel,
  busy = false,
}: SessionConfirmModalProps) {
  const title = type === 'delete' ? 'Excluir sessão de estudo' : 'Confirmar transição'

  const message = type === 'delete'
    ? 'Excluir esta sessão de estudo planejada? Esta ação não pode ser desfeita.'
    : transition === 'cancelar'
    ? 'Cancelar esta sessão de estudo? Ela será marcada como cancelada.'
    : 'Concluir esta sessão de estudo?'

  const confirmLabel = type === 'delete' ? 'Excluir' : 'Confirmar'
  const confirmVariant = type === 'delete' ? 'danger' : 'primary'

  if (!open) return null

  return (
    <ConfirmActionModal
      open={open}
      title={title}
      message={message}
      confirmLabel={confirmLabel}
      confirmVariant={confirmVariant}
      onConfirm={onConfirm}
      onCancel={onCancel}
      busy={busy}
    />
  )
}