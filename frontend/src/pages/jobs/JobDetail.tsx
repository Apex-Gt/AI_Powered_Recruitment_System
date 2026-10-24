import { useCallback, useEffect, useState } from 'react'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import { BarChart3, Briefcase, CheckSquare, ChevronLeft, Pencil, Plus, Send, Sparkles, Trash2, Upload, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/context/AuthContext'
import { jobApi, candidateApi, assessmentApi, batchApi } from '@/utils/api'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { FigureStrip } from '@/components/ui/FigureStrip'
import { MatchScore } from '@/components/ui/ListPage'
import { ConfirmModal } from '@/components/ui/Modal'
import { Panel } from '@/components/ui/Panel'
import { UploadResumesModal } from '@/components/candidates/UploadResumesModal'
import { ActiveBatches } from '@/components/candidates/ActiveBatches'
import { EditCandidateModal } from '@/components/candidates/EditCandidateModal'
import { assessmentTypes } from '@/utils/assessmentTypes'
import { AssignAssessmentModal } from '@/components/assessments/AssignAssessmentModal'
import { AssessmentResultsModal } from '@/components/assessments/AssessmentResultsModal'
import { formatDate, formatCurrency, getInitials } from '@/utils/helpers'
import type { Job, Candidate, JobSkill, Assessment } from '@/types'

type Tab = 'overview' | 'candidates' | 'assessments'

const TAB_LABELS: Record<Tab, string> = { overview: 'Overview', candidates: 'Candidates', assessments: 'Assessments' }

const SKILLS_PREVIEW = 5

const iconBtn =
  'flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-ink-500 transition-colors hover:bg-base-100 hover:text-ink-900 dark:text-ink-400 dark:hover:bg-surface-dark-elevated dark:hover:text-ink-100'

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="text-body-sm text-ink-600 dark:text-ink-400">{label}</dt>
      <dd className="text-right text-body-sm font-semibold text-ink-900 dark:text-ink-100">{children}</dd>
    </div>
  )
}

function SkillGroup({ title, skills, color }: { title: string; skills: JobSkill[]; color: string }) {
  if (skills.length === 0) return null
  return (
    <div>
      <h3 className="mb-2 text-body-sm font-semibold text-ink-800 dark:text-ink-200">{title}</h3>
      <ul className="space-y-2">
        {skills.map((s) => (
          <li key={s.id} className="grid grid-cols-[minmax(7rem,12rem)_1fr_3rem] items-center gap-3">
            <span className="truncate text-body-sm text-ink-900 dark:text-ink-100">{s.skillName}</span>
            <div className="h-1.5 overflow-hidden rounded-sm bg-base-100 dark:bg-surface-dark-elevated" aria-hidden="true">
              <div className="h-full rounded-sm" style={{ width: `${Math.min(100, s.weight)}%`, background: color }} />
            </div>
            <span className="text-right font-display text-body-sm font-bold tabular text-ink-900 dark:text-ink-100">{s.weight}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function JobDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { hasRole } = useAuth()
  const canEdit = hasRole(['ADMIN', 'RECRUITER'])
  const [job, setJob] = useState<Job | null>(null)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState<Tab>(searchParams.get('tab') === 'assessments' ? 'assessments' : 'overview')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [ranking, setRanking] = useState(false)
  const [progressKey, setProgressKey] = useState(0)
  const [showAllSkills, setShowAllSkills] = useState(false)
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null)
  const [deletingCandidate, setDeletingCandidate] = useState<Candidate | null>(null)
  const [isDeletingCandidate, setIsDeletingCandidate] = useState(false)
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [assigning, setAssigning] = useState<Assessment | null>(null)
  const [viewingResults, setViewingResults] = useState<Assessment | null>(null)
  const [deletingAssessment, setDeletingAssessment] = useState<Assessment | null>(null)
  const [isDeletingAssessment, setIsDeletingAssessment] = useState(false)

  const loadCandidates = useCallback(async () => {
    if (!id) return
    try {
      const res = await candidateApi.getAllUnwrapped({ jobId: id, pageSize: 200 })
      setCandidates(res.data as Candidate[])
    } catch (error) {
      console.error('Failed to refresh candidates:', error)
    }
  }, [id])

  const loadAssessments = useCallback(async () => {
    if (!id) return
    try {
      setAssessments(await assessmentApi.getAll({ jobId: id }))
    } catch (error) {
      console.error('Failed to load assessments:', error)
    }
  }, [id])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    const load = async () => {
      setIsLoading(true)
      try {
        const jobRes = hasRole(['ADMIN']) ? await jobApi.getByIdForAdmin(id) : await jobApi.getByIdForRecruiter(id)
        const raw = 'data' in jobRes ? jobRes.data : (jobRes as unknown as Job)
        const status = (raw.status as string) === 'OPEN' ? 'ACTIVE' : raw.status
        if (!cancelled) setJob({ ...raw, status, skills: raw.skills ?? [] } as Job)
        await Promise.all([loadCandidates(), loadAssessments()])
      } catch (error) {
        console.error('Failed to fetch job:', error)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [id, hasRole, loadCandidates, loadAssessments])

  const handleDelete = async () => {
    if (!job) return
    setIsDeleting(true)
    try {
      if (hasRole(['ADMIN'])) await jobApi.deleteForAdmin(job.id)
      else await jobApi.deleteForRecruiter(job.id)
      toast.success('Job deleted')
      navigate('/jobs')
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : 'Failed to delete job')
      setIsDeleting(false)
      setConfirmDeleteOpen(false)
    }
  }

  // The editor is a full page; it brings the user back to this job's Assessments tab when done.
  const openAssessmentEditor = (assessment: Assessment | null = null) => {
    if (!job) return
    const returnTo = `/jobs/${job.id}?tab=assessments`
    if (assessment) navigate(`/assessments/${assessment.id}/edit`, { state: { returnTo } })
    else navigate(`/assessments/new?jobId=${job.id}`, { state: { returnTo } })
  }

  const confirmDeleteAssessment = async () => {
    if (!deletingAssessment) return
    setIsDeletingAssessment(true)
    try {
      await assessmentApi.delete(deletingAssessment.id)
      toast.success('Assessment deleted successfully')
      setDeletingAssessment(null)
      await loadAssessments()
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : 'Failed to delete assessment')
    } finally {
      setIsDeletingAssessment(false)
    }
  }

  const confirmDeleteCandidate = async () => {
    if (!deletingCandidate) return
    setIsDeletingCandidate(true)
    try {
      await candidateApi.delete(deletingCandidate.id)
      toast.success(`${deletingCandidate.candidateName} deleted`)
      setDeletingCandidate(null)
      await loadCandidates()
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : 'Failed to delete candidate')
    } finally {
      setIsDeletingCandidate(false)
    }
  }

  const rankCandidates = async () => {
    if (!job || candidates.length === 0) return
    setRanking(true)
    try {
      const { queued, waiting } = await batchApi.rank(job.id)
      if (queued === 0) {
        toast.error(waiting > 0 ? 'The resumes are still being read. Rank again once they are done.' : 'There are no read resumes to rank yet.')
        return
      }
      toast.success(
        `Ranking ${queued} ${queued === 1 ? 'candidate' : 'candidates'}. Scores appear as each one finishes.` +
          (waiting > 0 ? ` ${waiting} resume${waiting === 1 ? ' is' : 's are'} still being read and not included.` : '')
      )
      setProgressKey((n) => n + 1) // show the running batch straight away
      setTab('candidates')
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : 'Could not start ranking. Check that the AI service is running.')
    } finally {
      setRanking(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading job">
        <div className="h-12 w-1/2 animate-pulse rounded-lg bg-base-100 dark:bg-surface-dark-elevated" />
        <div className="h-24 animate-pulse rounded-xl bg-base-100 dark:bg-surface-dark-elevated" />
        <div className="h-72 animate-pulse rounded-xl bg-base-100 dark:bg-surface-dark-elevated" />
      </div>
    )
  }

  if (!job) {
    return (
      <div className="surface rounded-xl">
        <EmptyState
          icon={<Briefcase className="h-14 w-14" />}
          title="Job not found"
          description="It may have been deleted, or the link is wrong."
          action={{ label: 'Back to jobs', onClick: () => navigate('/jobs') }}
        />
      </div>
    )
  }

  const count = (s: string) => candidates.filter((c) => (c.status ?? 'APPLIED') === s).length
  // Required skills come first, so the short preview always leads with what matters most
  const orderedSkills = [...job.skills.filter((s) => s.type === 'REQUIRED'), ...job.skills.filter((s) => s.type !== 'REQUIRED')]
  const hiddenSkills = Math.max(0, orderedSkills.length - SKILLS_PREVIEW)
  const shownSkills = showAllSkills ? orderedSkills : orderedSkills.slice(0, SKILLS_PREVIEW)
  const required = shownSkills.filter((s) => s.type === 'REQUIRED')
  const preferred = shownSkills.filter((s) => s.type !== 'REQUIRED')
  const ranked = [...candidates].sort((a, b) => (b.aiMatchScore ?? -1) - (a.aiMatchScore ?? -1))
  const mode = job.workMode.charAt(0) + job.workMode.slice(1).toLowerCase()
  const type = job.employmentType.replace('_', ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())

  return (
    <div className="space-y-8">
      <div>
        <Link to="/jobs" className="inline-flex items-center gap-1 text-body-sm font-semibold text-ink-700 no-underline hover:underline dark:text-ink-300">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Jobs
        </Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-heading-xl font-bold text-ink-900 dark:text-ink-100">{job.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-body-md text-ink-600 dark:text-ink-400">
              <StatusBadge status={job.status} />
              <span>{job.department}</span>
              <span>{mode}, {type}</span>
              <span>{job.location}</span>
            </div>
          </div>
          {canEdit && (
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => setUploadOpen(true)}>
                <Upload className="h-4 w-4" aria-hidden="true" />
                Add candidates
              </Button>
              <Link to={`/jobs/${job.id}/edit`} className="btn-secondary no-underline">
                <Pencil className="h-4 w-4" aria-hidden="true" />
                Edit
              </Link>
              <button
                onClick={() => setConfirmDeleteOpen(true)}
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-[var(--color-border-hover)] text-error-600 transition-colors hover:bg-error-50 dark:text-error-400 dark:hover:bg-error-900/20"
                aria-label="Delete job"
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      <FigureStrip
        label="Applicants"
        figures={[
          { label: 'Applicants', value: candidates.length, note: `${job.vacancies} ${job.vacancies === 1 ? 'vacancy' : 'vacancies'}` },
          { label: 'Shortlisted', value: count('SHORTLISTED') },
          { label: 'In interview', value: count('INTERVIEW') },
          { label: 'Selected', value: count('SELECTED') },
        ]}
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          <div role="tablist" aria-label="Job sections" className="tabs-list">
            {(['overview', 'candidates', 'assessments'] as Tab[]).map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={tab === t ? 'tabs-trigger-active' : 'tabs-trigger'}>
                {TAB_LABELS[t]}
                {t === 'candidates' && <span className="rounded bg-base-100 px-1.5 text-label-xs tabular dark:bg-surface-dark-elevated">{candidates.length}</span>}
                {t === 'assessments' && <span className="rounded bg-base-100 px-1.5 text-label-xs tabular dark:bg-surface-dark-elevated">{assessments.length}</span>}
              </button>
            ))}
          </div>

          {canEdit && <ActiveBatches jobId={job.id} refreshKey={progressKey} onFinished={() => void loadCandidates()} />}

          <div className="mt-6" role="tabpanel">
            {tab === 'overview' && (
              <div className="space-y-8">
                <section aria-label="Description">
                  <h2 className="font-display text-heading-sm font-semibold text-ink-900 dark:text-ink-100">About the role</h2>
                  <div
                    className="mt-3 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-xl border border-[var(--color-border)] bg-base-50 p-4 text-body-md leading-relaxed text-ink-800 dark:bg-surface-dark-elevated dark:text-ink-200"
                    tabIndex={0}
                    role="region"
                    aria-label="Job description, scrollable"
                  >
                    {job.description}
                  </div>
                </section>

                <section aria-label="Skills" className="space-y-5">
                  <div>
                    <h2 className="font-display text-heading-sm font-semibold text-ink-900 dark:text-ink-100">What the AI looks for</h2>
                    <p className="mt-0.5 text-body-xs text-ink-600 dark:text-ink-400">A higher weight counts for more in a candidate's match score.</p>
                  </div>
                  {job.skills.length === 0 && <p className="text-body-sm text-ink-600 dark:text-ink-400">No skills were added to this job.</p>}
                  <SkillGroup title="Required" skills={required} color="#ff6000" />
                  <SkillGroup title="Preferred" skills={preferred} color="#ffa468" />
                  {hiddenSkills > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowAllSkills((v) => !v)}
                      aria-expanded={showAllSkills}
                      className="cursor-pointer text-body-sm font-semibold text-brand-700 hover:underline dark:text-brand-300"
                    >
                      {showAllSkills ? 'Show fewer skills' : `Show all ${orderedSkills.length} skills (${hiddenSkills} more)`}
                    </button>
                  )}
                </section>
              </div>
            )}

            {tab === 'candidates' &&
              (ranked.length === 0 ? (
                <div className="surface rounded-xl">
                  <EmptyState
                    icon={<Users className="h-14 w-14" />}
                    title="Nobody has applied yet"
                    description="Upload resumes to add candidates, then rank them against this job."
                    action={canEdit ? { label: 'Add candidates', onClick: () => setUploadOpen(true) } : undefined}
                  />
                </div>
              ) : (
                <ul className="surface divide-y divide-[var(--color-border)] overflow-hidden rounded-xl">
                  {ranked.map((c) => (
                    <li key={c.id} className="flex items-center transition-colors hover:bg-base-50 dark:hover:bg-surface-dark-elevated">
                      <Link to={`/candidates/${c.id}`} className="flex min-w-0 flex-1 flex-wrap items-center gap-4 px-5 py-3.5 no-underline">
                        <span className="avatar-sm flex-shrink-0">{getInitials(c.candidateName)}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-body-sm font-semibold text-ink-900 dark:text-ink-100">{c.candidateName}</p>
                          <p className="truncate text-body-xs text-ink-600 dark:text-ink-400">{c.candidateEmail}</p>
                        </div>
                        <MatchScore score={c.aiMatchScore} />
                        <StatusBadge status={c.status || 'APPLIED'} />
                        <span className="w-24 text-right text-body-xs text-ink-600 dark:text-ink-400">{formatDate(c.appliedAt || c.createdAt || new Date().toISOString())}</span>
                      </Link>
                      {canEdit && (
                        <div className="flex flex-shrink-0 items-center gap-0.5 pr-3">
                          <button type="button" className={iconBtn} aria-label={`Edit ${c.candidateName}`} title="Edit" onClick={() => setEditingCandidate(c)}>
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className={`${iconBtn} hover:!bg-error-50 hover:!text-error-600 dark:hover:!bg-error-900/20`}
                            aria-label={`Delete ${c.candidateName}`}
                            title="Delete"
                            onClick={() => setDeletingCandidate(c)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              ))}

            {tab === 'assessments' && (
              <div className="space-y-4">
                {canEdit && assessments.length > 0 && (
                  <div className="flex justify-end">
                    <Button onClick={() => openAssessmentEditor()}>
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      Create assessment
                    </Button>
                  </div>
                )}
                {assessments.length === 0 ? (
                  <div className="surface rounded-xl">
                    <EmptyState
                      icon={<CheckSquare className="h-14 w-14" />}
                      title="No assessments for this job"
                      description="Create a test for this role, then send it to candidates by email."
                      action={canEdit ? { label: 'Create assessment', onClick: () => openAssessmentEditor() } : undefined}
                    />
                  </div>
                ) : (
                  <ul className="surface divide-y divide-[var(--color-border)] overflow-hidden rounded-xl">
                    {assessments.map((a) => (
                      <li key={a.id} className="flex flex-wrap items-center gap-4 px-5 py-3.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-body-sm font-semibold text-ink-900 dark:text-ink-100">{a.title}</p>
                          <p className="truncate text-body-xs text-ink-600 dark:text-ink-400">
                            {assessmentTypes.find((t) => t.value === a.type)?.label} · {a.rounds?.length ?? 1} {(a.rounds?.length ?? 1) === 1 ? 'round' : 'rounds'} · {a.duration} min · {a.questions.length} {a.questions.length === 1 ? 'question' : 'questions'}
                          </p>
                        </div>
                        <StatusBadge status={a.status} />
                        {canEdit && (
                          <div className="flex items-center gap-1">
                            {a.status === 'ACTIVE' && (
                              <Button variant="ghost" size="sm" onClick={() => setAssigning(a)} title="Send to candidate">
                                <Send className="h-4 w-4" />
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => setViewingResults(a)} title="Results">
                              <BarChart3 className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => openAssessmentEditor(a)} title="Edit">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-error-500" onClick={() => setDeletingAssessment(a)} title="Delete" aria-label={`Delete ${a.title}`}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start" aria-label="Role facts">
          <Panel title="Role facts">
            <dl className="-my-2.5 divide-y divide-[var(--color-border)]">
              <Fact label="Experience">{job.experienceRequired}+ years</Fact>
              <Fact label="Education">{job.educationRequired}</Fact>
              <Fact label="Salary">{formatCurrency(job.minimumSalary)} to {formatCurrency(job.maximumSalary)}</Fact>
              <Fact label="Apply by">{formatDate(job.applicationDeadline)}</Fact>
              <Fact label="Posted">{formatDate(job.createdAt)}</Fact>
            </dl>
          </Panel>

          {canEdit && (
            <Panel title="Rank candidates" note="Score and summarise every applicant against this job">
              <Button variant="secondary" className="w-full" onClick={rankCandidates} loading={ranking} disabled={candidates.length === 0}>
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                Rank candidates
              </Button>
              {candidates.length === 0 && <p className="mt-2 text-body-xs text-ink-600 dark:text-ink-400">Add candidates first.</p>}
            </Panel>
          )}
        </aside>
      </div>

      <ConfirmModal
        isOpen={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete job?"
        message={`Delete "${job.title}"? This can't be undone.`}
        confirmText="Delete job"
        variant="danger"
        loading={isDeleting}
      >
        {candidates.length > 0
          ? `The ${candidates.length} candidate${candidates.length === 1 ? '' : 's'} who applied, with their resumes, will be deleted too.`
          : 'Any candidates who applied, with their resumes, will be deleted too.'}
      </ConfirmModal>

      <EditCandidateModal candidate={editingCandidate} onClose={() => setEditingCandidate(null)} onSaved={() => void loadCandidates()} />

      <ConfirmModal
        isOpen={deletingCandidate !== null}
        onClose={() => setDeletingCandidate(null)}
        onConfirm={confirmDeleteCandidate}
        title="Delete candidate?"
        message={`Delete ${deletingCandidate?.candidateName ?? 'this candidate'}? This can't be undone.`}
        confirmText="Delete"
        variant="danger"
        loading={isDeletingCandidate}
      >
        Their uploaded resume and AI analysis will be removed too.
      </ConfirmModal>

      <UploadResumesModal
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={() => {
          void loadCandidates()
          setProgressKey((n) => n + 1) // look for the new batch now that something was uploaded
          setTab('candidates')
        }}
        fixedJob={{ id: job.id, title: job.title }}
      />

      <ConfirmModal
        isOpen={deletingAssessment !== null}
        onClose={() => setDeletingAssessment(null)}
        onConfirm={confirmDeleteAssessment}
        title="Delete assessment?"
        message={`Delete "${deletingAssessment?.title ?? ''}"? This can't be undone.`}
        confirmText="Delete assessment"
        variant="danger"
        loading={isDeletingAssessment}
      >
        Its rounds and questions will be deleted, along with the answers and results of every candidate who was sent it.
      </ConfirmModal>
      <AssignAssessmentModal assessment={assigning} onClose={() => setAssigning(null)} />
      <AssessmentResultsModal assessment={viewingResults} onClose={() => setViewingResults(null)} />
    </div>
  )
}
