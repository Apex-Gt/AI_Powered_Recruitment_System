import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LottieLight } from 'lottie-react'
import { useAuth } from '@/context/AuthContext'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { AlertCircle, ArrowRight, Eye, EyeOff } from 'lucide-react'
import welcomeAnimation from '@/assets/lottie/welcome.json'

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
    <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center p-[2vh]">
      <div className="relative w-[97vw] max-w-[1500px] h-[95vh] rounded-[32px] overflow-hidden bg-[var(--color-surface)] border border-[var(--color-border)] shadow-card-light dark:shadow-card-dark">
        <div className="h-full flex flex-col lg:flex-row">
          <div className="relative z-10 flex-1 min-h-0 flex flex-col rounded-t-[32px] lg:rounded-l-[32px] lg:rounded-tr-none bg-accent-500 p-8 md:p-12 lg:p-14 xl:p-16 overflow-hidden">
            <div className="relative z-10 flex h-full flex-col">
              <p className="text-center text-body-sm text-white/80">
                AI-powered recruitment made simple for modern hiring teams.
              </p>

              <div className="relative flex flex-1 flex-col items-center justify-center text-center">
                <div className="absolute top-[17%] h-[300px] w-[300px] rounded-full border border-white/[0.08]" />
                <div className="absolute top-[21%] h-[210px] w-[210px] rounded-full border border-white/[0.08]" />
                <h1 className="relative z-10 max-w-[520px] text-[3.8rem] font-bold leading-[0.92] tracking-normal text-white md:text-[4.8rem] lg:text-[4.6rem] xl:text-[5.3rem]">
                  Find your next hire
                </h1>

                <div className="relative z-20 mt-6 h-[320px] w-full max-w-[500px] overflow-visible md:h-[360px] lg:mt-8 xl:h-[390px]">
                  <LottieLight
                    src={welcomeAnimation}
                    loop
                    autoplay
                    className="h-full w-full scale-125"
                    aria-hidden="true"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-20 flex flex-1 min-h-0 items-center justify-center rounded-b-[32px] bg-[var(--color-surface)] p-8 md:p-12 lg:rounded-l-none lg:rounded-r-[32px] lg:p-14 xl:p-16">

                <div className="absolute top-8 left-8 md:top-10 md:left-10 lg:top-10 lg:left-10">
                  <Link to="/" className="inline-flex">
                    <span className="text-heading-xl font-bold text-accent-600 dark:text-accent-400">
                      NexHire
                    </span>
                  </Link>
                </div>

                <div className="absolute top-8 right-8 md:top-10 md:right-10 lg:top-10 lg:right-10">
                  <Link
                    to="/register"
                    className="text-body-sm text-ink-500 dark:text-ink-400 hover:text-accent-600 dark:hover:text-accent-400 transition-colors"
                  >
                    Sign Up
                  </Link>
                </div>

                <div className="relative w-full max-w-[360px] mx-auto">
                  <div className="mb-7">
                    <h1 className="text-[3.35rem] font-semibold leading-none tracking-normal text-ink-900 dark:text-ink-100">
                      Sign In
                    </h1>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-5">
                    {errors.general && (
                      <div className="flex items-center gap-2 p-3 bg-error-50 dark:bg-error-900/30 border border-error-200 dark:border-error-800/70 rounded-[16px]">
                        <AlertCircle className="w-5 h-5 text-error-500 flex-shrink-0" />
                        <p className="text-body-sm text-error-600 dark:text-error-400">
                          {errors.general}
                        </p>
                      </div>
                    )}

                    <div className="space-y-4">
                      <Input
                        label=""
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        error={errors.email}
                        placeholder="Email or Username"
                        autoComplete="email"
                        className="h-[52px] rounded-field px-6"
                      />

                      <div className="relative">
                        <Input
                          label=""
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          error={errors.password}
                          placeholder="Password"
                          autoComplete="current-password"
                          className="h-[52px] rounded-field px-6 pr-12"
                        />

                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 h-8 w-8 -translate-y-1/2 rounded-[10px] text-ink-400 transition-colors hover:bg-base-100 hover:text-ink-700 dark:hover:bg-white/10 dark:hover:text-ink-200"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? (
                            <EyeOff className="w-5 h-5 mx-auto" />
                          ) : (
                            <Eye className="w-5 h-5 mx-auto" />
                          )}
                        </button>
                      </div>
                    </div>

                    <Link to="/forgot-password" className="inline-flex text-body-sm font-medium text-accent-600 hover:text-accent-700 dark:text-accent-400">
                      Forgot password?
                    </Link>

                    <Button
                      type="submit"
                      className="w-full"
                      size="lg"
                      loading={isLoading}
                      style={{ height: '52px' }}
                    >
                      Sign in
                      <ArrowRight className="w-5 h-5" />
                    </Button>
                  </form>
                </div>

                <div className="absolute bottom-8 left-10 right-10 hidden items-center justify-between text-body-xs text-ink-400 lg:flex">
                  <span>Demo credentials: admin@abctech.com / Admin@123</span>
                  <Link to="/register" className="hover:text-accent-600">Create account</Link>
                </div>
            </div>
          </div>
        </div>
      </div>
   
  )
}
