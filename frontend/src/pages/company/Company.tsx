import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { companyApi } from '@/utils/api'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Building2, Edit, MapPin, Mail, Phone, Globe, BadgeCheck, Save } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import type { Company } from '@/types'

const companySchema = z.object({
  companyName: z.string().min(2, 'Company name must be at least 2 characters'),
  country: z.string().min(1, 'Country is required'),
  state: z.string().min(1, 'State is required'),
  city: z.string().min(1, 'City is required'),
  industry: z.string().optional(),
  companyEmail: z.string().email('Invalid email address').optional().or(z.literal('')),
  phoneNumber: z.string().optional(),
  address: z.string().optional(),
})

type CompanyForm = z.infer<typeof companySchema>

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

export function Company() {
  const { user, hasRole } = useAuth()
  const [company, setCompany] = useState<Company | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CompanyForm>({
    resolver: zodResolver(companySchema),
  })

  useEffect(() => {
    const fetchCompany = async () => {
      if (!user?.companyId) {
        setIsLoading(false)
        return
      }
      try {
        // Use the admin-specific endpoint for admins
        if (hasRole(['ADMIN'])) {
          const response = await companyApi.getForAdmin()
          const companyData = response.data
          setCompany(companyData)
          reset({
            companyName: companyData.companyName,
            country: companyData.country,
            state: companyData.state,
            city: companyData.city,
            industry: companyData.industry || '',
          })
        } else {
          const response = await companyApi.getById(user.companyId)
          setCompany(response)
          reset({
            companyName: response.companyName,
            country: response.country,
            state: response.state,
            city: response.city,
            industry: response.industry || '',
          })
        }
      } catch (error) {
        console.error('Failed to fetch company:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchCompany()
  }, [user?.companyId, hasRole])

  const onSubmit = async (data: CompanyForm) => {
    if (!company) return
    setIsSaving(true)
    try {
      // Use the admin-specific endpoint for admins
      if (hasRole(['ADMIN'])) {
        await companyApi.updateForAdmin({
          companyName: data.companyName,
          country: data.country,
          state: data.state,
          city: data.city,
          industry: data.industry,
        })
      } else {
        await companyApi.update(company.id, data)
      }
      toast.success('Company profile updated successfully')
      setIsEditing(false)
      // Refetch company data
      if (hasRole(['ADMIN'])) {
        const response = await companyApi.getForAdmin()
        setCompany(response.data)
      } else {
        const response = await companyApi.getById(company.id)
        setCompany(response)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update company'
      toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  const toggleEdit = () => {
    if (isEditing) {
      reset({
        companyName: company?.companyName || '',
        country: company?.country || 'India',
        state: company?.state || '',
        city: company?.city || '',
        industry: company?.industry || '',
      })
    }
    setIsEditing(!isEditing)
  }

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-display-md font-bold text-ink-900 dark:text-ink-100">Company Settings</h1>
          <p className="text-body-md text-ink-500 dark:text-ink-400 mt-1">Manage your company profile and settings</p>
        </div>
        <Card padding="lg" className="animate-pulse">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-accent-100 dark:bg-accent-900/30 flex items-center justify-center">
                <Building2 className="w-8 h-8 text-accent-600 dark:text-accent-400" />
              </div>
              <div>
                <div className="h-6 bg-base-200 dark:bg-base-700 rounded w-1/4" />
                <div className="h-4 bg-base-200 dark:bg-base-700 rounded w-1/2 mt-1" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3 p-4 bg-base-50 dark:bg-base-800/50 rounded-xl">
                  <div className="w-10 h-10 rounded-lg bg-base-200 dark:bg-base-700" />
                  <div>
                    <div className="h-3 bg-base-200 dark:bg-base-700 rounded w-1/4" />
                    <div className="h-5 bg-base-200 dark:bg-base-700 rounded w-1/2 mt-1" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-display-md font-bold text-ink-900 dark:text-ink-100">Company Settings</h1>
        <p className="text-body-md text-ink-500 dark:text-ink-400 mt-1">Manage your company profile and settings</p>
      </div>

      <Card padding="lg">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-accent-100 dark:bg-accent-900/30 flex items-center justify-center">
              <Building2 className="w-8 h-8 text-accent-600 dark:text-accent-400" />
            </div>
            <div>
              <CardTitle>Your Company</CardTitle>
              <CardDescription>Company profile information</CardDescription>
            </div>
          </div>
          {hasRole(['ADMIN']) && (
            <Button variant="secondary" onClick={toggleEdit}>
              {isEditing ? (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              ) : (
                <>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Profile
                </>
              )}
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {isEditing ? (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Company Name *"
                  placeholder="e.g., Acme Corporation"
                  error={errors.companyName?.message}
                  {...register('companyName')}
                />
                <Input
                  label="Industry"
                  placeholder="e.g., Technology, Healthcare, Finance"
                  error={errors.industry?.message}
                  {...register('industry')}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="w-full">
                  <label className="label">Country *</label>
                  <select
                    {...register('country')}
                    className={errors.country ? 'input-error' : 'input w-full'}
                    aria-invalid={errors.country ? 'true' : 'false'}
                  >
                    <option value="" disabled>Select country</option>
                    {countries.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  {errors.country && (
                    <p className="mt-1.5 text-body-xs text-error-600 dark:text-error-400" role="alert">{errors.country.message}</p>
                  )}
                </div>
                <Input
                  label="State *"
                  placeholder="e.g., Maharashtra"
                  error={errors.state?.message}
                  {...register('state')}
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
                  error={errors.city?.message}
                  {...register('city')}
                />
              </div>
              <CardFooter className="flex justify-end pt-6">
                <Button type="button" variant="ghost" onClick={toggleEdit}>Cancel</Button>
                <Button type="submit" size="lg" loading={isSaving}>
                  Save Changes
                </Button>
              </CardFooter>
            </form>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-4 bg-base-50 dark:bg-base-800/50 rounded-xl">
                  <div className="w-10 h-10 rounded-lg bg-info-100 dark:bg-info-900/30 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-info-600 dark:text-info-400" />
                  </div>
                  <div>
                    <p className="text-body-xs text-ink-500 dark:text-ink-400">Company Name</p>
                    <p className="text-body-md font-medium text-ink-900 dark:text-ink-100">{company?.companyName || 'Not configured'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-base-50 dark:bg-base-800/50 rounded-xl">
                  <div className="w-10 h-10 rounded-lg bg-success-100 dark:bg-success-900/30 flex items-center justify-center">
                    <BadgeCheck className="w-5 h-5 text-success-600 dark:text-success-400" />
                  </div>
                  <div>
                    <p className="text-body-xs text-ink-500 dark:text-ink-400">Verification Status</p>
                    <p className="text-body-md font-medium text-warning-600 dark:text-warning-400">{company?.companyVerified ? 'Verified' : 'Pending Verification'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-base-50 dark:bg-base-800/50 rounded-xl">
                  <div className="w-10 h-10 rounded-lg bg-accent-100 dark:bg-accent-900/30 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-accent-600 dark:text-accent-400" />
                  </div>
                  <div>
                    <p className="text-body-xs text-ink-500 dark:text-ink-400">Location</p>
                    <p className="text-body-md font-medium text-ink-900 dark:text-ink-100">{company?.city}, {company?.state}, {company?.country}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-base-50 dark:bg-base-800/50 rounded-xl">
                  <div className="w-10 h-10 rounded-lg bg-warning-100 dark:bg-warning-900/30 flex items-center justify-center">
                    <Globe className="w-5 h-5 text-warning-600 dark:text-warning-400" />
                  </div>
                  <div>
                    <p className="text-body-xs text-ink-500 dark:text-ink-400">Industry</p>
                    <p className="text-body-md font-medium text-ink-900 dark:text-ink-100">{company?.industry || 'Not configured'}</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card padding="lg">
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
          <CardDescription>Update your company contact details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isEditing ? (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Company Email"
                  type="email"
                  placeholder="company@example.com"
                  icon={<Mail className="w-5 h-5" />}
                  error={errors.companyEmail?.message}
                  {...register('companyEmail')}
                />
                <Input
                  label="Phone Number"
                  type="tel"
                  placeholder="+91 98765 43210"
                  icon={<Phone className="w-5 h-5" />}
                  error={errors.phoneNumber?.message}
                  {...register('phoneNumber')}
                />
              </div>
              <Input
                label="Address"
                placeholder="123 Business St, City, State"
                icon={<MapPin className="w-5 h-5" />}
                error={errors.address?.message}
                {...register('address')}
              />
              <CardFooter className="flex justify-end pt-6">
                <Button type="submit" size="lg" loading={isSaving}>
                  Save Changes
                </Button>
              </CardFooter>
            </form>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-4 bg-base-50 dark:bg-base-800/50 rounded-xl">
                  <div className="w-10 h-10 rounded-lg bg-info-100 dark:bg-info-900/30 flex items-center justify-center">
                    <Mail className="w-5 h-5 text-info-600 dark:text-info-400" />
                  </div>
                  <div>
                    <p className="text-body-xs text-ink-500 dark:text-ink-400">Company Email</p>
                    <p className="text-body-md font-medium text-ink-900 dark:text-ink-100">Not configured</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-base-50 dark:bg-base-800/50 rounded-xl">
                  <div className="w-10 h-10 rounded-lg bg-success-100 dark:bg-success-900/30 flex items-center justify-center">
                    <Phone className="w-5 h-5 text-success-600 dark:text-success-400" />
                  </div>
                  <div>
                    <p className="text-body-xs text-ink-500 dark:text-ink-400">Phone Number</p>
                    <p className="text-body-md font-medium text-ink-900 dark:text-ink-100">Not configured</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-base-50 dark:bg-base-800/50 rounded-xl">
                <div className="w-10 h-10 rounded-lg bg-accent-100 dark:bg-accent-900/30 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-accent-600 dark:text-accent-400" />
                </div>
                <div>
                  <p className="text-body-xs text-ink-500 dark:text-ink-400">Address</p>
                  <p className="text-body-md font-medium text-ink-900 dark:text-ink-100">Not configured</p>
                </div>
              </div>
              {hasRole(['ADMIN']) && (
                <Button variant="secondary" onClick={toggleEdit} className="mt-4">
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Contact Info
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card padding="lg" variant="flat">
        <CardHeader>
          <CardTitle>Danger Zone</CardTitle>
          <CardDescription>Irreversible actions</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="danger">Delete Company Account</Button>
        </CardContent>
      </Card>
    </div>
  )
}