import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { interviewApi, jobApi, candidateApi } from '@/utils/api'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { FilterSelect, PageHeader, SearchField, StatusTabs, TableSkeleton } from '@/components/ui/ListPage'
import { StatusBadge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { Plus, Edit, Trash2, Calendar, Video, Phone, MapPin, XCircle, Code2, MessageSquare } from 'lucide-react'
import { cn, relativeDayLabel } from '@/utils/helpers'
import type { Interview, InterviewFeedback, Job, Candidate } from '@/types'
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


const EMPTY_FEEDBACK = {
  rating: '3',
  recommendation: 'MAYBE' as InterviewFeedback['recommendation'],
  strengths: '',
  weaknesses: '',
  notes: '',
}

const splitLines = (value: string) => value.split('\n').map((v) => v.trim()).filter(Boolean)

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
  const [feedbackFor, setFeedbackFor] = useState<Interview | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const [feedbackForm, setFeedbackForm] = useState(EMPTY_FEEDBACK)
  const [isSavingFeedback, setIsSavingFeedback] = useState(false)

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
          jobApi.getMyJobsUnwrapped({ pageSize: 100 }),
          candidateApi.getAllUnwrapped({ pageSize: 200 }),
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

  // Arriving from a candidate's profile with ?schedule=<candidateId> opens the form for that person.
  useEffect(() => {
    const target = searchParams.get('schedule')
    if (!target || isLoading) return
    const candidate = candidates.find((c) => c.id === target)
    if (candidate) {
      setIsEditing(false)
      reset({ type: 'VIDEO', duration: 60, interviewers: '', meetingLink: '', candidateId: candidate.id, jobId: candidate.jobId })
      setIsModalOpen(true)
    }
    setSearchParams({}, { replace: true })
  }, [searchParams, isLoading, candidates, reset, setSearchParams])

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

  const openFeedbackModal = (interview: Interview) => {
    const existing = interview.feedback
    setFeedbackFor(interview)
    setFeedbackForm(existing ? {
      rating: String(existing.rating),
      recommendation: existing.recommendation,
      strengths: existing.strengths.join('\n'),
      weaknesses: existing.weaknesses.join('\n'),
      notes: existing.notes ?? '',
    } : EMPTY_FEEDBACK)
  }

  const submitFeedback = async () => {
    if (!feedbackFor) return
    setIsSavingFeedback(true)
    try {
      const updated = await interviewApi.submitFeedback(feedbackFor.id, {
        rating: Number(feedbackForm.rating),
        recommendation: feedbackForm.recommendation,
        strengths: splitLines(feedbackForm.strengths),
        weaknesses: splitLines(feedbackForm.weaknesses),
        notes: feedbackForm.notes,
      })
      setInterviews((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
      toast.success('Feedback saved')
      setFeedbackFor(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save feedback')
    } finally {
      setIsSavingFeedback(false)
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

  const now = new Date()
  const isUpcoming = (i: Interview) => new Date(i.scheduledAt) >= now && i.status !== 'CANCELLED'
  const upcomingCount = interviews.filter(isUpcoming).length
  const pastCount = interviews.length - upcomingCount
  const query = searchQuery.trim().toLowerCase()

  const filteredInterviews = interviews
    .filter((i) => !query || i.candidateName.toLowerCase().includes(query) || i.jobTitle.toLowerCase().includes(query))
    .filter((i) => !statusFilter || i.status === statusFilter)
    .filter((i) => (activeTab === 'upcoming' ? isUpcoming(i) : !isUpcoming(i)))
    .sort((a, b) => (activeTab === 'upcoming' ? 1 : -1) * (new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()))

  const days: { label: string; items: Interview[] }[] = []
  for (const i of filteredInterviews) {
    const label = relativeDayLabel(new Date(i.scheduledAt), now)
    const last = days[days.length - 1]
    if (last && last.label === label) last.items.push(i)
    else days.push({ label, items: [i] })
  }

  const canManage = hasRole(['ADMIN', 'RECRUITER'])
  const filtering = !!query || !!statusFilter
  const iconBtn =
    'flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-ink-600 transition-colors hover:bg-base-100 hover:text-ink-900 dark:text-ink-400 dark:hover:bg-surface-dark-elevated dark:hover:text-ink-100'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Interviews"
        subtitle="Everything you have scheduled, by day. Add feedback after each interview so the decision is on record."
        action={
          canManage && (
            <Button onClick={openCreateModal} size="lg">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Schedule interview
            </Button>
          )
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatusTabs
          label="Interview timing"
          value={activeTab}
          onChange={(v) => setActiveTab(v as 'upcoming' | 'past')}
          tabs={[
            { value: 'upcoming', label: 'Upcoming', count: upcomingCount },
            { value: 'past', label: 'Past and cancelled', count: pastCount },
          ]}
        />
        <div className="flex flex-wrap gap-3">
          <SearchField value={searchQuery} onChange={setSearchQuery} placeholder="Search candidate or job" label="Search interviews" />
          <FilterSelect
            label="Filter by status"
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as Interview['status'] | '')}
            options={[
              { value: '', label: 'Any status' },
              { value: 'SCHEDULED', label: 'Scheduled' },
              { value: 'COMPLETED', label: 'Completed' },
              { value: 'CANCELLED', label: 'Cancelled' },
              { value: 'NO_SHOW', label: 'No show' },
            ]}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="surface rounded-xl" aria-busy="true" aria-label="Loading interviews">
          <TableSkeleton columns={4} rows={5} />
        </div>
      ) : days.length === 0 ? (
        <div className="surface rounded-xl">
          <EmptyState
            icon={<Calendar className="h-14 w-14" />}
            title={filtering ? 'No interviews match' : activeTab === 'upcoming' ? 'No interviews coming up' : 'No past interviews'}
            description={filtering ? 'Clear the search or status filter to see more.' : 'Schedule an interview to see it here.'}
            action={canManage && !filtering && activeTab === 'upcoming' ? { label: 'Schedule interview', onClick: openCreateModal } : undefined}
          />
        </div>
      ) : (
        <div className="space-y-8">
          {days.map((day) => (
            <section key={day.label} aria-label={day.label}>
              <h2 className="mb-2 flex items-baseline gap-2 font-display text-heading-sm font-semibold text-ink-900 dark:text-ink-100">
                {day.label}
                <span className="text-body-sm font-medium text-ink-600 dark:text-ink-400">
                  {day.items.length} {day.items.length === 1 ? 'interview' : 'interviews'}
                </span>
              </h2>
              <ul className="surface divide-y divide-[var(--color-border)] overflow-hidden rounded-xl">
                {day.items.map((interview) => {
                  const typeInfo = interviewTypes.find((t) => t.value === interview.type)
                  const TypeIcon = typeInfo?.icon
                  return (
                    <li key={interview.id} className="grid grid-cols-1 gap-3 px-5 py-4 md:grid-cols-[6rem_minmax(0,1fr)_auto] md:items-center md:gap-5">
                      <div>
                        <p className="font-display text-heading-sm font-bold tabular text-ink-900 dark:text-ink-100">
                          {new Date(interview.scheduledAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        </p>
                        <p className="text-body-xs text-ink-600 dark:text-ink-400">{interview.duration} min</p>
                      </div>

                      <div className="min-w-0">
                        <Link to={`/candidates/${interview.candidateId}`} className="text-body-md font-semibold text-ink-900 no-underline hover:underline dark:text-ink-100">
                          {interview.candidateName}
                        </Link>
                        <p className="truncate text-body-sm text-ink-600 dark:text-ink-400">
                          {interview.jobTitle}
                          {interview.interviewers.length > 0 && ` with ${interview.interviewers.join(', ')}`}
                        </p>
                        {interview.feedback && (
                          <p className="mt-1 text-body-xs font-semibold text-success-600 dark:text-success-400">
                            Feedback in: {interview.feedback.rating} of 5, {interview.feedback.recommendation.replace('_', ' ').toLowerCase()}
                          </p>
                        )}
                        {interview.meetingLink && interview.status === 'SCHEDULED' && (
                          <a href={interview.meetingLink} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-body-xs font-semibold text-brand-700 underline-offset-2 hover:underline dark:text-brand-300">
                            Open meeting link
                          </a>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 md:justify-end">
                        <span className="badge-default gap-1">
                          {TypeIcon && <TypeIcon className="h-3 w-3" aria-hidden="true" />}
                          {typeInfo?.label}
                        </span>
                        <StatusBadge status={interview.status} />
                        {canManage && (
                          <div className="flex items-center">
                            {interview.status === 'SCHEDULED' && (
                              <button className={iconBtn} onClick={() => openEditModal(interview)} title="Edit" aria-label={`Edit interview with ${interview.candidateName}`}>
                                <Edit className="h-4 w-4" />
                              </button>
                            )}
                            {interview.status !== 'CANCELLED' && (
                              <button
                                className={iconBtn}
                                onClick={() => openFeedbackModal(interview)}
                                title={interview.feedback ? 'Edit feedback' : 'Add feedback'}
                                aria-label={`${interview.feedback ? 'Edit' : 'Add'} feedback for ${interview.candidateName}`}
                              >
                                <MessageSquare className={cn('h-4 w-4', interview.feedback && 'text-success-500')} />
                              </button>
                            )}
                            {interview.status === 'SCHEDULED' && (
                              <button className={cn(iconBtn, 'hover:text-warning-600')} onClick={() => handleCancel(interview.id)} title="Cancel interview" aria-label={`Cancel interview with ${interview.candidateName}`}>
                                <XCircle className="h-4 w-4" />
                              </button>
                            )}
                            <button className={cn(iconBtn, 'hover:text-error-600')} onClick={() => handleDelete(interview.id)} title="Delete" aria-label={`Delete interview with ${interview.candidateName}`}>
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

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
                disabled={isEditing}
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
      <Modal isOpen={!!feedbackFor} onClose={() => setFeedbackFor(null)} title="Interview Feedback" size="lg">
        <div className="space-y-5">
          <p className="text-body-sm text-ink-500 dark:text-ink-400">
            {feedbackFor?.candidateName} - {feedbackFor?.jobTitle}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Select
              label="Rating *"
              value={feedbackForm.rating}
              onChange={(e) => setFeedbackForm((f) => ({ ...f, rating: e.target.value }))}
              options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n} / 5` }))}
            />
            <Select
              label="Recommendation *"
              value={feedbackForm.recommendation}
              onChange={(e) => setFeedbackForm((f) => ({ ...f, recommendation: e.target.value as InterviewFeedback['recommendation'] }))}
              options={[
                { value: 'HIRE', label: 'Hire' },
                { value: 'MAYBE', label: 'Maybe' },
                { value: 'NO_HIRE', label: 'No hire' },
              ]}
            />
          </div>
          <Textarea
            label="Strengths (one per line)"
            value={feedbackForm.strengths}
            onChange={(e) => setFeedbackForm((f) => ({ ...f, strengths: e.target.value }))}
          />
          <Textarea
            label="Weaknesses (one per line)"
            value={feedbackForm.weaknesses}
            onChange={(e) => setFeedbackForm((f) => ({ ...f, weaknesses: e.target.value }))}
          />
          <Textarea
            label="Notes"
            value={feedbackForm.notes}
            onChange={(e) => setFeedbackForm((f) => ({ ...f, notes: e.target.value }))}
          />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setFeedbackFor(null)}>Cancel</Button>
            <Button type="button" loading={isSavingFeedback} onClick={submitFeedback}>Save Feedback</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
