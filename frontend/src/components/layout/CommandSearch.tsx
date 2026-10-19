import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { CornerDownLeft, Search } from 'lucide-react'
import { cn } from '@/utils/helpers'

const PAGES = [
  { label: 'Dashboard', href: '/dashboard', hint: 'Overview' },
  { label: 'Jobs', href: '/jobs', hint: 'Manage openings' },
  { label: 'Create job', href: '/jobs/create', hint: 'Post a new position' },
  { label: 'Candidates', href: '/candidates', hint: 'Browse applicants' },
  { label: 'Pipeline', href: '/pipeline', hint: 'Candidate stages' },
  { label: 'Assessments', href: '/assessments', hint: 'Tests and scoring' },
  { label: 'Interviews', href: '/interviews', hint: 'Schedule and feedback' },
  { label: 'Analytics', href: '/analytics', hint: 'Hiring metrics' },
  { label: 'Team', href: '/team', hint: 'Recruiters' },
  { label: 'Company', href: '/company', hint: 'Company profile' },
  { label: 'Settings', href: '/settings', hint: 'Account settings' },
]

export function CommandSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
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

  // Esc closes the palette wherever focus is, not only while the input has it.
  useEffect(() => {
    if (!open) return
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onEsc)
    return () => document.removeEventListener('keydown', onEsc)
  }, [open, onClose])

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
    }
  }

  // Portal to <body>: the top bar is a backdrop-filter element, which would otherwise trap the fixed overlay inside the bar.
  return createPortal(
    <div className="modal-overlay !items-start pt-[14vh]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Go to page"
        className="modal-content max-w-lg"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-4">
          <Search className="h-5 w-5 text-ink-500" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            placeholder="Go to a page"
            aria-label="Go to a page"
            className="h-14 flex-1 bg-transparent text-body-md text-ink-900 outline-none focus:outline-none focus-visible:!ring-0 focus-visible:!ring-offset-0 placeholder:text-ink-400 dark:text-ink-100"
          />
          <kbd className="rounded-md border border-[var(--color-border-hover)] px-1.5 py-0.5 text-label-xs text-ink-600 dark:text-ink-400">Esc</kbd>
        </div>
        <ul className="max-h-80 overflow-y-auto p-2">
          {results.length === 0 && <li className="px-3 py-6 text-center text-body-sm text-ink-600 dark:text-ink-400">No page matches that</li>}
          {results.map((p, i) => (
            <li key={p.href}>
              <button
                onClick={() => go(p.href)}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  'flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors',
                  i === active && 'bg-clay-100 dark:bg-clay-800/50'
                )}
              >
                <span>
                  <span className="block text-body-sm font-semibold text-ink-900 dark:text-ink-100">{p.label}</span>
                  <span className="block text-body-xs text-ink-600 dark:text-ink-400">{p.hint}</span>
                </span>
                {i === active && <CornerDownLeft className="h-4 w-4 text-ink-600 dark:text-ink-300" aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body
  )
}
