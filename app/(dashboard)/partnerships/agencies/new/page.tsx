'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import BackButton from '@/components/ui/BackButton'
import { createAgency } from '@/lib/actions/partnerships'

export default function NewAgencyPage() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await createAgency(fd)
      if (res?.error) setError(res.error)
      else router.push('/partnerships/agencies')
    })
  }

  const input = 'w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 focus:outline-none focus:border-gray-400 transition-colors'
  const label = 'block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5'

  return (
    <div className="space-y-4 pb-4">
      <BackButton fallbackHref="/partnerships/agencies" className="inline-flex items-center gap-1.5 text-sm text-gray-400 font-medium hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" /> Retour
      </BackButton>
      <h1 className="text-xl font-black text-gray-900">Nouvelle agence partenaire</h1>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
          <div>
            <label className={label} htmlFor="name">Nom de l'agence</label>
            <input id="name" name="name" type="text" required className={input} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="contact_name">Contact</label>
              <input id="contact_name" name="contact_name" type="text" className={input} />
            </div>
            <div>
              <label className={label} htmlFor="phone">Téléphone</label>
              <input id="phone" name="phone" type="tel" className={input} />
            </div>
            <div>
              <label className={label} htmlFor="email">Email</label>
              <input id="email" name="email" type="email" className={input} />
            </div>
            <div>
              <label className={label} htmlFor="siret">SIRET</label>
              <input id="siret" name="siret" type="text" className={input} />
            </div>
          </div>
          <div>
            <label className={label} htmlFor="address">Adresse</label>
            <input id="address" name="address" type="text" className={input} />
          </div>
          <div>
            <label className={label} htmlFor="notes">Notes</label>
            <textarea id="notes" name="notes" rows={2} className={`${input} resize-none`} />
          </div>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>}

        <button type="submit" disabled={pending}
          className="w-full py-3.5 bg-[#111111] text-white rounded-2xl font-bold text-sm hover:bg-gray-800 transition-colors active:scale-[.99] disabled:opacity-40">
          {pending ? 'Enregistrement…' : 'Enregistrer l\'agence'}
        </button>
      </form>
    </div>
  )
}
