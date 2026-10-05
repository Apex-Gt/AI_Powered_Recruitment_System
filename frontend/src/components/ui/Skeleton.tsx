import { cn } from '@/utils/helpers'

interface SkeletonProps {
  className?: string
  variant?: 'text' | 'circular' | 'rectangular' | 'card'
  width?: string
  height?: string
  lines?: number
}

export function Skeleton({ className, variant = 'text', width, height, lines = 1 }: SkeletonProps) {
  if (variant === 'card') {
    return (
      <div className={cn('skeleton-card', className)}>
        <div className="flex items-center gap-4">
          <div className="skeleton-avatar" />
          <div className="flex-1 space-y-3">
            <div className="skeleton-title" />
            <div className="skeleton-text-short" />
          </div>
        </div>
        {Array.from({ length: lines - 1 }, (_, i) => (
          <div key={i} className="skeleton-text" />
        ))}
      </div>
    )
  }

  if (variant === 'circular') {
    return (
      <div
        className={cn('skeleton rounded-full', className)}
        style={{ width: width || '40px', height: height || '40px' }}
      />
    )
  }

  if (variant === 'rectangular') {
    return (
      <div
        className={cn('skeleton rounded-xl', className)}
        style={{ width: width || '100%', height: height || '100px' }}
      />
    )
  }

  // text variant
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          className={cn('skeleton rounded', i === lines - 1 && 'w-3/4')}
          style={{ height: '1rem' }}
        />
      ))}
    </div>
  )
}

export function SkeletonTable({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="table-container">
      <table className="table">
        <thead>
          <tr>
            {Array.from({ length: columns }, (_, i) => (
              <th key={i} className="px-4 py-3">
                <div className="skeleton-text h-4 w-3/4" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, row) => (
            <tr key={row}>
              {Array.from({ length: columns }, (_, col) => (
                <td key={col} className="px-4 py-3">
                  <div className="skeleton-text h-5 w-full" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function SkeletonList({ items = 5, hasAvatar = true }: { items?: number; hasAvatar?: boolean }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: items }, (_, i) => (
        <div key={i} className="flex items-center gap-4">
          {hasAvatar && <div className="skeleton-avatar" />}
          <div className="flex-1 space-y-2">
            <div className="skeleton-title" />
            <div className="skeleton-text-short" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('skeleton-card', className)}>
      <div className="skeleton-title w-1/3" />
      <div className="skeleton-text w-full" />
      <div className="skeleton-text w-2/3" />
      <div className="skeleton-text w-1/2" />
    </div>
  )
}

export function SkeletonMetric({ className }: { className?: string }) {
  return (
    <div className={cn('skeleton-card p-6', className)}>
      <div className="flex items-center justify-between">
        <div>
          <div className="skeleton-text w-3/4 mb-2" />
          <div className="skeleton-title w-1/4" />
        </div>
        <div className="skeleton rounded-xl w-12 h-12" />
      </div>
    </div>
  )
}