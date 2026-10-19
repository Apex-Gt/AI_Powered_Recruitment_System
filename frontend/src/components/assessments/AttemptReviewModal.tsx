import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Modal } from '@/components/ui/Modal'
import { AttemptReview } from '@/components/assessments/AttemptReview'
import { assessmentApi } from '@/utils/api'
import type { AssessmentAttempt } from '@/types'

interface Props {
  /** The attempt to open; null keeps the dialog closed. */
  attemptId: string | null
  title?: string
  onClose: () => void
  /** Called when a recruiter changed a score, so the page behind can refresh its totals. */
  onChanged?: () => void
}

/** Opens one candidate's assessment: their score, their answers and the correct ones. */
export function AttemptReviewModal({ attemptId, title = 'Assessment results', onClose, onChanged }: Props) {
  const [attempt, setAttempt] = useState<AssessmentAttempt | null>(null)

  useEffect(() => {
    setAttempt(null)
    if (!attemptId) return
    let cancelled = false
    assessmentApi
      .getAttempt(attemptId)
      .then((a) => !cancelled && setAttempt(a))
      .catch((error) => {
        if (cancelled) return
        toast.error(error instanceof Error ? error.message : 'Failed to load the results')
        onClose()
      })
    return () => {
      cancelled = true
    }
  }, [attemptId])

  return (
    <Modal isOpen={attemptId !== null} onClose={onClose} title={title} size="xl">
      {attempt ? (
        <AttemptReview
          attempt={attempt}
          onChange={(a) => {
            setAttempt(a)
            onChanged?.()
          }}
        />
      ) : (
        <p className="py-8 text-center text-body-sm text-ink-500">Loading...</p>
      )}
    </Modal>
  )
}
