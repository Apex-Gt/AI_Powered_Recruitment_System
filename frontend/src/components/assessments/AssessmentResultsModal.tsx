import { useCallback, useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { StatusBadge } from '@/components/ui/Badge'
import { assessmentApi } from '@/utils/api'
import type { Assessment, AssessmentAttempt, AttemptAnswer } from '@/types'
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
        <AttemptDetail attempt={detail} onChange={setDetail} onBack={back} />
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
                  Sent {formatWhen(a.assignedAt)}{a.submittedAt ? ` - submitted ${formatWhen(a.submittedAt)}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {a.pendingReview > 0 && (
                  <span className="text-body-xs text-warning-600 dark:text-warning-400">{a.pendingReview} to review</span>
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

function AttemptDetail({ attempt, onChange, onBack }: {
  attempt: AssessmentAttempt
  onChange: (a: AssessmentAttempt) => void
  onBack: () => void
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
          All attempts
        </Button>
        <div className="flex items-center gap-3">
          {attempt.totalScore != null && <span className="text-heading-md font-bold text-ink-900 dark:text-ink-100">{attempt.totalScore}%</span>}
          <StatusBadge status={attempt.status} />
        </div>
      </div>
      <p className="text-body-sm text-ink-500 dark:text-ink-400">
        {attempt.candidateName} - started {formatWhen(attempt.startedAt)}, submitted {formatWhen(attempt.submittedAt)}
      </p>

      {!attempt.answers || attempt.answers.length === 0 ? (
        <p className="text-body-md text-ink-500 dark:text-ink-400 py-6 text-center">No answers yet.</p>
      ) : (
        attempt.answers.map((answer, i) => (
          <AnswerCard key={answer.id} index={i} attemptId={attempt.id} answer={answer} canGrade={attempt.status === 'SUBMITTED' || attempt.status === 'GRADED'} onChange={onChange} />
        ))
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
    <div className="rounded-xl border border-base-200 dark:border-base-700 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium text-ink-900 dark:text-ink-100">
          {index + 1}. {answer.question}
        </p>
        <span className="text-body-xs text-ink-500 dark:text-ink-400 whitespace-nowrap">
          {answer.type.replace('_', ' ').toLowerCase()} - weight {answer.weight}
        </span>
      </div>

      <pre className="whitespace-pre-wrap break-words text-body-sm bg-base-50 dark:bg-base-800/50 rounded-lg p-3 font-mono">
        {answer.answer || '(no answer)'}
      </pre>
      {answer.correctAnswer && (
        <p className="text-body-xs text-ink-500 dark:text-ink-400">Correct answer: {answer.correctAnswer}</p>
      )}

      {answer.needsReview && (
        <p className="text-body-xs text-warning-600 dark:text-warning-400">
          This answer could not be graded automatically. Please score it.
        </p>
      )}
      {answer.feedback && !canGrade && <p className="text-body-sm text-ink-600 dark:text-ink-300">{answer.feedback}</p>}

      {canGrade && (
        <div className="grid grid-cols-1 md:grid-cols-[8rem_1fr_auto] gap-3 items-end">
          <Input label="Score (0-100)" type="number" min={0} max={100} value={score} onChange={(e) => setScore(e.target.value)} />
          <Textarea label="Feedback" value={feedback} onChange={(e) => setFeedback(e.target.value)} />
          <Button type="button" size="sm" loading={isSaving} onClick={save}>
            Save
          </Button>
        </div>
      )}
    </div>
  )
}
