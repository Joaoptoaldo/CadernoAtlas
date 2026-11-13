import Icon from './Icon'

type StatusMessageVariant = 'danger' | 'warning'

interface StatusMessageProps {
  title: string
  description: string
  onRetry?: () => void
  compact?: boolean
  variant?: StatusMessageVariant
}

export default function StatusMessage({
  title,
  description,
  onRetry,
  compact = false,
  variant = 'danger',
}: StatusMessageProps) {
  const alertVariant = variant === 'warning' ? 'alert-warning' : 'alert-danger'
  const iconName = variant === 'warning' ? 'alert' : 'alert'

  return (
    <div
      className={`alert ${alertVariant} status-message ${compact ? 'status-message-compact' : ''}`}
      role="alert"
    >
      <span className="status-icon" aria-hidden="true">
        <Icon name={iconName} size={compact ? 16 : 18} />
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