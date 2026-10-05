import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { jobApi } from '@/utils/api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Input'
import { Select } from '@/components/ui/Input'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card'
import { ArrowLeft, Plus, Trash2, GripVertical } from 'lucide-react'
import { Link } from 'react-router-dom'

const skillSchema = z.object({
  skillName: z.string().min(1, 'Skill name is required'),
  type: z.enum(['REQUIRED', 'PREFERRED']),
  weight: z.number().min(1).max(100),
})

const createJobSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  department: z.string().min(1, 'Department is required'),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP']),
  workMode: z.enum(['REMOTE', 'HYBRID', 'ONSITE']),
  location: z.string().min(1, 'Location is required'),
  experienceRequired: z.number().min(0, 'Experience must be 0 or more'),
  educationRequired: z.string().min(1, 'Education requirement is required'),
  minimumSalary: z.number().min(0, 'Minimum salary must be 0 or more'),
  maximumSalary: z.number().min(0, 'Maximum salary must be 0 or more'),
  description: z.string().min(50, 'Description must be at least 50 characters'),
  applicationDeadline: z.string().min(1, 'Application deadline is required'),
  vacancies: z.number().min(1, 'At least 1 vacancy required'),
  skills: z.array(skillSchema).min(1, 'At least one skill is required'),
}).refine((data) => data.maximumSalary >= data.minimumSalary, {
  message: 'Maximum salary must be greater than or equal to minimum salary',
  path: ['maximumSalary'],
})

type CreateJobForm = z.infer<typeof createJobSchema>
type SkillForm = z.infer<typeof skillSchema>

const departments = [
  'Engineering',
  'Marketing',
  'Sales',
  'Human Resources',
  'Finance',
  'Operations',
  'Product',
  'Design',
  'Customer Success',
  'Legal',
  'Other',
]

const employmentTypes = [
  { value: 'FULL_TIME', label: 'Full Time' },
  { value: 'PART_TIME', label: 'Part Time' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'INTERNSHIP', label: 'Internship' },
]

const workModes = [
  { value: 'REMOTE', label: 'Remote' },
  { value: 'HYBRID', label: 'Hybrid' },
  { value: 'ONSITE', label: 'On-site' },
]

const skillTypes = [
  { value: 'REQUIRED', label: 'Required' },
  { value: 'PREFERRED', label: 'Preferred' },
]

export function CreateJob() {
  const navigate = useNavigate()
  const [skills, setSkills] = useState<SkillForm[]>([{ skillName: '', type: 'REQUIRED', weight: 30 }])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CreateJobForm>({
    resolver: zodResolver(createJobSchema),
    defaultValues: {
      employmentType: 'FULL_TIME',
      workMode: 'HYBRID',
      experienceRequired: 0,
      minimumSalary: 0,
      maximumSalary: 0,
      vacancies: 1,
    },
  })

  const handleSkillChange = (index: number, field: keyof SkillForm, value: string | number) => {
    const newSkills = [...skills]
    newSkills[index] = { ...newSkills[index], [field]: value }
    setSkills(newSkills)
    setValue('skills', newSkills, { shouldValidate: true })
  }

  const addSkill = () => {
    const newSkill: SkillForm = { skillName: '', type: 'REQUIRED', weight: 10 }
    setSkills([...skills, newSkill])
  }

  const removeSkill = (index: number) => {
    if (skills.length <= 1) return
    const newSkills = skills.filter((_, i) => i !== index)
    setSkills(newSkills)
    setValue('skills', newSkills, { shouldValidate: true })
  }

  const onSubmit = async (data: CreateJobForm) => {
    setIsSubmitting(true)
    try {
      await jobApi.create(data)
      toast.success('Job created successfully')
      navigate('/jobs')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create job'
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/jobs">
          <Button variant="ghost" size="sm" className="p-2">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-display-md font-bold text-ink-900 dark:text-ink-100">Create New Job</h1>
          <p className="text-body-md text-ink-500 dark:text-ink-400">Fill in the details to post a new position</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card padding="lg">
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Essential details about the position</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Input
                label="Job Title *"
                placeholder="e.g., Senior Software Engineer"
                error={errors.title?.message}
                {...register('title')}
              />
              <Select
                label="Department *"
                options={departments.map((d) => ({ value: d, label: d }))}
                placeholder="Select department"
                error={errors.department?.message}
                {...register('department')}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <Select
                label="Employment Type *"
                options={employmentTypes}
                error={errors.employmentType?.message}
                {...register('employmentType')}
              />
              <Select
                label="Work Mode *"
                options={workModes}
                error={errors.workMode?.message}
                {...register('workMode')}
              />
              <Input
                label="Location *"
                placeholder="e.g., Bangalore, India"
                error={errors.location?.message}
                {...register('location')}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <Input
                label="Experience Required (years) *"
                type="number"
                min={0}
                error={errors.experienceRequired?.message}
                {...register('experienceRequired', { valueAsNumber: true })}
              />
              <Input
                label="Min Salary (INR/year) *"
                type="number"
                min={0}
                step={100000}
                error={errors.minimumSalary?.message}
                {...register('minimumSalary', { valueAsNumber: true })}
              />
              <Input
                label="Max Salary (INR/year) *"
                type="number"
                min={0}
                step={100000}
                error={errors.maximumSalary?.message}
                {...register('maximumSalary', { valueAsNumber: true })}
              />
            </div>

            <Input
              label="Education Required *"
              placeholder="e.g., B.Tech in Computer Science or equivalent"
              error={errors.educationRequired?.message}
              {...register('educationRequired')}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Input
                label="Application Deadline *"
                type="date"
                error={errors.applicationDeadline?.message}
                {...register('applicationDeadline')}
              />
              <Input
                label="Number of Vacancies *"
                type="number"
                min={1}
                error={errors.vacancies?.message}
                {...register('vacancies', { valueAsNumber: true })}
              />
            </div>
          </CardContent>
        </Card>

        <Card padding="lg">
          <CardHeader>
            <CardTitle>Job Description</CardTitle>
            <CardDescription>Detailed description of the role and responsibilities</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              label="Description *"
              placeholder="Describe the role, responsibilities, requirements, benefits, etc. (minimum 50 characters)"
              rows={8}
              error={errors.description?.message}
              {...register('description')}
            />
          </CardContent>
        </Card>

        <Card padding="lg">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle>Required Skills</CardTitle>
              <CardDescription>Add skills with weightage for AI matching</CardDescription>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={addSkill}>
              <Plus className="w-4 h-4" />
              Add Skill
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {skills.map((skill, index) => (
              <div key={index} className="flex items-start gap-3 p-4 bg-base-50 dark:bg-base-800/50 rounded-xl">
                <GripVertical className="w-5 h-5 text-ink-300 dark:text-ink-600 mt-1 flex-shrink-0" />
                <div className="flex-1 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Input
                      label="Skill Name"
                      placeholder="e.g., React, TypeScript"
                      error={errors.skills?.[index]?.skillName?.message}
                      value={skill.skillName}
                      onChange={(e) => handleSkillChange(index, 'skillName', e.target.value)}
                    />
                    <Select
                      label="Type"
                      options={skillTypes}
                      value={skill.type}
                      onChange={(e) => handleSkillChange(index, 'type', e.target.value)}
                    />
                    <Input
                      label="Weight (%)"
                      type="number"
                      min={1}
                      max={100}
                      placeholder="Weight"
                      error={errors.skills?.[index]?.weight?.message}
                      value={String(skill.weight)}
                      onChange={(e) => handleSkillChange(index, 'weight', parseInt(e.target.value) || 0)}
                      className="w-24"
                    />
                  </div>
                  {skills.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-error-500 hover:text-error-600"
                      onClick={() => removeSkill(index)}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {skills.length === 0 && (
              <p className="text-body-sm text-ink-500 dark:text-ink-400 text-center py-4">
                No skills added yet. Click "Add Skill" to start.
              </p>
            )}
          </CardContent>
        </Card>

        <CardFooter className="flex flex-col sm:flex-row justify-end gap-3">
          <Link to="/jobs">
            <Button type="button" variant="ghost">Cancel</Button>
          </Link>
          <Button type="submit" size="lg" loading={isSubmitting}>
            Create Job
          </Button>
        </CardFooter>
      </form>
    </div>
  )
}