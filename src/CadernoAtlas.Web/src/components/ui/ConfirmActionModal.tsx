import { useEffect, useRef } from 'react'

interface ConfirmActionModalProps {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  confirmVariant: 'danger' | 'primary' | 'secondary'
  onConfirm: () => void
  onCancel: () => void
  busy?: boolean
}

export default function ConfirmActionModal({
  open,
  title,
  message,
  confirmLabel,
  confirmVariant,
  onConfirm,
  onCancel,
  busy = false,
}: ConfirmActionModalProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null)
  const confirmButtonRef = useRef<HTMLButtonElement>(null)
  const previousActiveElement = useRef<HTMLElement | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  // Focus trap and restore previous active element
  useEffect(() => {
    if (open) {
      previousActiveElement.current = document.activeElement as HTMLElement
      setTimeout(() => cancelButtonRef.current?.focus(), 0)
    } else if (previousActiveElement.current) {
      previousActiveElement.current.focus()
    }
  }, [open])

  // Escape key handler
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancel()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onCancel])

  // Focus trap: Tab / Shift+Tab
  useEffect(() => {
    if (!open || !modalRef.current) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return

      const focusableElements = modalRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )

      if (!focusableElements || focusableElements.length === 0) return

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]

      if (event.shiftKey) {
        // Shift + Tab: move to last element if on first
        if (document.activeElement === firstElement) {
          event.preventDefault()
          lastElement.focus()
        }
      } else {
        // Tab: move to first element if on last
        if (document.activeElement === lastElement) {
          event.preventDefault()
          firstElement.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open])

  if (!open) return null

  const variantClass = `btn-${confirmVariant}`

  return (
    <>
      <div className="modal-backdrop fade show" />
      <div
        ref={modalRef}
        className="modal fade show d-block"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-action-title"
        tabIndex={-1}
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 id="confirm-action-title" className="modal-title">
                {title}
              </h5>
              <button
                type="button"
                className="btn-close"
                aria-label="Fechar"
                onClick={onCancel}
              />
            </div>
            <div className="modal-body">
              <p style={{ whiteSpace: 'pre-wrap' }}>{message}</p>
            </div>
            <div className="modal-footer">
              <button
                ref={cancelButtonRef}
                type="button"
                className="btn btn-outline-secondary"
                onClick={onCancel}
                disabled={busy}
              >
                Cancelar
              </button>
              <button
                ref={confirmButtonRef}
                type="button"
                className={`btn ${variantClass}`}
                onClick={onConfirm}
                disabled={busy}
              >
                {busy ? 'Processando…' : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}