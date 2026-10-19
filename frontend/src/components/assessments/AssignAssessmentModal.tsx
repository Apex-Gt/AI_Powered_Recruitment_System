import { useEffect, useMemo, useRef, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { assessmentApi, candidateApi } from '@/utils/api'
import type { Assessment, BulkAssignResult, Candidate } from '@/types'
import { AlertCircle, CheckCircle2, Copy, Search, Send } from 'lucide-react'
import toast from 'react-hot-toast'

interface Props {
  assessment: Assessment | null
  onClose: () => void
}

/**
 * Sends an assessment to many candidates at once: the assessment's job applicants when it belongs to a job,
 * otherwise everyone. Everyone starts ticked; untick anyone who should not get it.
 */
export function AssignAssessmentModal({ assessment, onClose }: Props) {
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [result, setResult] = useState<BulkAssignResult | null>(null)
  const selectAllRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!assessment) return
    let cancelled = false
    setResult(null)
    setFilter('')
    setLoading(true)
    candidateApi
      .getAllUnwrapped({ page: 1, pageSize: 500, ...(assessment.jobId ? { jobId: assessment.jobId } : {}) })
      .then((res) => {
        if (cancelled) return
        const eligible = res.data.filter((c) => c.status !== 'REJECTED')
        setCandidates(eligible)
        setSelected(new Set(eligible.map((c) => c.id)))
      })
      .catch(() => !cancelled && toast.error('Failed to load candidates'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [assessment])

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return q
      ? candidates.filter((c) => c.candidateName.toLowerCase().includes(q) || c.candidateEmail.toLowerCase().includes(q))
      : candidates
  }, [candidates, filter])

  const visibleSelected = visible.filter((c) => selected.has(c.id)).length
  const allVisibleSelected = visible.length > 0 && visibleSelected === visible.length

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = visibleSelected > 0 && !allVisibleSelected
  }, [visibleSelected, allVisibleSelected])

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const toggleAllVisible = () =>
    setSelected((prev) => {
      const next = new Set(prev)
      visible.forEach((c) => (allVisibleSelected ? next.delete(c.id) : next.add(c.id)))
      return next
    })

  const send = async () => {
    if (!assessment || selected.size === 0) return
    setIsSending(true)
    try {
      const res = await assessmentApi.assignMany(assessment.id, [...selected])
      setResult(res)
      if (res.sent.length > 0) {
        toast.success(res.sent.length === 1 ? 'Assessment sent to 1 candidate' : `Assessment sent to ${res.sent.length} candidates`)
      } else {
        toast.error('Nobody was sent the assessment')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send assessment')
    } finally {
      setIsSending(false)
    }
  }

  const copy = async (text: string, message: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(message)
    } catch {
      toast.error('Could not copy, select the link and copy it manually')
    }
  }

  const count = selected.size
  const scope = assessment?.jobId ? `Applicants for ${assessment.jobTitle ?? 'this job'}` : 'All candidates'

  return (
    <Modal isOpen={!!assessment} onClose={onClose} title="Send Assessment" size="lg">
      <div className="space-y-5">
        <p className="text-body-sm text-ink-500 dark:text-ink-400">
          {assessment?.title} - {assessment?.duration} minutes, {assessment?.rounds?.length ?? 1}{' '}
          {(assessment?.rounds?.length ?? 1) === 1 ? 'round' : 'rounds'}, {assessment?.questions.length} questions
        </p>

        {result ? (
          <div className="space-y-4">
            <p className="flex items-center gap-2 text-body-md text-ink-800 dark:text-ink-100">
              <CheckCircle2 className="h-5 w-5 text-success-500" aria-hidden="true" />
              Sent to <strong>{result.sent.length}</strong> {result.sent.length === 1 ? 'candidate' : 'candidates'}.
              {result.sent[0] && <> Links work until {new Date(result.sent[0].expiresAt).toLocaleString()}.</>}
            </p>

            {result.skipped.length > 0 && (
              <div role="alert" className="rounded-xl bg-warning-100 p-4 text-body-sm text-warning-700 dark:bg-warning-900/30 dark:text-warning-300">
                <p className="flex items-center gap-2 font-medium">
                  <AlertCircle className="h-4 w-4" aria-hidden="true" />
                  {result.skipped.length} skipped
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pl-6">
                  {result.skipped.map((s) => (
                    <li key={s.candidateId}>
                      {s.candidateName ?? 'Unknown candidate'}: {s.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.sent.length > 0 && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-body-xs text-ink-500 dark:text-ink-400">
                    If email is not configured on the server, share each link yourself. Links are shown only once.
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => copy(result.sent.map((a) => `${a.candidateName}: ${a.link ?? ''}`).join('\n'), 'All links copied')}
                  >
                    <Copy className="h-4 w-4" />
                    Copy all links
                  </Button>
                </div>
                <ul className="max-h-60 divide-y divide-base-200 overflow-y-auto rounded-xl border border-base-200 dark:divide-base-700 dark:border-base-700">
                  {result.sent.map((a) => (
                    <li key={a.id} className="flex items-center gap-3 px-3 py-2">
                      <span className="min-w-0 flex-1 truncate text-body-sm font-medium text-ink-900 dark:text-ink-100">{a.candidateName}</span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => copy(a.link ?? '', `Link for ${a.candidateName} copied`)} aria-label={`Copy link for ${a.candidateName}`}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end">
              <Button type="button" onClick={onClose}>Done</Button>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-body-sm font-semibold text-ink-900 dark:text-ink-100">{scope}</p>
                <p className="text-body-xs text-ink-500 dark:text-ink-400">Each candidate gets their own personal link by email.</p>
              </div>

              {loading ? (
                <p className="py-8 text-center text-body-sm text-ink-500 dark:text-ink-400">Loading candidates...</p>
              ) : candidates.length === 0 ? (
                <p className="rounded-xl border border-base-200 py-8 text-center text-body-sm text-ink-500 dark:border-base-700 dark:text-ink-400">
                  {assessment?.jobId ? 'Nobody has applied for this job yet.' : 'There are no candidates yet.'}
                </p>
              ) : (
                <>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden="true" />
                    <input
                      className="input pl-9"
                      placeholder="Filter by name or email"
                      aria-label="Filter candidates"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    />
                  </div>

                  <div className="overflow-hidden rounded-xl border border-base-200 dark:border-base-700">
                    <label className="flex cursor-pointer items-center gap-3 border-b border-base-200 bg-base-50 px-3 py-2.5 dark:border-base-700 dark:bg-base-800/50">
                      <input ref={selectAllRef} type="checkbox" className="h-4 w-4" checked={allVisibleSelected} onChange={toggleAllVisible} disabled={visible.length === 0} />
                      <span className="text-body-sm font-semibold text-ink-900 dark:text-ink-100">
                        {filter ? `Select all ${visible.length} shown` : `Select all ${candidates.length}`}
                      </span>
                      <span className="ml-auto text-body-xs text-ink-500 dark:text-ink-400">{count} selected</span>
                    </label>
                    <ul className="max-h-72 divide-y divide-base-200 overflow-y-auto dark:divide-base-700">
                      {visible.length === 0 && <li className="px-3 py-6 text-center text-body-sm text-ink-500 dark:text-ink-400">No match for "{filter}"</li>}
                      {visible.map((c) => (
                        <li key={c.id}>
                          <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-base-50 dark:hover:bg-surface-dark-elevated">
                            <input type="checkbox" className="h-4 w-4" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-body-sm font-medium text-ink-900 dark:text-ink-100">{c.candidateName}</span>
                              <span className="block truncate text-body-xs text-ink-500 dark:text-ink-400">
                                {c.candidateEmail}
                                {!assessment?.jobId && c.jobTitle ? ` · ${c.jobTitle}` : ''}
                              </span>
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
              <Button type="button" loading={isSending} disabled={count === 0 || loading} onClick={send}>
                <Send className="h-4 w-4" />
                {count === 0 ? 'Send' : count === candidates.length && candidates.length > 1 ? `Send to all ${count}` : `Send to ${count} ${count === 1 ? 'candidate' : 'candidates'}`}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
