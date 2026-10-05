import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { candidateApi, resumeApi } from '@/utils/api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/Badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { Timeline } from '@/components/ui/Timeline'
import { ScoreIndicator } from '@/components/ui/ScoreIndicator'
import { AIAnalysisCard } from '@/components/ui/AIAnalysisCard'
import { ArrowLeft, CheckCircle2, XCircle, TrendingUp, AlertCircle, FileText, Download, Eye } from 'lucide-react'
import { formatDate } from '@/utils/helpers'
import type { Candidate, AIAnalysis, Resume } from '@/types'

export function CandidateProfile() {
  const { id } = useParams<{ id: string }>()
  const { hasRole } = useAuth()
  const [candidate, setCandidate] = useState<Candidate | null>(null)
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null)
  const [resume, setResume] = useState<Resume | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'profile' | 'ai-analysis' | 'timeline'>('profile')

  useEffect(() => {
    if (!id) return
    const fetchData = async () => {
      setIsLoading(true)
      try {
        const [candidateRes, aiRes, resumeRes] = await Promise.all([
          candidateApi.getById(id),
          candidateApi.getAiAnalysis(id).catch(() => null),
          candidateApi.getById(id).then((c) => c.resumeId ? resumeApi.getById(c.resumeId!).catch(() => null) : null),
        ])
        setCandidate(candidateRes)
        setAiAnalysis(aiRes)
        setResume(resumeRes)
      } catch (error) {
        console.error('Failed to fetch candidate:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [id])

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

  if (!candidate) {
    return (
      <div className="text-center py-12">
        <Card variant="flat">
          <CardContent className="py-12">
            <p className="text-body-lg text-ink-500 dark:text-ink-400">Candidate not found</p>
            <Link to="/candidates" className="mt-4 inline-block">
              <Button variant="ghost">Back to Candidates</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const timelineEvents = [
    { id: '1', title: 'Application Submitted', description: `Applied for ${candidate.jobTitle}`, timestamp: formatDate(candidate.appliedAt), type: 'info' as const },
    { id: '2', title: 'Status: Applied', description: 'Initial application received', timestamp: formatDate(candidate.appliedAt), type: 'success' as const },
    ...(candidate.status !== 'APPLIED' ? [{ id: '3', title: `Status: ${candidate.status}`, description: `Candidate moved to ${candidate.status}`, timestamp: formatDate(candidate.appliedAt), type: 'info' as const }] : []),
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/candidates">
          <Button variant="ghost" size="sm" className="p-2">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-accent-100 dark:bg-accent-900/30 flex items-center justify-center">
              <span className="text-heading-xl font-bold text-accent-600 dark:text-accent-400">
                {candidate.candidateName.charAt(0)}
              </span>
            </div>
            <div>
              <h1 className="text-display-md font-bold text-ink-900 dark:text-ink-100">{candidate.candidateName}</h1>
              <div className="flex flex-wrap items-center gap-3 mt-1">
                <StatusBadge status={candidate.status} className="text-body-sm" />
                <span className="text-body-sm text-ink-500 dark:text-ink-400">{candidate.jobTitle}</span>
                {candidate.aiMatchScore !== undefined && (
                  <ScoreIndicator score={candidate.aiMatchScore} size="sm" showLabel />
                )}
              </div>
            </div>
          </div>
        </div>
        {hasRole(['ADMIN', 'RECRUITER']) && (
          <div className="flex gap-2">
            <Button variant="secondary">
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Shortlist
            </Button>
            <Button variant="danger">
              <XCircle className="w-4 h-4 mr-2" />
              Reject
            </Button>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab as (value: string) => void} className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="ai-analysis">AI Analysis</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card padding="lg">
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-body-xs text-ink-500 dark:text-ink-400">Email</p>
                    <p className="text-body-md text-ink-900 dark:text-ink-100">{candidate.candidateEmail}</p>
                  </div>
                  <div>
                    <p className="text-body-xs text-ink-500 dark:text-ink-400">Phone</p>
                    <p className="text-body-md text-ink-900 dark:text-ink-100">{candidate.phoneNumber}</p>
                  </div>
                  <div>
                    <p className="text-body-xs text-ink-500 dark:text-ink-400">Experience</p>
                    <p className="text-body-md text-ink-900 dark:text-ink-100">{candidate.experience} years</p>
                  </div>
                  <div>
                    <p className="text-body-xs text-ink-500 dark:text-ink-400">Applied</p>
                    <p className="text-body-md text-ink-900 dark:text-ink-100">{formatDate(candidate.appliedAt)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card padding="lg">
              <CardHeader>
                <CardTitle>Skills</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {candidate.skills.map((skill) => (
                  <span key={skill} className="badge-default gap-1">
                    {skill}
                  </span>
                ))}
                {candidate.skills.length === 0 && (
                  <p className="text-body-sm text-ink-500 dark:text-ink-400">No skills listed</p>
                )}
              </CardContent>
            </Card>

            {resume && (
              <Card padding="lg">
                <CardHeader>
                  <CardTitle>Resume</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-base-50 dark:bg-base-800/50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-info-100 dark:bg-info-900/30 flex items-center justify-center">
                        <FileText className="w-6 h-6 text-info-600 dark:text-info-400" />
                      </div>
                      <div>
                        <p className="font-medium text-ink-900 dark:text-ink-100">{resume.fileName}</p>
                        <p className="text-body-sm text-ink-500 dark:text-ink-400">Uploaded {formatDate(resume.uploadedAt)}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm">
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Download className="w-4 h-4 mr-1" />
                        Download
                      </Button>
                    </div>
                  </div>
                  {resume.extractedText && (
                    <div className="max-h-96 overflow-y-auto p-4 bg-base-50 dark:bg-base-800/50 rounded-xl text-body-sm text-ink-600 dark:text-ink-400 whitespace-pre-wrap">
                      {resume.extractedText}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card padding="lg">
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="primary" className="w-full justify-start gap-3" size="lg">
                  <CheckCircle2 className="w-5 h-5" />
                  <div className="flex-1 text-left">
                    <p className="text-body-md font-medium text-white">Shortlist</p>
                    <p className="text-body-sm text-white/80">Move to shortlisted</p>
                  </div>
                </Button>
                <Button variant="secondary" className="w-full justify-start gap-3" size="lg">
                  <TrendingUp className="w-5 h-5" />
                  <div className="flex-1 text-left">
                    <p className="text-body-md font-medium text-ink-900 dark:text-ink-100">Schedule Interview</p>
                    <p className="text-body-sm text-ink-500 dark:text-ink-400">Set up interview slot</p>
                  </div>
                </Button>
                <Button variant="ghost" className="w-full justify-start gap-3" size="lg">
                  <AlertCircle className="w-5 h-5" />
                  <div className="flex-1 text-left">
                    <p className="text-body-md font-medium text-ink-900 dark:text-ink-100">Reject</p>
                    <p className="text-body-sm text-ink-500 dark:text-ink-400">Decline candidate</p>
                  </div>
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="ai-analysis">
          {aiAnalysis ? (
            <AIAnalysisCard
              overallScore={aiAnalysis.overallScore}
              breakdown={aiAnalysis.breakdown}
              matchingSkills={aiAnalysis.matchingSkills}
              relevantExperience={aiAnalysis.relevantExperience}
              potentialGaps={aiAnalysis.potentialGaps}
              summary={aiAnalysis.summary}
              generatedAt={aiAnalysis.generatedAt}
            />
          ) : (
            <Card padding="lg" className="text-center">
              <CardContent className="py-12">
                <TrendingUp className="w-16 h-16 text-base-400 dark:text-base-600 mx-auto mb-4" />
                <h3 className="text-heading-md font-medium text-ink-900 dark:text-ink-100">No AI Analysis Available</h3>
                <p className="text-body-md text-ink-500 dark:text-ink-400 mt-2">
                  Run AI screening to generate a detailed candidate analysis including skill matching, experience relevance, and hiring recommendation.
                </p>
                <Button className="mt-4">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Run AI Screening
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="timeline">
          <Card padding="lg">
            <CardContent>
              <Timeline items={timelineEvents} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}