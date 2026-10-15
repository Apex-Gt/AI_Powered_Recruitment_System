import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AlertCircle, ArrowDownRight, ArrowUpRight, Briefcase, CalendarDays, CheckCircle2, ChevronRight, Gift, Sparkles, Users, Video } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/Badge'
import { cn, formatDate, getInitials, formatRelativeTime } from '@/utils/helpers'
import { useDashboardData, type RangeDays } from './useDashboardData'

const CORAL = '#F95F62'
const VIOLET = '#7C4DFF'

function Change({ value }: { value: number | null }) {
  if (value === null) return <span className="text-body-xs text-ink-500">New this period</span>
  const up = value >= 0
  return (
    <span className="flex items-center gap-1.5">
      <span
        className={cn(
          'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-label-xs font-semibold',
          up ? 'bg-success-50 text-success-600 dark:bg-success-900/30' : 'bg-error-50 text-error-600 dark:bg-error-900/30'
        )}
      >
        {up ? <ArrowUpRight className="h-3 w-3" aria-hidden="true" /> : <ArrowDownRight className="h-3 w-3" aria-hidden="true" />}
        {Math.abs(value)}%
      </span>
      <span className="text-body-xs text-ink-500">vs last period</span>
    </span>
  )
}

interface StatCardProps {
  title: string
  value: number
  icon: React.ElementType
  href: string
  change: number | null
  series: number[]
  color: string
  tint: string
}

function StatCard({ title, value, icon: Icon, href, change, series, color, tint }: StatCardProps) {
  const data = series.map((v, i) => ({ i, v }))
  return (
    <Link to={href} className="block rounded-xl no-underline">
      <Card hover padding="md" className="h-full cursor-pointer">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', tint)}>
                <Icon className="h-4 w-4" style={{ color }} aria-hidden="true" />
              </span>
              <p className="text-body-sm font-medium text-ink-500 dark:text-ink-400">{title}</p>
            </div>
            <p className="mt-3 text-display-sm font-extrabold tracking-tight text-ink-900 dark:text-ink-100">{value.toLocaleString()}</p>
          </div>
          <div className="h-16 w-24 flex-shrink-0" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <Bar dataKey="v" fill={color} radius={[3, 3, 0, 0]} opacity={0.85} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="mt-3">
          <Change value={change} />
        </div>
      </Card>
    </Link>
  )
}

function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-heading-sm font-bold text-ink-900 dark:text-ink-100">{title}</h2>
        {subtitle && <p className="mt-0.5 text-body-xs text-ink-500 dark:text-ink-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

function EmptyNote({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex h-full min-h-[140px] flex-col items-center justify-center gap-2 text-center text-ink-400">
      <Icon className="h-8 w-8 opacity-50" aria-hidden="true" />
      <p className="text-body-sm">{text}</p>
    </div>
  )
}

function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn('flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-label-sm font-bold text-brand-700 dark:bg-brand-900/40 dark:text-brand-200', className)}>
      {getInitials(name)}
    </span>
  )
}

export function Dashboard() {
  const { user, hasRole } = useAuth()
  const { resolvedTheme } = useTheme()
  const [range, setRange] = useState<RangeDays>(30)
  const d = useDashboardData(range)
  const isDark = resolvedTheme === 'dark'

  const grid = isDark ? '#333333' : '#ECECF3'
  const tick = isDark ? '#A8A29E' : '#6B6B80'
  const tooltipStyle = {
    backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF',
    border: `1px solid ${isDark ? '#333333' : '#ECECF3'}`,
    borderRadius: 12,
    color: isDark ? '#FAFAF9' : '#1B1B2F',
    fontSize: 12,
  }

  const firstName = user?.userName?.split(' ')[0] || 'there'
  const maxFunnel = Math.max(1, ...d.funnel.map((f) => f.count))

  if (d.isLoading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard">
        <div className="h-14 w-64 animate-pulse rounded-xl bg-base-200 dark:bg-surface-dark-elevated" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i} className="h-36 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Card className="h-80 animate-pulse xl:col-span-2" />
          <Card className="h-80 animate-pulse" />
        </div>
      </div>
    )
  }

  const gaugeData = [
    { name: 'Strong matches', value: d.strongPct, fill: VIOLET },
    { name: 'Average match', value: d.avgMatch, fill: CORAL },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-heading-xl font-extrabold tracking-tight text-ink-900 dark:text-ink-100">Dashboard</h1>
          <p className="mt-0.5 text-body-sm text-ink-500 dark:text-ink-400">Welcome back, {firstName}. Here's your hiring pipeline at a glance.</p>
        </div>
        <label className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-body-sm text-ink-700 dark:text-ink-300">
          <CalendarDays className="h-4 w-4 text-ink-500" aria-hidden="true" />
          <span className="sr-only">Date range</span>
          <select
            value={range}
            onChange={(e) => setRange(Number(e.target.value) as RangeDays)}
            className="cursor-pointer bg-transparent font-medium outline-none"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </label>
      </div>

      {d.error && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-error-200 bg-error-50 p-3 text-body-sm text-error-600 dark:border-error-800/70 dark:bg-error-900/30 dark:text-error-400">
          <AlertCircle className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
          {d.error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Active Jobs" value={d.stats.activeJobs} icon={Briefcase} href="/jobs" change={d.stats.activeJobsChange}
          series={d.series.map((s) => s.jobs)} color={CORAL} tint="bg-accent-50 dark:bg-accent-900/30" />
        <StatCard title="Candidates" value={d.stats.candidates} icon={Users} href="/candidates" change={d.stats.candidatesChange}
          series={d.series.map((s) => s.applied)} color={VIOLET} tint="bg-brand-50 dark:bg-brand-900/30" />
        <StatCard title="Shortlisted" value={d.stats.shortlisted} icon={CheckCircle2} href="/pipeline" change={d.stats.shortlistedChange}
          series={d.series.map((s) => s.shortlisted)} color={CORAL} tint="bg-accent-50 dark:bg-accent-900/30" />
        <StatCard title="Offers" value={d.stats.offers} icon={Gift} href="/pipeline" change={d.stats.offersChange}
          series={d.series.map((s) => s.offers)} color={VIOLET} tint="bg-brand-50 dark:bg-brand-900/30" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card padding="md" className="xl:col-span-2">
          <SectionHeader
            title="Applications Overview"
            subtitle={`${d.stats.totalCandidates.toLocaleString()} candidates in total`}
            action={
              <div className="flex items-center gap-4 text-body-xs text-ink-500">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: CORAL }} />Applied</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: VIOLET }} />Shortlisted</span>
              </div>
            }
          />
          <div className="h-72" role="img" aria-label="Area chart of applications and shortlisted candidates over time">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={d.series} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gApplied" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CORAL} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={CORAL} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gShort" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={VIOLET} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={VIOLET} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: tick, fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: tick, fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="applied" name="Applied" stroke={CORAL} strokeWidth={2.5} fill="url(#gApplied)" />
                <Area type="monotone" dataKey="shortlisted" name="Shortlisted" stroke={VIOLET} strokeWidth={2.5} fill="url(#gShort)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card padding="md">
          <SectionHeader title="AI Match Quality" subtitle="Across all scored candidates" />
          {d.scoredCount === 0 ? (
            <EmptyNote icon={Sparkles} text="No candidates have been AI-scored yet" />
          ) : (
            <>
              <div className="relative h-52" role="img" aria-label={`Average match ${d.avgMatch} percent, ${d.strongPct} percent strong matches`}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart data={gaugeData} startAngle={200} endAngle={-20} innerRadius="55%" outerRadius="100%" barSize={14}>
                    <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                    <RadialBar dataKey="value" background={{ fill: isDark ? '#282828' : '#F3F3F8' }} cornerRadius={10} isAnimationActive={false} />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-display-sm font-extrabold text-ink-900 dark:text-ink-100">{d.avgMatch}%</span>
                  <span className="text-body-xs text-ink-500">Average match</span>
                </div>
              </div>
              <div className="mt-2 space-y-2 rounded-xl bg-base-50 p-3 dark:bg-surface-dark-elevated">
                <div className="flex items-center justify-between text-body-sm">
                  <span className="flex items-center gap-2 text-ink-600 dark:text-ink-300"><span className="h-2.5 w-2.5 rounded-full" style={{ background: VIOLET }} />Strong matches (70%+)</span>
                  <span className="font-semibold text-ink-900 dark:text-ink-100">{d.strongPct}%</span>
                </div>
                <div className="flex items-center justify-between text-body-sm">
                  <span className="flex items-center gap-2 text-ink-600 dark:text-ink-300"><span className="h-2.5 w-2.5 rounded-full" style={{ background: CORAL }} />Average score</span>
                  <span className="font-semibold text-ink-900 dark:text-ink-100">{d.avgMatch}%</span>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card padding="md">
          <SectionHeader title="Recruitment Funnel" subtitle="Candidates who reached each stage" />
          <ul className="space-y-3">
            {d.funnel.map((f, i) => (
              <li key={f.stage}>
                <div className="mb-1 flex items-center justify-between text-body-xs">
                  <span className="font-medium text-ink-700 dark:text-ink-300">{f.stage}</span>
                  <span className="font-semibold text-ink-900 dark:text-ink-100">{f.count}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-base-100 dark:bg-surface-dark-elevated">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${(f.count / maxFunnel) * 100}%`, background: i % 2 === 0 ? CORAL : VIOLET }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card padding="md">
          <SectionHeader
            title="Upcoming Interviews"
            action={<Link to="/interviews" className="text-body-xs font-semibold text-brand-600 hover:underline dark:text-brand-300">View all</Link>}
          />
          {d.upcoming.length === 0 ? (
            <EmptyNote icon={Video} text="No interviews scheduled" />
          ) : (
            <ul className="space-y-3">
              {d.upcoming.map((i) => (
                <li key={i.id} className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] p-3">
                  <Avatar name={i.candidateName} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body-sm font-semibold text-ink-900 dark:text-ink-100">{i.candidateName}</p>
                    <p className="truncate text-body-xs text-ink-500">{i.jobTitle}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-body-xs font-semibold text-ink-900 dark:text-ink-100">{formatDate(i.scheduledAt, { month: 'short', day: 'numeric' })}</p>
                    <p className="text-body-xs text-ink-500">{new Date(i.scheduledAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card padding="md">
          <SectionHeader
            title="Top Candidates"
            subtitle="Highest AI match scores"
            action={<Link to="/candidates" className="text-body-xs font-semibold text-brand-600 hover:underline dark:text-brand-300">View all</Link>}
          />
          {d.topCandidates.length === 0 ? (
            <EmptyNote icon={Sparkles} text="Score candidates to see top matches" />
          ) : (
            <ul className="space-y-1">
              {d.topCandidates.map((c) => (
                <li key={c.id}>
                  <Link to={`/candidates/${c.id}`} className="flex cursor-pointer items-center gap-3 rounded-xl p-2 no-underline transition-colors hover:bg-base-50 dark:hover:bg-surface-dark-elevated">
                    <Avatar name={c.candidateName} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body-sm font-semibold text-ink-900 dark:text-ink-100">{c.candidateName}</p>
                      <p className="truncate text-body-xs text-ink-500">{c.jobTitle ?? 'Unassigned'}</p>
                    </div>
                    <span className="rounded-lg bg-brand-50 px-2 py-1 text-label-sm font-bold text-brand-700 dark:bg-brand-900/30 dark:text-brand-200">
                      {Math.round(c.aiMatchScore ?? 0)}%
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card padding="md">
        <SectionHeader
          title="Recent Applications"
          action={hasRole(['ADMIN', 'RECRUITER']) ? (
            <Link to="/candidates" className="inline-flex items-center gap-1 text-body-xs font-semibold text-brand-600 hover:underline dark:text-brand-300">
              All candidates <ChevronRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          ) : undefined}
        />
        {d.recent.length === 0 ? (
          <EmptyNote icon={Users} text="No applications yet. Upload resumes to get started." />
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {d.recent.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 py-3">
                <Avatar name={c.candidateName} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body-sm font-semibold text-ink-900 dark:text-ink-100">{c.candidateName}</p>
                  <p className="truncate text-body-xs text-ink-500">Applied for {c.jobTitle ?? 'a position'}</p>
                </div>
                {c.status && <StatusBadge status={c.status} />}
                <span className="w-24 text-right text-body-xs text-ink-500">{formatRelativeTime(c.appliedAt ?? c.createdAt ?? '')}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
