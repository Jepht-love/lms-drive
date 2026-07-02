'use client'

import { useEffect } from 'react'

// Lightbox plein écran pour les photos de dommages (EDL).
// Styles inline volontaires : position fixed + overlay rgba — pas de classes
// Tailwind ici pour éviter tout conflit avec le safe-area / le z-index global.

interface PhotoLightboxProps {
  src: string
  alt?: string
  open: boolean
  onClose: () => void
}

export function PhotoLightbox({ src, alt, open, onClose }: PhotoLightboxProps) {
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.88)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          background: 'rgba(255,255,255,0.15)',
          border: 'none',
          borderRadius: '50%',
          width: '40px',
          height: '40px',
          color: 'white',
          fontSize: '20px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        aria-label="Fermer"
      >
        ×
      </button>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt ?? 'Photo dommage au départ'}
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '100%',
          maxHeight: '90vh',
          objectFit: 'contain',
          borderRadius: '12px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        }}
      />

      <p
        style={{
          position: 'absolute',
          bottom: '24px',
          left: 0,
          right: 0,
          textAlign: 'center',
          color: 'rgba(255,255,255,0.6)',
          fontSize: '13px',
          pointerEvents: 'none',
        }}
      >
        Photo constatée au départ · Tapez en dehors pour fermer
      </p>
    </div>
  )
}
