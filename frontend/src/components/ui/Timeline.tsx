import { ReactNode } from 'react'
import { cn } from '@/utils/helpers'

interface TimelineItem {
  id: string
  title: string
  description?: string
  timestamp: string
  type?: 'default' | 'success' | 'warning' | 'error' | 'info'
  icon?: ReactNode
  meta?: ReactNode
}

interface TimelineProps {
  items: TimelineItem[]
  className?: string
  reverse?: boolean
}

export function Timeline({ items, className, reverse = false }: TimelineProps) {
  const typeColors = {
    default: 'bg-base-300 dark:bg-base-600',
    success: 'bg-success-500',
    warning: 'bg-warning-500',
    error: 'bg-error-500',
    info: 'bg-accent-500',
  }

  const orderedItems = reverse ? [...items].reverse() : items

  return (
    <div className={cn('relative', className)}>
      <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-base-200 dark:bg-base-700" aria-hidden="true" />
      <div className="space-y-6 relative">
        {orderedItems.map((item, index) => (
          <div key={item.id} className="relative flex gap-4">
            <div className="relative flex-shrink-0 w-6 h-6 flex items-center justify-center z-10">
              <div
                className={cn(
                  'w-2.5 h-2.5 rounded-full border-2 border-base-100 dark:border-base-950',
                  typeColors[item.type || 'default']
                )}
              />
              {index < orderedItems.length - 1 && (
                <div className="absolute left-1/2 top-6 bottom-0 w-0.5 -translate-x-1/2 bg-base-200 dark:bg-base-700" aria-hidden="true" />
              )}
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-heading-sm text-ink-900 dark:text-ink-100">{item.title}</p>
                  {item.description && (
                    <p className="text-body-sm text-ink-500 dark:text-ink-400 mt-1">{item.description}</p>
                  )}
                  {item.meta && (
                    <div className="mt-2">{item.meta}</div>
                  )}
                </div>
                <time className="text-body-xs text-ink-400 dark:text-ink-500 whitespace-nowrap flex-shrink-0">
                  {item.timestamp}
                </time>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

interface SimpleTimelineProps {
  items: {
    label: string
    timestamp: string
    status: 'completed' | 'current' | 'pending'
  }[]
  className?: string
}

export function SimpleTimeline({ items, className }: SimpleTimelineProps) {
  return (
    <div className={cn('relative', className)}>
      <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-base-200 dark:bg-base-700" aria-hidden="true" />
      <div className="space-y-4 relative">
        {items.map((item, index) => (
          <div key={index} className="relative flex gap-3">
            <div className="relative flex-shrink-0 w-4 h-4 flex items-center justify-center z-10">
              <div
                className={cn(
                  'w-2 h-2 rounded-full border-2 border-base-100 dark:border-base-950',
                  item.status === 'completed' && 'bg-success-500',
                  item.status === 'current' && 'bg-accent-500 animate-pulse',
                  item.status === 'pending' && 'bg-base-300 dark:bg-base-600'
                )}
              />
              {index < items.length - 1 && (
                <div className="absolute left-1/2 top-4 bottom-0 w-0.5 -translate-x-1/2 bg-base-200 dark:bg-base-700" aria-hidden="true" />
              )}
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <p className={cn('text-body-sm', item.status === 'current' && 'font-medium text-ink-900 dark:text-ink-100', item.status !== 'current' && 'text-ink-600 dark:text-ink-400')}>
                {item.label}
              </p>
              <time className="text-body-xs text-ink-400 dark:text-ink-500">{item.timestamp}</time>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}