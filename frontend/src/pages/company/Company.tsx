import { useEffect, useState } from 'react'
import { Pencil } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { useAuth } from '@/context/AuthContext'
import { companyApi } from '@/utils/api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PlaceInput, PlaceOption } from '@/components/ui/PlaceInput'
import { PageHeader } from '@/components/ui/ListPage'
import { Panel } from '@/components/ui/Panel'
import { formatDate } from '@/utils/helpers'
import type { Company as CompanyModel } from '@/types'

const companySchema = z.object({
  companyName: z.string().min(2, 'Company name must be at least 2 characters'),
  country: z.string().min(1, 'Country is required'),
  state: z.string().min(1, 'State is required'),
  city: z.string().min(1, 'City is required'),
  industry: z.string().optional(),
})

type CompanyForm = z.infer<typeof companySchema>

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 py-3.5 sm:grid-cols-[11rem_1fr] sm:gap-6">
      <dt className="text-body-sm font-semibold text-ink-600 dark:text-ink-400">{label}</dt>
      <dd className="text-body-md text-ink-900 dark:text-ink-100">{children}</dd>
    </div>
  )
}

export function Company() {
  const { user, hasRole } = useAuth()
  const isAdmin = hasRole(['ADMIN'])
  const [company, setCompany] = useState<CompanyModel | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<CompanyForm>({ resolver: zodResolver(companySchema) })

  const country = watch('country') ?? ''
  const state = watch('state') ?? ''
  const city = watch('city') ?? ''
  const [countryCode, setCountryCode] = useState<string | undefined>()
  const [stateId, setStateId] = useState<string | undefined>()

  // Country narrows the state list and state narrows the city list, so changing one clears what depends on it.
  const pickCountry = (p: PlaceOption | null) => {
    setCountryCode(p?.countryCode)
    setStateId(undefined)
    setValue('country', p?.name ?? '', { shouldValidate: true })
    setValue('state', '')
    setValue('city', '')
  }
  const pickState = (p: PlaceOption | null) => {
    setStateId(p?.placeId)
    setValue('state', p?.name ?? '', { shouldValidate: true })
    setValue('city', '')
  }

  const fill = (c: CompanyModel) =>
    reset({ companyName: c.companyName, country: c.country, state: c.state, city: c.city, industry: c.industry || '' })

  useEffect(() => {
    // Only admins can read the company profile (/admin/company).
    if (!user?.companyId || !isAdmin) {
      setIsLoading(false)
      return
    }
    companyApi
      .getForAdmin()
      .then((res) => {
        setCompany(res.data)
        fill(res.data)
      })
      .catch((error) => console.error('Failed to fetch company:', error))
      .finally(() => setIsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.companyId, isAdmin])

  const onSubmit = async (data: CompanyForm) => {
    setIsSaving(true)
    try {
      await companyApi.updateForAdmin({ ...data })
      const res = await companyApi.getForAdmin()
      setCompany(res.data)
      fill(res.data)
      setIsEditing(false)
      toast.success('Company details saved')
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : 'Could not save the company details')
    } finally {
      setIsSaving(false)
    }
  }

  const cancel = () => {
    if (company) fill(company)
    setIsEditing(false)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader title="Company" subtitle="How your company appears across NexHire." />

      {isLoading ? (
        <div className="h-72 animate-pulse rounded-xl bg-base-100 dark:bg-surface-dark-elevated" aria-busy="true" aria-label="Loading company" />
      ) : !company ? (
        <div className="surface rounded-xl p-8 text-center">
          <p className="font-display text-heading-sm font-semibold text-ink-900 dark:text-ink-100">
            {isAdmin ? 'Company details could not be loaded' : 'Only admins can see company details'}
          </p>
          <p className="mt-1 text-body-sm text-ink-600 dark:text-ink-400">
            {isAdmin ? 'Check that the backend is running, then reload the page.' : 'Ask an admin if you need something changed.'}
          </p>
        </div>
      ) : (
        <Panel
          title={company.companyName}
          action={
            isAdmin &&
            !isEditing && (
              <Button variant="secondary" size="sm" onClick={() => setIsEditing(true)}>
                <Pencil className="h-4 w-4" aria-hidden="true" />
                Edit
              </Button>
            )
          }
        >
          {isEditing ? (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <Input label="Company name *" error={errors.companyName?.message} {...register('companyName')} />
                <Input label="Industry" placeholder="Technology, healthcare, finance" error={errors.industry?.message} {...register('industry')} />
              </div>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                <PlaceInput label="Country" kind="country" required value={country} onChange={pickCountry} error={errors.country?.message} />
                <PlaceInput label="State" kind="state" required value={state} countryCode={countryCode} onChange={pickState} error={errors.state?.message} />
                <PlaceInput
                  label="City"
                  kind="city"
                  required
                  value={city}
                  countryCode={countryCode}
                  stateId={stateId}
                  onChange={(p) => setValue('city', p?.name ?? '', { shouldValidate: true })}
                  error={errors.city?.message}
                />
              </div>
              <div className="flex justify-end gap-3 border-t border-[var(--color-border)] pt-5">
                <Button type="button" variant="ghost" onClick={cancel}>Cancel</Button>
                <Button type="submit" loading={isSaving}>Save changes</Button>
              </div>
            </form>
          ) : (
            <dl className="-my-3.5 divide-y divide-[var(--color-border)]">
              <Row label="Industry">{company.industry || 'Not set'}</Row>
              <Row label="Location">{[company.city, company.state, company.country].filter(Boolean).join(', ')}</Row>
              <Row label="GST number">{company.gstNumber}</Row>
              <Row label="Verification">
                {company.companyVerified ? (
                  <span className="badge-success">Verified</span>
                ) : (
                  <span className="badge-warning">Pending verification</span>
                )}
              </Row>
              <Row label="Registered">{formatDate(company.createdAt)}</Row>
            </dl>
          )}
        </Panel>
      )}
    </div>
  )
}
