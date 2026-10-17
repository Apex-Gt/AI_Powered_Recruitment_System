import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Input'
import { assessmentApi, candidateApi } from '@/utils/api'
import type { Assessment, AssessmentAttempt, Candidate } from '@/types'
import { Copy, Send } from 'lucide-react'
import toast from 'react-hot-toast'

interface Props {
  assessment: Assessment | null
  onClose: () => void
}

export function AssignAssessmentModal({ assessment, onClose }: Props) {
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [candidateId, setCandidateId] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sent, setSent] = useState<AssessmentAttempt | null>(null)

  useEffect(() => {
    if (!assessment) return
    setCandidateId('')
    setSent(null)
    candidateApi
      .getAllUnwrapped({ page: 1, pageSize: 500 })
      .then((res) => setCandidates(res.data.filter((c) => c.status !== 'REJECTED')))
      .catch(() => toast.error('Failed to load candidates'))
  }, [assessment])

  const send = async () => {
    if (!assessment || !candidateId) return
    setIsSending(true)
    try {
      setSent(await assessmentApi.assign(assessment.id, candidateId))
      toast.success('Assessment sent')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send assessment')
    } finally {
      setIsSending(false)
    }
  }

  const copyLink = async () => {
    if (!sent?.link) return
    try {
      await navigator.clipboard.writeText(sent.link)
      toast.success('Link copied')
    } catch {
      toast.error('Could not copy, select the link and copy it manually')
    }
  }

  return (
    <Modal isOpen={!!assessment} onClose={onClose} title="Send Assessment" size="md">
      <div className="space-y-5">
        <p className="text-body-sm text-ink-500 dark:text-ink-400">
          {assessment?.title} - {assessment?.duration} minutes, {assessment?.questions.length} questions
        </p>

        {sent ? (
          <div className="space-y-3">
            <p className="text-body-md text-ink-700 dark:text-ink-200">
              Sent to <strong>{sent.candidateName}</strong>. The link works until {new Date(sent.expiresAt).toLocaleString()}.
            </p>
            <p className="text-body-xs text-ink-500 dark:text-ink-400">
              If email is not configured on the server, share this link with the candidate yourself. It is shown only once.
            </p>
            <div className="flex items-center gap-2">
              <input readOnly value={sent.link ?? ''} className="input flex-1 text-body-xs" onFocus={(e) => e.currentTarget.select()} />
              <Button type="button" variant="secondary" size="sm" onClick={copyLink}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex justify-end">
              <Button type="button" onClick={onClose}>Done</Button>
            </div>
          </div>
        ) : (
          <>
            <Select
              label="Candidate *"
              value={candidateId}
              onChange={(e) => setCandidateId(e.target.value)}
              placeholder="Select candidate"
              options={candidates.map((c) => ({ value: c.id, label: `${c.candidateName} (${c.jobTitle ?? 'no job'})` }))}
            />
            <div className="flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
              <Button type="button" loading={isSending} disabled={!candidateId} onClick={send}>
                <Send className="w-4 h-4" />
                Send
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
