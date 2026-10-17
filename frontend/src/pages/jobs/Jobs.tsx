import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { candidateApi, jobApi } from '@/utils/api'
import { Card } from '@/components/ui/Card'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/Table'
import { StatusBadge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  ActiveFilters,
  ErrorBanner,
  FilterSelect,
  PageHeader,
  Pagination,
  SearchField,
  StatusTabs,
  TableSkeleton,
} from '@/components/ui/ListPage'
import { Briefcase, Building2, Edit, Eye, MapPin, Plus, Trash2, Users } from 'lucide-react'
import { ConfirmModal } from '@/components/ui/Modal'
import { formatDate } from '@/utils/helpers'
import toast from 'react-hot-toast'
import type { Job } from '@/types'

type JobStatus = Job['status']

const PAGE_SIZE = 10

const departmentOptions = [
  'Engineering', 'Marketing', 'Sales', 'Human Resources', 'Finance', 'Operations',
  'Product', 'Design', 'Customer Success', 'Legal', 'Other',
].map((d) => ({ value: d, label: d }))

const iconLink =
  'flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-ink-500 transition-colors hover:bg-base-100 hover:text-ink-900 dark:text-ink-400 dark:hover:bg-surface-dark-elevated dark:hover:text-ink-100'

export function Jobs() {
  const { hasRole } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [jobs, setJobs] = useState<Job[]>([])
  const [pagination, setPagination] = useState({ page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 0 })
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [deleting, setDeleting] = useState<Job | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const isAdmin = hasRole(['ADMIN'])
  const canEdit = hasRole(['ADMIN', 'RECRUITER'])

  const page = parseInt(searchParams.get('page') || '1')
  const status = (searchParams.get('status') || '') as JobStatus | ''
  const department = searchParams.get('department') || ''
  const urlSearch = searchParams.get('search') || ''
  const [searchText, setSearchText] = useState(urlSearch)

  const updateParams = useCallback(
    (changes: Record<string, string | undefined>, resetPage = true) => {
      const params = new URLSearchParams(searchParams)
      Object.entries(changes).forEach(([k, v]) => (v ? params.set(k, v) : params.delete(k)))
      if (resetPage) params.delete('page')
      setSearchParams(params)
    },
    [searchParams, setSearchParams]
  )

  // Debounce typing into the URL so we don't fetch on every keystroke
  useEffect(() => {
    if (searchText === urlSearch) return
    const t = setTimeout(() => updateParams({ search: searchText || undefined }), 300)
    return () => clearTimeout(t)
  }, [searchText, urlSearch, updateParams])

  const fetchPage = useCallback(
    (params: { page: number; pageSize: number; status?: JobStatus; search?: string; department?: string }) =>
      isAdmin ? jobApi.getAllForAdminUnwrapped(params) : jobApi.getMyJobsUnwrapped(params),
    [isAdmin]
  )

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const res = await fetchPage({
          page,
          pageSize: PAGE_SIZE,
          status: status || undefined,
          search: urlSearch || undefined,
          department: department || undefined,
        })
        // The backend does not send per-job counts, so derive them from the candidate list.
        const cands = await candidateApi.getAllUnwrapped({ page: 1, pageSize: 500 }).catch(() => null)
        if (cancelled) return
        const counts = new Map<string, { candidates: number; shortlisted: number }>()
        for (const c of cands?.data ?? []) {
          const entry = counts.get(c.jobId) ?? { candidates: 0, shortlisted: 0 }
          entry.candidates += 1
          if (c.status === 'SHORTLISTED') entry.shortlisted += 1
          counts.set(c.jobId, entry)
        }
        setJobs((res?.data ?? []).map((j) => ({ ...j, _count: counts.get(j.id) ?? { candidates: 0, shortlisted: 0 } })))
        setPagination({
          page: res?.page ?? 1,
          pageSize: res?.pageSize ?? PAGE_SIZE,
          total: res?.total ?? 0,
          totalPages: res?.totalPages ?? 0,
        })
      } catch (e) {
        const detail = e instanceof Error && e.message ? e.message : 'Check your connection and try again.'
        if (!cancelled) setError(`Could not load jobs: ${detail}`)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [page, status, urlSearch, department, fetchPage, reloadKey])

  // Tab counts: one small request per status
  useEffect(() => {
    let cancelled = false
    Promise.allSettled(
      (['ACTIVE', 'DRAFT', 'CLOSED'] as JobStatus[]).map((s) => fetchPage({ page: 1, pageSize: 1, status: s }))
    ).then((results) => {
      if (cancelled) return
      const next: Record<string, number> = {}
      ;(['ACTIVE', 'DRAFT', 'CLOSED'] as const).forEach((s, i) => {
        const r = results[i]
        if (r.status === 'fulfilled') next[s] = r.value?.total ?? 0
      })
      next.ALL = Object.values(next).reduce((a, b) => a + b, 0)
      setCounts(next)
    })
    return () => {
      cancelled = true
    }
  }, [fetchPage, reloadKey])

  const confirmDeleteJob = async () => {
    if (!deleting) return
    setIsDeleting(true)
    try {
      if (isAdmin) await jobApi.deleteForAdmin(deleting.id)
      else await jobApi.deleteForRecruiter(deleting.id)
      toast.success('Job deleted')
      setDeleting(null)
      // Deleting the last row of a page would leave an empty page, so step back one
      if (jobs.length === 1 && page > 1) updateParams({ page: String(page - 1) }, false)
      else setReloadKey((k) => k + 1)
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : 'Failed to delete job')
    } finally {
      setIsDeleting(false)
    }
  }

  const tabs = [
    { value: '', label: 'All', count: counts.ALL },
    { value: 'ACTIVE', label: 'Active', count: counts.ACTIVE },
    { value: 'DRAFT', label: 'Draft', count: counts.DRAFT },
    { value: 'CLOSED', label: 'Closed', count: counts.CLOSED },
  ]

  const filtered = Boolean(urlSearch || status || department)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jobs"
        subtitle="Create openings and track who has applied."
        action={
          canEdit && (
            <Link to="/jobs/create" className="btn-primary h-10 px-4 py-0 text-body-sm">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create job
            </Link>
          )
        }
      />

      <ConfirmModal
        isOpen={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDeleteJob}
        title="Delete job?"
        message={`Delete "${deleting?.title ?? 'this job'}"? This can't be undone.`}
        confirmText="Delete job"
        variant="danger"
        loading={isDeleting}
      >
        {(deleting?._count?.candidates ?? 0) > 0
          ? `All ${deleting?._count?.candidates} candidate${deleting?._count?.candidates === 1 ? '' : 's'} who applied, with their resumes, will be deleted too.`
          : 'Any candidates who applied, with their resumes, will be deleted too.'}
      </ConfirmModal>

      {error && <ErrorBanner message={error} onRetry={() => setReloadKey((k) => k + 1)} />}

      <Card variant="flat" padding="none" className="list-card overflow-hidden shadow-soft">
        <div className="flex flex-col gap-3 border-b border-[var(--color-border)] p-3 lg:flex-row lg:items-center lg:justify-between">
          <StatusTabs tabs={tabs} value={status} onChange={(v) => updateParams({ status: v || undefined })} label="Filter jobs by status" />
          <div className="flex flex-col gap-2 sm:flex-row">
            <SearchField value={searchText} onChange={setSearchText} placeholder="Search by title" label="Search jobs" />
            <FilterSelect
              label="Filter by department"
              icon={Building2}
              value={department}
              onChange={(v) => updateParams({ department: v || undefined })}
              options={[{ value: '', label: 'All departments' }, ...departmentOptions]}
            />
          </div>
        </div>

        {(filtered || !isLoading) && (
          <ActiveFilters
            total={pagination.total}
            noun="jobs"
            chips={[
              ...(urlSearch ? [{ key: 'search', label: `"${urlSearch}"`, onRemove: () => { setSearchText(''); updateParams({ search: undefined }) } }] : []),
              ...(department ? [{ key: 'department', label: department, onRemove: () => updateParams({ department: undefined }) }] : []),
              ...(status ? [{ key: 'status', label: status.charAt(0) + status.slice(1).toLowerCase(), onRemove: () => updateParams({ status: undefined }) }] : []),
            ]}
            onClearAll={() => { setSearchText(''); setSearchParams({}) }}
          />
        )}

        {isLoading ? (
          <TableSkeleton columns={6} />
        ) : error ? null : jobs.length === 0 ? (
          <EmptyState
            icon={<Briefcase className="h-16 w-16" />}
            title={filtered ? 'No jobs match these filters' : 'No jobs yet'}
            description={filtered ? 'Clear a filter or change your search to see more jobs.' : 'Create your first job to start receiving candidates.'}
            action={
              filtered
                ? { label: 'Clear filters', variant: 'secondary', onClick: () => { setSearchText(''); setSearchParams({}) } }
                : canEdit
                  ? { label: 'Create job', onClick: () => navigate('/jobs/create') }
                  : undefined
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Candidates</TableHead>
                    <TableHead>Posted</TableHead>
                    <TableHead className="text-right">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell>
                        <Link to={`/jobs/${job.id}`} className="block no-underline">
                          <p className="font-semibold text-ink-900 hover:text-brand-700 dark:text-ink-100 dark:hover:text-brand-300">{job.title}</p>
                          <p className="mt-0.5 text-body-xs capitalize text-ink-500 dark:text-ink-400">
                            {job.workMode.toLowerCase()} · {job.employmentType.replace('_', ' ').toLowerCase()}
                          </p>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <span className="text-body-sm text-ink-600 dark:text-ink-300">{job.department}</span>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5 text-body-sm text-ink-600 dark:text-ink-300">
                          <MapPin className="h-3.5 w-3.5 text-ink-400" aria-hidden="true" />
                          {job.location}
                        </span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={job.status} />
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5 text-body-sm text-ink-600 dark:text-ink-300">
                          <Users className="h-3.5 w-3.5 text-ink-400" aria-hidden="true" />
                          {job._count?.candidates ?? 0}
                          {(job._count?.shortlisted ?? 0) > 0 && (
                            <span className="text-body-xs text-brand-700 dark:text-brand-300">({job._count?.shortlisted} shortlisted)</span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-body-sm text-ink-500 dark:text-ink-400">{formatDate(job.createdAt)}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-0.5">
                          <Link to={`/jobs/${job.id}`} className={iconLink} aria-label={`View ${job.title}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                          {canEdit && (
                            <>
                              <Link to={`/jobs/${job.id}/edit`} className={iconLink} aria-label={`Edit ${job.title}`}>
                                <Edit className="h-4 w-4" />
                              </Link>
                              <button
                                className={`${iconLink} hover:!bg-error-50 hover:!text-error-600 dark:hover:!bg-error-900/20`}
                                aria-label={`Delete ${job.title}`}
                                onClick={() => setDeleting(job)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Pagination {...pagination} noun="jobs" onChange={(p) => updateParams({ page: String(p) }, false)} />
          </>
        )}
      </Card>
    </div>
  )
}
