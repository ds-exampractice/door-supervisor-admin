import { type ReactNode, useEffect } from 'react'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
}

export default function Modal({ title, onClose, children, size = 'md' }: ModalProps) {
  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const widthClass = size === 'sm' ? 'max-w-md' : size === 'lg' ? 'max-w-3xl' : 'max-w-xl'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      {/* Panel */}
      <div className={`relative bg-white rounded-2xl shadow-2xl w-full ${widthClass} max-h-[92vh] flex flex-col`}>
        <div className="flex items-center justify-between px-7 py-5 border-b border-gray-100">
          <h2 className="font-bold text-[#2C3E50] text-lg">{title}</h2>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition text-xl leading-none">×</button>
        </div>
        <div className="overflow-y-auto flex-1 px-7 py-6">{children}</div>
      </div>
    </div>
  )
}
