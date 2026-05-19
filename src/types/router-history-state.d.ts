import '@tanstack/react-router'

declare module '@tanstack/react-router' {
  interface HistoryState {
    password?: string
    fromSignUp?: boolean
  }
}
