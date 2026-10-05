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
    ASSESSMENT: 'info',
    INTERVIEW: 'info',
    OFFER: 'success',
    HIRED: 'success',
    REJECTED: 'error',
    ACTIVE: 'success',
    DRAFT: 'default',
    CLOSED: 'outline',
    SCHEDULED: 'info',
    COMPLETED: 'success',
    CANCELLED: 'error',
    NO_SHOW: 'error',
  }

  const labelMap: Record<string, string> = {
    APPLIED: 'Applied',
    SCREENING: 'Screening',
    SHORTLISTED: 'Shortlisted',
    ASSESSMENT: 'Assessment',
    INTERVIEW: 'Interview',
    OFFER: 'Offer',
    HIRED: 'Hired',
    REJECTED: 'Rejected',
    ACTIVE: 'Active',
    DRAFT: 'Draft',
    CLOSED: 'Closed',
    SCHEDULED: 'Scheduled',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
    NO_SHOW: 'No Show',
  }

  return <Badge variant={variantMap[status] || 'default'} className={className}>{labelMap[status] || status}</Badge>
}