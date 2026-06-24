'use client'

import { useState } from 'react'
import { Plus, Search, X } from 'lucide-react'
import type { CalendarEvent } from '@/types/calendar'

interface CalendarBottomBarProps {
  events: CalendarEvent[]
  onCreateNew: () => void
  onPickEvent: (event: CalendarEvent) => void
}

// Barre "Retour/Client/Véhicule/Contrat" supprimée (2026-06-23) : elle faisait
// doublon avec le BottomNav standard juste en dessous. Ne reste que le bouton
// de création flottant + la recherche (pas de remplaçant ailleurs sur la page).
export default function CalendarBottomBar({ events, onCreateNew, onPickEvent }: CalendarBottomBarProps) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')

  const results = query.trim().length === 0 ? [] : events.filter(e => {
    const q = query.toLowerCase()
    const clientName = e.client ? `${e.client.first_name} ${e.client.last_name}`.toLowerCase() : ''
    const plates = (e.vehicles ?? []).map(v => v.plate.toLowerCase()).join(' ')
    return e.title.toLowerCase().includes(q) || clientName.includes(q) || plates.includes(q)
  }).slice(0, 20)

  return (
    <>
      {searchOpen && (
        <div className="fixed inset-0 z-50">
          <button type="button" aria-label="Fermer" onClick={() => setSearchOpen(false)} className="absolute inset-0 bg-black/10" />
          <div className="absolute left-3 right-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-3 max-h-[60vh] overflow-y-auto" style={{ bottom: 'calc(60px + env(safe-area-inset-bottom) + 76px)' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[13px] font-semibold">Rechercher un événement</span>
              <button type="button" onClick={() => setSearchOpen(false)}><X size={14} className="text-gray-400" /></button>
            </div>
            <input
              autoFocus
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Titre, client, plaque…"
              className="w-full border border-gray-200 rounded-lg px-3 h-9 text-[13px] mb-2"
            />
            {results.map(ev => (
              <button
                key={ev.id}
                type="button"
                onClick={() => { onPickEvent(ev); setSearchOpen(false) }}
                className="w-full text-left px-2 py-2 border-b border-gray-50 last:border-0"
              >
                <p className="text-[12px] font-medium">{ev.title}</p>
                <p className="text-[11px] text-gray-400">
                  {(ev.vehicles ?? []).map(v => v.plate).join(', ')}{ev.client ? ` — ${ev.client.first_name} ${ev.client.last_name}` : ''}
                </p>
              </button>
            ))}
            {query.trim().length > 0 && results.length === 0 && (
              <p className="text-[12px] text-gray-400 px-2 py-2">Aucun résultat.</p>
            )}
          </div>
        </div>
      )}

      {/* Deux boutons flottants juste au-dessus du BottomNav standard (60px +
          safe-area) — plus de barre intermédiaire en double. */}
      <button
        type="button"
        onClick={() => setSearchOpen(true)}
        aria-label="Rechercher un événement"
        className="fixed right-[68px] z-40 w-[44px] h-[44px] rounded-full bg-white text-[#111111] border border-gray-200 flex items-center justify-center shadow-lg"
        style={{ bottom: 'calc(60px + env(safe-area-inset-bottom) + 12px)' }}
      >
        <Search size={18} />
      </button>

      <button
        type="button"
        onClick={onCreateNew}
        aria-label="Créer un événement"
        className="fixed right-4 z-40 w-[48px] h-[48px] rounded-full bg-[#111111] text-white flex items-center justify-center shadow-lg"
        style={{ bottom: 'calc(60px + env(safe-area-inset-bottom) + 10px)' }}
      >
        <Plus size={22} />
      </button>
    </>
  )
}
