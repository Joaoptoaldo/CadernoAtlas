import Icon from './Icon'
import type { IconName } from './Icon'

type EmptyStateIconName = IconName

interface EmptyStateProps {
  title: string
  description: string
  icon?: EmptyStateIconName
  action?: React.ReactNode
}

export default function EmptyState({ title, description, icon = 'empty', action }: EmptyStateProps) {
  return (
    <div className="empty-state d-flex flex-column align-items-center text-center py-4" role="status" aria-live="polite">
      {icon && (
        <span className="empty-state-icon d-inline-flex mb-3" aria-hidden="true">
          <Icon name={icon} size={48} strokeWidth={1.5} />
        </span>
      )}
      <h3 className="empty-state-title mb-2">{title}</h3>
      <p className="empty-state-description text-muted mb-3" style={{ maxWidth: '285px' }}>
        {description}
      </p>
      {action && (
        <div className="empty-state-action mt-2">{action}</div>
      )}
    </div>
  )
}