import { Link } from 'react-router-dom'
import { Wordmark } from '@/components/layout/AppBand'

const SAMPLE = [
  { name: 'Meera Iyer', evidence: '6 years of Java, led a payments migration', score: 94 },
  { name: 'Aarav Mehta', evidence: 'Spring Boot and Kafka in production, no Kubernetes', score: 91 },
  { name: 'Isha Kapoor', evidence: 'Strong system design, one year short on experience', score: 88 },
]

function ShowcasePanel() {
  return (
    <aside
      className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-center lg:px-14 xl:px-20"
      style={{ backgroundColor: 'var(--color-band)', color: '#fefae0' }}
      aria-label="What NexHire does"
    >
      <svg viewBox="0 0 200 200" className="pointer-events-none absolute -bottom-16 -right-16 h-[26rem] w-[26rem]" aria-hidden="true">
        <path d="M20 190C20 90 80 20 190 20c0 100-60 170-170 170Z" fill="#547133" opacity="0.28" />
        <path d="M20 190 150 60" stroke="#fefae0" strokeOpacity="0.18" strokeWidth="2" strokeLinecap="round" fill="none" />
      </svg>

      <div className="relative max-w-[34rem]">
        <h2 className="font-display text-display-sm font-bold xl:text-display-md">Every resume read, every score explained.</h2>
        <p className="mt-4 max-w-md text-body-lg" style={{ color: 'rgba(254,250,224,0.78)' }}>
          NexHire reads each resume against the job, scores the match, and shows the evidence behind the number.
        </p>

        <div className="mt-10 rounded-xl p-6" style={{ backgroundColor: '#fefae0', color: '#283618' }} role="img" aria-label="Example of a ranked shortlist">
          <div className="flex items-baseline justify-between">
            <p className="font-display text-body-lg font-bold">Senior Java Developer</p>
            <p className="text-body-xs font-semibold" style={{ color: '#5b6347' }}>Example shortlist</p>
          </div>
          <ol className="mt-4 divide-y" style={{ borderColor: '#dedab9' }}>
            {SAMPLE.map((c) => (
              <li key={c.name} className="flex items-center gap-4 py-3" style={{ borderColor: '#dedab9' }}>
                <div className="min-w-0 flex-1">
                  <p className="text-body-sm font-semibold">{c.name}</p>
                  <p className="text-body-xs" style={{ color: '#5b6347' }}>{c.evidence}</p>
                </div>
                <div className="flex w-24 items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-sm" style={{ backgroundColor: '#e5e1bd' }}>
                    <div className="h-full rounded-sm" style={{ width: `${c.score}%`, backgroundColor: '#bc6c25' }} />
                  </div>
                  <span className="font-display text-body-sm font-bold tabular" style={{ color: '#96561e' }}>{c.score}</span>
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
