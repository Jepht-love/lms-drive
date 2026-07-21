'use client'

// Zone de signature « à la borne d'agence » (demande gérant, ticket SAV 21/07) :
// un encadré cliquable — « Toucher pour signer » — qui ouvre le canevas au clic,
// puis affiche l'aperçu de la signature une fois apposée. Évite les signatures
// accidentelles pendant qu'on fait défiler le contrat.
import { useState } from 'react'
import { Check, PenLine } from 'lucide-react'
import SignatureCanvas from '@/components/signature/SignatureCanvas'

interface Props {
  label: string
  value: string | null
  onChange: (sig: string | null) => void
}

export default function ZoneSignature({ label, value, onChange }: Props) {
  const [open, setOpen] = useState(false)

  // Signée et refermée → aperçu vert + possibilité de refaire
  if (value && !open) {
    return (
      <div className="rounded-xl border-2 border-green-200 bg-green-50/60 p-3">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs font-bold text-green-700 flex items-center gap-1.5 uppercase tracking-wide">
            <Check className="w-3.5 h-3.5" /> {label} — signé
          </p>
          <button
            type="button"
            onClick={() => { onChange(null); setOpen(true) }}
            className="text-xs font-semibold text-gray-400 hover:text-gray-600 underline underline-offset-2"
          >
            Refaire
          </button>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={value} alt={label} className="h-16 mx-auto" />
      </div>
    )
  }

  // Fermée, pas encore signée → on clique pour signer, tout simplement
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border-2 border-dashed border-blue-300 bg-blue-50/50 hover:bg-blue-50 py-7 flex flex-col items-center gap-2 transition-colors active:scale-[.99]"
      >
        <PenLine className="w-6 h-6 text-blue-500" />
        <span className="text-sm font-bold text-blue-600">{label}</span>
        <span className="text-xs text-blue-400">Toucher pour signer</span>
      </button>
    )
  }

  // Ouverte → canevas de signature + validation
  return (
    <div className="rounded-xl border-2 border-blue-200 bg-white p-3 space-y-3">
      <SignatureCanvas
        label={label}
        existingSig={value}
        onSign={onChange}
        onClear={() => onChange(null)}
        height={160}
      />
      <button
        type="button"
        onClick={() => setOpen(false)}
        disabled={!value}
        className="w-full py-2.5 rounded-lg bg-blue-600 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-bold hover:bg-blue-700 transition-colors"
      >
        Valider la signature
      </button>
    </div>
  )
}
