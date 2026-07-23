'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'

/**
 * Rendu PDF multi-pages via pdf.js (ticket SAV 23/07).
 * Sur iOS/WebKit, un PDF dans une <iframe> n'affiche que la première page,
 * sans défilement : les pages EDL des contrats (schéma du véhicule, dommages,
 * photos) étaient invisibles sur tablette. Ici chaque page est dessinée dans
 * un canvas empilé — tout le document se lit en défilant, sur tout support.
 */
export default function PdfPages({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url,
        ).toString()

        const doc = await pdfjs.getDocument({ url }).promise
        const container = containerRef.current
        if (cancelled || !container) return
        container.innerHTML = ''

        const width = container.clientWidth || 640
        const dpr = Math.min(window.devicePixelRatio || 1, 2) // netteté sans exploser la mémoire

        for (let n = 1; n <= doc.numPages; n++) {
          const page = await doc.getPage(n)
          if (cancelled) return
          const scale = width / page.getViewport({ scale: 1 }).width
          const viewport = page.getViewport({ scale: scale * dpr })
          const canvas = document.createElement('canvas')
          canvas.width = viewport.width
          canvas.height = viewport.height
          canvas.style.width = '100%'
          canvas.style.height = 'auto'
          canvas.className = 'block bg-white rounded-lg shadow-sm mb-3'
          container.appendChild(canvas)
          await page.render({ canvas, viewport }).promise
          if (n === 1 && !cancelled) setState('ready') // premières pages visibles sans attendre la fin
        }
        if (!cancelled) setState('ready')
      } catch {
        if (!cancelled) setState('error')
      }
    })()
    return () => { cancelled = true }
  }, [url])

  return (
    <div className="w-full h-full overflow-y-auto bg-gray-100 p-3">
      {state === 'loading' && (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" /> Chargement du document…
        </div>
      )}
      {state === 'error' && (
        <div className="py-16 text-center">
          <p className="text-sm text-gray-500 mb-3">Impossible d&apos;afficher le PDF ici.</p>
          <a href={url} target="_blank" rel="noopener noreferrer"
            className="text-sm font-semibold text-blue-600 underline underline-offset-2">
            Ouvrir dans un nouvel onglet
          </a>
        </div>
      )}
      <div ref={containerRef} />
    </div>
  )
}
