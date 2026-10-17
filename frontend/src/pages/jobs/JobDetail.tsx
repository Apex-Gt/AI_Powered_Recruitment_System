import { useCallback, useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Briefcase, ChevronLeft, Pencil, Sparkles, Trash2, Upload, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/context/AuthContext'
import { jobApi, candidateApi } from '@/utils/api'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { FigureStrip } from '@/components/ui/FigureStrip'
import { MatchScore } from '@/components/ui/ListPage'
import { ConfirmModal } from '@/components/ui/Modal'
import { Panel } from '@/components/ui/Panel'
import { UploadResumesModal } from '@/components/candidates/UploadResumesModal'
import { formatDate, formatCurrency, getInitials } from '@/utils/helpers'
import type { Job, Candidate, JobSkill } from '@/types'

type Tab = 'overview' | 'candidates'

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
  const [tab, setTab] = useState<Tab>('overview')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [screening, setScreening] = useState(false)

  const loadCandidates = useCallback(async () => {
    if (!id) return
    try {
      const res = await candidateApi.getAllUnwrapped({ jobId: id, pageSize: 200 })
      setCandidates(res.data as Candidate[])
    } catch (error) {
      console.error('Failed to refresh candidates:', error)
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
        await loadCandidates()
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
  }, [id, hasRole, loadCandidates])

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

  const screenAll = async () => {
    if (!job || candidates.length === 0) return
    setScreening(true)
    const results = await Promise.allSettled(candidates.map((c) => candidateApi.scoreJob(c.id, job.id)))
    const started = results.filter((r) => r.status === 'fulfilled').length
    setScreening(false)
    if (started === 0) {
      toast.error('Could not start the analysis. Check that the AI service is running.')
      return
    }
    toast.success(`Analysis started for ${started} ${started === 1 ? 'candidate' : 'candidates'}. Scores appear as each finishes.`)
    window.setTimeout(() => void loadCandidates(), 20000)
    setTab('candidates')
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
  const required = job.skills.filter((s) => s.type === 'REQUIRED')
  const preferred = job.skills.filter((s) => s.type !== 'REQUIRED')
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
            {(['overview', 'candidates'] as Tab[]).map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={tab === t ? 'tabs-trigger-active' : 'tabs-trigger'}>
                {t === 'overview' ? 'Overview' : 'Candidates'}
                {t === 'candidates' && <span className="rounded bg-base-100 px-1.5 text-label-xs tabular dark:bg-surface-dark-elevated">{candidates.length}</span>}
              </button>
            ))}
          </div>

          <div className="mt-6" role="tabpanel">
            {tab === 'overview' && (
              <div className="space-y-8">
                <section aria-label="Description">
                  <h2 className="font-display text-heading-sm font-semibold text-ink-900 dark:text-ink-100">About the role</h2>
                  <p className="mt-3 max-w-prose whitespace-pre-wrap text-body-md leading-relaxed text-ink-800 dark:text-ink-200">{job.description}</p>
                </section>

                <section aria-label="Skills" className="space-y-5">
                  <div>
                    <h2 className="font-display text-heading-sm font-semibold text-ink-900 dark:text-ink-100">What the AI looks for</h2>
                    <p className="mt-0.5 text-body-xs text-ink-600 dark:text-ink-400">A higher weight counts for more in a candidate's match score.</p>
                  </div>
                  {job.skills.length === 0 && <p className="text-body-sm text-ink-600 dark:text-ink-400">No skills were added to this job.</p>}
                  <SkillGroup title="Required" skills={required} color="#ff6000" />
                  <SkillGroup title="Preferred" skills={preferred} color="#ffa468" />
                </section>
              </div>
            )}

            {tab === 'candidates' &&
              (ranked.length === 0 ? (
                <div className="surface rounded-xl">
                  <EmptyState
                    icon={<Users className="h-14 w-14" />}
                    title="Nobody has applied yet"
                    description="Upload resumes and the AI will score each one against this job."
                    action={canEdit ? { label: 'Add candidates', onClick: () => setUploadOpen(true) } : undefined}
                  />
                </div>
              ) : (
                <ul className="surface divide-y divide-[var(--color-border)] overflow-hidden rounded-xl">
                  {ranked.map((c) => (
                    <li key={c.id}>
                      <Link to={`/candidates/${c.id}`} className="flex flex-wrap items-center gap-4 px-5 py-3.5 no-underline transition-colors hover:bg-base-50 dark:hover:bg-surface-dark-elevated">
                        <span className="avatar-sm flex-shrink-0">{getInitials(c.candidateName)}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-body-sm font-semibold text-ink-900 dark:text-ink-100">{c.candidateName}</p>
                          <p className="truncate text-body-xs text-ink-600 dark:text-ink-400">{c.candidateEmail}</p>
                        </div>
                        <MatchScore score={c.aiMatchScore} />
                        <StatusBadge status={c.status || 'APPLIED'} />
                        <span className="w-24 text-right text-body-xs text-ink-600 dark:text-ink-400">{formatDate(c.appliedAt || c.createdAt || new Date().toISOString())}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ))}
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
            <Panel title="AI screening" note="Score every applicant against this job">
              <Button variant="secondary" className="w-full" onClick={screenAll} loading={screening} disabled={candidates.length === 0}>
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                Run AI screening
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

      <UploadResumesModal
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={() => {
          void loadCandidates()
          setTab('candidates')
        }}
        fixedJob={{ id: job.id, title: job.title }}
      />
    </div>
  )
}
