import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { DonutChart, LineChartComponent, FunnelChart } from '@/components/charts'
import { Users, Clock, Target, Briefcase, Loader2 } from 'lucide-react'
import { cn } from '@/utils/helpers'

// MVP: Use mock data since analytics backend is not implemented
const MOCK_OVERVIEW = {
  activeJobs: 3,
  totalCandidates: 47,
  shortlisted: 8,
  interviews: 5,
  offers: 2,
}

const MOCK_FUNNEL: FunnelData[] = [
  { stage: 'Applied', count: 47, conversionRate: 100 },
  { stage: 'Screening', count: 23, conversionRate: 49 },
  { stage: 'Shortlisted', count: 8, conversionRate: 35 },
  { stage: 'Assessment', count: 5, conversionRate: 63 },
  { stage: 'Interview', count: 4, conversionRate: 80 },
  { stage: 'Offer', count: 2, conversionRate: 50 },
  { stage: 'Hired', count: 1, conversionRate: 50 },
]

const MOCK_TIME_TO_HIRE: TimeToHireData = {
  average: 28,
  median: 24,
  byJob: [
    { jobTitle: 'Senior Python Developer', days: 32 },
    { jobTitle: 'Frontend Engineer', days: 26 },
    { jobTitle: 'DevOps Engineer', days: 28 },
    { jobTitle: 'Data Scientist', days: 22 },
  ],
}

const MOCK_AI_MATCH_DIST: AiMatchDistribution = {
  ranges: [
    { range: '80-100%', count: 5 },
    { range: '60-79%', count: 12 },
    { range: '40-59%', count: 18 },
    { range: '0-39%', count: 12 },
  ],
}

const MOCK_JOBS_METRICS: JobsMetrics = {
  total: 12,
  active: 3,
  draft: 4,
  closed: 5,
  avgApplicants: 4.2,
  avgTimeToFill: 28,
  offersExtended: 2,
  hired: 1,
  byDepartment: {
    Engineering: 6,
    Marketing: 2,
    Sales: 1,
    'Human Resources': 1,
    Finance: 1,
    Other: 1,
  },
}

export function Analytics() {
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Simulate brief loading for UX
    const timer = setTimeout(() => setIsLoading(false), 500)
    return () => clearTimeout(timer)
  }, [])

  const aiMatchData = MOCK_AI_MATCH_DIST.ranges.map((r) => ({
    name: r.range,
    value: r.count,
    color: r.range.includes('80') ? '#22C55E' : r.range.includes('60') ? '#F59E0B' : r.range.includes('40') ? '#3B82F6' : '#EF4444',
  }))

  const funnelData = MOCK_FUNNEL

  const timeToHireChartData = MOCK_TIME_TO_HIRE.byJob.map((j) => ({
    name: j.jobTitle.length > 20 ? j.jobTitle.slice(0, 20) + '...' : j.jobTitle,
    days: j.days,
    avg: MOCK_TIME_TO_HIRE.average,
  }))

  const departmentData = [
    { name: 'Engineering', value: MOCK_JOBS_METRICS.byDepartment?.Engineering || 0, color: '#F97316' },
    { name: 'Marketing', value: MOCK_JOBS_METRICS.byDepartment?.Marketing || 0, color: '#22C55E' },
    { name: 'Sales', value: MOCK_JOBS_METRICS.byDepartment?.Sales || 0, color: '#F59E0B' },
    { name: 'HR', value: MOCK_JOBS_METRICS.byDepartment?.['Human Resources'] || 0, color: '#3B82F6' },
    { name: 'Finance', value: MOCK_JOBS_METRICS.byDepartment?.Finance || 0, color: '#14B8A6' },
    { name: 'Other', value: MOCK_JOBS_METRICS.byDepartment?.Other || 0, color: '#78716C' },
  ]

  const metricCards = [
    {
      title: 'Active Jobs',
      value: MOCK_OVERVIEW.activeJobs,
      icon: Briefcase,
      color: 'bg-accent-100 dark:bg-accent-900/30 text-accent-600 dark:text-accent-400',
    },
    {
      title: 'Total Candidates',
      value: MOCK_OVERVIEW.totalCandidates,
      icon: Users,
      color: 'bg-info-100 dark:bg-info-900/30 text-info-600 dark:text-info-400',
    },
    {
      title: 'Avg Time to Hire',
      value: `${MOCK_TIME_TO_HIRE.average} days`,
      icon: Clock,
      color: 'bg-success-100 dark:bg-success-900/30 text-success-600 dark:text-success-400',
    },
    {
      title: 'Offer Acceptance',
      value: MOCK_JOBS_METRICS.offersExtended > 0 ? `${Math.round((MOCK_JOBS_METRICS.hired / MOCK_JOBS_METRICS.offersExtended) * 100)}%` : '0%',
      icon: Target,
      color: 'bg-warning-100 dark:bg-warning-900/30 text-warning-600 dark:text-warning-400',
    },
  ]

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-display-md font-bold text-ink-900 dark:text-ink-100">Analytics</h1>
          <p className="text-body-md text-ink-500 dark:text-ink-400 mt-1">Recruitment metrics and insights</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {metricCards.map((card, index) => (
            <Card key={index} hover variant="elevated" padding="md" className="animate-pulse">
              <CardContent className="flex items-start justify-between">
                <div>
                  <p className="text-body-sm text-ink-500 dark:text-ink-400">{card.title}</p>
                  <p className="text-display-sm font-bold text-ink-900 dark:text-ink-100 mt-1">---</p>
                </div>
                <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', card.color)}>
                  <card.icon className="w-6 h-6" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card padding="lg" className="animate-pulse">
            <CardHeader>
              <CardTitle>AI Match Distribution</CardTitle>
              <CardDescription>Candidate match scores across all jobs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-accent-500" />
              </div>
            </CardContent>
          </Card>

          <Card padding="lg" className="animate-pulse">
            <CardHeader>
              <CardTitle>Time to Hire Trend</CardTitle>
              <CardDescription>Average days to fill positions over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-accent-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card padding="lg" className="animate-pulse">
            <CardHeader>
              <CardTitle>Recruitment Funnel</CardTitle>
              <CardDescription>Candidate progression through pipeline stages</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-accent-500" />
              </div>
            </CardContent>
          </Card>

          <Card padding="lg" className="animate-pulse">
            <CardHeader>
              <CardTitle>Department Breakdown</CardTitle>
              <CardDescription>Jobs and candidates by department</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-accent-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display-md font-bold text-ink-900 dark:text-ink-100">Analytics</h1>
        <p className="text-body-md text-ink-500 dark:text-ink-400 mt-1">Recruitment metrics and insights</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map((card, index) => (
          <Card key={index} hover variant="elevated" padding="md">
            <CardContent className="flex items-start justify-between">
              <div>
                <p className="text-body-sm text-ink-500 dark:text-ink-400">{card.title}</p>
                <p className="text-display-sm font-bold text-ink-900 dark:text-ink-100 mt-1">
                  {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
                </p>
              </div>
              <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', card.color)}>
                <card.icon className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card padding="lg">
          <CardHeader>
            <CardTitle>AI Match Distribution</CardTitle>
            <CardDescription>Candidate match scores across all jobs</CardDescription>
          </CardHeader>
          <CardContent>
            <DonutChart
              data={aiMatchData}
              height={280}
              total={aiMatchData.reduce((sum, d) => sum + d.value, 0)}
              totalLabel="Total Candidates"
            />
            <div className="flex flex-wrap items-center justify-center gap-6 mt-6">
              {aiMatchData.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-body-sm text-ink-600 dark:text-ink-400">
                    {item.name}: {item.value}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card padding="lg">
          <CardHeader>
            <CardTitle>Time to Hire Trend</CardTitle>
            <CardDescription>Average days to fill positions over time</CardDescription>
          </CardHeader>
          <CardContent>
            {timeToHireChartData.length > 0 ? (
              <>
                <LineChartComponent
                  data={timeToHireChartData}
                  keys={['days', 'avg']}
                  labels={{ days: 'Days to Hire', avg: 'Average' }}
                  colors={['#F97316', '#78716C']}
                  height={250}
                  index="name"
                  showDots
                />
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-base-200 dark:border-base-700">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-accent-500" />
                      <span className="text-body-sm text-ink-600 dark:text-ink-400">Average: {MOCK_TIME_TO_HIRE.average} days</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-ink-400" />
                      <span className="text-body-sm text-ink-600 dark:text-ink-400">Median: {MOCK_TIME_TO_HIRE.median} days</span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-center text-ink-400 dark:text-ink-500">
                <Clock className="w-12 h-12 mb-4 opacity-50" />
                <p className="text-body-md">No hiring data available yet</p>
                <p className="text-body-sm mt-1">Create jobs and hire candidates to see metrics</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card padding="lg">
          <CardHeader>
            <CardTitle>Recruitment Funnel</CardTitle>
            <CardDescription>Candidate progression through pipeline stages</CardDescription>
          </CardHeader>
          <CardContent>
            <FunnelChart data={funnelData} height={350} />
          </CardContent>
        </Card>

        <Card padding="lg">
          <CardHeader>
            <CardTitle>Department Breakdown</CardTitle>
            <CardDescription>Jobs and candidates by department</CardDescription>
          </CardHeader>
          <CardContent>
            <DonutChart
              data={departmentData}
              height={280}
              total={departmentData.reduce((sum, d) => sum + d.value, 0)}
              totalLabel="Total Jobs"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
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