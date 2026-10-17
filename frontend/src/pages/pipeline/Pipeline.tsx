import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, GripVertical, Upload } from 'lucide-react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import toast from 'react-hot-toast'
import { candidateApi, jobApi } from '@/utils/api'
import { Button } from '@/components/ui/Button'
import { FilterSelect, MatchScore, SearchField } from '@/components/ui/ListPage'
import { UploadResumesModal } from '@/components/candidates/UploadResumesModal'
import { cn, getInitials } from '@/utils/helpers'
import type { Candidate, CandidateStatus, Job } from '@/types'

/** Left to right is the order candidates move through; Rejected sits apart at the end. */
const COLUMNS: { status: CandidateStatus; label: string; hint: string; rule: string }[] = [
  { status: 'APPLIED', label: 'Applied', hint: 'New resumes', rule: 'bg-ink-300 dark:bg-ink-600' },
  { status: 'SCREENING', label: 'Screening', hint: 'Being reviewed', rule: 'bg-clay-300' },
  { status: 'SHORTLISTED', label: 'Shortlisted', hint: 'Worth a conversation', rule: 'bg-brand-400' },
  { status: 'INTERVIEW', label: 'Interview', hint: 'Meeting the team', rule: 'bg-accent-500' },
  { status: 'SELECTED', label: 'Selected', hint: 'Offer stage', rule: 'bg-success-500' },
  { status: 'REJECTED', label: 'Rejected', hint: 'Not moving forward', rule: 'bg-error-400' },
]

const STATUSES = COLUMNS.map((c) => c.status)

function CardBody({ candidate, dragging }: { candidate: Candidate; dragging?: boolean }) {
  return (
    <div className={cn('kanban-card flex flex-col gap-2.5', dragging && 'kanban-card-dragging')}>
      <div className="flex items-start gap-2.5">
        <span className="avatar-sm flex-shrink-0">{getInitials(candidate.candidateName)}</span>
        <div className="min-w-0 flex-1">
          <Link
            to={`/candidates/${candidate.id}`}
            className="block truncate text-body-sm font-semibold text-ink-900 no-underline hover:underline dark:text-ink-100"
            onPointerDown={(e) => e.stopPropagation()}
          >
            {candidate.candidateName}
          </Link>
          <p className="truncate text-body-xs text-ink-600 dark:text-ink-400" title={candidate.jobTitle}>{candidate.jobTitle ?? 'No job'}</p>
        </div>
        <GripVertical className="mt-0.5 h-4 w-4 flex-shrink-0 text-ink-400" aria-hidden="true" />
      </div>
      <MatchScore score={candidate.aiMatchScore} />
    </div>
  )
}

function CandidateCard({ candidate }: { candidate: Candidate }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: candidate.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 }}
      className="cursor-grab touch-manipulation active:cursor-grabbing"
      {...attributes}
      {...listeners}
      aria-label={`${candidate.candidateName}, drag to change stage`}
    >
      <CardBody candidate={candidate} />
    </div>
  )
}

function Column({ column, candidates }: { column: (typeof COLUMNS)[number]; candidates: Candidate[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.status })
  return (
    <section
      ref={setNodeRef}
      aria-label={`${column.label}, ${candidates.length} candidates`}
      className={cn(
        'flex min-h-[420px] min-w-0 flex-col overflow-hidden rounded-xl border bg-base-50 transition-colors dark:bg-surface-dark-card',
        isOver ? 'border-clay-400 bg-clay-50 dark:bg-clay-800/20' : 'border-[var(--color-border)]',
        column.status === 'REJECTED' && 'opacity-90'
      )}
    >
      <span className={cn('block h-1', column.rule)} aria-hidden="true" />
      <header className="flex items-baseline justify-between gap-2 px-3.5 pb-2 pt-3">
        <div>
          <h2 className="font-display text-body-md font-semibold text-ink-900 dark:text-ink-100">{column.label}</h2>
          <p className="text-body-xs text-ink-600 dark:text-ink-400">{column.hint}</p>
        </div>
        <span className="font-display text-heading-sm font-bold tabular text-ink-900 dark:text-ink-100">{candidates.length}</span>
      </header>
      <SortableContext items={candidates.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-1 flex-col gap-2 p-2.5">
          {candidates.map((c) => (
            <CandidateCard key={c.id} candidate={c} />
          ))}
          {candidates.length === 0 && (
            <p className="rounded-lg border border-dashed border-[var(--color-border-hover)] px-3 py-6 text-center text-body-xs text-ink-600 dark:text-ink-400">
              Drag a candidate here
            </p>
          )}
        </div>
      </SortableContext>
    </section>
  )
}

export function Pipeline() {
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [jobId, setJobId] = useState('')
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => {
    jobApi
      .getMyJobsUnwrapped({ page: 1, pageSize: 100 })
      .then((res) => setJobs(res.data))
      .catch(() => setJobs([]))
  }, [])

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await candidateApi.getAllUnwrapped({ page: 1, pageSize: 500, jobId: jobId || undefined, search: search || undefined })
      setCandidates(res.data as Candidate[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load candidates')
    } finally {
      setIsLoading(false)
    }
  }, [jobId, search])

  useEffect(() => {
    const t = setTimeout(load, search ? 250 : 0)
    return () => clearTimeout(t)
  }, [load, reloadKey, search])

  const byStatus = useMemo(() => {
    const map = Object.fromEntries(STATUSES.map((s) => [s, [] as Candidate[]])) as Record<CandidateStatus, Candidate[]>
    for (const c of candidates) map[(c.status ?? 'APPLIED') as CandidateStatus]?.push(c)
    return map
  }, [candidates])

  const move = async (candidateId: string, status: CandidateStatus) => {
    const before = candidates
    setCandidates((prev) => prev.map((c) => (c.id === candidateId ? { ...c, status } : c)))
    try {
      await candidateApi.updateStatus(candidateId, status)
      const label = COLUMNS.find((c) => c.status === status)?.label ?? status
      toast.success(`Moved to ${label}`)
    } catch (e) {
      setCandidates(before)
      toast.error(e instanceof Error ? e.message : 'Could not move the candidate')
    }
  }

  const onDragStart = (e: DragStartEvent) => setDraggingId(String(e.active.id))

  const onDragEnd = (e: DragEndEvent) => {
    setDraggingId(null)
    const { active, over } = e
    if (!over) return
    const id = String(active.id)
    const overId = String(over.id)
    const target = (STATUSES as string[]).includes(overId)
      ? (overId as CandidateStatus)
      : (candidates.find((c) => c.id === overId)?.status as CandidateStatus | undefined)
    const current = candidates.find((c) => c.id === id)?.status
    if (target && target !== current) void move(id, target)
  }

  const dragging = draggingId ? candidates.find((c) => c.id === draggingId) : undefined

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-heading-xl font-bold text-ink-900 dark:text-ink-100">Pipeline</h1>
          <p className="mt-1.5 max-w-xl text-body-md text-ink-600 dark:text-ink-400">
            Drag a candidate to the next stage. Changes save as soon as you drop.
          </p>
        </div>
        <Button onClick={() => setUploadOpen(true)}>
          <Upload className="h-4 w-4" aria-hidden="true" />
          Add candidates
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <SearchField value={search} onChange={setSearch} placeholder="Search by name or email" label="Search pipeline" />
        <FilterSelect
          label="Filter by job"
          value={jobId}
          onChange={setJobId}
          options={[{ value: '', label: 'All jobs' }, ...jobs.map((j) => ({ value: j.id, label: j.title }))]}
        />
      </div>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-error-200 bg-error-50 p-3 text-body-sm text-error-600 dark:border-error-800/70 dark:bg-error-900/30 dark:text-error-400">
          <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4" aria-hidden="true" />{error}</span>
          <button onClick={() => setReloadKey((k) => k + 1)} className="cursor-pointer font-semibold underline">Try again</button>
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDraggingId(null)}>
        <div className="overflow-x-auto pb-3" aria-busy={isLoading}>
          <div className="grid min-w-[1120px] grid-cols-6 gap-3">
            {COLUMNS.map((col) => (
              <Column key={col.status} column={col} candidates={byStatus[col.status]} />
            ))}
          </div>
        </div>
        <DragOverlay>{dragging ? <CardBody candidate={dragging} dragging /> : null}</DragOverlay>
      </DndContext>

      <UploadResumesModal
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={() => setReloadKey((k) => k + 1)}
        jobs={jobs.filter((j) => j.status !== 'CLOSED').map((j) => ({ id: j.id, title: j.title }))}
      />
    </div>
  )
}
