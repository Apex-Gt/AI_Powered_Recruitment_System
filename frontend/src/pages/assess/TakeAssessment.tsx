import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { publicAssessmentApi } from '@/utils/api'
import type { PublicAssessment } from '@/types'
import { CheckCircle2, AlertTriangle, ChevronLeft, ChevronRight, Play } from 'lucide-react'
import { cn } from '@/utils/helpers'
import { BriefingFacts, DoDontStep, IssuesStep, RoundsStep, RulesStep } from '@/components/assessments/AssessmentBriefing'
import { CandidateShell } from '@/components/assessments/CandidateShell'
import { RoundExam } from '@/components/assessments/RoundExam'

/**
 * intro: the briefing before the test. transition: a round was submitted, the next one starts by itself in a few
 * seconds. running/submitting: a round is on screen. done: the last round was submitted.
 */
type Phase = 'loading' | 'invalid' | 'intro' | 'transition' | 'running' | 'submitting' | 'done' | 'closed'

/** Seconds between one round ending and the next one starting on its own. */
const AUTO_START_SECONDS = 3

interface RoundSummary {
  title: string
  answered: number
  total: number
}

const answersKey = (token: string) => `assessment-answers-${token}`
const summaryKey = (token: string) => `assessment-summary-${token}`
const flagsKey = (token: string) => `assessment-flags-${token}`

function load<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(sessionStorage.getItem(key) ?? 'null') ?? fallback
  } catch {
    return fallback
  }
}

function save(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable: it still lives in memory */
  }
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** Public page reached from the emailed link. No account: the token in the URL is the credential. */
export function TakeAssessment() {
  const { token = '' } = useParams()
  const [phase, setPhase] = useState<Phase>('loading')
  const [assessment, setAssessment] = useState<PublicAssessment | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>(() => load(answersKey(token), {}))
  const [summaries, setSummaries] = useState<RoundSummary[]>(() => load(summaryKey(token), []))
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [message, setMessage] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [readRules, setReadRules] = useState(false)
  // The pre-test briefing is read one step at a time; the last step holds the terms and unlocks Start.
  const [step, setStep] = useState(0)
  const [furthestStep, setFurthestStep] = useState(0)
  const stepPanel = useRef<HTMLDivElement>(null)
  const [starting, setStarting] = useState(false)
  const [countdown, setCountdown] = useState(AUTO_START_SECONDS)
  // The clock lives on the server: this is only the local time at which the server says the round ends.
  const endsAt = useRef(0)
  const submitting = useRef(false)
  const startingRef = useRef(false)

  const clearSaved = useCallback(() => {
    try {
      sessionStorage.removeItem(answersKey(token))
      sessionStorage.removeItem(summaryKey(token))
      sessionStorage.removeItem(flagsKey(token))
    } catch {
      /* storage unavailable */
    }
  }, [token])

  // Starts the assessment (first time, with the terms) or the next round, or picks a running round back up after
  // a reload. The server decides how much time is left, so refreshing the page can never reset the timer.
  const startRound = useCallback(
    async (acceptedTerms: boolean) => {
      if (startingRef.current) return
      startingRef.current = true
      setStarting(true)
      try {
        const a = await publicAssessmentApi.start(token, acceptedTerms)
        endsAt.current = Date.now() + (a.secondsLeft ?? 0) * 1000
        setSecondsLeft(a.secondsLeft ?? 0)
        setAssessment(a)
        setPhase('running')
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Could not start the assessment')
        setPhase('closed')
      } finally {
        startingRef.current = false
        setStarting(false)
      }
    },
    [token]
  )

  const showStatus = useCallback(
    (a: PublicAssessment) => {
      setAssessment(a)
      if (a.status === 'ASSIGNED') {
        setPhase('intro')
      } else if (a.status === 'IN_PROGRESS') {
        if (a.roundRunning) void startRound(false) // reloaded mid-round: carry on with the time that is left
        else setPhase('transition')
      } else if (a.status === 'EXPIRED') {
        setMessage('This assessment link has expired or the time ran out. Please contact the recruiter if you need another one.')
        setPhase('closed')
      } else {
        clearSaved()
        setPhase('done')
      }
    },
    [clearSaved, startRound]
  )

  useEffect(() => {
    publicAssessmentApi.get(token).then(showStatus).catch(() => setPhase('invalid'))
  }, [token])

  const submit = useCallback(async () => {
    if (submitting.current || !assessment) return
    submitting.current = true
    const questions = assessment.questions ?? []
    const summary: RoundSummary = {
      title: assessment.rounds[assessment.currentRound ?? 0]?.title ?? 'Round',
      answered: questions.filter((q) => answers[q.id]?.trim()).length,
      total: questions.length,
    }
    setPhase('submitting')
    try {
      const next = await publicAssessmentApi.submit(token, answers)
      const updated = [...summaries, summary]
      setSummaries(updated)
      save(summaryKey(token), updated)
      showStatus(next)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not submit your answers')
      setPhase('closed')
    } finally {
      submitting.current = false
    }
  }, [assessment, answers, summaries, token, showStatus])

  // Countdown for the running round; submits whatever has been answered when its time runs out, and the next
  // round then starts by itself.
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

  // Between rounds: a short pause to read what is next, then the next round begins on its own.
  useEffect(() => {
    if (phase !== 'transition') return
    setCountdown(AUTO_START_SECONDS)
    const timer = window.setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          window.clearInterval(timer)
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [phase])

  useEffect(() => {
    if (phase === 'transition' && countdown === 0) void startRound(false)
  }, [phase, countdown, startRound])

  useEffect(() => {
    if (phase !== 'running') return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [phase])

  // A new step starts at the top, and keyboard / screen-reader users land on it
  useEffect(() => {
    if (phase !== 'intro') return
    window.scrollTo({ top: 0 })
    stepPanel.current?.focus({ preventScroll: true })
  }, [phase, step])

  const setAnswer = (id: string, value: string) => {
    setAnswers((prev) => {
      const next = { ...prev, [id]: value }
      save(answersKey(token), next)
      return next
    })
  }

  const rounds = assessment?.rounds ?? []
  const roundIndex = assessment?.currentRound ?? 0
  const round = rounds[roundIndex]
  const hasTerms = Boolean(assessment?.termsAndConditions?.trim())
  const company = assessment?.companyName

  if ((phase === 'running' || phase === 'submitting') && assessment?.questions && round) {
    return (
      <RoundExam
        token={token}
        companyName={assessment.companyName}
        title={assessment.title}
        roundTitle={round.title}
        roundDescription={round.description}
        roundNumber={roundIndex + 1}
        roundCount={rounds.length}
        questions={assessment.questions}
        answers={answers}
        onAnswer={setAnswer}
        secondsLeft={secondsLeft}
        submitting={phase === 'submitting'}
        onSubmit={() => void submit()}
      />
    )
  }

  if (phase === 'loading') {
    return (
      <CandidateShell narrow>
        <p className="py-10 text-center text-ink-500">Loading...</p>
      </CandidateShell>
    )
  }

  if (phase === 'invalid') {
    return (
      <CandidateShell narrow>
        <Notice icon={<AlertTriangle className="h-7 w-7 text-warning-500" />} title="This link is not valid">
          Check that you opened the full link from your email.
        </Notice>
      </CandidateShell>
    )
  }

  if (phase === 'closed') {
    return (
      <CandidateShell companyName={company} narrow>
        <Notice icon={<AlertTriangle className="h-7 w-7 text-warning-500" />} title="Assessment unavailable">
          {message}
        </Notice>
      </CandidateShell>
    )
  }

  if (phase === 'done') {
    const firstName = assessment?.candidateName.split(' ')[0]
    return (
      <CandidateShell companyName={company} actions={assessment && <span className="text-body-sm text-ink-600 dark:text-ink-300">{assessment.candidateName}</span>}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start" role="status">
          <section className="card space-y-4 p-6">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-7 w-7 flex-shrink-0 text-success-500" aria-hidden="true" />
              <div>
                <h1 className="text-heading-lg font-bold text-ink-950 dark:text-ink-100">Assessment completed</h1>
                <p className="mt-1 text-body-md text-ink-600 dark:text-ink-300">
                  Thank you{firstName ? `, ${firstName}` : ''}. Your answers were submitted to {company}.
                </p>
              </div>
            </div>

            {summaries.length > 0 && (
              <ul className="divide-y divide-base-200 rounded-lg border border-base-200 dark:divide-base-700 dark:border-base-700" aria-label="Summary of your rounds">
                {summaries.map((s, i) => (
                  <li key={i} className="space-y-1.5 px-3 py-2.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate text-body-sm font-semibold text-ink-900 dark:text-ink-100">
                        Round {i + 1}: {s.title}
                      </span>
                      <span className="flex-shrink-0 text-body-sm tabular-nums text-ink-600 dark:text-ink-300">{s.answered} of {s.total} answered</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-base-200 dark:bg-base-700" aria-hidden="true">
                      <div className="h-full rounded-full bg-ink-700 dark:bg-base-300" style={{ width: `${s.total ? (s.answered / s.total) * 100 : 0}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <aside className="card space-y-2 p-5" aria-label="What happens next">
            <h2 className="text-heading-sm font-bold text-ink-950 dark:text-ink-100">What happens next</h2>
            <ul className="list-disc space-y-2 pl-5 text-body-sm text-ink-700 dark:text-ink-200">
              <li>{company} reviews your answers. Code and essay answers are scored with the help of AI, and video answers are reviewed by a person.</li>
              <li>If they want to take things further, they will contact you directly.</li>
              <li>You cannot change your answers now, and you do not need to do anything else. You can close this page.</li>
            </ul>
          </aside>
        </div>
      </CandidateShell>
    )
  }

  if (phase === 'transition' && assessment && round) {
    return (
      <CandidateShell
        companyName={company}
        title={assessment.title}
        actions={<span className="text-body-sm text-ink-600 dark:text-ink-300">{assessment.candidateName}</span>}
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start" role="status" aria-live="polite">
          <section className="card space-y-4 p-6">
            {summaries.length > 0 && (
              <p className="flex items-center gap-2 text-body-sm font-medium text-ink-700 dark:text-ink-200">
                <CheckCircle2 className="h-5 w-5 text-success-500" aria-hidden="true" />
                Round {roundIndex} submitted. Your answers are saved.
              </p>
            )}
            <div>
              <h1 className="text-heading-lg font-bold text-ink-950 dark:text-ink-100">
                Next: Round {roundIndex + 1} of {rounds.length}: {round.title}
              </h1>
              <p className="mt-1 text-body-md text-ink-700 dark:text-ink-200">
                {round.durationMinutes} minutes, {plural(round.questionCount, 'question')}.
              </p>
            </div>
            {round.description?.trim() && <p className="whitespace-pre-wrap text-body-md text-ink-700 dark:text-ink-200">{round.description}</p>}
            <div className="flex flex-wrap items-center gap-4 border-t border-base-200 pt-4 dark:border-base-700">
              <Button size="lg" onClick={() => void startRound(false)} loading={starting}>
                Start now
              </Button>
              <p className="text-body-sm text-ink-600 dark:text-ink-300">
                Round {roundIndex + 1} starts automatically{countdown > 0 ? ` in ${countdown}` : ' now'}. Its timer cannot be paused.
              </p>
            </div>
          </section>

          <aside className="card space-y-3 p-5" aria-label="Your progress">
            <h2 className="text-heading-sm font-bold text-ink-950 dark:text-ink-100">Your progress</h2>
            <ol className="space-y-2.5">
              {rounds.map((r, i) => {
                const done = i < roundIndex
                const next = i === roundIndex
                return (
                  <li key={i} className="flex items-start gap-2.5" aria-current={next ? 'step' : undefined}>
                    {done ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-success-500" aria-label="Submitted" />
                    ) : (
                      <span
                        className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${next ? 'border-brand-500 bg-brand-500 text-white' : 'border-base-300 text-ink-500 dark:border-base-600'}`}
                        aria-hidden="true"
                      >
                        {i + 1}
                      </span>
                    )}
                    <div className="min-w-0 text-body-sm">
                      <p className={next ? 'font-semibold text-ink-950 dark:text-ink-100' : 'text-ink-800 dark:text-ink-200'}>{r.title}</p>
                      <p className="text-body-xs text-ink-500 dark:text-ink-400">
                        {done && summaries[i]
                          ? `Submitted, ${summaries[i].answered} of ${summaries[i].total} answered`
                          : next
                            ? `Next, ${r.durationMinutes} min`
                            : `${r.durationMinutes} min`}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ol>
          </aside>
        </div>
      </CandidateShell>
    )
  }

  if (phase === 'intro' && assessment) {
    const stepLabels = ['Overview', 'Rules', 'Do and don\'t', 'Problems', hasTerms ? 'Terms' : 'Confirm']
    const last = stepLabels.length - 1
    const goTo = (n: number) => {
      setStep(n)
      setFurthestStep((f) => Math.max(f, n))
    }
    const canStart = readRules && (!hasTerms || accepted)

    return (
      <CandidateShell companyName={company} actions={<span className="text-body-sm text-ink-600 dark:text-ink-300">{assessment.candidateName}</span>}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
          <div className="min-w-0 space-y-4">
            <ol className="flex flex-wrap gap-x-1 gap-y-2" aria-label="Steps before you start">
              {stepLabels.map((label, i) => {
                const reachable = i <= furthestStep
                const current = i === step
                return (
                  <li key={label} className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={!reachable}
                      onClick={() => setStep(i)}
                      aria-current={current ? 'step' : undefined}
                      className={cn(
                        'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-body-sm transition-colors',
                        current ? 'bg-white font-semibold text-ink-950 shadow-sm dark:bg-surface-dark-card dark:text-ink-100' : 'text-ink-600 dark:text-ink-300',
                        reachable && !current && 'cursor-pointer hover:bg-base-100 dark:hover:bg-surface-dark-elevated',
                        !reachable && 'cursor-default opacity-60'
                      )}
                    >
                      {i < step ? (
                        <CheckCircle2 className="h-4 w-4 text-success-500" aria-label="Done" />
                      ) : (
                        <span
                          className={cn(
                            'flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold',
                            current ? 'bg-ink-900 text-white dark:bg-base-100 dark:text-ink-900' : 'border border-base-300 text-ink-500 dark:border-base-600'
                          )}
                          aria-hidden="true"
                        >
                          {i + 1}
                        </span>
                      )}
                      <span className={cn(!current && 'hidden md:inline')}>{label}</span>
                    </button>
                    {i < last && <span className="hidden h-px w-4 bg-base-300 dark:bg-base-600 md:block" aria-hidden="true" />}
                  </li>
                )
              })}
            </ol>

            <div className="card space-y-5 p-6 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0" ref={stepPanel} tabIndex={-1} aria-label={`Step ${step + 1} of ${stepLabels.length}: ${stepLabels[step]}`}>
              {step === 0 && (
                <>
                  <div>
                    <h1 className="text-heading-xl font-bold text-ink-950 dark:text-ink-100">{assessment.title}</h1>
                    <p className="mt-1 text-body-md text-ink-600 dark:text-ink-300">
                      Hi {assessment.candidateName}, please read the next few pages before you start. It takes about a minute.
                    </p>
                  </div>
                  {assessment.about?.trim() && <p className="max-w-prose whitespace-pre-wrap text-body-md text-ink-700 dark:text-ink-200">{assessment.about}</p>}
                  <RoundsStep assessment={assessment} />
                </>
              )}
              {step === 1 && <RulesStep assessment={assessment} />}
              {step === 2 && <DoDontStep assessment={assessment} />}
              {step === 3 && <IssuesStep assessment={assessment} />}
              {step === last && (
                <section className="space-y-4" aria-label={stepLabels[last]}>
                  <h2 className="text-heading-md font-bold text-ink-950 dark:text-ink-100">{hasTerms ? 'Terms and conditions' : 'Ready to start'}</h2>
                  {hasTerms && (
                    <div
                      className="max-h-60 overflow-y-auto whitespace-pre-wrap rounded-lg border border-base-200 bg-base-50 p-3 text-body-sm text-ink-700 dark:border-base-700 dark:bg-base-800/50 dark:text-ink-200"
                      tabIndex={0}
                      aria-label="Terms and conditions text"
                    >
                      {assessment.termsAndConditions}
                    </div>
                  )}
                  <div className="space-y-2.5">
                    <label className="flex cursor-pointer items-start gap-2.5">
                      <input type="checkbox" className="mt-0.5 h-4 w-4" checked={readRules} onChange={(e) => setReadRules(e.target.checked)} />
                      <span className="text-body-sm text-ink-800 dark:text-ink-100">I have read the rules, the dos and don&apos;ts, and what to do if something goes wrong.</span>
                    </label>
                    {hasTerms && (
                      <label className="flex cursor-pointer items-start gap-2.5">
                        <input type="checkbox" className="mt-0.5 h-4 w-4" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
                        <span className="text-body-sm text-ink-800 dark:text-ink-100">I accept the terms and conditions.</span>
                      </label>
                    )}
                  </div>
                  {!canStart && <p className="text-body-xs text-ink-500 dark:text-ink-400">Tick {hasTerms ? 'both boxes' : 'the box'} to unlock Start assessment.</p>}
                </section>
              )}

              <div className="sticky bottom-0 -mx-6 -mb-6 flex items-center justify-between gap-3 rounded-b-xl border-t border-base-200 bg-white/95 px-6 py-3 backdrop-blur dark:border-base-700 dark:bg-surface-dark/95">
                <Button type="button" variant="secondary" disabled={step === 0} onClick={() => goTo(step - 1)}>
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  Back
                </Button>
                <span className="hidden text-body-xs text-ink-500 dark:text-ink-400 sm:inline">Step {step + 1} of {stepLabels.length}</span>
                {step < last ? (
                  <Button type="button" onClick={() => goTo(step + 1)}>
                    Next
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                ) : (
                  <Button type="button" size="lg" onClick={() => void startRound(accepted)} loading={starting} disabled={!canStart}>
                    <Play className="h-4 w-4" aria-hidden="true" />
                    Start assessment
                  </Button>
                )}
              </div>
            </div>
          </div>

          <aside className="card space-y-3 p-5 lg:sticky lg:top-20" aria-label="At a glance">
            <h2 className="text-heading-sm font-bold text-ink-950 dark:text-ink-100">At a glance</h2>
            <BriefingFacts assessment={assessment} />
          </aside>
        </div>
      </CandidateShell>
    )
  }

  return null
}

function Notice({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="card flex items-start gap-3 p-6" role="alert">
      <span className="mt-0.5 flex-shrink-0">{icon}</span>
      <div>
        <h1 className="text-heading-md font-bold text-ink-950 dark:text-ink-100">{title}</h1>
        <p className="mt-1 text-body-md text-ink-600 dark:text-ink-300">{children}</p>
      </div>
    </div>
  )
}
