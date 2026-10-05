import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { companyApi } from '@/utils/api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardFooter } from '@/components/ui/Card'
import { ArrowLeft, ArrowRight, Check, Building2 } from 'lucide-react'
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

const countries = [
  { value: 'India', label: 'India' },
  { value: 'USA', label: 'United States' },
  { value: 'UK', label: 'United Kingdom' },
  { value: 'Canada', label: 'Canada' },
  { value: 'Australia', label: 'Australia' },
  { value: 'Germany', label: 'Germany' },
  { value: 'Singapore', label: 'Singapore' },
  { value: 'Other', label: 'Other' },
]

const indianStates = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh',
  'Uttarakhand', 'West Bengal'
]

export function Register() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [companyData, setCompanyData] = useState<Partial<CompanyForm>>({})

  const companyMethods = useForm<CompanyForm>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      country: 'India',
    },
  })

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
    <div className="min-h-screen bg-base-100 dark:bg-base-950 flex items-center justify-center p-8">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <Link to="/login" className="inline-flex items-center gap-2 text-ink-500 hover:text-ink-700 dark:text-ink-400 dark:hover:text-ink-300 transition-colors mb-8">
            <ArrowLeft className="w-5 h-5" />
            <span className="text-body-md">Back to Login</span>
          </Link>
        </div>

        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-accent-600 flex items-center justify-center mx-auto mb-6">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-display-md font-bold text-ink-900 dark:text-ink-100">Create Your Account</h1>
          <p className="text-body-md text-ink-500 dark:text-ink-400 mt-2">
            {steps[currentStep].description}
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((step, index) => (
            <div key={step.number} className="flex items-center gap-2">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all',
                index < currentStep ? 'bg-accent-500 text-white' : index === currentStep ? 'bg-accent-500 text-white' : 'bg-base-200 dark:bg-base-700 text-ink-400 dark:text-ink-500'
              )}>
                {index < currentStep ? <Check className="w-5 h-5" /> : step.number}
              </div>
              {index < steps.length - 1 && <div className={cn('w-12 h-0.5', index < currentStep ? 'bg-accent-500' : 'bg-base-200 dark:bg-base-700')} />}
            </div>
          ))}
        </div>
        <Card variant="flat" padding="lg">
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="w-full">
                      <label className="label">Country *</label>
                      <select
                        {...companyMethods.register('country')}
                        className={cn(companyMethods.formState.errors.country ? 'input-error' : 'input', 'w-full')}
                        aria-invalid={companyMethods.formState.errors.country ? 'true' : 'false'}
                      >
                        <option value="" disabled>
                          Select country
                        </option>
                        {countries.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      {companyMethods.formState.errors.country && (
                        <p className="mt-1.5 text-body-xs text-error-600 dark:text-error-400" role="alert">
                          {companyMethods.formState.errors.country.message}
                        </p>
                      )}
                    </div>
                    <Input
                      label="State *"
                      placeholder="e.g., Maharashtra"
                      error={companyMethods.formState.errors.state?.message}
                      {...companyMethods.register('state')}
                      list="states-list"
                    />
                  </div>
                  <datalist id="states-list">
                    {indianStates.map(state => <option key={state} value={state} />)}
                  </datalist>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <Input
                      label="City *"
                      placeholder="e.g., Mumbai"
                      error={companyMethods.formState.errors.city?.message}
                      {...companyMethods.register('city')}
                    />
                    <Input
                      label="GST Number *"
                      placeholder="e.g., 27AAAAA0000A1Z5"
                      error={companyMethods.formState.errors.gstNumber?.message}
                      {...companyMethods.register('gstNumber')}
                    />
                  </div>
                </div>

                <CardFooter className="flex justify-end pt-6">
                  <Button type="submit" size="lg" loading={isSubmitting}>
                    Next
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </CardFooter>
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

                <CardFooter className="flex justify-between pt-6">
                  <Button type="button" variant="secondary" size="lg" onClick={goBack}>
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </Button>
                  <Button type="submit" size="lg" loading={isSubmitting}>
                    Create Account
                    <Check className="w-4 h-4" />
                  </Button>
                </CardFooter>
              </form>
            )}
          </Card>

        <p className="text-center text-body-sm text-ink-500 dark:text-ink-400 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-accent-600 dark:text-accent-400 hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}