import { ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import { Dropdown } from './Dropdown'
import { cn } from '@/utils/helpers'

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-heading-xl font-bold text-ink-900 dark:text-ink-100">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-xl text-body-md text-ink-600 dark:text-ink-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function SearchField({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  label: string
}) {
  return (
    <div className="relative w-full sm:w-72">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden="true" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className={cn('input h-10 pl-9 pr-9', value && '!border-brand-400')}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-base-100 hover:text-ink-700 dark:hover:bg-surface-dark-elevated"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

export function FilterSelect({
  label,
  value,
  onChange,
  options,
  icon: Icon,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  icon?: React.ElementType
}) {
  return (
    <div className="relative w-full sm:w-52">
      {Icon && <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden="true" />}
      <Dropdown
        ariaLabel={label}
        value={value}
        onChange={onChange}
        options={options}
        className={cn('h-10 py-0', Icon && 'pl-9', value && '!border-brand-400 font-semibold')}
      />
    </div>
  )
}

export function ActiveFilters({
  total,
  noun,
  chips,
  onClearAll,
}: {
  total: number
  noun: string
  chips: { key: string; label: string; onRemove: () => void }[]
  onClearAll: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] px-3 py-2.5">
      <p className="mr-1 text-body-xs font-medium text-ink-500 dark:text-ink-400" aria-live="polite">
        {total} {total === 1 ? noun.replace(/s$/, '') : noun}
      </p>
      {chips.map((c) => (
        <span
          key={c.key}
          className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-1 pl-3 pr-1 text-body-xs font-semibold text-brand-700 dark:bg-brand-900/30 dark:text-brand-200"
        >
          {c.label}
          <button
            type="button"
            onClick={c.onRemove}
            className="flex h-5 w-5 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-brand-100 dark:hover:bg-brand-900/60"
            aria-label={`Remove filter ${c.label}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      {chips.length > 0 && (
        <button type="button" onClick={onClearAll} className="cursor-pointer text-body-xs font-semibold text-ink-500 underline hover:text-ink-900 dark:hover:text-ink-100">
          Clear all
        </button>
      )}
    </div>
  )
}

export interface TabItem {
  value: string
  label: string
  count?: number
}

export function StatusTabs({ tabs, value, onChange, label }: { tabs: TabItem[]; value: string; onChange: (value: string) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="tabs-list">
      {tabs.map((t) => {
        const active = t.value === value
        return (
          <button
            key={t.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={cn(active ? 'tabs-trigger-active' : 'tabs-trigger', 'cursor-pointer')}
          >
            {t.label}
            {t.count !== undefined && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-label-xs tabular-nums',
                  active ? 'bg-brand-500 text-[#1d1b19]' : 'bg-base-200/70 text-ink-600 dark:bg-white/10 dark:text-ink-300'
                )}
              >
                {t.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function Pagination({
  page,
  pageSize,
  total,
  totalPages,
  noun,
  onChange,
}: {
  page: number
  pageSize: number
  total: number
  totalPages: number
  noun: string
  onChange: (page: number) => void
}) {
  if (totalPages <= 1) return null
  const btn =
    'flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-[var(--color-border)] text-ink-600 transition-colors hover:bg-base-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-ink-300 dark:hover:bg-surface-dark-elevated'
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] px-4 py-3">
      <p className="text-body-xs text-ink-500 dark:text-ink-400">
        Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total} {noun}
      </p>
      <div className="flex items-center gap-2">
        <button className={btn} disabled={page === 1} onClick={() => onChange(page - 1)} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="px-2 text-body-xs font-medium text-ink-600 dark:text-ink-300">
          Page {page} of {totalPages}
        </span>
        <button className={btn} disabled={page === totalPages} onClick={() => onChange(page + 1)} aria-label="Next page">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export function TableSkeleton({ columns, rows = 6 }: { columns: number; rows?: number }) {
  return (
    <div className="divide-y divide-[var(--color-border)]" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-6 px-4 py-4">
          {Array.from({ length: columns }, (_, c) => (
            <div key={c} className={cn('skeleton h-4', c === 0 ? 'w-1/4' : 'flex-1')} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-error-200 bg-error-50 p-3 text-body-sm text-error-600 dark:border-error-800/70 dark:bg-error-900/30 dark:text-error-400">
      <span>{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="cursor-pointer font-semibold underline">
          Try again
        </button>
      )}
    </div>
  )
}

export function MatchScore({ score }: { score?: number }) {
  if (score === undefined || score === null) {
    return <span className="text-body-xs text-ink-400">Not scored</span>
  }
  const color = score >= 80 ? 'bg-success-500' : score >= 60 ? 'bg-brand-500' : score >= 40 ? 'bg-warning-500' : 'bg-error-500'
  return (
    <div className="flex items-center gap-2" aria-label={`Match score ${Math.round(score)} percent`}>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-base-100 dark:bg-surface-dark-elevated">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${Math.min(100, Math.max(0, score))}%` }} />
      </div>
      <span className="w-9 text-body-xs font-bold text-ink-900 dark:text-ink-100">{Math.round(score)}%</span>
    </div>
  )
}
