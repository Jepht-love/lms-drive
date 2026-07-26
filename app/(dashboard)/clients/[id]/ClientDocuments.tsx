'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  FileText, Image as ImageIcon, UploadCloud, X, Loader2, Check, Trash2, Plus, Camera,
} from 'lucide-react'
import { uploadFileToSupabase } from '@/lib/upload'
import { bulkCreateClientDocuments, deleteClientDocument } from '@/lib/actions/documents'
import { DOCUMENT_SUBCATEGORIES, getSubcategoryLabel } from '@/lib/documents/categories'

export interface ClientDoc {
  id: string
  name: string
  subcategory: string
  url: string | null
  fileType: string | null
  side: 'recto' | 'verso' | null
  createdAt: string
}

type Side = 'recto' | 'verso' | ''

interface Staged {
  /** Identité de la ligne, stable tant qu'elle existe : sans elle, retirer un
   *  fichier de la file ferait glisser le type et la face choisis pour les suivants. */
  id: number
  file: File
  subcategory: string
  side: Side
}

const CLIENT_SUBCATS = DOCUMENT_SUBCATEGORIES.client
const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.heic,image/*,application/pdf'

function isImage(type: string | null) {
  return !!type && type.startsWith('image/')
}

export default function ClientDocuments({
  clientId,
  docs,
}: {
  clientId: string
  docs: ClientDoc[]
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const nextStagedId = useRef(0)
  const [staged, setStaged] = useState<Staged[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<ClientDoc | null>(null)

  function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return
    // Type par défaut « CNI », face non précisée — ajustables par fichier avant import.
    const next: Staged[] = Array.from(list).map(file => ({ id: nextStagedId.current++, file, subcategory: 'cni', side: '' }))
    setStaged(prev => [...prev, ...next])
    setError(null)
  }

  function updateType(i: number, subcategory: string) {
    setStaged(prev => prev.map((s, idx) => (idx === i ? { ...s, subcategory } : s)))
  }
  function updateSide(i: number, side: Side) {
    setStaged(prev => prev.map((s, idx) => (idx === i ? { ...s, side: s.side === side ? '' : side } : s)))
  }
  function removeStaged(i: number) {
    setStaged(prev => prev.filter((_, idx) => idx !== i))
  }

  async function handleImport() {
    if (staged.length === 0) return
    setError(null)
    setUploading(true)
    setProgress({ done: 0, total: staged.length })

    const uploaded: {
      name: string; subcategory: string; file_url: string; file_type: string; file_size: number; side: Side
    }[] = []
    const failed: string[] = []

    // `finally` : un rejet en cours d'upload laisserait sinon la barre de
    // progression figée et le bouton d'import définitivement désactivé.
    try {
      for (let i = 0; i < staged.length; i++) {
        const { file, subcategory, side } = staged[i]
        // Upload navigateur direct vers le bucket `documents` (contourne la limite
        // de payload Vercel) — on n'envoie ensuite que les chemins au serveur.
        const sent = await uploadFileToSupabase(file, `client/${subcategory}`, 'documents')
        if (sent) {
          uploaded.push({
            name: file.name,
            subcategory,
            // Poids et type de ce qui est RÉELLEMENT stocké : une photo est réduite
            // avant l'envoi, garder les valeurs du fichier choisi afficherait un
            // poids faux dans la liste des pièces.
            file_url: sent.path,
            file_type: sent.type,
            file_size: sent.size,
            side,
          })
        } else {
          failed.push(file.name)
        }
        setProgress({ done: i + 1, total: staged.length })
      }

      if (uploaded.length === 0) {
        setError('Le téléversement a échoué. Réessayez.')
        return
      }

      const res = await bulkCreateClientDocuments(clientId, uploaded)
      if (res?.error) {
        setError(res.error)
        return
      }

      setStaged([])
      if (failed.length > 0) {
        setError(`${failed.length} fichier(s) non téléversé(s) : ${failed.join(', ')}`)
      }
      router.refresh()
    } catch {
      setError('Le téléversement a échoué. Vérifiez votre connexion puis réessayez.')
    } finally {
      setUploading(false)
      setProgress(null)
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    const res = await deleteClientDocument(id, clientId)
    setDeletingId(null)
    if (res?.error) { setError(res.error); return }
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {/* ── Pièces du client : grille de vignettes (aperçu visible sur la fiche) ── */}
      {docs.length > 0 && (
        <div className="grid grid-cols-3 gap-2.5">
          {docs.map(d => (
            <div
              key={d.id}
              className="relative rounded-xl border border-gray-200 overflow-hidden bg-white"
            >
              {/* Aperçu (clic = agrandir) */}
              <button type="button"
                onClick={() => d.url && setLightbox(d)}
                className="block w-full aspect-square bg-gray-50"
                aria-label="Agrandir la pièce"
              >
                {isImage(d.fileType) && d.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.url} alt={d.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="w-full h-full flex items-center justify-center">
                    <FileText className="w-8 h-8 text-gray-300" />
                  </span>
                )}
                {/* Face (recto/verso) */}
                {d.side && (
                  <span className="absolute top-1.5 left-1.5 text-[9px] font-bold uppercase tracking-wide bg-black/70 text-white px-1.5 py-0.5 rounded">
                    {d.side}
                  </span>
                )}
              </button>

              {/* Supprimer */}
              <button type="button"
                onClick={() => handleDelete(d.id)}
                disabled={deletingId === d.id}
                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-md bg-white/85 border border-gray-200 flex items-center justify-center text-gray-400 hover:text-red-500 disabled:opacity-50"
                aria-label="Supprimer le document"
              >
                {deletingId === d.id
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : <Trash2 className="w-3 h-3" />}
              </button>

              {/* Type de pièce */}
              <p className="text-[10px] font-medium text-gray-500 truncate px-1.5 py-1">
                {getSubcategoryLabel('client', d.subcategory)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* ── Zone d'import : télécharger un fichier OU prendre une photo ── */}
      <div className="space-y-2">
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => {
            e.preventDefault()
            setDragOver(false)
            addFiles(e.dataTransfer.files)
          }}
          onClick={() => inputRef.current?.click()}
          className={`rounded-xl border-2 border-dashed px-4 py-6 text-center cursor-pointer transition-colors ${
            dragOver ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
          }`}
        >
          <UploadCloud className="w-6 h-6 text-gray-400 mx-auto mb-2" />
          <p className="text-sm font-semibold text-gray-700">
            Glissez vos documents ici ou cliquez pour choisir
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Plusieurs fichiers à la fois · PDF, images (JPG, PNG, HEIC…)
          </p>
        </div>

        {/* Prendre une photo directement (appareil photo sur mobile) */}
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-white border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors"
        >
          <Camera className="w-4 h-4 text-gray-500" />
          Prendre une photo
        </button>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={e => { addFiles(e.target.files); e.target.value = '' }}
        />
        {/* capture="environment" → ouvre l'appareil photo arrière sur mobile */}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={e => { addFiles(e.target.files); e.target.value = '' }}
        />
      </div>

      {/* ── Fichiers en attente d'import (type par fichier) ── */}
      {staged.length > 0 && (
        <div className="space-y-2">
          {staged.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white border border-gray-200">
              <div className="w-9 h-9 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
                {s.file.type.startsWith('image/')
                  ? <ImageIcon className="w-4 h-4 text-gray-400" />
                  : <FileText className="w-4 h-4 text-gray-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{s.file.name}</p>
                <select
                  aria-label="Type de pièce"
                  value={s.subcategory}
                  onChange={e => updateType(i, e.target.value)}
                  className="mt-1 w-full text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-gray-400"
                >
                  {CLIENT_SUBCATS.map(sc => (
                    <option key={sc.id} value={sc.id}>{sc.label}</option>
                  ))}
                </select>
                {/* Face de la pièce (facultatif) */}
                <div className="mt-1 flex gap-1">
                  {(['recto', 'verso'] as const).map(f => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => updateSide(i, f)}
                      className={`flex-1 text-[11px] font-semibold py-1 rounded-lg border transition-colors ${
                        s.side === f
                          ? 'bg-[#111111] text-white border-[#111111]'
                          : 'bg-gray-50 text-gray-500 border-gray-200'
                      }`}
                    >
                      {f === 'recto' ? 'Recto' : 'Verso'}
                    </button>
                  ))}
                </div>
              </div>
              <button type="button"
                onClick={() => removeStaged(i)}
                className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0 self-start"
                aria-label="Retirer ce fichier"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}

          <button type="button"
            onClick={handleImport}
            disabled={uploading}
            className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-[#111111] text-white text-sm font-bold hover:bg-black transition-colors disabled:opacity-60"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {progress ? `Téléversement ${progress.done}/${progress.total}…` : 'Import…'}
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Importer {staged.length} document{staged.length > 1 ? 's' : ''}
              </>
            )}
          </button>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{error}</p>
      )}

      {docs.length === 0 && staged.length === 0 && !error && (
        <p className="text-[11px] text-gray-400 flex items-center gap-1.5">
          <Check className="w-3 h-3" /> Idéal pour importer d&apos;un coup un lot de pièces (permis, CNI, justificatifs…).
        </p>
      )}

      {/* Lightbox : pièce agrandie */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex flex-col p-4"
          onClick={() => setLightbox(null)}
        >
          <button type="button"
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/15 flex items-center justify-center text-white z-10"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex-1 min-h-0 flex items-center justify-center">
            {isImage(lightbox.fileType) && lightbox.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={lightbox.url}
                alt={lightbox.name}
                onClick={e => e.stopPropagation()}
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            ) : lightbox.url ? (
              <div className="bg-white rounded-2xl p-6 text-center" onClick={e => e.stopPropagation()}>
                <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm font-semibold text-gray-700 mb-3">{lightbox.name}</p>
                <a
                  href={lightbox.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#111111] text-white text-sm font-semibold"
                >
                  Ouvrir le document
                </a>
              </div>
            ) : null}
          </div>
          <p className="text-center text-white/70 text-[12px] mt-2">
            {getSubcategoryLabel('client', lightbox.subcategory)}
          </p>
        </div>
      )}
    </div>
  )
}
