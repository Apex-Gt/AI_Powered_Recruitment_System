import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock, Copy, Loader2, RotateCcw, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { batchApi, type Batch, type BatchTask, type BatchTaskStage } from '@/utils/api'
import { Button } from '@/components/ui/Button'
import { cn } from '@/utils/helpers'

const TERMINAL = new Set(['COMPLETED', 'PARTIAL', 'FAILED'])
const POLL_MS = 2500

/** What the pipeline is doing right now, in the present tense; shown beside the count and under a processing resume. */
const STAGE_LABEL: Record<BatchTaskStage, string> = {
  EXTRACT: 'Ingesting',
  PERSIST: 'Saving the candidate',
  PROFILE: 'Extracting skills and experience',
  INDEX: 'Building the search index',
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

const CODE_HELP: Record<string, string> = {
  ENCRYPTED_FILE: 'The PDF is password protected. Upload an unlocked copy.',
  CORRUPT_FILE: 'The file is damaged and cannot be opened.',
  UNSUPPORTED_TYPE: 'Only PDF, DOCX and TXT resumes are supported.',
  INVALID_CONTENT: 'The file content does not match its extension.',
  EMPTY_FILE: 'The file is empty.',
  FILE_TOO_LARGE: 'The file is too large (limit 10 MB).',
  NO_EMAIL: 'No email address was found, so a candidate could not be created.',
  SCANNED_PDF: 'This looks like a scanned image with no readable text.',
  DUPLICATE_FILE: 'This exact file is already in this job.',
  DUPLICATE_APPLICANT: 'This person has already applied for this job.',
  LLM_UNAVAILABLE: 'The language model was unavailable. Retry once it is running.',
  VECTOR_STORE_UNAVAILABLE: 'The search index was unavailable. Retry once it is running.',
  EMBEDDING_UNAVAILABLE: 'The embedding model was unavailable. Retry once it is running.',
}

function describe(task: BatchTask): string {
  return CODE_HELP[task.errorCode ?? ''] ?? task.errorMessage ?? 'Something went wrong.'
}

/** "less than a minute", "3 minutes", "1.5 hours": rounded, because the estimate is rough anyway. */
function timeLeft(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) return ''
  if (seconds < 60) return 'less than a minute'
  const minutes = Math.round(seconds / 60)
  return minutes < 90 ? `about ${minutes} minute${minutes === 1 ? '' : 's'}` : `about ${(minutes / 60).toFixed(1)} hours`
}

function took(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return ''
  if (seconds < 60) return 'under a minute'
  const minutes = Math.round(seconds / 60)
  return minutes < 90 ? `${minutes} minute${minutes === 1 ? '' : 's'}` : `${(minutes / 60).toFixed(1)} hours`
}

type RowIcon = 'wait' | 'work' | 'ok' | 'bad' | 'warn' | 'dup'

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
    default:
      return { label: 'Pending', className: 'badge-default', icon: 'wait' }
  }
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
  compact?: boolean
}

/** Live progress of one bulk upload: overall bar and counts, then every resume with its own status. */
export function BatchProgress({ batchId, onFinished, compact = false }: Props) {
  const [batch, setBatch] = useState<Batch | null>(null)
  const [tasks, setTasks] = useState<BatchTask[]>([])
  const [error, setError] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)
  const finishedRef = useRef(false)
  const onFinishedRef = useRef(onFinished)
  onFinishedRef.current = onFinished

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    finishedRef.current = false

    const tick = async () => {
      try {
        const next = await batchApi.get(batchId)
        const list = compact
          ? (await batchApi.tasks(batchId, { status: 'PROCESSING', size: 10 })).items // just enough to name the current step
          : await fetchAllTasks(batchId)
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
  }, [batchId, compact, retrying])

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

  if (!batch) {
    return (
      <div className="flex items-center gap-2 text-body-sm text-ink-600 dark:text-ink-300" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        {error ?? 'Reading progress…'}
      </div>
    )
  }

  const c = batch.counts
  const active = c.QUEUED + c.PROCESSING + c.UPLOADED
  const finished = batch.totalFiles - active
  const failedCount = c.FAILED + c.NEEDS_REVIEW
  const done = TERMINAL.has(batch.status)
  const stage = dominantStage(tasks.filter((t) => t.status === 'PROCESSING'))
  const left = timeLeft(batch.estimatedSecondsRemaining)

  const headline = done
    ? batch.status === 'COMPLETED'
      ? 'All resumes are processed'
      : batch.status === 'FAILED'
        ? 'None of these resumes could be processed'
        : 'Finished, but some resumes need attention'
    : 'Processing resumes...'

  return (
    <section aria-label="Resume processing progress" className="space-y-4">
      <div>
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-body-md font-semibold text-ink-900 dark:text-ink-100" role="status" aria-live="polite">
            {done ? (
              batch.status === 'COMPLETED' ? (
                <CheckCircle2 className="h-5 w-5 text-success-600" aria-hidden="true" />
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
          <div className="progress-fill" style={{ width: `${batch.percentComplete}%` }} />
        </div>
        <p className="mt-2 text-body-sm text-ink-700 dark:text-ink-200">
          <span className="font-semibold tabular">{finished}</span> of <span className="font-semibold tabular">{batch.totalFiles}</span> resumes completed
          {failedCount > 0 && <span className="text-error-600"> · {failedCount} failed</span>}
          {!done && stage && <span className="text-ink-500 dark:text-ink-400"> · {STAGE_LABEL[stage]}</span>}
        </p>
        <p className="mt-1 text-body-xs text-ink-500 dark:text-ink-400">
          {done
            ? `Finished in ${took(batch.elapsedSeconds)}.`
            : `This may take a few minutes.${left ? ` ${left[0].toUpperCase()}${left.slice(1)} left.` : ''} You can close this window; processing continues in the background.`}
          {error && <span className="ml-2 text-warning-600">Connection problem, retrying…</span>}
        </p>
      </div>

      {!compact && (
        <ul className="max-h-72 divide-y divide-[var(--color-border)] overflow-y-auto rounded-lg border border-[var(--color-border)]" aria-label="Uploaded resumes">
          {tasks.map((t) => {
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
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body-sm font-medium text-ink-900 dark:text-ink-100" title={t.fileName}>
                    {t.fileName}
                  </p>
                  {t.status === 'PROCESSING' && <p className="text-body-xs text-ink-500 dark:text-ink-400">{STAGE_LABEL[t.stage]}</p>}
                  {problem && <p className="text-body-xs text-ink-600 dark:text-ink-300">{describe(t)}</p>}
                </div>
                <span className={cn(state.className, 'flex-shrink-0')}>{state.label}</span>
              </li>
            )
          })}
        </ul>
      )}

      {done && c.FAILED > 0 && (
        <Button type="button" variant="secondary" size="sm" onClick={retryFailed} loading={retrying}>
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Retry {c.FAILED} failed
        </Button>
      )}
    </section>
  )
}
