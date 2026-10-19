import { useCallback, useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/Badge'
import { AttemptReview } from '@/components/assessments/AttemptReview'
import { assessmentApi } from '@/utils/api'
import type { Assessment, AssessmentAttempt } from '@/types'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'

interface Props {
  assessment: Assessment | null
  onClose: () => void
}

const formatWhen = (value?: string) => (value ? new Date(value).toLocaleString() : '-')

export function AssessmentResultsModal({ assessment, onClose }: Props) {
  const [attempts, setAttempts] = useState<AssessmentAttempt[]>([])
  const [detail, setDetail] = useState<AssessmentAttempt | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const load = useCallback(async () => {
    if (!assessment) return
    setIsLoading(true)
    try {
      setAttempts(await assessmentApi.getAttempts({ assessmentId: assessment.id }))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load results')
    } finally {
      setIsLoading(false)
    }
  }, [assessment])

  useEffect(() => {
    setDetail(null)
    setAttempts([])
    void load()
  }, [load])

  const open = async (attempt: AssessmentAttempt) => {
    try {
      setDetail(await assessmentApi.getAttempt(attempt.id))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load attempt')
    }
  }

  const back = () => {
    setDetail(null)
    void load()
  }

  return (
    <Modal isOpen={!!assessment} onClose={onClose} title={`Results: ${assessment?.title ?? ''}`} size="xl">
      {detail ? (
        <div className="space-y-4">
          <Button type="button" variant="ghost" size="sm" onClick={back}>
            <ArrowLeft className="w-4 h-4" />
            All attempts
          </Button>
          <AttemptReview attempt={detail} onChange={setDetail} />
        </div>
      ) : isLoading ? (
        <p className="text-body-sm text-ink-500 py-8 text-center">Loading...</p>
      ) : attempts.length === 0 ? (
        <p className="text-body-md text-ink-500 dark:text-ink-400 py-8 text-center">
          Nobody has been sent this assessment yet.
        </p>
      ) : (
        <div className="divide-y divide-base-200 dark:divide-base-700">
          {attempts.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => open(a)}
              className="w-full flex items-center justify-between gap-4 py-3 px-1 text-left hover:bg-base-50 dark:hover:bg-base-800/50 rounded-lg"
            >
              <div>
                <p className="font-medium text-ink-900 dark:text-ink-100">{a.candidateName}</p>
                <p className="text-body-xs text-ink-500 dark:text-ink-400">
                  Sent {formatWhen(a.assignedAt)}{a.submittedAt ? `, submitted ${formatWhen(a.submittedAt)}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {a.pendingReview > 0 && (
                  <span className="text-body-xs text-info-600 dark:text-info-400">{a.pendingReview} to review</span>
                )}
                {a.totalScore != null && (
                  <span className="text-body-md font-semibold text-ink-900 dark:text-ink-100">{a.totalScore}%</span>
                )}
                <StatusBadge status={a.status} />
                <ChevronRight className="w-4 h-4 text-ink-400" />
              </div>
            </button>
          ))}
        </div>
      )}
    </Modal>
  )
}
