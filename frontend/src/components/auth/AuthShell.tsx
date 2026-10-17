import { Link } from 'react-router-dom'
import { Wordmark } from '@/components/layout/Wordmark'

const SAMPLE = [
  { name: 'Meera Iyer', evidence: '6 years of Java, led a payments migration', score: 94 },
  { name: 'Aarav Mehta', evidence: 'Spring Boot and Kafka in production, no Kubernetes', score: 91 },
  { name: 'Isha Kapoor', evidence: 'Strong system design, one year short on experience', score: 88 },
]

function ShowcasePanel() {
  return (
    <aside
      className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-center lg:px-14 xl:px-20"
      style={{ backgroundColor: 'var(--color-band)', color: '#f5f2ec' }}
      aria-label="What NexHire does"
    >
      <svg viewBox="0 0 400 400" className="pointer-events-none absolute -bottom-24 -right-24 h-[30rem] w-[30rem]" aria-hidden="true">
        <circle cx="200" cy="200" r="190" fill="none" stroke="#ff6000" strokeWidth="2" opacity="0.5" />
        <circle cx="200" cy="200" r="140" fill="none" stroke="#ff6000" strokeWidth="2" opacity="0.32" />
        <circle cx="200" cy="200" r="90" fill="#ff6000" opacity="0.9" />
      </svg>

      <div className="relative max-w-[34rem]">
        <h2 className="font-display text-display-sm font-bold xl:text-display-md">Every resume read, every score explained.</h2>
        <p className="mt-4 max-w-md text-body-lg" style={{ color: 'rgba(245,242,236,0.78)' }}>
          NexHire reads each resume against the job, scores the match, and shows the evidence behind the number.
        </p>

        <div className="mt-10 rounded-xl p-6" style={{ backgroundColor: '#ffffff', color: '#1c1917' }} role="img" aria-label="Example of a ranked shortlist">
          <div className="flex items-baseline justify-between">
            <p className="font-display text-body-lg font-bold">Senior Java Developer</p>
            <p className="text-body-xs font-semibold" style={{ color: '#57524a' }}>Example shortlist</p>
          </div>
          <ol className="mt-4 divide-y" style={{ borderColor: '#e6e1d8' }}>
            {SAMPLE.map((c) => (
              <li key={c.name} className="flex items-center gap-4 py-3" style={{ borderColor: '#e6e1d8' }}>
                <div className="min-w-0 flex-1">
                  <p className="text-body-sm font-semibold">{c.name}</p>
                  <p className="text-body-xs" style={{ color: '#57524a' }}>{c.evidence}</p>
                </div>
                <div className="flex w-24 items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-sm" style={{ backgroundColor: '#eeeae3' }}>
                    <div className="h-full rounded-sm" style={{ width: `${c.score}%`, backgroundColor: '#ff6000' }} />
                  </div>
                  <span className="font-display text-body-sm font-bold tabular" style={{ color: '#b83f00' }}>{c.score}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </aside>
  )
}

interface AuthShellProps {
  children: React.ReactNode
  footer?: React.ReactNode
}

export function AuthShell({ children, footer }: AuthShellProps) {
  return (
    <div className="grid min-h-screen bg-[var(--color-bg)] lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <div className="flex flex-col px-6 py-8 sm:px-12 lg:px-14 xl:px-20">
        <Link to="/" className="w-fit text-ink-900 dark:text-ink-100" aria-label="NexHire home">
          <Wordmark />
        </Link>

        <div className="flex flex-1 items-center py-10">
          <div className="w-full max-w-[420px]">{children}</div>
        </div>

        {footer && <div className="text-body-xs text-ink-600 dark:text-ink-400">{footer}</div>}
      </div>
      <ShowcasePanel />
    </div>
  )
}
