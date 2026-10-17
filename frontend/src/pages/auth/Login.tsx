import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { AuthShell } from '@/components/auth/AuthShell'
import { AlertCircle, Eye, EyeOff, Lock, Mail } from 'lucide-react'

export function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({})
  const [showPassword, setShowPassword] = useState(false)

  const validateForm = () => {
    const newErrors: typeof errors = {}
    if (!email) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Invalid email format'
    }
    if (!password) {
      newErrors.password = 'Password is required'
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    setIsLoading(true)
    setErrors({})

    try {
      await login(email, password)
      toast.success('Welcome back!')
      navigate('/dashboard')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid credentials'
      setErrors({ general: message })
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthShell footer={<span>Demo credentials: admin@abctech.com / Admin@123</span>}>
      <h1 className="text-display-sm font-bold text-ink-900 dark:text-ink-100">
        Welcome back
      </h1>
      <p className="mt-2 text-body-md text-ink-600 dark:text-ink-400">
        Sign in to manage jobs, candidates and interviews.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
        {errors.general && (
          <div role="alert" className="flex items-center gap-2 rounded-lg border border-error-200 bg-error-50 p-3 dark:border-error-800/70 dark:bg-error-900/30">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-error-500" aria-hidden="true" />
            <p className="text-body-sm text-error-600 dark:text-error-400">{errors.general}</p>
          </div>
        )}

        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          placeholder="you@company.com"
          autoComplete="email"
          icon={<Mail className="h-5 w-5" aria-hidden="true" />}
          className="h-12"
        />

        <div className="relative">
          <Input
            label="Password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            placeholder="Enter your password"
            autoComplete="current-password"
            icon={<Lock className="h-5 w-5" aria-hidden="true" />}
            className="h-12 pr-12"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-2 top-[34px] flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-base-100 hover:text-ink-700 dark:hover:bg-white/10"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>

        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-body-sm font-semibold text-brand-700 hover:text-brand-700 dark:text-brand-300">
            Forgot password?
          </Link>
        </div>

        <Button type="submit" className="h-12 w-full" size="lg" loading={isLoading}>
          Sign in
        </Button>
      </form>

      <p className="mt-8 text-center text-body-sm text-ink-600 dark:text-ink-400">
        New to NexHire?{' '}
        <Link to="/register" className="font-semibold text-accent-600 hover:underline dark:text-accent-400">
          Register your company
        </Link>
      </p>
    </AuthShell>
  )
}
