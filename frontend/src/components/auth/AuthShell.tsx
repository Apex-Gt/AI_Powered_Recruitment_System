import { Link } from 'react-router-dom'
import { Sparkles, Users, Briefcase, TrendingUp } from 'lucide-react'

function PreviewPanel() {
  const bars = [40, 68, 52, 86, 60, 74, 48]
  return (
    <div className="relative hidden lg:flex flex-1 items-center justify-center overflow-hidden rounded-[28px] bg-gradient-to-br from-accent-500 via-accent-400 to-brand-500 p-10 xl:p-14">
      <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-white/15 blur-2xl" aria-hidden="true" />
      <div className="absolute -bottom-28 -left-16 h-80 w-80 rounded-full bg-brand-700/40 blur-3xl" aria-hidden="true" />

      <div className="relative w-full max-w-[460px]">
        <h2 className="text-heading-xl xl:text-display-sm font-extrabold text-white leading-tight">
          Hire smarter with AI-powered shortlisting
        </h2>
        <p className="mt-3 text-body-md text-white/90">
          Screen, score and schedule candidates from one dashboard.
        </p>

        <div className="mt-8 space-y-4" aria-hidden="true">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-white p-4 shadow-soft">
              <div className="flex items-center gap-2 text-body-xs text-ink-500">
                <Briefcase className="h-4 w-4 text-accent-600" /> Active jobs
              </div>
              <p className="mt-1 text-heading-lg font-bold text-ink-900">24</p>
              <span className="text-body-xs font-semibold text-success-600">▲ 12% vs last month</span>
            </div>
            <div className="rounded-xl bg-white p-4 shadow-soft">
              <div className="flex items-center gap-2 text-body-xs text-ink-500">
                <Users className="h-4 w-4 text-brand-600" /> Candidates
              </div>
              <p className="mt-1 text-heading-lg font-bold text-ink-900">1,284</p>
              <span className="text-body-xs font-semibold text-success-600">▲ 8% vs last month</span>
            </div>
          </div>

          <div className="rounded-xl bg-white p-4 shadow-soft">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-body-sm font-semibold text-ink-900">
                <TrendingUp className="h-4 w-4 text-accent-600" /> Applications
              </span>
              <span className="text-body-xs text-ink-500">Last 7 days</span>
            </div>
            <div className="mt-4 flex h-24 items-end gap-2">
              {bars.map((h, i) => (
                <div
                  key={i}
                  className={i === 3 ? 'flex-1 rounded-md bg-brand-500' : 'flex-1 rounded-md bg-accent-300'}
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-soft">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100">
              <Sparkles className="h-5 w-5 text-brand-600" />
            </div>
            <div className="flex-1">
              <p className="text-body-sm font-semibold text-ink-900">AI match score</p>
              <p className="text-body-xs text-ink-500">Senior Python Developer</p>
            </div>
            <span className="text-heading-md font-bold text-brand-600">92%</span>
          </div>
        </div>
      </div>
    </div>
  )
}

interface AuthShellProps {
  children: React.ReactNode
  footer?: React.ReactNode
}

export function AuthShell({ children, footer }: AuthShellProps) {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] p-3 sm:p-4 lg:p-5">
      <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] sm:min-h-[calc(100vh-2rem)] lg:min-h-[calc(100vh-2.5rem)] max-w-[1500px] gap-5 rounded-[32px] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-soft lg:p-4">
        <div className="flex flex-1 flex-col px-4 py-6 sm:px-10 lg:px-12 xl:px-20">
          <Link to="/" className="inline-flex w-fit items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-accent-500 to-brand-500 shadow-accent">
              <Sparkles className="h-5 w-5 text-white" aria-hidden="true" />
            </span>
            <span className="text-heading-md font-extrabold text-ink-900 dark:text-ink-100">NexHire</span>
          </Link>

          <div className="flex flex-1 items-center justify-center py-8">
            <div className="w-full max-w-[440px]">{children}</div>
          </div>

          {footer && <div className="text-body-xs text-ink-500 dark:text-ink-400">{footer}</div>}
        </div>
        <PreviewPanel />
      </div>
    </div>
  )
}
