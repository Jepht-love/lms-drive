'use client'

import { useRef, useEffect, useCallback } from 'react'
import { Trash2 } from 'lucide-react'

interface SignatureCanvasProps {
  onSign: (dataUrl: string) => void
  onClear?: () => void
  width?: number
  height?: number
  label?: string
  existingSig?: string | null
}

export default function SignatureCanvas({
  onSign,
  onClear,
  width = 500,
  height = 160,
  label = 'Signature',
  existingSig = null,
}: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)
  const hasDrawn = useRef(false)

  const getPoint = (e: PointerEvent | MouseEvent | TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    if ('touches' in e) {
      const touch = e.touches[0]
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      }
    }
    return {
      x: ((e as MouseEvent).clientX - rect.left) * scaleX,
      y: ((e as MouseEvent).clientY - rect.top) * scaleY,
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    if (existingSig) {
      const img = new Image()
      img.onload = () => ctx.drawImage(img, 0, 0)
      img.src = existingSig
      hasDrawn.current = true
    }
  }, [existingSig])

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
        <label className="text-sm font-medium text-slate-700">{label}</label>
        <button
          type="button"
          onClick={clear}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-600 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
        >
          <Trash2 className="w-3.5 h-3.5" /> Effacer
        </button>
      </div>
      <div className="border-2 border-dashed border-slate-200 rounded-xl overflow-hidden bg-slate-50 relative">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          onPointerDown={startDraw}
          onPointerMove={draw}
          onPointerUp={endDraw}
          onPointerLeave={endDraw}
          className="w-full touch-none cursor-crosshair"
          style={{ display: 'block' }}
        />
        {!hasDrawn.current && !existingSig && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-slate-300 text-sm">Signez ici</p>
          </div>
        )}
      </div>
      <p className="text-xs text-slate-400 text-center">Utilisez votre doigt ou un stylet</p>
    </div>
  )
}
