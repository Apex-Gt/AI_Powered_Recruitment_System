import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { jobApi } from '@/utils/api'
import { Button } from '@/components/ui/Button'
import { Input, Textarea, Select } from '@/components/ui/Input'
import { CharCounter, FormSection, SegmentedRadio, SummaryRow } from '@/components/ui/FormParts'
import { AlertCircle, ArrowLeft, Briefcase, FileText, IndianRupee, Sparkles, X } from 'lucide-react'
import { formatCurrency } from '@/utils/helpers'

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
  { value: 'FULL_TIME', label: 'Full time' },
  { value: 'PART_TIME', label: 'Part time' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'INTERNSHIP', label: 'Intern' },
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
  const [skills, setSkills] = useState<SkillForm[]>([])
  const [skillDraft, setSkillDraft] = useState('')
  const [draftType, setDraftType] = useState<SkillForm['type']>('REQUIRED')
  const [draftWeight, setDraftWeight] = useState(10)
  const [skillNote, setSkillNote] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
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
      description: '',
      skills: [],
    },
  })

  const watched = watch()
  const totalWeight = skills.reduce((sum, sk) => sum + (Number(sk.weight) || 0), 0)
  const today = new Date().toISOString().split('T')[0]

  const syncSkills = (next: SkillForm[]) => {
    setSkills(next)
    setValue('skills', next, { shouldValidate: true })
  }

  const commitSkill = (raw: string) => {
    const name = raw.trim().replace(/,+$/, '').trim()
    if (!name) return
    if (skills.some((sk) => sk.skillName.toLowerCase() === name.toLowerCase())) {
      setSkillNote(`"${name}" is already added`)
      return
    }
    setSkillNote(null)
    syncSkills([...skills, { skillName: name, type: draftType, weight: Math.min(100, Math.max(1, draftWeight || 1)) }])
    setSkillDraft('')
  }

  const removeSkill = (index: number) => syncSkills(skills.filter((_, i) => i !== index))

  const onSkillKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commitSkill(skillDraft)
    } else if (e.key === 'Backspace' && !skillDraft && skills.length > 0) {
      removeSkill(skills.length - 1)
    }
  }

  const onInvalid = () => {
    setFormError('Some fields need attention. Fix the highlighted fields and try again.')
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setTimeout(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 300)
  }

  const onSubmit = async (data: CreateJobForm) => {
    setIsSubmitting(true)
    setFormError(null)
    try {
      await jobApi.create(data)
      toast.success('Job created')
      navigate('/jobs')
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : 'Failed to create job'
      setFormError(`The job was not created: ${message}`)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const salaryText =
    watched.minimumSalary || watched.maximumSalary
      ? `${formatCurrency(watched.minimumSalary || 0)} – ${formatCurrency(watched.maximumSalary || 0)}`
      : 'Not set'
  const labelOf = (list: { value: string; label: string }[], v?: string) => list.find((o) => o.value === v)?.label

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/jobs"
          className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-ink-600 transition-colors hover:text-ink-900 dark:text-ink-300"
          aria-label="Back to jobs"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-heading-xl font-extrabold tracking-tight text-ink-900 dark:text-ink-100">Create job</h1>
          <p className="text-body-sm text-ink-500 dark:text-ink-400">Fields marked * are required.</p>
        </div>
      </div>

      {formError && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-error-200 bg-error-50 p-3 text-body-sm text-error-600 dark:border-error-800/70 dark:bg-error-900/30 dark:text-error-400">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          {formError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit, onInvalid)} noValidate className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <FormSection icon={Briefcase} title="Role details" description="What the position is and where it sits">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <Input label="Job title" required placeholder="e.g. Senior Software Engineer" error={errors.title?.message} {...register('title')} />
              <Select
                label="Department"
                required
                options={departments.map((d) => ({ value: d, label: d }))}
                placeholder="Select department"
                error={errors.department?.message}
                defaultValue=""
                {...register('department')}
              />
            </div>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <SegmentedRadio legend="Employment type" required options={employmentTypes} error={errors.employmentType?.message} {...register('employmentType')} />
              <SegmentedRadio legend="Work mode" required options={workModes} error={errors.workMode?.message} {...register('workMode')} />
            </div>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <Input label="Location" required placeholder="e.g. Bangalore, India" error={errors.location?.message} {...register('location')} />
              <Input label="Vacancies" required type="number" min={1} error={errors.vacancies?.message} {...register('vacancies', { valueAsNumber: true })} />
            </div>
          </FormSection>

          <FormSection icon={IndianRupee} title="Requirements and pay" description="Who you are looking for and what the role pays">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <Input
                label="Minimum experience (years)"
                required
                type="number"
                min={0}
                error={errors.experienceRequired?.message}
                {...register('experienceRequired', { valueAsNumber: true })}
              />
              <Input
                label="Education"
                required
                placeholder="e.g. B.Tech in Computer Science"
                error={errors.educationRequired?.message}
                {...register('educationRequired')}
              />
            </div>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              <Input
                label="Minimum salary per year"
                required
                type="number"
                min={0}
                step={100000}
                icon={<span className="text-body-md font-semibold">₹</span>}
                error={errors.minimumSalary?.message}
                {...register('minimumSalary', { valueAsNumber: true })}
              />
              <Input
                label="Maximum salary per year"
                required
                type="number"
                min={0}
                step={100000}
                icon={<span className="text-body-md font-semibold">₹</span>}
                error={errors.maximumSalary?.message}
                {...register('maximumSalary', { valueAsNumber: true })}
              />
              <Input
                label="Apply by"
                required
                type="date"
                min={today}
                error={errors.applicationDeadline?.message}
                {...register('applicationDeadline')}
              />
            </div>
          </FormSection>

          <FormSection icon={FileText} title="Description" description="Responsibilities, requirements and benefits">
            <div>
              <Textarea
                label="Job description"
                required
                placeholder="Describe the role, day-to-day work, must-have qualifications and benefits."
                rows={8}
                error={errors.description?.message}
                {...register('description')}
              />
              <CharCounter count={(watched.description ?? '').length} min={50} />
            </div>
          </FormSection>

          <FormSection
            icon={Sparkles}
            title="Skills for AI matching"
            description="Type a skill and press Enter to add it as a tag"
          >
            <div>
              <label htmlFor="skill-input" className="label">
                Skills<span className="ml-1 text-accent-600" aria-hidden="true">*</span>
              </label>
              <div
                className={`flex min-h-[3rem] flex-wrap items-center gap-2 rounded-lg border bg-[var(--color-input-bg)] p-2 transition-colors focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 ${
                  errors.skills ? 'border-error-500' : 'border-[var(--color-border)]'
                }`}
                onClick={() => document.getElementById('skill-input')?.focus()}
              >
                {skills.map((skill, index) => (
                  <span
                    key={skill.skillName}
                    title={skill.type === 'REQUIRED' ? 'Required skill' : 'Preferred skill'}
                    className={
                      skill.type === 'REQUIRED'
                        ? 'inline-flex items-center gap-1.5 rounded-full bg-brand-50 py-1 pl-3 pr-1 text-body-sm font-semibold text-brand-700 ring-1 ring-brand-200 dark:bg-brand-900/30 dark:text-brand-200 dark:ring-brand-800'
                        : 'inline-flex items-center gap-1.5 rounded-full bg-transparent py-1 pl-3 pr-1 text-body-sm font-semibold text-ink-700 ring-1 ring-ink-300 dark:text-ink-200 dark:ring-ink-600'
                    }
                  >
                    {skill.skillName}
                    <span className="text-body-xs font-bold opacity-70">{skill.weight}%</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeSkill(index)
                      }}
                      className="flex h-5 w-5 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-black/10 dark:hover:bg-white/10"
                      aria-label={`Remove ${skill.skillName}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <input
                  id="skill-input"
                  value={skillDraft}
                  onChange={(e) => {
                    setSkillDraft(e.target.value)
                    setSkillNote(null)
                  }}
                  onKeyDown={onSkillKeyDown}
                  onBlur={() => commitSkill(skillDraft)}
                  placeholder={skills.length === 0 ? 'e.g. React, then press Enter' : 'Add another skill'}
                  className="min-w-[10rem] flex-1 bg-transparent px-1 py-1 text-body-md text-ink-900 outline-none placeholder:text-ink-400 dark:text-ink-100"
                  autoComplete="off"
                />
              </div>
              {(errors.skills?.message || errors.skills?.root?.message) && (
                <p className="error-text" role="alert">
                  {errors.skills?.message || errors.skills?.root?.message}
                </p>
              )}
              {skillNote && (
                <p className="mt-1.5 text-body-xs text-warning-600" role="status">
                  {skillNote}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 items-end gap-5 sm:grid-cols-2">
              <SegmentedRadio
                legend="Next skill is"
                size="sm"
                name="draft-skill-type"
                options={skillTypes}
                value={draftType}
                onChange={(e) => setDraftType(e.target.value as SkillForm['type'])}
              />
              <div>
                <label htmlFor="draft-weight" className="label">
                  Weight for next skill
                </label>
                <div className="flex items-center gap-3">
                  <input
                    id="draft-weight"
                    type="range"
                    min={1}
                    max={100}
                    value={draftWeight}
                    onChange={(e) => setDraftWeight(parseInt(e.target.value) || 1)}
                    className="h-2 flex-1 cursor-pointer accent-[#7C4DFF]"
                  />
                  <span className="w-10 text-right text-body-sm font-bold text-ink-900 dark:text-ink-100">{draftWeight}%</span>
                </div>
              </div>
            </div>

            <p className="text-body-xs text-ink-500 dark:text-ink-400">
              Filled tags are required skills and outlined tags are preferred. Higher weight counts more toward a candidate&apos;s match score.
              Total weight: {totalWeight}%.
            </p>
          </FormSection>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card !p-0 overflow-hidden">
            <div className="border-b border-[var(--color-border)] bg-gradient-to-br from-accent-50 to-brand-50 px-5 py-4 dark:from-accent-900/20 dark:to-brand-900/20">
              <p className="text-body-xs font-semibold text-ink-500 dark:text-ink-400">Summary</p>
              <p className="mt-1 break-words text-heading-sm font-bold text-ink-900 dark:text-ink-100">{watched.title || 'Untitled job'}</p>
            </div>
            <dl className="divide-y divide-[var(--color-border)] px-5">
              <SummaryRow label="Department">{watched.department || '—'}</SummaryRow>
              <SummaryRow label="Type">{labelOf(employmentTypes, watched.employmentType)}</SummaryRow>
              <SummaryRow label="Work mode">{labelOf(workModes, watched.workMode)}</SummaryRow>
              <SummaryRow label="Location">{watched.location || '—'}</SummaryRow>
              <SummaryRow label="Vacancies">{Number.isFinite(watched.vacancies) ? watched.vacancies : '—'}</SummaryRow>
              <SummaryRow label="Salary">{salaryText}</SummaryRow>
              <SummaryRow label="Skills">{skills.filter((sk) => sk.skillName.trim()).length}</SummaryRow>
            </dl>
            <div className="flex flex-col gap-2 border-t border-[var(--color-border)] p-5">
              <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
                Create job
              </Button>
              <Link to="/jobs" className="btn-ghost w-full justify-center">
                Cancel
              </Link>
            </div>
          </div>
        </aside>
      </form>
    </div>
  )
}
