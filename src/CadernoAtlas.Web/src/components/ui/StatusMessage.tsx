import Icon from './Icon'

interface StatusMessageProps {
  title: string
  description: string
  onRetry?: () => void
  compact?: boolean
}

export default function StatusMessage({
  title,
  description,
  onRetry,
  compact = false,
}: StatusMessageProps) {
  return (
    <div
      className={`status-message ${compact ? 'status-message-compact' : ''}`}
      role="alert"
    >
      <span className="status-icon">
        <Icon name="alert" size={18} />
      </span>

      <div className="status-copy">
        <strong>{title}</strong>
        <p>{description}</p>

        {onRetry && (
          <button className="text-button" onClick={onRetry}>
            Tentar novamente
          </button>
        )}
      </div>
    </div>
  )
}