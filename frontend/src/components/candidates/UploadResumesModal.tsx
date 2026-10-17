import { useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, FileText, Loader2, UploadCloud, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { resumeApi } from '@/utils/api'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { cn } from '@/utils/helpers'

const MAX_BYTES = 20 * 1024 * 1024
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface Row {
  id: string
  file: File
  name: string
  email: string
  phone: string
  location: string
  status: 'idle' | 'uploading' | 'done' | 'error'
  error?: string
}

interface JobOption {
  id: string
  title: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
  /** Called after at least one resume uploaded successfully */
  onUploaded: () => void
  /** Pre-select and lock a job (used from the job page) */
  fixedJob?: JobOption
  jobs?: JobOption[]
}

const nameFromFile = (fileName: string) =>
  fileName
    .replace(/\.[^.]+$/, '')
    .replace(/[_\-.]+/g, ' ')
    .replace(/\b(resume|cv)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())

let counter = 0

export function UploadResumesModal({ isOpen, onClose, onUploaded, fixedJob, jobs = [] }: Props) {
  const [jobId, setJobId] = useState(fixedJob?.id ?? '')
  const [rows, setRows] = useState<Row[]>([])
  const [dragging, setDragging] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const selectedJobId = fixedJob?.id ?? jobId

  const reset = () => {
    setRows([])
    setNote(null)
    setSubmitted(false)
    setJobId(fixedJob?.id ?? '')
  }

  const close = () => {
    if (isUploading) return
    reset()
    onClose()
  }

  const addFiles = (list: FileList | File[]) => {
    const accepted: Row[] = []
    const problems: string[] = []
    Array.from(list).forEach((file) => {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
      if (!isPdf) problems.push(`${file.name} is not a PDF`)
      else if (file.size > MAX_BYTES) problems.push(`${file.name} is over 20 MB`)
      else
        accepted.push({ id: `f${++counter}`, file, name: nameFromFile(file.name), email: '', phone: '', location: '', status: 'idle' })
    })
    setNote(problems.length ? `Skipped: ${problems.join(', ')}.` : null)
    if (accepted.length) setRows((prev) => [...prev, ...accepted])
  }

  const update = (id: string, patch: Partial<Row>) => setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  const rowErrors = (r: Row) => ({
    name: r.name.trim() ? undefined : 'Enter a name',
    email: !r.email.trim() ? 'Enter an email' : EMAIL_RE.test(r.email.trim()) ? undefined : 'Enter a valid email',
  })

  const pending = rows.filter((r) => r.status !== 'done')
  const canUpload = pending.length > 0

  const upload = async () => {
    setSubmitted(true)
    if (!selectedJobId) return
    const invalid = pending.some((r) => rowErrors(r).name || rowErrors(r).email)
    if (invalid) return

    setIsUploading(true)
    let ok = 0
    let failed = 0
    for (const r of pending) {
      update(r.id, { status: 'uploading', error: undefined })
      try {
        await resumeApi.upload(r.file, r.name.trim(), r.email.trim(), selectedJobId, r.phone.trim() || undefined, r.location.trim() || undefined)
        update(r.id, { status: 'done' })
        ok++
      } catch (e) {
        update(r.id, { status: 'error', error: e instanceof Error && e.message ? e.message : 'Upload failed' })
        failed++
      }
    }
    setIsUploading(false)

    if (ok > 0) onUploaded()
    if (failed === 0) {
      toast.success(ok === 1 ? 'Resume uploaded. Processing started.' : `${ok} resumes uploaded. Processing started.`)
      reset()
      onClose()
    } else {
      toast.error(`${failed} ${failed === 1 ? 'resume' : 'resumes'} failed. Fix the errors and try again.`)
    }
  }

  const field = 'input h-9 text-body-sm'

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      closeOnOverlayClick={false}
      size="xl"
      title="Add candidates"
      description="Upload resumes as PDFs. Each resume becomes a candidate for the selected job."
    >
      <div className="space-y-5">
        {fixedJob ? (
          <p className="rounded-lg bg-base-50 px-3 py-2 text-body-sm text-ink-700 dark:bg-surface-dark-elevated dark:text-ink-200">
            Job: <span className="font-semibold">{fixedJob.title}</span>
          </p>
        ) : (
          <div>
            <label htmlFor="upload-job" className="label">
              Job<span className="ml-1 text-accent-600" aria-hidden="true">*</span>
            </label>
            <select
              id="upload-job"
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
              disabled={isUploading}
              className={cn('select h-10 cursor-pointer', submitted && !jobId && '!border-error-500')}
            >
              <option value="">Select a job</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}
                </option>
              ))}
            </select>
            {submitted && !jobId && (
              <p className="error-text" role="alert">
                Select the job these candidates are applying for
              </p>
            )}
            {jobs.length === 0 && <p className="helper-text">Create a job first, then you can add candidates to it.</p>}
          </div>
        )}

        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            if (!isUploading) addFiles(e.dataTransfer.files)
          }}
          className={cn(
            'flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors',
            dragging ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-[var(--color-border-hover)] bg-base-50 dark:bg-surface-dark-elevated'
          )}
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
            <UploadCloud className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="text-body-sm font-semibold text-ink-900 dark:text-ink-100">Drag and drop resumes here</p>
          <p className="text-body-xs text-ink-500 dark:text-ink-400">PDF only, up to 20 MB each. You can add several at once.</p>
          <Button type="button" variant="secondary" size="sm" disabled={isUploading} onClick={() => inputRef.current?.click()}>
            Choose files
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            className="sr-only"
            aria-label="Choose resume PDFs"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </div>

        {note && (
          <p className="text-body-xs text-warning-600" role="status">
            {note}
          </p>
        )}

        {rows.length > 0 && (
          <div>
            <p className="mb-2 text-body-xs text-ink-500 dark:text-ink-400">
              Names and emails are not read from the PDF yet. Check them for each candidate.
            </p>
            <ul className="space-y-3">
              {rows.map((r) => {
                const err = submitted && r.status !== 'done' ? rowErrors(r) : { name: undefined, email: undefined }
                const locked = r.status === 'uploading' || r.status === 'done' || isUploading
                return (
                  <li key={r.id} className="rounded-xl border border-[var(--color-border)] p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <FileText className="h-4 w-4 flex-shrink-0 text-ink-400" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate text-body-xs font-medium text-ink-600 dark:text-ink-300">{r.file.name}</span>
                      <span className="text-body-xs text-ink-400">{(r.file.size / 1024 / 1024).toFixed(1)} MB</span>
                      {r.status === 'uploading' && <Loader2 className="h-4 w-4 animate-spin text-brand-700" aria-label="Uploading" />}
                      {r.status === 'done' && <CheckCircle2 className="h-4 w-4 text-success-600" aria-label="Uploaded" />}
                      {r.status !== 'uploading' && r.status !== 'done' && (
                        <button
                          type="button"
                          disabled={isUploading}
                          onClick={() => setRows((prev) => prev.filter((x) => x.id !== r.id))}
                          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-base-100 hover:text-ink-700 disabled:opacity-40 dark:hover:bg-surface-dark-elevated"
                          aria-label={`Remove ${r.file.name}`}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <input
                          className={cn(field, err.name && '!border-error-500')}
                          placeholder="Full name *"
                          aria-label={`Name for ${r.file.name}`}
                          aria-invalid={err.name ? 'true' : 'false'}
                          value={r.name}
                          disabled={locked}
                          onChange={(e) => update(r.id, { name: e.target.value })}
                        />
                        {err.name && <p className="error-text">{err.name}</p>}
                      </div>
                      <div>
                        <input
                          type="email"
                          className={cn(field, err.email && '!border-error-500')}
                          placeholder="Email *"
                          aria-label={`Email for ${r.file.name}`}
                          aria-invalid={err.email ? 'true' : 'false'}
                          value={r.email}
                          disabled={locked}
                          onChange={(e) => update(r.id, { email: e.target.value })}
                        />
                        {err.email && <p className="error-text">{err.email}</p>}
                      </div>
                      <input
                        type="tel"
                        className={field}
                        placeholder="Phone (optional)"
                        aria-label={`Phone for ${r.file.name}`}
                        value={r.phone}
                        disabled={locked}
                        onChange={(e) => update(r.id, { phone: e.target.value })}
                      />
                      <input
                        className={field}
                        placeholder="Location (optional)"
                        aria-label={`Location for ${r.file.name}`}
                        value={r.location}
                        disabled={locked}
                        onChange={(e) => update(r.id, { location: e.target.value })}
                      />
                    </div>
                    {r.status === 'error' && (
                      <p className="mt-2 flex items-center gap-1.5 text-body-xs text-error-600" role="alert">
                        <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        {r.error}
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 border-t border-[var(--color-border)] pt-4">
          <Button type="button" variant="ghost" onClick={close} disabled={isUploading}>
            Cancel
          </Button>
          <Button type="button" onClick={upload} loading={isUploading} disabled={!canUpload}>
            {pending.length > 1 ? `Upload ${pending.length} resumes` : 'Upload resume'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
