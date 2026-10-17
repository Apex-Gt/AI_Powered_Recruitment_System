import { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/utils/helpers'

/** A bordered sheet with a heading and the 2px forest rule on top. */
export function Panel({
  title,
  note,
  action,
  className,
  children,
}: {
  title: string
  note?: string
  action?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <section className={cn('card !p-0', className)}>
      <header className="flex items-start justify-between gap-3 px-6 pt-5">
        <div>
          <h2 className="font-display text-heading-sm font-semibold text-ink-900 dark:text-ink-100">{title}</h2>
          {note && <p className="mt-0.5 text-body-xs text-ink-600 dark:text-ink-400">{note}</p>}
        </div>
        {action}
      </header>
      <div className="px-6 pb-6 pt-4">{children}</div>
    </section>
  )
}

export function PanelLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="text-body-xs font-semibold text-brand-600 underline-offset-2 hover:underline dark:text-brand-300">
      {children}
    </Link>
  )
}

export function EmptyNote({ icon: Icon, title, text }: { icon: React.ElementType; title: string; text: string }) {
  return (
    <div className="flex min-h-[140px] flex-col items-center justify-center gap-1.5 text-center">
      <Icon className="h-7 w-7 text-ink-400" aria-hidden="true" />
      <p className="text-body-sm font-semibold text-ink-800 dark:text-ink-200">{title}</p>
      <p className="max-w-[16rem] text-body-xs text-ink-600 dark:text-ink-400">{text}</p>
    </div>
  )
}

/** Labelled horizontal bars: the one chart form used for rankings and distributions. */
export function BarRows({
  rows,
  unit = '',
  marker,
}: {
  rows: { label: string; value: number; color?: string; note?: string }[]
  unit?: string
  /** Draws a thin vertical reference line, for example an average. */
  marker?: { value: number; label: string }
}) {
  const max = Math.max(1, marker?.value ?? 0, ...rows.map((r) => r.value))
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(6rem,10rem)_1fr_4.5rem] items-center gap-3">
          <span className="truncate text-body-sm font-semibold text-ink-800 dark:text-ink-200" title={r.label}>{r.label}</span>
          <div className="relative h-6 rounded-sm bg-base-100 dark:bg-surface-dark-elevated">
            <div
              className="h-full rounded-sm transition-[width] duration-300"
              style={{ width: `${(r.value / max) * 100}%`, minWidth: r.value ? 4 : 0, background: r.color ?? '#606c38' }}
            />
            {marker && (
              <span
                className="absolute inset-y-[-3px] w-px bg-ink-900 dark:bg-ink-100"
                style={{ left: `${(marker.value / max) * 100}%` }}
                title={marker.label}
                aria-hidden="true"
              />
            )}
          </div>
          <span className="text-right font-display text-body-md font-bold tabular text-ink-900 dark:text-ink-100">
            {r.value}
            {unit && <span className="ml-0.5 text-body-xs font-medium text-ink-600 dark:text-ink-400">{unit}</span>}
          </span>
        </li>
      ))}
    </ul>
  )
}
