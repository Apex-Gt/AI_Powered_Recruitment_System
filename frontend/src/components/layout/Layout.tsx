import { Outlet, Navigate, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/utils/helpers'

export function Layout() {
  const location = useLocation()
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-100 dark:bg-base-950">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-accent-500 border-t-transparent" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="min-h-screen bg-base-100 dark:bg-base-950">
      <Sidebar />
      <div
        className={cn(
          'transition-all duration-300',
          'lg:pl-64'
        )}
      >
        <header className="sticky top-0 z-sticky h-16 bg-base-100/80 dark:bg-base-950/80 backdrop-blur-sm border-b border-base-200 dark:border-base-700 shadow-neo-1">
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