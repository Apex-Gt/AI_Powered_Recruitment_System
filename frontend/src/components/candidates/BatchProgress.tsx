import { useEffect, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, Copy, Loader2, RotateCcw, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { batchApi, type Batch, type BatchTask, type BatchTaskStage, type BatchTaskStatus } from '@/utils/api'
import { Button } from '@/components/ui/Button'
import { cn } from '@/utils/helpers'

const TERMINAL = new Set(['COMPLETED', 'PARTIAL', 'FAILED'])
const POLL_MS = 2500

/** What the pipeline is doing right now, in the present tense; shown in the headline and per resume. */
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

function duration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return ''
  if (seconds < 90) return `${Math.max(1, Math.round(seconds))} s`
  const minutes = Math.round(seconds / 60)
  return minutes < 90 ? `${minutes} min` : `${(minutes / 60).toFixed(1)} h`
}

interface Props {
  batchId: string
  /** Fires once, when every resume has reached a final state. */
  onFinished?: (batch: Batch) => void
  compact?: boolean
}

/** Live progress of one bulk upload: a bar, counts, and the reason for every resume that needs attention. */
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
          ? await batchApi.tasks(batchId, { status: 'PROCESSING', size: 10 }) // just enough to name the current step
          : await batchApi.tasks(batchId)
        if (cancelled) return
        setBatch(next)
        if (list) setTasks(list.items)
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
  const done = TERMINAL.has(batch.status)
  const attention = tasks.filter((t) => t.status === 'FAILED' || t.status === 'NEEDS_REVIEW' || t.status === 'DUPLICATE')
  const working = tasks.filter((t) => t.status === 'PROCESSING')
  const stage = dominantStage(working)

  const headline = done
    ? batch.status === 'COMPLETED'
      ? `All ${c.COMPLETED} resumes are analysed`
      : batch.status === 'FAILED'
        ? 'None of these resumes could be processed'
        : `${c.COMPLETED} analysed, ${c.FAILED + c.NEEDS_REVIEW} need attention`
    : stage
      ? STAGE_LABEL[stage]
      : active === c.QUEUED + c.UPLOADED && c.PROCESSING === 0
        ? 'Waiting to start'
        : 'Getting ready'

  const chips: { key: BatchTaskStatus; label: string; className: string }[] = [
    { key: 'COMPLETED', label: 'Analysed', className: 'badge-success' },
    { key: 'PROCESSING', label: 'Working', className: 'badge-primary' },
    { key: 'QUEUED', label: 'Waiting', className: 'badge-default' },
    { key: 'NEEDS_REVIEW', label: 'Needs review', className: 'badge-warning' },
    { key: 'FAILED', label: 'Failed', className: 'badge-error' },
    { key: 'DUPLICATE', label: 'Duplicates', className: 'badge-default' },
  ]

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
            {!done && <span className="animate-pulse" aria-hidden="true">…</span>}
          </p>
          <span className="text-body-sm font-semibold tabular text-ink-700 dark:text-ink-200">{batch.percentComplete}%</span>
        </div>
        <div
          className="progress-bar mt-2"
          role="progressbar"
          aria-valuenow={batch.percentComplete}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Batch progress"
        >
          <div className="progress-fill" style={{ width: `${batch.percentComplete}%` }} />
        </div>
        <p className="mt-2 text-body-xs text-ink-500 dark:text-ink-400">
          {!done && `Resume ${Math.min(finished + 1, batch.totalFiles)} of ${batch.totalFiles}. `}
          {done
            ? `Finished in ${duration(batch.elapsedSeconds)}.`
            : batch.estimatedSecondsRemaining
              ? `About ${duration(batch.estimatedSecondsRemaining)} left${batch.resumesPerMinute ? ` at ${batch.resumesPerMinute} resumes a minute` : ''}. You can close this window; processing continues.`
              : 'You can close this window; processing continues in the background.'}
          {error && <span className="ml-2 text-warning-600">Connection problem, retrying…</span>}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {chips
          .filter((chip) => c[chip.key] > 0)
          .map((chip) => (
            <span key={chip.key} className={cn(chip.className, 'gap-1.5')}>
              <span className="tabular font-semibold">{c[chip.key]}</span> {chip.label}
            </span>
          ))}
      </div>

      {!compact && working.length > 0 && (
        <ul className="space-y-1 text-body-xs text-ink-600 dark:text-ink-300" aria-label="Resumes being processed now">
          {working.slice(0, 4).map((t) => (
            <li key={t.id} className="flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-700" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{t.fileName}</span>
              <span className="text-ink-400">{STAGE_LABEL[t.stage]}</span>
            </li>
          ))}
        </ul>
      )}

      {!compact && attention.length > 0 && (
        <div>
          <p className="mb-2 text-body-xs font-semibold text-ink-700 dark:text-ink-200">Needs a look</p>
          <ul className="max-h-56 space-y-2 overflow-y-auto pr-1">
            {attention.map((t) => (
              <li key={t.id} className="rounded-lg border border-[var(--color-border)] p-2.5">
                <div className="flex items-center gap-2">
                  {t.status === 'DUPLICATE' ? (
                    <Copy className="h-4 w-4 flex-shrink-0 text-ink-400" aria-hidden="true" />
                  ) : t.status === 'NEEDS_REVIEW' ? (
                    <AlertTriangle className="h-4 w-4 flex-shrink-0 text-warning-600" aria-hidden="true" />
                  ) : (
                    <AlertCircle className="h-4 w-4 flex-shrink-0 text-error-600" aria-hidden="true" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-body-xs font-medium text-ink-800 dark:text-ink-100">{t.fileName}</span>
                </div>
                <p className="mt-1 pl-6 text-body-xs text-ink-600 dark:text-ink-300">{describe(t)}</p>
              </li>
            ))}
          </ul>
        </div>
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
