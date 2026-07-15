'use client'

import { useState, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { HelpCircle, X, Camera, Loader2 } from 'lucide-react'
import { useToast } from '@/components/Toast'
import { useSavContext } from '@/lib/sav/context'
import { moduleFromPath, sectionFromPath } from '@/lib/sav/modules'

export default function SavButton() {
  const pathname = usePathname()
  const { section } = useSavContext()
  const { show: toast } = useToast()

  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [contextLabel, setContextLabel] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const moduleName = moduleFromPath(pathname)
  // Sous-vue : celle déclarée par la page (useSavSection) sinon déduite de l'URL.
  const autoSection = section ?? sectionFromPath(pathname)
  // Contexte pré-rempli : module + sous-vue.
  const autoContext = [moduleName, autoSection].filter(Boolean).join(' › ')

  function openForm() {
    setContextLabel(autoContext)
    setDescription('')
    setFile(null)
    setOpen(true)
  }

  async function submit() {
    if (!description.trim()) {
      toast('Décris le problème avant d\'envoyer', 'error')
      return
    }
    setSubmitting(true)
    try {
      const form = new FormData()
      form.append('description', description.trim())
      form.append('module', moduleName)
      // La sous-vue = ce que l'utilisateur voit dans le champ contexte, moins le module.
      const section = contextLabel.replace(moduleName, '').replace(/^\s*›\s*/, '').trim()
      form.append('section', section)
      form.append('page_path', pathname)
      form.append('user_agent', navigator.userAgent)
      if (file) form.append('screenshot', file)

      const res = await fetch('/api/sav', { method: 'POST', body: form })
      if (!res.ok) throw new Error('échec')
      toast('Merci ! Ton signalement a bien été envoyé ✅', 'success')
      setOpen(false)
    } catch {
      toast('Envoi impossible, réessaie', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {/* Bouton flottant — présent sur toutes les pages */}
      <button
        onClick={openForm}
        aria-label="Signaler un bug"
        className="fixed z-40 right-3 w-9 h-9 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform opacity-90 hover:opacity-100"
        style={{
          // Toujours au-dessus de la barre de navigation basse (60px + zone sécurisée),
          // avec une marge confortable, sur tous les formats (mobile, iPad, desktop).
          bottom: 'calc(84px + env(safe-area-inset-bottom))',
          background: 'linear-gradient(135deg, #C4A35A, #D4B870)',
        }}
      >
        <HelpCircle className="w-[18px] h-[18px] text-[#0A0A0A]" strokeWidth={2.2} />
      </button>

      {/* Modal formulaire */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !submitting && setOpen(false)} />
          <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* En-tête */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div>
                <h2 className="text-lg font-black text-[#111111]">Signaler un problème</h2>
                <p className="text-xs text-gray-400 mt-0.5">Décris le bug, joins une capture si possible</p>
              </div>
              <button onClick={() => !submitting && setOpen(false)} className="p-2 text-gray-400 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>

            <div className="px-5 pb-5 space-y-4">
              {/* Contexte pré-rempli, modifiable */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-gray-400 mb-1.5">Où es-tu ?</label>
                <input
                  value={contextLabel}
                  onChange={e => setContextLabel(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-[#111111] bg-gray-50 focus:bg-white focus:border-[#C4A35A] focus:outline-none"
                  placeholder="Module / vue concernée"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-gray-400 mb-1.5">Décris le bug</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={4}
                  autoFocus
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-[#111111] resize-none focus:border-[#C4A35A] focus:outline-none"
                  placeholder="Ex. : le bouton « Valider » ne fait rien quand je clique dessus…"
                />
              </div>

              {/* Capture d'écran */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-gray-400 mb-1.5">Capture / photo (optionnel)</label>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => setFile(e.target.files?.[0] ?? null)}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-dashed border-gray-300 text-sm text-gray-500 hover:border-[#C4A35A] hover:text-[#111111] transition-colors"
                >
                  <Camera size={18} />
                  <span className="truncate">{file ? file.name : 'Joindre une capture d\'écran'}</span>
                </button>
              </div>

              {/* Envoyer */}
              <button
                onClick={submit}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-[#0A0A0A] disabled:opacity-60 active:scale-[.99] transition-transform"
                style={{ background: 'linear-gradient(135deg, #C4A35A, #D4B870)' }}
              >
                {submitting ? <><Loader2 size={18} className="animate-spin" /> Envoi…</> : 'Envoyer le signalement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
