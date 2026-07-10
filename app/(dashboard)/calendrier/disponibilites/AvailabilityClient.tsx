'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { setWeeklyAvailability } from '@/lib/actions/availability'
import { EVENT_TYPE_LABELS, EVENT_COLORS } from '@/lib/calendar/constants'
import type { EventType } from '@/types/calendar'

const DAYS = [
  { value: 1, label: 'Lundi' },
  { value: 2, label: 'Mardi' },
  { value: 3, label: 'Mercredi' },
  { value: 4, label: 'Jeudi' },
  { value: 5, label: 'Vendredi' },
  { value: 6, label: 'Samedi' },
  { value: 0, label: 'Dimanche' },
]

// Types proposables en création rapide depuis un créneau libre. On écarte
// « déplacement interne » (qui crée un trajet et réclame un véhicule) : ici on
// planifie un rendez-vous ou une tâche, pas un déplacement de flotte.
const CREATE_TYPES: EventType[] = ['tache', 'rdv_client', 'rdv_garage', 'rdv_autre']

interface Slot { day_of_week: number; start_time: string; end_time: string }
interface Profile { id: string; full_name: string; role: string }
interface AssignedEvent {
  assigned_to: string
  start_at: string
  end_at: string
  title: string
  event_type: string
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
const fmtMin = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

/**
 * Soustrait les intervalles occupés d'une fenêtre de disponibilité et renvoie
 * les créneaux libres restants (en minutes depuis minuit). Les intervalles sont
 * d'abord bornés à la fenêtre puis fusionnés, ce qui gère les chevauchements
 * d'événements sans cas particulier.
 */
function computeFreeSlots(ws: number, we: number, busy: [number, number][]): [number, number][] {
  const clipped = busy
    .map(([s, e]) => [Math.max(s, ws), Math.min(e, we)] as [number, number])
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0])

  const merged: [number, number][] = []
  for (const iv of clipped) {
    const last = merged[merged.length - 1]
    if (last && iv[0] <= last[1]) last[1] = Math.max(last[1], iv[1])
    else merged.push([iv[0], iv[1]])
  }

  const free: [number, number][] = []
  let cursor = ws
  for (const [s, e] of merged) {
    if (s > cursor) free.push([cursor, s])
    cursor = Math.max(cursor, e)
  }
  if (cursor < we) free.push([cursor, we])
  return free
}

function DaySlotForm({ userId, slots }: { userId: string; slots: Slot[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [days, setDays] = useState(() => DAYS.map(d => {
    const existing = slots.find(s => s.day_of_week === d.value)
    return {
      day_of_week: d.value,
      is_active: !!existing,
      start_time: existing?.start_time?.slice(0, 5) ?? '08:00',
      end_time: existing?.end_time?.slice(0, 5) ?? '18:00',
    }
  }))

  function update(dayValue: number, patch: Partial<typeof days[number]>) {
    setDays(prev => prev.map(d => d.day_of_week === dayValue ? { ...d, ...patch } : d))
  }

  function onSave() {
    setError(null)
    startTransition(async () => {
      const res = await setWeeklyAvailability(userId, days)
      if (res?.error) setError(res.error)
      else router.refresh()
    })
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-2">
      <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">Mon planning hebdomadaire</p>
      {DAYS.map(d => {
        const day = days.find(x => x.day_of_week === d.value)!
        return (
          <div key={d.value} className="flex items-center gap-3 py-1.5">
            <button
              type="button"
              onClick={() => update(d.value, { is_active: !day.is_active })}
              className={`w-16 flex-shrink-0 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                day.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
              }`}
            >
              {d.label.slice(0, 3)}
            </button>
            {day.is_active ? (
              <div className="flex items-center gap-2">
                <input type="time" value={day.start_time} onChange={e => update(d.value, { start_time: e.target.value })}
                  className="text-sm border border-gray-200 rounded-lg px-2 py-1" />
                <span className="text-gray-400 text-xs">→</span>
                <input type="time" value={day.end_time} onChange={e => update(d.value, { end_time: e.target.value })}
                  className="text-sm border border-gray-200 rounded-lg px-2 py-1" />
              </div>
            ) : (
              <span className="text-xs text-gray-400">Non disponible</span>
            )}
          </div>
        )
      })}
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}
      <button onClick={onSave} disabled={pending}
        className="w-full mt-2 py-2.5 bg-[#111111] text-white rounded-xl font-semibold text-sm hover:bg-gray-800 transition-colors disabled:opacity-40">
        {pending ? 'Enregistrement…' : 'Enregistrer mon planning'}
      </button>
    </div>
  )
}

/**
 * Modale de création rapide : le créneau libre sélectionné pré-remplit l'horaire
 * et le collaborateur ; l'événement part directement dans le calendrier, déjà
 * attribué (assigned_to). Même contrat que le tiroir calendrier (POST ISO UTC).
 */
function CreateFromSlotModal({
  profile, startMin, endMin, onClose, onCreated,
}: {
  profile: Profile
  startMin: number
  endMin: number
  onClose: () => void
  onCreated: () => void
}) {
  const [title, setTitle] = useState('')
  const [eventType, setEventType] = useState<EventType>('tache')
  const [start, setStart] = useState(fmtMin(startMin))
  const [end, setEnd] = useState(fmtMin(Math.min(startMin + 60, endMin)))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (!title.trim()) { setError('Le titre est requis.'); return }
    const startM = toMin(start)
    const endM = toMin(end)
    if (endM <= startM) { setError('La fin doit être après le début.'); return }

    setSaving(true)
    setError(null)

    // Aujourd'hui à l'heure murale du navigateur (fuseau agence), converti en
    // instant UTC pour le stockage — identique à la logique du tiroir calendrier.
    const midnight = new Date(); midnight.setHours(0, 0, 0, 0)
    const startDate = new Date(midnight); startDate.setHours(Math.floor(startM / 60), startM % 60, 0, 0)
    const endDate = new Date(midnight); endDate.setHours(Math.floor(endM / 60), endM % 60, 0, 0)

    try {
      const res = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          event_type: eventType,
          status: 'a_faire',
          start_at: startDate.toISOString(),
          end_at: endDate.toISOString(),
          assigned_to: profile.id,
        }),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        throw new Error(b.error ?? "Erreur lors de la création")
      }
      onCreated()
    } catch (e: any) {
      setError(e.message ?? "Erreur lors de la création")
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center md:justify-center">
      <button type="button" aria-label="Fermer" onClick={onClose} className="absolute inset-0 bg-black/30" />
      <div
        className="relative w-full md:w-[380px] bg-white rounded-t-2xl md:rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3"
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
      >
        <div className="md:hidden flex justify-center pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>
        <div>
          <p className="text-[15px] font-black text-gray-900 leading-tight">Nouvel événement</p>
          <p className="text-xs text-gray-400 mt-0.5">Attribué à {profile.full_name}</p>
        </div>

        <div>
          <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Titre</label>
          <input
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Ex : Remise des clés"
            className="mt-1 w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5"
          />
        </div>

        <div>
          <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Type</label>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {CREATE_TYPES.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setEventType(t)}
                className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors ${
                  eventType === t ? 'text-white border-transparent' : 'text-gray-600 border-gray-200 bg-white'
                }`}
                style={eventType === t ? { backgroundColor: EVENT_COLORS[t] } : undefined}
              >
                {EVENT_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1">
            <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Début</label>
            <input type="time" value={start} onChange={e => setStart(e.target.value)}
              className="mt-1 w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5" />
          </div>
          <span className="text-gray-300 mt-5">→</span>
          <div className="flex-1">
            <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Fin</label>
            <input type="time" value={end} onChange={e => setEnd(e.target.value)}
              className="mt-1 w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5" />
          </div>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}

        <div className="flex items-center gap-2 pt-1">
          <button type="button" onClick={onClose} disabled={saving}
            className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-40">
            Annuler
          </button>
          <button type="button" onClick={save} disabled={saving}
            className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-white bg-[#111111] hover:bg-gray-800 transition-colors disabled:opacity-40">
            {saving ? 'Création…' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AvailabilityClient({
  userId, mySlots, profiles, allSlots, todayEvents,
}: {
  userId: string
  mySlots: Slot[]
  profiles: Profile[]
  allSlots: (Slot & { user_id: string })[]
  todayEvents: AssignedEvent[]
}) {
  const router = useRouter()
  const todayDow = new Date().getDay()
  const [creating, setCreating] = useState<{ profile: Profile; startMin: number; endMin: number } | null>(null)

  // Bornes du jour calendaire courant (heure navigateur = fuseau agence) : on ne
  // retient comme "occupé" que les événements dont le début tombe aujourd'hui.
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0)
  const nextDay = new Date(dayStart); nextDay.setDate(dayStart.getDate() + 1)
  const isToday = (iso: string) => { const d = new Date(iso); return d >= dayStart && d < nextDay }

  return (
    <div className="space-y-4">
      <DaySlotForm userId={userId} slots={mySlots} />

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">
          Créneaux libres aujourd&apos;hui
        </p>
        <p className="text-[11px] text-gray-400 mb-3">
          Calculés à partir des tâches et événements déjà attribués. Touchez un créneau pour planifier.
        </p>
        <div className="space-y-2.5">
          {profiles.map(p => {
            const slot = allSlots.find(s => s.user_id === p.id && s.day_of_week === todayDow)
            if (!slot) {
              return (
                <div key={p.id} className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{p.full_name}</p>
                    <p className="text-[11px] text-gray-400 capitalize">{p.role}</p>
                  </div>
                  <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
                    Indisponible
                  </span>
                </div>
              )
            }

            const ws = toMin(slot.start_time.slice(0, 5))
            const we = toMin(slot.end_time.slice(0, 5))
            const busy = todayEvents
              .filter(e => e.assigned_to === p.id && isToday(e.start_at))
              .map(e => {
                const s = new Date(e.start_at)
                const en = new Date(e.end_at)
                return [s.getHours() * 60 + s.getMinutes(), en.getHours() * 60 + en.getMinutes()] as [number, number]
              })
            const free = computeFreeSlots(ws, we, busy)

            return (
              <div key={p.id} className="p-3 rounded-xl bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{p.full_name}</p>
                    <p className="text-[11px] text-gray-400 capitalize">{p.role} · {fmtMin(ws)}–{fmtMin(we)}</p>
                  </div>
                </div>
                {free.length === 0 ? (
                  <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
                    Complet
                  </span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {free.map(([s, e], i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setCreating({ profile: p, startMin: s, endMin: e })}
                        className="inline-flex items-center gap-1 text-xs font-bold text-green-700 bg-green-50 hover:bg-green-100 px-2.5 py-1.5 rounded-full transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                        {fmtMin(s)}–{fmtMin(e)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {creating && (
        <CreateFromSlotModal
          profile={creating.profile}
          startMin={creating.startMin}
          endMin={creating.endMin}
          onClose={() => setCreating(null)}
          onCreated={() => { setCreating(null); router.refresh() }}
        />
      )}
    </div>
  )
}
