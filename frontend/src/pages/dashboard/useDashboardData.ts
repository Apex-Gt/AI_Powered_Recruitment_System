import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { candidateApi, interviewApi, jobApi } from '@/utils/api'
import type { Candidate, CandidateStatus, Interview, Job } from '@/types'

export type RangeDays = 7 | 30 | 90

const STAGES: CandidateStatus[] = ['APPLIED', 'SCREENING', 'SHORTLISTED', 'ASSESSMENT', 'INTERVIEW', 'OFFER', 'HIRED']
const stageIndex = (s?: CandidateStatus) => (s ? STAGES.indexOf(s) : 0)
const DAY = 86_400_000

const dateOf = (c: Candidate) => new Date(c.appliedAt ?? c.createdAt ?? 0).getTime()

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return Math.round(((current - previous) / previous) * 100)
}

export function useDashboardData(range: RangeDays) {
  const { hasRole } = useAuth()
  const isAdmin = hasRole(['ADMIN'])
  const [jobs, setJobs] = useState<Job[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setIsLoading(true)
      setError(null)
      const [jobsRes, candRes, intRes] = await Promise.allSettled([
        isAdmin
          ? jobApi.getAllForAdminUnwrapped({ page: 1, pageSize: 100 })
          : jobApi.getMyJobsUnwrapped({ page: 1, pageSize: 100 }),
        candidateApi.getAllUnwrapped({ page: 1, pageSize: 500 }),
        interviewApi.getAll({ page: 1, pageSize: 100 }),
      ])
      if (cancelled) return
      if (jobsRes.status === 'fulfilled') setJobs(jobsRes.value?.data ?? [])
      if (candRes.status === 'fulfilled') setCandidates((candRes.value?.data ?? []) as Candidate[])
      if (intRes.status === 'fulfilled') setInterviews(intRes.value?.data ?? [])
      if (jobsRes.status === 'rejected' && candRes.status === 'rejected') {
        setError('Could not load dashboard data. Check that the backend is running.')
      }
      setIsLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [isAdmin])

  const data = useMemo(() => {
    const now = Date.now()
    const start = now - range * DAY
    const prevStart = start - range * DAY

    const inRange = candidates.filter((c) => dateOf(c) >= start)
    const inPrev = candidates.filter((c) => dateOf(c) >= prevStart && dateOf(c) < start)

    const reached = (list: Candidate[], from: CandidateStatus) =>
      list.filter((c) => c.status !== 'REJECTED' && stageIndex(c.status) >= STAGES.indexOf(from))

    const activeJobs = jobs.filter((j) => j.status === 'ACTIVE')
    const jobsInRange = jobs.filter((j) => new Date(j.createdAt).getTime() >= start)
    const jobsInPrev = jobs.filter((j) => {
      const t = new Date(j.createdAt).getTime()
      return t >= prevStart && t < start
    })

    // Bucketed series for sparklines and the overview chart
    const buckets = range === 7 ? 7 : range === 30 ? 10 : 12
    const size = (range * DAY) / buckets
    const series = Array.from({ length: buckets }, (_, i) => {
      const from = start + i * size
      const to = from + size
      const slice = candidates.filter((c) => dateOf(c) >= from && dateOf(c) < to)
      return {
        name: new Date(from).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        applied: slice.length,
        shortlisted: reached(slice, 'SHORTLISTED').length,
        offers: reached(slice, 'OFFER').length,
        jobs: jobs.filter((j) => {
          const t = new Date(j.createdAt).getTime()
          return t >= from && t < to
        }).length,
      }
    })

    const funnel = STAGES.map((stage, i) => {
      const count = candidates.filter((c) => c.status !== 'REJECTED' && stageIndex(c.status) >= i).length
      return { stage: stage.charAt(0) + stage.slice(1).toLowerCase(), count }
    })

    const scored = candidates.filter((c) => typeof c.aiMatchScore === 'number')
    const avgMatch = scored.length ? Math.round(scored.reduce((s, c) => s + (c.aiMatchScore ?? 0), 0) / scored.length) : 0
    const strong = scored.filter((c) => (c.aiMatchScore ?? 0) >= 70).length
    const strongPct = scored.length ? Math.round((strong / scored.length) * 100) : 0

    const topCandidates = [...scored].sort((a, b) => (b.aiMatchScore ?? 0) - (a.aiMatchScore ?? 0)).slice(0, 5)

    const upcoming = interviews
      .filter((i) => i.status === 'SCHEDULED' && new Date(i.scheduledAt).getTime() >= now)
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
      .slice(0, 5)

    const recent = [...candidates].sort((a, b) => dateOf(b) - dateOf(a)).slice(0, 6)

    return {
      stats: {
        activeJobs: activeJobs.length,
        activeJobsChange: pctChange(jobsInRange.length, jobsInPrev.length),
        candidates: inRange.length,
        candidatesChange: pctChange(inRange.length, inPrev.length),
        shortlisted: reached(inRange, 'SHORTLISTED').length,
        shortlistedChange: pctChange(reached(inRange, 'SHORTLISTED').length, reached(inPrev, 'SHORTLISTED').length),
        offers: reached(inRange, 'OFFER').length,
        offersChange: pctChange(reached(inRange, 'OFFER').length, reached(inPrev, 'OFFER').length),
        totalCandidates: candidates.length,
      },
      series,
      funnel,
      avgMatch,
      strongPct,
      scoredCount: scored.length,
      topCandidates,
      upcoming,
      recent,
    }
  }, [jobs, candidates, interviews, range])

  return { ...data, isLoading, error }
}
