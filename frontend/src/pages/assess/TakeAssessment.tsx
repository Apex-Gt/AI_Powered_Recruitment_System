import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Input'
import { publicAssessmentApi } from '@/utils/api'
import type { PublicAssessment } from '@/types'
import { CheckCircle2, Clock, AlertTriangle } from 'lucide-react'

type Phase = 'loading' | 'invalid' | 'intro' | 'running' | 'submitting' | 'done' | 'closed'

const storageKey = (token: string) => `assessment-answers-${token}`

function loadSaved(token: string): Record<string, string> {
  try {
    return JSON.parse(sessionStorage.getItem(storageKey(token)) ?? '{}')
  } catch {
    return {}
  }
}

function formatClock(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** Public page reached from the emailed link. No account: the token in the URL is the credential. */
export function TakeAssessment() {
  const { token = '' } = useParams()
  const [phase, setPhase] = useState<Phase>('loading')
  const [assessment, setAssessment] = useState<PublicAssessment | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>(() => loadSaved(token))
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [message, setMessage] = useState('')
  const endsAt = useRef(0)
  const submitting = useRef(false)

  const showStatus = useCallback((a: PublicAssessment) => {
    setAssessment(a)
    if (a.status === 'ASSIGNED' || a.status === 'IN_PROGRESS') {
      setPhase('intro')
    } else if (a.status === 'EXPIRED') {
      setMessage('This assessment link has expired or the time ran out. Please contact the recruiter if you need another one.')
      setPhase('closed')
    } else {
      setPhase('done')
    }
  }, [])

  useEffect(() => {
    publicAssessmentApi.get(token).then(showStatus).catch(() => setPhase('invalid'))
  }, [token, showStatus])

  const start = async () => {
    try {
      const a = await publicAssessmentApi.start(token)
      setAssessment(a)
      endsAt.current = Date.now() + (a.secondsLeft ?? 0) * 1000
      setSecondsLeft(a.secondsLeft ?? 0)
      setPhase('running')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not start the assessment')
      setPhase('closed')
    }
  }

  const submit = useCallback(async () => {
    if (submitting.current) return
    submitting.current = true
    setPhase('submitting')
    try {
      await publicAssessmentApi.submit(token, answers)
      try {
        sessionStorage.removeItem(storageKey(token))
      } catch {
        /* storage unavailable */
      }
      setPhase('done')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not submit your answers')
      setPhase('closed')
    } finally {
      submitting.current = false
    }
  }, [token, answers])

  // Countdown; sends whatever has been answered when time runs out.
  useEffect(() => {
    if (phase !== 'running') return
    const timer = window.setInterval(() => {
      const left = Math.max(0, Math.round((endsAt.current - Date.now()) / 1000))
      setSecondsLeft(left)
      if (left === 0) {
        window.clearInterval(timer)
        void submit()
      }
    }, 1000)
    return () => window.clearInterval(timer)
  }, [phase, submit])

  useEffect(() => {
    if (phase !== 'running') return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [phase])

  const setAnswer = (id: string, value: string) => {
    setAnswers((prev) => {
      const next = { ...prev, [id]: value }
      try {
        sessionStorage.setItem(storageKey(token), JSON.stringify(next))
      } catch {
        /* storage unavailable: answers still live in memory */
      }
      return next
    })
  }

  const unanswered = assessment?.questions?.filter((q) => !answers[q.id]?.trim()).length ?? 0

  return (
    <div className="min-h-screen bg-base-50 dark:bg-base-900 px-4 py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        {phase === 'loading' && <p className="text-center text-ink-500">Loading...</p>}

        {phase === 'invalid' && (
          <Notice icon={<AlertTriangle className="w-10 h-10 text-warning-500" />} title="This link is not valid">
            Check that you opened the full link from your email.
          </Notice>
        )}

        {phase === 'closed' && (
          <Notice icon={<AlertTriangle className="w-10 h-10 text-warning-500" />} title="Assessment unavailable">
            {message}
          </Notice>
        )}

        {phase === 'done' && (
          <Notice icon={<CheckCircle2 className="w-10 h-10 text-success-500" />} title="Thank you">
            Your answers were submitted to {assessment?.companyName}. You can close this page.
          </Notice>
        )}

        {phase === 'intro' && assessment && (
          <div className="card p-8 space-y-5">
            <div>
              <p className="text-body-sm text-ink-500 dark:text-ink-400">{assessment.companyName}</p>
              <h1 className="text-heading-xl font-extrabold text-ink-900 dark:text-ink-100">{assessment.title}</h1>
            </div>
            <p className="text-body-md text-ink-700 dark:text-ink-200">
              Hi {assessment.candidateName}, this assessment has {assessment.questionCount} questions and a time limit of{' '}
              <strong>{assessment.duration} minutes</strong>.
            </p>
            <ul className="list-disc pl-5 text-body-sm text-ink-600 dark:text-ink-300 space-y-1">
              <li>The timer starts when you press the button and cannot be paused.</li>
              <li>Your answers are sent automatically when time runs out.</li>
              <li>You can only take this assessment once.</li>
            </ul>
            <Button size="lg" onClick={start}>
              {assessment.status === 'IN_PROGRESS' ? 'Continue assessment' : 'Start assessment'}
            </Button>
          </div>
        )}

        {(phase === 'running' || phase === 'submitting') && assessment?.questions && (
          <>
            <div className="sticky top-0 z-10 flex items-center justify-between rounded-xl bg-base-50/90 dark:bg-base-900/90 backdrop-blur px-4 py-3 border border-base-200 dark:border-base-700">
              <h1 className="font-semibold text-ink-900 dark:text-ink-100">{assessment.title}</h1>
              <div className={`flex items-center gap-2 font-mono text-heading-md ${secondsLeft <= 60 ? 'text-error-600' : 'text-ink-900 dark:text-ink-100'}`}>
                <Clock className="w-5 h-5" />
                {formatClock(secondsLeft)}
              </div>
            </div>

            {assessment.questions.map((q, i) => (
              <div key={q.id} className="card p-6 space-y-4">
                <p className="font-medium text-ink-900 dark:text-ink-100 whitespace-pre-wrap">
                  {i + 1}. {q.question}
                </p>

                {q.type === 'MULTIPLE_CHOICE' && (
                  <div className="space-y-2">
                    {q.options.map((option) => (
                      <label key={option} className="flex items-center gap-3 rounded-lg border border-base-200 dark:border-base-700 px-3 py-2 cursor-pointer">
                        <input
                          type="radio"
                          name={q.id}
                          checked={answers[q.id] === option}
                          onChange={() => setAnswer(q.id, option)}
                        />
                        <span className="text-body-md text-ink-800 dark:text-ink-100">{option}</span>
                      </label>
                    ))}
                  </div>
                )}

                {q.type === 'CODE' && (
                  <textarea
                    className="input min-h-[220px] font-mono text-body-sm"
                    spellCheck={false}
                    placeholder="Write your code here"
                    value={answers[q.id] ?? ''}
                    onChange={(e) => setAnswer(q.id, e.target.value)}
                  />
                )}

                {q.type === 'ESSAY' && (
                  <Textarea
                    placeholder="Write your answer"
                    value={answers[q.id] ?? ''}
                    onChange={(e) => setAnswer(q.id, e.target.value)}
                  />
                )}

                {q.type === 'VIDEO' && (
                  <div className="space-y-1">
                    <input
                      className="input"
                      type="url"
                      placeholder="https://... link to your recorded video answer"
                      value={answers[q.id] ?? ''}
                      onChange={(e) => setAnswer(q.id, e.target.value)}
                    />
                    <p className="text-body-xs text-ink-500 dark:text-ink-400">Upload your video somewhere private-link capable and paste the link.</p>
                  </div>
                )}
              </div>
            ))}

            <div className="flex items-center justify-between">
              <p className="text-body-sm text-ink-500 dark:text-ink-400">
                {unanswered === 0 ? 'All questions answered' : `${unanswered} unanswered`}
              </p>
              <Button
                size="lg"
                loading={phase === 'submitting'}
                onClick={() => {
                  if (unanswered === 0 || confirm(`${unanswered} question(s) are unanswered. Submit anyway?`)) void submit()
                }}
              >
                Submit answers
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Notice({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="card p-10 text-center space-y-3 flex flex-col items-center">
      {icon}
      <h1 className="text-heading-lg font-bold text-ink-900 dark:text-ink-100">{title}</h1>
      <p className="text-body-md text-ink-600 dark:text-ink-300">{children}</p>
    </div>
  )
}
