'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  FileText, Image as ImageIcon, UploadCloud, X, Loader2, Check, Trash2, Plus,
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
  createdAt: string
}

interface Staged {
  file: File
  subcategory: string
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
  const [staged, setStaged] = useState<Staged[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return
    // Type par défaut « Autres » — le gérant précise le type de chaque pièce avant import.
    const next = Array.from(list).map(file => ({ file, subcategory: 'autres' }))
    setStaged(prev => [...prev, ...next])
    setError(null)
  }

  function updateType(i: number, subcategory: string) {
    setStaged(prev => prev.map((s, idx) => (idx === i ? { ...s, subcategory } : s)))
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
      name: string; subcategory: string; file_url: string; file_type: string; file_size: number
    }[] = []
    const failed: string[] = []

    for (let i = 0; i < staged.length; i++) {
      const { file, subcategory } = staged[i]
      // Upload navigateur direct vers le bucket `documents` (contourne la limite
      // de payload Vercel) — on n'envoie ensuite que les chemins au serveur.
      const path = await uploadFileToSupabase(file, `client/${subcategory}`, 'documents')
      if (path) {
        uploaded.push({
          name: file.name,
          subcategory,
          file_url: path,
          file_type: file.type || 'application/octet-stream',
          file_size: file.size,
        })
      } else {
        failed.push(file.name)
      }
      setProgress({ done: i + 1, total: staged.length })
    }

    if (uploaded.length === 0) {
      setUploading(false)
      setProgress(null)
      setError('Le téléversement a échoué. Réessayez.')
      return
    }

    const res = await bulkCreateClientDocuments(clientId, uploaded)
    setUploading(false)
    setProgress(null)

    if (res?.error) {
      setError(res.error)
      return
    }

    setStaged([])
    if (failed.length > 0) {
      setError(`${failed.length} fichier(s) non téléversé(s) : ${failed.join(', ')}`)
    }
    router.refresh()
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
      {/* ── Documents déjà importés ── */}
      {docs.length > 0 && (
        <div className="space-y-2">
          {docs.map(d => (
            <div
              key={d.id}
              className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 border border-gray-100"
            >
              <div className="w-9 h-9 rounded-lg bg-white border border-gray-100 flex items-center justify-center flex-shrink-0">
                {isImage(d.fileType)
                  ? <ImageIcon className="w-4 h-4 text-gray-400" />
                  : <FileText className="w-4 h-4 text-gray-400" />}
              </div>
              <div className="flex-1 min-w-0">
                {d.url ? (
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold text-gray-900 truncate block hover:underline"
                  >
                    {d.name}
                  </a>
                ) : (
                  <p className="text-sm font-semibold text-gray-900 truncate">{d.name}</p>
                )}
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {getSubcategoryLabel('client', d.subcategory)}
                </p>
              </div>
              <button
                onClick={() => handleDelete(d.id)}
                disabled={deletingId === d.id}
                className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0 disabled:opacity-50"
                aria-label="Supprimer le document"
              >
                {deletingId === d.id
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Trash2 className="w-4 h-4" />}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Zone d'import ── */}
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
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={e => { addFiles(e.target.files); e.target.value = '' }}
        />
      </div>

      {/* ── Fichiers en attente d'import (type par fichier) ── */}
      {staged.length > 0 && (
        <div className="space-y-2">
          {staged.map((s, i) => (
            <div key={i} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white border border-gray-200">
              <div className="w-9 h-9 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
                {s.file.type.startsWith('image/')
                  ? <ImageIcon className="w-4 h-4 text-gray-400" />
                  : <FileText className="w-4 h-4 text-gray-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{s.file.name}</p>
                <select
                  value={s.subcategory}
                  onChange={e => updateType(i, e.target.value)}
                  className="mt-1 w-full text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-gray-400"
                >
                  {CLIENT_SUBCATS.map(sc => (
                    <option key={sc.id} value={sc.id}>{sc.label}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => removeStaged(i)}
                className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                aria-label="Retirer ce fichier"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}

          <button
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
    </div>
  )
}
