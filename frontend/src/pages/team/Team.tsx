import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { userApi } from '@/utils/api'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Input'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/Table'
import { StatusBadge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { Trash2, Search, UserPlus, UserCheck, UserX, Shield, AlertCircle } from 'lucide-react'
import { formatDate, cn } from '@/utils/helpers'
import type { User, Role } from '@/types'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'

const createRecruiterSchema = z.object({
  userName: z.string().min(2, 'Username must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phoneNumber: z.string().min(10, 'Phone number must be at least 10 digits'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

type CreateRecruiterForm = z.infer<typeof createRecruiterSchema>

const roleOptions = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'RECRUITER', label: 'Recruiter' },
]

export function Team() {
  const { user, hasRole } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<Role | ''>('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [fetchError, setFetchError] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CreateRecruiterForm>({
    resolver: zodResolver(createRecruiterSchema),
  })

  useEffect(() => {
    const fetchUsers = async () => {
      setIsLoading(true)
      try {
        // Use admin-specific endpoint for admins
        if (hasRole(['ADMIN'])) {
          const response = await userApi.getRecruitersForAdmin()
          setUsers(response.data)
        } else {
          const response = await userApi.getAll({ pageSize: 100 })
          setUsers(response.data)
        }
        setFetchError(false)
      } catch (error) {
        console.error('Failed to fetch users:', error)
        setFetchError(true)
      } finally {
        setIsLoading(false)
      }
    }
    fetchUsers()
  }, [hasRole])

  const openCreateModal = () => {
    reset()
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
  }

  const onSubmit = async (data: CreateRecruiterForm) => {
    setIsSubmitting(true)
    try {
      await userApi.createRecruiter(data)
      toast.success('Recruiter created successfully')
      closeModal()
      // Use admin endpoint for admins
      if (hasRole(['ADMIN'])) {
        const response = await userApi.getRecruitersForAdmin()
        setUsers(response.data)
      } else {
        const response = await userApi.getAll({ pageSize: 100 })
        setUsers(response.data)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create recruiter'
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleStatus = async (userId: string, currentStatus: boolean) => {
    try {
      await userApi.update(userId, { active: !currentStatus } as Partial<User>)
      toast.success(`User ${!currentStatus ? 'activated' : 'deactivated'}`)
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, active: !currentStatus } : u))
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update user status'
      toast.error(message)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return
    try {
      await userApi.delete(id)
      toast.success('User deleted successfully')
      setUsers((prev) => prev.filter((u) => u.id !== id))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete user'
      toast.error(message)
    }
  }

  const filteredUsers = users
    .filter((u) => u.id !== user?.id)
    .filter((u) =>
      u.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .filter((u) => !roleFilter || u.role === roleFilter)

  const adminCount = users.filter((u) => u.role === 'ADMIN').length
  const recruiterCount = users.filter((u) => u.role === 'RECRUITER').length

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-display-md font-bold text-ink-900 dark:text-ink-100">Team</h1>
            <p className="text-body-md text-ink-500 dark:text-ink-400 mt-1">Manage your recruitment team members</p>
          </div>
          <Button variant="secondary" disabled>
            <UserPlus className="w-4 h-4 mr-2" />
            Invite Member
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

  if (fetchError) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-display-md font-bold text-ink-900 dark:text-ink-100">Team</h1>
            <p className="text-body-md text-ink-500 dark:text-ink-400 mt-1">Manage your recruitment team members</p>
          </div>
          {hasRole(['ADMIN']) && (
            <Button onClick={openCreateModal} size="lg">
              <UserPlus className="w-5 h-5" />
              Invite Recruiter
            </Button>
          )}
        </div>

        <Card variant="flat" padding="lg" className="border-warning-200 dark:border-warning-800 bg-warning-50 dark:bg-warning-900/20">
          <div className="flex items-start gap-4">
            <AlertCircle className="w-6 h-6 text-warning-600 dark:text-warning-400 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-heading-md font-medium text-warning-800 dark:text-warning-200">Team listing unavailable</h3>
              <p className="text-body-md text-warning-700 dark:text-warning-300 mt-2">
                The team member list requires the <code className="bg-warning-100 dark:bg-warning-800 px-1.5 rounded text-sm">/api/users</code> backend endpoint which is not yet implemented.
              </p>
              <p className="text-body-sm text-warning-600 dark:text-warning-400 mt-2">
                You can still invite new recruiters using the button above. The invited recruiters will appear here once the backend endpoint is available.
              </p>
            </div>
          </div>
        </Card>

        <Modal isOpen={isModalOpen} onClose={closeModal} title="Invite Recruiter" size="md">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <Card padding="lg">
              <CardHeader>
                <CardTitle>Recruiter Information</CardTitle>
                <CardDescription>Enter the recruiter's details. They will receive an email to set up their account.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <Input
                  label="Username *"
                  placeholder="e.g., jane_recruiter"
                  error={errors.userName?.message}
                  {...register('userName')}
                />
                <Input
                  label="Email *"
                  type="email"
                  placeholder="e.g., jane@company.com"
                  error={errors.email?.message}
                  {...register('email')}
                />
                <Input
                  label="Phone Number *"
                  type="tel"
                  placeholder="e.g., +91 9876543210"
                  error={errors.phoneNumber?.message}
                  {...register('phoneNumber')}
                />
                <Input
                  label="Temporary Password *"
                  type="password"
                  placeholder="Min 8 characters"
                  error={errors.password?.message}
                  {...register('password')}
                  helperText="Recruiter will be prompted to change this on first login"
                />
              </CardContent>
            </Card>

            <CardFooter className="flex flex-col sm:flex-row justify-end gap-3">
              <Button type="button" variant="ghost" onClick={closeModal}>Cancel</Button>
              <Button type="submit" size="lg" loading={isSubmitting}>
                Invite Recruiter
              </Button>
            </CardFooter>
          </form>
        </Modal>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-display-md font-bold text-ink-900 dark:text-ink-100">Team</h1>
          <p className="text-body-md text-ink-500 dark:text-ink-400 mt-1">Manage your recruitment team members</p>
        </div>
        {hasRole(['ADMIN']) && (
          <Button onClick={openCreateModal} size="lg">
            <UserPlus className="w-5 h-5" />
            Invite Recruiter
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card hover variant="elevated" padding="md">
          <CardContent className="flex items-start justify-between">
            <div>
              <p className="text-body-sm text-ink-500 dark:text-ink-400">Total Members</p>
              <p className="text-display-sm font-bold text-ink-900 dark:text-ink-100 mt-1">{users.length}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-accent-100 dark:bg-accent-900/30 flex items-center justify-center">
              <UserPlus className="w-6 h-6 text-accent-600 dark:text-accent-400" />
            </div>
          </CardContent>
        </Card>
        <Card hover variant="elevated" padding="md">
          <CardContent className="flex items-start justify-between">
            <div>
              <p className="text-body-sm text-ink-500 dark:text-ink-400">Admins</p>
              <p className="text-display-sm font-bold text-ink-900 dark:text-ink-100 mt-1">{adminCount}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <Shield className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            </div>
          </CardContent>
        </Card>
        <Card hover variant="elevated" padding="md">
          <CardContent className="flex items-start justify-between">
            <div>
              <p className="text-body-sm text-ink-500 dark:text-ink-400">Recruiters</p>
              <p className="text-display-sm font-bold text-ink-900 dark:text-ink-100 mt-1">{recruiterCount}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-info-100 dark:bg-info-900/30 flex items-center justify-center">
              <UserCheck className="w-6 h-6 text-info-600 dark:text-info-400" />
            </div>
          </CardContent>
        </Card>
        <Card hover variant="elevated" padding="md">
          <CardContent className="flex items-start justify-between">
            <div>
              <p className="text-body-sm text-ink-500 dark:text-ink-400">Pending Invites</p>
              <p className="text-display-sm font-bold text-ink-900 dark:text-ink-100 mt-1">0</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-warning-100 dark:bg-warning-900/30 flex items-center justify-center">
              <UserX className="w-6 h-6 text-warning-600 dark:text-warning-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card padding="md" className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-400" />
            <Input
              placeholder="Search team members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select
            label="Role"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as Role | '')}
            options={roleOptions}
            placeholder="All Roles"
            className="w-full sm:w-48"
          />
        </div>
      </Card>

      <Card variant="flat" padding="none">
        {filteredUsers.length === 0 ? (
          <EmptyState
            icon={<UserPlus className="w-16 h-16" />}
            title={searchQuery || roleFilter ? 'No team members found' : 'No team members yet'}
            description={searchQuery || roleFilter ? 'Try adjusting your filters' : 'Invite recruiters to join your team'}
            action={hasRole(['ADMIN']) ? { label: 'Invite Recruiter', onClick: openCreateModal } : undefined}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead style={{ width: '30%' }}>Member</TableHead>
                    <TableHead style={{ width: '25%' }}>Email</TableHead>
                    <TableHead style={{ width: '15%' }}>Role</TableHead>
                    <TableHead style={{ width: '15%' }}>Status</TableHead>
                    <TableHead style={{ width: '15%' }}>Joined</TableHead>
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-accent-100 dark:bg-accent-900/30 flex items-center justify-center">
                            <span className="text-label-sm font-medium text-accent-600 dark:text-accent-400">
                              {member.userName.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-ink-900 dark:text-ink-100">{member.userName}</p>
                            <p className="text-body-xs text-ink-500 dark:text-ink-400">{member.phoneNumber}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><span className="text-body-sm text-ink-500 dark:text-ink-400">{member.email}</span></TableCell>
                      <TableCell>
                        <StatusBadge status={member.role} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            'w-2 h-2 rounded-full',
                            member.active ? 'bg-success-500' : 'bg-base-400 dark:bg-base-600'
                          )} />
                          <span className="text-body-sm text-ink-600 dark:text-ink-400">
                            {member.active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell><span className="text-body-sm text-ink-500 dark:text-ink-400">{formatDate(member.createdAt)}</span></TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleStatus(member.id, member.active)}
                            title={member.active ? 'Deactivate' : 'Activate'}
                          >
                            {member.active ? (
                              <UserX className="w-4 h-4" />
                            ) : (
                              <UserCheck className="w-4 h-4" />
                            )}
                          </Button>
                          {hasRole(['ADMIN']) && member.id !== user?.id && (
                            <Button variant="ghost" size="sm" className="text-error-500" onClick={() => handleDelete(member.id)} title="Delete">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
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

      <Modal isOpen={isModalOpen} onClose={closeModal} title="Invite Recruiter" size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <Card padding="lg">
            <CardHeader>
              <CardTitle>Recruiter Information</CardTitle>
              <CardDescription>Enter the recruiter's details. They will receive an email to set up their account.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <Input
                label="Username *"
                placeholder="e.g., jane_recruiter"
                error={errors.userName?.message}
                {...register('userName')}
              />
              <Input
                label="Email *"
                type="email"
                placeholder="e.g., jane@company.com"
                error={errors.email?.message}
                {...register('email')}
              />
              <Input
                label="Phone Number *"
                type="tel"
                placeholder="e.g., +91 9876543210"
                error={errors.phoneNumber?.message}
                {...register('phoneNumber')}
              />
              <Input
                label="Temporary Password *"
                type="password"
                placeholder="Min 8 characters"
                error={errors.password?.message}
                {...register('password')}
                helperText="Recruiter will be prompted to change this on first login"
              />
            </CardContent>
          </Card>

          <CardFooter className="flex flex-col sm:flex-row justify-end gap-3">
            <Button type="button" variant="ghost" onClick={closeModal}>Cancel</Button>
            <Button type="submit" size="lg" loading={isSubmitting}>
              Invite Recruiter
            </Button>
          </CardFooter>
        </form>
      </Modal>
    </div>
  )
}