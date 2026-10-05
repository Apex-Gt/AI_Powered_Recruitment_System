import { forwardRef, ButtonHTMLAttributes } from 'react'
import { cn } from '@/utils/helpers'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => {
    const variantClasses = {
      primary: 'btn-primary',
      secondary: 'btn-secondary',
      ghost: 'btn-ghost',
      danger: 'btn-danger',
    }
    const sizeClasses = {
      sm: { primary: 'btn-primary-sm', secondary: 'btn-secondary-sm', ghost: 'btn-ghost-sm', danger: 'btn-danger-sm' },
      md: { primary: 'btn-primary', secondary: 'btn-secondary', ghost: 'btn-ghost', danger: 'btn-danger' },
      lg: { primary: 'btn-primary-lg', secondary: 'btn-secondary-lg', ghost: 'btn-ghost-lg', danger: 'btn-danger-lg' },
    }

    return (
      <button
        ref={ref}
        className={cn(
          'btn',
          variantClasses[variant],
          sizeClasses[size][variant],
          className
        )}
        disabled={disabled || loading}
        aria-busy={loading}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'

export const IconButton = forwardRef<HTMLButtonElement, ButtonProps & { 'aria-label': string }>(
  ({ className, variant = 'ghost', size = 'md', loading, disabled, children, 'aria-label': ariaLabel, ...props }, ref) => {
    const variantClasses = {
      primary: 'btn-primary',
      secondary: 'btn-secondary',
      ghost: 'btn-ghost',
      danger: 'btn-danger',
    }
    const iconSizeClasses = {
      sm: 'btn-icon-sm',
      md: 'btn-icon',
      lg: 'btn-icon-lg',
    }

    return (
      <button
        ref={ref}
        className={cn(
          'btn',
          variantClasses[variant],
          iconSizeClasses[size],
          className
        )}
        disabled={disabled || loading}
        aria-busy={loading}
        aria-label={ariaLabel}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    )
  }
)

IconButton.displayName = 'IconButton'