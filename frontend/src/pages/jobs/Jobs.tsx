import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { jobApi } from '@/utils/api'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Input'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell, TableFooter } from '@/components/ui/Table'
import { StatusBadge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Plus, Search, ChevronLeft, ChevronRight, Briefcase, Eye, Edit, Trash2 } from 'lucide-react'
import { formatDate } from '@/utils/helpers'
import type { Job } from '@/types'

type JobStatus = 'ACTIVE' | 'DRAFT' | 'CLOSED'

interface JobListParams {
  page: number
  pageSize: number
  status?: JobStatus
  search: string
  department?: string
}

export function Jobs() {
  const { hasRole } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [jobs, setJobs] = useState<Job[]>([])
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [filters, setFilters] = useState<JobListParams>({
    page: 1,
    pageSize: 10,
    status: undefined,
    search: '',
    department: '',
  })

  useEffect(() => {
    const page = parseInt(searchParams.get('page') || '1')
    const status = searchParams.get('status') as JobStatus | undefined
    const search = searchParams.get('search') || ''
    const department = searchParams.get('department') || ''

    setFilters({ page, pageSize: 10, status, search, department })
  }, [searchParams])

  useEffect(() => {
    const fetchJobs = async () => {
      setIsLoading(true)
      try {
        // Use admin-specific endpoint for admins to see all company jobs
        if (hasRole(['ADMIN'])) {
          const response = await jobApi.getAllForAdmin(filters)
          setJobs(response.data)
          setPagination({
            page: response.page,
            pageSize: response.pageSize,
            total: response.total,
            totalPages: response.totalPages,
          })
        } else {
          const response = await jobApi.getMyJobs(filters)
          setJobs(response.data)
          setPagination({
            page: response.page,
            pageSize: response.pageSize,
            total: response.total,
            totalPages: response.totalPages,
          })
        }
      } catch (error) {
        console.error('Failed to fetch jobs:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchJobs()
  }, [filters, hasRole])

  const handleFilterChange = (key: keyof JobListParams, value: string) => {
    const newFilters = { ...filters, [key]: value || undefined, page: 1 }
    setFilters(newFilters)
    const params = new URLSearchParams()
    if (newFilters.page > 1) params.set('page', String(newFilters.page))
    if (newFilters.status) params.set('status', newFilters.status)
    if (newFilters.search) params.set('search', newFilters.search)
    if (newFilters.department) params.set('department', newFilters.department)
    setSearchParams(params)
  }

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams)
    params.set('page', String(page))
    setSearchParams(params)
  }

  const statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'ACTIVE', label: 'Active' },
    { value: 'DRAFT', label: 'Draft' },
    { value: 'CLOSED', label: 'Closed' },
  ]

  const departmentOptions = [
    { value: '', label: 'All Departments' },
    { value: 'Engineering', label: 'Engineering' },
    { value: 'Marketing', label: 'Marketing' },
    { value: 'Sales', label: 'Sales' },
    { value: 'Human Resources', label: 'Human Resources' },
    { value: 'Finance', label: 'Finance' },
    { value: 'Operations', label: 'Operations' },
    { value: 'Product', label: 'Product' },
    { value: 'Design', label: 'Design' },
    { value: 'Customer Success', label: 'Customer Success' },
    { value: 'Legal', label: 'Legal' },
    { value: 'Other', label: 'Other' },
  ]

  const columns = [
    { key: 'title', header: 'Job Title', width: '30%' },
    { key: 'department', header: 'Department', width: '15%' },
    { key: 'location', header: 'Location', width: '15%' },
    { key: 'status', header: 'Status', width: '12%' },
    { key: 'candidates', header: 'Candidates', width: '12%' },
    { key: 'createdAt', header: 'Posted', width: '16%' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-display-md font-bold text-ink-900 dark:text-ink-100">Jobs</h1>
          <p className="text-body-md text-ink-500 dark:text-ink-400 mt-1">Manage your job postings</p>
        </div>
        {hasRole(['ADMIN', 'RECRUITER']) && (
          <Link to="/jobs/create">
            <Button size="lg">
              <Plus className="w-5 h-5" />
              Create Job
            </Button>
          </Link>
        )}
      </div>

      <Card padding="md" className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-400" />
            <Input
              placeholder="Search jobs..."
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
            label="Department"
            value={filters.department || ''}
            onChange={(e) => handleFilterChange('department', e.target.value)}
            options={departmentOptions}
            placeholder="All Departments"
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
                  <TableHead style={{ width: '30%' }}><div className="skeleton-text h-4 w-3/4" /></TableHead>
                  <TableHead style={{ width: '15%' }}><div className="skeleton-text h-4 w-3/4" /></TableHead>
                  <TableHead style={{ width: '15%' }}><div className="skeleton-text h-4 w-3/4" /></TableHead>
                  <TableHead style={{ width: '12%' }}><div className="skeleton-text h-4 w-3/4" /></TableHead>
                  <TableHead style={{ width: '12%' }}><div className="skeleton-text h-4 w-3/4" /></TableHead>
                  <TableHead style={{ width: '16%' }}><div className="skeleton-text h-4 w-3/4" /></TableHead>
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
        ) : jobs.length === 0 ? (
          <EmptyState
            icon={<Briefcase className="w-16 h-16" />}
            title="No jobs found"
            description={filters.search || filters.status || filters.department
              ? 'Try adjusting your filters to find jobs'
              : 'Get started by creating your first job posting'}
            action={hasRole(['ADMIN', 'RECRUITER']) ? {
              label: 'Create Job',
              onClick: () => handleFilterChange('search', ''),
            } : undefined}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {columns.map((col) => (
                      <TableHead key={col.key} style={{ width: col.width }}>
                        {col.header}
                      </TableHead>
                    ))}
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-ink-900 dark:text-ink-100">{job.title}</p>
                          <p className="text-body-xs text-ink-500 dark:text-ink-400">{job.workMode} • {job.employmentType.replace('_', ' ')}</p>
                        </div>
                      </TableCell>
                      <TableCell><span className="text-body-sm text-ink-600 dark:text-ink-400">{job.department}</span></TableCell>
                      <TableCell><span className="text-body-sm text-ink-600 dark:text-ink-400">{job.location}</span></TableCell>
                      <TableCell>
                        <StatusBadge status={job.status} />
                      </TableCell>
                      <TableCell>
                        <span className="text-body-sm text-ink-600 dark:text-ink-400">
                          {job._count?.candidates ?? 0}
                        </span>
                      </TableCell>
                      <TableCell><span className="text-body-sm text-ink-500 dark:text-ink-400">{formatDate(job.createdAt)}</span></TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link to={`/jobs/${job.id}`} className="p-2 text-ink-400 hover:text-ink-600 dark:hover:text-ink-300 rounded-lg hover:bg-base-200 dark:hover:bg-base-800" title="View">
                            <Eye className="w-4 h-4" />
                          </Link>
                          {hasRole(['ADMIN', 'RECRUITER']) && (
                            <>
                              <Link to={`/jobs/${job.id}/edit`} className="p-2 text-ink-400 hover:text-ink-600 dark:hover:text-ink-300 rounded-lg hover:bg-base-200 dark:hover:bg-base-800" title="Edit">
                                <Edit className="w-4 h-4" />
                              </Link>
                              <Button variant="ghost" size="sm" className="p-2 text-error-500 hover:text-error-600 rounded-lg hover:bg-error-50 dark:hover:bg-error-900/20" title="Delete">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </div>
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
                    Showing {((pagination.page - 1) * pagination.pageSize) + 1} to {Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total} jobs
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