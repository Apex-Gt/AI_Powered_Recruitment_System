import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Bell, LogOut, Menu, Moon, Plus, Search, Settings, Sun } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { CommandSearch } from './CommandSearch'

const iconBtn =
  'flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-[var(--color-border-hover)] bg-[var(--color-surface)] text-ink-700 transition-colors hover:bg-base-50 dark:text-ink-200 dark:hover:bg-surface-dark-elevated'

export function TopBar({ onMenu }: { onMenu: () => void }) {
  const { user, hasRole, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { resolvedTheme, setTheme } = useTheme()
  const [searchOpen, setSearchOpen] = useState(false)
  const [bellOpen, setBellOpen] = useState(false)
  const bellRef = useRef<HTMLDivElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen((o) => !o)
      }
      if (e.key === 'Escape') {
        setBellOpen(false)
        setMenuOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!bellOpen) return
    const onClick = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [bellOpen])

  useEffect(() => {
    if (!menuOpen) return
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [menuOpen])

  useEffect(() => setMenuOpen(false), [location.pathname])

  const signOut = async () => {
    setMenuOpen(false)
    await logout()
    navigate('/login', { replace: true })
  }

  const initial = user?.userName?.charAt(0).toUpperCase() || 'U'
  const roleLabel = user?.role?.replace('_', ' ').toLowerCase() || ''

  return (
    <header className="frosted sticky top-0 z-[150] flex h-16 items-center gap-3 border-b border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-bg)_80%,transparent)] px-4 sm:px-6 lg:px-10">
      <button onClick={onMenu} className={`${iconBtn} lg:hidden`} aria-label="Open menu">
        <Menu className="h-5 w-5" />
      </button>

      <button
        onClick={() => setSearchOpen(true)}
        className="flex h-10 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-full border border-[var(--color-border-hover)] bg-[var(--color-surface)] px-3 text-left text-body-sm text-ink-600 transition-colors hover:bg-base-50 sm:max-w-sm dark:text-ink-400 dark:hover:bg-surface-dark-elevated"
        aria-label="Go to a page (Ctrl+K)"
      >
        <Search className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
        <span className="flex-1 truncate">Go to a page</span>
        <kbd className="hidden rounded border border-[var(--color-border-hover)] px-1.5 text-label-xs sm:block">Ctrl K</kbd>
      </button>

      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          className={iconBtn}
          aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {resolvedTheme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>

        <div className="relative" ref={bellRef}>
          <button onClick={() => setBellOpen((o) => !o)} className={iconBtn} aria-label="Notifications" aria-expanded={bellOpen}>
            <Bell className="h-5 w-5" />
          </button>
          {bellOpen && (
            <div className="dropdown-menu absolute right-0 top-12 w-72 p-5 text-center">
              <p className="text-body-sm font-semibold text-ink-900 dark:text-ink-100">Nothing new</p>
              <p className="mt-1 text-body-xs text-ink-600 dark:text-ink-400">Updates about your jobs and candidates will show up here.</p>
            </div>
          )}
        </div>

        {hasRole(['ADMIN', 'RECRUITER']) && !location.pathname.startsWith('/jobs') && (
          <Link to="/jobs/create" className="btn-primary hidden h-10 py-0 no-underline sm:inline-flex">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Create job
          </Link>
        )}

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-label="Account menu"
            className="flex h-10 cursor-pointer items-center gap-2 rounded-full border border-[var(--color-border-hover)] bg-[var(--color-surface)] py-0 pl-1 pr-1 transition-colors hover:bg-base-50 sm:pr-3 dark:hover:bg-surface-dark-elevated"
          >
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-500 text-label-md font-bold text-[#1c1917]">{initial}</span>
            <span className="hidden min-w-0 text-left sm:block">
              <span className="block max-w-[120px] truncate text-body-sm font-semibold leading-tight text-ink-900 dark:text-ink-100">{user?.userName}</span>
              <span className="block text-label-xs capitalize leading-tight text-ink-600 dark:text-ink-400">{roleLabel}</span>
            </span>
          </button>
          {menuOpen && (
            <div className="dropdown-menu absolute right-0 top-12 w-64 text-ink-900 dark:text-ink-100">
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

      <CommandSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  )
}
