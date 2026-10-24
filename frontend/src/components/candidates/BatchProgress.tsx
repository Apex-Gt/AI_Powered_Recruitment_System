import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Ban, CheckCircle2, ChevronDown, Clock, Copy, Loader2, RotateCcw, X, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { batchApi, type Batch, type BatchTask, type BatchTaskStage } from '@/utils/api'
import { Button } from '@/components/ui/Button'
import { ConfirmModal } from '@/components/ui/Modal'
import { cn } from '@/utils/helpers'

const TERMINAL = new Set(['COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED'])
const POLL_MS = 2500

/** What the pipeline is doing right now, in the present tense; shown beside the count and under a processing resume. */
const STAGE_LABEL: Record<BatchTaskStage, string> = {
  EXTRACT: 'Reading the file',
  PROFILE: 'Extracting skills and experience',
  PERSIST: 'Saving the candidate',
  INDEX: 'Preparing to rank',
  SCORE: 'Scoring against the job',
  SUMMARY: 'Writing the summary',
  DONE: 'Finishing up',
}

/** The stage most in-flight resumes are in; ties go to the earlier stage so the label never jumps ahead. */
function dominantStage(working: BatchTask[]): BatchTaskStage | null {
  if (working.length === 0) return null
  const order = Object.keys(STAGE_LABEL) as BatchTaskStage[]
  const counts = new Map<BatchTaskStage, number>()
  for (const t of working) counts.set(t.stage, (counts.get(t.stage) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || order.indexOf(a[0]) - order.indexOf(b[0]))[0][0]
}

/** "45 seconds", "3 min 10 s": how long one resume has been worked on. */
function spent(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return ''
  if (seconds < 60) return `${Math.round(seconds)} s`
  const minutes = Math.floor(seconds / 60)
  return `${minutes} min ${Math.round(seconds % 60)} s`
}

type RowIcon = 'wait' | 'work' | 'ok' | 'bad' | 'warn' | 'dup' | 'stop'

/** Pending, Processing, Completed or Failed; needs-review and duplicates are shown as what they are. */
function rowState(t: BatchTask): { label: string; className: string; icon: RowIcon } {
  switch (t.status) {
    case 'COMPLETED':
      return { label: 'Completed', className: 'badge-success', icon: 'ok' }
    case 'PROCESSING':
      return { label: 'Processing', className: 'badge-primary', icon: 'work' }
    case 'FAILED':
      return { label: 'Failed', className: 'badge-error', icon: 'bad' }
    case 'NEEDS_REVIEW':
      return { label: 'Needs review', className: 'badge-warning', icon: 'warn' }
    case 'DUPLICATE':
      return { label: 'Duplicate', className: 'badge-default', icon: 'dup' }
    case 'CANCELLED':
      return { label: 'Cancelled', className: 'badge-default', icon: 'stop' }
    default:
      return { label: 'Pending', className: 'badge-default', icon: 'wait' }
  }
}

/** What the recruiter can do about one stopped resume: type in a missing email, or try a failed one again. */
function RowActions({ batchId, task, onChanged }: { batchId: string; task: BatchTask; onChanged: () => void }) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const needsEmail = task.status === 'NEEDS_REVIEW' && task.errorCode === 'NO_EMAIL' && !task.candidateId
  const canRetry = task.status === 'FAILED'
  if (!needsEmail && !canRetry) return null

  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    try {
      await action()
      onChanged()
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : 'That did not work')
    } finally {
      setBusy(false)
    }
  }

  if (needsEmail) {
    const submit = () =>
      run(async () => {
        const res = await batchApi.supplyEmail(batchId, task.id, email)
        if (res.outcome === 'DUPLICATE') toast('That person has already applied for this job')
        else toast.success('Queued again with that email')
      })
    return (
      <form
        className="mt-1.5 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Candidate's email"
          aria-label={`Email for ${task.fileName}`}
          className="input h-8 min-w-0 flex-1 text-body-sm"
        />
        <Button type="submit" size="sm" variant="secondary" loading={busy}>
          Add email
        </Button>
      </form>
    )
  }

  return (
    <div className="mt-1.5">
      <Button
        type="button"
        size="sm"
        variant="secondary"
        loading={busy}
        onClick={() =>
          run(async () => {
            const res = await batchApi.retryTask(batchId, task.id)
            if (!res.requeued) toast.error('This resume cannot be retried')
          })
        }
      >
        <RotateCcw className="h-4 w-4" aria-hidden="true" />
        Retry this one
      </Button>
    </div>
  )
}

/** Every page of a batch's tasks; the server caps a page at 200 and a batch can hold 500. */
async function fetchAllTasks(batchId: string): Promise<BatchTask[]> {
  const first = await batchApi.tasks(batchId, { page: 0 })
  const items = [...first.items]
  for (let page = 1; page < first.totalPages; page++) items.push(...(await batchApi.tasks(batchId, { page })).items)
  return items
}

interface Props {
  batchId: string
  /** Fires once, when every resume has reached a final state. */
  onFinished?: (batch: Batch) => void
  /** Lets the per-resume list be folded away (it is open to start with). Used where the progress sits on a page. */
  collapsible?: boolean
  /** Shown once the batch has finished, so the recruiter can clear it from the page. */
  onDismiss?: () => void
}

/** Live progress of one bulk upload: overall bar and counts, then every resume with its own status. */
export function BatchProgress({ batchId, onFinished, collapsible = false, onDismiss }: Props) {
  const [batch, setBatch] = useState<Batch | null>(null)
  const [tasks, setTasks] = useState<BatchTask[]>([])
  const [error, setError] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)
  const [open, setOpen] = useState(true)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [restart, setRestart] = useState(0)
  const finishedRef = useRef(false)
  const onFinishedRef = useRef(onFinished)
  onFinishedRef.current = onFinished

  const detailed = !collapsible || open

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    finishedRef.current = false

    const tick = async () => {
      try {
        const next = await batchApi.get(batchId)
        const list = detailed
          ? await fetchAllTasks(batchId)
          : (await batchApi.tasks(batchId, { status: 'PROCESSING', size: 10 })).items // just enough to name the current step
        if (cancelled) return
        setBatch(next)
        setTasks(list)
        setError(null)
        if (TERMINAL.has(next.status)) {
          if (!finishedRef.current) {
            finishedRef.current = true
            onFinishedRef.current?.(next)
          }
          return // nothing more will change until a retry, which restarts polling below
        }
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Could not read progress')
      }
      timer = setTimeout(tick, POLL_MS)
    }
    void tick()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [batchId, detailed, retrying, restart])

  const retryFailed = async () => {
    setRetrying(true)
    try {
      const { requeued } = await batchApi.retryFailed(batchId)
      toast.success(requeued > 0 ? `${requeued} resume${requeued === 1 ? '' : 's'} queued again` : 'Nothing could be retried')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Retry failed')
    } finally {
      setRetrying(false) // flips the effect dependency, which restarts polling
    }
  }

  const cancelBatch = async () => {
    setCancelling(true)
    try {
      const result = await batchApi.cancel(batchId)
      toast.success(
        result.mode === 'ranking'
          ? 'Ranking stopped'
          : result.removedCandidates > 0
            ? `Upload cancelled. ${result.removedCandidates} candidate${result.removedCandidates === 1 ? '' : 's'} removed again.`
            : 'Upload cancelled'
      )
      setConfirmCancel(false)
      setRestart((n) => n + 1) // read the final state and tell the page to reload
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : 'Could not cancel')
    } finally {
      setCancelling(false)
    }
  }

  if (!batch) {
    return (
      <div className="flex items-center gap-2 text-body-sm text-ink-600 dark:text-ink-300" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        {error ?? 'Reading progress…'}
      </div>
    )
  }

  const c = batch.counts
  const done = TERMINAL.has(batch.status)
  const stage = dominantStage(tasks.filter((t) => t.status === 'PROCESSING'))
  const cancelled = batch.status === 'CANCELLED'
  // Once a batch has been ranked, its latest phase is the ranking run, with counts of its own.
  const ranking = batch.rankingTotal > 0
  const total = ranking ? batch.rankingTotal : batch.totalFiles
  const succeeded = ranking ? batch.rankingDone : c.COMPLETED
  const failedTotal = ranking ? batch.rankingFailed : c.FAILED + c.NEEDS_REVIEW
  const finished = ranking ? batch.rankingDone + batch.rankingFailed : batch.totalFiles - (c.QUEUED + c.PROCESSING + c.UPLOADED)
  const skipped = ranking ? 0 : c.DUPLICATE
  const current = Math.min(total, finished + 1)
  const latestRun = tasks.reduce<string | null>((max, t) => (t.rankRunAt && (!max || t.rankRunAt > max) ? t.rankRunAt : max), null)
  const shownTasks = ranking && latestRun ? tasks.filter((t) => t.rankRunAt === latestRun) : tasks
  const what = ranking ? 'candidates ranked' : 'resumes processed'

  const headline = done
    ? cancelled
      ? ranking
        ? 'Ranking stopped'
        : 'Upload cancelled'
      : ranking
        ? failedTotal === 0
          ? 'All candidates are ranked'
          : succeeded === 0
            ? 'None of the candidates could be ranked'
            : 'Ranking finished, but some candidates could not be ranked'
        : batch.status === 'COMPLETED'
          ? 'All resumes are processed'
          : batch.status === 'FAILED'
            ? 'None of these resumes could be processed'
            : 'Processing finished, but some resumes need attention'
    : ranking
      ? `Ranking candidate ${current} of ${total}…`
      : `Processing resume ${current}…`

  return (
    <section aria-label="Resume processing progress" className="space-y-4">
      <div>
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-body-md font-semibold text-ink-900 dark:text-ink-100" role="status" aria-live="polite">
            {done ? (
              batch.status === 'COMPLETED' ? (
                <CheckCircle2 className="h-5 w-5 text-success-600" aria-hidden="true" />
              ) : cancelled ? (
                <Ban className="h-5 w-5 text-ink-500" aria-hidden="true" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-warning-600" aria-hidden="true" />
              )
            ) : (
              <Loader2 className="h-5 w-5 animate-spin text-brand-700" aria-hidden="true" />
            )}
            {headline}
          </p>
          <span className="text-body-sm font-semibold tabular text-ink-700 dark:text-ink-200">{batch.percentComplete}%</span>
        </div>
        <div
          className="progress-bar mt-2"
          role="progressbar"
          aria-valuenow={batch.percentComplete}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Overall progress"
        >
          <div className="progress-fill !duration-700 ease-out" style={{ width: `${batch.percentComplete}%` }} />
        </div>
        <p className="mt-2 text-body-sm text-ink-700 dark:text-ink-200">
          <span className="font-semibold tabular">{finished}</span> of <span className="font-semibold tabular">{total}</span>{' '}
          {what}
          {!done && stage && <span className="text-ink-500 dark:text-ink-400"> · {STAGE_LABEL[stage]}</span>}
        </p>
        <p className="mt-1 flex flex-wrap gap-x-4 text-body-sm">
            <span className="text-success-700 dark:text-success-400">
              <span className="font-semibold tabular">{succeeded}</span> {ranking ? 'ranked successfully' : 'processed successfully'}
            </span>
            <span className={failedTotal > 0 ? 'text-error-600' : 'text-ink-500 dark:text-ink-400'}>
              <span className="font-semibold tabular">{failedTotal}</span> failed
            </span>
            {skipped > 0 && (
              <span className="text-ink-500 dark:text-ink-400">
                <span className="font-semibold tabular">{skipped}</span> skipped as duplicates
              </span>
            )}
        </p>
        <p className="mt-1 text-body-xs text-ink-500 dark:text-ink-400">
          {done
            ? cancelled
              ? ranking
                ? 'Candidates and anything already scored were kept.'
                : 'Nothing from this upload was kept.'
              : ''
            : `You can close this window; ${ranking ? 'ranking' : 'processing'} will continue in the background.`}
          {error && <span className="ml-2 text-warning-600">Connection problem, retrying…</span>}
        </p>
      </div>

      {collapsible && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="inline-flex cursor-pointer items-center gap-1 text-body-sm font-semibold text-brand-700 hover:underline dark:text-brand-300"
        >
          <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} aria-hidden="true" />
          {open ? 'Hide resume details' : 'Show resume details'}
        </button>
      )}

      {detailed && (
        <ul className="max-h-72 divide-y divide-[var(--color-border)] overflow-y-auto rounded-lg border border-[var(--color-border)]" aria-label={ranking ? 'Candidates being ranked' : 'Uploaded resumes'}>
          {shownTasks.map((t) => {
            const state = rowState(t)
            const problem = state.icon === 'bad' || state.icon === 'warn' || state.icon === 'dup'
            return (
              <li key={t.id} className="flex items-start gap-3 px-3 py-2.5">
                <span className="mt-0.5 flex-shrink-0" aria-hidden="true">
                  {state.icon === 'ok' && <CheckCircle2 className="h-4 w-4 text-success-600" />}
                  {state.icon === 'work' && <Loader2 className="h-4 w-4 animate-spin text-brand-700" />}
                  {state.icon === 'wait' && <Clock className="h-4 w-4 text-ink-400" />}
                  {state.icon === 'bad' && <XCircle className="h-4 w-4 text-error-600" />}
                  {state.icon === 'warn' && <AlertTriangle className="h-4 w-4 text-warning-600" />}
                  {state.icon === 'dup' && <Copy className="h-4 w-4 text-ink-400" />}
                  {state.icon === 'stop' && <Ban className="h-4 w-4 text-ink-400" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body-sm font-medium text-ink-900 dark:text-ink-100" title={t.fileName}>
                    {t.fileName}
                  </p>
                  {t.note && (
                    <p className={cn('text-body-xs', problem ? 'text-ink-600 dark:text-ink-300' : 'text-ink-500 dark:text-ink-400')}>
                      {t.note}
                      {t.status === 'PROCESSING' && t.elapsedSeconds !== null && <span className="tabular"> ({spent(t.elapsedSeconds)} so far)</span>}
                    </p>
                  )}
                  <RowActions batchId={batchId} task={t} onChanged={() => setRestart((n) => n + 1)} />
                </div>
                <span className={cn(state.className, 'flex-shrink-0')}>{state.label}</span>
              </li>
            )
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {done && c.FAILED > 0 && (
          <Button type="button" variant="secondary" size="sm" onClick={retryFailed} loading={retrying}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Retry {c.FAILED} failed
          </Button>
        )}
        {!done && (
          <Button type="button" variant="secondary" size="sm" onClick={() => setConfirmCancel(true)}>
            <X className="h-4 w-4" aria-hidden="true" />
            {batch.ranking > 0 ? 'Stop ranking' : 'Cancel upload'}
          </Button>
        )}
        {done && onDismiss && (
          <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
            Dismiss
          </Button>
        )}
      </div>

      <ConfirmModal
        isOpen={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={cancelBatch}
        loading={cancelling}
        variant="danger"
        title={batch.ranking > 0 ? 'Stop ranking?' : 'Cancel this upload?'}
        message={
          batch.ranking > 0
            ? 'Ranking stops now. Candidates stay, and so do any scores that were already worked out.'
            : 'Every resume still being read is stopped right away, and any request already sent to the AI is abandoned.'
        }
        confirmText={batch.ranking > 0 ? 'Stop ranking' : 'Cancel upload'}
        cancelText="Keep going"
      >
        {batch.ranking > 0
          ? 'You can start it again with Rank candidates.'
          : `Candidates already created from this upload (${c.COMPLETED + c.NEEDS_REVIEW} so far) are removed again, along with their resumes and AI results. This cannot be undone.`}
      </ConfirmModal>
    </section>
  )
}
