import { useEffect, useState } from 'react'
import { batchApi } from '@/utils/api'
import { BatchProgress } from '@/components/candidates/BatchProgress'

const LIST_POLL_MS = 8000

interface Props {
  jobId: string
  /** Called when a batch finishes, so the page can reload its candidates. */
  onFinished?: () => void
}

/**
 * Shows every resume batch of a job that is still being processed, so progress stays visible after the upload
 * window is closed or the page is reloaded. Renders nothing when there is no active batch.
 */
export function ActiveBatches({ jobId, onFinished }: Props) {
  const [activeIds, setActiveIds] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const load = async () => {
      try {
        const batches = await batchApi.forJob(jobId)
        if (cancelled) return
        const active = batches.filter((b) => b.status === 'UPLOADED' || b.status === 'QUEUED' || b.status === 'PROCESSING').map((b) => b.id)
        setActiveIds((prev) => (prev.join() === active.join() ? prev : active))
      } catch {
        // Progress is a convenience: if the list cannot be read right now, try again on the next tick.
      }
      if (!cancelled) timer = setTimeout(load, LIST_POLL_MS)
    }
    void load()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [jobId])

  if (activeIds.length === 0) return null

  return (
    <div className="mt-4 space-y-3" aria-label="Resumes being processed">
      {activeIds.map((id) => (
        <div key={id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <BatchProgress batchId={id} compact onFinished={onFinished} />
        </div>
      ))}
    </div>
  )
}
