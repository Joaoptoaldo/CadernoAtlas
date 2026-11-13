import { type ReactNode } from 'react'

interface FieldErrorProps {
  id: string
  message: ReactNode
}

export default function FieldError({ id, message }: FieldErrorProps) {
  return <div id={id} className="invalid-feedback">{message}</div>
}