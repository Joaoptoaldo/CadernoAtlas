interface ProcessingStateProps {
  message: string
  isActive: boolean
  ariaLabel?: string
}

export default function ProcessingState({
  message,
  isActive,
  ariaLabel,
}: ProcessingStateProps) {
  if (!isActive) return null

  const ariaLabelValue = ariaLabel ?? 'Salvando'

  return (
    <div
      className="d-flex align-items-center gap-2"
      role="status"
      aria-live="polite"
      aria-label={ariaLabelValue}
    >
      <div
        className="spinner-border spinner-border-sm text-primary"
        role="status"
        aria-hidden="true"
      >
        <span className="visually-hidden">{ariaLabelValue}</span>
      </div>
      <span className="text-muted small">{message}</span>
    </div>
  )
}