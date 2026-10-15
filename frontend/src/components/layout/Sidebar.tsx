import { NavLink, useLocation } from 'react-router-dom'
import { cn } from '@/utils/helpers'
import {
  LayoutDashboard,
  Briefcase,
  Users,
  CheckSquare,
  Calendar,
  BarChart3,
  UserRound,
  Building2,
  Settings,
  Kanban,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  X,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import type { Role } from '@/types'

const ALL: Role[] = ['ADMIN', 'RECRUITER', 'PLATFORM_ADMIN']
const ADMINS: Role[] = ['ADMIN', 'PLATFORM_ADMIN']

const sections = [
  {
    label: 'Main',
    items: [{ label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ALL }],
  },
  {
    label: 'Recruitment',
    items: [
      { label: 'Jobs', href: '/jobs', icon: Briefcase, roles: ALL },
      { label: 'Candidates', href: '/candidates', icon: Users, roles: ALL },
      { label: 'Pipeline', href: '/pipeline', icon: Kanban, roles: ALL },
      { label: 'Assessments', href: '/assessments', icon: CheckSquare, roles: ALL },
      { label: 'Interviews', href: '/interviews', icon: Calendar, roles: ALL },
    ],
  },
  {
    label: 'Insights',
    items: [{ label: 'Analytics', href: '/analytics', icon: BarChart3, roles: ADMINS }],
  },
  {
    label: 'Workspace',
    items: [
      { label: 'Team', href: '/team', icon: UserRound, roles: ADMINS },
      { label: 'Company', href: '/company', icon: Building2, roles: ADMINS },
      { label: 'Settings', href: '/settings', icon: Settings, roles: ALL },
    ],
  },
]

interface SidebarProps {
  collapsed?: boolean
  mobileOpen?: boolean
  onToggle?: () => void
  onCloseMobile?: () => void
}

export function Sidebar({ collapsed = false, mobileOpen = false, onToggle, onCloseMobile }: SidebarProps) {
  const location = useLocation()
  const { user, hasRole } = useAuth()

  // On mobile the drawer is always full width; collapse only applies from lg up.
  const compact = collapsed

  const isActive = (href: string) =>
    location.pathname === href || (href !== '/dashboard' && location.pathname.startsWith(href))

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-[190] bg-black/40 lg:hidden" onClick={onCloseMobile} aria-hidden="true" />
      )}
      <aside
        className={cn(
          'fixed left-0 top-0 z-[200] flex h-screen flex-col border-r border-[var(--color-border)] bg-[var(--color-sidebar)] transition-all duration-300',
          'w-64 -translate-x-full lg:translate-x-0',
          mobileOpen && 'translate-x-0',
          compact ? 'lg:w-[76px]' : 'lg:w-64'
        )}
        aria-label="Sidebar navigation"
      >
        <div className={cn('flex h-16 items-center px-4', compact ? 'lg:justify-center' : 'justify-between')}>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent-500 to-brand-500 shadow-accent">
              <Sparkles className="h-5 w-5 text-white" aria-hidden="true" />
            </span>
            <span className={cn('text-heading-md font-extrabold text-ink-900 dark:text-ink-100', compact && 'lg:hidden')}>
              NexHire
            </span>
          </div>
          <button
            onClick={onCloseMobile}
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-ink-500 hover:bg-base-100 dark:hover:bg-surface-dark-elevated lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Main navigation">
          {sections.map((section) => {
            const items = section.items.filter((i) => user && hasRole(i.roles))
            if (items.length === 0) return null
            return (
              <div key={section.label} className="mt-4 first:mt-2">
                <p className={cn('mb-1.5 px-3 text-label-xs font-semibold uppercase tracking-wider text-ink-400', compact && 'lg:hidden')}>
                  {section.label}
                </p>
                <div className="space-y-0.5">
                  {items.map((item) => {
                    const Icon = item.icon
                    const active = isActive(item.href)
                    return (
                      <NavLink
                        key={item.href}
                        to={item.href}
                        onClick={onCloseMobile}
                        title={compact ? item.label : undefined}
                        className={cn('nav-item', active && 'nav-item-active', compact && 'lg:justify-center lg:px-0')}
                        aria-current={active ? 'page' : undefined}
                      >
                        <Icon className="nav-item-icon" aria-hidden="true" />
                        <span className={cn(compact && 'lg:hidden')}>{item.label}</span>
                      </NavLink>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </nav>

        <div className="space-y-2 border-t border-[var(--color-border)] p-3">
          <button
            onClick={onToggle}
            className={cn('nav-item hidden w-full lg:flex', compact && 'lg:justify-center lg:px-0')}
            aria-label={compact ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {compact ? <PanelLeftOpen className="nav-item-icon" /> : <PanelLeftClose className="nav-item-icon" />}
            <span className={cn(compact && 'lg:hidden')}>Collapse</span>
          </button>

          <div className={cn('flex items-center gap-3 rounded-xl bg-base-50 p-2.5 dark:bg-surface-dark-elevated', compact && 'lg:justify-center lg:p-1.5')}>
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-400 to-brand-500 text-label-md font-bold text-white">
              {user?.userName?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className={cn('min-w-0 flex-1', compact && 'lg:hidden')}>
              <p className="truncate text-label-md font-semibold text-ink-900 dark:text-ink-100">{user?.userName || 'User'}</p>
              <p className="truncate text-body-xs capitalize text-ink-500 dark:text-ink-400">
                {user?.role?.replace('_', ' ').toLowerCase() || 'role'}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
