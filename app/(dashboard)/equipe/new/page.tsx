'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Send } from 'lucide-react'

const ROLES = [
  { value: 'gerant',      label: 'Gérant',      desc: 'Accès total' },
  { value: 'associe',     label: 'Associé',      desc: 'Accès large' },
  { value: 'employe',     label: 'Employé',      desc: 'Ses tâches uniquement' },
  { value: 'prestataire', label: 'Prestataire',  desc: 'Missions ponctuelles' },
]

const COLORS = [
  '#6366f1', '#3b82f6', '#06b6d4', '#10b981',
  '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6',
  '#111111', '#64748b',
]

export default function InviteTeamMemberPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    email: '', full_name: '', role: 'employe',
    phone: '', color: '#6366f1', hire_date: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.email || !form.full_name) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erreur inconnue'); return }
      router.push('/equipe')
    } catch {
      setError('Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/equipe" className="w-9 h-9 bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center justify-center">
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-xl font-black text-gray-900">Inviter un membre</h1>
          <p className="text-xs text-gray-400">Un email d'invitation sera envoyé</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Nom */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">Informations</p>

          <div>
            <label className="text-xs font-bold text-gray-500 block mb-1.5">Nom complet *</label>
            <input
              type="text" required value={form.full_name}
              onChange={e => set('full_name', e.target.value)}
              placeholder="Prénom Nom"
              className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-black/10 placeholder:text-gray-300"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 block mb-1.5">Email *</label>
            <input
              type="email" required value={form.email}
              onChange={e => set('email', e.target.value)}
              placeholder="email@exemple.com"
              className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-black/10 placeholder:text-gray-300"
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
            <label className="text-xs font-bold text-gray-500 block mb-1.5">Date d'embauche</label>
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
                  form.role === r.value
                    ? 'border-black bg-black text-white'
                    : 'border-gray-100 bg-gray-50 text-gray-700 hover:border-gray-200'
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
          <div className="flex items-center gap-3 mt-2">
            <div className="w-10 h-10 rounded-xl text-white font-black text-sm flex items-center justify-center"
              style={{ backgroundColor: form.color }}>
              {form.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'AB'}
            </div>
            <p className="text-xs text-gray-400">Aperçu de l'avatar</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
            <p className="text-xs font-bold text-red-600">{error}</p>
          </div>
        )}

        <button
          type="submit" disabled={loading || !form.email || !form.full_name}
          className="w-full bg-black text-white font-black text-sm py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Send className="w-4 h-4" />
          {loading ? 'Envoi en cours…' : 'ENVOYER L\'INVITATION'}
        </button>

      </form>
    </div>
  )
}
