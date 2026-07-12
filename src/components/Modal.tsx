import { type ReactNode, useEffect } from 'react'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
}

export default function Modal({ title, onClose, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const maxW = size === 'sm' ? '440px' : size === 'lg' ? '760px' : '560px'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
    }}>
      <div
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(15,23,42,0.45)',
          backdropFilter: 'blur(2px)',
        }}
        onClick={onClose}
      />
      <div style={{
        position: 'relative',
        background: 'var(--bg-surface)',
        borderRadius: 'var(--r3)',
        boxShadow: 'var(--shadow-modal)',
        border: '1px solid var(--border)',
        width: '100%',
        maxWidth: maxW,
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 24px',
          borderBottom: '1px solid var(--border)',
        }}>
          <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--t1)' }}>{title}</span>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 'var(--r1)', border: 'none', background: 'transparent',
              cursor: 'pointer', color: 'var(--t4)',
              transition: 'background 0.1s, color 0.1s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-hover)'
              ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--t1)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
              ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--t4)'
            }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '24px' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
