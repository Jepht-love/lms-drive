'use client'

import { useRef, useState, useTransition } from 'react'
import { Camera, Upload, X, Check, Loader2 } from 'lucide-react'
import type { Client } from '@/types/database'

interface ClientFormProps {
  action: (formData: FormData) => Promise<{ error: string } | void>
  client?: Client
}

/** Comprime une image via canvas (max 1400px, JPEG 82%). Retourne un Blob. */
async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve) => {
    const img = document.createElement('img')
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const MAX = 1400
      let { width, height } = img
      if (width > MAX || height > MAX) {
        if (width >= height) { height = Math.round(height * MAX / width); width = MAX }
        else { width = Math.round(width * MAX / height); height = MAX }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
      canvas.toBlob(blob => resolve(blob ?? file), 'image/jpeg', 0.82)
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}

const DOC_TYPES = ['CNI', 'passeport', 'titre_sejour']
const PAYMENT_METHODS = ['especes', 'virement', 'cb', 'cheque']

function PhotoUpload({ label, name, existingUrl }: { label: string; name: string; existingUrl?: string | null }) {
  const [preview, setPreview] = useState<string | null>(existingUrl ?? null)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  return (
    <div>
      <div className="min-h-[2.5rem] flex items-end mb-1.5">
        <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">{label}</label>
      </div>
      <input ref={inputRef} type="file" name={name} accept="image/*" capture="environment" className="hidden" onChange={handleChange} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={`w-full h-28 rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-2 ${
          preview ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-gray-50 hover:border-gray-300'
        }`}
      >
        {preview ? (
          <div className="relative w-full h-full rounded-xl overflow-hidden">
            <img src={preview} alt={label} className="w-full h-full object-cover rounded-xl" />
            <div className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
              <Check className="w-3.5 h-3.5 text-white" />
            </div>
          </div>
        ) : (
          <>
            <Camera className="w-6 h-6 text-gray-300" />
            <span className="text-xs text-gray-400 text-center px-2">Appuyer pour prendre une photo ou importer</span>
          </>
        )}
      </button>
      {preview && (
        <button type="button" onClick={() => { setPreview(null); if (inputRef.current) inputRef.current.value = '' }}
          className="mt-1 text-xs text-red-400 hover:text-red-600 flex items-center gap-1">
          <X className="w-3 h-3" /> Supprimer
        </button>
      )}
    </div>
  )
}

const PHOTO_SLOTS = ['id_doc_front', 'id_doc_back', 'license_front', 'license_back', 'proof_of_address'] as const

export default function ClientForm({ action, client: c }: ClientFormProps) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const raw = new FormData(e.currentTarget)

    // Compression côté client avant envoi (évite la limite 1 Mo / 4.5 Mo Vercel)
    const compressed = new FormData()
    for (const [key, value] of raw.entries()) {
      if (value instanceof File && value.size > 0 && PHOTO_SLOTS.includes(key as any)) {
        const blob = await compressImage(value)
        compressed.append(key, new File([blob], value.name, { type: 'image/jpeg' }))
      } else {
        compressed.append(key, value)
      }
    }

    startTransition(async () => {
      try {
        const result = await action(compressed)
        if (result?.error) setError(result.error)
      } catch (err: any) {
        // redirect() lève une erreur spéciale Next.js — la laisser se propager
        if (err?.digest?.startsWith?.('NEXT_REDIRECT') || err?.message === 'NEXT_REDIRECT') throw err
        setError("Une erreur est survenue lors de l'enregistrement.")
      }
    })
  }

  const pending = isPending

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>
      )}

      {/* Identité */}
      <Section title="Identité">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="Prénom *" name="first_name" defaultValue={c?.first_name} required />
          <Field label="Nom *" name="last_name" defaultValue={c?.last_name} required />
          <Field label="Téléphone *" name="phone" type="tel" defaultValue={c?.phone} required placeholder="+33 6 12 34 56 78" />
          <Field label="Email" name="email" type="email" defaultValue={c?.email ?? ''} />
          <Field label="Date de naissance" name="birth_date" type="date" defaultValue={c?.birth_date ?? ''} />
        </div>
      </Section>

      {/* Adresse */}
      <Section title="Adresse">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <Field label="Adresse" name="address" defaultValue={c?.address ?? ''} />
          </div>
          <Field label="Code postal" name="postal_code" defaultValue={c?.postal_code ?? ''} />
          <Field label="Ville" name="city" defaultValue={c?.city ?? ''} />
        </div>
      </Section>

      {/* Documents + Photos */}
      <Section title="Documents & Pièces justificatives">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
          <SelectField
            label="Type de pièce d'identité"
            name="id_doc_type"
            defaultValue={c?.id_doc_type ?? ''}
            options={DOC_TYPES}
            labels={{ 'CNI': "Carte nationale d'identité", 'passeport': 'Passeport', 'titre_sejour': 'Titre de séjour' }}
          />
          <Field label="N° pièce d'identité" name="id_doc_number" defaultValue={c?.id_doc_number ?? ''} />
          <Field label="N° permis de conduire" name="license_number" defaultValue={c?.license_number ?? ''} />
          <Field label="Expiration du permis" name="license_expiry" type="date" defaultValue={c?.license_expiry ?? ''} />
        </div>

        {/* Upload photos */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <PhotoUpload label="CNI / Pièce d'identité (recto)" name="id_doc_front" existingUrl={c?.id_doc_front_path} />
          <PhotoUpload label="CNI / Pièce d'identité (verso)" name="id_doc_back" existingUrl={c?.id_doc_back_path} />
          <PhotoUpload label="Permis de conduire (recto)" name="license_front" existingUrl={c?.license_front_path} />
          <PhotoUpload label="Permis de conduire (verso)" name="license_back" existingUrl={c?.license_back_path} />
          <PhotoUpload label="Justificatif de domicile" name="proof_of_address" existingUrl={c?.proof_of_address_path} />
        </div>
        <p className="text-xs text-gray-400 mt-2 flex items-center gap-1.5">
          <Upload className="w-3 h-3" />
          Les documents sont stockés de façon sécurisée et accessibles uniquement aux membres autorisés.
        </p>
      </Section>

      {/* Préférences */}
      <Section title="Préférences & notes">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <SelectField
            label="Mode de paiement habituel"
            name="usual_payment_method"
            defaultValue={c?.usual_payment_method ?? ''}
            options={PAYMENT_METHODS}
            labels={{ especes: 'Espèces', virement: 'Virement', cb: 'Carte bancaire', cheque: 'Chèque' }}
          />
          <Field label="Caution habituelle (€)" name="usual_deposit" type="number" defaultValue={c?.usual_deposit?.toString() ?? ''} step="0.01" />
          <Field label="Remise fidélité (%)" name="discount_percent" type="number" defaultValue={c?.discount_percent?.toString() ?? ''} step="1" placeholder="0" />
          <Field label="Canal d'acquisition" name="acquisition_channel" defaultValue={c?.acquisition_channel ?? ''} placeholder="Bouche à oreille, Internet…" />
        </div>
        <div className="mt-4">
          <label className="block text-xs font-medium text-gray-600 mb-1.5 uppercase tracking-wide">Notes internes</label>
          <textarea
            name="internal_notes"
            defaultValue={c?.internal_notes ?? ''}
            rows={3}
            placeholder="Préférences, historique, remarques…"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm resize-none"
          />
        </div>
      </Section>

      <p className="text-[11px] text-gray-400">* Champ obligatoire</p>
      <button
        type="submit" disabled={pending}
        className="px-6 py-3 bg-[#111111] hover:bg-gray-800 disabled:opacity-40 text-white font-semibold rounded-xl transition-colors text-sm"
      >
        {pending ? (
        <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Enregistrement…</span>
      ) : (c ? 'Mettre à jour' : 'Créer le client')}
      </button>
    </form>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h3 className="font-semibold text-gray-800 mb-4 text-base">{title}</h3>
      {children}
    </div>
  )
}

function Field({ label, name, type = 'text', defaultValue = '', required = false, placeholder, step }: {
  label: string; name: string; type?: string; defaultValue?: string
  required?: boolean; placeholder?: string; step?: string
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-xs font-medium text-gray-600 mb-1.5 uppercase tracking-wide">{label}</label>
      <input
        id={name} name={name} type={type} defaultValue={defaultValue}
        required={required} placeholder={placeholder} step={step}
        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm"
      />
    </div>
  )
}

function SelectField({ label, name, defaultValue, options, labels }: {
  label: string; name: string; defaultValue?: string; options: string[]
  labels?: Record<string, string>
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-xs font-medium text-gray-600 mb-1.5 uppercase tracking-wide">{label}</label>
      <select
        id={name} name={name} defaultValue={defaultValue ?? ''}
        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm bg-white"
      >
        <option value="">— Choisir —</option>
        {options.map(o => <option key={o} value={o}>{labels?.[o] ?? o}</option>)}
      </select>
    </div>
  )
}
