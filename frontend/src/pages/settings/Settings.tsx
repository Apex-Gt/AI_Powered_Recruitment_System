import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { userApi } from '@/utils/api'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { User, Shield, Bell, Palette, Key, Moon, Sun, Globe, Save } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import type { User as UserType } from '@/types'

const profileSchema = z.object({
  userName: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phoneNumber: z.string().optional(),
})

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

type ProfileForm = z.infer<typeof profileSchema>
type PasswordForm = z.infer<typeof passwordSchema>

export function Settings() {
  const { user, refreshUser } = useAuth()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const profileMethods = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
  })

  const passwordMethods = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
  })

  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    newApplications: true,
    interviewReminders: true,
    statusUpdates: false,
    weeklyDigest: false,
  })

  const [theme, setThemeState] = useState<'light' | 'dark' | 'system'>('system')
  const [language, setLanguage] = useState<'en' | 'hi'>('en')

  useEffect(() => {
    if (user) {
      profileMethods.reset({
        userName: user.userName,
        email: user.email,
        phoneNumber: user.phoneNumber,
      })
      setIsLoading(false)
    }
  }, [user])

  const handleProfileSubmit = async (data: ProfileForm) => {
    if (!user) return
    setIsSaving(true)
    try {
      await userApi.updateMe(data)
      toast.success('Profile updated successfully')
      await refreshUser()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update profile'
      toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  const handlePasswordSubmit = async (data: PasswordForm) => {
    setIsSaving(true)
    try {
      await userApi.updateMe({
        password: data.newPassword,
      } as Partial<UserType>)
      toast.success('Password updated successfully')
      passwordMethods.reset()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update password'
      toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleNotificationChange = (key: keyof typeof notifications, value: boolean) => {
    setNotifications((prev) => ({ ...prev, [key]: value }))
  }

  const handleSaveNotifications = async () => {
    setIsSaving(true)
    try {
      await new Promise((resolve) => setTimeout(resolve, 500))
      toast.success('Notification preferences saved')
    } catch (error) {
      toast.error('Failed to save preferences')
    } finally {
      setIsSaving(false)
    }
  }

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setThemeState(newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
    localStorage.setItem('theme', newTheme)
  }

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-display-md font-bold text-ink-900 dark:text-ink-100">Settings</h1>
          <p className="text-body-md text-ink-500 dark:text-ink-400 mt-1">Manage your account and preferences</p>
        </div>
        <Tabs defaultValue="profile" className="space-y-6 animate-pulse">
          <TabsList>
            <TabsTrigger value="profile"><User className="w-4 h-4 mr-2" />Profile</TabsTrigger>
            <TabsTrigger value="security"><Shield className="w-4 h-4 mr-2" />Security</TabsTrigger>
            <TabsTrigger value="notifications"><Bell className="w-4 h-4 mr-2" />Notifications</TabsTrigger>
            <TabsTrigger value="appearance"><Palette className="w-4 h-4 mr-2" />Appearance</TabsTrigger>
          </TabsList>
          <TabsContent value="profile">
            <Card padding="lg">
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Update your personal information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="Full Name" placeholder="John Doe" disabled />
                  <Input label="Username" placeholder="johndoe" disabled />
                </div>
                <Input label="Email" type="email" placeholder="john@example.com" disabled />
                <Input label="Phone Number" type="tel" placeholder="+91 98765 43210" disabled />
                <Button variant="primary" disabled>Save Changes</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-display-md font-bold text-ink-900 dark:text-ink-100">Settings</h1>
        <p className="text-body-md text-ink-500 dark:text-ink-400 mt-1">Manage your account and preferences</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile">
            <User className="w-4 h-4 mr-2" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="w-4 h-4 mr-2" />
            Security
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="w-4 h-4 mr-2" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="appearance">
            <Palette className="w-4 h-4 mr-2" />
            Appearance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <form onSubmit={profileMethods.handleSubmit(handleProfileSubmit)} className="space-y-6">
            <Card padding="lg">
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Update your personal information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Full Name *"
                    placeholder="John Doe"
                    error={profileMethods.formState.errors.userName?.message}
                    {...profileMethods.register('userName')}
                  />
                  <Input
                    label="Username *"
                    placeholder="johndoe"
                    error={profileMethods.formState.errors.userName?.message}
                    {...profileMethods.register('userName')}
                  />
                </div>
                <Input
                  label="Email *"
                  type="email"
                  placeholder="john@example.com"
                  error={profileMethods.formState.errors.email?.message}
                  {...profileMethods.register('email')}
                />
                <Input
                  label="Phone Number"
                  type="tel"
                  placeholder="+91 98765 43210"
                  error={profileMethods.formState.errors.phoneNumber?.message}
                  {...profileMethods.register('phoneNumber')}
                />
                <CardFooter className="flex justify-end pt-6">
                  <Button type="submit" size="lg" loading={isSaving}>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </Button>
                </CardFooter>
              </CardContent>
            </Card>
          </form>
        </TabsContent>

        <TabsContent value="security">
          <Card padding="lg">
            <CardHeader>
              <CardTitle>Password & Security</CardTitle>
              <CardDescription>Manage your password and security settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={passwordMethods.handleSubmit(handlePasswordSubmit)} className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-heading-sm font-medium text-ink-900 dark:text-ink-100">Change Password</h3>
                  <div className="space-y-4">
                    <Input
                      label="Current Password *"
                      type="password"
                      placeholder="Enter current password"
                      error={passwordMethods.formState.errors.currentPassword?.message}
                      {...passwordMethods.register('currentPassword')}
                    />
                    <Input
                      label="New Password *"
                      type="password"
                      placeholder="Enter new password (min 8 characters)"
                      error={passwordMethods.formState.errors.newPassword?.message}
                      {...passwordMethods.register('newPassword')}
                    />
                    <Input
                      label="Confirm New Password *"
                      type="password"
                      placeholder="Confirm new password"
                      error={passwordMethods.formState.errors.confirmPassword?.message}
                      {...passwordMethods.register('confirmPassword')}
                    />
                    <CardFooter className="flex justify-end pt-4">
                      <Button type="submit" size="lg" loading={isSaving}>
                        <Key className="w-4 h-4 mr-2" />
                        Update Password
                      </Button>
                    </CardFooter>
                  </div>
                </div>

                <div className="pt-6 border-t border-base-200 dark:border-base-700 space-y-4">
                  <h3 className="text-heading-sm font-medium text-ink-900 dark:text-ink-100">Two-Factor Authentication</h3>
                  <p className="text-body-sm text-ink-500 dark:text-ink-400">Add an extra layer of security to your account</p>
                  <Button variant="secondary" disabled>
                    <Key className="w-4 h-4 mr-2" />
                    Enable 2FA (Coming Soon)
                  </Button>
                </div>

                <div className="pt-6 border-t border-base-200 dark:border-base-700 space-y-4">
                  <h3 className="text-heading-sm font-medium text-ink-900 dark:text-ink-100">Active Sessions</h3>
                  <p className="text-body-sm text-ink-500 dark:text-ink-400">Manage your active login sessions</p>
                  <Button variant="ghost" disabled>View Sessions (Coming Soon)</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card padding="lg">
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>Choose what notifications you receive</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { key: 'emailNotifications', title: 'Email Notifications', description: 'Receive email updates about candidates and jobs' },
                { key: 'newApplications', title: 'New Applications', description: 'Get notified when candidates apply to your jobs' },
                { key: 'interviewReminders', title: 'Interview Reminders', description: 'Reminders for upcoming interviews' },
                { key: 'statusUpdates', title: 'Status Updates', description: 'Notifications when candidate status changes' },
                { key: 'weeklyDigest', title: 'Weekly Digest', description: 'Weekly summary of recruitment activity' },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between p-4 bg-base-50 dark:bg-base-800/50 rounded-xl">
                  <div>
                    <p className="font-medium text-ink-900 dark:text-ink-100">{item.title}</p>
                    <p className="text-body-sm text-ink-500 dark:text-ink-400">{item.description}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      defaultChecked={notifications[item.key as keyof typeof notifications]}
                      onChange={(e) => handleNotificationChange(item.key as keyof typeof notifications, e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-base-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-accent-300 dark:peer-focus:ring-accent-800 rounded-full peer dark:bg-base-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-base-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-base-600 peer-checked:bg-accent-600" />
                  </label>
                </div>
              ))}
              <CardFooter className="flex justify-end pt-6">
                <Button onClick={handleSaveNotifications} size="lg" loading={isSaving}>
                  <Save className="w-4 h-4 mr-2" />
                  Save Preferences
                </Button>
              </CardFooter>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance">
          <Card padding="lg">
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>Customize how the application looks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-heading-sm font-medium text-ink-900 dark:text-ink-100">Theme</h3>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { value: 'light', label: 'Light', icon: Sun },
                    { value: 'dark', label: 'Dark', icon: Moon },
                    { value: 'system', label: 'System', icon: Globe },
                  ].map((themeOption) => (
                    <Button
                      key={themeOption.value}
                      variant={theme === themeOption.value ? 'primary' : 'ghost'}
                      className="h-24 flex flex-col gap-2"
                      onClick={() => handleThemeChange(themeOption.value as 'light' | 'dark' | 'system')}
                    >
                      <themeOption.icon className="w-8 h-8 mx-auto" />
                      <span className="text-body-md">{themeOption.label}</span>
                    </Button>
                  ))}
                </div>
              </div>
              <div className="pt-6 border-t border-base-200 dark:border-base-700 space-y-4">
                <h3 className="text-heading-sm font-medium text-ink-900 dark:text-ink-100">Language</h3>
                <Select
                  label="Language"
                  options={[
                    { value: 'en', label: 'English' },
                    { value: 'hi', label: 'Hindi' },
                  ]}
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as 'en' | 'hi')}
                  placeholder="Select language"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}