import { useEffect, useState } from 'react'
import { AlertCircle, BarChart3 } from 'lucide-react'
import { FunnelChart } from '@/components/charts'
import { SCORE_BANDS, useChartTheme } from '@/components/charts/theme'
import { FigureStrip } from '@/components/ui/FigureStrip'
import { BarRows, EmptyNote, Panel } from '@/components/ui/Panel'
import { PageHeader } from '@/components/ui/ListPage'
import { analyticsApi } from '@/utils/api'

const EMPTY_OVERVIEW: AnalyticsOverview = { activeJobs: 0, totalCandidates: 0, shortlisted: 0, interviews: 0, offers: 0 }
const EMPTY_TIME_TO_HIRE: TimeToHireData = { average: 0, median: 0, byJob: [] }
const EMPTY_AI_MATCH_DIST: AiMatchDistribution = { ranges: [] }
const EMPTY_JOBS_METRICS: JobsMetrics = {
  total: 0, active: 0, draft: 0, closed: 0, avgApplicants: 0, avgTimeToFill: 0, offersExtended: 0, hired: 0, byDepartment: {},
}

export function Analytics() {
  const { series } = useChartTheme()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [overview, setOverview] = useState(EMPTY_OVERVIEW)
  const [funnelData, setFunnelData] = useState<FunnelData[]>([])
  const [timeToHire, setTimeToHire] = useState(EMPTY_TIME_TO_HIRE)
  const [aiMatchDist, setAiMatchDist] = useState(EMPTY_AI_MATCH_DIST)
  const [jobsMetrics, setJobsMetrics] = useState(EMPTY_JOBS_METRICS)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      analyticsApi.getOverview(),
      analyticsApi.getFunnel(),
      analyticsApi.getTimeToHire(),
      analyticsApi.getAiMatchDistribution(),
      analyticsApi.getJobsMetrics(),
    ])
      .then(([o, f, t, d, j]) => {
        if (cancelled) return
        setOverview(o.data)
        setFunnelData(f.data)
        setTimeToHire(t.data)
        setAiMatchDist(d.data)
        setJobsMetrics(j.data)
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Could not load analytics'))
      .finally(() => !cancelled && setIsLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  const scoredTotal = aiMatchDist.ranges.reduce((sum, r) => sum + r.count, 0)
  const departments = Object.entries(jobsMetrics.byDepartment ?? {})
  const shortlistRate = overview.totalCandidates > 0 ? Math.round((overview.shortlisted / overview.totalCandidates) * 100) : 0

  return (
    <div className="space-y-8">
      <PageHeader title="Analytics" subtitle="How your hiring is moving, drawn from the jobs and candidates you have right now." />

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-error-200 bg-error-50 p-3 text-body-sm text-error-600 dark:border-error-800/70 dark:bg-error-900/30 dark:text-error-400">
          <AlertCircle className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      <div aria-busy={isLoading} className={isLoading ? 'opacity-60' : undefined}>
        <FigureStrip
          label="Key figures"
          figures={[
            { label: 'Open jobs', value: overview.activeJobs, note: `${jobsMetrics.total} in total` },
            { label: 'Candidates', value: overview.totalCandidates, note: `${jobsMetrics.avgApplicants} per job on average` },
            { label: 'Average time to hire', value: timeToHire.average ? `${timeToHire.average} days` : 'No hires yet', note: timeToHire.median ? `Median ${timeToHire.median} days` : undefined },
            { label: 'Shortlist rate', value: `${shortlistRate}%`, note: `${overview.shortlisted} of ${overview.totalCandidates} candidates` },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <Panel title="Hiring funnel" note="Candidates who reached each stage" className="xl:col-span-7">
          {funnelData.length === 0 || funnelData[0].count === 0 ? (
            <EmptyNote icon={BarChart3} title="Nothing to chart yet" text="The funnel fills in as candidates are uploaded and moved through the pipeline." />
          ) : (
            <FunnelChart data={funnelData} />
          )}
        </Panel>

        <Panel title="AI match scores" note={scoredTotal ? `${scoredTotal} scored candidates` : undefined} className="xl:col-span-5">
          {scoredTotal === 0 ? (
            <EmptyNote icon={BarChart3} title="No scores yet" text="Scores appear once uploaded resumes have been analysed." />
          ) : (
            <BarRows rows={aiMatchDist.ranges.map((r, i) => ({ label: r.range, value: r.count, color: SCORE_BANDS[i] }))} />
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <Panel
          title="Days to hire by job"
          note={timeToHire.byJob.length ? 'The line marks the average' : undefined}
          className="xl:col-span-7"
        >
          {timeToHire.byJob.length === 0 ? (
            <EmptyNote icon={BarChart3} title="No hires yet" text="Move a candidate to Selected to start measuring how long hiring takes." />
          ) : (
            <BarRows
              unit="d"
              marker={{ value: timeToHire.average, label: `Average ${timeToHire.average} days` }}
              rows={timeToHire.byJob.map((j) => ({ label: j.jobTitle, value: j.days, color: series[0] }))}
            />
          )}
        </Panel>

        <Panel title="Jobs by department" note={`${jobsMetrics.active} open, ${jobsMetrics.draft} draft, ${jobsMetrics.closed} closed`} className="xl:col-span-5">
          {departments.length === 0 ? (
            <EmptyNote icon={BarChart3} title="No jobs yet" text="Create a job to see how openings are spread across departments." />
          ) : (
            <BarRows rows={departments.map(([label, value]) => ({ label, value, color: series[0] }))} />
          )}
        </Panel>
      </div>
    </div>
  )
}

interface AnalyticsOverview {
  activeJobs: number
  totalCandidates: number
  shortlisted: number
  interviews: number
  offers: number
}

interface FunnelData {
  stage: string
  count: number
  conversionRate: number
}

interface TimeToHireData {
  average: number
  median: number
  byJob: { jobTitle: string; days: number }[]
}

interface AiMatchDistribution {
  ranges: { range: string; count: number }[]
}

interface JobsMetrics {
  total: number
  active: number
  draft: number
  closed: number
  avgApplicants: number
  avgTimeToFill: number
  offersExtended: number
  hired: number
  byDepartment?: Record<string, number>
}
