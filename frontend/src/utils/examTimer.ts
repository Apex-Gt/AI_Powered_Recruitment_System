export type TimerTone = 'green' | 'yellow' | 'orange' | 'red'

/**
 * Colour of the countdown by time left in the round:
 * green above 10 minutes, yellow above 8 up to 10, orange from 5 to 8, red under 5.
 */
export function timerTone(secondsLeft: number): TimerTone {
  if (secondsLeft > 10 * 60) return 'green'
  if (secondsLeft > 8 * 60) return 'yellow'
  if (secondsLeft >= 5 * 60) return 'orange'
  return 'red'
}

/** Classes for the timer pill. Explicit colours: the theme itself has no greens or yellows to lean on. */
export const TIMER_STYLES: Record<TimerTone, { pill: string; hint: string | null }> = {
  green: {
    pill: 'border-[#16a34a] bg-[#dcfce7] text-[#166534] dark:bg-[#16a34a]/20 dark:text-[#86efac]',
    hint: null,
  },
  yellow: {
    pill: 'border-[#ca8a04] bg-[#fef9c3] text-[#854d0e] dark:bg-[#eab308]/20 dark:text-[#fde047]',
    hint: 'Under 10 minutes left',
  },
  orange: {
    pill: 'border-[#ea580c] bg-[#ffedd5] text-[#9a3412] dark:bg-[#ea580c]/20 dark:text-[#fdba74]',
    hint: 'Under 8 minutes left',
  },
  red: {
    pill: 'border-[#dc2626] bg-[#fee2e2] text-[#991b1b] dark:bg-[#dc2626]/20 dark:text-[#fca5a5]',
    hint: 'Under 5 minutes left',
  },
}

/** mm:ss, or h:mm:ss for rounds an hour or longer. */
export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(safe / 3600)
  const m = Math.floor((safe % 3600) / 60)
  const s = safe % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}
