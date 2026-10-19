import { useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, ChevronDown, HelpCircle, MinusCircle, XCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { StatusBadge } from '@/components/ui/Badge'
import { assessmentApi } from '@/utils/api'
import { cn } from '@/utils/helpers'
import type { AssessmentAttempt, AttemptAnswer } from '@/types'

export type Verdict = 'correct' | 'partial' | 'incorrect' | 'unanswered' | 'pending'

/** How one answer fared: a score of 100 is correct, 0 is incorrect, anything between is partly right. */
export function verdictOf(a: AttemptAnswer): Verdict {
  if (!a.answer?.trim()) return 'unanswered'
  if (a.score == null) return 'pending'
  if (a.score >= 100) return 'correct'
  if (a.score <= 0) return 'incorrect'
  return 'partial'
}

const VERDICTS: Record<Verdict, { label: string; chip: string; icon: LucideIcon; iconClass: string }> = {
  correct: { label: 'Correct', chip: 'bg-success-100 text-success-600 dark:bg-success-900/40 dark:text-success-400', icon: CheckCircle2, iconClass: 'text-success-500' },
  partial: { label: 'Partially correct', chip: 'bg-warning-100 text-warning-600 dark:bg-warning-900/30 dark:text-warning-400', icon: AlertCircle, iconClass: 'text-warning-500' },
  incorrect: { label: 'Incorrect', chip: 'bg-error-100 text-error-600 dark:bg-error-900/30 dark:text-error-400', icon: XCircle, iconClass: 'text-error-500' },
  unanswered: { label: 'Not answered', chip: 'bg-base-100 text-ink-600 dark:bg-base-800 dark:text-ink-300', icon: MinusCircle, iconClass: 'text-ink-400' },
  pending: { label: 'Needs review', chip: 'bg-info-100 text-info-600 dark:bg-info-900/40 dark:text-info-400', icon: HelpCircle, iconClass: 'text-info-500' },
}

/** Weighted average of the answers' scores, like the server's total; null while any answer is still unscored. */
function weightedScore(answers: AttemptAnswer[]): number | null {
  if (answers.length === 0 || answers.some((a) => a.score == null)) return null
  const weights = answers.reduce((sum, a) => sum + a.weight, 0)
  if (weights === 0) return 0
  return Math.round((answers.reduce((sum, a) => sum + (a.score ?? 0) * a.weight, 0) / weights) * 10) / 10
}

const formatWhen = (value?: string) => (value ? new Date(value).toLocaleString() : 'not yet')
const norm = (v?: string | null) => (v ?? '').trim().toLowerCase()

interface Props {
  attempt: AssessmentAttempt
  /** Called with the updated attempt after a recruiter changes a score. */
  onChange: (a: AssessmentAttempt) => void
}

/** What a candidate answered, what was right, and how it scored: for recruiters and admins only. */
export function AttemptReview({ attempt, onChange }: Props) {
  const answers = attempt.answers ?? []
  const [onlyProblems, setOnlyProblems] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())
  const canGrade = attempt.status === 'SUBMITTED' || attempt.status === 'GRADED'

  const counts = useMemo(() => {
    const c: Record<Verdict, number> = { correct: 0, partial: 0, incorrect: 0, unanswered: 0, pending: 0 }
    answers.forEach((a) => c[verdictOf(a)]++)
    return c
  }, [answers])

  const rounds = useMemo(() => {
    const groups: { title: string; answers: AttemptAnswer[] }[] = []
    answers.forEach((a) => {
      const title = a.roundTitle ?? 'All questions'
      const last = groups[groups.length - 1]
      if (last && last.title === title) last.answers.push(a)
      else groups.push({ title, answers: [a] })
    })
    return groups
  }, [answers])

  const issues = answers.length - counts.correct
  const allCollapsed = rounds.length > 0 && collapsed.size === rounds.length
  const toggleRound = (i: number) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-base-200 p-4 dark:border-base-700" aria-label="Score summary">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-body-sm text-ink-600 dark:text-ink-300">
              <span className="font-semibold text-ink-900 dark:text-ink-100">{attempt.candidateName}</span>, {attempt.assessmentTitle}
            </p>
            <p className="mt-0.5 text-body-xs text-ink-500 dark:text-ink-400">
              Started {formatWhen(attempt.startedAt)}, submitted {formatWhen(attempt.submittedAt)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              {attempt.totalScore != null ? (
                <p className="font-display text-heading-xl font-bold tabular-nums text-ink-950 dark:text-ink-100" data-testid="attempt-score">{attempt.totalScore}%</p>
              ) : (
                <p className="text-body-md font-semibold text-ink-700 dark:text-ink-200" data-testid="attempt-score">{answers.length ? 'Score pending' : 'No score yet'}</p>
              )}
              <p className="text-body-xs text-ink-500 dark:text-ink-400">{attempt.totalScore != null ? 'Overall score' : counts.pending ? `${counts.pending} to review` : ''}</p>
            </div>
            <StatusBadge status={attempt.status} />
          </div>
        </div>

        {answers.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2" aria-label="Answers by result">
            {(Object.keys(VERDICTS) as Verdict[])
              .filter((v) => counts[v] > 0)
              .map((v) => {
                const { label, chip, icon: Icon } = VERDICTS[v]
                return (
                  <li key={v} className={cn('inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-body-sm font-medium', chip)}>
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {counts[v]} {label.toLowerCase()}
                  </li>
                )
              })}
          </ul>
        )}

      </section>

      {answers.length === 0 ? (
        <p className="py-6 text-center text-body-md text-ink-500 dark:text-ink-400">No answers yet.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2" role="group" aria-label="Which answers to show">
              <Button type="button" size="sm" variant={onlyProblems ? 'secondary' : 'primary'} aria-pressed={!onlyProblems} onClick={() => setOnlyProblems(false)}>
                All questions ({answers.length})
              </Button>
              <Button type="button" size="sm" variant={onlyProblems ? 'primary' : 'secondary'} aria-pressed={onlyProblems} onClick={() => setOnlyProblems(true)} disabled={issues === 0}>
                Wrong or incomplete ({issues})
              </Button>
            </div>
            {rounds.length > 1 && (
              <Button type="button" size="sm" variant="ghost" onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(rounds.map((_, i) => i)))}>
                {allCollapsed ? 'Expand all rounds' : 'Collapse all rounds'}
              </Button>
            )}
          </div>

          {rounds.map((round, i) => {
            const visible = onlyProblems ? round.answers.filter((a) => verdictOf(a) !== 'correct') : round.answers
            if (visible.length === 0) return null
            const open = !collapsed.has(i)
            const score = weightedScore(round.answers)
            const correct = round.answers.filter((a) => verdictOf(a) === 'correct').length
            const panelId = `round-${attempt.id}-${i}`
            return (
              <section key={i} className="rounded-xl border border-base-200 dark:border-base-700" aria-label={round.title}>
                <h3>
                  <button
                    type="button"
                    onClick={() => toggleRound(i)}
                    aria-expanded={open}
                    aria-controls={panelId}
                    className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-4 py-3 text-left hover:bg-base-50 dark:hover:bg-base-800/50"
                  >
                    <ChevronDown className={cn('h-4 w-4 flex-shrink-0 text-ink-500 transition-transform', !open && '-rotate-90')} aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate font-semibold text-ink-950 dark:text-ink-100">{round.title}</span>
                    <span className="hidden flex-shrink-0 text-body-sm text-ink-600 dark:text-ink-300 sm:inline">
                      {correct} of {round.answers.length} correct
                    </span>
                    <span className="w-16 flex-shrink-0 text-right font-display text-body-md font-bold tabular-nums text-ink-950 dark:text-ink-100">
                      {score != null ? `${score}%` : 'Pending'}
                    </span>
                  </button>
                </h3>
                {open && (
                  <div id={panelId} className="space-y-3 border-t border-base-200 px-4 py-4 dark:border-base-700">
                    {visible.map((answer) => (
                      <AnswerCard key={answer.id} index={answers.indexOf(answer)} attemptId={attempt.id} answer={answer} canGrade={canGrade} onChange={onChange} />
                    ))}
                  </div>
                )}
              </section>
            )
          })}
        </>
      )}
    </div>
  )
}

function AnswerCard({ index, attemptId, answer, canGrade, onChange }: {
  index: number
  attemptId: string
  answer: AttemptAnswer
  canGrade: boolean
  onChange: (a: AssessmentAttempt) => void
}) {
  const [score, setScore] = useState(answer.score != null ? String(answer.score) : '')
  const [feedback, setFeedback] = useState(answer.feedback ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const verdict = verdictOf(answer)
  const { label, chip, icon: Icon, iconClass } = VERDICTS[verdict]
  const hasOptions = answer.type === 'MULTIPLE_CHOICE' && (answer.options?.length ?? 0) > 0

  const save = async () => {
    const value = Number(score)
    if (score.trim() === '' || Number.isNaN(value) || value < 0 || value > 100) {
      toast.error('Enter a score between 0 and 100')
      return
    }
    setIsSaving(true)
    try {
      onChange(await assessmentApi.gradeAnswer(attemptId, answer.id, value, feedback))
      toast.success('Score saved')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save score')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <article
      className={cn(
        'space-y-3 rounded-xl border p-4',
        verdict === 'correct' && 'border-success-100 dark:border-success-900/60',
        verdict === 'incorrect' && 'border-error-200 dark:border-error-800',
        verdict === 'partial' && 'border-warning-100 dark:border-warning-900/60',
        !['correct', 'incorrect', 'partial'].includes(verdict) && 'border-base-200 dark:border-base-700'
      )}
      data-verdict={verdict}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 flex-1 whitespace-pre-wrap font-medium text-ink-900 dark:text-ink-100">
          {index + 1}. {answer.question}
        </p>
        <span className={cn('inline-flex flex-shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-body-sm font-semibold', chip)}>
          <Icon className={cn('h-4 w-4', iconClass)} aria-hidden="true" />
          {label}
        </span>
      </div>
      <p className="text-body-xs text-ink-500 dark:text-ink-400">
        {answer.type.replace('_', ' ').toLowerCase()}, weight {answer.weight}
        {answer.score != null && `, scored ${answer.score}%`}
      </p>

      {hasOptions ? (
        <ul className="space-y-1.5" aria-label="Answer options">
          {answer.options!.map((option) => {
            const picked = norm(answer.answer) === norm(option)
            const right = norm(answer.correctAnswer) === norm(option)
            return (
              <li
                key={option}
                className={cn(
                  'flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-body-sm',
                  right && 'border-success-500 bg-success-50 dark:bg-success-900/20',
                  picked && !right && 'border-error-500 bg-error-50 dark:bg-error-900/20',
                  !picked && !right && 'border-base-200 dark:border-base-700'
                )}
                data-option-state={right ? (picked ? 'picked-correct' : 'correct') : picked ? 'picked-wrong' : 'plain'}
              >
                <span className="text-ink-900 dark:text-ink-100">{option}</span>
                <span className="flex-shrink-0 text-body-xs font-semibold">
                  {right && picked && <span className="text-success-600 dark:text-success-400">Candidate&apos;s answer, correct</span>}
                  {right && !picked && <span className="text-success-600 dark:text-success-400">Correct answer</span>}
                  {picked && !right && <span className="text-error-600 dark:text-error-400">Candidate&apos;s answer, wrong</span>}
                </span>
              </li>
            )
          })}
          {!answer.answer?.trim() && <li className="text-body-sm text-ink-500 dark:text-ink-400">The candidate did not pick an option.</li>}
        </ul>
      ) : (
        <div className="space-y-1.5">
          <p className="text-body-xs font-semibold text-ink-600 dark:text-ink-300">Candidate&apos;s answer</p>
          <pre className="whitespace-pre-wrap break-words rounded-lg bg-base-50 p-3 font-mono text-body-sm text-ink-900 dark:bg-base-800/50 dark:text-ink-100">
            {answer.answer || '(no answer)'}
          </pre>
          {answer.correctAnswer && (
            <p className="text-body-sm text-ink-700 dark:text-ink-200">
              <span className="font-semibold">Correct answer:</span> {answer.correctAnswer}
            </p>
          )}
        </div>
      )}

      {answer.feedback && (
        <p className="text-body-sm text-ink-700 dark:text-ink-200">
          <span className="font-semibold">Feedback:</span> {answer.feedback}
        </p>
      )}
      {answer.needsReview && (
        <p className="text-body-sm text-info-600 dark:text-info-400">This answer could not be scored automatically. Please score it below.</p>
      )}

      {canGrade && (
        <details className="rounded-lg border border-base-200 dark:border-base-700" open={answer.needsReview}>
          <summary className="cursor-pointer px-3 py-2 text-body-sm font-medium text-ink-700 dark:text-ink-200">Adjust score</summary>
          <div className="grid grid-cols-1 items-end gap-3 border-t border-base-200 p-3 dark:border-base-700 md:grid-cols-[8rem_1fr_auto]">
            <Input id={`score-${answer.id}`} label="Score (0-100)" type="number" min={0} max={100} value={score} onChange={(e) => setScore(e.target.value)} />
            <Textarea id={`feedback-${answer.id}`} label="Feedback" value={feedback} onChange={(e) => setFeedback(e.target.value)} />
            <Button type="button" size="sm" loading={isSaving} onClick={save}>
              Save
            </Button>
          </div>
        </details>
      )}
    </article>
  )
}
