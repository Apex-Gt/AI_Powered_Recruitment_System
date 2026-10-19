import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { assessmentApi } from '@/utils/api'
import { AssignAssessmentModal } from '@/components/assessments/AssignAssessmentModal'
import { AssessmentResultsModal } from '@/components/assessments/AssessmentResultsModal'
import { assessmentTypes } from '@/utils/assessmentTypes'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/Table'
import { StatusBadge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { ConfirmModal } from '@/components/ui/Modal'
import { PageHeader, SearchField } from '@/components/ui/ListPage'
import { Plus, Edit, Trash2, CheckSquare, Send, BarChart3 } from 'lucide-react'
import { cn } from '@/utils/helpers'
import type { Assessment } from '@/types'
import toast from 'react-hot-toast'

export function Assessments() {
  const { hasRole } = useAuth()
  const canEdit = hasRole(['ADMIN', 'RECRUITER'])
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const navigate = useNavigate()
  const [deleting, setDeleting] = useState<Assessment | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [assigning, setAssigning] = useState<Assessment | null>(null)
  const [viewingResults, setViewingResults] = useState<Assessment | null>(null)

  const load = useCallback(async () => {
    try {
      setAssessments(await assessmentApi.getAll())
    } catch (error) {
      console.error('Failed to fetch assessments:', error)
    }
  }, [])

  useEffect(() => {
    setIsLoading(true)
    void load().finally(() => setIsLoading(false))
  }, [load])

  const openCreate = () => navigate('/assessments/new')

  const openEdit = (assessment: Assessment) => navigate(`/assessments/${assessment.id}/edit`)

  const handleDelete = async () => {
    if (!deleting) return
    setIsDeleting(true)
    try {
      await assessmentApi.delete(deleting.id)
      toast.success('Assessment deleted successfully')
      setAssessments((prev) => prev.filter((a) => a.id !== deleting.id))
      setDeleting(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete assessment'
      toast.error(message)
    } finally {
      setIsDeleting(false)
    }
  }

  const q = searchQuery.toLowerCase()
  const filteredAssessments = assessments.filter(
    (a) => a.title.toLowerCase().includes(q) || (a.jobTitle ?? '').toLowerCase().includes(q)
  )

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-heading-xl font-extrabold tracking-tight text-ink-900 dark:text-ink-100">Assessments</h1>
            <p className="text-body-md text-ink-500 dark:text-ink-400 mt-1">Create and manage candidate assessments</p>
          </div>
          <Button variant="secondary" disabled>
            <Plus className="w-4 h-4 mr-2" />
            Create Assessment
          </Button>
        </div>
        <Card variant="flat" padding="lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><div className="skeleton-text h-4 w-3/4" /></TableHead>
                <TableHead><div className="skeleton-text h-4 w-1/2" /></TableHead>
                <TableHead><div className="skeleton-text h-4 w-1/2" /></TableHead>
                <TableHead><div className="skeleton-text h-4 w-1/4" /></TableHead>
                <TableHead><div className="skeleton-text h-4 w-1/4" /></TableHead>
                <TableHead><div className="skeleton-text h-4 w-1/4" /></TableHead>
                <TableHead className="w-24 text-right"><div className="skeleton-text h-4 w-3/4" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[1, 2, 3, 4, 5].map((i) => (
                <TableRow key={i}>
                  {[1, 2, 3, 4, 5, 6, 7].map((c) => (
                    <TableCell key={c}><div className="skeleton-text h-5 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assessments"
        subtitle="Build a test, send it to a candidate by email, and review how they did."
        action={
          canEdit && (
            <Button onClick={openCreate} size="lg">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create assessment
            </Button>
          )
        }
      />

      <SearchField value={searchQuery} onChange={setSearchQuery} placeholder="Search by assessment or job" label="Search assessments" />

      <Card variant="flat" padding="none">
        {filteredAssessments.length === 0 ? (
          <EmptyState
            icon={<CheckSquare className="w-16 h-16" />}
            title={searchQuery ? 'No assessments found' : 'No assessments yet'}
            description={searchQuery ? 'Try adjusting your search' : 'Create your first assessment to evaluate candidates'}
            action={canEdit ? { label: 'Create Assessment', onClick: openCreate } : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead style={{ width: '27%' }}>Assessment</TableHead>
                  <TableHead style={{ width: '20%' }}>Job</TableHead>
                  <TableHead style={{ width: '12%' }}>Type</TableHead>
                  <TableHead style={{ width: '10%' }}>Duration</TableHead>
                  <TableHead style={{ width: '10%' }}>Questions</TableHead>
                  <TableHead style={{ width: '10%' }}>Status</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssessments.map((assessment) => (
                  <TableRow key={assessment.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-ink-900 dark:text-ink-100">{assessment.title}</p>
                        <p className="text-body-xs text-ink-500 dark:text-ink-400">
                          {assessment.rounds?.length ?? 1} {(assessment.rounds?.length ?? 1) === 1 ? 'round' : 'rounds'}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {assessment.jobId ? (
                        <Link
                          to={`/jobs/${assessment.jobId}`}
                          className="text-body-sm font-medium text-ink-900 hover:underline dark:text-ink-100"
                          title="Open job"
                        >
                          {assessment.jobTitle}
                        </Link>
                      ) : (
                        <span className="text-body-sm text-ink-500 dark:text-ink-400">General</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={cn('badge-default gap-1', assessment.type === 'CODING' && 'bg-info-100 text-info-600 dark:bg-info-900/30 dark:text-info-400')}>
                        {assessmentTypes.find((t) => t.value === assessment.type)?.label}
                      </span>
                    </TableCell>
                    <TableCell><span className="text-body-sm text-ink-500 dark:text-ink-400">{assessment.duration} min</span></TableCell>
                    <TableCell><span className="text-body-sm text-ink-500 dark:text-ink-400">{assessment.questions.length}</span></TableCell>
                    <TableCell>
                      <StatusBadge status={assessment.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {assessment.status === 'ACTIVE' && (
                          <Button variant="ghost" size="sm" onClick={() => setAssigning(assessment)} title="Send to candidate">
                            <Send className="w-4 h-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => setViewingResults(assessment)} title="Results">
                          <BarChart3 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(assessment)} title="Edit">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-error-500" onClick={() => setDeleting(assessment)} title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <ConfirmModal
        isOpen={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Delete assessment?"
        message={`Delete "${deleting?.title ?? ''}"? This can't be undone.`}
        confirmText="Delete assessment"
        variant="danger"
        loading={isDeleting}
      >
        Its rounds and questions will be deleted, along with the answers and results of every candidate who was sent it.
      </ConfirmModal>
      <AssignAssessmentModal assessment={assigning} onClose={() => setAssigning(null)} />
      <AssessmentResultsModal assessment={viewingResults} onClose={() => setViewingResults(null)} />
    </div>
  )
}
