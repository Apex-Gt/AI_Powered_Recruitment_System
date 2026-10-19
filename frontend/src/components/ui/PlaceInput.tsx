import { useEffect, useLayoutEffect, useRef, useState, KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { MapPin, Loader2 } from 'lucide-react'
import { api } from '@/utils/api'
import { cn } from '@/utils/helpers'

export interface PlaceOption {
  label: string
  name: string
  countryCode: string
  placeId: string
}

interface PlaceInputProps {
  label: string
  kind: 'country' | 'state' | 'city'
  /** The accepted value, or '' while nothing valid is chosen. */
  value: string
  /** Called with the picked suggestion, or null once the user edits the text away from a pick. */
  onChange: (place: PlaceOption | null) => void
  /** Store "City, State, Country" instead of just the name. */
  fullLabel?: boolean
  /** Keep suggestions inside this country (ISO code) / inside this state or country place id. */
  countryCode?: string
  stateId?: string
  /** Fires when the text is non-empty but no suggestion was picked (so optional fields can block submit). */
  onPendingChange?: (pending: boolean) => void
  error?: string
  required?: boolean
  placeholder?: string
  disabled?: boolean
  className?: string
  hideLabel?: boolean
}

interface Box { left: number; top: number; width: number }

/** Autocomplete that only commits a value picked from the suggestion list; free text leaves the value empty. */
export function PlaceInput({
  label, kind, value, onChange, fullLabel, countryCode, stateId, onPendingChange,
  error, required, placeholder, disabled, className, hideLabel,
}: PlaceInputProps) {
  const [text, setText] = useState(value)
  const [options, setOptions] = useState<PlaceOption[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(-1)
  const [unavailable, setUnavailable] = useState(false)
  const [box, setBox] = useState<Box | null>(null)
  const requestId = useRef(0)
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLUListElement>(null)

  // Form reset (e.g. loading a record to edit) pushes a value in from outside.
  useEffect(() => {
    if (value !== text && (value || !text)) setText(value)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  // The list lives in a portal so no card or modal can clip it; keep it glued to the input.
  const showList = open && !disabled && text.trim().length >= 2
  useLayoutEffect(() => {
    if (!showList) return
    const place = () => {
      const r = input.current?.getBoundingClientRect()
      if (r) setBox({ left: r.left, top: r.bottom + 4, width: r.width })
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [showList])

  useEffect(() => {
    const close = (e: MouseEvent) => {
      const t = e.target as Node
      if (!input.current?.contains(t) && !list.current?.contains(t)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const search = (q: string) => {
    const id = ++requestId.current
    if (q.trim().length < 2) {
      setOptions([])
      setLoading(false)
      return
    }
    setLoading(true)
    window.setTimeout(async () => {
      if (id !== requestId.current) return
      try {
        const res = await api.get<PlaceOption[]>('/places/search', {
          q: q.trim(), type: kind, countryCode, stateId,
        })
        if (id !== requestId.current) return
        setUnavailable(false)
        setOptions(res)
        setActive(-1)
      } catch {
        if (id === requestId.current) {
          setOptions([])
          setUnavailable(true)
        }
      } finally {
        if (id === requestId.current) setLoading(false)
      }
    }, 300)
  }

  const handleInput = (next: string) => {
    setText(next)
    setOpen(true)
    if (value) onChange(null) // typing invalidates the earlier pick
    onPendingChange?.(next.trim().length > 0)
    search(next)
  }

  const pick = (place: PlaceOption) => {
    setText(fullLabel ? place.label : place.name)
    setOptions([])
    setOpen(false)
    onPendingChange?.(false)
    onChange(place)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((i) => Math.min(i + 1, options.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && showList && options.length > 0) {
      e.preventDefault()
      pick(options[active >= 0 ? active : 0])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const id = `place-${kind}-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  const pending = text.trim().length > 0 && !value
  const shownError = error ?? (pending && !open ? `Select a ${kind} from the suggestions` : undefined)

  return (
    <div className="w-full">
      <label htmlFor={id} className={hideLabel ? 'sr-only' : 'label'}>
        {label}
        {required && <span className="text-accent-500 ml-1" aria-hidden="true">*</span>}
      </label>
      <div className="relative">
        <input
          ref={input}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-invalid={shownError ? 'true' : 'false'}
          autoComplete="off"
          disabled={disabled}
          className={cn(shownError ? 'input-error' : 'input', 'pr-10', className)}
          placeholder={placeholder}
          value={text}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-400">
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <MapPin className="h-5 w-5" />}
        </span>
      </div>
      {shownError && <p className="error-text" role="alert">{shownError}</p>}

      {showList && box && createPortal(
        <ul
          ref={list}
          id={`${id}-list`}
          role="listbox"
          style={{ position: 'fixed', left: box.left, top: box.top, width: box.width }}
          className="surface z-[700] max-h-64 overflow-y-auto rounded-xl py-1 shadow-pop"
        >
          {options.map((o, i) => (
            <li
              key={o.label}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault()
                pick(o)
              }}
              onMouseEnter={() => setActive(i)}
              className={cn(
                'cursor-pointer px-4 py-2 text-body-sm text-ink-900 dark:text-ink-100',
                i === active && 'bg-brand-50 dark:bg-brand-900/30'
              )}
            >
              {o.label}
            </li>
          ))}
          {!loading && options.length === 0 && (
            <li className="px-4 py-2 text-body-sm text-ink-500 dark:text-ink-400">
              {unavailable ? 'Place search is unavailable right now' : `No matching ${kind}`}
            </li>
          )}
        </ul>,
        document.body
      )}
    </div>
  )
}
