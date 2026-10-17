import { ReactNode, forwardRef, InputHTMLAttributes } from 'react'
import { cn } from '@/utils/helpers'

export function FormSection({
  icon: Icon,
  title,
  description,
  action,
  children,
}: {
  icon: React.ElementType
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="card !p-0 overflow-hidden" aria-labelledby={`sec-${title.replace(/\s+/g, '-').toLowerCase()}`}>
      <header className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 id={`sec-${title.replace(/\s+/g, '-').toLowerCase()}`} className="text-body-md font-bold text-ink-900 dark:text-ink-100">
              {title}
            </h2>
            {description && <p className="text-body-xs text-ink-500 dark:text-ink-400">{description}</p>}
          </div>
        </div>
        {action}
      </header>
      <div className="space-y-5 p-6">{children}</div>
    </section>
  )
}

interface SegmentedProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'type' | 'size'> {
  legend: string
  options: { value: string; label: string }[]
  value?: string
  error?: string
  required?: boolean
  size?: 'sm' | 'md'
}

/** Radio group styled as a segmented control. Works with react-hook-form `register` or as a controlled input. */
export const SegmentedRadio = forwardRef<HTMLInputElement, SegmentedProps>(
  ({ legend, options, value, error, required, size = 'md', name, ...rest }, ref) => (
    <fieldset>
      <legend className="label">
        {legend}
        {required && <span className="ml-1 text-accent-600" aria-hidden="true">*</span>}
      </legend>
      <div className="flex flex-wrap gap-1 rounded-xl border border-[var(--color-border)] bg-base-50 p-1 dark:bg-surface-dark-elevated">
        {options.map((o) => (
          <label key={o.value} className="relative flex-1 cursor-pointer">
            <input
              ref={ref}
              type="radio"
              name={name}
              value={o.value}
              checked={value !== undefined ? value === o.value : undefined}
              className="peer sr-only"
              {...rest}
            />
            <span
              className={cn(
                'flex items-center justify-center whitespace-nowrap rounded-lg px-3 font-semibold text-ink-500 transition-colors',
                'hover:text-ink-900 dark:text-ink-400 dark:hover:text-ink-100',
                'peer-checked:bg-white peer-checked:text-brand-700 peer-checked:shadow-card-light dark:peer-checked:bg-surface-dark-card dark:peer-checked:text-brand-200',
                'peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500',
                size === 'sm' ? 'h-8 text-body-xs' : 'h-9 text-body-sm'
              )}
            >
              {o.label}
            </span>
          </label>
        ))}
      </div>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  )
)
SegmentedRadio.displayName = 'SegmentedRadio'

export function CharCounter({ count, min }: { count: number; min: number }) {
  const ok = count >= min
  return (
    <p className={cn('mt-1.5 text-body-xs', ok ? 'text-success-600' : 'text-ink-500 dark:text-ink-400')} aria-live="polite">
      {ok ? `${count} characters` : `${count} / ${min} characters minimum`}
    </p>
  )
}

export function SummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="text-body-xs text-ink-500 dark:text-ink-400">{label}</dt>
      <dd className="text-right text-body-sm font-semibold text-ink-900 dark:text-ink-100">{children}</dd>
    </div>
  )
}
