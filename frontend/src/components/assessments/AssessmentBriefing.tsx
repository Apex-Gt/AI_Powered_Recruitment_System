import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import type { PublicAssessment } from '@/types'
import { RoundRail } from '@/components/assessments/RoundRail'

/** Each step of the pre-test briefing is its own component; the page decides which one is on screen. */

function Heading({ children }: { children: ReactNode }) {
  return <h2 className="text-heading-md font-bold text-ink-950 dark:text-ink-100">{children}</h2>
}

function Points({ items, icon }: { items: ReactNode[]; icon: ReactNode }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2.5 text-body-md text-ink-700 dark:text-ink-200">
          <span className="mt-1 flex-shrink-0">{icon}</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

/** The numbers and the one warning that matter most; stays beside every step. */
export function BriefingFacts({ assessment }: { assessment: PublicAssessment }) {
  const first = assessment.rounds[0]
  const rows: [string, string][] = [
    ['Rounds', String(assessment.rounds.length)],
    ['Questions', String(assessment.questionCount)],
    ['Total time', `${assessment.duration} min`],
  ]
  return (
    <div className="space-y-4">
      <dl className="divide-y divide-base-200 rounded-lg border border-base-200 dark:divide-base-700 dark:border-base-700">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between px-3 py-2">
            <dt className="text-body-sm text-ink-600 dark:text-ink-300">{label}</dt>
            <dd className="font-display text-body-lg font-bold tabular-nums text-ink-950 dark:text-ink-100">{value}</dd>
          </div>
        ))}
      </dl>
      <div role="note" className="flex items-start gap-2.5 rounded-lg bg-warning-100 p-3 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
        <p className="text-body-xs">
          <strong>Read this first.</strong> The timer for {assessment.rounds.length > 1 && first ? first.title : 'the assessment'} starts the moment you press Start. It cannot be paused, and you get one attempt.
        </p>
      </div>
    </div>
  )
}

/** Step: how the test is built. */
export function RoundsStep({ assessment }: { assessment: PublicAssessment }) {
  const { rounds } = assessment
  const multiRound = rounds.length > 1
  return (
    <section className="space-y-3" aria-label={multiRound ? 'The rounds' : 'The round'}>
      <Heading>{multiRound ? 'The rounds' : 'The round'}</Heading>
      {multiRound && <RoundRail rounds={rounds} />}
      <div className="overflow-x-auto rounded-lg border border-base-200 bg-white dark:border-base-700 dark:bg-surface-dark-card">
        <table className="w-full min-w-[28rem] text-left text-body-sm">
          <caption className="sr-only">Rounds in this assessment with their time limits and number of questions</caption>
          <thead className="border-b border-base-200 bg-base-50 text-ink-600 dark:border-base-700 dark:bg-base-800/50 dark:text-ink-300">
            <tr>
              <th scope="col" className="w-10 px-3 py-2 font-semibold">#</th>
              <th scope="col" className="px-3 py-2 font-semibold">Round</th>
              <th scope="col" className="px-3 py-2 font-semibold">Time limit</th>
              <th scope="col" className="px-3 py-2 font-semibold">Questions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-base-200 dark:divide-base-700">
            {rounds.map((r, i) => (
              <tr key={i} className="align-top">
                <td className="px-3 py-2.5 text-ink-500 dark:text-ink-400">{i + 1}</td>
                <td className="px-3 py-2.5">
                  <p className="font-semibold text-ink-900 dark:text-ink-100">{r.title}</p>
                  {r.description?.trim() && <p className="mt-0.5 whitespace-pre-wrap text-body-xs text-ink-600 dark:text-ink-300">{r.description}</p>}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-ink-800 dark:text-ink-100">{r.durationMinutes} min</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-ink-800 dark:text-ink-100">{r.questionCount}</td>
              </tr>
            ))}
          </tbody>
          {multiRound && (
            <tfoot className="border-t border-base-200 bg-base-50 font-semibold text-ink-900 dark:border-base-700 dark:bg-base-800/50 dark:text-ink-100">
              <tr>
                <td className="px-3 py-2" colSpan={2}>Total</td>
                <td className="whitespace-nowrap px-3 py-2">{assessment.duration} min</td>
                <td className="whitespace-nowrap px-3 py-2">{assessment.questionCount}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  )
}

/** Step: the rules. */
export function RulesStep({ assessment }: { assessment: PublicAssessment }) {
  const { rounds } = assessment
  const multiRound = rounds.length > 1
  const closesAt = new Date(assessment.expiresAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  const rules: ReactNode[] = [
    <>You can take this assessment <strong>once</strong>. It cannot be restarted after you begin.</>,
    multiRound ? (
      <>The {rounds.length} rounds are taken <strong>in order</strong>, each with its own timer. When you submit a round, or its time runs out, the next one <strong>starts automatically</strong> a few seconds later.</>
    ) : (
      <>The timer starts when you press Start.</>
    ),
    <>A timer <strong>cannot be paused</strong>. Closing the page, losing your connection or switching tabs does not stop it.</>,
    <>When a round&apos;s time ends, the answers you have given are sent automatically. {multiRound ? 'A submitted round cannot be reopened, and you cannot go back to it.' : 'You cannot reopen the assessment afterwards.'}</>,
    <>Unanswered questions score zero, so give every question an answer before you submit.</>,
    <>Open this link before <strong>{closesAt}</strong>. After that it stops working.</>,
    <>Your answers are reviewed by the recruiting team. Code and essay answers are scored with the help of AI, and video answers are reviewed by a person.</>,
  ]
  return (
    <section className="space-y-3" aria-label="Rules to follow">
      <Heading>Rules to follow</Heading>
      <ol className="list-decimal space-y-2 pl-5 text-body-md text-ink-700 marker:font-semibold dark:text-ink-200">
        {rules.map((r, i) => (
          <li key={i} className="pl-1">{r}</li>
        ))}
      </ol>
    </section>
  )
}

/** Step: what to do and what to avoid. */
export function DoDontStep({ assessment }: { assessment: PublicAssessment }) {
  const dos: ReactNode[] = [
    <>Set aside <strong>{assessment.duration} minutes</strong> without interruptions, plus a few minutes to read and submit.</>,
    <>Use a laptop or desktop with an up-to-date browser and a stable internet connection.</>,
    <>Keep the assessment open in <strong>one browser tab</strong> and keep an eye on the timer at the top of the page.</>,
    <>Read every question and all of its options before answering.</>,
    <>Submit before the timer reaches 00:00 instead of waiting for the automatic submit.</>,
    <>If a question asks for a video answer, have your private video link ready to paste.</>,
  ]
  const donts: ReactNode[] = [
    <>Don&apos;t close the tab or browser, or use the Back button, while a round is running.</>,
    <>Don&apos;t open the assessment on several devices or tabs at the same time.</>,
    <>Don&apos;t take help from other people, and don&apos;t share or copy the questions.</>,
    <>Don&apos;t leave your answers to the last few seconds. A slow connection can make you miss the deadline.</>,
    <>Don&apos;t leave questions blank if you can make an attempt.</>,
  ]
  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
      <section className="space-y-3" aria-label="Do">
        <Heading>Do</Heading>
        <Points items={dos} icon={<CheckCircle2 className="h-4 w-4 text-success-500" aria-hidden="true" />} />
      </section>
      <section className="space-y-3" aria-label="Don't">
        <Heading>Don&apos;t</Heading>
        <Points items={donts} icon={<XCircle className="h-4 w-4 text-error-500" aria-hidden="true" />} />
      </section>
    </div>
  )
}

/** Step: what to do if something goes wrong. */
export function IssuesStep({ assessment }: { assessment: PublicAssessment }) {
  const issues: { title: string; text: ReactNode }[] = [
    {
      title: 'Your internet drops',
      text: 'Stay on the page and let it reconnect, then submit. Your typed answers stay in this tab, but the clock keeps running, so time spent offline is lost.',
    },
    {
      title: 'The page closes or the browser crashes',
      text: 'Open the same link from your email again. The assessment carries on by itself with the time that is left, because the timer is kept on our side and a refresh never resets it. Answers that were only typed (not submitted) may need to be entered again.',
    },
    {
      title: 'The time ran out or the link expired',
      text: `Contact the recruiter at ${assessment.companyName}. They can send you a new link.`,
    },
    {
      title: 'You see an error or cannot submit',
      text: `Keep the page open, take a screenshot of what you see, and contact the recruiter at ${assessment.companyName} straight away.`,
    },
  ]
  return (
    <section className="space-y-3" aria-label="If something goes wrong">
      <Heading>If something goes wrong</Heading>
      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
        {issues.map((issue) => (
          <div key={issue.title}>
            <dt className="text-body-md font-semibold text-ink-900 dark:text-ink-100">{issue.title}</dt>
            <dd className="mt-0.5 text-body-sm text-ink-700 dark:text-ink-200">{issue.text}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
