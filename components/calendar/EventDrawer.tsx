'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import type { CalendarEvent, CalendarResource, EventStatus, EventType } from '@/types/calendar'
import { EVENT_TYPE_LABELS, EVENT_COLORS, EVENT_STATUS_LABELS, STATUS_COLORS, UNASSIGNED_RESOURCE_ID } from '@/lib/calendar/constants'

interface SlotContext {
  resource: CalendarResource
  date: Date
  hour: number
}

interface EventDrawerProps {
  open: boolean
  event: CalendarEvent | null
  slotContext: SlotContext | null
  resources: CalendarResource[]
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

export default function EventDrawer({ open, event, slotContext, resources, onClose, onSave, onDelete }: EventDrawerProps) {
  const isEdit = !!event

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
      setTitle('')
      setEventType('tache')
      setStatus('a_faire')
      setVehicleIds([])
      setClientId('')
      setNotes('')
      if (slotContext) {
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
  }, [open, event, slotContext])

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
        throw new Error(body.error ?? 'Erreur lors de l’enregistrement')
      }
      onSave()
      onClose()
    } catch (e: any) {
      setError(e.message ?? 'Erreur lors de l’enregistrement')
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
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Fermer" onClick={onClose} className="absolute inset-0 bg-black/30" />
      <div className="relative w-full max-w-[380px] bg-white h-full shadow-sm border-l border-gray-100 p-4 overflow-y-auto">
        <h2 className="text-[14px] font-semibold mb-4">{isEdit ? 'Modifier l’événement' : 'Nouvel événement'}</h2>

        <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">Titre</label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 h-9 text-[13px] mb-3"
          placeholder="Ex : RDV client signature contrat"
        />

        <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">Type d&apos;événement</label>
        <div className="flex items-center gap-2 mb-3">
          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: EVENT_COLORS[eventType] }} />
          <select
            value={eventType}
            onChange={e => setEventType(e.target.value as EventType)}
            className="flex-1 border border-gray-200 rounded-lg px-3 h-9 text-[13px]"
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

        <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">Début</label>
        <input
          type="datetime-local"
          value={startAt}
          onChange={e => setStartAt(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 h-9 text-[13px] mb-3"
        />

        <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">Fin</label>
        <input
          type="datetime-local"
          value={endAt}
          onChange={e => setEndAt(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 h-9 text-[13px] mb-3"
        />

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
        <div className="border border-gray-200 rounded-lg max-h-[160px] overflow-y-auto mb-3">
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
                  onChange={() => setVehicleIds(ids =>
                    checked ? ids.filter(id => id !== v.id) : [...ids, v.id]
                  )}
                  className="w-4 h-4 accent-[#111111] flex-shrink-0"
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
          className="w-full border border-gray-200 rounded-lg px-3 h-9 text-[13px] mb-3"
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
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] mb-4"
        />

        {error && <p className="text-[12px] text-red-500 mb-3">{error}</p>}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full h-10 rounded-lg bg-[#111111] text-white text-[13px] font-medium disabled:opacity-50 mb-2"
        >
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>

        {isEdit && (
          confirmingDelete ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="flex-1 h-9 rounded-lg bg-red-500 text-white text-[12px] font-medium"
              >
                Confirmer ?
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="flex-1 h-9 rounded-lg border border-gray-200 text-[12px] font-medium"
              >
                Annuler
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="w-full h-9 rounded-lg border border-red-200 text-red-500 text-[12px] font-medium"
            >
              Supprimer
            </button>
          )
        )}
      </div>
    </div>
  )
}
