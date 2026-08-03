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

  const input = 'w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/20 focus:border-gray-400 transition-colors'
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

      {/* Le bloc « Tarifs par défaut » a été retiré le 03/08/2026 (remarque 11).
          Ces six valeurs ne servent que de dernier recours à une voiture sans
          grille : les afficher ici, même en lecture, faisait croire au gérant
          qu'il consultait ses tarifs réels. Le renvoi vers les grilles a pris
          leur place, en haut de l'écran Paramètres.

          ⚠️ Elles restent en base et `updateAgencySettings` continue de les
          accepter : un champ absent du formulaire n'est plus écrasé. Ne pas
          rétablir une écriture systématique, elle les viderait. */}

      {/* Contrôle des corrections de montant · interrupteur d'agence, éteint par
          défaut. Chez un client où personne d'autre ne peut valider, l'allumer
          bloquerait toute correction : c'est pour ça que ce n'est pas le
          comportement par défaut (Jeff, 01/08/2026). */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-3">Contrôle des montants</p>
        <label className="flex items-start gap-3 cursor-pointer bg-white border border-gray-200 rounded-xl p-3">
          <input
            type="checkbox"
            name="require_amount_validation"
            defaultChecked={settings.require_amount_validation ?? false}
            className="mt-0.5 w-4 h-4 accent-gray-900 flex-shrink-0"
          />
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-gray-900">
              Faire valider les corrections de montant
            </span>
            <span className="block text-[11px] text-gray-400 mt-0.5">
              Au-delà de 20 % ou 20 € d&apos;écart, corriger le montant d&apos;une intervention
              attendra la réponse d&apos;un autre gérant ou associé. Personne ne valide sa propre
              correction. Sans cette option, la correction s&apos;applique aussitôt et reste tracée.
            </span>
          </span>
        </label>
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
