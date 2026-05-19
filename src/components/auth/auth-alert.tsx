type AuthAlertProps = {
  message: string
}

export function AuthAlert({ message }: AuthAlertProps) {
  if (!message) return null

  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-lg bg-error-container/50 p-3.5 font-body text-xs text-on-error-container"
    >
      <span className="material-symbols-outlined text-lg" aria-hidden>
        error
      </span>
      <p className="m-0">{message}</p>
    </div>
  )
}

export function AuthSuccessAlert({ message }: AuthAlertProps) {
  if (!message) return null

  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-lg bg-primary-container/30 p-3.5 font-body text-xs text-on-surface"
    >
      <span className="material-symbols-outlined text-lg text-primary" aria-hidden>
        check_circle
      </span>
      <p className="m-0">{message}</p>
    </div>
  )
}
