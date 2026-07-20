'use client'

import { useState, useRef, useMemo, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { HelpCircle, X, Camera, Loader2, Plus } from 'lucide-react'
import { useToast } from '@/components/Toast'
import { useSavContext } from '@/lib/sav/context'
import { moduleFromPath, sectionFromPath } from '@/lib/sav/modules'

// Compresse/redimensionne la capture dans le navigateur avant l'envoi pour
// accélérer l'upload (réseau mobile) et l'envoi Telegram. Repli sur le fichier
// original en cas d'échec.
async function compressImage(file: File, maxDim = 1600, quality = 0.7): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file)
    let { width, height } = bitmap
    if (width > maxDim || height > maxDim) {
      const scale = Math.min(maxDim / width, maxDim / height)
      width = Math.round(width * scale)
      height = Math.round(height * scale)
    }
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, width, height)
    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', quality))
    return blob && blob.size < file.size ? blob : file
  } catch {
    return file
  }
}

const MAX_PHOTOS = 10

export default function SavButton() {
  const pathname = usePathname()
  const { section } = useSavContext()
  const { show: toast } = useToast()

  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [contextLabel, setContextLabel] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Aperçus (object URLs) recalculés à chaque changement de la liste ; les URLs
  // précédentes sont révoquées au nettoyage pour éviter les fuites mémoire.
  const previews = useMemo(
    () => files.map(f => ({ name: f.name, url: URL.createObjectURL(f) })),
    [files],
  )
  useEffect(() => () => previews.forEach(p => URL.revokeObjectURL(p.url)), [previews])

  function addFiles(list: FileList | null) {
    if (!list) return
    const incoming = Array.from(list).filter(f => f.type.startsWith('image/'))
    setFiles(prev => {
      const next = [...prev, ...incoming]
      if (next.length > MAX_PHOTOS) toast(`Maximum ${MAX_PHOTOS} photos`, 'error')
      return next.slice(0, MAX_PHOTOS)
    })
    if (fileRef.current) fileRef.current.value = '' // permet de re-sélectionner le même fichier
  }

  function removeFile(idx: number) {
    setFiles(prev => prev.filter((_, i) => i !== idx))
  }

  const moduleName = moduleFromPath(pathname)
  // Sous-vue : celle déclarée par la page (useSavSection) sinon déduite de l'URL.
  const autoSection = section ?? sectionFromPath(pathname)
  // Contexte pré-rempli : module + sous-vue.
  const autoContext = [moduleName, autoSection].filter(Boolean).join(' › ')

  function openForm() {
    setContextLabel(autoContext)
    setDescription('')
    setFiles([])
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
      // Chaque photo est compressée puis ajoutée sous la même clé `screenshot`.
      for (let i = 0; i < files.length; i++) {
        const compressed = await compressImage(files[i])
        form.append('screenshot', compressed, files[i].name || `capture-${i + 1}.jpg`)
      }

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
        className="fixed z-40 left-3 w-9 h-9 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform opacity-90 hover:opacity-100"
        style={{
          // En bas à GAUCHE : les boutons d'action des pages (recherche, création…)
          // sont alignés à droite, donc ce coin reste libre et évite tout chevauchement.
          // Toujours au-dessus de la barre de navigation basse (60px + zone sécurisée).
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
                <p className="text-xs text-gray-400 mt-0.5">Décris le bug, joins une ou plusieurs photos si possible</p>
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

              {/* Captures / photos (plusieurs possibles) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-gray-400 mb-1.5">
                  Photos (optionnel){files.length > 0 ? ` · ${files.length}/${MAX_PHOTOS}` : ''}
                </label>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={e => addFiles(e.target.files)}
                />

                {files.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-dashed border-gray-300 text-sm text-gray-500 hover:border-[#C4A35A] hover:text-[#111111] transition-colors"
                  >
                    <Camera size={18} />
                    <span className="truncate">Joindre une ou plusieurs photos</span>
                  </button>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {previews.map((p, idx) => (
                      <div key={p.url} className="relative aspect-square rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.url} alt={`Capture ${idx + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeFile(idx)}
                          aria-label={`Retirer la photo ${idx + 1}`}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center active:scale-90"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                    {files.length < MAX_PHOTOS && (
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        aria-label="Ajouter des photos"
                        className="aspect-square rounded-xl border border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-[#C4A35A] hover:text-[#111111] transition-colors"
                      >
                        <Plus size={20} />
                      </button>
                    )}
                  </div>
                )}
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
