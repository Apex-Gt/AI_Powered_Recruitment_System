import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowDown, ArrowUp, ChevronLeft, ClipboardList, Download, GripVertical, Plus, Trash2, Upload } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { assessmentApi, jobApi } from '@/utils/api'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ConfirmModal } from '@/components/ui/Modal'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { cn } from '@/utils/helpers'
import { importQuestionsFromCsv, MAX_QUESTIONS, QUESTION_CSV_TEMPLATE } from '@/utils/questionImport'
import { assessmentTypes, DEFAULT_TERMS, questionTypes } from '@/utils/assessmentTypes'
import type { Assessment, AssessmentQuestion } from '@/types'

const MAX_ROUNDS = 10

type QuestionType = AssessmentQuestion['type']

interface QuestionDraft {
  key: string
  question: string
  type: QuestionType
  /** One option per line, kept as typed so Enter works; split when validating and saving. */
  optionsText: string
  correctAnswer: string
  weight: number
}

interface RoundDraft {
  key: string
  title: string
  description: string
  durationMinutes: number
  questions: QuestionDraft[]
}

const blankQuestion = (): QuestionDraft => ({
  key: crypto.randomUUID(),
  question: '',
  type: 'MULTIPLE_CHOICE',
  optionsText: '',
  correctAnswer: '',
  weight: 10,
})

const blankRound = (n: number): RoundDraft => ({
  key: crypto.randomUUID(),
  title: `Round ${n}`,
  description: '',
  durationMinutes: 30,
  questions: [blankQuestion()],
})

const parseOptions = (text: string) => [...new Set(text.split('\n').map((o) => o.trim()).filter(Boolean))]

function fromAssessment(a: Assessment): RoundDraft[] {
  return a.rounds.map((r) => ({
    key: crypto.randomUUID(),
    title: r.title,
    description: r.description ?? '',
    durationMinutes: r.durationMinutes,
    questions: r.questions.map((q) => ({
      key: crypto.randomUUID(),
      question: q.question,
      type: q.type,
      optionsText: (q.options ?? []).join('\n'),
      correctAnswer: q.correctAnswer ?? '',
      weight: q.weight,
    })),
  }))
}

type Errors = Record<string, string>

/** Same rules the server enforces, so problems show up next to the field instead of as a failed save. */
function validate(title: string, rounds: RoundDraft[]): Errors {
  const e: Errors = {}
  if (title.trim().length < 3) e.title = 'Title must be at least 3 characters'
  else if (title.trim().length > 200) e.title = 'Title must be at most 200 characters'
  if (rounds.length === 0) e.rounds = 'Add at least one round'

  let total = 0
  rounds.forEach((r, i) => {
    if (!r.title.trim()) e[`rounds.${i}.title`] = 'Give the round a title'
    if (!Number.isInteger(r.durationMinutes) || r.durationMinutes < 1 || r.durationMinutes > 480) {
      e[`rounds.${i}.duration`] = 'Enter 1 to 480 minutes'
    }
    if (r.questions.length === 0) e[`rounds.${i}.questions`] = 'Add at least one question'
    total += r.questions.length
    r.questions.forEach((q, j) => {
      const at = `rounds.${i}.questions.${j}`
      if (!q.question.trim()) e[`${at}.question`] = 'Question is required'
      if (!Number.isInteger(q.weight) || q.weight < 1 || q.weight > 100) e[`${at}.weight`] = '1 to 100'
      if (q.type === 'MULTIPLE_CHOICE') {
        const options = parseOptions(q.optionsText)
        if (options.length < 2) e[`${at}.options`] = 'Enter at least two options, one per line'
        else if (!options.includes(q.correctAnswer)) e[`${at}.correct`] = 'Pick the correct option'
      }
    })
  })
  if (total > MAX_QUESTIONS) e.rounds = `An assessment can have at most ${MAX_QUESTIONS} questions in total`
  return e
}

export function AssessmentEditor() {
  const { id } = useParams<{ id: string }>()
  const isEditing = Boolean(id)
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { hasRole } = useAuth()
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo ?? '/assessments'

  const [isLoading, setIsLoading] = useState(isEditing)
  const [loadFailed, setLoadFailed] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [title, setTitle] = useState('')
  const [type, setType] = useState<Assessment['type']>('TECHNICAL')
  const [jobId, setJobId] = useState(searchParams.get('jobId') ?? '')
  const [about, setAbout] = useState('')
  const [terms, setTerms] = useState(isEditing ? '' : DEFAULT_TERMS)
  const [rounds, setRounds] = useState<RoundDraft[]>(() => [blankRound(1)])
  const [selected, setSelected] = useState(0)
  const [errors, setErrors] = useState<Errors>({})
  const [triedToSave, setTriedToSave] = useState(false)
  const [jobs, setJobs] = useState<{ id: string; title: string }[]>([])
  const [dragging, setDragging] = useState(false)
  const [removingRound, setRemovingRound] = useState<number | null>(null)
  const [dragRound, setDragRound] = useState<number | null>(null)
  const [overRound, setOverRound] = useState<number | null>(null)
  const [importErrors, setImportErrors] = useState<string[]>([])
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    assessmentApi
      .getById(id)
      .then((a) => {
        if (cancelled) return
        setTitle(a.title)
        setType(a.type)
        setJobId(a.jobId ?? '')
        setAbout(a.about ?? '')
        setTerms(a.termsAndConditions ?? '')
        setRounds(fromAssessment(a))
      })
      .catch(() => !cancelled && setLoadFailed(true))
      .finally(() => !cancelled && setIsLoading(false))
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    let cancelled = false
    const req = hasRole(['ADMIN'])
      ? jobApi.getAllForAdminUnwrapped({ page: 1, pageSize: 100 })
      : jobApi.getMyJobsUnwrapped({ page: 1, pageSize: 100 })
    req
      .then((res) => !cancelled && setJobs((res?.data ?? []).map((j) => ({ id: j.id, title: j.title }))))
      .catch(() => !cancelled && setJobs([]))
    return () => {
      cancelled = true
    }
  }, [hasRole])

  // After a first failed save, keep the markers in step with the edits so they clear as things get fixed
  useEffect(() => {
    if (triedToSave) setErrors(validate(title, rounds))
  }, [triedToSave, title, rounds])

  const totals = useMemo(
    () => ({
      minutes: rounds.reduce((sum, r) => sum + (Number.isFinite(r.durationMinutes) ? r.durationMinutes : 0), 0),
      questions: rounds.reduce((sum, r) => sum + r.questions.length, 0),
    }),
    [rounds]
  )

  const round = rounds[Math.min(selected, rounds.length - 1)]
  const roundIndex = rounds.indexOf(round)
  const err = (key: string) => errors[key]
  const roundHasError = (i: number) => Object.keys(errors).some((k) => k.startsWith(`rounds.${i}.`))

  const updateRound = (index: number, patch: Partial<RoundDraft>) =>
    setRounds((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)))

  const updateQuestion = (qIndex: number, patch: Partial<QuestionDraft>) =>
    updateRound(roundIndex, { questions: round.questions.map((q, i) => (i === qIndex ? { ...q, ...patch } : q)) })

  const addRound = () => {
    if (rounds.length >= MAX_ROUNDS) return
    setRounds((prev) => [...prev, blankRound(prev.length + 1)])
    setSelected(rounds.length)
  }

  const removeRound = (index: number) => {
    if (rounds.length <= 1) return
    setRounds((prev) => prev.filter((_, i) => i !== index))
    setSelected(Math.max(0, Math.min(index, rounds.length - 2)))
    setRemovingRound(null)
  }

  /** Moves a round to a new position. The candidate takes the rounds in exactly this order. */
  const reorderRound = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= rounds.length || to >= rounds.length) return
    const selectedKey = rounds[roundIndex].key
    const next = [...rounds]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setRounds(next)
    // Keep looking at the same round wherever it ended up
    setSelected(next.findIndex((r) => r.key === selectedKey))
  }

  const moveRound = (index: number, delta: -1 | 1) => reorderRound(index, index + delta)

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([QUESTION_CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'assessment-questions-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const importFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error('Please choose a .csv file')
      return
    }
    // The untouched starter question is replaced by the import instead of being kept as an empty row
    const kept = round.questions.filter((q) => q.question.trim() !== '')
    const otherQuestions = totals.questions - round.questions.length
    const { questions: imported, errors: rowErrors } = importQuestionsFromCsv(
      await file.text(),
      Math.max(0, MAX_QUESTIONS - otherQuestions - kept.length)
    )
    setImportErrors(rowErrors)
    if (imported.length === 0) {
      toast.error('No questions were imported')
      return
    }
    updateRound(roundIndex, {
      questions: [
        ...kept,
        ...imported.map((q) => ({
          key: q.id,
          question: q.question,
          type: q.type,
          optionsText: q.options.join('\n'),
          correctAnswer: q.correctAnswer,
          weight: q.weight,
        })),
      ],
    })
    toast.success(`Imported ${imported.length} question${imported.length === 1 ? '' : 's'} into ${round.title || 'this round'}${rowErrors.length ? `, ${rowErrors.length} skipped` : ''}`)
  }

  const save = async () => {
    const found = validate(title, rounds)
    setErrors(found)
    setTriedToSave(true)
    const keys = Object.keys(found)
    if (keys.length > 0) {
      const firstRound = keys.map((k) => /^rounds\.(\d+)\./.exec(k)?.[1]).find((v) => v !== undefined)
      if (!found.title && firstRound !== undefined) setSelected(Number(firstRound))
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setIsSaving(true)
    try {
      const payload = {
        title: title.trim(),
        type,
        jobId: jobId || null,
        about: about.trim(),
        termsAndConditions: terms.trim(),
        rounds: rounds.map((r) => ({
          title: r.title.trim(),
          description: r.description.trim(),
          durationMinutes: r.durationMinutes,
          questions: r.questions.map((q) => ({
            question: q.question.trim(),
            type: q.type,
            options: q.type === 'MULTIPLE_CHOICE' ? parseOptions(q.optionsText) : [],
            correctAnswer: q.type === 'MULTIPLE_CHOICE' ? q.correctAnswer : undefined,
            weight: q.weight,
          })),
        })),
      }
      if (id) await assessmentApi.update(id, payload)
      else await assessmentApi.create(payload)
      toast.success(isEditing ? 'Assessment updated' : 'Assessment created')
      navigate(returnTo)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save assessment')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading assessment">
        <div className="h-12 w-1/2 animate-pulse rounded-lg bg-base-100 dark:bg-surface-dark-elevated" />
        <div className="h-48 animate-pulse rounded-xl bg-base-100 dark:bg-surface-dark-elevated" />
        <div className="h-96 animate-pulse rounded-xl bg-base-100 dark:bg-surface-dark-elevated" />
      </div>
    )
  }

  if (loadFailed) {
    return (
      <div className="surface space-y-3 rounded-xl p-10 text-center">
        <h1 className="text-heading-md font-bold text-ink-900 dark:text-ink-100">Assessment not found</h1>
        <p className="text-body-sm text-ink-600 dark:text-ink-400">It may have been deleted, or the link is wrong.</p>
        <Button variant="secondary" onClick={() => navigate('/assessments')}>Back to assessments</Button>
      </div>
    )
  }

  const errorCount = Object.keys(errors).length

  return (
    <div className="space-y-6">
      <div>
        <Link to={returnTo} className="inline-flex items-center gap-1 text-body-sm font-semibold text-ink-700 no-underline hover:underline dark:text-ink-300">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Back
        </Link>
        <h1 className="mt-3 text-heading-xl font-bold text-ink-900 dark:text-ink-100">
          {isEditing ? 'Edit assessment' : 'Create assessment'}
        </h1>
        <p className="mt-1 text-body-md text-ink-600 dark:text-ink-400">
          Set up what candidates read first, then build the rounds they will take one after another.
        </p>
      </div>

      {errorCount > 0 && (
        <div role="alert" className="rounded-xl bg-error-50 p-4 text-body-sm text-error-700 dark:bg-error-900/20 dark:text-error-300">
          {errorCount === 1 ? '1 thing needs fixing' : `${errorCount} things need fixing`} before this can be saved. They are marked below.
        </div>
      )}

      <Card padding="lg">
        <CardHeader>
          <h2 className="font-display text-heading-lg font-bold text-ink-950 dark:text-ink-100">Details</h2>
        </CardHeader>
        <CardContent className="space-y-5">
          <Input
            id="assessment-title"
            label="Title *"
            placeholder="e.g., React Technical Assessment"
            value={title}
            error={err('title')}
            onChange={(e) => setTitle(e.target.value)}
          />
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Select
              id="assessment-job"
              label="Job"
              placeholder="Not tied to a specific job"
              helperText="Link it to a job so it also shows on that job's page."
              options={jobs.map((j) => ({ value: j.id, label: j.title }))}
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
            />
            <Select
              id="assessment-type"
              label="Type *"
              options={assessmentTypes}
              value={type}
              onChange={(e) => setType(e.target.value as Assessment['type'])}
            />
          </div>
        </CardContent>
      </Card>

      <Card padding="lg">
        <CardHeader>
          <h2 className="font-display text-heading-lg font-bold text-ink-950 dark:text-ink-100">Candidate briefing</h2>
        </CardHeader>
        <CardContent className="space-y-5">
          <Textarea
            id="assessment-about"
            label="About the test"
            rows={5}
            placeholder="What the test covers, what you are looking for, and any tips for the candidate"
            value={about}
            onChange={(e) => setAbout(e.target.value)}
          />
          <div className="space-y-2">
            <Textarea
              id="assessment-terms"
              label="Terms and conditions"
              rows={8}
              helperText="Candidates have to tick that they accept these before they can start. Leave empty to skip this step."
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
            />
            <Button type="button" variant="ghost" size="sm" onClick={() => setTerms(DEFAULT_TERMS)}>
              Use standard terms
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card padding="lg">
        <CardHeader>
          <h2 className="font-display text-heading-lg font-bold text-ink-950 dark:text-ink-100">Rounds</h2>
          {err('rounds') && <p className="mt-2 text-body-sm text-error-600 dark:text-error-400">{err('rounds')}</p>}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
            <nav aria-label="Rounds" className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
              {rounds.length > 1 && (
                <p className="hidden text-body-xs text-ink-500 dark:text-ink-400 lg:block">Drag rounds to change the order candidates take them in.</p>
              )}
              {rounds.map((r, i) => (
                <div
                  key={r.key}
                  draggable={rounds.length > 1}
                  onDragStart={(e) => {
                    setDragRound(i)
                    e.dataTransfer.effectAllowed = 'move'
                    e.dataTransfer.setData('text/plain', String(i))
                  }}
                  onDragOver={(e) => {
                    if (dragRound === null) return
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                    if (overRound !== i) setOverRound(i)
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    if (dragRound !== null) reorderRound(dragRound, i)
                    setDragRound(null)
                    setOverRound(null)
                  }}
                  onDragEnd={() => {
                    setDragRound(null)
                    setOverRound(null)
                  }}
                  className={cn(
                    'flex min-w-[10rem] flex-shrink-0 items-stretch rounded-xl transition-opacity lg:min-w-0',
                    dragRound === i && 'opacity-40',
                    overRound === i && dragRound !== null && dragRound !== i && 'ring-2 ring-brand-500'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setSelected(i)}
                    aria-current={i === roundIndex ? 'true' : undefined}
                    className={cn(
                      'flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-xl border px-3 py-3 text-left transition-colors',
                      i === roundIndex
                        ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                        : 'border-base-200 hover:bg-base-50 dark:border-base-700 dark:hover:bg-surface-dark-elevated',
                      roundHasError(i) && 'border-error-500'
                    )}
                  >
                    {rounds.length > 1 && (
                      <GripVertical className="h-4 w-4 flex-shrink-0 cursor-grab text-ink-400 active:cursor-grabbing" aria-hidden="true" />
                    )}
                    <span className="flex min-w-0 flex-1 flex-col items-start">
                      <span className="text-label-xs font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-400">Round {i + 1}</span>
                      <span className="mt-0.5 w-full truncate text-body-sm font-semibold text-ink-900 dark:text-ink-100">{r.title || 'Untitled round'}</span>
                      <span className="text-body-xs text-ink-600 dark:text-ink-400">
                        {r.durationMinutes || 0} min · {r.questions.length} {r.questions.length === 1 ? 'question' : 'questions'}
                      </span>
                    </span>
                  </button>
                </div>
              ))}
              <Button type="button" variant="secondary" onClick={addRound} disabled={rounds.length >= MAX_ROUNDS} className="min-w-[10rem] flex-shrink-0 lg:min-w-0">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add round
              </Button>
            </nav>

            <div className="min-w-0 space-y-5" role="region" aria-label={`Round ${roundIndex + 1} details`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-heading-md font-bold text-ink-950 dark:text-ink-100">Round {roundIndex + 1}</h3>
                <div className="flex items-center gap-1">
                  <Button type="button" variant="ghost" size="sm" onClick={() => moveRound(roundIndex, -1)} disabled={roundIndex === 0} title="Move earlier">
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => moveRound(roundIndex, 1)} disabled={roundIndex === rounds.length - 1} title="Move later">
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="text-error-500 hover:text-error-600" onClick={() => setRemovingRound(roundIndex)} disabled={rounds.length <= 1}>
                    <Trash2 className="mr-1 h-4 w-4" />
                    Remove round
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_10rem]">
                <Input
                  id={`round-title-${round.key}`}
                  label="Round title *"
                  placeholder="e.g., Aptitude, Coding challenge"
                  value={round.title}
                  error={err(`rounds.${roundIndex}.title`)}
                  onChange={(e) => updateRound(roundIndex, { title: e.target.value })}
                />
                <Input
                  id={`round-duration-${round.key}`}
                  label="Time limit (min) *"
                  type="number"
                  min={1}
                  max={480}
                  value={Number.isFinite(round.durationMinutes) ? String(round.durationMinutes) : ''}
                  error={err(`rounds.${roundIndex}.duration`)}
                  onChange={(e) => updateRound(roundIndex, { durationMinutes: parseInt(e.target.value, 10) })}
                />
              </div>
              <Textarea
                id={`round-description-${round.key}`}
                label="About this round"
                rows={3}
                placeholder="What the candidate should expect in this round"
                helperText="Shown to the candidate before the test and again right before this round starts."
                value={round.description}
                onChange={(e) => updateRound(roundIndex, { description: e.target.value })}
              />

              <div className="space-y-4 border-t border-base-200 pt-5 dark:border-base-700">
                <h4 className="font-display text-heading-sm font-bold text-ink-950 dark:text-ink-100">Questions</h4>
                {err(`rounds.${roundIndex}.questions`) && (
                  <p className="text-body-sm text-error-600 dark:text-error-400">{err(`rounds.${roundIndex}.questions`)}</p>
                )}

                <input
                  ref={fileInput}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    e.target.value = '' // lets the same file be picked again
                    if (file) void importFile(file)
                  }}
                />
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                  onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false) }}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragging(false)
                    const file = e.dataTransfer.files?.[0]
                    if (file) void importFile(file)
                  }}
                  className={cn(
                    'flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-4 py-5 text-center transition-colors',
                    dragging ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-base-300 dark:border-base-700'
                  )}
                >
                  <Upload className="h-6 w-6 text-ink-500 dark:text-ink-400" aria-hidden="true" />
                  <div>
                    <p className="text-body-sm font-medium text-ink-900 dark:text-ink-100">
                      {dragging ? 'Drop the CSV to import' : `Drag and drop a CSV file to add questions to round ${roundIndex + 1}`}
                    </p>
                    <p className="text-body-xs text-ink-500 dark:text-ink-400">Up to {MAX_QUESTIONS} questions per assessment</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Button type="button" variant="secondary" size="sm" onClick={() => fileInput.current?.click()}>
                      <Upload className="h-4 w-4" />
                      Browse files
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={downloadTemplate}>
                      <Download className="h-4 w-4" />
                      Download template
                    </Button>
                  </div>
                </div>
                {importErrors.length > 0 && (
                  <div role="alert" className="rounded-xl bg-warning-100 p-4 text-body-sm text-warning-600 dark:bg-warning-900/30 dark:text-warning-400">
                    <p className="font-medium">Some rows were skipped:</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5">
                      {importErrors.slice(0, 10).map((m) => <li key={m}>{m}</li>)}
                    </ul>
                    {importErrors.length > 10 && <p className="mt-1">…and {importErrors.length - 10} more.</p>}
                  </div>
                )}

                {round.questions.map((q, qIndex) => {
                  const at = `rounds.${roundIndex}.questions.${qIndex}`
                  const options = parseOptions(q.optionsText)
                  return (
                    <div key={q.key} className="space-y-4 rounded-xl bg-base-50 p-4 dark:bg-base-800/50">
                      <div className="flex items-center justify-between">
                        <h5 className="text-body-lg font-semibold text-ink-950 dark:text-ink-100">Question {qIndex + 1}</h5>
                        {round.questions.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-error-500 hover:text-error-600"
                            onClick={() => updateRound(roundIndex, { questions: round.questions.filter((_, i) => i !== qIndex) })}
                          >
                            <Trash2 className="mr-1 h-4 w-4" />
                            Remove
                          </Button>
                        )}
                      </div>

                      <Input
                        id={`q-text-${q.key}`}
                        label="Question *"
                        placeholder="Enter your question"
                        value={q.question}
                        error={err(`${at}.question`)}
                        onChange={(e) => updateQuestion(qIndex, { question: e.target.value })}
                      />

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <Select
                          id={`q-type-${q.key}`}
                          label="Type *"
                          options={questionTypes}
                          value={q.type}
                          onChange={(e) => updateQuestion(qIndex, { type: e.target.value as QuestionType })}
                        />
                        <Input
                          id={`q-weight-${q.key}`}
                          label="Weight (%) *"
                          type="number"
                          min={1}
                          max={100}
                          value={Number.isFinite(q.weight) ? String(q.weight) : ''}
                          error={err(`${at}.weight`)}
                          onChange={(e) => updateQuestion(qIndex, { weight: parseInt(e.target.value, 10) })}
                          className="w-24"
                        />
                      </div>

                      {q.type === 'MULTIPLE_CHOICE' && (
                        <>
                          <div className="space-y-2">
                            <label className="label" htmlFor={`q-options-${q.key}`}>Options (one per line) *</label>
                            <textarea
                              id={`q-options-${q.key}`}
                              className="input min-h-[80px] resize-y"
                              placeholder={'Option 1\nOption 2\nOption 3'}
                              value={q.optionsText}
                              onChange={(e) => updateQuestion(qIndex, { optionsText: e.target.value })}
                            />
                            {err(`${at}.options`) && <p className="text-body-xs text-error-600 dark:text-error-400">{err(`${at}.options`)}</p>}
                          </div>
                          <Select
                            id={`q-correct-${q.key}`}
                            label="Correct answer *"
                            placeholder="Select the correct option"
                            options={options.map((o) => ({ value: o, label: o }))}
                            value={options.includes(q.correctAnswer) ? q.correctAnswer : ''}
                            error={err(`${at}.correct`)}
                            onChange={(e) => updateQuestion(qIndex, { correctAnswer: e.target.value })}
                          />
                        </>
                      )}
                      {q.type === 'CODE' && (
                        <p className="text-body-xs text-ink-500 dark:text-ink-400">Code answers are graded by AI against the question; you can adjust the score afterwards.</p>
                      )}
                      {q.type === 'ESSAY' && (
                        <p className="text-body-xs text-ink-500 dark:text-ink-400">Essay answers are graded by AI against the question; you can adjust the score afterwards.</p>
                      )}
                      {q.type === 'VIDEO' && (
                        <p className="text-body-xs text-ink-500 dark:text-ink-400">Candidates paste a link to a video answer. You score it yourself in the results.</p>
                      )}
                    </div>
                  )
                })}

                <Button type="button" variant="secondary" className="w-full" onClick={() => updateRound(roundIndex, { questions: [...round.questions, blankQuestion()] })}>
                  <Plus className="h-4 w-4" />
                  Add question
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <ConfirmModal
        isOpen={removingRound !== null}
        onClose={() => setRemovingRound(null)}
        onConfirm={() => removingRound !== null && removeRound(removingRound)}
        title="Remove round?"
        message={`Remove "${removingRound !== null ? rounds[removingRound]?.title || `Round ${removingRound + 1}` : ''}" from this assessment?`}
        confirmText="Remove round"
        variant="danger"
      >
        {removingRound !== null && rounds[removingRound]
          ? `Its ${rounds[removingRound].questions.length} ${rounds[removingRound].questions.length === 1 ? 'question' : 'questions'} will be removed too. This only takes effect when you save the assessment.`
          : null}
      </ConfirmModal>

      <div className="surface sticky bottom-4 z-20 rounded-xl shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <p className="flex items-center gap-2 text-body-sm text-ink-700 dark:text-ink-300">
            <ClipboardList className="h-4 w-4" aria-hidden="true" />
            {rounds.length} {rounds.length === 1 ? 'round' : 'rounds'} · {totals.questions} {totals.questions === 1 ? 'question' : 'questions'} · {totals.minutes} min total
          </p>
          <div className="flex items-center gap-3">
            <Button type="button" variant="ghost" onClick={() => navigate(returnTo)}>Cancel</Button>
            <Button type="button" size="lg" loading={isSaving} onClick={save}>
              {isEditing ? 'Update' : 'Create'} assessment
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
