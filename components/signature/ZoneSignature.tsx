'use client'

// Zone de signature « à la borne d'agence » (demande gérant, tickets SAV 21/07) :
// un encadré cliquable — « Toucher pour signer » — qui n'ouvre PAS le canevas dans
// le flux de la page (source d'interférences avec le texte et de défilement
// parasite au tracé), mais dans une BULLE plein écran verrouillée, calquée sur le
// modal SAV « ? ». Fond figé (scroll du body bloqué) le temps de la signature :
// on signe au calme, on valide, la bulle se ferme et l'aperçu vert s'affiche.
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Check, PenLine, X } from 'lucide-react'
import SignatureCanvas from '@/components/signature/SignatureCanvas'

interface Props {
  label: string
  value: string | null
  onChange: (sig: string | null) => void
}

export default function ZoneSignature({ label, value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  // Brouillon local : le tracé n'est validé (remonté via onChange) qu'au clic
  // « Valider ». Fermer/Annuler jette le brouillon sans toucher à la valeur.
  const [draft, setDraft] = useState<string | null>(value)

  function openModal() {
    setDraft(value)
    setOpen(true)
  }

  // Verrouille le défilement du fond tant que la bulle est ouverte.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  return (
    <>
      {/* État dans le flux de la page : signé → aperçu vert, sinon → invite */}
      {value ? (
        <div className="rounded-xl border-2 border-green-200 bg-green-50/60 p-3">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-bold text-green-700 flex items-center gap-1.5 uppercase tracking-wide">
              <Check className="w-3.5 h-3.5" /> {label} — signé
            </p>
            <button
              type="button"
              onClick={openModal}
              className="text-xs font-semibold text-gray-400 hover:text-gray-600 underline underline-offset-2"
            >
              Refaire
            </button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt={label} className="h-16 mx-auto" />
        </div>
      ) : (
        <button
          type="button"
          onClick={openModal}
          className="w-full rounded-xl border-2 border-dashed border-blue-300 bg-blue-50/50 hover:bg-blue-50 py-7 flex flex-col items-center gap-2 transition-colors active:scale-[.99]"
        >
          <PenLine className="w-6 h-6 text-blue-500" />
          <span className="text-sm font-bold text-blue-600">{label}</span>
          <span className="text-xs text-blue-400">Toucher pour signer</span>
        </button>
      )}

      {/* Bulle de signature — overlay plein écran, fond verrouillé, zéro
          interférence avec le texte de la page (portail vers <body> pour ne pas
          être piégée par un conteneur en overflow/transform). */}
      {open && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl">
            {/* En-tête */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div>
                <h2 className="text-lg font-black text-[#111111]">{label}</h2>
                <p className="text-xs text-gray-400 mt-0.5">Signez dans le cadre ci-dessous</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer"
                className="p-2 text-gray-400 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>

            {/* Canevas + actions */}
            <div className="px-5 pb-5 space-y-4">
              <SignatureCanvas
                label=""
                existingSig={draft}
                onSign={setDraft}
                onClear={() => setDraft(null)}
                height={220}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 text-sm font-bold hover:bg-gray-200 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => { onChange(draft); setOpen(false) }}
                  disabled={!draft}
                  className="flex-[2] py-3 rounded-xl bg-blue-600 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-bold hover:bg-blue-700 transition-colors"
                >
                  Valider la signature
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
