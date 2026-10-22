import { useRef, useState } from 'react'
import { FileText, UploadCloud, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { batchApi } from '@/utils/api'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Dropdown } from '@/components/ui/Dropdown'
import { BatchProgress } from '@/components/candidates/BatchProgress'
import { cn } from '@/utils/helpers'

// These mirror the backend's pipeline.upload.* limits; the server enforces them regardless.
const MAX_FILES = 500
const MAX_BYTES = 10 * 1024 * 1024
const ALLOWED = ['pdf', 'docx', 'txt']

interface Row {
  id: string
  file: File
}

interface JobOption {
  id: string
  title: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
  /** Called when new candidates may exist: as processing finishes, and when the window is closed mid-way */
  onUploaded: () => void
  /** Pre-select and lock a job (used from the job page) */
  fixedJob?: JobOption
  jobs?: JobOption[]
}

let counter = 0

const extension = (name: string) => name.slice(name.lastIndexOf('.') + 1).toLowerCase()

export function UploadResumesModal({ isOpen, onClose, onUploaded, fixedJob, jobs = [] }: Props) {
  const [jobId, setJobId] = useState(fixedJob?.id ?? '')
  const [rows, setRows] = useState<Row[]>([])
  const [dragging, setDragging] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [batchId, setBatchId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selectedJobId = fixedJob?.id ?? jobId

  const reset = () => {
    setRows([])
    setNote(null)
    setSubmitted(false)
    setBatchId(null)
    setJobId(fixedJob?.id ?? '')
  }

  const close = () => {
    if (isUploading) return
    // Processing carries on server-side; refresh so anything already created shows up.
    if (batchId) onUploaded()
    reset()
    onClose()
  }

  const addFiles = (list: FileList | File[]) => {
    const accepted: Row[] = []
    const problems: string[] = []
    const room = MAX_FILES - rows.length
    Array.from(list).forEach((file) => {
      if (!ALLOWED.includes(extension(file.name))) problems.push(`${file.name} is not a PDF, DOCX or TXT`)
      else if (file.size === 0) problems.push(`${file.name} is empty`)
      else if (file.size > MAX_BYTES) problems.push(`${file.name} is over 10 MB`)
      else if (accepted.length >= room) problems.push(`${file.name} skipped (limit ${MAX_FILES} per batch)`)
      else accepted.push({ id: `f${++counter}`, file })
    })
    const shown = problems.slice(0, 3).join(', ') + (problems.length > 3 ? ` and ${problems.length - 3} more` : '')
    setNote(problems.length ? `Skipped: ${shown}.` : null)
    if (accepted.length) setRows((prev) => [...prev, ...accepted])
  }

  const upload = async () => {
    setSubmitted(true)
    if (!selectedJobId || rows.length === 0) return

    setIsUploading(true)
    try {
      // One request, however many files: the server stores and queues them and answers immediately.
      const batch = await batchApi.create(selectedJobId, rows.map((r) => r.file))
      setBatchId(batch.id)
      setRows([])
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : 'Upload failed', { duration: 8000 })
    } finally {
      setIsUploading(false)
    }
  }

  const totalMb = rows.reduce((sum, r) => sum + r.file.size, 0) / 1024 / 1024

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      closeOnOverlayClick={false}
      size="xl"
      title="Add candidates"
      description="Upload up to 500 resumes (PDF, DOCX or TXT) at once. They are read and scored in the background."
    >
      {batchId ? (
        <div className="space-y-5">
          <BatchProgress batchId={batchId} onFinished={onUploaded} />
          <div className="flex items-center justify-end gap-3 border-t border-[var(--color-border)] pt-4">
            <Button type="button" variant="ghost" onClick={() => reset()}>
              Add more
            </Button>
            <Button type="button" onClick={close}>
              Done
            </Button>
          </div>
        </div>
      ) : (
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
              <Dropdown
                id="upload-job"
                value={jobId}
                onChange={setJobId}
                disabled={isUploading}
                placeholder="Select a job"
                invalid={submitted && !jobId}
                className="h-10"
                options={jobs.map((j) => ({ value: j.id, label: j.title }))}
              />
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
            <p className="text-body-xs text-ink-500 dark:text-ink-400">PDF, DOCX or TXT, up to 10 MB each, up to {MAX_FILES} at a time.</p>
            <Button type="button" variant="secondary" size="sm" disabled={isUploading} onClick={() => inputRef.current?.click()}>
              Choose files
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              multiple
              className="sr-only"
              aria-label="Choose resume files"
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
                {rows.length} {rows.length === 1 ? 'file' : 'files'} ({totalMb.toFixed(1)} MB). Name, email, skills and experience are read from each
                resume automatically. Exact duplicates are skipped.
              </p>
              <ul className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
                {rows.map((r) => (
                  <li key={r.id} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2">
                    <FileText className="h-4 w-4 flex-shrink-0 text-ink-400" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-body-xs font-medium text-ink-600 dark:text-ink-300">{r.file.name}</span>
                    <span className="text-body-xs text-ink-400">{(r.file.size / 1024 / 1024).toFixed(1)} MB</span>
                    <button
                      type="button"
                      disabled={isUploading}
                      onClick={() => setRows((prev) => prev.filter((x) => x.id !== r.id))}
                      className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-base-100 hover:text-ink-700 disabled:opacity-40 dark:hover:bg-surface-dark-elevated"
                      aria-label={`Remove ${r.file.name}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-[var(--color-border)] pt-4">
            <Button type="button" variant="ghost" onClick={close} disabled={isUploading}>
              Cancel
            </Button>
            <Button type="button" onClick={upload} loading={isUploading} disabled={rows.length === 0}>
              {rows.length > 1 ? `Upload ${rows.length} resumes` : 'Upload resume'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
