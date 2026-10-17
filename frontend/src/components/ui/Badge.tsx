import { HTMLAttributes } from 'react'
import { cn } from '@/utils/helpers'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info' | 'outline'
  size?: 'sm' | 'md'
}

export function Badge({ className, variant = 'default', size = 'md', children, ...props }: BadgeProps) {
  const variantClasses = {
    default: 'badge-default',
    primary: 'badge-primary',
    success: 'badge-success',
    warning: 'badge-warning',
    error: 'badge-error',
    info: 'badge-info',
    outline: 'badge-outline',
  }
  const sizeClasses = {
    sm: 'badge-sm',
    md: '',
  }

  return (
    <span className={cn('badge', variantClasses[variant], sizeClasses[size], className)} {...props}>
      {children}
    </span>
  )
}

Badge.displayName = 'Badge'

// Status-specific badges
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const variantMap: Record<string, BadgeProps['variant']> = {
    APPLIED: 'default',
    SCREENING: 'warning',
    SHORTLISTED: 'primary',
    INTERVIEW: 'info',
    SELECTED: 'success',
    REJECTED: 'error',
    ACTIVE: 'success',
    OPEN: 'success',
    ARCHIVED: 'outline',
    DRAFT: 'default',
    CLOSED: 'outline',
    SCHEDULED: 'info',
    COMPLETED: 'success',
    CANCELLED: 'error',
    NO_SHOW: 'error',
    ASSIGNED: 'default',
    IN_PROGRESS: 'info',
    SUBMITTED: 'warning',
    GRADED: 'success',
    EXPIRED: 'outline',
  }

  const labelMap: Record<string, string> = {
    APPLIED: 'Applied',
    SCREENING: 'Screening',
    SHORTLISTED: 'Shortlisted',
    INTERVIEW: 'Interview',
    SELECTED: 'Selected',
    REJECTED: 'Rejected',
    ACTIVE: 'Active',
    OPEN: 'Open',
    ARCHIVED: 'Archived',
    DRAFT: 'Draft',
    CLOSED: 'Closed',
    SCHEDULED: 'Scheduled',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
    NO_SHOW: 'No Show',
    ASSIGNED: 'Sent',
    IN_PROGRESS: 'In progress',
    SUBMITTED: 'Needs review',
    GRADED: 'Graded',
    EXPIRED: 'Expired',
  }

  return <Badge variant={variantMap[status] || 'default'} className={className}>{labelMap[status] || status}</Badge>
}