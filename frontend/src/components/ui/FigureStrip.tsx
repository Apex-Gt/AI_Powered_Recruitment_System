import { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/utils/helpers'

export interface Figure {
  label: string
  value: string | number
  note?: ReactNode
  href?: string
}

const COLUMNS: Record<number, string> = {
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5',
}

function Cell({ figure }: { figure: Figure }) {
  const body = (
    <>
      <p className="text-body-sm font-semibold text-ink-700 dark:text-ink-300">{figure.label}</p>
      <p
        className={cn(
          'mt-1 font-display font-bold tabular text-ink-900 dark:text-ink-100',
          // Words ("No hires yet") are set smaller than numerals so a figure never wraps to two lines.
          typeof figure.value === 'string' && figure.value.length > 6 ? 'text-heading-lg leading-[2.5rem]' : 'text-display-sm'
        )}
      >
        {typeof figure.value === 'number' ? figure.value.toLocaleString() : figure.value}
      </p>
      {figure.note && <div className="mt-1 text-body-xs text-ink-600 dark:text-ink-400">{figure.note}</div>}
    </>
  )
  const base = 'block bg-[var(--color-surface)] px-6 py-5'
  return figure.href ? (
    <Link to={figure.href} className={cn(base, 'no-underline transition-colors hover:bg-base-50 dark:hover:bg-surface-dark-elevated')}>
      {body}
    </Link>
  ) : (
    <div className={base}>{body}</div>
  )
}

/** A single ruled strip of headline numbers: one object instead of a row of identical cards. */
export function FigureStrip({ figures, label }: { figures: Figure[]; label: string }) {
  return (
    <section aria-label={label} className="overflow-hidden rounded-xl border border-[var(--color-border)] shadow-card-light dark:shadow-card-dark">
      <div className={cn('grid grid-cols-2 gap-px bg-[var(--color-border)]', COLUMNS[figures.length] ?? 'lg:grid-cols-4')}>
        {figures.map((f) => (
          <Cell key={f.label} figure={f} />
        ))}
      </div>
    </section>
  )
}
