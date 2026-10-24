import { AlertTriangle, CheckCircle2, CircleDashed, HelpCircle } from 'lucide-react'
import type { AIAnalysis, RequirementAssessment } from '@/types'
import { cn } from '@/utils/helpers'

const STATUS: Record<RequirementAssessment['status'], { label: string; className: string; Icon: typeof CheckCircle2 }> = {
  demonstrated: { label: 'Shown in the resume', className: 'badge-success', Icon: CheckCircle2 },
  partial: { label: 'Partly shown', className: 'badge-warning', Icon: CircleDashed },
  not_evidenced: { label: 'Not mentioned', className: 'badge-default', Icon: HelpCircle },
}

const CATEGORY_ORDER = ['mandatory skill', 'experience', 'education', 'responsibility', 'preferred skill']

function sortKey(a: RequirementAssessment) {
  const i = CATEGORY_ORDER.indexOf(a.category)
  return i === -1 ? CATEGORY_ORDER.length : i
}

function sourceLabel(type: string) {
  return type === 'listed skills' ? 'Skills section' : type.charAt(0).toUpperCase() + type.slice(1)
}

/**
 * The job's requirements one by one, each marked as shown, partly shown or not mentioned in the resume, with the
 * project or role it was shown in and the resume's own words. A missing mention is never presented as inability.
 */
export function RequirementEvidence({ analysis }: { analysis: AIAnalysis }) {
  const rows = [...(analysis.requirements ?? [])].sort((a, b) => sortKey(a) - sortKey(b))
  const limitations = analysis.limitations ?? []
  if (rows.length === 0 && !analysis.overallAssessment && limitations.length === 0) return null

  return (
    <section aria-label="Requirements compared with the resume" className="space-y-4">
      <div>
        <h3 className="font-display text-body-md font-bold text-ink-900 dark:text-ink-100">Requirements compared with the resume</h3>
        {analysis.overallAssessment && <p className="mt-1 text-body-sm text-ink-700 dark:text-ink-300">{analysis.overallAssessment}</p>}
      </div>

      {rows.length > 0 && (
        <ul className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)]">
          {rows.map((row) => {
            const { label, className, Icon } = STATUS[row.status]
            return (
              <li key={`${row.category}:${row.requirement}`} className="px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-body-sm font-semibold text-ink-900 dark:text-ink-100">{row.requirement}</p>
                    <p className="text-body-xs capitalize text-ink-500 dark:text-ink-400">{row.category}</p>
                  </div>
                  <span className={cn(className, 'inline-flex flex-shrink-0 items-center gap-1')}>
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {label}
                  </span>
                </div>
                <p className="mt-1.5 text-body-sm text-ink-700 dark:text-ink-300">{row.explanation}</p>
                {row.evidence.length > 0 && (
                  <ul className="mt-2 space-y-1.5">
                    {row.evidence.map((ref, i) => (
                      <li key={i} className="rounded-lg bg-base-50 px-3 py-2 text-body-xs dark:bg-surface-dark-elevated">
                        <span className="font-semibold text-ink-800 dark:text-ink-200">
                          {sourceLabel(ref.sourceType)}: {ref.source}
                        </span>
                        {ref.quote && <q className="mt-0.5 block text-ink-600 dark:text-ink-400">{ref.quote}</q>}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {limitations.length > 0 && (
        <div className="flex gap-2 rounded-lg bg-warning-50 px-3 py-2 text-body-xs text-ink-700 dark:bg-surface-dark-elevated dark:text-ink-300" role="note">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning-600" aria-hidden="true" />
          <ul className="space-y-0.5">
            {limitations.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
