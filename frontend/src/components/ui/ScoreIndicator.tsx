import { cn } from '@/utils/helpers'

interface ScoreIndicatorProps {
  score: number
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  label?: string
  className?: string
}

export function ScoreIndicator({ score, size = 'md', showLabel = true, label, className }: ScoreIndicatorProps) {
  const sizeClasses = {
    sm: 'score-circle-sm text-body-xs',
    md: 'score-circle-md text-body-sm',
    lg: 'score-circle-lg text-body-md',
  }

  const getColor = (s: number) => {
    if (s >= 80) return 'text-mint-600 dark:text-mint-400'
    if (s >= 60) return 'text-peach-600 dark:text-peach-400'
    if (s >= 40) return 'text-lavender-500 dark:text-lavender-400'
    return 'text-pink-600 dark:text-pink-400'
  }

  const getBgColor = (s: number) => {
    if (s >= 80) return 'bg-mint-100 dark:bg-mint-900/30'
    if (s >= 60) return 'bg-peach-100 dark:bg-peach-900/30'
    if (s >= 40) return 'bg-lavender-100 dark:bg-lavender-900/30'
    return 'bg-pink-100 dark:bg-pink-900/30'
  }

  const strokeColor = getColor(score)
  const bgColor = getBgColor(score)
  const textColor = getColor(score)

  const radius = size === 'sm' ? 16 : size === 'md' ? 22 : 32
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  return (
    <div className={cn('score-indicator flex flex-col items-center', className)}>
      <div className="relative">
        <svg className="transform -rotate-90" width={size === 'sm' ? 40 : size === 'md' ? 56 : 80} height={size === 'sm' ? 40 : size === 'md' ? 56 : 80}>
          <circle
            className={cn('stroke-glass-200 dark:stroke-glass-dark-200', bgColor.replace('bg-', 'fill-'))}
            strokeWidth="4"
            fill="transparent"
            cx={size === 'sm' ? 20 : size === 'md' ? 28 : 40}
            cy={size === 'sm' ? 20 : size === 'md' ? 28 : 40}
            r={radius}
          />
          <circle
            className={cn('transition-all duration-1000 ease-out', strokeColor.replace('text-', 'stroke-'))}
            strokeWidth="4"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            fill="transparent"
            cx={size === 'sm' ? 20 : size === 'md' ? 28 : 40}
            cy={size === 'sm' ? 20 : size === 'md' ? 28 : 40}
            r={radius}
            style={{ strokeDasharray: circumference, strokeDashoffset: offset }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn('font-semibold', sizeClasses[size], textColor)}>
            {score}
          </span>
        </div>
      </div>
      {(showLabel || label) && (
        <span className="text-label-sm text-ink-500 dark:text-ink-400 mt-2 text-center">
          {label || (score >= 80 ? 'Strong Match' : score >= 60 ? 'Good Match' : score >= 40 ? 'Moderate Match' : 'Weak Match')}
        </span>
      )}
    </div>
  )
}

interface ScoreBreakdownProps {
  breakdown: {
    skills: number
    experience: number
    education: number
    jobRelevance: number
  }
  className?: string
}

export function ScoreBreakdown({ breakdown, className }: ScoreBreakdownProps) {
  const items = [
    { label: 'Skills', value: breakdown.skills },
    { label: 'Experience', value: breakdown.experience },
    { label: 'Education', value: breakdown.education },
    { label: 'Job Relevance', value: breakdown.jobRelevance },
  ]

  return (
    <div className={cn('grid grid-cols-2 gap-4', className)}>
      {items.map((item) => (
        <div key={item.label} className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-label-sm text-ink-700 dark:text-ink-300">{item.label}</span>
            <span className="text-label-sm font-medium text-ink-900 dark:text-ink-100">{item.value}%</span>
          </div>
          <div className="h-2 bg-glass-200 dark:bg-glass-dark-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-lavender-500 rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${item.value}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

interface AITagsProps {
  matchingSkills?: string[]
  relevantExperience?: string[]
  potentialGaps?: string[]
  className?: string
}

export function AITags({ matchingSkills = [], relevantExperience = [], potentialGaps = [], className }: AITagsProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {matchingSkills.length > 0 && (
        <div>
          <h4 className="text-label-sm text-ink-700 dark:text-ink-300 mb-2 flex items-center gap-1.5">
            <svg className="w-4 h-4 text-mint-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Matching Skills
          </h4>
          <div className="flex flex-wrap gap-2">
            {matchingSkills.map((skill) => (
              <span key={skill} className="badge-mint text-body-xs">
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}
      {relevantExperience.length > 0 && (
        <div>
          <h4 className="text-label-sm text-ink-700 dark:text-ink-300 mb-2 flex items-center gap-1.5">
            <svg className="w-4 h-4 text-lavender-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 002-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Relevant Experience
          </h4>
          <div className="space-y-1">
            {relevantExperience.map((exp, i) => (
              <p key={i} className="text-body-sm text-ink-600 dark:text-ink-400 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-lavender-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                {exp}
              </p>
            ))}
          </div>
        </div>
      )}
      {potentialGaps.length > 0 && (
        <div>
          <h4 className="text-label-sm text-ink-700 dark:text-ink-300 mb-2 flex items-center gap-1.5">
            <svg className="w-4 h-4 text-peach-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Potential Gaps
          </h4>
          <div className="flex flex-wrap gap-2">
            {potentialGaps.map((gap) => (
              <span key={gap} className="badge-peach text-body-xs">
                {gap}
              </span>
            ))}
          </div>
        </div>
      )}
      {(matchingSkills.length === 0 && relevantExperience.length === 0 && potentialGaps.length === 0) && (
        <p className="text-body-sm text-ink-500 dark:text-ink-400 text-center py-4">
          AI analysis not available
        </p>
      )}
    </div>
  )
}