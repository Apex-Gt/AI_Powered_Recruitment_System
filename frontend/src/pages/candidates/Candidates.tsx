import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { candidateApi } from '@/utils/api'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Input'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell, TableFooter } from '@/components/ui/Table'
import { StatusBadge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Search, ChevronLeft, ChevronRight, Users, ChevronRight as ChevronRightIcon } from 'lucide-react'
import { formatDate, cn } from '@/utils/helpers'
import type { Candidate } from '@/types'

interface CandidateListParams {
  page: number
  pageSize: number
  status?: Candidate['status']
  jobId?: string
  search: string
}

export function Candidates() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [filters, setFilters] = useState<CandidateListParams>({
    page: 1,
    pageSize: 10,
    status: undefined,
    jobId: undefined,
    search: '',
  })

  useEffect(() => {
    const page = parseInt(searchParams.get('page') || '1')
    const status = searchParams.get('status') as Candidate['status'] | undefined
    const jobId = searchParams.get('jobId') || undefined
    const search = searchParams.get('search') || ''

    setFilters({ page, pageSize: 10, status, jobId, search })
  }, [searchParams])

  useEffect(() => {
    const fetchCandidates = async () => {
      setIsLoading(true)
      try {
        const response = await candidateApi.getAll(filters)
        setCandidates(response.data)
        setPagination({
          page: response.page,
          pageSize: response.pageSize,
          total: response.total,
          totalPages: response.totalPages,
        })
      } catch (error) {
        console.error('Failed to fetch candidates:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchCandidates()
  }, [filters])

  const handleFilterChange = (key: keyof CandidateListParams, value: string) => {
    const newFilters = { ...filters, [key]: value || undefined, page: 1 }
    setFilters(newFilters)
    const params = new URLSearchParams()
    if (newFilters.page > 1) params.set('page', String(newFilters.page))
    if (newFilters.status) params.set('status', newFilters.status)
    if (newFilters.jobId) params.set('jobId', newFilters.jobId)
    if (newFilters.search) params.set('search', newFilters.search)
    setSearchParams(params)
  }

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams)
    params.set('page', String(page))
    setSearchParams(params)
  }

  const statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'APPLIED', label: 'Applied' },
    { value: 'SCREENING', label: 'Screening' },
    { value: 'SHORTLISTED', label: 'Shortlisted' },
    { value: 'ASSESSMENT', label: 'Assessment' },
    { value: 'INTERVIEW', label: 'Interview' },
    { value: 'OFFER', label: 'Offer' },
    { value: 'HIRED', label: 'Hired' },
    { value: 'REJECTED', label: 'Rejected' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-display-md font-bold text-ink-900 dark:text-ink-100">Candidates</h1>
          <p className="text-body-md text-ink-500 dark:text-ink-400 mt-1">Browse and manage all applicants</p>
        </div>
        <Button variant="secondary" size="lg">
          <Users className="w-5 h-5 mr-2" />
          Add Candidate
        </Button>
      </div>

      <Card padding="md" className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-400" />
            <Input
              placeholder="Search candidates..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="pl-10"
            />
          </div>
          <Select
            label="Status"
            value={filters.status || ''}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            options={statusOptions}
            placeholder="All Status"
            className="w-full sm:w-48"
          />
          <Select
            label="Job"
            value={filters.jobId || ''}
            onChange={(e) => handleFilterChange('jobId', e.target.value)}
            options={[
              { value: '', label: 'All Jobs' },
            ]}
            placeholder="All Jobs"
            className="w-full sm:w-48"
          />
        </div>
      </Card>

      <Card variant="flat" padding="none">
        {isLoading ? (
          <div className="p-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead style={{ width: '25%' }}><div className="skeleton-text h-4 w-3/4" /></TableHead>
                  <TableHead style={{ width: '20%' }}><div className="skeleton-text h-4 w-3/4" /></TableHead>
                  <TableHead style={{ width: '15%' }}><div className="skeleton-text h-4 w-3/4" /></TableHead>
                  <TableHead style={{ width: '12%' }}><div className="skeleton-text h-4 w-3/4" /></TableHead>
                  <TableHead style={{ width: '13%' }}><div className="skeleton-text h-4 w-3/4" /></TableHead>
                  <TableHead style={{ width: '15%' }}><div className="skeleton-text h-4 w-3/4" /></TableHead>
                  <TableHead className="w-24 text-right"><div className="skeleton-text h-4 w-3/4" /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[1, 2, 3, 4, 5].map((i) => (
                  <TableRow key={i}>
                    <TableCell><div className="skeleton-text h-5 w-full" /></TableCell>
                    <TableCell><div className="skeleton-text h-5 w-full" /></TableCell>
                    <TableCell><div className="skeleton-text h-5 w-full" /></TableCell>
                    <TableCell><div className="skeleton-text h-5 w-full" /></TableCell>
                    <TableCell><div className="skeleton-text h-5 w-full" /></TableCell>
                    <TableCell><div className="skeleton-text h-5 w-full" /></TableCell>
                    <TableCell><div className="skeleton-text h-5 w-full" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : candidates.length === 0 ? (
          <EmptyState
            icon={<Users className="w-16 h-16" />}
            title="No candidates found"
            description={filters.search || filters.status || filters.jobId
              ? 'Try adjusting your filters to find candidates'
              : 'No candidates have applied yet'}
            action={{
              label: 'Clear Filters',
              onClick: () => handleFilterChange('search', ''),
            }}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead style={{ width: '25%' }}>Candidate</TableHead>
                    <TableHead style={{ width: '20%' }}>Email</TableHead>
                    <TableHead style={{ width: '15%' }}>Job</TableHead>
                    <TableHead style={{ width: '12%' }}>Match Score</TableHead>
                    <TableHead style={{ width: '13%' }}>Status</TableHead>
                    <TableHead style={{ width: '15%' }}>Applied</TableHead>
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {candidates.map((candidate) => (
                    <TableRow key={candidate.id}>
                      <TableCell>
                        <Link to={`/candidates/${candidate.id}`} className="flex items-center gap-3 hover:underline">
                          <div className="w-8 h-8 rounded-full bg-accent-100 dark:bg-accent-900/30 flex items-center justify-center">
                            <span className="text-label-sm font-medium text-accent-600 dark:text-accent-400">
                              {candidate.candidateName.charAt(0)}
                            </span>
                          </div>
                          <span className="font-medium text-ink-900 dark:text-ink-100">{candidate.candidateName}</span>
                        </Link>
                      </TableCell>
                      <TableCell><span className="text-body-sm text-ink-500 dark:text-ink-400">{candidate.candidateEmail}</span></TableCell>
                      <TableCell><span className="text-body-sm text-ink-500 dark:text-ink-400">{candidate.jobTitle}</span></TableCell>
                      <TableCell>
                        {candidate.aiMatchScore !== undefined ? (
                          <div className="flex items-center gap-2">
                            <span className={cn('font-medium', candidate.aiMatchScore >= 80 ? 'text-success-600' : candidate.aiMatchScore >= 60 ? 'text-warning-600' : candidate.aiMatchScore >= 40 ? 'text-accent-500' : 'text-error-600')}>
                              {candidate.aiMatchScore}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-body-sm text-ink-400 dark:text-ink-500">Not analyzed</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={candidate.status} />
                      </TableCell>
                      <TableCell><span className="text-body-sm text-ink-500 dark:text-ink-400">{formatDate(candidate.appliedAt)}</span></TableCell>
                      <TableCell className="text-right">
                        <Link to={`/candidates/${candidate.id}`} className="p-2 text-ink-400 hover:text-ink-600 dark:hover:text-ink-300 rounded-lg hover:bg-base-200 dark:hover:bg-base-800" title="View">
                          <ChevronRightIcon className="w-4 h-4" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {pagination.totalPages > 1 && (
              <TableFooter>
                <div className="flex items-center justify-between">
                  <p className="text-body-sm text-ink-500 dark:text-ink-400">
                    Showing {((pagination.page - 1) * pagination.pageSize) + 1} to {Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total} candidates
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pagination.page === 1}
                      onClick={() => handlePageChange(pagination.page - 1)}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-body-sm text-ink-600 dark:text-ink-400 px-3">
                      Page {pagination.page} of {pagination.totalPages}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pagination.page === pagination.totalPages}
                      onClick={() => handlePageChange(pagination.page + 1)}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </TableFooter>
            )}
          </>
        )}
      </Card>
    </div>
  )
}