'use client'

import { useState, useRef, useEffect } from 'react'
import { Search } from 'lucide-react'
import Link from 'next/link'

interface Suggestion { id: string; label: string; sub?: string; href: string }

interface Props {
  name?: string
  placeholder?: string
  defaultValue?: string
  scope: 'clients' | 'vehicles' | 'reservations' | 'contracts' | 'maintenance' | 'infractions' | 'sinistres' | 'partnerships'
  className?: string
}

export default function SmartSearch({ name = 'q', placeholder, defaultValue = '', scope, className }: Props) {
  const [value, setValue] = useState(defaultValue)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // Évite qu'une réponse lente écrase une frappe plus récente (course réseau).
  const reqIdRef = useRef(0)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value
    setValue(q)
    clearTimeout(debounceRef.current)
    if (q.trim().length < 1) { setSuggestions([]); setOpen(false); setLoading(false); return }
    // Ouvre immédiatement le menu (état « Recherche… ») dès la 1ʳᵉ lettre/chiffre :
    // l'utilisateur voit tout de suite que la recherche réagit.
    setLoading(true)
    setOpen(true)
    const reqId = ++reqIdRef.current
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?scope=${scope}&q=${encodeURIComponent(q.trim())}`, {
          credentials: 'same-origin',
          headers: { accept: 'application/json' },
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const results: Suggestion[] = await res.json()
        if (reqId !== reqIdRef.current) return // réponse obsolète
        setSuggestions(Array.isArray(results) ? results : [])
        setOpen(true)
      } catch {
        if (reqId !== reqIdRef.current) return
        setSuggestions([])
        setOpen(true)
      } finally {
        if (reqId === reqIdRef.current) setLoading(false)
      }
    }, 180)
  }

  return (
    <div ref={containerRef} className={`relative ${className ?? ''}`}>
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-10" />
      <input
        type="search"
        name={name}
        value={value}
        onChange={handleChange}
        onFocus={() => { if (suggestions.length > 0) setOpen(true) }}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full bg-white border border-gray-100 shadow-sm rounded-xl pl-10 pr-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10"
      />
      {open && value.trim().length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 shadow-xl rounded-xl overflow-hidden z-50">
          {loading && suggestions.length === 0 ? (
            <p className="px-4 py-3 text-sm text-gray-400">Recherche…</p>
          ) : suggestions.length === 0 ? (
            <p className="px-4 py-3 text-sm text-gray-400">Aucun résultat</p>
          ) : (
            suggestions.map(s => (
              <Link
                key={s.id}
                href={s.href}
                onClick={() => setOpen(false)}
                className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{s.label}</p>
                  {s.sub && <p className="text-xs text-gray-400 truncate mt-0.5">{s.sub}</p>}
                </div>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  )
}
