'use client'

import { useRef, useEffect, useCallback } from 'react'
import { Trash2 } from 'lucide-react'

interface SignatureCanvasProps {
  onSign: (dataUrl: string) => void
  onClear?: () => void
  height?: number
  label?: string
  existingSig?: string | null
}

export default function SignatureCanvas({
  onSign,
  onClear,
  height = 160,
  label = 'Signature',
  existingSig = null,
}: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)
  const hasDrawn = useRef(false)

  const applyStyle = (ctx: CanvasRenderingContext2D) => {
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }

  // Le contexte est mis à l'échelle du devicePixelRatio (voir resize) : on
  // dessine donc en pixels CSS, pas en pixels du buffer.
  const getPoint = (e: PointerEvent | MouseEvent | TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) {
      const t = e.touches[0]
      return { x: t.clientX - rect.left, y: t.clientY - rect.top }
    }
    return {
      x: (e as MouseEvent).clientX - rect.left,
      y: (e as MouseEvent).clientY - rect.top,
    }
  }

  // Cale le buffer du canevas sur sa taille AFFICHÉE × densité d'écran. Sans ça,
  // un buffer étroit étiré sur grand écran (ordi, iPad paysage) déforme la
  // signature en longs traits horizontaux « bavés » (net seulement sur écran
  // étroit type iPhone). On préserve le tracé courant lors d'un redimensionnement
  // (rotation de la tablette) en le redessinant à la nouvelle échelle.
  const resize = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    if (rect.width === 0) return
    const dpr = window.devicePixelRatio || 1
    const targetW = Math.round(rect.width * dpr)
    const targetH = Math.round(rect.height * dpr)
    if (canvas.width === targetW && canvas.height === targetH) return

    // Contenu à restaurer après redimensionnement : tracé en cours, sinon
    // signature existante fournie en prop.
    const prev = hasDrawn.current ? canvas.toDataURL('image/png') : existingSig

    canvas.width = targetW
    canvas.height = targetH
    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)
    applyStyle(ctx)

    if (prev) {
      const img = new Image()
      img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height)
      img.src = prev
      hasDrawn.current = true
    }
  }, [existingSig])

  useEffect(() => {
    resize()
    const canvas = canvasRef.current
    if (!canvas || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => resize())
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [resize])

  const startDraw = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const point = getPoint(e.nativeEvent, canvas)
    ctx.beginPath()
    ctx.moveTo(point.x, point.y)
    isDrawing.current = true
  }, [])

  const draw = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    if (!isDrawing.current) return
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const point = getPoint(e.nativeEvent, canvas)
    ctx.lineTo(point.x, point.y)
    ctx.stroke()
    hasDrawn.current = true
  }, [])

  const endDraw = useCallback(() => {
    if (!isDrawing.current) return
    isDrawing.current = false
    if (hasDrawn.current) {
      const canvas = canvasRef.current!
      onSign(canvas.toDataURL('image/png'))
    }
  }, [onSign])

  const clear = useCallback(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    hasDrawn.current = false
    onClear?.()
  }, [onClear])

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <button
          type="button"
          onClick={clear}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-600 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
        >
          <Trash2 className="w-3.5 h-3.5" /> Effacer
        </button>
      </div>
      <div className="border-2 border-dashed border-gray-200 rounded-xl overflow-hidden bg-gray-50 relative">
        <canvas
          ref={canvasRef}
          onPointerDown={startDraw}
          onPointerMove={draw}
          onPointerUp={endDraw}
          onPointerLeave={endDraw}
          className="w-full touch-none cursor-crosshair"
          style={{ display: 'block', height }}
        />
        {!hasDrawn.current && !existingSig && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-gray-300 text-sm">Signez ici</p>
          </div>
        )}
      </div>
      <p className="text-xs text-gray-400 text-center">Utilisez votre doigt ou un stylet</p>
    </div>
  )
}
