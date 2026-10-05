import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { interviewApi, jobApi, candidateApi } from '@/utils/api'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Input'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/Table'
import { StatusBadge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { Plus, Edit, Trash2, Calendar, Search, Video, Phone, MapPin, XCircle, Code2 } from 'lucide-react'
import { formatDate, cn } from '@/utils/helpers'
import type { Interview, Job, Candidate } from '@/types'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'

const scheduleInterviewSchema = z.object({
  candidateId: z.string().min(1, 'Candidate is required'),
  jobId: z.string().min(1, 'Job is required'),
  type: z.enum(['PHONE', 'VIDEO', 'ONSITE', 'TECHNICAL']),
  scheduledAt: z.string().min(1, 'Date and time is required'),
  duration: z.number().min(15, 'Duration must be at least 15 minutes').max(480, 'Duration cannot exceed 8 hours'),
  interviewers: z.string().min(1, 'At least one interviewer is required'),
  meetingLink: z.string().url('Invalid URL').optional().or(z.literal('')),
})

type ScheduleInterviewForm = z.infer<typeof scheduleInterviewSchema>



const interviewTypes = [
  { value: 'PHONE', label: 'Phone', icon: Phone },
  { value: 'VIDEO', label: 'Video', icon: Video },
  { value: 'ONSITE', label: 'On-site', icon: MapPin },
  { value: 'TECHNICAL', label: 'Technical', icon: Code2 },
]


export function Interviews() {
  const { hasRole } = useAuth()
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<Interview['status'] | ''>('')
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming')

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ScheduleInterviewForm>({
    resolver: zodResolver(scheduleInterviewSchema),
    defaultValues: {
      type: 'VIDEO',
      duration: 60,
      interviewers: '',
      meetingLink: '',
    },
  })

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      try {
        const [interviewsRes, jobsRes, candidatesRes] = await Promise.all([
          interviewApi.getAll({ pageSize: 100 }),
          jobApi.getMyJobs({ pageSize: 100 }),
          candidateApi.getAll({ pageSize: 200 }),
        ])
        setInterviews(interviewsRes.data)
        setJobs(jobsRes.data)
        setCandidates(candidatesRes.data)
        // Interviewers list requires /api/users endpoint (not yet implemented)
        // Using empty array - interviewers can be entered manually
      } catch (error) {
        console.error('Failed to fetch data:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [])

  const openCreateModal = () => {
    setIsEditing(false)
    reset({ type: 'VIDEO', duration: 60, interviewers: '', meetingLink: '' })
    setIsModalOpen(true)
  }

  const openEditModal = (interview: Interview) => {
    setIsEditing(true)
    setSelectedInterview(interview)
    reset({
      candidateId: interview.candidateId,
      jobId: interview.jobId,
      type: interview.type,
      scheduledAt: interview.scheduledAt,
      duration: interview.duration,
      interviewers: Array.isArray(interview.interviewers) ? interview.interviewers.join(', ') : interview.interviewers,
      meetingLink: interview.meetingLink || '',
    })
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setSelectedInterview(null)
  }

  const onSubmit = async (data: ScheduleInterviewForm) => {
    setIsSubmitting(true)
    try {
      const interviewersArray = typeof data.interviewers === 'string'
        ? data.interviewers.split(',').map((v) => v.trim()).filter(Boolean)
        : data.interviewers

      const submitData = {
        ...data,
        interviewers: interviewersArray,
        meetingLink: data.meetingLink || undefined,
      }
      if (isEditing && selectedInterview) {
        await interviewApi.update(selectedInterview.id, submitData)
        toast.success('Interview updated successfully')
      } else {
        await interviewApi.schedule(submitData)
        toast.success('Interview scheduled successfully')
      }
      closeModal()
      const response = await interviewApi.getAll({ pageSize: 100 })
      setInterviews(response.data)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save interview'
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this interview?')) return
    try {
      await interviewApi.cancel(id)
      toast.success('Interview cancelled')
      setInterviews((prev) =>
        prev.map((i) => (i.id === id ? { ...i, status: 'CANCELLED' as const } : i))
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to cancel interview'
      toast.error(message)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this interview?')) return
    try {
      await interviewApi.delete(id)
      toast.success('Interview deleted successfully')
      setInterviews((prev) => prev.filter((i) => i.id !== id))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete interview'
      toast.error(message)
    }
  }

  const filteredInterviews = interviews
    .filter((i) =>
      i.candidateName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.jobTitle.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .filter((i) => !statusFilter || i.status === statusFilter)
    .filter((i) => {
      const now = new Date()
      const scheduled = new Date(i.scheduledAt)
      return activeTab === 'upcoming' ? scheduled >= now : scheduled < now
    })
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-display-md font-bold text-ink-900 dark:text-ink-100">Interviews</h1>
            <p className="text-body-md text-ink-500 dark:text-ink-400 mt-1">Schedule and manage interviews</p>
          </div>
          <Button variant="secondary" disabled>
            <Plus className="w-4 h-4 mr-2" />
            Schedule Interview
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    )
  }

  const upcomingCount = interviews.filter((i) => new Date(i.scheduledAt) >= new Date() && i.status !== 'CANCELLED').length
  const pastCount = interviews.filter((i) => new Date(i.scheduledAt) < new Date() || i.status === 'CANCELLED').length

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-display-md font-bold text-ink-900 dark:text-ink-100">Interviews</h1>
          <p className="text-body-md text-ink-500 dark:text-ink-400 mt-1">Schedule and manage interviews</p>
        </div>
        {hasRole(['ADMIN', 'RECRUITER']) && (
          <Button onClick={openCreateModal} size="lg">
            <Plus className="w-5 h-5" />
            Schedule Interview
          </Button>
        )}
      </div>

      <Card padding="md">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-400" />
            <Input
              placeholder="Search interviews..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select
            label="Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as Interview['status'] | '')}
            options={[
              { value: '', label: 'All Status' },
              { value: 'SCHEDULED', label: 'Scheduled' },
              { value: 'COMPLETED', label: 'Completed' },
              { value: 'CANCELLED', label: 'Cancelled' },
              { value: 'NO_SHOW', label: 'No Show' },
            ]}
            placeholder="All Status"
            className="w-full sm:w-48"
          />
          <div className="flex items-center gap-2 border-b border-base-200 dark:border-base-700">
            <button
              onClick={() => setActiveTab('upcoming')}
              className={cn(
                'px-3 py-2 text-body-sm font-medium border-b-2 transition-colors',
                activeTab === 'upcoming'
                  ? 'border-accent-500 text-accent-600 dark:text-accent-400'
                  : 'border-transparent text-ink-400 dark:text-ink-500 hover:text-ink-600 dark:hover:text-ink-400'
              )}
            >
              Upcoming ({upcomingCount})
            </button>
            <button
              onClick={() => setActiveTab('past')}
              className={cn(
                'px-3 py-2 text-body-sm font-medium border-b-2 transition-colors',
                activeTab === 'past'
                  ? 'border-accent-500 text-accent-600 dark:text-accent-400'
                  : 'border-transparent text-ink-400 dark:text-ink-500 hover:text-ink-600 dark:hover:text-ink-400'
              )}
            >
              Past ({pastCount})
            </button>
          </div>
        </div>
      </Card>

      <Card variant="flat" padding="none">
        {filteredInterviews.length === 0 ? (
          <EmptyState
            icon={<Calendar className="w-16 h-16" />}
            title={searchQuery || statusFilter ? 'No interviews found' : 'No interviews scheduled'}
            description={searchQuery || statusFilter ? 'Try adjusting your filters' : 'Schedule your first interview to get started'}
            action={hasRole(['ADMIN', 'RECRUITER']) ? { label: 'Schedule Interview', onClick: openCreateModal } : undefined}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead style={{ width: '30%' }}>Candidate</TableHead>
                    <TableHead style={{ width: '20%' }}>Job</TableHead>
                    <TableHead style={{ width: '15%' }}>Date & Time</TableHead>
                    <TableHead style={{ width: '10%' }}>Type</TableHead>
                    <TableHead style={{ width: '10%' }}>Status</TableHead>
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInterviews.map((interview) => (
                    <TableRow key={interview.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-ink-900 dark:text-ink-100">{interview.candidateName}</p>
                          <p className="text-body-xs text-ink-500 dark:text-ink-400">{interview.interviewers.join(', ') || 'No interviewers'}</p>
                        </div>
                      </TableCell>
                      <TableCell><span className="text-body-sm text-ink-500 dark:text-ink-400">{interview.jobTitle}</span></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-body-sm text-ink-600 dark:text-ink-400">
                          <Calendar className="w-4 h-4" />
                          <span>{formatDate(interview.scheduledAt)}</span>
                        </div>
                        <div className="text-body-xs text-ink-400 dark:text-ink-500">{interview.duration} min</div>
                      </TableCell>
                      <TableCell>
                        <span className={cn('badge-default gap-1', interview.type === 'VIDEO' && 'bg-purple-100 text-purple-600')}>
                          {(() => {
                            const typeInfo = interviewTypes.find((t) => t.value === interview.type)
                            const Icon = typeInfo?.icon
                            return Icon ? <Icon className="w-3 h-3" /> : null
                          })()}
                          {interviewTypes.find((t) => t.value === interview.type)?.label}
                        </span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={interview.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEditModal(interview)} title="Edit">
                            <Edit className="w-4 h-4" />
                          </Button>
                          {interview.status === 'SCHEDULED' && (
                            <>
                              <Button variant="ghost" size="sm" onClick={() => handleCancel(interview.id)} title="Cancel" className="text-warning-500">
                                <XCircle className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          <Button variant="ghost" size="sm" className="text-error-500" onClick={() => handleDelete(interview.id)} title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </Card>

      <Modal isOpen={isModalOpen} onClose={closeModal} title={isEditing ? 'Edit Interview' : 'Schedule Interview'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Card padding="lg">
            <CardHeader>
              <CardTitle>Interview Details</CardTitle>
              <CardDescription>Schedule a new interview</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <Select
                label="Candidate *"
                options={candidates.map((c) => ({ value: c.id, label: `${c.candidateName} (${c.jobTitle})` }))}
                placeholder="Select candidate"
                error={errors.candidateId?.message}
                {...register('candidateId')}
              />

              <Select
                label="Job *"
                options={jobs.map((j) => ({ value: j.id, label: j.title }))}
                placeholder="Select job"
                error={errors.jobId?.message}
                {...register('jobId')}
              />

              <Select
                label="Type *"
                options={interviewTypes.map((t) => ({ value: t.value, label: t.label }))}
                error={errors.type?.message}
                {...register('type')}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Input
                  label="Date & Time *"
                  type="datetime-local"
                  error={errors.scheduledAt?.message}
                  {...register('scheduledAt')}
                />
                <Input
                  label="Duration (minutes) *"
                  type="number"
                  min={15}
                  max={480}
                  step={15}
                  error={errors.duration?.message}
                  {...register('duration', { valueAsNumber: true })}
                />
              </div>

              <div>
                <label className="label">Interviewers *</label>
                <Input
                  placeholder="Enter interviewer names (comma-separated)"
                  error={errors.interviewers?.message}
                  {...register('interviewers')}
                />
                <p className="mt-1.5 text-body-xs text-ink-500 dark:text-ink-400">Enter interviewer names separated by commas</p>
              </div>

              <Input
                label="Meeting Link (for video interviews)"
                type="url"
                placeholder="https://meet.google.com/xxx-xxxx-xxx"
                error={errors.meetingLink?.message}
                {...register('meetingLink')}
              />
            </CardContent>
          </Card>

          <CardFooter className="flex flex-col sm:flex-row justify-end gap-3">
            <Button type="button" variant="ghost" onClick={closeModal}>Cancel</Button>
            <Button type="submit" size="lg" loading={isSubmitting}>
              {isEditing ? 'Update' : 'Schedule'} Interview
            </Button>
          </CardFooter>
        </form>
      </Modal>
    </div>
  )
}