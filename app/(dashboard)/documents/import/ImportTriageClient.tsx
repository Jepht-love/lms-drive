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
  const [client, setClient] = useState<ClientLite | null>(null)
  // Type de pièce : bascules CNI / Séjour / Permis. CNI et Séjour sont des pièces
  // d'identité alternatives → mutuellement exclusives. Permis est indépendant et
  // se combine avec l'une ou l'autre (photo contenant identité + permis) → types
  // combinés « cni_permis » / « sejour_permis ». « Autre… » (otherSub) prend le
  // dessus pour les cas rares (justif domicile, passeport…) et coupe les bascules.
  const [quickCni, setQuickCni] = useState(true)
  const [quickSejour, setQuickSejour] = useState(false)
  const [quickPermis, setQuickPermis] = useState(false)
  const [otherSub, setOtherSub] = useState<string | null>(null)
  const idPart = quickCni ? 'cni' : quickSejour ? 'sejour' : ''
  const subcategory =
    otherSub ??
    (idPart === 'cni'
      ? (quickPermis ? 'cni_permis' : 'cni')
      : idPart === 'sejour'
        ? (quickPermis ? 'sejour_permis' : 'titre_sejour')
        : quickPermis ? 'permis' : '')

  function pickType(kind: 'cni' | 'sejour' | 'permis') {
    setOtherSub(null)
    setShowMoreTypes(false)
    if (kind === 'cni') { setQuickSejour(false); setQuickCni(v => !v) }
    else if (kind === 'sejour') { setQuickCni(false); setQuickSejour(v => !v) }
    else { setQuickPermis(v => !v) }
  }
  const [assigning, setAssigning] = useState(false)
  const [assignError, setAssignError] = useState<string | null>(null)

  const [lightbox, setLightbox] = useState<StagedDoc | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Sélectionne un client (barre du bas OU zoom). Depuis le zoom (docId fourni),
  // on ajoute la photo à la sélection et on referme le zoom → la barre du bas
  // apparaît prête (type + Assigner).
  function pickClient(c: ClientLite, docId?: string) {
    if (docId) setSelected(prev => new Set(prev).add(docId))
    setClient(c)
    if (docId) setLightbox(null)
  }

  // Crée une fiche à la volée puis l'utilise aussitôt (barre ou zoom).
  async function createClientAndUse(name: string, docId?: string) {
    setAssignError(null)
    setCreating(true)
    const res = await createClientQuick(name)
    setCreating(false)
    if (res?.error || !res?.client) { setAssignError(res?.error ?? 'Création impossible'); return }
    const c: ClientLite = { id: res.client.id, name: res.client.name, phone: null }
    setClientList(prev => [c, ...prev])
    pickClient(c, docId)
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

    // `finally` : un rejet en cours d'upload laisserait sinon la progression
    // figée et la zone de dépôt bloquée en état « téléversement ».
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const sent = await uploadFileToSupabase(file, 'client/a-trier', 'documents')
        if (sent) {
          uploaded.push({
            name: file.name,
            // Valeurs de ce qui est réellement stocké (une photo est réduite avant envoi).
            file_url: sent.path,
            file_type: sent.type,
            file_size: sent.size,
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
      if (failed.length > 0) {
        setUploadError(`${failed.length} fichier(s) non téléversé(s) : ${failed.slice(0, 5).join(', ')}${failed.length > 5 ? '…' : ''}`)
      }
      router.refresh()
    } catch {
      setUploadError('Le téléversement a échoué. Vérifiez votre connexion puis réessayez.')
    } finally {
      setUploading(false)
      setProgress(null)
    }
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
    setQuickCni(true)
    setQuickSejour(false)
    setQuickPermis(false)
    setOtherSub(null)
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
              <button type="button" onClick={clearSelection} className="text-[12px] font-semibold text-gray-500 hover:text-gray-700">
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
                  <button type="button"
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
                      <button type="button"
                        onClick={() => setLightbox(d)}
                        className="w-6 h-6 rounded-md bg-white/85 border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-900"
                        aria-label="Agrandir"
                      >
                        <Search className="w-3 h-3" />
                      </button>
                    )}
                    <button type="button"
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
              <ClientSearch
                clients={clientList}
                creating={creating}
                autoFocus
                onPick={c => pickClient(c)}
                onCreate={name => createClientAndUse(name)}
              />
            ) : (
              <button type="button"
                onClick={() => setClient(null)}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-200"
              >
                <span className="text-[13px] font-semibold text-gray-900">{client.name}</span>
                <span className="text-[12px] text-gray-400">Changer</span>
              </button>
            )}

            {/* Type de pièce : CNI / Séjour (identité, exclusives) + Permis
                (indépendant, combinable). « Autre… » pour les cas rares. */}
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2">
                {([
                  { kind: 'cni' as const, label: 'CNI', on: !otherSub && quickCni },
                  { kind: 'sejour' as const, label: 'Séjour', on: !otherSub && quickSejour },
                  { kind: 'permis' as const, label: 'Permis', on: !otherSub && quickPermis },
                ]).map(t => (
                  <button type="button"
                    key={t.kind}
                    onClick={() => pickType(t.kind)}
                    className={`py-2.5 rounded-xl text-sm font-bold border transition-colors ${
                      t.on
                        ? 'bg-[#111111] text-white border-[#111111]'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <button type="button"
                onClick={() => setShowMoreTypes(v => !v)}
                className={`w-full py-2 rounded-xl text-[13px] font-semibold border transition-colors ${
                  otherSub
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-gray-50 text-gray-500 border-gray-200'
                }`}
              >
                Autre type…
              </button>

              {showMoreTypes && (
                <select
                  aria-label="Type de document"
                  value={otherSub ?? ''}
                  onChange={e => { setOtherSub(e.target.value || null); setQuickCni(false); setQuickSejour(false); setQuickPermis(false) }}
                  className="w-full text-[13px] font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-gray-400"
                >
                  <option value="">Choisir un type…</option>
                  {CLIENT_SUBCATS
                    .filter(sc => !['cni', 'titre_sejour', 'permis', 'cni_permis', 'sejour_permis'].includes(sc.id))
                    .map(sc => (
                      <option key={sc.id} value={sc.id}>{sc.label}</option>
                    ))}
                </select>
              )}

              <button type="button"
                onClick={handleAssign}
                disabled={!client || assigning || !subcategory}
                className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#111111] text-white text-sm font-bold hover:bg-black transition-colors disabled:opacity-50"
              >
                {assigning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {subcategory ? `Assigner en ${getSubcategoryLabel('client', subcategory)}` : 'Choisissez un type'}
              </button>
            </div>

            {assignError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{assignError}</p>
            )}
          </div>
        </div>
      )}

      {/* Lightbox : photo agrandie pour lire le nom + champ pour l'écrire aussitôt */}
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

          {/* Média */}
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

          {/* Panneau : écrire le nom du client lu sur la pièce */}
          <div
            className="mt-3 bg-white rounded-2xl p-3 w-full max-w-lg mx-auto space-y-2"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
              Client sur cette pièce
            </p>
            <ClientSearch
              clients={clientList}
              creating={creating}
              autoFocus
              onPick={c => pickClient(c, lightbox.id)}
              onCreate={name => createClientAndUse(name, lightbox.id)}
            />
            <p className="text-[11px] text-gray-400">
              Choisir/créer le client sélectionne cette photo et ferme le zoom → choisissez le type et « Assigner ».
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Champ de recherche + création de client, réutilisé dans la barre d'assignation
 * ET dans le zoom (pour écrire le nom lu sur la pièce). Gère sa propre saisie ;
 * remonte la sélection (onPick) ou la création (onCreate) au parent.
 */
function ClientSearch({
  clients,
  creating,
  autoFocus,
  onPick,
  onCreate,
}: {
  clients: ClientLite[]
  creating: boolean
  autoFocus?: boolean
  onPick: (c: ClientLite) => void
  onCreate: (name: string) => void
}) {
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return clients.slice(0, 8)
    return clients
      .filter(c => c.name.toLowerCase().includes(s) || (c.phone ?? '').includes(s))
      .slice(0, 8)
  }, [clients, q])

  const trimmed = q.trim()
  const hasExact = clients.some(c => c.name.toLowerCase() === trimmed.toLowerCase())
  const canCreate = trimmed.length >= 2 && !hasExact

  return (
    <div className="relative">
      <label htmlFor="triage-client-search" className="sr-only">Rechercher un client</label>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
      <input
        id="triage-client-search"
        autoFocus={autoFocus}
        type="search"
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Nom du client (ou téléphone)…"
        className="w-full pl-9 pr-4 py-2.5 bg-gray-50 rounded-xl border border-gray-200 text-[13px] text-gray-800 placeholder-gray-400 outline-none focus:border-gray-400"
      />
      {(trimmed !== '' || filtered.length > 0) && (
        <div className="mt-1.5 max-h-52 overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-100 bg-white">
          {filtered.map(c => (
            <button type="button"
              key={c.id}
              onClick={() => { onPick(c); setQ('') }}
              className="w-full text-left px-3 py-2.5 hover:bg-gray-50"
            >
              <span className="text-[13px] font-semibold text-gray-900">{c.name}</span>
              {c.phone && <span className="text-[11px] text-gray-400 ml-2">{c.phone}</span>}
            </button>
          ))}
          {filtered.length === 0 && !canCreate && (
            <p className="text-[12px] text-gray-400 px-3 py-2.5">Tapez un nom pour rechercher ou créer</p>
          )}
          {canCreate && (
            <button type="button"
              onClick={() => { onCreate(trimmed); setQ('') }}
              disabled={creating}
              className="w-full text-left px-3 py-2.5 bg-emerald-50 hover:bg-emerald-100 flex items-center gap-2 disabled:opacity-60"
            >
              {creating
                ? <Loader2 className="w-4 h-4 text-emerald-600 animate-spin flex-shrink-0" />
                : <UserPlus className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
              <span className="text-[13px] font-semibold text-emerald-700">
                Créer le client « {trimmed} »
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
