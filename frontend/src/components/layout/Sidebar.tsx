import { NavLink, useLocation } from 'react-router-dom'
import { cn } from '@/utils/helpers'
import {
  LayoutDashboard,
  Briefcase,
  Users,
  FileText,
  CheckSquare,
  Calendar,
  BarChart3,
  UserRound,
  Building2,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import type { Role } from '@/types'

const navigation = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'RECRUITER', 'PLATFORM_ADMIN'] as Role[] },
  { label: 'Jobs', href: '/jobs', icon: Briefcase, roles: ['ADMIN', 'RECRUITER', 'PLATFORM_ADMIN'] as Role[] },
  { label: 'Candidates', href: '/candidates', icon: Users, roles: ['ADMIN', 'RECRUITER', 'PLATFORM_ADMIN'] as Role[] },
  { label: 'Resumes', href: '/resumes', icon: FileText, roles: ['ADMIN', 'RECRUITER', 'PLATFORM_ADMIN'] as Role[] },
  { label: 'Assessments', href: '/assessments', icon: CheckSquare, roles: ['ADMIN', 'RECRUITER', 'PLATFORM_ADMIN'] as Role[] },
  { label: 'Interviews', href: '/interviews', icon: Calendar, roles: ['ADMIN', 'RECRUITER', 'PLATFORM_ADMIN'] as Role[] },
  { label: 'Analytics', href: '/analytics', icon: BarChart3, roles: ['ADMIN', 'PLATFORM_ADMIN'] as Role[] },
  { label: 'Team', href: '/team', icon: UserRound, roles: ['ADMIN', 'PLATFORM_ADMIN'] as Role[] },
  { label: 'Company', href: '/company', icon: Building2, roles: ['ADMIN', 'PLATFORM_ADMIN'] as Role[] },
  { label: 'Settings', href: '/settings', icon: Settings, roles: ['ADMIN', 'RECRUITER', 'PLATFORM_ADMIN'] as Role[] },
]

interface SidebarProps {
  collapsed?: boolean
  onToggle?: () => void
}

export function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const location = useLocation()
  const { user, hasRole } = useAuth()
  const { theme, setTheme } = useTheme()

  const filteredNav = navigation.filter((item) => !item.roles || (user && hasRole(item.roles)))

  if (collapsed) {
    return (
      <aside
        className="fixed left-0 top-0 z-sticky h-screen w-16 glass-strong border-r border-glass-200 dark:border-glass-dark-200 flex flex-col transition-all duration-normal shadow-glass-2"
        aria-label="Sidebar navigation (collapsed)"
      >
        <div className="flex h-16 items-center justify-center border-b border-glass-200 dark:border-glass-dark-200">
          <span className="text-heading-md font-bold text-lavender-600 dark:text-lavender-400">RA</span>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto" aria-label="Main navigation">
          {filteredNav.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.href || (item.href !== '/dashboard' && location.pathname.startsWith(item.href))
            return (
              <NavLink
                key={item.href}
                to={item.href}
                className={cn(
                  'nav-item justify-center px-2',
                  isActive && 'nav-item-active'
                )}
                title={item.label}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className="nav-item-icon w-5 h-5 mx-auto" aria-hidden="true" />
              </NavLink>
            )
          })}
        </nav>
        <div className="p-2 border-t border-glass-200 dark:border-glass-dark-200">
          <button
            onClick={onToggle}
            className="nav-item justify-center px-2"
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <ChevronRight className="w-5 h-5 mx-auto" aria-hidden="true" />
          </button>
        </div>
      </aside>
    )
  }

  return (
    <aside
      className="fixed left-0 top-0 z-sticky h-screen w-64 glass-strong border-r border-glass-200 dark:border-glass-dark-200 flex flex-col transition-all duration-normal shadow-glass-2"
      aria-label="Sidebar navigation"
    >
      <div className="flex h-16 items-center justify-between px-4 border-b border-glass-200 dark:border-glass-dark-200">
        <span className="text-heading-md font-bold text-lavender-600 dark:text-lavender-400">RecruitAI</span>
        <button
          onClick={onToggle}
          className="nav-item-icon p-1 rounded-lg hover:bg-glass-200 dark:hover:bg-glass-dark-200"
          aria-label="Collapse sidebar"
        >
          <ChevronLeft className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Main navigation">
        {filteredNav.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.href || (item.href !== '/dashboard' && location.pathname.startsWith(item.href))
          return (
            <NavLink
              key={item.href}
              to={item.href}
              className={cn('nav-item', isActive && 'nav-item-active')}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="nav-item-icon" aria-hidden="true" />
              {item.label}
            </NavLink>
          )
        })}
      </nav>
      <div className="p-3 border-t border-glass-200 dark:border-glass-dark-200 space-y-3">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 rounded-full glass-lavender flex items-center justify-center flex-shrink-0">
            <span className="text-label-md font-medium text-lavender-600 dark:text-lavender-400">
              {user?.userName?.charAt(0).toUpperCase() || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-label-sm font-medium text-ink-900 dark:text-ink-100 truncate">{user?.userName || 'User'}</p>
            <p className="text-body-xs text-ink-500 dark:text-ink-400 capitalize">{user?.role?.toLowerCase() || 'role'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-2">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="nav-item flex-1 justify-start"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? (
              <Sun className="w-5 h-5" aria-hidden="true" />
            ) : (
              <Moon className="w-5 h-5" aria-hidden="true" />
            )}
            <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
        </div>
      </div>
    </aside>
  )
}