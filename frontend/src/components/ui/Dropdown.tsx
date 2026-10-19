import { useEffect, useLayoutEffect, useRef, useState, KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Check } from 'lucide-react'
import { cn } from '@/utils/helpers'

export interface DropdownOption {
  value: string
  label: string
}

interface DropdownProps {
  options: DropdownOption[]
  value: string
  onChange: (value: string) => void
  /** Shown on the button while `value` matches no option. */
  placeholder?: string
  disabled?: boolean
  id?: string
  ariaLabel?: string
  invalid?: boolean
  /** Classes for the button; defaults to the standard form-field look. */
  className?: string
  onBlur?: () => void
}

interface Box { left: number; top: number; width: number; maxHeight: number; up: boolean }

/** Themed replacement for the browser's native <select> popup. The list is portalled so cards and modals can't clip it. */
export function Dropdown({ options, value, onChange, placeholder, disabled, id, ariaLabel, invalid, className, onBlur }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [box, setBox] = useState<Box | null>(null)
  const button = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLUListElement>(null)

  const selected = options.find((o) => o.value === value)

  const place = () => {
    const r = button.current?.getBoundingClientRect()
    if (!r) return
    const below = window.innerHeight - r.bottom - 12
    const above = r.top - 12
    const up = below < 200 && above > below
    const maxHeight = Math.min(280, up ? above : below)
    setBox({ left: r.left, top: up ? r.top - 4 : r.bottom + 4, width: r.width, maxHeight, up })
  }

  useLayoutEffect(() => {
    if (!open) return
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      const t = e.target as Node
      if (!button.current?.contains(t) && !list.current?.contains(t)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  // Keep the highlighted row in view while moving with the arrow keys.
  useEffect(() => {
    if (open && active >= 0) list.current?.children[active]?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  const toggle = () => {
    if (disabled) return
    if (!open) setActive(Math.max(0, options.findIndex((o) => o.value === value)))
    setOpen((o) => !o)
  }

  const pick = (o: DropdownOption) => {
    setOpen(false)
    button.current?.focus()
    if (o.value !== value) onChange(o.value)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) {
        toggle()
        return
      }
      setActive((i) => (e.key === 'ArrowDown' ? Math.min(i + 1, options.length - 1) : Math.max(i - 1, 0)))
    } else if ((e.key === 'Enter' || e.key === ' ') && open && active >= 0) {
      e.preventDefault()
      pick(options[active])
    } else if (e.key === 'Escape' && open) {
      e.stopPropagation()
      setOpen(false)
    } else if (e.key === 'Tab') {
      setOpen(false)
    }
  }

  return (
    <>
      <button
        ref={button}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        aria-invalid={invalid ? 'true' : undefined}
        disabled={disabled}
        onClick={toggle}
        onKeyDown={handleKeyDown}
        onBlur={onBlur}
        className={cn('select cursor-pointer truncate text-left', invalid && '!border-error-500', className)}
      >
        {selected ? selected.label : <span className="text-ink-400 dark:text-ink-500">{placeholder ?? 'Select'}</span>}
      </button>

      {open && box && createPortal(
        <ul
          ref={list}
          role="listbox"
          style={{
            position: 'fixed',
            left: box.left,
            width: box.width,
            maxHeight: box.maxHeight,
            ...(box.up ? { bottom: window.innerHeight - box.top } : { top: box.top }),
          }}
          className="surface z-[700] overflow-y-auto rounded-xl py-1 shadow-pop"
        >
          {options.map((o, i) => {
            const isSelected = o.value === value
            return (
              <li
                key={o.value}
                role="option"
                aria-selected={isSelected}
                onMouseDown={(e) => {
                  e.preventDefault()
                  pick(o)
                }}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  'flex cursor-pointer items-center justify-between gap-3 px-4 py-2 text-body-sm text-ink-900 dark:text-ink-100',
                  i === active && 'bg-brand-50 dark:bg-brand-900/30',
                  isSelected && 'font-semibold'
                )}
              >
                <span className="truncate">{o.label}</span>
                {isSelected && <Check className="h-4 w-4 flex-shrink-0 text-brand-600" aria-hidden="true" />}
              </li>
            )
          })}
        </ul>,
        document.body
      )}
    </>
  )
}
