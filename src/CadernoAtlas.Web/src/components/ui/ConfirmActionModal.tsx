import { useId, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

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

const focusableSelector = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

function isRestorable(element: HTMLElement | null): element is HTMLElement {
  return Boolean(
    element &&
    element.isConnected &&
    !element.hasAttribute('disabled') &&
    !element.closest('[aria-hidden="true"]')
  )
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
  const titleId = useId()
  const descriptionId = useId()

  useLayoutEffect(() => {
    if (!open) return

    if (!previousActiveElement.current && document.activeElement instanceof HTMLElement) {
      previousActiveElement.current = document.activeElement
    }

    const initialFocusTarget =
      cancelButtonRef.current && !cancelButtonRef.current.disabled
        ? cancelButtonRef.current
        : confirmButtonRef.current && !confirmButtonRef.current.disabled
          ? confirmButtonRef.current
          : modalRef.current

    initialFocusTarget?.focus()

    return () => {
      const elementToRestore = previousActiveElement.current
      previousActiveElement.current = null
      if (isRestorable(elementToRestore)) {
        elementToRestore.focus()
      }
    }
  }, [open])

  useLayoutEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (busy) return
        event.preventDefault()
        onCancel()
        return
      }

      if (event.key !== 'Tab') return

      const modal = modalRef.current
      if (!modal) return

      const focusableElements = Array.from(
        modal.querySelectorAll<HTMLElement>(focusableSelector)
      ).filter((element) => !element.closest('[aria-hidden="true"]'))

      if (focusableElements.length === 0) {
        event.preventDefault()
        modal.focus()
        return
      }

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]
      const activeElement = document.activeElement

      if (event.shiftKey && (activeElement === firstElement || !modal.contains(activeElement))) {
        event.preventDefault()
        lastElement.focus()
      } else if (!event.shiftKey && (activeElement === lastElement || !modal.contains(activeElement))) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [busy, onCancel, open])

  if (!open) return null

  const variantClass = `btn-${confirmVariant}`
  const modal = (
    <>
      <div className="modal-backdrop fade show" aria-hidden="true" />
      <div
        ref={modalRef}
        className="modal fade show d-block"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 id={titleId} className="modal-title">
                {title}
              </h5>
              <button
                type="button"
                className="btn-close"
                aria-label="Fechar"
                onClick={onCancel}
                disabled={busy}
              />
            </div>
            <div className="modal-body">
              <p id={descriptionId} style={{ whiteSpace: 'pre-wrap' }}>{message}</p>
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

  return createPortal(modal, document.body)
}
