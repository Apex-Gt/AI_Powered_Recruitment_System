import { ReactNode } from 'react'
import { cn } from '@/utils/helpers'
import { ScoreIndicator, ScoreBreakdown, AITags } from './ScoreIndicator'

interface AIAnalysisCardProps {
  overallScore: number
  breakdown?: {
    skills: number
    experience: number
    education: number
    jobRelevance: number
  }
  matchingSkills?: string[]
  relevantExperience?: string[]
  potentialGaps?: string[]
  summary?: string
  generatedAt?: string
  className?: string
  children?: ReactNode
}

export function AIAnalysisCard({
  overallScore,
  breakdown,
  matchingSkills = [],
  relevantExperience = [],
  potentialGaps = [],
  summary,
  generatedAt,
  className,
  children,
}: AIAnalysisCardProps) {
  return (
    <div className={cn('ai-analysis-card', className)}>
      <div className="ai-analysis-card-header">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <span>AI Analysis</span>
        <span className="text-body-xs text-accent-500 dark:text-accent-400 ml-auto">
          AI-generated
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1 flex flex-col items-center">
          <ScoreIndicator score={overallScore} size="lg" label="Overall Match" />
          {summary && (
            <p className="text-body-sm text-ink-600 dark:text-ink-400 mt-4 text-center line-clamp-3">{summary}</p>
          )}
        </div>

        {breakdown && (
          <div className="lg:col-span-2 space-y-6">
            <ScoreBreakdown breakdown={breakdown} />
            <AITags
              matchingSkills={matchingSkills}
              relevantExperience={relevantExperience}
              potentialGaps={potentialGaps}
            />
          </div>
        )}

        {children && <div className="lg:col-span-3">{children}</div>}
      </div>

      {generatedAt && (
        <p className="text-body-xs text-ink-400 dark:text-ink-500 mt-4 text-right">
          Generated {generatedAt}
        </p>
      )}
    </div>
  )
}

interface AIAnalysisCompactProps {
  score: number
  label?: string
  matchingSkills?: string[]
  potentialGaps?: string[]
  className?: string
}

export function AIAnalysisCompact({ score, label, matchingSkills = [], potentialGaps = [], className }: AIAnalysisCompactProps) {
  const getColor = (s: number) => {
    if (s >= 80) return 'text-success-600 dark:text-success-400 bg-success-100 dark:bg-success-900/30'
    if (s >= 60) return 'text-warning-600 dark:text-warning-400 bg-warning-100 dark:bg-warning-900/30'
    if (s >= 40) return 'text-accent-500 dark:text-accent-400 bg-accent-100 dark:bg-accent-900/30'
    return 'text-error-600 dark:text-error-400 bg-error-100 dark:bg-error-900/30'
  }

  const colorClass = getColor(score)

  return (
    <div className={cn('ai-analysis-card p-4', className)}>
      <div className="flex items-center gap-4">
        <div className={cn('flex items-center justify-center w-14 h-14 rounded-xl', colorClass)}>
          <span className="text-heading-sm font-bold">{score}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-label-md text-ink-900 dark:text-ink-100">{label || 'AI Match'}</p>
          <p className="text-body-xs text-ink-500 dark:text-ink-400">AI-generated analysis</p>
        </div>
      </div>

      {(matchingSkills.length > 0 || potentialGaps.length > 0) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {matchingSkills.slice(0, 3).map((skill) => (
            <span key={skill} className="badge-success text-body-xs">
              {skill}
            </span>
          ))}
          {potentialGaps.slice(0, 2).map((gap) => (
            <span key={gap} className="badge-warning text-body-xs">
              {gap}
            </span>
          ))}
          {(matchingSkills.length > 3 || potentialGaps.length > 2) && (
            <span className="badge-outline text-body-xs">
              +{matchingSkills.length - 3 + potentialGaps.length - 2} more
            </span>
          )}
        </div>
      )}
    </div>
  )
}