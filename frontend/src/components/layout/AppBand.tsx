import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  Bell,
  Briefcase,
  Building2,
  Calendar,
  CheckSquare,
  ChevronDown,
  Kanban,
  LayoutDashboard,
  LogOut,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
  UserRound,
  Users,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { cn } from '@/utils/helpers'
import type { Role } from '@/types'
import { CommandSearch } from './CommandSearch'

const ALL: Role[] = ['ADMIN', 'RECRUITER', 'PLATFORM_ADMIN']
const ADMINS: Role[] = ['ADMIN', 'PLATFORM_ADMIN']

const NAV = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ALL },
  { label: 'Jobs', href: '/jobs', icon: Briefcase, roles: ALL },
  { label: 'Candidates', href: '/candidates', icon: Users, roles: ALL },
  { label: 'Pipeline', href: '/pipeline', icon: Kanban, roles: ALL },
  { label: 'Interviews', href: '/interviews', icon: Calendar, roles: ALL },
  { label: 'Assessments', href: '/assessments', icon: CheckSquare, roles: ALL },
  { label: 'Analytics', href: '/analytics', icon: BarChart3, roles: ADMINS },
  { label: 'Team', href: '/team', icon: UserRound, roles: ADMINS },
  { label: 'Company', href: '/company', icon: Building2, roles: ADMINS },
]

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-display text-[1.375rem] font-extrabold tracking-tight', className)}>
      <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
        <path d="M4 20C4 10 10 4 20 4c0 10-6 16-16 16Z" fill="#dda15e" />
        <path d="M4 20 15 9" stroke="#283618" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      </svg>
      NexHire
    </span>
  )
}

const bandButton =
  'flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[rgba(254,250,224,0.22)] px-2.5 text-[#fefae0] transition-colors hover:bg-[rgba(254,250,224,0.1)]'

export function AppBand() {
  const { user, hasRole, logout } = useAuth()
  const { resolvedTheme, setTheme } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchOpen, setSearchOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [bellOpen, setBellOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const bellRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen((o) => !o)
      }
      if (e.key === 'Escape') {
        setMenuOpen(false)
        setBellOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!menuOpen && !bellOpen) return
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [menuOpen, bellOpen])

  useEffect(() => {
    setMenuOpen(false)
    setBellOpen(false)
  }, [location.pathname])

  const isActive = (href: string) =>
    location.pathname === href || (href !== '/dashboard' && location.pathname.startsWith(href))

  const signOut = async () => {
    setMenuOpen(false)
    await logout()
    navigate('/login', { replace: true })
  }

  const initial = user?.userName?.charAt(0).toUpperCase() || 'U'
  const roleLabel = user?.role?.replace('_', ' ').toLowerCase() || ''

  return (
    <header
      className="sticky top-0 z-[150] border-b"
      style={{ backgroundColor: 'var(--color-band)', borderColor: 'var(--color-band-border)' }}
    >
      <div className="mx-auto flex h-14 max-w-[1320px] items-center gap-3 px-4 sm:px-6 lg:px-10">
        <Link to="/dashboard" className="text-[#fefae0]" aria-label="NexHire home">
          <Wordmark />
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setSearchOpen(true)} className={cn(bandButton, 'sm:w-48 sm:justify-start sm:px-3')} aria-label="Go to a page (Ctrl+K)">
            <Search className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
            <span className="hidden flex-1 text-left text-body-sm opacity-80 sm:block">Go to page</span>
            <kbd className="hidden rounded border border-[rgba(254,250,224,0.3)] px-1 text-label-xs opacity-80 lg:block">Ctrl K</kbd>
          </button>

          <button
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className={cn(bandButton, 'w-9')}
            aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <div className="relative" ref={bellRef}>
            <button onClick={() => setBellOpen((o) => !o)} className={cn(bandButton, 'w-9')} aria-label="Notifications" aria-expanded={bellOpen}>
              <Bell className="h-4 w-4" />
            </button>
            {bellOpen && (
              <div className="dropdown-menu absolute right-0 top-11 w-72 p-5 text-center">
                <p className="text-body-sm font-semibold text-ink-900 dark:text-ink-100">Nothing new</p>
                <p className="mt-1 text-body-xs text-ink-600 dark:text-ink-400">Updates about your jobs and candidates will show up here.</p>
              </div>
            )}
          </div>

          {hasRole(['ADMIN', 'RECRUITER']) && (
            <Link
              to="/jobs/create"
              className="hidden h-9 items-center gap-1.5 rounded-lg px-3.5 text-body-sm font-semibold transition-colors sm:inline-flex"
              style={{ backgroundColor: '#dda15e', color: '#283618' }}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create job
            </Link>
          )}

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className={cn(bandButton, 'gap-2 pl-1.5 pr-2')}
              aria-label="Account menu"
              aria-expanded={menuOpen}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full text-label-xs font-bold" style={{ backgroundColor: '#dda15e', color: '#283618' }}>
                {initial}
              </span>
              <ChevronDown className="h-3.5 w-3.5 opacity-80" aria-hidden="true" />
            </button>
            {menuOpen && (
              <div className="dropdown-menu absolute right-0 top-11 w-64">
                <div className="px-3 py-2.5">
                  <p className="truncate text-body-sm font-semibold text-ink-900 dark:text-ink-100">{user?.userName}</p>
                  <p className="truncate text-body-xs text-ink-600 dark:text-ink-400">{user?.email}</p>
                  <p className="mt-0.5 text-body-xs capitalize text-ink-600 dark:text-ink-400">{roleLabel}</p>
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
      </div>

      <nav aria-label="Main navigation" className="border-t" style={{ borderColor: 'var(--color-band-border)' }}>
        <div className="scrollbar-hide mx-auto flex max-w-[1320px] gap-0.5 overflow-x-auto px-1 sm:px-3 lg:px-7">
          {NAV.filter((item) => user && hasRole(item.roles)).map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <NavLink
                key={item.href}
                to={item.href}
                className={cn('nav-item', active && 'nav-item-active')}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="nav-item-icon" aria-hidden="true" />
                {item.label}
              </NavLink>
            )
          })}
        </div>
      </nav>

      <CommandSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  )
}
