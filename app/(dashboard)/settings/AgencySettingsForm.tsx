'use client'

import { useState, useTransition } from 'react'
import { updateAgencySettings } from '@/lib/actions/agency'
import type { AgencySettings } from '@/lib/contracts/agency'

export default function AgencySettingsForm({ settings }: { settings: AgencySettings }) {
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMsg(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await updateAgencySettings(fd)
      if (res?.error) setMsg({ ok: false, text: res.error })
      else setMsg({ ok: true, text: 'Enregistré ✓' })
    })
  }

  const input = 'w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 focus:outline-none focus:border-gray-400 transition-colors'
  const label = 'block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5'

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* Identité */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className={label} htmlFor="company_name">Raison sociale</label>
          <input id="company_name" name="company_name" defaultValue={settings.company_name} className={input} />
        </div>
        <div>
          <label className={label} htmlFor="siret">SIRET</label>
          <input id="siret" name="siret" defaultValue={settings.siret ?? ''} className={input} />
        </div>
        <div>
          <label className={label} htmlFor="phone">Téléphone</label>
          <input id="phone" name="phone" defaultValue={settings.phone ?? ''} className={input} />
        </div>
        <div className="sm:col-span-2">
          <label className={label} htmlFor="address">Adresse</label>
          <input id="address" name="address" defaultValue={settings.address ?? ''} className={input} />
        </div>
        <div className="sm:col-span-2">
          <label className={label} htmlFor="email">Email</label>
          <input id="email" name="email" type="email" defaultValue={settings.email ?? ''} className={input} />
        </div>
      </div>

      {/* Tarifs par défaut */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-3">Tarifs par défaut</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label className={label} htmlFor="extra_km_rate">Km sup. (€/km)</label>
            <input id="extra_km_rate" name="extra_km_rate" type="number" step="0.01" defaultValue={settings.extra_km_rate} className={input} />
          </div>
          <div>
            <label className={label} htmlFor="late_hourly_rate">Retard (€/h)</label>
            <input id="late_hourly_rate" name="late_hourly_rate" type="number" step="0.5" defaultValue={settings.late_hourly_rate} className={input} />
          </div>
          <div>
            <label className={label} htmlFor="late_daily_rate">Retard (€/jour)</label>
            <input id="late_daily_rate" name="late_daily_rate" type="number" step="1" defaultValue={settings.late_daily_rate} className={input} />
          </div>
          <div>
            <label className={label} htmlFor="fuel_rate_per_liter">Carburant (€/L)</label>
            <input id="fuel_rate_per_liter" name="fuel_rate_per_liter" type="number" step="0.01" defaultValue={settings.fuel_rate_per_liter} className={input} />
          </div>
          <div>
            <label className={label} htmlFor="default_deposit">Caution (€)</label>
            <input id="default_deposit" name="default_deposit" type="number" step="1" defaultValue={settings.default_deposit} className={input} />
          </div>
          <div>
            <label className={label} htmlFor="insurance_deductible">Franchise (€)</label>
            <input id="insurance_deductible" name="insurance_deductible" type="number" step="1" defaultValue={settings.insurance_deductible} className={input} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="px-5 py-2.5 bg-[#111111] text-white rounded-xl font-semibold text-sm hover:bg-gray-800 transition-colors disabled:opacity-40 active:scale-[.97]"
        >
          {pending ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        {msg && (
          <span className={`text-sm font-medium ${msg.ok ? 'text-green-600' : 'text-red-600'}`}>{msg.text}</span>
        )}
      </div>
    </form>
  )
}
