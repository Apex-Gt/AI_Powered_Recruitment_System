import type { ReactNode } from 'react'
import { cn } from '@/utils/helpers'

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

/** The organisation running the assessment, always top left so the candidate knows who is asking. */
export function CompanyMark({ name }: { name: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-ink-900 text-body-sm font-bold text-white dark:bg-base-100 dark:text-ink-900"
        aria-hidden="true"
      >
        {initials(name)}
      </span>
      <span className="truncate font-display text-body-lg font-bold text-ink-950 dark:text-ink-100">{name}</span>
    </div>
  )
}

interface Props {
  /** Unknown until the link has been looked up (and for links that are not valid). */
  companyName?: string
  /** Shown next to the company on wide screens, e.g. the assessment's name. */
  title?: string
  /** Right side of the bar: the candidate's name, or the timer and submit button. */
  actions?: ReactNode
  /** A narrow page for short messages instead of the full working width. */
  narrow?: boolean
  children: ReactNode
}

/** Frame shared by every candidate-facing screen: company top left, content directly underneath. */
export function CandidateShell({ companyName, title, actions, narrow, children }: Props) {
  return (
    <div className="min-h-screen bg-base-50 text-ink-900 dark:bg-base-900 dark:text-ink-100">
      <header className="sticky top-0 z-20 border-b border-base-200 bg-white/95 backdrop-blur dark:border-base-700 dark:bg-surface-dark/95">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
          {companyName ? <CompanyMark name={companyName} /> : <span className="font-display text-body-lg font-bold text-ink-950 dark:text-ink-100">Assessment</span>}
          {title && (
            <>
              <span className="hidden h-5 w-px bg-base-300 dark:bg-base-600 md:block" aria-hidden="true" />
              <p className="hidden min-w-0 flex-1 truncate text-body-sm text-ink-600 dark:text-ink-300 md:block">{title}</p>
            </>
          )}
          {actions && <div className="ml-auto flex flex-wrap items-center justify-end gap-3">{actions}</div>}
        </div>
      </header>
      <main className={cn('mx-auto px-4 py-5', narrow ? 'max-w-2xl' : 'max-w-6xl')}>{children}</main>
    </div>
  )
}
