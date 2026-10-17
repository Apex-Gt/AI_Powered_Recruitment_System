import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Menu, Moon, Plus, Search, Sun } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { CommandSearch } from './CommandSearch'

const iconBtn =
  'flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-[var(--color-border-hover)] bg-[var(--color-surface)] text-ink-700 transition-colors hover:bg-base-50 dark:text-ink-200 dark:hover:bg-surface-dark-elevated'

export function TopBar({ onMenu }: { onMenu: () => void }) {
  const { hasRole } = useAuth()
  const { resolvedTheme, setTheme } = useTheme()
  const [searchOpen, setSearchOpen] = useState(false)
  const [bellOpen, setBellOpen] = useState(false)
  const bellRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen((o) => !o)
      }
      if (e.key === 'Escape') setBellOpen(false)
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

  return (
    <header className="sticky top-0 z-[150] flex h-16 items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg)]/90 px-4 backdrop-blur sm:px-6 lg:px-10">
      <button onClick={onMenu} className={`${iconBtn} lg:hidden`} aria-label="Open menu">
        <Menu className="h-5 w-5" />
      </button>

      <button
        onClick={() => setSearchOpen(true)}
        className="flex h-10 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg border border-[var(--color-border-hover)] bg-[var(--color-surface)] px-3 text-left text-body-sm text-ink-600 transition-colors hover:bg-base-50 sm:max-w-sm dark:text-ink-400 dark:hover:bg-surface-dark-elevated"
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

        {hasRole(['ADMIN', 'RECRUITER']) && (
          <Link to="/jobs/create" className="btn-primary hidden h-10 py-0 no-underline sm:inline-flex">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Create job
          </Link>
        )}
      </div>

      <CommandSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  )
}
