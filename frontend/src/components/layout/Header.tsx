import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bell, Menu, Moon, Plus, Search, Sun, CornerDownLeft } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { cn } from '@/utils/helpers'

const PAGES = [
  { label: 'Dashboard', href: '/dashboard', hint: 'Overview' },
  { label: 'Jobs', href: '/jobs', hint: 'Manage openings' },
  { label: 'Create Job', href: '/jobs/create', hint: 'Post a new position' },
  { label: 'Candidates', href: '/candidates', hint: 'Browse applicants' },
  { label: 'Pipeline', href: '/pipeline', hint: 'Candidate stages' },
  { label: 'Assessments', href: '/assessments', hint: 'Tests and scoring' },
  { label: 'Interviews', href: '/interviews', hint: 'Schedule and feedback' },
  { label: 'Analytics', href: '/analytics', hint: 'Hiring metrics' },
  { label: 'Team', href: '/team', hint: 'Recruiters' },
  { label: 'Company', href: '/company', hint: 'Company profile' },
  { label: 'Settings', href: '/settings', hint: 'Account settings' },
]

function CommandSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? PAGES.filter((p) => p.label.toLowerCase().includes(q) || p.hint.toLowerCase().includes(q)) : PAGES
  }, [query])

  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  if (!open) return null

  const go = (href: string) => {
    navigate(href)
    onClose()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter' && results[active]) {
      go(results[active].href)
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-start justify-center bg-black/40 p-4 pt-[15vh]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search pages"
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-soft animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-4">
          <Search className="h-5 w-5 text-ink-400" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            placeholder="Search pages or type a command"
            aria-label="Search"
            className="h-14 flex-1 bg-transparent text-body-md text-ink-900 outline-none placeholder:text-ink-400 dark:text-ink-100"
          />
          <kbd className="rounded-md border border-[var(--color-border)] px-1.5 py-0.5 text-label-xs text-ink-500">Esc</kbd>
        </div>
        <ul className="max-h-80 overflow-y-auto p-2">
          {results.length === 0 && <li className="px-3 py-6 text-center text-body-sm text-ink-500">No matching pages</li>}
          {results.map((p, i) => (
            <li key={p.href}>
              <button
                onClick={() => go(p.href)}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  'flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors',
                  i === active ? 'bg-brand-50 dark:bg-brand-900/30' : ''
                )}
              >
                <span>
                  <span className="block text-body-sm font-semibold text-ink-900 dark:text-ink-100">{p.label}</span>
                  <span className="block text-body-xs text-ink-500">{p.hint}</span>
                </span>
                {i === active && <CornerDownLeft className="h-4 w-4 text-brand-600" aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export function Header({ onMenu }: { onMenu: () => void }) {
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

  const iconBtn =
    'flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-ink-600 transition-colors hover:border-[var(--color-border-hover)] hover:text-ink-900 dark:text-ink-300 dark:hover:text-ink-100'

  return (
    <header className="sticky top-0 z-[150] flex h-16 items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg)]/90 px-4 backdrop-blur sm:px-6 lg:px-8">
      <button onClick={onMenu} className={cn(iconBtn, 'lg:hidden')} aria-label="Open menu">
        <Menu className="h-5 w-5" />
      </button>

      <button
        onClick={() => setSearchOpen(true)}
        className="flex h-10 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-left text-body-sm text-ink-500 transition-colors hover:border-[var(--color-border-hover)] sm:max-w-md"
        aria-label="Open search (Ctrl+K)"
      >
        <Search className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
        <span className="flex-1 truncate">Search or jump to a page</span>
        <kbd className="hidden rounded-md border border-[var(--color-border)] px-1.5 py-0.5 text-label-xs sm:block">Ctrl K</kbd>
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
            <div className="dropdown-menu absolute right-0 top-12 w-72 p-4 text-center">
              <Bell className="mx-auto h-8 w-8 text-ink-300" aria-hidden="true" />
              <p className="mt-2 text-body-sm font-semibold text-ink-900 dark:text-ink-100">You're all caught up</p>
              <p className="mt-1 text-body-xs text-ink-500">Notifications will appear here.</p>
            </div>
          )}
        </div>

        {hasRole(['ADMIN', 'RECRUITER']) && (
          <Link to="/jobs/create" className="btn-primary hidden h-10 px-4 py-0 text-body-sm sm:inline-flex">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Create Job
          </Link>
        )}
      </div>

      <CommandSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  )
}
