import { FormEvent, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { candidateApi } from '@/utils/api'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface EditableCandidate {
  id: string
  candidateName: string
  candidateEmail: string
  phoneNumber?: string
  location?: string
}

interface Props {
  candidate: EditableCandidate | null
  onClose: () => void
  /** Called after the candidate was saved */
  onSaved: () => void
}

export function EditCandidateModal({ candidate, onClose, onSaved }: Props) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [location, setLocation] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    if (!candidate) return
    setName(candidate.candidateName ?? '')
    setEmail(candidate.candidateEmail ?? '')
    setPhone(candidate.phoneNumber ?? '')
    setLocation(candidate.location ?? '')
    setSubmitted(false)
    setServerError(null)
  }, [candidate])

  const nameError = submitted && !name.trim() ? 'Name is required' : undefined
  const emailError = submitted && !EMAIL_RE.test(email.trim()) ? 'Enter a valid email address' : undefined

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!candidate) return
    setSubmitted(true)
    if (!name.trim() || !EMAIL_RE.test(email.trim())) return
    setSaving(true)
    setServerError(null)
    try {
      await candidateApi.update(candidate.id, {
        candidateName: name.trim(),
        candidateEmail: email.trim(),
        phoneNumber: phone.trim() || undefined,
        location: location.trim() || undefined,
      })
      toast.success('Candidate updated')
      onSaved()
      onClose()
    } catch (err) {
      setServerError(err instanceof Error && err.message ? err.message : 'Failed to update candidate')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={candidate !== null}
      onClose={saving ? () => {} : onClose}
      title="Edit candidate"
      description="Update the contact details for this candidate."
      size="md"
      closeOnOverlayClick={!saving}
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {serverError && (
          <div role="alert" className="rounded-lg border border-error-200 bg-error-50 p-3 text-body-sm text-error-600 dark:border-error-800/70 dark:bg-error-900/30 dark:text-error-400">
            {serverError}
          </div>
        )}
        <Input label="Full name" required value={name} onChange={(e) => setName(e.target.value)} error={nameError} />
        <Input label="Email" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={emailError} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input label="Location" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            Save changes
          </Button>
        </div>
      </form>
    </Modal>
  )
}
