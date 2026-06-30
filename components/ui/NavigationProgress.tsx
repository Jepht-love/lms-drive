'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

export default function NavigationProgress() {
  const pathname = usePathname()
  const [width, setWidth]   = useState(0)
  const [visible, setVisible] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const doneRef     = useRef(false)
  const prevPath    = useRef(pathname)

  function start() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    doneRef.current = false
    setVisible(true)
    let w = 0
    setWidth(0)
    intervalRef.current = setInterval(() => {
      if (doneRef.current) {
        clearInterval(intervalRef.current!)
        setWidth(100)
        setTimeout(() => { setVisible(false); setWidth(0) }, 450)
        return
      }
      w += w < 30 ? 10 : w < 60 ? 5 : w < 80 ? 1.5 : w < 90 ? 0.4 : 0
      setWidth(Math.min(w, 90))
    }, 80)
  }

  // Navigation terminée quand le pathname change
  useEffect(() => {
    if (pathname !== prevPath.current) {
      prevPath.current = pathname
      doneRef.current = true
    }
  }, [pathname])

  // Intercepte les clics sur les liens internes
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const link = (e.target as HTMLElement).closest('a[href]') as HTMLAnchorElement | null
      if (!link) return
      const href = link.getAttribute('href') ?? ''
      if (
        !href ||
        href.startsWith('http') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        href.startsWith('#') ||
        link.target === '_blank'
      ) return
      start()
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  if (!visible) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none">
      <div
        className="h-[3px] bg-gradient-to-r from-violet-500 via-fuchsia-400 to-pink-500 relative"
        style={{
          width: `${width}%`,
          transition: width === 100 ? 'width 0.35s ease-out' : 'width 0.08s linear',
        }}
      >
        {/* Point lumineux au bout */}
        <span
          className="absolute right-0 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-fuchsia-300 opacity-80 blur-md"
          aria-hidden
        />
      </div>
    </div>
  )
}
