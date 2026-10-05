import { useEffect, useState } from 'react'
import { candidateApi } from '@/utils/api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Plus, Search, GripVertical } from 'lucide-react'
import { cn } from '@/utils/helpers'
import type { Candidate } from '@/types'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const PIPELINE_STATUSES: Candidate['status'][] = [
  'APPLIED',
  'SCREENING',
  'SHORTLISTED',
  'ASSESSMENT',
  'INTERVIEW',
  'OFFER',
  'HIRED',
  'REJECTED',
]

const STATUS_LABELS: Record<Candidate['status'], string> = {
  APPLIED: 'Applied',
  SCREENING: 'Screening',
  SHORTLISTED: 'Shortlisted',
  ASSESSMENT: 'Assessment',
  INTERVIEW: 'Interview',
  OFFER: 'Offer',
  HIRED: 'Hired',
  REJECTED: 'Rejected',
}

interface KanbanColumnProps {
  status: Candidate['status']
  candidates: Candidate[]
}

function KanbanColumn({ status, candidates }: KanbanColumnProps) {
  const label = STATUS_LABELS[status]

  return (
    <Card className="kanban-column w-72 flex-shrink-0 flex flex-col" style={{ minHeight: '600px' }}>
      <CardHeader className="pb-3 kanban-column-header">
        <div className="flex items-center justify-between">
          <CardTitle className="text-body-lg">{label}</CardTitle>
          <span className="text-body-sm text-ink-500 dark:text-ink-400">{candidates.length}</span>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-[400px] kanban-column-content p-2">
        <SortableContext items={candidates.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {candidates.map((candidate) => (
            <CandidateCard
              key={candidate.id}
              candidate={candidate}
            />
          ))}
          {candidates.length === 0 && (
            <div className="h-24 border-2 border-dashed border-base-300 dark:border-base-600 rounded-xl flex items-center justify-center">
              <span className="text-body-sm text-ink-400 dark:text-ink-500">Drop candidates here</span>
            </div>
          )}
        </SortableContext>
      </CardContent>
    </Card>
  )
}

interface CandidateCardProps {
  candidate: Candidate
}

function CandidateCard({ candidate }: CandidateCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: candidate.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'candidate-card p-4 bg-base-100 dark:bg-base-900 border border-base-200 dark:border-base-700 rounded-xl shadow-neo-1',
        isDragging && 'shadow-lg ring-2 ring-accent-500'
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-accent-100 dark:bg-accent-900/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
        aria-label="Drag"
      >
        <GripVertical className="w-4 h-4 text-ink-400" />
      </button>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-accent-100 dark:bg-accent-900/30 flex items-center justify-center flex-shrink-0">
          <span className="text-label-sm font-medium text-accent-600 dark:text-accent-400">
            {candidate.candidateName.charAt(0)}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <Link to={`/candidates/${candidate.id}`} className="block hover:underline">
            <p className="font-medium text-ink-900 dark:text-ink-100 truncate">{candidate.candidateName}</p>
            <p className="text-body-xs text-ink-500 dark:text-ink-400 truncate">{candidate.candidateEmail}</p>
          </Link>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-body-xs text-ink-500 dark:text-ink-400">{candidate.jobTitle}</span>
            {candidate.aiMatchScore !== undefined && (
              <span className={cn(
                'text-body-xs font-medium px-2 py-0.5 rounded-full',
                candidate.aiMatchScore >= 80 ? 'bg-success-100 text-success-600 dark:bg-success-900/30 dark:text-success-400' :
                candidate.aiMatchScore >= 60 ? 'bg-warning-100 text-warning-600 dark:bg-warning-900/30 dark:text-warning-400' :
                candidate.aiMatchScore >= 40 ? 'bg-accent-100 text-accent-600 dark:bg-accent-900/30 dark:text-accent-400' :
                'bg-error-100 text-error-600 dark:bg-error-900/30 dark:text-error-400'
              )}>
                {candidate.aiMatchScore}%
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

import { Link } from 'react-router-dom'

export function Pipeline() {
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeJobId] = useState<string | undefined>()

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(() => {
    const fetchCandidates = async () => {
      setIsLoading(true)
      try {
        const response = await candidateApi.getAll({
          page: 1,
          pageSize: 200,
          jobId: activeJobId,
          search: searchQuery,
        })
        setCandidates(response.data)
      } catch (error) {
        console.error('Failed to fetch candidates:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchCandidates()
  }, [activeJobId, searchQuery])

  const onCandidateMove = async (candidateId: string, newStatus: Candidate['status']) => {
    try {
      await candidateApi.updateStatus(candidateId, newStatus)
      setCandidates((prev) =>
        prev.map((c) =>
          c.id === candidateId ? { ...c, status: newStatus } : c
        )
      )
    } catch (error) {
      console.error('Failed to update candidate status:', error)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const candidateId = active.id as string
      const newStatus = over.id as Candidate['status']
      onCandidateMove(candidateId, newStatus)
    }
  }

  const candidatesByStatus = PIPELINE_STATUSES.reduce(
    (acc, status) => {
      acc[status] = candidates.filter((c) => c.status === status)
      return acc
    },
    {} as Record<Candidate['status'], Candidate[]>
  )

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-display-md font-bold text-ink-900 dark:text-ink-100">Pipeline</h1>
            <p className="text-body-md text-ink-500 dark:text-ink-400 mt-1">Visualize and manage your recruitment pipeline</p>
          </div>
          <Button variant="secondary" disabled>
            <Plus className="w-4 h-4 mr-2" />
            Add Candidate
          </Button>
        </div>
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max" style={{ minWidth: '100%' }}>
            {PIPELINE_STATUSES.map((status) => (
              <Card key={status} className="kanban-column w-72 flex-shrink-0 flex flex-col" style={{ minHeight: '600px' }}>
                <CardHeader className="pb-3 kanban-column-header">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-body-lg">{STATUS_LABELS[status]}</CardTitle>
                    <span className="text-body-sm text-ink-500 dark:text-ink-400">0</span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 min-h-[400px] kanban-column-content">
                  <div className="animate-pulse space-y-3 p-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-24 bg-base-200 dark:bg-base-700 rounded-xl" />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-display-md font-bold text-ink-900 dark:text-ink-100">Pipeline</h1>
            <p className="text-body-md text-ink-500 dark:text-ink-400 mt-1">Visualize and manage your recruitment pipeline</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-400" />
              <Input
                placeholder="Search candidates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="secondary">
              <Plus className="w-4 h-4 mr-2" />
              Add Candidate
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max" style={{ minWidth: '100%' }}>
            {PIPELINE_STATUSES.map((status) => (
              <KanbanColumn
                key={status}
                status={status}
                candidates={candidatesByStatus[status]}
              />
            ))}
          </div>
        </div>
      </div>
    </DndContext>
  )
}