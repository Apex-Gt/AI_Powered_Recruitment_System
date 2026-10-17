import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
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
  MatchScore,
  PageHeader,
  Pagination,
  SearchField,
  StatusTabs,
  TableSkeleton,
} from '@/components/ui/ListPage'
import { Briefcase, ChevronRight, MapPin, Pencil, Trash2, Upload, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import { ConfirmModal } from '@/components/ui/Modal'
import { EditCandidateModal } from '@/components/candidates/EditCandidateModal'
import { UploadResumesModal } from '@/components/candidates/UploadResumesModal'
import { formatDate, getInitials } from '@/utils/helpers'
import type { Candidate, CandidateStatus, Job } from '@/types'

const PAGE_SIZE = 10

const iconBtn =
  'flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-ink-500 transition-colors hover:bg-base-100 hover:text-ink-900 dark:text-ink-400 dark:hover:bg-surface-dark-elevated dark:hover:text-ink-100'

const STATUS_TABS: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'APPLIED', label: 'Applied' },
  { value: 'SCREENING', label: 'Screening' },
  { value: 'SHORTLISTED', label: 'Shortlisted' },
  { value: 'INTERVIEW', label: 'Interview' },
  { value: 'SELECTED', label: 'Selected' },
  { value: 'REJECTED', label: 'Rejected' },
]

export function Candidates() {
  const { hasRole } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [pagination, setPagination] = useState({ page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const isAdmin = hasRole(['ADMIN'])
  const canEdit = hasRole(['ADMIN', 'RECRUITER'])
  const [uploadOpen, setUploadOpen] = useState(false)
  const [editing, setEditing] = useState<Candidate | null>(null)
  const [deleting, setDeleting] = useState<Candidate | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const page = parseInt(searchParams.get('page') || '1')
  const status = (searchParams.get('status') || '') as CandidateStatus | ''
  const jobId = searchParams.get('jobId') || ''
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

  useEffect(() => {
    if (searchText === urlSearch) return
    const t = setTimeout(() => updateParams({ search: searchText || undefined }), 300)
    return () => clearTimeout(t)
  }, [searchText, urlSearch, updateParams])

  // Jobs populate the job filter
  useEffect(() => {
    let cancelled = false
    const req = isAdmin
      ? jobApi.getAllForAdminUnwrapped({ page: 1, pageSize: 100 })
      : jobApi.getMyJobsUnwrapped({ page: 1, pageSize: 100 })
    req.then((res) => !cancelled && setJobs(res?.data ?? [])).catch(() => {})
    return () => {
      cancelled = true
    }
  }, [isAdmin])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const res = await candidateApi.getAllUnwrapped({
          page,
          pageSize: PAGE_SIZE,
          status: status || undefined,
          jobId: jobId || undefined,
          search: urlSearch || undefined,
        })
        if (cancelled) return
        setCandidates((res.data ?? []) as Candidate[])
        setPagination({ page: res.page, pageSize: res.pageSize, total: res.total, totalPages: res.totalPages })
      } catch (e) {
        const detail = e instanceof Error && e.message ? e.message : 'Check your connection and try again.'
        if (!cancelled) setError(`Could not load candidates: ${detail}`)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [page, status, jobId, urlSearch, reloadKey])

  const confirmDelete = async () => {
    if (!deleting) return
    setIsDeleting(true)
    try {
      await candidateApi.delete(deleting.id)
      toast.success(`${deleting.candidateName} deleted`)
      setDeleting(null)
      // Deleting the last row of a page would leave an empty page, so step back one
      if (candidates.length === 1 && page > 1) updateParams({ page: String(page - 1) }, false)
      else setReloadKey((k) => k + 1)
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : 'Failed to delete candidate')
    } finally {
      setIsDeleting(false)
    }
  }

  const filtered = Boolean(urlSearch || status || jobId)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Candidates"
        subtitle="Review applicants, AI match scores and where each one is in the pipeline."
        action={
          canEdit && (
            <button type="button" onClick={() => setUploadOpen(true)} className="btn-primary h-10 px-4 py-0 text-body-sm">
              <Upload className="h-4 w-4" aria-hidden="true" />
              Add candidates
            </button>
          )
        }
      />

      <UploadResumesModal
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={() => setReloadKey((k) => k + 1)}
        jobs={jobs.filter((j) => j.status !== 'CLOSED').map((j) => ({ id: j.id, title: j.title }))}
      />

      <EditCandidateModal candidate={editing} onClose={() => setEditing(null)} onSaved={() => setReloadKey((k) => k + 1)} />

      <ConfirmModal
        isOpen={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Delete candidate?"
        message={`Delete ${deleting?.candidateName ?? 'this candidate'}? This can't be undone.`}
        confirmText="Delete"
        variant="danger"
        loading={isDeleting}
      >
        Their uploaded resume and AI analysis will be removed too.
      </ConfirmModal>

      {error && <ErrorBanner message={error} onRetry={() => setReloadKey((k) => k + 1)} />}

      <Card variant="flat" padding="none" className="list-card overflow-hidden shadow-soft">
        <div className="flex flex-col gap-3 border-b border-[var(--color-border)] p-3">
          <StatusTabs tabs={STATUS_TABS} value={status} onChange={(v) => updateParams({ status: v || undefined })} label="Filter candidates by status" />
          <div className="flex flex-col gap-2 sm:flex-row">
            <SearchField value={searchText} onChange={setSearchText} placeholder="Search by name or email" label="Search candidates" />
            <FilterSelect
              label="Filter by job"
              icon={Briefcase}
              value={jobId}
              onChange={(v) => updateParams({ jobId: v || undefined })}
              options={[{ value: '', label: 'All jobs' }, ...jobs.map((j) => ({ value: j.id, label: j.title }))]}
            />
          </div>
        </div>

        {(filtered || !isLoading) && (
          <ActiveFilters
            total={pagination.total}
            noun="candidates"
            chips={[
              ...(urlSearch ? [{ key: 'search', label: `"${urlSearch}"`, onRemove: () => { setSearchText(''); updateParams({ search: undefined }) } }] : []),
              ...(jobId ? [{ key: 'job', label: jobs.find((j) => j.id === jobId)?.title ?? 'Selected job', onRemove: () => updateParams({ jobId: undefined }) }] : []),
              ...(status ? [{ key: 'status', label: status.charAt(0) + status.slice(1).toLowerCase(), onRemove: () => updateParams({ status: undefined }) }] : []),
            ]}
            onClearAll={() => { setSearchText(''); setSearchParams({}) }}
          />
        )}

        {isLoading ? (
          <TableSkeleton columns={6} />
        ) : error ? null : candidates.length === 0 ? (
          <EmptyState
            icon={<Users className="h-16 w-16" />}
            title={filtered ? 'No candidates match these filters' : 'No candidates yet'}
            description={filtered ? 'Clear a filter or change your search to see more candidates.' : 'Upload resumes to add candidates to a job.'}
            action={
              filtered
                ? { label: 'Clear filters', variant: 'secondary', onClick: () => { setSearchText(''); setSearchParams({}) } }
                : canEdit
                  ? { label: 'Add candidates', onClick: () => setUploadOpen(true) }
                  : undefined
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Candidate</TableHead>
                    <TableHead>Applied for</TableHead>
                    <TableHead>AI match</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Applied</TableHead>
                    <TableHead className="text-right">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {candidates.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <Link to={`/candidates/${c.id}`} className="flex items-center gap-3 no-underline">
                          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-label-sm font-bold text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                            {getInitials(c.candidateName)}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-semibold text-ink-900 hover:text-brand-700 dark:text-ink-100 dark:hover:text-brand-300">{c.candidateName}</span>
                            <span className="block truncate text-body-xs text-ink-500 dark:text-ink-400">{c.candidateEmail}</span>
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <p className="text-body-sm text-ink-700 dark:text-ink-200">{c.jobTitle ?? '—'}</p>
                        {c.location && (
                          <p className="mt-0.5 inline-flex items-center gap-1 text-body-xs text-ink-500 dark:text-ink-400">
                            <MapPin className="h-3 w-3" aria-hidden="true" />
                            {c.location}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <MatchScore score={c.aiMatchScore} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={c.status || 'APPLIED'} />
                      </TableCell>
                      <TableCell>
                        <span className="text-body-sm text-ink-500 dark:text-ink-400">{formatDate(c.appliedAt ?? c.createdAt ?? '')}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-0.5">
                          {canEdit && (
                            <>
                              <button type="button" className={iconBtn} aria-label={`Edit ${c.candidateName}`} onClick={() => setEditing(c)}>
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                className={`${iconBtn} hover:!bg-error-50 hover:!text-error-600 dark:hover:!bg-error-900/20`}
                                aria-label={`Delete ${c.candidateName}`}
                                onClick={() => setDeleting(c)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          <Link to={`/candidates/${c.id}`} className={iconBtn} aria-label={`Open ${c.candidateName}'s profile`}>
                            <ChevronRight className="h-4 w-4" />
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Pagination {...pagination} noun="candidates" onChange={(p) => updateParams({ page: String(p) }, false)} />
          </>
        )}
      </Card>
    </div>
  )
}
