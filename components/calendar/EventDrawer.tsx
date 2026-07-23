'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { ExternalLink, ClipboardCheck, User, Car, Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import DateTimeField from '@/components/ui/DateTimeField'
import type { CalendarEvent, CalendarResource, EventStatus, EventType } from '@/types/calendar'
import { EVENT_TYPE_LABELS, EVENT_COLORS, EVENT_STATUS_LABELS, STATUS_COLORS, UNASSIGNED_RESOURCE_ID } from '@/lib/calendar/constants'

// Un événement synchronisé depuis un autre module ne se modifie pas ici : sa
// source (réservation, déplacement, alerte) est la vérité. On garde le statut,
// l'assignation et les notes éditables (utile pour piloter depuis le calendrier)
// mais on verrouille les champs structurels (type, dates, véhicules, client).
const RESERVATION_DERIVED: EventType[] = ['reservation', 'depart_vehicule', 'retour_vehicule']

function syncInfo(event: CalendarEvent | null): { label: string } | null {
  if (!event) return null
  const key = event.source_key ?? ''
  if (key.startsWith('trip-')) return { label: 'Synchronisé depuis un déplacement interne' }
  if (key.startsWith('ct-')) return { label: 'Alerte véhicule automatique' }
  if (key) return { label: 'Événement synchronisé' }
  if (event.reservation_id && RESERVATION_DERIVED.includes(event.event_type)) {
    return { label: 'Synchronisé depuis la réservation' }
  }
  return null
}

// Raccourcis contextuels : un événement lié à une réservation / un client / un
// véhicule doit ouvrir l'objet métier en un clic — le calendrier devient un
// point d'entrée d'action, pas un simple miroir.
function eventLinks(event: CalendarEvent | null) {
  if (!event) return []
  const links: { href: string; label: string; Icon: typeof ExternalLink }[] = []
  const vehicleLinkId = event.vehicles?.[0]?.id ?? event.vehicle_ids?.[0] ?? null
  if (event.reservation_id) {
    links.push({ href: `/reservations/${event.reservation_id}?from=calendrier`, label: 'Ouvrir la réservation', Icon: ExternalLink })
    if (event.event_type === 'depart_vehicule') {
      links.push({ href: `/inspections/departure/${event.reservation_id}`, label: "Faire l'EDL de départ", Icon: ClipboardCheck })
    }
  }
  if (event.client_id) links.push({ href: `/clients/${event.client_id}`, label: 'Fiche client', Icon: User })
  if (vehicleLinkId) links.push({ href: `/vehicles/${vehicleLinkId}`, label: 'Fiche véhicule', Icon: Car })
  return links
}

interface SlotContext {
  resource: CalendarResource
  date: Date
  hour: number
}

// Pré-remplissage du tiroir en mode CRÉATION (ex. depuis « À assigner » du
// tableau de bord : on ouvre une tâche déjà renseignée qu'il ne reste qu'à
// affecter à quelqu'un, même si aucun événement n'existait encore).
export interface CreatePrefill {
  title?: string
  eventType?: EventType
  start?: string        // ISO
  end?: string          // ISO
  vehicleIds?: string[]
  clientId?: string
}

interface EventDrawerProps {
  open: boolean
  event: CalendarEvent | null
  slotContext: SlotContext | null
  resources: CalendarResource[]
  // Type présélectionné via le menu de création contextuel ("+" → Tâche / RDV…)
  presetType?: EventType | null
  // Pré-remplissage en création (titre, véhicule, date…) — voir CreatePrefill.
  prefill?: CreatePrefill | null
  onClose: () => void
  onSave: () => void
  onDelete: () => void
}

interface VehicleOption { id: string; plate: string; brand: string; model: string }
interface ClientOption { id: string; first_name: string; last_name: string }

function toLocalInput(date: Date): string {
  return format(date, "yyyy-MM-dd'T'HH:mm")
}

function assigneeValue(e: CalendarEvent | null): string {
  if (!e) return ''
  if (e.assigned_to) return `profile:${e.assigned_to}`
  if (e.assigned_team_id) return `team:${e.assigned_team_id}`
  return ''
}

export default function EventDrawer({ open, event, slotContext, resources, presetType, prefill, onClose, onSave, onDelete }: EventDrawerProps) {
  const isEdit = !!event
  const links = eventLinks(event)
  const sync = syncInfo(event)
  const locked = !!sync

  const [title, setTitle] = useState('')
  const [eventType, setEventType] = useState<EventType>('tache')
  const [status, setStatus] = useState<EventStatus>('a_faire')
  const [startAt, setStartAt] = useState('')
  const [endAt, setEndAt] = useState('')
  const [assignee, setAssignee] = useState('')
  const [vehicleIds, setVehicleIds] = useState<string[]>([])
  const [clientId, setClientId] = useState('')
  const [notes, setNotes] = useState('')

  const [vehicles, setVehicles] = useState<VehicleOption[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [saving, setSaving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setConfirmingDelete(false)

    if (event) {
      setTitle(event.title)
      setEventType(event.event_type)
      setStatus(event.status)
      setStartAt(toLocalInput(new Date(event.start_at)))
      setEndAt(toLocalInput(new Date(event.end_at)))
      setAssignee(assigneeValue(event))
      setVehicleIds(event.vehicle_ids ?? [])
      setClientId(event.client_id ?? '')
      setNotes(event.notes ?? '')
    } else {
      setTitle(prefill?.title ?? '')
      setEventType(prefill?.eventType ?? presetType ?? 'tache')
      setStatus('a_faire')
      setVehicleIds(prefill?.vehicleIds ?? [])
      setClientId(prefill?.clientId ?? '')
      setNotes('')
      if (prefill?.start) {
        // Création pré-remplie (ex. « À assigner » du tableau de bord) : date de
        // la tâche = celle de l'événement métier (départ/retour), reste à affecter.
        const start = new Date(prefill.start)
        const end = prefill.end ? new Date(prefill.end) : new Date(start.getTime() + 3600_000)
        setStartAt(toLocalInput(start))
        setEndAt(toLocalInput(end))
        setAssignee('')
      } else if (slotContext) {
        const start = new Date(slotContext.date)
        start.setHours(slotContext.hour, 0, 0, 0)
        const end = new Date(start)
        end.setHours(start.getHours() + 1)
        setStartAt(toLocalInput(start))
        setEndAt(toLocalInput(end))
        setAssignee(
          slotContext.resource.id === UNASSIGNED_RESOURCE_ID
            ? ''
            : `${slotContext.resource.type}:${slotContext.resource.id}`
        )
      } else {
        const now = new Date()
        const end = new Date(now)
        end.setHours(now.getHours() + 1)
        setStartAt(toLocalInput(now))
        setEndAt(toLocalInput(end))
        setAssignee('')
      }
    }
  }, [open, event, slotContext, presetType, prefill])

  useEffect(() => {
    if (!open) return
    const supabase = createClient()
    supabase.from('vehicles').select('id, plate, brand, model').order('plate')
      .then(({ data }) => setVehicles(data ?? []))
    supabase.from('clients').select('id, first_name, last_name').order('last_name')
      .then(({ data }) => setClients(data ?? []))
  }, [open])

  if (!open) return null

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Le titre est requis.')
      return
    }
    setSaving(true)
    setError(null)

    const [assigneeType, assigneeId] = assignee ? assignee.split(':') : [null, null]

    const payload = {
      title: title.trim(),
      event_type: eventType,
      status,
      start_at: new Date(startAt).toISOString(),
      end_at: new Date(endAt).toISOString(),
      assigned_to: assigneeType === 'profile' ? assigneeId : null,
      assigned_team_id: assigneeType === 'team' ? assigneeId : null,
      vehicle_ids: vehicleIds.length > 0 ? vehicleIds : null,
      client_id: clientId || null,
      notes: notes || null,
    }

    try {
      const res = await fetch(
        isEdit ? `/api/calendar/events/${event!.id}` : '/api/calendar/events',
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? "Erreur lors de l'enregistrement")
      }
      onSave()
      onClose()
    } catch (e: any) {
      setError(e.message ?? "Erreur lors de l'enregistrement")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!event) return
    setSaving(true)
    try {
      const res = await fetch(`/api/calendar/events/${event.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erreur lors de la suppression')
      onDelete()
      onClose()
    } catch (e: any) {
      setError(e.message ?? 'Erreur lors de la suppression')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-stretch md:justify-end">
      {/* Backdrop */}
      <button type="button" aria-label="Fermer" onClick={onClose} className="absolute inset-0 bg-black/30" />

      {/*
        Mobile  : bottom sheet, monte du bas, 90dvh, coins arrondis en haut
        Desktop : tiroir droite, plein hauteur
      */}
      <div className="
        relative flex flex-col bg-white shadow-sm border-gray-100
        w-full max-h-[90dvh] rounded-t-2xl
        md:rounded-none md:border-l md:max-h-none md:h-full md:w-full md:max-w-[380px]
      ">
        {/* Drag handle (mobile only) */}
        <div className="md:hidden flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-2 pb-3 shrink-0 border-b border-gray-100">
          <h2 className="text-[14px] font-semibold">{isEdit ? "Modifier l'événement" : 'Nouvel événement'}</h2>
          <button type="button" onClick={onClose} className="text-gray-400 text-[20px] leading-none w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100">
            ✕
          </button>
        </div>

        {/* Scrollable form */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {/* Raccourcis vers les objets métier liés */}
          {links.length > 0 && (
            <div className="mb-4">
              <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Raccourcis</label>
              <div className="grid grid-cols-1 gap-1.5">
                {links.map(({ href, label, Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={onClose}
                    className="flex items-center gap-2.5 px-3 h-10 rounded-xl bg-gray-50 border border-gray-100 text-[13px] font-medium text-gray-800 hover:bg-gray-100 active:scale-[.99] transition"
                  >
                    <Icon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    <span className="flex-1">{label}</span>
                    <span className="text-gray-300 text-[16px] leading-none">›</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {sync && (
            <div className="mb-4 flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2.5">
              <Lock className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-[12px] text-amber-700 leading-snug">
                {sync.label}. Type, dates et liens se modifient depuis la source ; ici vous pouvez ajuster le statut, l&apos;assignation et les notes.
              </p>
            </div>
          )}

          <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">Titre</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            disabled={locked}
            className="w-full border border-gray-200 rounded-lg px-3 h-9 text-[13px] mb-3 disabled:bg-gray-50 disabled:text-gray-400"
            placeholder="Ex : RDV client signature contrat"
          />

          <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">Type d&apos;événement</label>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: EVENT_COLORS[eventType] }} />
            <select
              value={eventType}
              onChange={e => setEventType(e.target.value as EventType)}
              disabled={locked}
              className="flex-1 border border-gray-200 rounded-lg px-3 h-9 text-[13px] disabled:bg-gray-50 disabled:text-gray-400"
            >
              {Object.entries(EVENT_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">Statut</label>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {Object.entries(EVENT_STATUS_LABELS).map(([key, label]) => {
              const active = key === status
              const color = STATUS_COLORS[key as EventStatus]
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStatus(key as EventStatus)}
                  className="h-7 px-2.5 rounded-full text-[11px] font-medium"
                  style={active
                    ? { backgroundColor: color, color: 'white' }
                    : { backgroundColor: 'white', color, border: `1px solid ${color}` }}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {/* Début / Fin empilés : champs date + heure séparés (un datetime-local
              a une largeur incompressible sur Safari et déborderait du drawer). */}
          <div className="space-y-2.5 mb-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">Début</label>
              <DateTimeField
                value={startAt}
                onChange={setStartAt}
                disabled={locked}
                className="border border-gray-200 rounded-lg px-2 h-9 text-[12px] disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">Fin</label>
              <DateTimeField
                value={endAt}
                onChange={setEndAt}
                disabled={locked}
                className="border border-gray-200 rounded-lg px-2 h-9 text-[12px] disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>
          </div>

          <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">Ressource assignée</label>
          <select
            value={assignee}
            onChange={e => setAssignee(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 h-9 text-[13px] mb-3"
          >
            <option value="">— Aucune —</option>
            <optgroup label="Collaborateurs">
              {resources.filter(r => r.type === 'profile' && r.id !== UNASSIGNED_RESOURCE_ID).map(r => (
                <option key={r.id} value={`profile:${r.id}`}>{r.full_name}</option>
              ))}
            </optgroup>
            <optgroup label="Équipes">
              {resources.filter(r => r.type === 'team').map(r => (
                <option key={r.id} value={`team:${r.id}`}>{r.full_name}</option>
              ))}
            </optgroup>
          </select>

          <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">
            Véhicules liés {vehicleIds.length > 0 && `(${vehicleIds.length})`}
          </label>
          <div className="border border-gray-200 rounded-lg max-h-[140px] overflow-y-auto mb-3">
            {vehicles.length === 0 && (
              <p className="text-[12px] text-gray-400 px-3 py-2">Chargement…</p>
            )}
            {vehicles.map(v => {
              const checked = vehicleIds.includes(v.id)
              return (
                <label
                  key={v.id}
                  className="flex items-center gap-2 px-3 py-2 border-b border-gray-50 last:border-0 text-[13px]"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={locked}
                    onChange={() => setVehicleIds(ids =>
                      checked ? ids.filter(id => id !== v.id) : [...ids, v.id]
                    )}
                    className="w-4 h-4 accent-[#111111] flex-shrink-0 disabled:opacity-40"
                  />
                  <span>
                    {v.brand} {v.model}
                    <span className="text-gray-400 font-mono"> · {v.plate}</span>
                  </span>
                </label>
              )
            })}
          </div>

          <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">Client lié</label>
          <select
            value={clientId}
            onChange={e => setClientId(e.target.value)}
            disabled={locked}
            className="w-full border border-gray-200 rounded-lg px-3 h-9 text-[13px] mb-3 disabled:bg-gray-50 disabled:text-gray-400"
          >
            <option value="">— Aucun —</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
            ))}
          </select>

          <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px]"
          />

          {error && <p className="text-[12px] text-red-500 mt-2">{error}</p>}
        </div>

        {/* Footer collé en bas — toujours visible sans scroll */}
        <div
          className="shrink-0 px-4 pt-3 pb-4 border-t border-gray-100 flex flex-col gap-2 bg-white"
          style={{ paddingBottom: 'calc(76px + env(safe-area-inset-bottom))' }}
        >
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full h-10 rounded-xl bg-[#111111] text-white text-[13px] font-medium disabled:opacity-50"
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>

          {isEdit && !locked && (
            confirmingDelete ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={saving}
                  className="flex-1 h-9 rounded-xl bg-red-500 text-white text-[12px] font-medium"
                >
                  Confirmer la suppression
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="flex-1 h-9 rounded-xl border border-gray-200 text-[12px] font-medium"
                >
                  Annuler
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="w-full h-9 rounded-xl border border-red-200 text-red-500 text-[12px] font-medium"
              >
                Supprimer l'événement
              </button>
            )
          )}
        </div>
      </div>
    </div>
  )
}
