import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface DropdownProps {
  trigger: (open: boolean) => ReactNode
  children: (close: () => void) => ReactNode
  panelClassName?: string
  align?: 'left' | 'right'
  triggerClassName?: string
}

export default function Dropdown({ trigger, children, panelClassName = '', align = 'left', triggerClassName = '' }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState<{ top: number; left: number; right: number } | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const updateRect = () => {
    const el = wrapRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setRect({ top: r.bottom + 8, left: r.left, right: window.innerWidth - r.right })
  }

  useLayoutEffect(() => {
    if (open) updateRect()
  }, [open])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      const target = e.target as Node
      if (wrapRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      setOpen(false)
    }
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    const reposition = () => updateRect()
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', escape)
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', escape)
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
  }, [open])

  return (
    <div ref={wrapRef} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className={triggerClassName}>
        {trigger(open)}
      </button>
      {open && rect && createPortal(
        <div
          ref={panelRef}
          style={{
            position: 'fixed',
            top: rect.top,
            ...(align === 'right' ? { right: rect.right } : { left: rect.left }),
          }}
          className={`z-[100] bg-white rounded-xl shadow-xl border border-line/60 py-1.5 overflow-hidden animate-slide-down ${panelClassName}`}
        >
          {children(() => setOpen(false))}
        </div>,
        document.body
      )}
    </div>
  )
}

export function DropdownItem({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-sm font-display text-left whitespace-nowrap transition-colors ${
        active ? 'bg-navy text-white' : 'text-charcoal hover:bg-parchment'
      }`}
    >
      <span>{children}</span>
      {active && <span className="text-gold text-xs flex-shrink-0">✓</span>}
    </button>
  )
}
