import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  Briefcase,
  Building2,
  Calendar,
  CheckSquare,
  ChevronsUpDown,
  Kanban,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/utils/helpers'
import type { Role } from '@/types'
import { Wordmark } from './Wordmark'

const ALL: Role[] = ['ADMIN', 'RECRUITER', 'PLATFORM_ADMIN']
const ADMINS: Role[] = ['ADMIN', 'PLATFORM_ADMIN']

const SECTIONS = [
  {
    label: 'Overview',
    items: [{ label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ALL }],
  },
  {
    label: 'Hiring',
    items: [
      { label: 'Jobs', href: '/jobs', icon: Briefcase, roles: ALL },
      { label: 'Candidates', href: '/candidates', icon: Users, roles: ALL },
      { label: 'Pipeline', href: '/pipeline', icon: Kanban, roles: ALL },
      { label: 'Interviews', href: '/interviews', icon: Calendar, roles: ALL },
      { label: 'Assessments', href: '/assessments', icon: CheckSquare, roles: ALL },
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
    ],
  },
]

interface SidebarProps {
  collapsed: boolean
  mobileOpen: boolean
  onToggle: () => void
  onCloseMobile: () => void
}

export function Sidebar({ collapsed, mobileOpen, onToggle, onCloseMobile }: SidebarProps) {
  const { user, hasRole, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  useEffect(() => setMenuOpen(false), [location.pathname])

  const isActive = (href: string) => location.pathname === href || (href !== '/dashboard' && location.pathname.startsWith(href))

  const signOut = async () => {
    setMenuOpen(false)
    await logout()
    navigate('/login', { replace: true })
  }

  const initial = user?.userName?.charAt(0).toUpperCase() || 'U'
  const roleLabel = user?.role?.replace('_', ' ').toLowerCase() || ''
  // The collapsed rail only applies from lg up; the mobile drawer is always full width.
  const rail = collapsed

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-[190] bg-black/50 lg:hidden" onClick={onCloseMobile} aria-hidden="true" />}

      <aside
        aria-label="Sidebar"
        className={cn(
          'frosted fixed left-0 top-0 z-[200] flex h-screen w-72 flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] transition-[transform,width] duration-200 max-lg:!bg-[var(--color-surface)]',
          '-translate-x-full lg:translate-x-0',
          mobileOpen && 'translate-x-0',
          rail ? 'lg:w-[76px]' : 'lg:w-64'
        )}
      >
        <div className={cn('flex h-16 flex-shrink-0 items-center px-4', rail ? 'lg:justify-center lg:px-0' : 'justify-between')}>
          <Link to="/dashboard" aria-label="NexHire home" className="text-ink-900 dark:text-ink-100">
            <Wordmark showText={!rail} className={rail ? 'lg:gap-0' : undefined} />
          </Link>
          <button
            onClick={onCloseMobile}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-ink-700 hover:bg-[var(--sidebar-hover)] dark:text-ink-200 lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Main navigation">
          {SECTIONS.map((section) => {
            const items = section.items.filter((i) => user && hasRole(i.roles))
            if (items.length === 0) return null
            return (
              <div key={section.label} className="mt-5 first:mt-2">
                <p className={cn('mb-1.5 px-3 text-body-xs font-semibold', rail && 'lg:sr-only')} style={{ color: 'var(--sidebar-muted)' }}>
                  {section.label}
                </p>
                <ul className="space-y-0.5">
                  {items.map((item) => {
                    const Icon = item.icon
                    const active = isActive(item.href)
                    return (
                      <li key={item.href}>
                        <NavLink
                          to={item.href}
                          onClick={onCloseMobile}
                          title={rail ? item.label : undefined}
                          aria-label={rail ? item.label : undefined}
                          aria-current={active ? 'page' : undefined}
                          className={cn('nav-item', active && 'nav-item-active', rail && 'lg:justify-center lg:px-0')}
                        >
                          <Icon className="nav-item-icon" aria-hidden="true" />
                          <span className={cn(rail && 'lg:hidden')}>{item.label}</span>
                        </NavLink>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </nav>

        <div className="flex-shrink-0 space-y-1 border-t border-[var(--sidebar-border)] px-3 py-3">
          <button
            onClick={onToggle}
            className={cn('nav-item hidden lg:flex', rail && 'lg:justify-center lg:px-0')}
            aria-label={rail ? 'Expand sidebar' : 'Collapse sidebar'}
            title={rail ? 'Expand sidebar' : undefined}
          >
            {rail ? <PanelLeftOpen className="nav-item-icon" /> : <PanelLeftClose className="nav-item-icon" />}
            <span className={cn(rail && 'lg:hidden')}>Collapse</span>
          </button>

          <button
            onClick={signOut}
            className={cn('nav-item', rail && 'lg:justify-center lg:px-0')}
            aria-label="Sign out"
            title={rail ? 'Sign out' : undefined}
          >
            <LogOut className="nav-item-icon" aria-hidden="true" />
            <span className={cn(rail && 'lg:hidden')}>Sign out</span>
          </button>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              aria-label="Account menu"
              className={cn(
                'flex w-full cursor-pointer items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-[var(--sidebar-hover)]',
                rail && 'lg:justify-center lg:p-1.5'
              )}
            >
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-500 text-label-md font-bold text-[#1c1917]">{initial}</span>
              <span className={cn('min-w-0 flex-1', rail && 'lg:hidden')}>
                <span className="block truncate text-body-sm font-semibold text-ink-900 dark:text-ink-100">{user?.userName}</span>
                <span className="block truncate text-body-xs capitalize" style={{ color: 'var(--sidebar-muted)' }}>{roleLabel}</span>
              </span>
              <ChevronsUpDown className={cn('h-4 w-4 flex-shrink-0 opacity-60', rail && 'lg:hidden')} aria-hidden="true" />
            </button>

            {menuOpen && (
              <div className={cn('dropdown-menu absolute bottom-full mb-2 w-64 text-ink-900 dark:text-ink-100', rail ? 'lg:left-0' : 'left-0')}>
                <div className="px-3 py-2.5">
                  <p className="truncate text-body-sm font-semibold">{user?.userName}</p>
                  <p className="truncate text-body-xs text-ink-600 dark:text-ink-400">{user?.email}</p>
                </div>
                <div className="dropdown-divider" />
                <Link to="/settings" className="dropdown-item">
                  <Settings className="h-4 w-4" aria-hidden="true" />
                  Settings
                </Link>
                <button onClick={signOut} className="dropdown-item cursor-pointer">
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}
