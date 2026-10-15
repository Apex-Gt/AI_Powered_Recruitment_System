import { useState } from 'react'
import { Outlet, Navigate, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/utils/helpers'

export function Layout() {
  const location = useLocation()
  const { isAuthenticated, isLoading, connectionError, retryAuth } = useAuth()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

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
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((c) => !c)} />
      <div
        className={cn(
          'transition-all duration-300 min-w-0',
          sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-64'
        )}
      >
        <header className="sticky top-0 z-sticky h-16 bg-[var(--color-surface)] border-b border-[var(--color-border)] shadow-card-light dark:shadow-card-dark">
          <div className="h-full px-6 flex items-center justify-between">
            <h1 className="text-heading-lg font-semibold text-ink-900 dark:text-ink-100">
              {getPageTitle(location.pathname)}
            </h1>
          </div>
        </header>
        <main className="p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function getPageTitle(pathname: string): string {
  const titles: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/jobs': 'Jobs',
    '/jobs/create': 'Create Job',
    '/jobs/edit': 'Edit Job',
    '/candidates': 'Candidates',
    '/pipeline': 'Pipeline',
    '/assessments': 'Assessments',
    '/interviews': 'Interviews',
    '/analytics': 'Analytics',
    '/team': 'Team',
    '/company': 'Company',
    '/settings': 'Settings',
  }

  for (const [path, title] of Object.entries(titles)) {
    if (pathname === path || (path !== '/dashboard' && pathname.startsWith(path))) {
      return title
    }
  }
  return 'Dashboard'
}