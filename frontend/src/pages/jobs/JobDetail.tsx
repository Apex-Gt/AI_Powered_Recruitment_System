import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { jobApi, candidateApi } from '@/utils/api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/Badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'
import { Edit, ArrowLeft, Briefcase, MapPin, Calendar, DollarSign, Users, Target, ChevronRight, Plus } from 'lucide-react'
import { formatDate, formatCurrency } from '@/utils/helpers'
import type { Job, Candidate } from '@/types'

export function JobDetail() {
  const { id } = useParams<{ id: string }>()
  const { hasRole } = useAuth()
  const [job, setJob] = useState<Job | null>(null)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'candidates'>('overview')

  useEffect(() => {
    if (!id) return
    const fetchData = async () => {
      setIsLoading(true)
      try {
        // Use appropriate endpoint based on role
        const jobRes = hasRole(['ADMIN']) 
          ? await jobApi.getByIdForAdmin(id)
          : await jobApi.getByIdForRecruiter(id)
        
        const [, candidatesRes] = await Promise.all([
          jobRes,
          candidateApi.getAll({ jobId: id, pageSize: 50 }),
        ])
        // Handle both response formats (direct Job or CommonResponse<Job>)
        const jobData = 'data' in jobRes ? jobRes.data : jobRes
        setJob(jobData)
        setCandidates(candidatesRes.data)
      } catch (error) {
        console.error('Failed to fetch job:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [id, hasRole])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-base-200 dark:bg-base-700 rounded w-1/4" />
          <div className="h-32 bg-base-200 dark:bg-base-700 rounded" />
        </div>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="text-center py-12">
        <EmptyState
          icon={<Briefcase className="w-16 h-16" />}
          title="Job not found"
          description="The job you're looking for doesn't exist or has been removed."
          action={{ label: 'Back to Jobs', onClick: () => {} }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/jobs">
          <Button variant="ghost" size="sm" className="p-2">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-display-md font-bold text-ink-900 dark:text-ink-100">{job.title}</h1>
          <div className="flex flex-wrap items-center gap-3 mt-2">
            <StatusBadge status={job.status} className="text-body-sm" />
            <span className="text-body-sm text-ink-500 dark:text-ink-400">{job.department}</span>
            <span className="text-body-sm text-ink-500 dark:text-ink-400">{job.workMode} • {job.employmentType.replace('_', ' ')}</span>
          </div>
        </div>
        {hasRole(['ADMIN', 'RECRUITER']) && (
          <Link to={`/jobs/${job.id}/edit`}>
            <Button variant="secondary">
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab as (value: string) => void}>
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="candidates">Candidates ({candidates.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <Card padding="lg">
                <CardHeader>
                  <CardTitle>Job Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3 p-4 bg-base-50 dark:bg-base-800/50 rounded-xl">
                      <div className="w-10 h-10 rounded-lg bg-info-100 dark:bg-info-900/30 flex items-center justify-center">
                        <MapPin className="w-5 h-5 text-info-600 dark:text-info-400" />
                      </div>
                      <div>
                        <p className="text-body-xs text-ink-500 dark:text-ink-400">Location</p>
                        <p className="text-body-md font-medium text-ink-900 dark:text-ink-100">{job.location}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-base-50 dark:bg-base-800/50 rounded-xl">
                      <div className="w-10 h-10 rounded-lg bg-accent-100 dark:bg-accent-900/30 flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-accent-600 dark:text-accent-400" />
                      </div>
                      <div>
                        <p className="text-body-xs text-ink-500 dark:text-ink-400">Deadline</p>
                        <p className="text-body-md font-medium text-ink-900 dark:text-ink-100">{formatDate(job.applicationDeadline)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-base-50 dark:bg-base-800/50 rounded-xl">
                      <div className="w-10 h-10 rounded-lg bg-success-100 dark:bg-success-900/30 flex items-center justify-center">
                        <DollarSign className="w-5 h-5 text-success-600 dark:text-success-400" />
                      </div>
                      <div>
                        <p className="text-body-xs text-ink-500 dark:text-ink-400">Salary Range</p>
                        <p className="text-body-md font-medium text-ink-900 dark:text-ink-100">
                          {formatCurrency(job.minimumSalary)} - {formatCurrency(job.maximumSalary)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-base-50 dark:bg-base-800/50 rounded-xl">
                      <div className="w-10 h-10 rounded-lg bg-warning-100 dark:bg-warning-900/30 flex items-center justify-center">
                        <Users className="w-5 h-5 text-warning-600 dark:text-warning-400" />
                      </div>
                      <div>
                        <p className="text-body-xs text-ink-500 dark:text-ink-400">Vacancies</p>
                        <p className="text-body-md font-medium text-ink-900 dark:text-ink-100">{job.vacancies}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-base-50 dark:bg-base-800/50 rounded-xl">
                      <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                        <Target className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <p className="text-body-xs text-ink-500 dark:text-ink-400">Experience Required</p>
                        <p className="text-body-md font-medium text-ink-900 dark:text-ink-100">{job.experienceRequired}+ years</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-base-50 dark:bg-base-800/50 rounded-xl">
                      <div className="w-10 h-10 rounded-lg bg-accent-100 dark:bg-accent-900/30 flex items-center justify-center">
                        <Briefcase className="w-5 h-5 text-accent-600 dark:text-accent-400" />
                      </div>
                      <div>
                        <p className="text-body-xs text-ink-500 dark:text-ink-400">Education</p>
                        <p className="text-body-md font-medium text-ink-900 dark:text-ink-100">{job.educationRequired}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card padding="lg">
                <CardHeader>
                  <CardTitle>Description</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose dark:prose-invert max-w-none text-ink-600 dark:text-ink-400 whitespace-pre-wrap">
                    {job.description}
                  </div>
                </CardContent>
              </Card>

              <Card padding="lg">
                <CardHeader>
                  <CardTitle>Required Skills</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {job.skills.map((skill) => (
                    <span
                      key={skill.id}
                      className="badge-default gap-1"
                    >
                      {skill.skillName}
                      <span className="text-body-xs opacity-75">({skill.weight}%)</span>
                    </span>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="candidates">
              {candidates.length === 0 ? (
                <Card padding="lg" className="text-center">
                  <EmptyState
                    icon={<Users className="w-16 h-16" />}
                    title="No candidates yet"
                    description="Candidates will appear here once they apply to this job."
                  />
                </Card>
              ) : (
                <Card variant="flat" padding="none">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Candidate</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Experience</TableHead>
                          <TableHead>Match Score</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-32">Applied</TableHead>
                          <TableHead className="w-24 text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {candidates.map((candidate) => (
                          <TableRow key={candidate.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-accent-100 dark:bg-accent-900/30 flex items-center justify-center">
                                  <span className="text-label-sm font-medium text-accent-600 dark:text-accent-400">
                                    {candidate.candidateName.charAt(0)}
                                  </span>
                                </div>
                                <span className="font-medium text-ink-900 dark:text-ink-100">{candidate.candidateName}</span>
                              </div>
                            </TableCell>
                            <TableCell><span className="text-body-sm text-ink-500 dark:text-ink-400">{candidate.candidateEmail}</span></TableCell>
                            <TableCell><span className="text-body-sm text-ink-500 dark:text-ink-400">{candidate.experience} yrs</span></TableCell>
                            <TableCell>
                              {candidate.aiMatchScore !== undefined ? (
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-success-600 dark:text-success-400">
                                    {candidate.aiMatchScore}%
                                  </span>
                                </div>
                              ) : (
                                <span className="text-body-sm text-ink-400 dark:text-ink-500">Not analyzed</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={candidate.status} />
                            </TableCell>
                            <TableCell><span className="text-body-sm text-ink-500 dark:text-ink-400">{formatDate(candidate.appliedAt)}</span></TableCell>
                            <TableCell className="text-right">
                              <Link to={`/candidates/${candidate.id}`} className="p-2 text-ink-400 hover:text-ink-600 dark:hover:text-ink-300 rounded-lg hover:bg-base-200 dark:hover:bg-base-800">
                                <ChevronRight className="w-4 h-4" />
                              </Link>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          <Card padding="lg">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link to={`/jobs/${job.id}/edit`}>
                <Button variant="ghost" className="w-full justify-start gap-3" size="lg">
                  <Edit className="w-5 h-5" />
                  <div className="flex-1 text-left">
                    <p className="text-body-md font-medium text-ink-900 dark:text-ink-100">Edit Job</p>
                    <p className="text-body-sm text-ink-500 dark:text-ink-400">Update job details</p>
                  </div>
                </Button>
              </Link>
              <Button variant="ghost" className="w-full justify-start gap-3" size="lg">
                <Plus className="w-5 h-5" />
                <div className="flex-1 text-left">
                  <p className="text-body-md font-medium text-ink-900 dark:text-ink-100">Add Candidate</p>
                  <p className="text-body-sm text-ink-500 dark:text-ink-400">Manually add applicant</p>
                </div>
              </Button>
              <Button variant="ghost" className="w-full justify-start gap-3" size="lg">
                <Target className="w-5 h-5" />
                <div className="flex-1 text-left">
                  <p className="text-body-md font-medium text-ink-900 dark:text-ink-100">Run AI Screening</p>
                  <p className="text-body-sm text-ink-500 dark:text-ink-400">Analyze all candidates</p>
                </div>
              </Button>
            </CardContent>
          </Card>

          <Card padding="lg" variant="flat">
            <CardHeader>
              <CardTitle>Job Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-base-50 dark:bg-base-800/50 rounded-xl">
                <span className="text-body-sm text-ink-500 dark:text-ink-400">Total Applications</span>
                <span className="text-heading-md font-bold text-ink-900 dark:text-ink-100">{candidates.length}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-base-50 dark:bg-base-800/50 rounded-xl">
                <span className="text-body-sm text-ink-500 dark:text-ink-400">Shortlisted</span>
                <span className="text-heading-md font-bold text-success-600 dark:text-success-400">
                  {candidates.filter((c) => c.status === 'SHORTLISTED').length}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-base-50 dark:bg-base-800/50 rounded-xl">
                <span className="text-body-sm text-ink-500 dark:text-ink-400">In Interview</span>
                <span className="text-heading-md font-bold text-purple-600 dark:text-purple-400">
                  {candidates.filter((c) => c.status === 'INTERVIEW').length}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-base-50 dark:bg-base-800/50 rounded-xl">
                <span className="text-body-sm text-ink-500 dark:text-ink-400">Offers Extended</span>
                <span className="text-heading-md font-bold text-accent-600 dark:text-accent-400">
                  {candidates.filter((c) => c.status === 'OFFER').length}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-base-50 dark:bg-base-800/50 rounded-xl">
                <span className="text-body-sm text-ink-500 dark:text-ink-400">Hired</span>
                <span className="text-heading-md font-bold text-green-600 dark:text-green-400">
                  {candidates.filter((c) => c.status === 'HIRED').length}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}