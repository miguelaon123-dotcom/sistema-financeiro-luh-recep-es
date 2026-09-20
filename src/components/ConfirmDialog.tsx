'use client'

import { useState, useCallback, useRef } from 'react'
import { AlertTriangle } from 'lucide-react'

interface ConfirmOptions {
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

type Resolver = (value: boolean) => void

/**
 * Hook que retorna um `confirm(message)` assíncrono e o componente <ConfirmDialog />.
 * Substitui window.confirm() — mantém o fullscreen ativo.
 *
 * Uso:
 *   const { confirm, ConfirmDialog } = useConfirm()
 *   ...
 *   const ok = await confirm({ message: 'Tem certeza?' })
 *   if (!ok) return
 */
export function useConfirm() {
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<ConfirmOptions>({ message: '' })
  const resolverRef = useRef<Resolver | null>(null)

  const confirm = useCallback((opts: ConfirmOptions | string): Promise<boolean> => {
    const normalized: ConfirmOptions =
      typeof opts === 'string' ? { message: opts } : opts
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve
      setOptions(normalized)
      setOpen(true)
    })
  }, [])

  const handleConfirm = () => {
    setOpen(false)
    resolverRef.current?.(true)
  }

  const handleCancel = () => {
    setOpen(false)
    resolverRef.current?.(false)
  }

  const ConfirmDialog = () => {
    if (!open) return null
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={handleCancel}
        />
        {/* Card */}
        <div className="relative w-full max-w-sm rounded-2xl border border-[#e5e5ea] bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-start gap-3 mb-5">
            <div className={`flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-xl ${
              options.danger !== false ? 'bg-[#feeceb] text-[#cf222e]' : 'bg-[#ebf4fe] text-[#0071e3]'
            }`}>
              <AlertTriangle size={18} />
            </div>
            <div>
              <p className="text-sm font-medium text-[#1d1d1f] leading-snug">
                {options.message}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={handleCancel}
              className="rounded-xl border border-[#e5e5ea] bg-white px-4 py-2 text-xs font-semibold text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors"
            >
              {options.cancelLabel ?? 'Cancelar'}
            </button>
            <button
              onClick={handleConfirm}
              className={`rounded-xl px-4 py-2 text-xs font-semibold text-white transition-colors ${
                options.danger !== false
                  ? 'bg-[#cf222e] hover:bg-[#a71d2a]'
                  : 'bg-[#0071e3] hover:bg-[#0060c7]'
              }`}
            >
              {options.confirmLabel ?? 'Confirmar'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return { confirm, ConfirmDialog }
}
