import { useState, useEffect, useCallback } from 'react'

export type ToastType = 'success' | 'error' | 'info'

export type Toast = {
  id: string
  message: string
  type: ToastType
}

type ToastProps = {
  toasts: Toast[]
  remove: (id: string) => void
}

export function ToastContainer({ toasts, remove }: ToastProps) {
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onRemove={remove} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const showTimer = setTimeout(() => setVisible(true), 10)
    const hideTimer = setTimeout(() => {
      setVisible(false)
      setTimeout(() => onRemove(toast.id), 300)
    }, 3500)
    return () => { clearTimeout(showTimer); clearTimeout(hideTimer) }
  }, [toast.id, onRemove])

  const icons: Record<ToastType, string> = { success: '◆', error: '✕', info: '◎' }
  const colors: Record<ToastType, string> = {
    success: 'border-l-4 border-gold',
    error: 'border-l-4 border-red-400',
    info: 'border-l-4 border-blue-400',
  }

  return (
    <div
      className={`pointer-events-auto flex items-center gap-3 bg-charcoal text-white px-5 py-3.5 min-w-[260px] max-w-sm shadow-xl transition-all duration-300 ${colors[toast.type]} ${
        visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-6'
      }`}
    >
      <span className="text-gold text-[11px]">{icons[toast.type]}</span>
      <p className="text-xs font-display flex-1">{toast.message}</p>
      <button
        onClick={() => { setVisible(false); setTimeout(() => onRemove(toast.id), 300) }}
        className="text-white/40 hover:text-white text-sm transition-colors ml-2"
      >
        ✕
      </button>
    </div>
  )
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const add = useCallback((message: string, type: ToastType = 'success') => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { id, message, type }])
  }, [])

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return { toasts, add, remove }
}
