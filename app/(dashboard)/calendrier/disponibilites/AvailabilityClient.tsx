'use client'

import { useState, useEffect, useMemo } from 'react'
import { startOfWeek, endOfWeek, addWeeks, addDays, format, isSameDay } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Plus, ChevronLeft, ChevronRight, ChevronDown, Pencil, Trash2 } from 'lucide-react'
import { EVENT_TYPE_LABELS, EVENT_COLORS } from '@/lib/calendar/constants'
import type { EventType } from '@/types/calendar'

// Abréviations des 7 jours dans l'ordre d'affichage de la semaine (lundi → dimanche).
const WEEK_ABBR = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim']

// Types proposables en réservation d'un créneau libre. On écarte « déplacement
// interne » (qui crée un trajet et réclame un véhicule) : ici on pose un
// rendez-vous ou une tâche, pas un déplacement de flotte.
const CREATE_TYPES: EventType[] = ['tache', 'rdv_client', 'rdv_garage', 'rdv_autre']

interface Profile { id: string; full_name: string; role: string }
interface Ev {
  id: string
  title: string
  event_type: string
  start_at: string
  end_at: string
  assigned_to: string | null
  reservation_id?: string | null
  source_key?: string | null
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
const fmtMin = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

// Minutes depuis minuit (heure navigateur = fuseau agence) d'un instant ISO.
const minutesOfDay = (iso: string) => {
  const d = new Date(iso)
  return d.getHours() * 60 + d.getMinutes()
}

// Un événement n'est modifiable/supprimable depuis ce planning que s'il a été
// posé « à la main » ici (tâche / RDV). On exclut TOUT miroir d'une autre source :
//  · réservations (reservation_id → départ/retour),
//  · trajets internes (source_key « trip-… », syncInternalTrip),
//  · alertes du tableau de bord (source_key = UUID d'alerte, syncAlertsToCalendar),
//  · tâches héritées / lavages (source_key « task-… », etc.).
// Ces miroirs sont recréés à la volée par leur synchro (idempotente via source_key
// ou reservation_id) : les supprimer ici les ferait « réapparaître » aussitôt, et
// désynchroniserait la source. Règle simple et robuste : un événement posé à la
// main via cette page n'a JAMAIS de source_key → tout source_key = lecture seule.
const isEditableEvent = (ev: Ev) =>
  (CREATE_TYPES as string[]).includes(ev.event_type) &&
  !ev.reservation_id &&
  !ev.source_key

/**
 * Modale de créneau : en création, le créneau (membre + date + tranche horaire)
 * pré-remplit l'événement, qui part dans le calendrier déjà attribué (assigned_to).
 * En édition (`event` fourni), on peut déplacer le rendez-vous (changer le titre,
 * le type, l'horaire → PATCH) ou le supprimer (DELETE). Même contrat que le tiroir
 * calendrier (instant ISO UTC).
 */
function BookSlotModal({
  profile, date, startMin, endMin, event, onClose, onSaved,
}: {
  profile: Profile
  date: Date
  startMin: number
  endMin: number
  event?: Ev | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!event
  const [title, setTitle] = useState(event?.title ?? '')
  const [eventType, setEventType] = useState<EventType>((event?.event_type as EventType) ?? 'tache')
  const [start, setStart] = useState(fmtMin(startMin))
  const [end, setEnd] = useState(fmtMin(endMin))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const busy = saving || deleting

  async function save() {
    if (!title.trim()) { setError('Le titre est requis.'); return }
    const startM = toMin(start)
    const endM = toMin(end)
    if (endM <= startM) { setError('La fin doit être après le début.'); return }

    setSaving(true)
    setError(null)

    // Date du créneau à l'heure murale du navigateur (fuseau agence), convertie
    // en instant UTC pour le stockage — identique à la logique du tiroir calendrier.
    const base = new Date(date); base.setHours(0, 0, 0, 0)
    const startDate = new Date(base); startDate.setHours(Math.floor(startM / 60), startM % 60, 0, 0)
    const endDate = new Date(base); endDate.setHours(Math.floor(endM / 60), endM % 60, 0, 0)

    try {
      const res = await fetch(
        isEdit ? `/api/calendar/events/${event!.id}` : '/api/calendar/events',
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            isEdit
              ? {
                  title: title.trim(),
                  event_type: eventType,
                  start_at: startDate.toISOString(),
                  end_at: endDate.toISOString(),
                }
              : {
                  title: title.trim(),
                  event_type: eventType,
                  status: 'a_faire',
                  start_at: startDate.toISOString(),
                  end_at: endDate.toISOString(),
                  assigned_to: profile.id,
                }
          ),
        }
      )
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        throw new Error(b.error ?? (isEdit ? "Erreur lors de l'enregistrement" : 'Erreur lors de la création'))
      }
      onSaved()
    } catch (e: any) {
      setError(e.message ?? 'Erreur')
      setSaving(false)
    }
  }

  async function remove() {
    if (!event) return
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch(`/api/calendar/events/${event.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        throw new Error(b.error ?? 'Erreur lors de la suppression')
      }
      onSaved()
    } catch (e: any) {
      setError(e.message ?? 'Erreur')
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center md:justify-center">
      <button type="button" aria-label="Fermer" onClick={onClose} className="absolute inset-0 bg-black/30" />
      <div className="relative w-full md:w-[380px] max-h-[88vh] overflow-y-auto bg-white rounded-t-2xl md:rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
        <div className="md:hidden flex justify-center pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>
        <div>
          <p className="text-[15px] font-black text-gray-900 leading-tight">
            {isEdit ? 'Modifier le rendez-vous' : 'Réserver le créneau'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5 capitalize">
            {profile.full_name} · {format(date, 'EEEE d MMM', { locale: fr })}
          </p>
        </div>

        <div>
          <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Titre</label>
          <input
            autoFocus={!isEdit}
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

        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} disabled={busy}
              className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-40">
              Annuler
            </button>
            <button type="button" onClick={save} disabled={busy}
              className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-white bg-[#111111] hover:bg-gray-800 transition-colors disabled:opacity-40">
              {saving ? (isEdit ? 'Enregistrement…' : 'Réservation…') : (isEdit ? 'Enregistrer' : 'Réserver')}
            </button>
          </div>

          {isEdit && (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setConfirmDelete(false)} disabled={busy}
                  className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-40">
                  Annuler
                </button>
                <button type="button" onClick={remove} disabled={busy}
                  className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-40">
                  {deleting ? 'Suppression…' : 'Confirmer'}
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} disabled={busy}
                className="w-full py-2.5 rounded-xl font-semibold text-sm text-red-600 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-40 inline-flex items-center justify-center gap-1.5">
                <Trash2 className="w-4 h-4" /> Supprimer
              </button>
            )
          )}
        </div>

        {/* Sur mobile, dégage la barre de navigation basse (60px + safe-area) pour
            que les boutons d'action ne soient pas masqués derrière. */}
        <div className="md:hidden" aria-hidden style={{ height: 'calc(60px + env(safe-area-inset-bottom))' }} />
      </div>
    </div>
  )
}

type ModalState =
  | { mode: 'create'; profile: Profile; date: Date; startMin: number; endMin: number }
  | { mode: 'edit'; profile: Profile; date: Date; event: Ev }

/**
 * Planning de l'équipe par jour, heure par heure (tranches d'1 h sur 24 h),
 * navigable semaine par semaine. On sélectionne un jour, puis on déroule un
 * membre pour voir ses créneaux : occupé (événement affecté + « Réservé ») ou
 * libre (bouton pour réserver une tâche / un rendez-vous). Un rendez-vous posé
 * ici se retouche (déplacer / supprimer) d'un clic sur sa tuile. La disponibilité
 * est implicite : toute tranche non réservée est réservable — aucun planning à
 * déclarer, la vue est opérante dès qu'un profil existe. Les événements de la
 * semaine affichée sont chargés à la volée depuis l'API calendrier.
 */
function AvailabilityScheduler({ profiles }: { profiles: Profile[] }) {
  const [weekOffset, setWeekOffset] = useState(0)
  const [selectedDayIdx, setSelectedDayIdx] = useState(() => (new Date().getDay() + 6) % 7) // lundi = 0
  const [events, setEvents] = useState<Ev[]>([])
  const [loading, setLoading] = useState(true)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  const [modal, setModal] = useState<ModalState | null>(null)

  const weekStart = useMemo(() => startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 }), [weekOffset])
  const weekEnd = useMemo(() => endOfWeek(weekStart, { weekStartsOn: 1 }), [weekStart])
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const selectedDay = days[selectedDayIdx]
  const today = new Date()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/calendar/events?start=${weekStart.toISOString()}&end=${weekEnd.toISOString()}`)
      .then(r => (r.ok ? r.json() : []))
      .then(d => { if (!cancelled) { setEvents(Array.isArray(d) ? d : []); setHasLoaded(true) } })
      .catch(() => { if (!cancelled) setEvents([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [weekStart, weekEnd, reloadKey])

  const toggle = (id: string) => setExpandedIds(prev => {
    const n = new Set(prev)
    n.has(id) ? n.delete(id) : n.add(id)
    return n
  })

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      {/* En-tête : navigation semaine */}
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={() => setWeekOffset(o => o - 1)}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 transition-colors" aria-label="Semaine précédente">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Planning de l&apos;équipe</p>
          <p className="text-sm font-black text-gray-900 capitalize">
            {format(weekStart, 'd', { locale: fr })}–{format(weekEnd, 'd MMM', { locale: fr })}
          </p>
        </div>
        <button type="button" onClick={() => setWeekOffset(o => o + 1)}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 transition-colors" aria-label="Semaine suivante">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Onglets jour */}
      <div className="grid grid-cols-7 gap-1 mb-3">
        {days.map((day, i) => {
          const active = i === selectedDayIdx
          const isToday = isSameDay(day, today)
          return (
            <button
              key={i}
              type="button"
              onClick={() => setSelectedDayIdx(i)}
              className={`flex flex-col items-center py-1.5 rounded-lg transition-colors ${
                active ? 'bg-[#111111] text-white' : 'hover:bg-gray-100 text-gray-600'
              }`}
            >
              <span className={`text-[10px] font-bold uppercase ${active ? 'text-white/70' : 'text-gray-400'}`}>{WEEK_ABBR[i]}</span>
              <span className={`text-sm font-bold ${!active && isToday ? 'text-green-600' : ''}`}>{format(day, 'd')}</span>
            </button>
          )
        })}
      </div>

      {/* Corps : membres × 24 tranches d'1 h du jour sélectionné */}
      {!hasLoaded ? (
        <p className="text-center text-sm text-gray-400 py-8">Chargement des créneaux…</p>
      ) : profiles.length === 0 ? (
        <p className="text-center text-sm text-gray-400 py-8">Aucun membre d&apos;équipe pour le moment.</p>
      ) : (
        <div className="space-y-2.5">
          {loading && (
            <p className="text-center text-[11px] text-gray-400 -mt-1 mb-1">Actualisation…</p>
          )}
          {profiles.map(m => {
            const dayEvents = events.filter(e => e.assigned_to === m.id && isSameDay(new Date(e.start_at), selectedDay))

            const bands: { h: number; ev: Ev | undefined }[] = []
            let freeCount = 0
            for (let h = 0; h < 24; h++) {
              const bandStart = h * 60
              const bandEnd = h * 60 + 60
              const ev = dayEvents.find(e => minutesOfDay(e.start_at) < bandEnd && minutesOfDay(e.end_at) > bandStart)
              if (!ev) freeCount++
              bands.push({ h, ev })
            }
            const reservedCount = 24 - freeCount
            const expanded = expandedIds.has(m.id)

            return (
              <div key={m.id} className="rounded-xl bg-gray-50 overflow-hidden">
                <button type="button" onClick={() => toggle(m.id)} className="w-full flex items-center justify-between px-3 py-2.5 text-left">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{m.full_name}</p>
                    <p className="text-[11px] text-gray-400 capitalize">{m.role}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {reservedCount > 0 && (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full text-amber-600 bg-amber-50">
                        {reservedCount} réservé{reservedCount > 1 ? 's' : ''}
                      </span>
                    )}
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      freeCount > 0 ? 'text-green-700 bg-green-50' : 'text-amber-600 bg-amber-50'
                    }`}>
                      {freeCount > 0 ? `${freeCount} libre${freeCount > 1 ? 's' : ''}` : 'Complet'}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {expanded && (
                  <div className="px-2 pb-2 space-y-1">
                    {bands.map(({ h, ev }) => {
                      const color = ev ? (EVENT_COLORS[ev.event_type as EventType] ?? '#6B7280') : ''
                      const evLabel = ev ? (ev.title || (EVENT_TYPE_LABELS[ev.event_type as EventType] ?? 'Événement')) : ''
                      const editable = ev ? isEditableEvent(ev) : false
                      return (
                        <div key={h} className="flex items-center gap-2">
                          <span className="w-11 flex-shrink-0 text-xs font-bold text-gray-400 tabular-nums">{fmtMin(h * 60)}</span>
                          {ev ? (
                            editable ? (
                              <button
                                type="button"
                                onClick={() => setModal({ mode: 'edit', profile: m, date: selectedDay, event: ev })}
                                className="flex-1 min-w-0 flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left transition-[filter] hover:brightness-95 active:brightness-95"
                                style={{ backgroundColor: `${color}14`, borderLeft: `3px solid ${color}` }}
                              >
                                <span className="text-xs font-semibold text-gray-800 truncate">{evLabel}</span>
                                <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400 flex-shrink-0 inline-flex items-center gap-1">
                                  <Pencil className="w-3 h-3" /> Modifier
                                </span>
                              </button>
                            ) : (
                              <div
                                className="flex-1 min-w-0 flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5"
                                style={{ backgroundColor: `${color}14`, borderLeft: `3px solid ${color}` }}
                              >
                                <span className="text-xs font-semibold text-gray-800 truncate">{evLabel}</span>
                                <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500 flex-shrink-0">Réservé</span>
                              </div>
                            )
                          ) : (
                            <button
                              type="button"
                              onClick={() => setModal({ mode: 'create', profile: m, date: selectedDay, startMin: h * 60, endMin: h * 60 + 60 })}
                              className="flex-1 flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 bg-white border border-dashed border-gray-200 hover:border-green-300 hover:bg-green-50/40 transition-colors group"
                            >
                              <span className="text-xs font-medium text-gray-400 group-hover:text-green-700">Libre</span>
                              <span className="text-xs font-bold text-green-700 inline-flex items-center gap-1">
                                <Plus className="w-3 h-3" /> Réserver
                              </span>
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {modal && (
        <BookSlotModal
          profile={modal.profile}
          date={modal.date}
          startMin={modal.mode === 'create' ? modal.startMin : minutesOfDay(modal.event.start_at)}
          endMin={modal.mode === 'create' ? modal.endMin : minutesOfDay(modal.event.end_at)}
          event={modal.mode === 'edit' ? modal.event : null}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); setReloadKey(k => k + 1) }}
        />
      )}
    </div>
  )
}

export default function AvailabilityClient({ profiles }: { profiles: Profile[] }) {
  return <AvailabilityScheduler profiles={profiles} />
}
