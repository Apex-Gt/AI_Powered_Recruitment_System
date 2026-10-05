import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { assessmentApi } from '@/utils/api'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Input'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/Table'
import { StatusBadge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { Plus, Edit, Trash2, CheckSquare, Search, Code2 } from 'lucide-react'
import { cn } from '@/utils/helpers'
import type { Assessment } from '@/types'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'

const questionSchema = z.object({
  id: z.string().default(() => crypto.randomUUID()),
  question: z.string().min(1, 'Question is required'),
  type: z.enum(['MULTIPLE_CHOICE', 'CODE', 'ESSAY', 'VIDEO']),
  options: z.array(z.string()).optional(),
  correctAnswer: z.string().optional(),
  weight: z.number().min(1).max(100),
})

const assessmentSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  type: z.enum(['CODING', 'TECHNICAL', 'BEHAVIORAL', 'CUSTOM']),
  duration: z.number().min(1, 'Duration must be at least 1 minute'),
  questions: z.array(questionSchema).min(1, 'At least one question is required'),
})

type AssessmentForm = z.infer<typeof assessmentSchema>
type QuestionForm = z.infer<typeof questionSchema>

const assessmentTypes = [
  { value: 'CODING', label: 'Coding', icon: Code2 },
  { value: 'TECHNICAL', label: 'Technical', icon: Code2 },
  { value: 'BEHAVIORAL', label: 'Behavioral', icon: Code2 },
  { value: 'CUSTOM', label: 'Custom', icon: Code2 },
]

const questionTypes = [
  { value: 'MULTIPLE_CHOICE', label: 'Multiple Choice' },
  { value: 'CODE', label: 'Code' },
  { value: 'ESSAY', label: 'Essay' },
  { value: 'VIDEO', label: 'Video' },
]

export function Assessments() {
  const { hasRole } = useAuth()
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [questions, setQuestions] = useState<QuestionForm[]>([{ id: crypto.randomUUID(), question: '', type: 'MULTIPLE_CHOICE', weight: 10 }])

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
    reset,
  } = useForm<AssessmentForm>({
    resolver: zodResolver(assessmentSchema),
    defaultValues: {
      type: 'TECHNICAL',
      duration: 60,
    },
  })

  useEffect(() => {
    const fetchAssessments = async () => {
      setIsLoading(true)
      try {
        const response = await assessmentApi.getAll()
        setAssessments(response)
      } catch (error) {
        console.error('Failed to fetch assessments:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchAssessments()
  }, [])

  const openCreateModal = () => {
    setIsEditing(false)
    reset({ type: 'TECHNICAL', duration: 60 })
    setQuestions([{ id: crypto.randomUUID(), question: '', type: 'MULTIPLE_CHOICE', weight: 10 }])
    setIsModalOpen(true)
  }

  const openEditModal = (assessment: Assessment) => {
    setIsEditing(true)
    setSelectedAssessment(assessment)
    reset({
      title: assessment.title,
      type: assessment.type,
      duration: assessment.duration,
    })
    setQuestions(assessment.questions.map((q) => ({
      id: q.id || crypto.randomUUID(),
      question: q.question,
      type: q.type,
      options: q.options || [],
      correctAnswer: q.correctAnswer || '',
      weight: q.weight,
    })))
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setSelectedAssessment(null)
  }

  const handleQuestionChange = (index: number, field: keyof QuestionForm, value: string | string[] | number) => {
    const newQuestions = [...questions]
    newQuestions[index] = { ...newQuestions[index], [field]: value }
    setQuestions(newQuestions)
    setValue('questions', newQuestions, { shouldValidate: true })
  }

  const addQuestion = () => {
    setQuestions([...questions, { id: crypto.randomUUID(), question: '', type: 'MULTIPLE_CHOICE', weight: 10 }])
  }

  const removeQuestion = (index: number) => {
    if (questions.length <= 1) return
    const newQuestions = questions.filter((_, i) => i !== index)
    setQuestions(newQuestions)
    setValue('questions', newQuestions, { shouldValidate: true })
  }

  const onSubmit = async (data: AssessmentForm) => {
    setIsSubmitting(true)
    try {
      if (isEditing && selectedAssessment) {
        await assessmentApi.update(selectedAssessment.id, data)
        toast.success('Assessment updated successfully')
      } else {
        await assessmentApi.create(data)
        toast.success('Assessment created successfully')
      }
      closeModal()
      const response = await assessmentApi.getAll()
      setAssessments(response)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save assessment'
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this assessment?')) return
    try {
      await assessmentApi.delete(id)
      toast.success('Assessment deleted successfully')
      setAssessments((prev) => prev.filter((a) => a.id !== id))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete assessment'
      toast.error(message)
    }
  }

  const filteredAssessments = assessments.filter((a) =>
    a.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-display-md font-bold text-ink-900 dark:text-ink-100">Assessments</h1>
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-display-md font-bold text-ink-900 dark:text-ink-100">Assessments</h1>
          <p className="text-body-md text-ink-500 dark:text-ink-400 mt-1">Create and manage candidate assessments</p>
        </div>
        {hasRole(['ADMIN', 'RECRUITER']) && (
          <Button onClick={openCreateModal} size="lg">
            <Plus className="w-5 h-5" />
            Create Assessment
          </Button>
        )}
      </div>

      <Card padding="md" className="space-y-4">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-400" />
          <Input
            placeholder="Search assessments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </Card>

      <Card variant="flat" padding="none">
        {filteredAssessments.length === 0 ? (
          <EmptyState
            icon={<CheckSquare className="w-16 h-16" />}
            title={searchQuery ? 'No assessments found' : 'No assessments yet'}
            description={searchQuery ? 'Try adjusting your search' : 'Create your first assessment to evaluate candidates'}
            action={hasRole(['ADMIN', 'RECRUITER']) ? { label: 'Create Assessment', onClick: openCreateModal } : undefined}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead style={{ width: '35%' }}>Assessment</TableHead>
                    <TableHead style={{ width: '15%' }}>Type</TableHead>
                    <TableHead style={{ width: '15%' }}>Duration</TableHead>
                    <TableHead style={{ width: '15%' }}>Questions</TableHead>
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
                          <p className="text-body-xs text-ink-500 dark:text-ink-400">{assessment.questions.length} questions</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={cn('badge-default gap-1', assessment.type === 'CODING' && 'bg-purple-100 text-purple-600')}>
                          {(() => {
                            const typeInfo = assessmentTypes.find((t) => t.value === assessment.type)
                            const Icon = typeInfo?.icon
                            return Icon ? <Icon className="w-4 h-4" /> : null
                          })()}
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
                          <Button variant="ghost" size="sm" onClick={() => openEditModal(assessment)} title="Edit">
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-error-500" onClick={() => handleDelete(assessment.id)} title="Delete">
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

      <Modal isOpen={isModalOpen} onClose={closeModal} title={isEditing ? 'Edit Assessment' : 'Create Assessment'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Card padding="lg">
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Enter the assessment details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <Input
                label="Title *"
                placeholder="e.g., React Technical Assessment"
                error={errors.title?.message}
                {...register('title')}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Select
                  label="Type *"
                  options={assessmentTypes.map((t) => ({ value: t.value, label: t.label }))}
                  error={errors.type?.message}
                  {...register('type')}
                />
                <Input
                  label="Duration (minutes) *"
                  type="number"
                  min={1}
                  max={480}
                  error={errors.duration?.message}
                  {...register('duration', { valueAsNumber: true })}
                />
              </div>
            </CardContent>
          </Card>

          <Card padding="lg">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle>Questions</CardTitle>
                <CardDescription>Add questions with weightage for scoring</CardDescription>
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={addQuestion}>
                <Plus className="w-4 h-4" />
                Add Question
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {questions.map((question, index) => (
                <div key={index} className="p-4 bg-base-50 dark:bg-base-800/50 rounded-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-ink-900 dark:text-ink-100">Question {index + 1}</h4>
                    {questions.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-error-500 hover:text-error-600"
                        onClick={() => removeQuestion(index)}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Remove
                      </Button>
                    )}
                  </div>

                  <Input
                    label="Question *"
                    placeholder="Enter your question"
                    error={errors.questions?.[index]?.question?.message}
                    value={question.question}
                    onChange={(e) => handleQuestionChange(index, 'question', e.target.value)}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Select
                      label="Type *"
                      options={questionTypes}
                      value={question.type}
                      onChange={(e) => handleQuestionChange(index, 'type', e.target.value)}
                    />
                    <Input
                      label="Weight (%) *"
                      type="number"
                      min={1}
                      max={100}
                      error={errors.questions?.[index]?.weight?.message}
                      value={String(question.weight)}
                      onChange={(e) => handleQuestionChange(index, 'weight', parseInt(e.target.value) || 0)}
                      className="w-24"
                    />
                  </div>

                  {question.type === 'MULTIPLE_CHOICE' && (
                    <div className="space-y-2">
                      <label className="label">Options (one per line) *</label>
                      <textarea
                        className="input min-h-[80px] resize-y"
                        placeholder="Option 1\nOption 2\nOption 3"
                        value={(question.options || []).join('\n')}
                        onChange={(e) => handleQuestionChange(index, 'options', e.target.value.split('\n').filter((o) => o.trim()))}
                      />
                      {errors.questions?.[index]?.options && (
                        <p className="text-body-xs text-error-600 dark:text-error-400">{errors.questions[index].options.message}</p>
                      )}
                    </div>
                  )}

                  {question.type !== 'VIDEO' && (
                    <Input
                      label="Correct Answer / Expected Keywords"
                      placeholder={question.type === 'CODE' ? 'Expected output or keywords' : 'Correct answer or keywords'}
                      value={question.correctAnswer || ''}
                      onChange={(e) => handleQuestionChange(index, 'correctAnswer', e.target.value)}
                    />
                  )}
                </div>
              ))}

              {questions.length === 0 && (
                <p className="text-body-sm text-ink-500 dark:text-ink-400 text-center py-4">
                  No questions added yet. Click "Add Question" to start.
                </p>
              )}
            </CardContent>
          </Card>

          <CardFooter className="flex flex-col sm:flex-row justify-end gap-3">
            <Button type="button" variant="ghost" onClick={closeModal}>Cancel</Button>
            <Button type="submit" size="lg" loading={isSubmitting}>
              {isEditing ? 'Update' : 'Create'} Assessment
            </Button>
          </CardFooter>
        </form>
      </Modal>
    </div>
  )
}