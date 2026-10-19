import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { companyApi } from '@/utils/api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PlaceInput, PlaceOption } from '@/components/ui/PlaceInput'
import { AuthShell } from '@/components/auth/AuthShell'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { cn } from '@/utils/helpers'
import { Link } from 'react-router-dom'

const companySchema = z.object({
  companyName: z.string().min(2, 'Company name must be at least 2 characters'),
  country: z.string().min(1, 'Country is required'),
  state: z.string().min(1, 'State is required'),
  city: z.string().min(1, 'City is required'),
  industry: z.string().optional(),
  gstNumber: z.string().min(1, 'GST number is required'),
})

const adminSchema = z.object({
  adminUserName: z.string().min(2, 'Username must be at least 2 characters'),
  adminEmail: z.string().email('Invalid email address'),
  adminPhoneNumber: z.string().min(10, 'Phone number must be at least 10 digits'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

type CompanyForm = z.infer<typeof companySchema>
type AdminForm = z.infer<typeof adminSchema>

const steps = [
  { number: 1, title: 'Company Info', description: 'Enter your company details' },
  { number: 2, title: 'Admin Account', description: 'Create your admin account' },
]

export function Register() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [companyData, setCompanyData] = useState<Partial<CompanyForm>>({})

  const companyMethods = useForm<CompanyForm>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      country: '',
      state: '',
      city: '',
    },
  })

  const country = companyMethods.watch('country') ?? ''
  const state = companyMethods.watch('state') ?? ''
  const city = companyMethods.watch('city') ?? ''
  const [countryCode, setCountryCode] = useState<string | undefined>()
  const [stateId, setStateId] = useState<string | undefined>()

  // Country narrows the state list and state narrows the city list, so changing one clears what depends on it.
  const pickCountry = (p: PlaceOption | null) => {
    setCountryCode(p?.countryCode)
    setStateId(undefined)
    companyMethods.setValue('country', p?.name ?? '', { shouldValidate: true })
    companyMethods.setValue('state', '')
    companyMethods.setValue('city', '')
  }
  const pickState = (p: PlaceOption | null) => {
    setStateId(p?.placeId)
    companyMethods.setValue('state', p?.name ?? '', { shouldValidate: true })
    companyMethods.setValue('city', '')
  }

  const adminMethods = useForm<AdminForm>({
    resolver: zodResolver(adminSchema),
  })

  const handleCompanySubmit = (data: CompanyForm) => {
    setCompanyData(data)
    setCurrentStep(1)
  }

  const handleAdminSubmit = async (data: AdminForm) => {
    setIsSubmitting(true)
    try {
      await companyApi.register({
        ...companyData,
        ...data,
      } as CompanyForm & AdminForm)
      toast.success('Company registered successfully!')
      navigate('/login')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Registration failed'
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const goBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  return (
    <AuthShell scrollForm>
      <Link to="/login" className="mb-6 shrink-0 self-startinline-flex cursor-pointer items-center gap-2 text-body-sm font-medium text-ink-500 transition-colors hover:text-ink-900 dark:text-ink-400 dark:hover:text-ink-100">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to login
      </Link>

      <h1 className="text-display-sm font-extrabold tracking-tight text-ink-900 dark:text-ink-100">Register your company</h1>
      <p className="mt-2 text-body-md text-ink-500 dark:text-ink-400">{steps[currentStep].description}</p>

      <ol className="mt-6 mb-8 flex shrink-0 items-center gap-3" aria-label="Registration progress">
        {steps.map((step, index) => (
          <li key={step.number} className="flex flex-1 items-center gap-3" aria-current={index === currentStep ? 'step' : undefined}>
            <span className={cn(
              'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-body-sm font-semibold transition-colors',
              index <= currentStep ? 'bg-brand-500 text-[#1c1917]' : 'bg-base-100 text-ink-500 dark:bg-base-700'
            )}>
              {index < currentStep ? <Check className="h-4 w-4" aria-hidden="true" /> : step.number}
            </span>
            <span className={cn('text-body-sm font-semibold', index <= currentStep ? 'text-ink-900 dark:text-ink-100' : 'text-ink-500')}>{step.title}</span>
            {index < steps.length - 1 && <span className={cn('h-0.5 flex-1 rounded-full', index < currentStep ? 'bg-brand-500' : 'bg-base-200 dark:bg-base-700')} />}
          </li>
        ))}
      </ol>

      <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:-mx-1 lg:px-1">
            {currentStep === 0 && (
              <form onSubmit={companyMethods.handleSubmit(handleCompanySubmit)} className="space-y-5">
                <div className="space-y-5">
                  <Input
                    label="Company Name *"
                    placeholder="e.g., Acme Corporation"
                    error={companyMethods.formState.errors.companyName?.message}
                    {...companyMethods.register('companyName')}
                  />
                  <Input
                    label="Industry"
                    placeholder="e.g., Technology, Healthcare, Finance"
                    error={companyMethods.formState.errors.industry?.message}
                    {...companyMethods.register('industry')}
                  />
                  <PlaceInput
                    label="Country"
                    kind="country"
                    required
                    placeholder="Start typing a country"
                    value={country}
                    onChange={(p) => pickCountry(p)}
                    error={companyMethods.formState.errors.country?.message}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <PlaceInput
                      label="State"
                      kind="state"
                      required
                      placeholder="Start typing a state"
                      value={state}
                      countryCode={countryCode}
                      disabled={!country}
                      onChange={(p) => pickState(p)}
                      error={companyMethods.formState.errors.state?.message}
                    />
                    <PlaceInput
                      label="City"
                      kind="city"
                      required
                      placeholder="Start typing a city"
                      value={city}
                      countryCode={countryCode}
                      stateId={stateId}
                      disabled={!state}
                      onChange={(p) => companyMethods.setValue('city', p?.name ?? '', { shouldValidate: true })}
                      error={companyMethods.formState.errors.city?.message}
                    />
                  </div>
                  <Input
                    label="GST Number *"
                    placeholder="e.g., 27AAAAA0000A1Z5"
                    error={companyMethods.formState.errors.gstNumber?.message}
                    {...companyMethods.register('gstNumber')}
                  />
                </div>

                <div className="flex justify-end pt-4">
                  <Button type="submit" size="lg" loading={isSubmitting}>
                    Next
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </form>
            )}

            {currentStep === 1 && (
              <form onSubmit={adminMethods.handleSubmit(handleAdminSubmit)} className="space-y-5">
                <div className="space-y-5">
                  <Input
                    label="Admin Username *"
                    placeholder="e.g., john_admin"
                    error={adminMethods.formState.errors.adminUserName?.message}
                    {...adminMethods.register('adminUserName')}
                  />
                  <Input
                    label="Admin Email *"
                    type="email"
                    placeholder="e.g., admin@company.com"
                    error={adminMethods.formState.errors.adminEmail?.message}
                    {...adminMethods.register('adminEmail')}
                  />
                  <Input
                    label="Phone Number *"
                    type="tel"
                    placeholder="e.g., +91 9876543210"
                    error={adminMethods.formState.errors.adminPhoneNumber?.message}
                    {...adminMethods.register('adminPhoneNumber')}
                  />
                  <Input
                    label="Password *"
                    type="password"
                    placeholder="Min 8 characters"
                    error={adminMethods.formState.errors.password?.message}
                    {...adminMethods.register('password')}
                    helperText="Must be at least 8 characters"
                  />
                  <Input
                    label="Confirm Password *"
                    type="password"
                    placeholder="Confirm your password"
                    error={adminMethods.formState.errors.confirmPassword?.message}
                    {...adminMethods.register('confirmPassword')}
                  />
                </div>

                <div className="flex justify-between pt-4">
                  <Button type="button" variant="secondary" size="lg" onClick={goBack}>
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </Button>
                  <Button type="submit" size="lg" loading={isSubmitting}>
                    Create Account
                    <Check className="w-4 h-4" />
                  </Button>
                </div>
              </form>
            )}
      </div>

      <p className="mt-6 shrink-0 text-center text-body-sm text-ink-500 dark:text-ink-400">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-accent-600 hover:underline dark:text-accent-400">
          Sign in
        </Link>
      </p>
    </AuthShell>
  )
}
