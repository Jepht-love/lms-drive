'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2 } from 'lucide-react'
import Toggle from '@/components/ui/Toggle'

const ROLES = [
  { value: 'gerant',      label: 'Gérant',      desc: 'Accès total' },
  { value: 'associe',     label: 'Associé',     desc: 'Accès large' },
  { value: 'employe',     label: 'Employé',     desc: 'Onglets attribués' },
  { value: 'prestataire', label: 'Prestataire', desc: 'Missions ponctuelles' },
]

const COLORS = [
  '#6366f1', '#3b82f6', '#06b6d4', '#10b981',
  '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6',
  '#111111', '#64748b',
]

interface Member {
  id: string
  full_name: string
  role: string
  phone: string | null
  color: string | null
  hire_date: string | null
  is_active: boolean
}

export default function EditMemberForm({ member }: { member: Member }) {
  const router = useRouter()
  const [form, setForm] = useState({
    full_name: member.full_name ?? '',
    role: member.role ?? 'employe',
    phone: member.phone ?? '',
    color: member.color ?? '#6366f1',
    hire_date: member.hire_date ? member.hire_date.slice(0, 10) : '',
    is_active: member.is_active,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function set<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.full_name) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/team/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: form.full_name,
          role: form.role,
          phone: form.phone || null,
          color: form.color,
          hire_date: form.hire_date || null,
          is_active: form.is_active,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data?.error) { setError(data?.error ?? 'Erreur'); return }
      router.push(`/equipe/${member.id}`)
      router.refresh()
    } catch {
      setError('Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Informations */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">Informations</p>

        <div>
          <label className="text-xs font-bold text-gray-500 block mb-1.5">Nom complet *</label>
          <input
            type="text" required value={form.full_name}
            onChange={e => set('full_name', e.target.value)}
            className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-black/10"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 block mb-1.5">Téléphone</label>
          <input
            type="tel" value={form.phone}
            onChange={e => set('phone', e.target.value)}
            placeholder="+33 6 00 00 00 00"
            className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-black/10 placeholder:text-gray-300"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 block mb-1.5">Date d&apos;embauche</label>
          <input
            type="date" value={form.hire_date}
            onChange={e => set('hire_date', e.target.value)}
            className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-black/10"
          />
        </div>
      </div>

      {/* Rôle */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">Rôle</p>
        <div className="space-y-2">
          {ROLES.map(r => (
            <button
              key={r.value} type="button"
              onClick={() => set('role', r.value)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all text-left ${
                form.role === r.value ? 'border-black bg-black text-white' : 'border-gray-100 bg-gray-50 text-gray-700 hover:border-gray-200'
              }`}
            >
              <div>
                <p className="text-sm font-bold">{r.label}</p>
                <p className={`text-xs mt-0.5 ${form.role === r.value ? 'text-gray-300' : 'text-gray-400'}`}>{r.desc}</p>
              </div>
              {form.role === r.value && (
                <div className="w-4 h-4 bg-white rounded-full flex items-center justify-center flex-shrink-0">
                  <div className="w-2 h-2 bg-black rounded-full" />
                </div>
              )}
            </button>
          ))}
        </div>
        {(form.role === 'employe' || form.role === 'prestataire') && (
          <p className="text-xs text-gray-400">Les onglets accessibles se règlent sur la fiche du membre.</p>
        )}
      </div>

      {/* Couleur */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">Couleur calendrier</p>
        <div className="flex flex-wrap gap-3">
          {COLORS.map(c => (
            <button
              key={c} type="button"
              onClick={() => set('color', c)}
              className={`w-9 h-9 rounded-xl transition-transform ${form.color === c ? 'scale-110 ring-2 ring-offset-2 ring-black' : ''}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      {/* Statut */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-gray-900">Compte actif</p>
          <p className="text-xs text-gray-400">Un compte inactif ne peut plus se connecter.</p>
        </div>
        <Toggle checked={form.is_active} onChange={(v) => set('is_active', v)} />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
          <p className="text-xs font-bold text-red-600">{error}</p>
        </div>
      )}

      <button
        type="submit" disabled={loading || !form.full_name}
        className="w-full bg-black text-white font-black text-sm py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-40"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
        {loading ? 'Enregistrement…' : 'ENREGISTRER'}
      </button>
    </form>
  )
}
