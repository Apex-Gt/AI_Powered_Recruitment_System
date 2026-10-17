import { Outlet, Navigate } from 'react-router-dom'
import { AppBand } from './AppBand'
import { useAuth } from '@/context/AuthContext'

export function Layout() {
  const { isAuthenticated, isLoading, connectionError, retryAuth } = useAuth()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)]">
        <div className="spinner spinner-lg" role="status" aria-label="Loading" />
      </div>
    )
  }

  if (!isAuthenticated && connectionError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--color-bg)] px-6 text-center">
        <h1 className="text-heading-lg text-ink-900 dark:text-ink-100">Can't reach the server</h1>
        <p className="max-w-sm text-body-md text-ink-600 dark:text-ink-300">
          You are still signed in. Check your connection, then try again.
        </p>
        <button className="btn-primary" onClick={() => retryAuth()}>Try again</button>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <AppBand />
      <main className="mx-auto w-full max-w-[1320px] min-w-0 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
        <Outlet />
      </main>
    </div>
  )
}
