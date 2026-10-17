import { cn } from '@/utils/helpers'

/** The NexHire mark: an orange tile with an N cut from the page colour, then the name. */
export function Wordmark({ className, showText = true }: { className?: string; showText?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5 font-display text-[1.375rem] font-extrabold tracking-tight', className)}>
      <svg viewBox="0 0 28 28" className="h-7 w-7 flex-shrink-0" aria-hidden="true">
        <rect width="28" height="28" rx="7" fill="#ff6000" />
        <path d="M9 20V8.5l10 11V8" fill="none" stroke="#1c1917" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {showText && <span>NexHire</span>}
    </span>
  )
}
