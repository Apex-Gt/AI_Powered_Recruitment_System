import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertCircle, ArrowDownRight, ArrowUpRight, CalendarDays, Sparkles, Users, Video } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useChartTheme } from '@/components/charts/theme'
import { StatusBadge } from '@/components/ui/Badge'
import { Dropdown } from '@/components/ui/Dropdown'
import { FigureStrip } from '@/components/ui/FigureStrip'
import { EmptyNote, Panel, PanelLink } from '@/components/ui/Panel'
import { cn, getInitials, formatRelativeTime, relativeDayLabel } from '@/utils/helpers'
import type { Interview } from '@/types'
import { useDashboardData, type RangeDays } from './useDashboardData'

function Change({ value }: { value: number | null }) {
  if (value === null) return <span className="text-body-xs text-ink-600 dark:text-ink-400">New this period</span>
  if (value === 0) return <span className="text-body-xs text-ink-600 dark:text-ink-400">No change</span>
  const up = value > 0
  return (
    <span className={cn('inline-flex items-center gap-1 text-body-xs font-semibold', up ? 'text-success-600 dark:text-success-400' : 'text-error-600 dark:text-error-400')}>
      {up ? <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /> : <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" />}
      {Math.abs(value)}% vs last period
    </span>
  )
}

function Initials({ name }: { name: string }) {
  return <span className="avatar-sm flex-shrink-0">{getInitials(name)}</span>
}

function groupByDay(interviews: Interview[]) {
  const now = new Date()
  const groups: { label: string; items: Interview[] }[] = []
  for (const i of interviews) {
    const label = relativeDayLabel(new Date(i.scheduledAt), now)
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.items.push(i)
    else groups.push({ label, items: [i] })
  }
  return groups
}

export function Dashboard() {
  const { user, hasRole } = useAuth()
  const [range, setRange] = useState<RangeDays>(30)
  const d = useDashboardData(range)
  const { grid, tick, tooltipStyle, series } = useChartTheme()
  const [primary] = series
  const selectedColor = '#2f7fd0'

  const firstName = user?.userName?.split(' ')[0] || 'there'
  const maxFunnel = Math.max(1, ...d.funnel.map((f) => f.count))

  if (d.isLoading) {
    return (
      <div className="space-y-8" aria-busy="true" aria-label="Loading dashboard">
        <div className="h-16 w-72 animate-pulse rounded-lg bg-base-100 dark:bg-surface-dark-elevated" />
        <div className="h-28 animate-pulse rounded-xl bg-base-100 dark:bg-surface-dark-elevated" />
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="h-80 animate-pulse rounded-xl bg-base-100 dark:bg-surface-dark-elevated xl:col-span-7" />
          <div className="h-80 animate-pulse rounded-xl bg-base-100 dark:bg-surface-dark-elevated xl:col-span-5" />
        </div>
      </div>
    )
  }

  const agenda = groupByDay(d.upcoming)

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-heading-xl font-bold text-ink-900 dark:text-ink-100">Welcome back, {firstName}</h1>
          <p className="mt-1.5 text-body-md text-ink-600 dark:text-ink-400">
            {d.stats.totalCandidates === 0
              ? 'No candidates yet. Create a job and upload resumes to start shortlisting.'
              : `${d.stats.totalCandidates.toLocaleString()} candidates across ${d.stats.activeJobs} open ${d.stats.activeJobs === 1 ? 'job' : 'jobs'}.`}
          </p>
        </div>
        <label className="flex items-center gap-2 rounded-lg border border-[var(--color-border-hover)] bg-[var(--color-surface)] px-3 py-2 text-body-sm text-ink-800 dark:text-ink-200">
          <CalendarDays className="h-4 w-4 text-ink-600 dark:text-ink-400" aria-hidden="true" />
          <span className="sr-only">Date range</span>
          <Dropdown
            ariaLabel="Date range"
            value={String(range)}
            onChange={(v) => setRange(Number(v) as RangeDays)}
            options={[
              { value: '7', label: 'Last 7 days' },
              { value: '30', label: 'Last 30 days' },
              { value: '90', label: 'Last 90 days' },
            ]}
            className="!h-auto !w-auto !border-0 !bg-transparent !p-0 !pr-8 !shadow-none font-semibold"
          />
        </label>
      </div>

      {d.error && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-error-200 bg-error-50 p-3 text-body-sm text-error-600 dark:border-error-800/70 dark:bg-error-900/30 dark:text-error-400">
          <AlertCircle className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
          {d.error}
        </div>
      )}

      <FigureStrip
        label="Key figures"
        figures={[
          { label: 'Open jobs', value: d.stats.activeJobs, href: '/jobs', note: <Change value={d.stats.activeJobsChange} /> },
          { label: 'New candidates', value: d.stats.candidates, href: '/candidates', note: <Change value={d.stats.candidatesChange} /> },
          { label: 'Shortlisted', value: d.stats.shortlisted, href: '/pipeline', note: <Change value={d.stats.shortlistedChange} /> },
          { label: 'Selected', value: d.stats.selected, href: '/pipeline', note: <Change value={d.stats.selectedChange} /> },
        ]}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <Panel title="Where candidates are" note="Everyone who reached each stage" className="xl:col-span-7">
          <ol className="space-y-3">
            {d.funnel.map((f, i) => {
              const prev = i === 0 ? null : d.funnel[i - 1].count
              const moved = prev ? Math.round((f.count / prev) * 100) : null
              const last = i === d.funnel.length - 1
              return (
                <li key={f.stage} className="grid grid-cols-[6.5rem_1fr_6.5rem] items-center gap-3">
                  <span className="text-body-sm font-semibold text-ink-800 dark:text-ink-200">{f.stage}</span>
                  <div className="h-7 overflow-hidden rounded-sm bg-base-100 dark:bg-surface-dark-elevated">
                    <div
                      className="h-full rounded-sm transition-[width] duration-300"
                      style={{ width: `${(f.count / maxFunnel) * 100}%`, minWidth: f.count ? 6 : 0, background: last ? selectedColor : primary }}
                    />
                  </div>
                  <span className="text-right text-body-sm tabular">
                    <strong className="font-display text-body-md font-bold text-ink-900 dark:text-ink-100">{f.count}</strong>
                    {moved !== null && <span className="ml-2 text-body-xs text-ink-600 dark:text-ink-400">{moved}%</span>}
                  </span>
                </li>
              )
            })}
          </ol>
          <p className="mt-4 text-body-xs text-ink-600 dark:text-ink-400">The percentage is how many moved on from the stage before.</p>
        </Panel>

        <Panel
          title="Interviews coming up"
          className="xl:col-span-5"
          action={<PanelLink to="/interviews">All interviews</PanelLink>}
        >
          {agenda.length === 0 ? (
            <EmptyNote icon={Video} title="Nothing scheduled" text="Schedule an interview from a candidate's profile or the Interviews page." />
          ) : (
            <div className="space-y-5">
              {agenda.map((g) => (
                <div key={g.label}>
                  <h3 className="mb-2 text-body-sm font-semibold text-ink-800 dark:text-ink-200">{g.label}</h3>
                  <ul className="divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
                    {g.items.map((i) => (
                      <li key={i.id} className="flex items-center gap-4 py-2.5">
                        <span className="w-20 flex-shrink-0 whitespace-nowrap font-display text-body-md font-bold tabular text-ink-900 dark:text-ink-100">
                          {new Date(i.scheduledAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-body-sm font-semibold text-ink-900 dark:text-ink-100">{i.candidateName}</p>
                          <p className="truncate text-body-xs text-ink-600 dark:text-ink-400">{i.jobTitle}</p>
                        </div>
                        <span className="badge-default">{i.type.charAt(0) + i.type.slice(1).toLowerCase()}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <Panel
          title="Best AI matches"
          className="xl:col-span-5"
          action={<PanelLink to="/candidates">All candidates</PanelLink>}
          note={d.scoredCount ? `Average ${d.avgMatch}%, with ${d.strongPct}% scoring 70% or more` : undefined}
        >
          {d.topCandidates.length === 0 ? (
            <EmptyNote icon={Sparkles} title="No scores yet" text="Scores appear after a resume is uploaded and analysed." />
          ) : (
            <ol className="divide-y divide-[var(--color-border)]">
              {d.topCandidates.map((c, i) => (
                <li key={c.id}>
                  <Link to={`/candidates/${c.id}`} className="flex items-center gap-3 py-2.5 no-underline transition-colors hover:bg-base-50 dark:hover:bg-surface-dark-elevated">
                    <span className="w-4 flex-shrink-0 text-center font-display text-body-sm font-bold tabular text-ink-500">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body-sm font-semibold text-ink-900 dark:text-ink-100">{c.candidateName}</p>
                      <p className="truncate text-body-xs text-ink-600 dark:text-ink-400">{c.jobTitle ?? 'Unassigned'}</p>
                    </div>
                    <div className="flex w-28 items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-sm bg-base-100 dark:bg-surface-dark-elevated" aria-hidden="true">
                        <div className="h-full rounded-sm bg-accent-500" style={{ width: `${Math.round(c.aiMatchScore ?? 0)}%` }} />
                      </div>
                      <span className="w-9 text-right font-display text-body-sm font-bold tabular text-accent-600 dark:text-accent-400">{Math.round(c.aiMatchScore ?? 0)}%</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </Panel>

        <Panel
          title="Applications over time"
          className="xl:col-span-7"
          action={
            <div className="flex items-center gap-4 text-body-xs text-ink-700 dark:text-ink-300">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: primary }} />Applied</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: series[1] }} />Shortlisted</span>
            </div>
          }
        >
          <div className="h-64" role="img" aria-label="Area chart of applications and shortlisted candidates over time">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={d.series} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="gApplied" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={primary} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={primary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={grid} strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: tick, fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: tick, fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="applied" name="Applied" stroke={primary} strokeWidth={2.5} fill="url(#gApplied)" />
                <Area type="monotone" dataKey="shortlisted" name="Shortlisted" stroke={series[1]} strokeWidth={2.5} fill="none" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <section className="surface overflow-hidden rounded-xl">
        <header className="flex items-center justify-between px-6 pt-5">
          <h2 className="font-display text-heading-sm font-semibold text-ink-900 dark:text-ink-100">Recent applications</h2>
          {hasRole(['ADMIN', 'RECRUITER']) && <PanelLink to="/candidates">All candidates</PanelLink>}
        </header>
        {d.recent.length === 0 ? (
          <div className="px-6 pb-6">
            <EmptyNote icon={Users} title="No applications yet" text="Upload resumes on the Candidates page to get started." />
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--color-border)] border-t border-[var(--color-border)]">
            {d.recent.map((c) => (
              <li key={c.id}>
                <Link to={`/candidates/${c.id}`} className="flex flex-wrap items-center gap-3 px-6 py-3 no-underline transition-colors hover:bg-base-50 dark:hover:bg-surface-dark-elevated">
                  <Initials name={c.candidateName} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body-sm font-semibold text-ink-900 dark:text-ink-100">{c.candidateName}</p>
                    <p className="truncate text-body-xs text-ink-600 dark:text-ink-400">Applied for {c.jobTitle ?? 'a position'}</p>
                  </div>
                  {c.status && <StatusBadge status={c.status} />}
                  <span className="w-24 text-right text-body-xs text-ink-600 dark:text-ink-400">{formatRelativeTime(c.appliedAt ?? c.createdAt ?? '')}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

