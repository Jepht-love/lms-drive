'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  UploadCloud, Loader2, FileText, Image as ImageIcon, X, Check, Trash2,
  Search, ArrowLeft, Users, UserPlus,
} from 'lucide-react'
import { uploadFileToSupabase } from '@/lib/upload'
import {
  stageClientDocuments, assignClientDocuments, deleteClientDocument,
} from '@/lib/actions/documents'
import { createClientQuick } from '@/lib/actions/clients'
import { DOCUMENT_SUBCATEGORIES, getSubcategoryLabel } from '@/lib/documents/categories'

export interface StagedDoc {
  id: string
  name: string
  url: string | null
  fileType: string | null
}
export interface ClientLite {
  id: string
  name: string
  phone: string | null
}

const CLIENT_SUBCATS = DOCUMENT_SUBCATEGORIES.client
const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.heic,image/*,application/pdf'

function isImage(type: string | null) {
  return !!type && type.startsWith('image/')
}

export default function ImportTriageClient({
  staged,
  clients,
}: {
  staged: StagedDoc[]
  clients: ClientLite[]
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  // Liste clients locale : permet d'ajouter aussitôt une fiche créée à la volée
  // (client dont les pièces sont là mais qui n'existait pas encore en base).
  const [clientList, setClientList] = useState<ClientLite[]>(clients)
  const [creating, setCreating] = useState(false)
  const [showMoreTypes, setShowMoreTypes] = useState(false)

  // ── Upload ──
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // ── Tri / assignation ──
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [client, setClient] = useState<ClientLite | null>(null)
  const [subcategory, setSubcategory] = useState('cni')
  const [assigning, setAssigning] = useState(false)
  const [assignError, setAssignError] = useState<string | null>(null)

  const [lightbox, setLightbox] = useState<StagedDoc | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const filteredClients = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return clientList.slice(0, 8)
    return clientList
      .filter(c => c.name.toLowerCase().includes(q) || (c.phone ?? '').includes(q))
      .slice(0, 8)
  }, [clientList, query])

  // Pas de client existant portant EXACTEMENT ce nom → on propose de le créer.
  const trimmedQuery = query.trim()
  const hasExactMatch = clientList.some(c => c.name.toLowerCase() === trimmedQuery.toLowerCase())
  const canCreate = trimmedQuery.length >= 2 && !hasExactMatch

  async function handleCreateClient() {
    if (!canCreate) return
    setAssignError(null)
    setCreating(true)
    const res = await createClientQuick(trimmedQuery)
    setCreating(false)
    if (res?.error || !res?.client) { setAssignError(res?.error ?? 'Création impossible'); return }
    // Ajoute la fiche à la liste locale et la sélectionne aussitôt pour l'assignation.
    setClientList(prev => [{ id: res.client.id, name: res.client.name, phone: null }, ...prev])
    setClient({ id: res.client.id, name: res.client.name, phone: null })
    setQuery('')
    router.refresh()
  }

  async function handleFiles(list: FileList | null) {
    if (!list || list.length === 0) return
    setUploadError(null)
    setUploading(true)
    const files = Array.from(list)
    setProgress({ done: 0, total: files.length })

    const uploaded: { name: string; file_url: string; file_type: string; file_size: number }[] = []
    const failed: string[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const path = await uploadFileToSupabase(file, 'client/a-trier', 'documents')
      if (path) {
        uploaded.push({
          name: file.name,
          file_url: path,
          file_type: file.type || 'application/octet-stream',
          file_size: file.size,
        })
      } else {
        failed.push(file.name)
      }
      setProgress({ done: i + 1, total: files.length })
    }

    if (uploaded.length > 0) {
      const res = await stageClientDocuments(uploaded)
      if (res?.error) setUploadError(res.error)
    }
    setUploading(false)
    setProgress(null)
    if (failed.length > 0) {
      setUploadError(`${failed.length} fichier(s) non téléversé(s) : ${failed.slice(0, 5).join(', ')}${failed.length > 5 ? '…' : ''}`)
    }
    router.refresh()
  }

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function clearSelection() {
    setSelected(new Set())
    setClient(null)
    setQuery('')
    setSubcategory('cni')
    setShowMoreTypes(false)
    setAssignError(null)
  }

  async function handleAssign() {
    if (!client || selected.size === 0) return
    setAssignError(null)
    setAssigning(true)
    const res = await assignClientDocuments([...selected], client.id, subcategory)
    setAssigning(false)
    if (res?.error) { setAssignError(res.error); return }
    clearSelection()
    router.refresh()
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    const res = await deleteClientDocument(id, null)
    setDeletingId(null)
    if (res?.error) { setAssignError(res.error); return }
    setSelected(prev => { const n = new Set(prev); n.delete(id); return n })
    router.refresh()
  }

  return (
    <div className="space-y-4 pb-28">
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <a
          href="/documents"
          className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center flex-shrink-0"
          aria-label="Retour aux documents"
        >
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </a>
        <div className="min-w-0">
          <h1 className="text-xl font-black text-gray-900 leading-tight">Import &amp; tri</h1>
          <p className="text-[12px] text-gray-500">
            {staged.length > 0
              ? `${staged.length} pièce${staged.length > 1 ? 's' : ''} à rattacher à un client`
              : 'Déposez un lot de documents à rattacher'}
          </p>
        </div>
      </div>

      {/* Zone de dépôt */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`rounded-2xl border-2 border-dashed px-4 py-7 text-center transition-colors ${
          uploading ? 'cursor-wait opacity-80' : 'cursor-pointer'
        } ${dragOver ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
      >
        {uploading ? (
          <>
            <Loader2 className="w-6 h-6 text-gray-500 mx-auto mb-2 animate-spin" />
            <p className="text-sm font-semibold text-gray-700">
              Téléversement {progress ? `${progress.done}/${progress.total}` : ''}…
            </p>
          </>
        ) : (
          <>
            <UploadCloud className="w-7 h-7 text-gray-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-gray-700">
              Glissez tout le lot ici ou cliquez pour choisir
            </p>
            <p className="text-[11px] text-gray-400 mt-1">
              Ouvrez votre dossier « telegram », sélectionnez tout (Ctrl/Cmd + A) et validez.<br />
              PDF &amp; images · plusieurs fichiers à la fois
            </p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={e => { handleFiles(e.target.files); e.target.value = '' }}
        />
      </div>

      {uploadError && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{uploadError}</p>
      )}

      {/* Grille à trier */}
      {staged.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
          <Check className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
          <p className="text-sm font-semibold text-gray-600">Rien à trier</p>
          <p className="text-[12px] text-gray-400 mt-0.5">
            Les documents assignés apparaissent sur la fiche de chaque client.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
              À trier · {staged.length}
            </p>
            {selected.size > 0 && (
              <button onClick={clearSelection} className="text-[12px] font-semibold text-gray-500 hover:text-gray-700">
                Désélectionner ({selected.size})
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
            {staged.map(d => {
              const isSel = selected.has(d.id)
              return (
                <div
                  key={d.id}
                  className={`relative rounded-xl border overflow-hidden bg-white transition-all ${
                    isSel ? 'border-gray-900 ring-2 ring-gray-900/10' : 'border-gray-200'
                  }`}
                >
                  {/* Aperçu (clic = sélection) */}
                  <button
                    onClick={() => toggle(d.id)}
                    className="block w-full aspect-square bg-gray-50 relative"
                  >
                    {isImage(d.fileType) && d.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={d.url} alt={d.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="w-full h-full flex items-center justify-center">
                        <FileText className="w-8 h-8 text-gray-300" />
                      </span>
                    )}
                    {/* Coche de sélection */}
                    <span className={`absolute top-1.5 left-1.5 w-5 h-5 rounded-md border flex items-center justify-center ${
                      isSel ? 'bg-gray-900 border-gray-900' : 'bg-white/80 border-gray-300'
                    }`}>
                      {isSel && <Check className="w-3.5 h-3.5 text-white" />}
                    </span>
                  </button>

                  {/* Actions : agrandir + supprimer */}
                  <div className="absolute top-1.5 right-1.5 flex flex-col gap-1">
                    {d.url && (
                      <button
                        onClick={() => setLightbox(d)}
                        className="w-6 h-6 rounded-md bg-white/85 border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-900"
                        aria-label="Agrandir"
                      >
                        <Search className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(d.id)}
                      disabled={deletingId === d.id}
                      className="w-6 h-6 rounded-md bg-white/85 border border-gray-200 flex items-center justify-center text-gray-400 hover:text-red-500 disabled:opacity-50"
                      aria-label="Supprimer"
                    >
                      {deletingId === d.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                    </button>
                  </div>

                  <p className="text-[10px] text-gray-500 truncate px-1.5 py-1">{d.name}</p>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Barre d'assignation (visible dès qu'une pièce est cochée) */}
      {selected.size > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-200 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] p-3 space-y-2.5">
          <div className="max-w-lg mx-auto space-y-2.5">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <p className="text-sm font-bold text-gray-900">
                {selected.size} pièce{selected.size > 1 ? 's' : ''} à rattacher
              </p>
              {client && (
                <span className="ml-auto text-[12px] font-semibold text-emerald-600 truncate">
                  → {client.name}
                </span>
              )}
            </div>

            {/* Recherche client */}
            {!client ? (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  autoFocus
                  type="search"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Rechercher un client (nom ou téléphone)…"
                  className="w-full pl-9 pr-4 py-2.5 bg-gray-50 rounded-xl border border-gray-200 text-[13px] text-gray-800 placeholder-gray-400 outline-none focus:border-gray-400"
                />
                {(query.trim() !== '' || filteredClients.length > 0) && (
                  <div className="mt-1.5 max-h-52 overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-100 bg-white">
                    {filteredClients.map(c => (
                      <button
                        key={c.id}
                        onClick={() => { setClient(c); setQuery('') }}
                        className="w-full text-left px-3 py-2.5 hover:bg-gray-50"
                      >
                        <span className="text-[13px] font-semibold text-gray-900">{c.name}</span>
                        {c.phone && <span className="text-[11px] text-gray-400 ml-2">{c.phone}</span>}
                      </button>
                    ))}
                    {filteredClients.length === 0 && !canCreate && (
                      <p className="text-[12px] text-gray-400 px-3 py-2.5">Tapez un nom pour rechercher ou créer</p>
                    )}
                    {/* Client absent de la base → création express de la fiche */}
                    {canCreate && (
                      <button
                        onClick={handleCreateClient}
                        disabled={creating}
                        className="w-full text-left px-3 py-2.5 bg-emerald-50 hover:bg-emerald-100 flex items-center gap-2 disabled:opacity-60"
                      >
                        {creating
                          ? <Loader2 className="w-4 h-4 text-emerald-600 animate-spin flex-shrink-0" />
                          : <UserPlus className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
                        <span className="text-[13px] font-semibold text-emerald-700">
                          Créer le client « {trimmedQuery} »
                        </span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => setClient(null)}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-200"
              >
                <span className="text-[13px] font-semibold text-gray-900">{client.name}</span>
                <span className="text-[12px] text-gray-400">Changer</span>
              </button>
            )}

            {/* Type de pièce : bascule rapide CNI / Permis (les 2 seuls types du lot),
                + « Autre… » pour les cas rares (justif domicile, passeport…). */}
            <div className="space-y-2">
              <div className="flex gap-2">
                {[{ id: 'cni', label: 'CNI' }, { id: 'permis', label: 'Permis' }].map(t => (
                  <button
                    key={t.id}
                    onClick={() => { setSubcategory(t.id); setShowMoreTypes(false) }}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-colors ${
                      subcategory === t.id
                        ? 'bg-[#111111] text-white border-[#111111]'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
                <button
                  onClick={() => setShowMoreTypes(v => !v)}
                  className={`px-3 rounded-xl text-sm font-semibold border transition-colors ${
                    showMoreTypes || (subcategory !== 'cni' && subcategory !== 'permis')
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-gray-50 text-gray-500 border-gray-200'
                  }`}
                >
                  Autre…
                </button>
              </div>

              {showMoreTypes && (
                <select
                  value={subcategory}
                  onChange={e => setSubcategory(e.target.value)}
                  className="w-full text-[13px] font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-gray-400"
                >
                  {CLIENT_SUBCATS.map(sc => (
                    <option key={sc.id} value={sc.id}>{sc.label}</option>
                  ))}
                </select>
              )}

              <button
                onClick={handleAssign}
                disabled={!client || assigning}
                className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#111111] text-white text-sm font-bold hover:bg-black transition-colors disabled:opacity-50"
              >
                {assigning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Assigner en {getSubcategoryLabel('client', subcategory)}
              </button>
            </div>

            {assignError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{assignError}</p>
            )}
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/15 flex items-center justify-center text-white"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
          {isImage(lightbox.fileType) && lightbox.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={lightbox.url} alt={lightbox.name} className="max-w-full max-h-full object-contain rounded-lg" />
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
      )}
    </div>
  )
}
