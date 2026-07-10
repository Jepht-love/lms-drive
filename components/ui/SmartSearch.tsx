'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search } from 'lucide-react'
import Link from 'next/link'

interface Suggestion { id: string; label: string; sub?: string; href: string }

interface Props {
  name?: string
  placeholder?: string
  defaultValue?: string
  scope: 'clients' | 'vehicles' | 'reservations'
  className?: string
}

async function fetchFor(supabase: ReturnType<typeof createClient>, scope: Props['scope'], q: string): Promise<Suggestion[]> {
  if (scope === 'clients') {
    const { data } = await supabase
      .from('clients')
      .select('id, first_name, last_name, phone')
      .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(6)
    return (data ?? []).map(r => ({
      id: r.id,
      label: `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim(),
      sub: r.phone ?? undefined,
      href: `/clients/${r.id}`,
    }))
  }
  if (scope === 'vehicles') {
    const { data } = await supabase
      .from('vehicles')
      .select('id, plate, brand, model')
      .or(`plate.ilike.%${q}%,brand.ilike.%${q}%,model.ilike.%${q}%`)
      .eq('is_active', true)
      .limit(6)
    return (data ?? []).map(r => ({
      id: r.id,
      label: `${r.brand ?? ''} ${r.model ?? ''}`.trim(),
      sub: r.plate,
      href: `/vehicles/${r.id}`,
    }))
  }
  if (scope === 'reservations') {
    const { data } = await supabase
      .from('reservations')
      .select('id, reservation_number, vehicles(plate, brand, model), clients(first_name, last_name)')
      .or(`reservation_number.ilike.%${q}%`)
      .limit(6)
    return (data ?? []).map(r => {
      const v = Array.isArray(r.vehicles) ? (r.vehicles as any[])[0] : r.vehicles as any
      const c = Array.isArray(r.clients) ? (r.clients as any[])[0] : r.clients as any
      return {
        id: r.id,
        label: r.reservation_number ?? '',
        sub: `${c?.first_name ?? ''} ${c?.last_name ?? ''} · ${v?.plate ?? ''}`.trim(),
        href: `/reservations/${r.id}`,
      }
    })
  }
  return []
}

export default function SmartSearch({ name = 'q', placeholder, defaultValue = '', scope, className }: Props) {
  const [value, setValue] = useState(defaultValue)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const supabase = createClient()

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
    if (q.length < 1) { setSuggestions([]); setOpen(false); return }
    debounceRef.current = setTimeout(async () => {
      const results = await fetchFor(supabase, scope, q)
      setSuggestions(results)
      setOpen(results.length > 0)
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
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 shadow-xl rounded-xl overflow-hidden z-50">
          {suggestions.map(s => (
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
          ))}
        </div>
      )}
    </div>
  )
}
