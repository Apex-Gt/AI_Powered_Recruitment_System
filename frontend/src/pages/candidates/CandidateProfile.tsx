import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { CalendarPlus, ChevronLeft, Download, Eye, FileText, Pencil, Sparkles, Trash2, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/context/AuthContext'
import { assessmentApi, candidateApi, interviewApi, resumeApi } from '@/utils/api'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/Badge'
import { ConfirmModal } from '@/components/ui/Modal'
import { Textarea } from '@/components/ui/Input'
import { AITags } from '@/components/ui/ScoreIndicator'
import { EmptyNote, Panel } from '@/components/ui/Panel'
import { RequirementEvidence } from '@/components/candidates/RequirementEvidence'
import { EditCandidateModal } from '@/components/candidates/EditCandidateModal'
import { AttemptReviewModal } from '@/components/assessments/AttemptReviewModal'
import { cn, formatDate, formatRelativeTime, getInitials } from '@/utils/helpers'
import type { AIAnalysis, AssessmentAttempt, Candidate, CandidateStatus, Interview, Resume } from '@/types'

/** The path a candidate follows. Rejected is an exit, shown separately. */
const STAGES: { status: CandidateStatus; label: string }[] = [
  { status: 'APPLIED', label: 'Applied' },
  { status: 'SCREENING', label: 'Screening' },
  { status: 'SHORTLISTED', label: 'Shortlisted' },
  { status: 'INTERVIEW', label: 'Interview' },
  { status: 'SELECTED', label: 'Selected' },
]

interface Note {
  id: string
  note: string
  authorName: string
  createdAt: string
}

type Tab = 'overview' | 'analysis' | 'resume' | 'notes'

const TABS: { value: Tab; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'analysis', label: 'AI analysis' },
  { value: 'resume', label: 'Resume' },
  { value: 'notes', label: 'Notes' },
]

function StageTrack({ status, canEdit, busy, onMove }: { status: CandidateStatus; canEdit: boolean; busy: boolean; onMove: (s: CandidateStatus) => void }) {
  const current = STAGES.findIndex((s) => s.status === status)
  const rejected = status === 'REJECTED'
  return (
    <nav aria-label="Candidate stage">
      <ol className="flex flex-wrap items-center gap-y-2">
        {STAGES.map((stage, i) => {
          const reached = !rejected && i <= current
          const isCurrent = !rejected && i === current
          return (
            <li key={stage.status} className="flex items-center">
              {i > 0 && <span className={cn('mx-2 h-0.5 w-6 sm:w-10', reached ? 'bg-brand-500 dark:bg-brand-400' : 'bg-[var(--color-border-hover)]')} aria-hidden="true" />}
              <button
                type="button"
                disabled={!canEdit || busy || isCurrent}
                onClick={() => onMove(stage.status)}
                aria-current={isCurrent ? 'step' : undefined}
                aria-label={isCurrent ? `${stage.label}, current stage` : `Move to ${stage.label}`}
                className={cn(
                  'flex h-9 items-center rounded-full px-4 text-body-sm font-semibold transition-colors disabled:cursor-default',
                  isCurrent
                    ? 'bg-brand-500 text-[#1c1917]'
                    : reached
                      ? 'bg-brand-100 text-brand-700 hover:bg-brand-200 dark:bg-brand-900/60 dark:text-brand-200'
                      : 'border border-[var(--color-border-hover)] text-ink-600 hover:bg-base-100 dark:text-ink-400 dark:hover:bg-surface-dark-elevated',
                  !canEdit && 'hover:!bg-transparent'
                )}
              >
                {stage.label}
              </button>
            </li>
          )
        })}
        {rejected && (
          <li className="ml-3">
            <span className="badge-error px-3 py-1.5 text-body-sm">Rejected</span>
          </li>
        )}
      </ol>
    </nav>
  )
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-body-xs font-semibold text-ink-600 dark:text-ink-400">{label}</dt>
      <dd className="mt-0.5 break-words text-body-md text-ink-900 dark:text-ink-100">{children}</dd>
    </div>
  )
}

export function CandidateProfile() {
  const { id } = useParams<{ id: string }>()
  const { hasRole } = useAuth()
  const navigate = useNavigate()
  const canEdit = hasRole(['ADMIN', 'RECRUITER'])

  const [candidate, setCandidate] = useState<Candidate | null>(null)
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null)
  const [resume, setResume] = useState<Resume | null>(null)
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [attempts, setAttempts] = useState<AssessmentAttempt[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [noteText, setNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('overview')
  const [busy, setBusy] = useState(false)
  const [analysing, setAnalysing] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [reviewingAttempt, setReviewingAttempt] = useState<AssessmentAttempt | null>(null)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const poll = useRef<number | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    const load = async () => {
      setIsLoading(true)
      try {
        const c = await candidateApi.getByIdLegacyUnwrapped(id)
        if (cancelled) return
        setCandidate(c)
        const [ai, res, ints, atts, nts] = await Promise.all([
          candidateApi.getAiAnalysisUnwrapped(id).catch(() => null),
          c.resumeId ? resumeApi.getByIdUnwrapped(c.resumeId).catch(() => null) : Promise.resolve(null),
          interviewApi.getAll({ candidateId: id, pageSize: 20 }).then((r) => r.data).catch(() => []),
          assessmentApi.getAttempts({ candidateId: id }).catch(() => []),
          candidateApi.getNotes(id).catch(() => []),
        ])
        if (cancelled) return
        setAiAnalysis(ai)
        setResume(res)
        setInterviews(ints)
        setAttempts(atts)
        setNotes(nts)
      } catch (error) {
        console.error('Failed to fetch candidate:', error)
        if (!cancelled) setCandidate(null)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [id, reloadKey])

  useEffect(() => () => {
    if (poll.current) window.clearInterval(poll.current)
  }, [])

  // Ingestion, embedding and scoring run asynchronously; wait for them instead of treating "not ready" as an error.
  const waitingForAnalysis = !isLoading && !!candidate && !aiAnalysis && !analysing
  useEffect(() => {
    if (!waitingForAnalysis || !id) return
    let cancelled = false
    let tries = 0
    const timer = window.setInterval(async () => {
      tries += 1
      try {
        const ai = await candidateApi.getAiAnalysisUnwrapped(id)
        if (cancelled) return
        if (ai) {
          window.clearInterval(timer)
          setAiAnalysis(ai)
          setCandidate((prev) => (prev ? { ...prev, aiMatchScore: ai.overallScore } : prev))
        } else if (tries >= 24) {
          window.clearInterval(timer)
        }
      } catch {
        // A real error (e.g. candidate deleted): stop polling
        window.clearInterval(timer)
      }
    }, 5000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [waitingForAnalysis, id])

  const move = useCallback(
    async (status: CandidateStatus) => {
      if (!candidate || !id) return
      setBusy(true)
      try {
        if (status === 'SHORTLISTED') await candidateApi.shortlist(id)
        else if (status === 'REJECTED') await candidateApi.reject(id)
        else await candidateApi.updateStatus(id, status)
        setCandidate((prev) => (prev ? { ...prev, status } : prev))
        toast.success(`Moved to ${status.charAt(0) + status.slice(1).toLowerCase()}`)
      } catch (e) {
        toast.error(e instanceof Error && e.message ? e.message : 'Could not change the stage')
      } finally {
        setBusy(false)
      }
    },
    [candidate, id]
  )

  const runAnalysis = async () => {
    if (!candidate || !id) return
    setAnalysing(true)
    try {
      await candidateApi.scoreJob(id, candidate.jobId)
      toast.success('Analysis started. This usually takes under a minute.')
      let tries = 0
      poll.current = window.setInterval(async () => {
        tries += 1
        const ai = await candidateApi.getAiAnalysisUnwrapped(id).catch(() => null)
        if (ai || tries >= 12) {
          if (poll.current) window.clearInterval(poll.current)
          poll.current = null
          setAnalysing(false)
          if (ai) {
            setAiAnalysis(ai)
            setCandidate((prev) => (prev ? { ...prev, aiMatchScore: ai.overallScore } : prev))
            setTab('analysis')
          } else {
            toast('Still working. Check back in a moment.')
          }
        }
      }, 5000)
    } catch (e) {
      setAnalysing(false)
      toast.error(e instanceof Error && e.message ? e.message : 'Could not start the analysis')
    }
  }

  const addNote = async () => {
    if (!id || !noteText.trim()) return
    setSavingNote(true)
    try {
      const saved = await candidateApi.addNote(id, noteText.trim())
      setNotes((prev) => [saved, ...prev])
      setNoteText('')
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : 'Could not save the note')
    } finally {
      setSavingNote(false)
    }
  }

  const handleDelete = async () => {
    if (!candidate) return
    setIsDeleting(true)
    try {
      await candidateApi.delete(candidate.id)
      toast.success(`${candidate.candidateName} deleted`)
      navigate('/candidates')
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : 'Failed to delete candidate')
      setIsDeleting(false)
      setConfirmDeleteOpen(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading candidate">
        <div className="h-20 w-1/2 animate-pulse rounded-lg bg-base-100 dark:bg-surface-dark-elevated" />
        <div className="h-10 w-2/3 animate-pulse rounded-lg bg-base-100 dark:bg-surface-dark-elevated" />
        <div className="h-72 animate-pulse rounded-xl bg-base-100 dark:bg-surface-dark-elevated" />
      </div>
    )
  }

  if (!candidate) {
    return (
      <div className="surface mx-auto max-w-lg rounded-xl p-10 text-center">
        <h1 className="font-display text-heading-lg font-bold text-ink-900 dark:text-ink-100">Candidate not found</h1>
        <p className="mt-2 text-body-md text-ink-600 dark:text-ink-400">They may have been deleted, or the link is wrong.</p>
        <Link to="/candidates" className="btn-secondary mt-6 inline-flex no-underline">Back to candidates</Link>
      </div>
    )
  }

  const status = candidate.status ?? 'APPLIED'
  const score = aiAnalysis?.overallScore ?? candidate.aiMatchScore
  const resumeUrl = resume ? `/api/resumes/${resume.id}/file` : undefined

  return (
    <div className="space-y-8">
      <div>
        <Link to="/candidates" className="inline-flex items-center gap-1 text-body-sm font-semibold text-ink-700 no-underline hover:underline dark:text-ink-300">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Candidates
        </Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="avatar-xl !rounded-xl">{getInitials(candidate.candidateName)}</span>
            <div>
              <h1 className="text-heading-xl font-bold text-ink-900 dark:text-ink-100">{candidate.candidateName}</h1>
              <p className="mt-1 text-body-md text-ink-600 dark:text-ink-400">
                Applied for{' '}
                <Link to={`/jobs/${candidate.jobId}`} className="font-semibold text-ink-800 underline-offset-2 hover:underline dark:text-ink-200">
                  {candidate.jobTitle ?? 'a position'}
                </Link>{' '}
                on {formatDate(candidate.appliedAt || candidate.createdAt || new Date().toISOString())}
              </p>
            </div>
          </div>

          {canEdit && (
            <div className="flex flex-wrap items-center gap-2">
              <Link to={`/interviews?schedule=${candidate.id}`} className="btn-primary no-underline">
                <CalendarPlus className="h-4 w-4" aria-hidden="true" />
                Schedule interview
              </Link>
              <Button variant="secondary" onClick={() => move('REJECTED')} disabled={busy || status === 'REJECTED'}>
                <XCircle className="h-4 w-4" aria-hidden="true" />
                Reject
              </Button>
              <button onClick={() => setEditOpen(true)} className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-[var(--color-border-hover)] text-ink-700 transition-colors hover:bg-base-100 dark:text-ink-300 dark:hover:bg-surface-dark-elevated" aria-label="Edit candidate" title="Edit">
                <Pencil className="h-4 w-4" />
              </button>
              <button onClick={() => setConfirmDeleteOpen(true)} className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-[var(--color-border-hover)] text-error-600 transition-colors hover:bg-error-50 dark:text-error-400 dark:hover:bg-error-900/20" aria-label="Delete candidate" title="Delete">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        <div className="mt-6">
          <StageTrack status={status} canEdit={canEdit} busy={busy} onMove={move} />
        </div>
      </div>

      <AttemptReviewModal
        attemptId={reviewingAttempt?.id ?? null}
        title={reviewingAttempt ? `Results: ${reviewingAttempt.assessmentTitle}` : undefined}
        onClose={() => setReviewingAttempt(null)}
        onChanged={() => setReloadKey((k) => k + 1)}
      />

      <EditCandidateModal candidate={editOpen ? candidate : null} onClose={() => setEditOpen(false)} onSaved={() => setReloadKey((k) => k + 1)} />

      <ConfirmModal
        isOpen={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete candidate?"
        message={`Delete ${candidate.candidateName}? This can't be undone.`}
        confirmText="Delete"
        variant="danger"
        loading={isDeleting}
      >
        Their uploaded resume, notes, interviews and AI analysis will be removed too.
      </ConfirmModal>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          <div role="tablist" aria-label="Candidate sections" className="tabs-list">
            {TABS.map((t) => (
              <button
                key={t.value}
                role="tab"
                aria-selected={tab === t.value}
                onClick={() => setTab(t.value)}
                className={tab === t.value ? 'tabs-trigger-active' : 'tabs-trigger'}
              >
                {t.label}
                {t.value === 'notes' && notes.length > 0 && <span className="rounded bg-base-100 px-1.5 text-label-xs tabular dark:bg-surface-dark-elevated">{notes.length}</span>}
              </button>
            ))}
          </div>

          <div className="mt-6" role="tabpanel">
            {tab === 'overview' && (
              <div className="space-y-8">
                <dl className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
                  <Fact label="Email"><a href={`mailto:${candidate.candidateEmail}`} className="underline-offset-2 hover:underline">{candidate.candidateEmail}</a></Fact>
                  <Fact label="Phone">{candidate.phoneNumber || 'Not provided'}</Fact>
                  <Fact label="Location">{candidate.location || 'Not provided'}</Fact>
                  <Fact label="Experience">{candidate.experience ? `${candidate.experience} years` : 'Not detected yet'}</Fact>
                </dl>

                <section aria-label="Skills">
                  <h2 className="font-display text-heading-sm font-semibold text-ink-900 dark:text-ink-100">Skills</h2>
                  {(candidate.skills ?? []).length === 0 ? (
                    <p className="mt-2 text-body-sm text-ink-600 dark:text-ink-400">Skills are read from the resume once it has been analysed.</p>
                  ) : (
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {candidate.skills!.map((skill) => (
                        <li key={skill} className="badge-default text-body-xs">{skill}</li>
                      ))}
                    </ul>
                  )}
                </section>

                <section aria-label="Interviews">
                  <h2 className="font-display text-heading-sm font-semibold text-ink-900 dark:text-ink-100">Interviews</h2>
                  {interviews.length === 0 ? (
                    <p className="mt-2 text-body-sm text-ink-600 dark:text-ink-400">None scheduled yet.</p>
                  ) : (
                    <ul className="surface mt-3 divide-y divide-[var(--color-border)] rounded-xl">
                      {interviews.map((i) => (
                        <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                          <div>
                            <p className="text-body-sm font-semibold text-ink-900 dark:text-ink-100">
                              {new Date(i.scheduledAt).toLocaleString('en-US', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                            </p>
                            <p className="text-body-xs text-ink-600 dark:text-ink-400">
                              {i.type.charAt(0) + i.type.slice(1).toLowerCase()}, {i.duration} min
                              {i.feedback ? `, rated ${i.feedback.rating} of 5` : ''}
                            </p>
                          </div>
                          <StatusBadge status={i.status} />
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section aria-label="Assessments">
                  <h2 className="font-display text-heading-sm font-semibold text-ink-900 dark:text-ink-100">Assessments</h2>
                  {attempts.length === 0 ? (
                    <p className="mt-2 text-body-sm text-ink-600 dark:text-ink-400">None sent. You can send one from the Assessments page.</p>
                  ) : (
                    <ul className="surface mt-3 divide-y divide-[var(--color-border)] rounded-xl">
                      {attempts.map((a) => (
                        <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                          <div>
                            <p className="text-body-sm font-semibold text-ink-900 dark:text-ink-100">{a.assessmentTitle}</p>
                            <p className="text-body-xs text-ink-600 dark:text-ink-400">Sent {formatRelativeTime(a.assignedAt)}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            {a.totalScore != null && <span className="font-display text-body-md font-bold tabular text-ink-900 dark:text-ink-100">{a.totalScore}%</span>}
                            {a.pendingReview > 0 && <span className="text-body-xs text-info-600 dark:text-info-400">{a.pendingReview} to review</span>}
                            <StatusBadge status={a.status} />
                            {(a.status === 'SUBMITTED' || a.status === 'GRADED') && (
                              <Button variant="secondary" size="sm" onClick={() => setReviewingAttempt(a)}>
                                View answers
                              </Button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            )}

            {tab === 'analysis' &&
              (aiAnalysis ? (
                <div className="space-y-6">
                  {aiAnalysis.summary && <p className="max-w-prose text-body-lg text-ink-800 dark:text-ink-200">{aiAnalysis.summary}</p>}
                  <RequirementEvidence analysis={aiAnalysis} />
                  <AITags matchingSkills={aiAnalysis.matchingSkills} relevantExperience={aiAnalysis.relevantExperience} potentialGaps={aiAnalysis.potentialGaps} />
                  {aiAnalysis.generatedAt && <p className="text-body-xs text-ink-600 dark:text-ink-400">Generated {formatRelativeTime(aiAnalysis.generatedAt)} by the AI service.</p>}
                  {canEdit && (
                    <Button variant="secondary" onClick={runAnalysis} loading={analysing}>
                      <Sparkles className="h-4 w-4" aria-hidden="true" />
                      Run again
                    </Button>
                  )}
                </div>
              ) : (
                <div className="surface rounded-xl p-8">
                  <EmptyNote icon={Sparkles} title="Not analysed yet" text="The AI reads the resume against this job and explains how well they match." />
                  {canEdit && (
                    <div className="mt-4 flex justify-center">
                      <Button onClick={runAnalysis} loading={analysing}>
                        <Sparkles className="h-4 w-4" aria-hidden="true" />
                        Run AI screening
                      </Button>
                    </div>
                  )}
                </div>
              ))}

            {tab === 'resume' &&
              (resume ? (
                <div className="space-y-4">
                  <div className="surface flex flex-wrap items-center justify-between gap-3 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-clay-100 text-clay-700 dark:bg-clay-800 dark:text-clay-200">
                        <FileText className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div>
                        <p className="text-body-md font-semibold text-ink-900 dark:text-ink-100">{resume.fileName}</p>
                        <p className="text-body-xs text-ink-600 dark:text-ink-400">Uploaded {formatDate(resume.uploadedAt || new Date().toISOString())}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <a href={resumeUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary-sm no-underline">
                        <Eye className="h-4 w-4" aria-hidden="true" />
                        View
                      </a>
                      <a href={resumeUrl} download={resume.fileName} className="btn-secondary-sm no-underline">
                        <Download className="h-4 w-4" aria-hidden="true" />
                        Download
                      </a>
                    </div>
                  </div>
                  {resume.extractedText ? (
                    <div>
                      <h2 className="mb-2 font-display text-heading-sm font-semibold text-ink-900 dark:text-ink-100">Text the AI read</h2>
                      <pre className="surface max-h-[28rem] overflow-y-auto whitespace-pre-wrap rounded-xl p-4 font-sans text-body-sm text-ink-700 dark:text-ink-300">{resume.extractedText}</pre>
                    </div>
                  ) : (
                    <p className="text-body-sm text-ink-600 dark:text-ink-400">The extracted text appears here once the resume has been processed.</p>
                  )}
                </div>
              ) : (
                <EmptyNote icon={FileText} title="No resume on file" text="The resume could not be loaded." />
              ))}

            {tab === 'notes' && (
              <div className="space-y-6">
                {canEdit && (
                  <div className="space-y-3">
                    <Textarea label="Add a note" placeholder="What did you notice? Notes are visible to your whole team." value={noteText} onChange={(e) => setNoteText(e.target.value)} />
                    <Button onClick={addNote} loading={savingNote} disabled={!noteText.trim()}>Save note</Button>
                  </div>
                )}
                {notes.length === 0 ? (
                  <p className="text-body-sm text-ink-600 dark:text-ink-400">No notes yet.</p>
                ) : (
                  <ul className="surface divide-y divide-[var(--color-border)] rounded-xl">
                    {notes.map((n) => (
                      <li key={n.id} className="px-4 py-3">
                        <p className="whitespace-pre-wrap text-body-md text-ink-900 dark:text-ink-100">{n.note}</p>
                        <p className="mt-1 text-body-xs text-ink-600 dark:text-ink-400">{n.authorName}, {formatRelativeTime(n.createdAt)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start" aria-label="Match summary">
          <Panel title="Match with this job" note={score !== undefined ? 'Scored by the AI against the job description' : undefined}>
            {score === undefined ? (
              <div className="text-center">
                <p className="text-body-sm text-ink-600 dark:text-ink-400">No score yet.</p>
                {canEdit && (
                  <Button className="mt-3" onClick={runAnalysis} loading={analysing}>
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                    Run AI screening
                  </Button>
                )}
              </div>
            ) : (
              <>
                <p className="font-display text-display-md font-bold tabular text-accent-600 dark:text-accent-400">
                  {Math.round(score)}
                  <span className="ml-1 text-heading-sm font-semibold text-ink-600 dark:text-ink-400">out of 100</span>
                </p>
                {aiAnalysis?.breakdown && (
                  <ul className="mt-5 space-y-3">
                    {(
                      [
                        ['Skills', aiAnalysis.breakdown.skills],
                        ['Experience', aiAnalysis.breakdown.experience],
                        ['Education', aiAnalysis.breakdown.education],
                        ['Job relevance', aiAnalysis.breakdown.jobRelevance],
                      ] as const
                    ).map(([label, value]) => (
                      <li key={label}>
                        <div className="flex items-baseline justify-between text-body-sm">
                          <span className="font-semibold text-ink-800 dark:text-ink-200">{label}</span>
                          <span className="font-display font-bold tabular text-ink-900 dark:text-ink-100">{Math.round(value)}</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-sm bg-base-100 dark:bg-surface-dark-elevated" aria-hidden="true">
                          <div className="h-full rounded-sm bg-accent-500" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </Panel>
        </aside>
      </div>
    </div>
  )
}
