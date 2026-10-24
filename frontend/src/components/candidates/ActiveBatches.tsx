import { useEffect, useState } from 'react'
import { batchApi } from '@/utils/api'
import { BatchProgress } from '@/components/candidates/BatchProgress'

const LIST_POLL_MS = 8000
/** A finished batch stays on the page this long, so its per-resume results can still be read. */
const KEEP_FINISHED_MS = 30 * 60 * 1000
const DISMISSED_KEY = 'dismissed-batches'
/** Remembers, per job, that a batch was running when this browser last looked, so a reload can pick its progress up. */
const activeKey = (jobId: string) => `active-batch:${jobId}`

function readActive(jobId: string): boolean {
  try {
    return localStorage.getItem(activeKey(jobId)) === '1'
  } catch {
    return false
  }
}

function writeActive(jobId: string, active: boolean) {
  try {
    if (active) localStorage.setItem(activeKey(jobId), '1')
    else localStorage.removeItem(activeKey(jobId))
  } catch {
    // Without storage a reload simply does not resume the progress display.
  }
}

const ACTIVE = new Set(['UPLOADED', 'QUEUED', 'PROCESSING'])

function readDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}

interface Props {
  jobId: string
  /** Called when a batch finishes or is cancelled, so the page can reload its candidates. */
  onFinished?: () => void
  /** Change this to look for batches straight away (for example right after ranking was started). */
  refreshKey?: number
}

/**
 * Shows the resume batches of a job that are running, or finished recently, with the same per-resume detail as the
 * upload window. Progress therefore stays visible after the window is closed or the page is reloaded, and it can be
 * cancelled from here. Renders nothing when there is no such batch.
 */
export function ActiveBatches({ jobId, onFinished, refreshKey = 0 }: Props) {
  const [shown, setShown] = useState<string[]>([])
  const [dismissed, setDismissed] = useState<string[]>(readDismissed)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let running = false

    const load = async () => {
      try {
        const batches = await batchApi.forJob(jobId)
        if (cancelled) return
        const now = Date.now()
        const visible = batches
          .filter((b) => ACTIVE.has(b.status) || (b.completedAt !== null && now - new Date(b.completedAt).getTime() < KEEP_FINISHED_MS))
          .map((b) => b.id)
        setShown((prev) => (prev.join() === visible.join() ? prev : visible))
        // Nothing running: stop asking. A new upload or ranking changes refreshKey, which starts this again.
        running = batches.some((b) => ACTIVE.has(b.status))
        writeActive(jobId, running)
        if (!running) return
      } catch {
        // Progress is a convenience: if the list cannot be read right now, try again on the next tick.
      }
      if (!cancelled && !document.hidden) timer = setTimeout(load, LIST_POLL_MS)
    }
    // A hidden tab stops polling; coming back checks straight away and carries on if something is still running.
    const onVisible = () => {
      if (running && !document.hidden && !cancelled) {
        if (timer) clearTimeout(timer)
        void load()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    // No request at all unless an upload or ranking was just started here, or one was running when we last looked.
    if (refreshKey > 0 || readActive(jobId)) void load()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [jobId, refreshKey])

  const dismiss = (id: string) => {
    const next = [...dismissed, id]
    setDismissed(next)
    try {
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(next.slice(-50)))
    } catch {
      // Dismissing then only lasts until the page is reloaded.
    }
  }

  const visible = shown.filter((id) => !dismissed.includes(id))
  if (visible.length === 0) return null

  return (
    <div className="mt-4 space-y-3" aria-label="Resume processing">
      {visible.map((id) => (
        <div key={`${id}:${refreshKey}`} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <BatchProgress batchId={id} collapsible onFinished={onFinished} onDismiss={() => dismiss(id)} />
        </div>
      ))}
    </div>
  )
}
