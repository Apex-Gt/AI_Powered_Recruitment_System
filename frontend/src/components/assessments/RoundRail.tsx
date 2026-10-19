interface Props {
  rounds: { title: string; durationMinutes: number }[]
}

/** One segment per round, as wide as the round is long: the shape of the whole assessment at a glance. */
export function RoundRail({ rounds }: Props) {
  return (
    <ol className="flex gap-1.5" aria-label="Rounds">
      {rounds.map((r, i) => (
        <li key={i} style={{ flexGrow: Math.max(r.durationMinutes, 1), flexBasis: 0 }} className="min-w-[2.75rem]">
          <div className="h-1.5 rounded-full bg-ink-700 dark:bg-base-300" aria-hidden="true" />
          <p className="mt-1 truncate text-body-xs text-ink-500 dark:text-ink-400">
            {r.title}
            <span>, {r.durationMinutes} min</span>
          </p>
        </li>
      ))}
    </ol>
  )
}
