import { useEffect, useMemo, useState } from 'react'
import { Bookmark, ChevronLeft, ChevronRight, Clock, Send } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ConfirmModal } from '@/components/ui/Modal'
import { Textarea } from '@/components/ui/Input'
import { cn } from '@/utils/helpers'
import { formatClock, timerTone, TIMER_STYLES } from '@/utils/examTimer'
import { CandidateShell } from '@/components/assessments/CandidateShell'
import type { PublicAssessment } from '@/types'

export type ExamQuestion = NonNullable<PublicAssessment['questions']>[number]

interface Props {
  token: string
  companyName: string
  title: string
  roundTitle: string
  roundDescription?: string | null
  roundNumber: number
  roundCount: number
  questions: ExamQuestion[]
  answers: Record<string, string>
  onAnswer: (questionId: string, value: string) => void
  secondsLeft: number
  submitting: boolean
  /** Called once the candidate confirmed the submission (running out of time is handled by the page). */
  onSubmit: () => void
}

const flagsKey = (token: string) => `assessment-flags-${token}`

interface Flags {
  marked: string[]
  visited: string[]
}

function loadFlags(token: string): Flags {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(flagsKey(token)) ?? '{}') as Partial<Flags>
    return { marked: parsed.marked ?? [], visited: parsed.visited ?? [] }
  } catch {
    return { marked: [], visited: [] }
  }
}

type PaletteState = 'unvisited' | 'unanswered' | 'answered' | 'marked' | 'answeredMarked'

const PALETTE_STYLES: Record<PaletteState, string> = {
  unvisited: 'border-base-300 bg-base-50 text-ink-700 dark:border-base-600 dark:bg-base-800/50 dark:text-ink-200',
  unanswered: 'border-error-200 bg-error-100 text-error-600 dark:border-error-800 dark:bg-error-900/30 dark:text-error-400',
  answered: 'border-success-500 bg-success-500 text-white',
  marked: 'border-info-500 bg-info-500 text-white',
  answeredMarked: 'border-info-500 bg-info-500 text-white',
}

const STATE_LABEL: Record<PaletteState, string> = {
  unvisited: 'not visited',
  unanswered: 'not answered',
  answered: 'answered',
  marked: 'marked for review',
  answeredMarked: 'answered and marked for review',
}

/**
 * One round of the assessment: question, answer, navigation, question palette and the round countdown.
 * The countdown itself is owned by the page (it comes from the server clock); this only displays it.
 */
export function RoundExam({
  token,
  companyName,
  title,
  roundTitle,
  roundDescription,
  roundNumber,
  roundCount,
  questions,
  answers,
  onAnswer,
  secondsLeft,
  submitting,
  onSubmit,
}: Props) {
  const [index, setIndex] = useState(0)
  const [marked, setMarked] = useState<Set<string>>(() => new Set(loadFlags(token).marked))
  const [visited, setVisited] = useState<Set<string>>(() => new Set(loadFlags(token).visited))
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [announcement, setAnnouncement] = useState('')

  const isLastRound = roundNumber >= roundCount
  const question = questions[Math.min(index, questions.length - 1)]
  const tone = timerTone(secondsLeft)

  // A new round brings new questions: start again from the first one
  useEffect(() => {
    setIndex(0)
  }, [roundNumber])

  // Opening a question counts as visiting it
  useEffect(() => {
    if (!question || visited.has(question.id)) return
    setVisited((prev) => new Set(prev).add(question.id))
  }, [question, visited])

  useEffect(() => {
    try {
      sessionStorage.setItem(flagsKey(token), JSON.stringify({ marked: [...marked], visited: [...visited] }))
    } catch {
      /* storage unavailable: flags still live in memory */
    }
  }, [token, marked, visited])

  // Screen readers get told when the colour band changes, not every second
  useEffect(() => {
    setAnnouncement(TIMER_STYLES[tone].hint ?? '')
  }, [tone])

  const isAnswered = (q: ExamQuestion) => Boolean(answers[q.id]?.trim())
  const stateOf = (q: ExamQuestion): PaletteState => {
    const answered = isAnswered(q)
    const flagged = marked.has(q.id)
    if (flagged) return answered ? 'answeredMarked' : 'marked'
    if (answered) return 'answered'
    return visited.has(q.id) ? 'unanswered' : 'unvisited'
  }

  const counts = useMemo(() => {
    const c = { answered: 0, unanswered: 0, unvisited: 0, marked: 0 }
    questions.forEach((q) => {
      const answered = Boolean(answers[q.id]?.trim())
      if (answered) c.answered++
      else if (visited.has(q.id) || q.id === question?.id) c.unanswered++
      else c.unvisited++
      if (marked.has(q.id)) c.marked++
    })
    return c
  }, [questions, answers, visited, marked, question])

  if (!question) return null

  const toggleMark = () =>
    setMarked((prev) => {
      const next = new Set(prev)
      if (next.has(question.id)) next.delete(question.id)
      else next.add(question.id)
      return next
    })

  const notAnswered = questions.length - counts.answered
  const submitLabel = isLastRound ? 'Submit assessment' : 'Submit round'
  const hint = TIMER_STYLES[tone].hint

  const actions = (
    <>
      {hint && <span className="hidden text-body-xs font-medium text-ink-600 dark:text-ink-300 lg:inline">{hint}</span>}
      <div
        role="timer"
        aria-label={`Time left in this round: ${formatClock(secondsLeft)}`}
        data-testid="exam-timer"
        data-tone={tone}
        className={cn('flex items-center gap-1.5 rounded-lg border-2 px-2.5 py-1 font-mono text-heading-sm font-bold tabular-nums', TIMER_STYLES[tone].pill)}
      >
        <Clock className="h-4 w-4" aria-hidden="true" />
        {formatClock(secondsLeft)}
      </div>
      <Button loading={submitting} onClick={() => setConfirmOpen(true)}>
        <Send className="h-4 w-4" aria-hidden="true" />
        {submitLabel}
      </Button>
    </>
  )

  return (
    <CandidateShell companyName={companyName} title={title} actions={actions}>
      <span className="sr-only" role="status" aria-live="polite">{announcement}</span>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <section className="card flex flex-col p-5 lg:min-h-[calc(100vh-6.5rem)]" aria-label={`Question ${index + 1} of ${questions.length}`}>
          <div className="flex flex-wrap items-end justify-between gap-2 border-b border-base-200 pb-3 dark:border-base-700">
            <div>
              <p className="text-body-sm text-ink-600 dark:text-ink-300">
                <span className="font-semibold">Round {roundNumber} of {roundCount}</span>: {roundTitle}
              </p>
              <h2 className="text-heading-md font-bold text-ink-950 dark:text-ink-100">
                Question {index + 1} <span className="font-normal text-ink-500 dark:text-ink-400">of {questions.length}</span>
              </h2>
            </div>
            <div className="flex items-center gap-2 text-body-xs text-ink-500 dark:text-ink-400">
              {marked.has(question.id) && (
                <span className="inline-flex items-center gap-1 rounded-md bg-info-100 px-2 py-0.5 font-medium text-info-600 dark:bg-info-900/40 dark:text-info-400">
                  <Bookmark className="h-3 w-3" aria-hidden="true" />
                  Marked for review
                </span>
              )}
              <span>Weight {question.weight}</span>
            </div>
          </div>

          <div className="flex-1 space-y-4 pt-4">
            <p className="whitespace-pre-wrap text-body-lg font-medium text-ink-900 dark:text-ink-100">{question.question}</p>

            {question.type === 'MULTIPLE_CHOICE' && (
              <div className="space-y-2" role="radiogroup" aria-label="Answer options">
                {question.options.map((option, i) => {
                  const selected = answers[question.id] === option
                  return (
                    <label
                      key={option}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors',
                        selected
                          ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                          : 'border-base-200 hover:bg-base-50 dark:border-base-700 dark:hover:bg-surface-dark-elevated'
                      )}
                    >
                      <input type="radio" name={question.id} checked={selected} onChange={() => onAnswer(question.id, option)} />
                      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-base-300 text-body-xs font-semibold text-ink-600 dark:border-base-600 dark:text-ink-300" aria-hidden="true">
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span className="text-body-md text-ink-800 dark:text-ink-100">{option}</span>
                    </label>
                  )
                })}
              </div>
            )}

            {question.type === 'CODE' && (
              <textarea
                className="input min-h-[300px] font-mono text-body-sm"
                spellCheck={false}
                placeholder="Write your code here"
                aria-label="Your code"
                value={answers[question.id] ?? ''}
                onChange={(e) => onAnswer(question.id, e.target.value)}
              />
            )}

            {question.type === 'ESSAY' && (
              <Textarea
                rows={10}
                placeholder="Write your answer"
                aria-label="Your answer"
                value={answers[question.id] ?? ''}
                onChange={(e) => onAnswer(question.id, e.target.value)}
              />
            )}

            {question.type === 'VIDEO' && (
              <div className="space-y-1">
                <input
                  className="input"
                  type="url"
                  placeholder="https://... link to your recorded video answer"
                  aria-label="Link to your video answer"
                  value={answers[question.id] ?? ''}
                  onChange={(e) => onAnswer(question.id, e.target.value)}
                />
                <p className="text-body-xs text-ink-500 dark:text-ink-400">Upload your video somewhere private-link capable and paste the link.</p>
              </div>
            )}

            {isAnswered(question) && (
              <button
                type="button"
                onClick={() => onAnswer(question.id, '')}
                className="cursor-pointer text-body-xs font-semibold text-ink-600 underline-offset-2 hover:underline dark:text-ink-300"
              >
                Clear response
              </button>
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-base-200 pt-4 dark:border-base-700">
            <Button type="button" variant="secondary" disabled={index === 0} onClick={() => setIndex((i) => Math.max(0, i - 1))}>
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              Previous
            </Button>
            <Button type="button" variant={marked.has(question.id) ? 'primary' : 'secondary'} onClick={toggleMark} aria-pressed={marked.has(question.id)}>
              <Bookmark className="h-4 w-4" aria-hidden="true" />
              {marked.has(question.id) ? 'Unmark review' : 'Mark for Review'}
            </Button>
            {index >= questions.length - 1 ? (
              // The end of the round: moving on means submitting it, so this asks for the same confirmation
              <Button type="button" loading={submitting} onClick={() => setConfirmOpen(true)}>
                {isLastRound ? 'Submit assessment' : 'Next round'}
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            ) : (
              <Button type="button" variant="secondary" onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}>
                Next
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}
          </div>
        </section>

        <aside className="card h-fit space-y-4 p-4 lg:sticky lg:top-20" aria-label="Question palette">
          <h2 className="text-heading-sm font-bold text-ink-950 dark:text-ink-100">Question palette</h2>

          <ol className="grid grid-cols-5 gap-2">
            {questions.map((q, i) => {
              const state = stateOf(q)
              return (
                <li key={q.id}>
                  <button
                    type="button"
                    onClick={() => setIndex(i)}
                    data-testid={`palette-${i + 1}`}
                    data-state={state}
                    aria-label={`Question ${i + 1}, ${STATE_LABEL[state]}`}
                    aria-current={i === index ? 'true' : undefined}
                    className={cn(
                      'relative flex h-9 w-full cursor-pointer items-center justify-center rounded-lg border text-body-sm font-semibold transition-colors',
                      PALETTE_STYLES[state],
                      i === index && 'ring-2 ring-brand-500 ring-offset-2 ring-offset-white dark:ring-offset-base-900'
                    )}
                  >
                    {i + 1}
                    {state === 'answeredMarked' && (
                      <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-success-500 dark:border-base-900" aria-hidden="true" />
                    )}
                  </button>
                </li>
              )
            })}
          </ol>

          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-base-200 pt-3 text-body-xs text-ink-700 dark:border-base-700 dark:text-ink-200">
            {(
              [
                ['answered', counts.answered, 'Answered'],
                ['unanswered', counts.unanswered, 'Not answered'],
                ['marked', counts.marked, 'Marked for review'],
                ['unvisited', counts.unvisited, 'Not visited'],
              ] as [PaletteState, number, string][]
            ).map(([state, n, label]) => (
              <div key={state} className="flex items-center gap-2">
                <dt className={cn('flex h-6 min-w-[1.5rem] items-center justify-center rounded border px-1 font-semibold', PALETTE_STYLES[state])}>{n}</dt>
                <dd>{label}</dd>
              </div>
            ))}
          </dl>

          {roundDescription?.trim() && (
            <div className="border-t border-base-200 pt-3 dark:border-base-700">
              <h3 className="text-body-sm font-semibold text-ink-900 dark:text-ink-100">About this round</h3>
              <p className="mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap text-body-xs text-ink-600 dark:text-ink-300">{roundDescription}</p>
            </div>
          )}
        </aside>
      </div>

      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false)
          onSubmit()
        }}
        title={isLastRound ? 'Submit assessment?' : `Submit Round ${roundNumber}?`}
        message={
          isLastRound
            ? 'This is the last round. Once you submit, the assessment is complete.'
            : `You can't come back to this round after submitting. Round ${roundNumber + 1} starts automatically.`
        }
        confirmText={submitLabel}
        loading={submitting}
      >
        You answered {counts.answered} of {questions.length} questions.
        {notAnswered > 0 && ` ${notAnswered} ${notAnswered === 1 ? 'is' : 'are'} unanswered and will score zero.`}
        {counts.marked > 0 && ` ${counts.marked} ${counts.marked === 1 ? 'is' : 'are'} marked for review.`}
      </ConfirmModal>
    </CandidateShell>
  )
}
