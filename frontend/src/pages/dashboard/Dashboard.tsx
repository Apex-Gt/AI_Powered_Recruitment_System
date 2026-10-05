import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { analyticsApi } from '@/utils/api'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { DonutChart, LineChartComponent, FunnelChart } from '@/components/charts'
import { Briefcase, Users, CheckCircle2, Target, Clock, Plus } from 'lucide-react'
import { cn } from '@/utils/helpers'

interface DashboardStats {
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

export function Dashboard() {
  const { user, hasRole } = useAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [funnel, setFunnel] = useState<FunnelData[]>([])
  const [timeToHire, setTimeToHire] = useState<TimeToHireData | null>(null)
  const [aiMatchDist, setAiMatchDist] = useState<AiMatchDistribution | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, funnelRes, timeRes, aiRes] = await Promise.all([
          analyticsApi.getOverview(),
          analyticsApi.getFunnel(),
          analyticsApi.getTimeToHire(),
          analyticsApi.getAiMatchDistribution(),
        ])
        setStats(statsRes)
        setFunnel(funnelRes)
        setTimeToHire(timeRes)
        setAiMatchDist(aiRes)
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [])

  const metricCards = [
    {
      title: 'Active Jobs',
      value: stats?.activeJobs ?? 0,
      icon: Briefcase,
      color: 'bg-accent-100 dark:bg-accent-900/30 text-accent-600 dark:text-accent-400',
      href: '/jobs',
      change: '+12%',
      changeLabel: 'vs last month',
    },
    {
      title: 'Total Candidates',
      value: stats?.totalCandidates ?? 0,
      icon: Users,
      color: 'bg-info-100 dark:bg-info-900/30 text-info-600 dark:text-info-400',
      href: '/candidates',
      change: '+8%',
      changeLabel: 'vs last month',
    },
    {
      title: 'Shortlisted',
      value: stats?.shortlisted ?? 0,
      icon: CheckCircle2,
      color: 'bg-success-100 dark:bg-success-900/30 text-success-600 dark:text-success-400',
      href: '/pipeline',
      change: '+15%',
      changeLabel: 'vs last month',
    },
    {
      title: 'Interviews Scheduled',
      value: stats?.interviews ?? 0,
      icon: Target,
      color: 'bg-warning-100 dark:bg-warning-900/30 text-warning-600 dark:text-warning-400',
      href: '/interviews',
      change: '+5%',
      changeLabel: 'vs last month',
    },
  ]

  const aiMatchData = aiMatchDist?.ranges.map((r) => ({
    name: r.range,
    value: r.count,
    color: r.range.includes('80') ? '#22C55E' : r.range.includes('60') ? '#F59E0B' : '#EF4444',
  })) ?? [
    { name: '80-100%', value: 0, color: '#22C55E' },
    { name: '60-79%', value: 0, color: '#F59E0B' },
    { name: '40-59%', value: 0, color: '#3B82F6' },
    { name: '0-39%', value: 0, color: '#EF4444' },
  ]

  const funnelData = funnel.length > 0 ? funnel : [
    { stage: 'Applied', count: 0, conversionRate: 100 },
    { stage: 'Screening', count: 0, conversionRate: 0 },
    { stage: 'Shortlisted', count: 0, conversionRate: 0 },
    { stage: 'Assessment', count: 0, conversionRate: 0 },
    { stage: 'Interview', count: 0, conversionRate: 0 },
    { stage: 'Offer', count: 0, conversionRate: 0 },
    { stage: 'Hired', count: 0, conversionRate: 0 },
  ]

  const timeToHireChartData = timeToHire?.byJob.map((j) => ({
    name: j.jobTitle.length > 20 ? j.jobTitle.slice(0, 20) + '...' : j.jobTitle,
    days: j.days,
    avg: timeToHire.average,
  })) ?? []

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="space-y-3">
                <div className="h-4 bg-base-200 dark:bg-base-700 rounded w-3/4" />
                <div className="h-8 bg-base-200 dark:bg-base-700 rounded w-1/4" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="animate-pulse"><CardContent className="h-80" /></Card>
          <Card className="animate-pulse"><CardContent className="h-80" /></Card>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="animate-pulse"><CardContent className="h-80" /></Card>
          <Card className="animate-pulse"><CardContent className="h-80" /></Card>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-display-md font-bold text-ink-900 dark:text-ink-100">
            Welcome back, {user?.userName?.split(' ')[0] || 'User'}!
          </h1>
          <p className="text-body-md text-ink-500 dark:text-ink-400 mt-1">
            Here's what's happening with your recruitment pipeline today.
          </p>
        </div>
        {hasRole(['ADMIN', 'RECRUITER']) && (
          <Link to="/jobs/create">
            <Button size="lg">
              <Plus className="w-5 h-5" />
              Create Job
            </Button>
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map((card, index) => {
          const Icon = card.icon
          return (
            <Link key={index} to={card.href} className="no-underline">
              <Card hover variant="elevated" padding="md">
                <CardContent className="flex items-start justify-between">
                  <div>
                    <p className="text-body-sm text-ink-500 dark:text-ink-400">{card.title}</p>
                    <p className="text-display-sm font-bold text-ink-900 dark:text-ink-100 mt-1">
                      {card.value.toLocaleString()}
                    </p>
                    <div className="flex items-center gap-1 mt-2">
                      <span className={cn('text-body-xs font-medium', card.change.startsWith('+') ? 'text-success-600' : 'text-error-600')}>
                        {card.change}
                      </span>
                      <span className="text-body-xs text-ink-400 dark:text-ink-500">{card.changeLabel}</span>
                    </div>
                  </div>
                  <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', card.color)}>
                    <Icon className="w-6 h-6" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card padding="lg">
          <CardHeader>
            <CardTitle>AI Match Distribution</CardTitle>
            <CardDescription>Candidate match scores across all active jobs</CardDescription>
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
            <CardTitle>Time to Hire</CardTitle>
            <CardDescription>Average days to fill positions by job</CardDescription>
          </CardHeader>
          <CardContent>
            {timeToHireChartData.length > 0 ? (
              <>
                <LineChartComponent
                  data={timeToHireChartData}
                  keys={['days', 'avg']}
                  labels={{ days: 'Days to Hire', avg: 'Average' }}
                  colors={['#FE5D26', '#797059']}
                  height={250}
                  index="name"
                  showDots
                />
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-base-200 dark:border-base-700">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-accent-500" />
                      <span className="text-body-sm text-ink-600 dark:text-ink-400">Average: {timeToHire?.average ?? 0} days</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-ink-400" />
                      <span className="text-body-sm text-ink-600 dark:text-ink-400">Median: {timeToHire?.median ?? 0} days</span>
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
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks to get started</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link to="/jobs/create" className="block">
              <Button variant="ghost" className="w-full justify-start gap-3" size="lg">
                <div className="w-10 h-10 rounded-xl bg-accent-100 dark:bg-accent-900/30 flex items-center justify-center">
                  <Briefcase className="w-5 h-5 text-accent-600 dark:text-accent-400" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-body-md font-medium text-ink-900 dark:text-ink-100">Create New Job</p>
                  <p className="text-body-sm text-ink-500 dark:text-ink-400">Post a new position</p>
                </div>
              </Button>
            </Link>
            <Link to="/candidates" className="block">
              <Button variant="ghost" className="w-full justify-start gap-3" size="lg">
                <div className="w-10 h-10 rounded-xl bg-info-100 dark:bg-info-900/30 flex items-center justify-center">
                  <Users className="w-5 h-5 text-info-600 dark:text-info-400" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-body-md font-medium text-ink-900 dark:text-ink-100">View Candidates</p>
                  <p className="text-body-sm text-ink-500 dark:text-ink-400">Browse all applicants</p>
                </div>
              </Button>
            </Link>
            <Link to="/pipeline" className="block">
              <Button variant="ghost" className="w-full justify-start gap-3" size="lg">
                <div className="w-10 h-10 rounded-xl bg-success-100 dark:bg-success-900/30 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-success-600 dark:text-success-400" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-body-md font-medium text-ink-900 dark:text-ink-100">Pipeline View</p>
                  <p className="text-body-sm text-ink-500 dark:text-ink-400">Manage candidate stages</p>
                </div>
              </Button>
            </Link>
            <Link to="/interviews" className="block">
              <Button variant="ghost" className="w-full justify-start gap-3" size="lg">
                <div className="w-10 h-10 rounded-xl bg-warning-100 dark:bg-warning-900/30 flex items-center justify-center">
                  <Target className="w-5 h-5 text-warning-600 dark:text-warning-400" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-body-md font-medium text-ink-900 dark:text-ink-100">Schedule Interview</p>
                  <p className="text-body-sm text-ink-500 dark:text-ink-400">Set up interview slots</p>
                </div>
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}