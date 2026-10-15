import { useState } from 'react'
import { Outlet, Navigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/utils/helpers'

export function Layout() {
  const { isAuthenticated, isLoading, connectionError, retryAuth } = useAuth()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)]">
        <div className="spinner spinner-lg" />
      </div>
    )
  }

  if (!isAuthenticated && connectionError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[var(--color-bg)] text-center px-6">
        <p className="text-body-md text-ink-700 dark:text-ink-300">
          Can't reach the server right now. Your session hasn't been ended.
        </p>
        <button className="btn-primary" onClick={() => retryAuth()}>Retry</button>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[var(--color-bg)]">
      <Sidebar
        collapsed={sidebarCollapsed}
        mobileOpen={mobileOpen}
        onToggle={() => setSidebarCollapsed((c) => !c)}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div
        className={cn(
          'transition-all duration-300 min-w-0',
          sidebarCollapsed ? 'lg:pl-[76px]' : 'lg:pl-64'
        )}
      >
        <Header onMenu={() => setMobileOpen(true)} />
        <main className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}