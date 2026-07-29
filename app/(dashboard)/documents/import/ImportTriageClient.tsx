'use client'

/**
 * Écran « Import & tri » — le tri à l'écran des pièces déposées en masse.
 *
 * À quoi il sert : le gérant reçoit ses pièces par messagerie, les enregistre en
 * lot sur son téléphone, dépose tout ici, puis range. Une pile par famille
 * (client, véhicule, société, partenaire) : on choisit la pile, on coche les
 * pièces qui vont ensemble, on désigne la cible et le type, on classe. La pièce
 * prend alors son nom canonique et apparaît sur la fiche de sa cible.
 *
 * Ce qu'il attend : les piles déjà chargées et signées par `page.tsx`, plus les
 * listes de cibles. Il ne lit jamais la base lui-même.
 * Ce qu'il produit : des appels à `stageTriageDocuments` (dépôt),
 * `assignTriageDocuments` (classement), `moveTriageDocuments` (pile changée) et
 * `deleteClientDocument` (pièce jetée).
 *
 * Ce qu'il ne faut pas casser :
 *  - le dossier de dépôt et le type de cible viennent de `TRIAGE_FAMILIES`, pas
 *    d'une valeur écrite ici : une cinquième famille ne doit rien demander à cet
 *    écran ;
 *  - changer de pile remet à zéro la sélection ET le type choisi. Sans ça, on
 *    classerait une carte grise avec un type de pièce client ;
 *  - la société ne se rattache à rien (`entityType: null`) : le bouton doit rester
 *    actif sans cible pour cette pile, et seulement pour elle ;
 *  - les bascules CNI / Séjour / Permis sont propres à la pile client : ce sont
 *    les trois pièces qu'on trie par dizaines, le reste passe par la liste.
 *
 * Écrit le 29/07/2026 pour la seule pile client, étendu aux quatre familles le
 * 30/07/2026 (remarque 15 de Jeff).
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  UploadCloud, Loader2, FileText, X, Check, Trash2,
  Search, ArrowLeft, Layers, UserPlus, FolderInput, CalendarClock,
} from 'lucide-react'
import { uploadFileToSupabase } from '@/lib/upload'
import {
  stageTriageDocuments, assignTriageDocuments, moveTriageDocuments, deleteClientDocument,
} from '@/lib/actions/documents'
import { createClientQuick } from '@/lib/actions/clients'
import { getSubcategoryLabel, subcategoryExpires } from '@/lib/documents/categories'
import {
  TRIAGE_FAMILIES, getTriageFamily, triageSubcategories, type TriageFamily,
} from '@/lib/documents/triage'
import DatePickerField from '@/components/ui/DatePickerField'

export interface StagedDoc {
  id: string
  name: string
  url: string | null
  fileType: string | null
  /** Pile dans laquelle la pièce attend. */
  family: TriageFamily
}
export interface ClientLite {
  id: string
  name: string
  phone: string | null
}
/** Cible de rattachement d'une pile : un véhicule (plaque), un partenaire (nom). */
export interface TargetLite {
  id: string
  name: string
  /** Précision affichée à droite du nom (marque et modèle, contact…). */
  hint: string | null
}

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.heic,image/*,application/pdf'

/** Types d'identité gérés par les bascules de la pile client, donc retirés de la liste. */
const CLIENT_QUICK_IDS = ['cni', 'titre_sejour', 'permis', 'cni_permis', 'sejour_permis']

function isImage(type: string | null) {
  return !!type && type.startsWith('image/')
}

export default function ImportTriageClient({
  staged,
  clients,
  vehicles,
  partners,
}: {
  staged: StagedDoc[]
  clients: ClientLite[]
  vehicles: TargetLite[]
  partners: TargetLite[]
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  // Liste clients locale : permet d'ajouter aussitôt une fiche créée à la volée
  // (client dont les pièces sont là mais qui n'existait pas encore en base).
  const [clientList, setClientList] = useState<ClientLite[]>(clients)
  const [creating, setCreating] = useState(false)

  // ── Pile active ──
  // On ouvre sur la première pile qui a quelque chose à trier : le gérant arrive
  // le plus souvent après un dépôt, il ne doit pas chercher où sont ses pièces.
  const [family, setFamily] = useState<TriageFamily>(
    () => TRIAGE_FAMILIES.find(f => staged.some(d => d.family === f.id))?.id ?? 'client',
  )
  const fam = getTriageFamily(family)!

  const piles = useMemo(() => {
    const m = new Map<TriageFamily, StagedDoc[]>(TRIAGE_FAMILIES.map(f => [f.id, [] as StagedDoc[]]))
    for (const d of staged) m.get(d.family)?.push(d)
    return m
  }, [staged])
  const pile = piles.get(family) ?? []

  // ── Dépôt ──
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // ── Tri ──
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [target, setTarget] = useState<TargetLite | null>(null)
  const [expiry, setExpiry] = useState('')
  const [showMove, setShowMove] = useState(false)
  const [moving, setMoving] = useState(false)

  // Repère posé sur `body` tant que la barre de rangement est ouverte : la bulle
  // « Signaler un bug » est fixée en bas à gauche et se retrouvait posée sur le
  // bouton « Ranger en… » en largeur téléphone (vu le 30/07/2026). Le z-index ne
  // peut rien : la bulle et la barre ne vivent pas dans le même empilement, la
  // barre étant à l'intérieur d'un conteneur lui-même fixé. La règle est dans
  // app/globals.css, à côté de celle qui efface la barre du bas pendant un tiroir.
  const barOpen = selected.size > 0
  useEffect(() => {
    if (barOpen) document.body.dataset.sortingBar = 'true'
    else delete document.body.dataset.sortingBar
    return () => { delete document.body.dataset.sortingBar }
  }, [barOpen])

  // Type de pièce, pile client : bascules CNI / Séjour / Permis. CNI et Séjour
  // sont des pièces d'identité alternatives → mutuellement exclusives. Permis est
  // indépendant et se combine avec l'une ou l'autre (photo contenant identité +
  // permis) → types combinés « cni_permis » / « sejour_permis ». La liste
  // (`listSub`) prend le dessus pour les cas rares et coupe les bascules.
  const [quickCni, setQuickCni] = useState(true)
  const [quickSejour, setQuickSejour] = useState(false)
  const [quickPermis, setQuickPermis] = useState(false)
  const [showMoreTypes, setShowMoreTypes] = useState(false)
  // Type choisi dans la liste déroulante. Seul mode de choix hors pile client.
  const [listSub, setListSub] = useState<string | null>(null)

  const idPart = quickCni ? 'cni' : quickSejour ? 'sejour' : ''
  const clientSub =
    listSub ??
    (idPart === 'cni'
      ? (quickPermis ? 'cni_permis' : 'cni')
      : idPart === 'sejour'
        ? (quickPermis ? 'sejour_permis' : 'titre_sejour')
        : quickPermis ? 'permis' : '')
  const subcategory = family === 'client' ? clientSub : (listSub ?? '')
  const needsExpiry = !!subcategory && subcategoryExpires(family, subcategory)

  const [assigning, setAssigning] = useState(false)
  const [assignError, setAssignError] = useState<string | null>(null)

  const [lightbox, setLightbox] = useState<StagedDoc | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Cibles de la pile active. La société ne se rattache à rien → liste vide.
  const targets: TargetLite[] = useMemo(() => {
    if (family === 'client') return clientList.map(c => ({ id: c.id, name: c.name, hint: c.phone }))
    if (family === 'vehicule') return vehicles
    if (family === 'partenaire') return partners
    return []
  }, [family, clientList, vehicles, partners])

  function pickType(kind: 'cni' | 'sejour' | 'permis') {
    setListSub(null)
    setShowMoreTypes(false)
    if (kind === 'cni') { setQuickSejour(false); setQuickCni(v => !v) }
    else if (kind === 'sejour') { setQuickCni(false); setQuickSejour(v => !v) }
    else { setQuickPermis(v => !v) }
  }

  // Désigne la cible (barre du bas OU zoom). Depuis le zoom (docId fourni), on
  // ajoute la pièce à la sélection et on referme → la barre du bas apparaît prête.
  function pickTarget(t: TargetLite, docId?: string) {
    if (docId) setSelected(prev => new Set(prev).add(docId))
    setTarget(t)
    if (docId) setLightbox(null)
  }

  // Crée une fiche client à la volée puis l'utilise aussitôt (barre ou zoom).
  async function createClientAndUse(name: string, docId?: string) {
    setAssignError(null)
    setCreating(true)
    const res = await createClientQuick(name)
    setCreating(false)
    if (res?.error || !res?.client) { setAssignError(res?.error ?? 'Création impossible'); return }
    const c: ClientLite = { id: res.client.id, name: res.client.name, phone: null }
    setClientList(prev => [c, ...prev])
    pickTarget({ id: c.id, name: c.name, hint: null }, docId)
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

    // `finally` : un rejet en cours de dépôt laisserait sinon la progression
    // figée et la zone bloquée en état « téléversement ».
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const sent = await uploadFileToSupabase(file, fam.folder, 'documents')
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
        const res = await stageTriageDocuments(family, uploaded)
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
    setTarget(null)
    setQuickCni(true)
    setQuickSejour(false)
    setQuickPermis(false)
    setListSub(null)
    setShowMoreTypes(false)
    setExpiry('')
    setShowMove(false)
    setAssignError(null)
  }

  // Changer de pile efface la sélection et le type : une pièce d'une pile ne se
  // classe jamais avec le type d'une autre.
  function switchFamily(id: TriageFamily) {
    if (id === family) return
    setFamily(id)
    clearSelection()
    setUploadError(null)
  }

  async function handleAssign() {
    if (selected.size === 0 || !subcategory) return
    if (fam.entityType && !target) return
    setAssignError(null)
    setAssigning(true)
    const res = await assignTriageDocuments([...selected], {
      family,
      targetId: fam.entityType ? target!.id : null,
      subcategory,
      expiryDate: needsExpiry ? (expiry || null) : null,
    })
    setAssigning(false)
    if (res?.error) { setAssignError(res.error); return }
    clearSelection()
    router.refresh()
  }

  async function handleMove(to: TriageFamily) {
    if (selected.size === 0) return
    setAssignError(null)
    setMoving(true)
    const res = await moveTriageDocuments([...selected], to)
    setMoving(false)
    if (res?.error) { setAssignError(res.error); return }
    clearSelection()
    setFamily(to)
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

  const typeList = triageSubcategories(family)
    .filter(sc => family !== 'client' || !CLIENT_QUICK_IDS.includes(sc.id))

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
              ? `${staged.length} pièce${staged.length > 1 ? 's' : ''} à ranger`
              : 'Déposez un lot de documents à ranger'}
          </p>
        </div>
      </div>

      {/* Piles : une par famille, défilables au doigt sur téléphone */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {TRIAGE_FAMILIES.map(f => {
          const n = piles.get(f.id)?.length ?? 0
          const on = f.id === family
          return (
            <button type="button"
              key={f.id}
              onClick={() => switchFamily(f.id)}
              className={`flex-shrink-0 inline-flex items-center gap-1.5 text-[12px] font-medium px-4 py-2.5 min-h-[44px] rounded-2xl transition-colors ${
                on ? 'bg-[#111111] text-white' : 'bg-white border border-gray-200 text-gray-600'
              }`}
            >
              {f.label}
              {n > 0 && (
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                  on ? 'bg-white/20 text-white' : 'bg-amber-500 text-white'
                }`}>
                  {n}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Zone de dépôt — dépose dans la pile active */}
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
              Les pièces arrivent dans la pile <span className="font-semibold text-gray-500">{fam.label}</span>.
              Une pièce tombée dans la mauvaise pile se déplace après coup.<br />
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

      {/* Grille de la pile active */}
      {pile.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
          <Check className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
          <p className="text-sm font-semibold text-gray-600">Rien à trier dans « {fam.label} »</p>
          <p className="text-[12px] text-gray-400 mt-0.5">
            {fam.entityType
              ? `Les pièces rangées apparaissent sur la fiche de chaque ${fam.targetLabel}.`
              : 'Les pièces rangées apparaissent dans la bibliothèque.'}
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
              À trier · {pile.length}
            </p>
            {selected.size > 0 && (
              <button type="button" onClick={clearSelection} className="text-[12px] font-semibold text-gray-500 hover:text-gray-700">
                Désélectionner ({selected.size})
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
            {pile.map(d => {
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

      {/* Barre de rangement (visible dès qu'une pièce est cochée).
          Ne pas chercher à monter ce z-index pour passer devant la bulle
          « Signaler un bug » : cette barre vit dans un conteneur déjà fixé, donc
          dans un autre empilement, et aucune valeur ne la fera passer devant.
          C'est la bulle qui s'efface, via le repère posé sur `body` plus haut. */}
      {selected.size > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-200 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] p-3 max-h-[70vh] overflow-y-auto">
          <div className="max-w-lg mx-auto space-y-2.5">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <p className="text-sm font-bold text-gray-900">
                {selected.size} pièce{selected.size > 1 ? 's' : ''} à ranger
              </p>
              {target && (
                <span className="ml-auto text-[12px] font-semibold text-emerald-600 truncate">
                  {target.name}
                </span>
              )}
            </div>

            {/* Cible : club des piles qui se rattachent à une fiche. */}
            {fam.entityType && (
              !target ? (
                <TargetPicker
                  targets={targets}
                  placeholder={
                    family === 'client' ? 'Nom du client (ou téléphone)…'
                      : family === 'vehicule' ? 'Plaque, marque ou modèle…'
                        : 'Nom du partenaire…'
                  }
                  emptyHint={`Tapez pour rechercher un ${fam.targetLabel}`}
                  creating={creating}
                  autoFocus
                  onPick={t => pickTarget(t)}
                  onCreate={family === 'client' ? name => createClientAndUse(name) : undefined}
                />
              ) : (
                <button type="button"
                  onClick={() => setTarget(null)}
                  className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-200"
                >
                  <span className="text-[13px] font-semibold text-gray-900 truncate">{target.name}</span>
                  <span className="text-[12px] text-gray-400 flex-shrink-0 ml-2">Changer</span>
                </button>
              )
            )}

            <div className="space-y-2">
              {/* Pile client : les trois pièces triées par dizaines passent par des
                  bascules. CNI / Séjour exclusives, Permis combinable. */}
              {family === 'client' && (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { kind: 'cni' as const, label: 'CNI', on: !listSub && quickCni },
                      { kind: 'sejour' as const, label: 'Séjour', on: !listSub && quickSejour },
                      { kind: 'permis' as const, label: 'Permis', on: !listSub && quickPermis },
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
                      listSub
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-gray-50 text-gray-500 border-gray-200'
                    }`}
                  >
                    Autre type…
                  </button>
                </>
              )}

              {/* Liste des types : seul mode de choix hors pile client. */}
              {(family !== 'client' || showMoreTypes) && (
                <select
                  aria-label="Type de document"
                  value={listSub ?? ''}
                  onChange={e => {
                    setListSub(e.target.value || null)
                    setQuickCni(false); setQuickSejour(false); setQuickPermis(false)
                    setExpiry('')
                  }}
                  className="w-full text-[13px] font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 min-h-[44px] outline-none focus:border-gray-400"
                >
                  <option value="">Choisir un type…</option>
                  {typeList.map(sc => (
                    <option key={sc.id} value={sc.id}>{sc.label}</option>
                  ))}
                </select>
              )}

              {/* Date de fin de validité : seulement pour les types qui expirent. */}
              {needsExpiry && (
                <div className="flex items-center gap-2">
                  <CalendarClock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-[12px] font-semibold text-gray-500 flex-shrink-0">Expire le</span>
                  <DatePickerField
                    value={expiry}
                    onChange={setExpiry}
                    aria-label="Date de fin de validité"
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 min-h-[44px] text-[13px]"
                  />
                </div>
              )}

              <button type="button"
                onClick={handleAssign}
                disabled={assigning || !subcategory || (!!fam.entityType && !target)}
                className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#111111] text-white text-sm font-bold hover:bg-black transition-colors disabled:opacity-50"
              >
                {assigning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {subcategory ? `Ranger en ${getSubcategoryLabel(family, subcategory)}` : 'Choisissez un type'}
              </button>

              {/* Pièce tombée dans la mauvaise pile : elle change de pile sans être
                  re-téléversée. */}
              {!showMove ? (
                <button type="button"
                  onClick={() => setShowMove(true)}
                  className="w-full inline-flex items-center justify-center gap-1.5 py-2 text-[12px] font-semibold text-gray-500 hover:text-gray-700"
                >
                  <FolderInput className="w-3.5 h-3.5" /> Déplacer vers une autre pile…
                </button>
              ) : (
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {TRIAGE_FAMILIES.filter(f => f.id !== family).map(f => (
                    <button type="button"
                      key={f.id}
                      onClick={() => handleMove(f.id)}
                      disabled={moving}
                      className="py-2.5 rounded-xl text-[13px] font-bold bg-gray-50 text-gray-600 border border-gray-200 hover:border-gray-300 disabled:opacity-50"
                    >
                      {moving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : f.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {assignError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{assignError}</p>
            )}
          </div>
        </div>
      )}

      {/* Zoom : pièce agrandie pour lire ce qu'il y a dessus, et désigner la cible aussitôt */}
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

          {/* Panneau : désigner la cible lue sur la pièce */}
          <div
            className="mt-3 bg-white rounded-2xl p-3 w-full max-w-lg mx-auto space-y-2"
            onClick={e => e.stopPropagation()}
          >
            {fam.entityType ? (
              <>
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
                  {fam.label} sur cette pièce
                </p>
                <TargetPicker
                  targets={targets}
                  placeholder={
                    family === 'client' ? 'Nom du client (ou téléphone)…'
                      : family === 'vehicule' ? 'Plaque, marque ou modèle…'
                        : 'Nom du partenaire…'
                  }
                  emptyHint={`Tapez pour rechercher un ${fam.targetLabel}`}
                  creating={creating}
                  autoFocus
                  onPick={t => pickTarget(t, lightbox.id)}
                  onCreate={family === 'client' ? name => createClientAndUse(name, lightbox.id) : undefined}
                />
                <p className="text-[11px] text-gray-400">
                  Le choix sélectionne cette pièce et ferme le zoom : il ne reste que le type et « Ranger ».
                </p>
              </>
            ) : (
              <button type="button"
                onClick={() => { setSelected(prev => new Set(prev).add(lightbox.id)); setLightbox(null) }}
                className="w-full py-2.5 rounded-xl bg-[#111111] text-white text-sm font-bold"
              >
                Sélectionner cette pièce
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Recherche d'une cible (client, véhicule, partenaire), réutilisée dans la barre
 * du bas ET dans le zoom. Gère sa propre saisie ; remonte le choix (onPick) ou la
 * création (onCreate) au parent.
 *
 * `onCreate` n'est fourni que pour les clients : un véhicule ou un partenaire ne
 * se crée pas depuis un écran de tri, ces fiches demandent des informations que
 * la pièce ne porte pas.
 */
function TargetPicker({
  targets,
  placeholder,
  emptyHint,
  creating,
  autoFocus,
  onPick,
  onCreate,
}: {
  targets: TargetLite[]
  placeholder: string
  emptyHint: string
  creating: boolean
  autoFocus?: boolean
  onPick: (t: TargetLite) => void
  onCreate?: (name: string) => void
}) {
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return targets.slice(0, 8)
    return targets
      .filter(t => t.name.toLowerCase().includes(s) || (t.hint ?? '').toLowerCase().includes(s))
      .slice(0, 8)
  }, [targets, q])

  const trimmed = q.trim()
  const hasExact = targets.some(t => t.name.toLowerCase() === trimmed.toLowerCase())
  const canCreate = !!onCreate && trimmed.length >= 2 && !hasExact

  return (
    <div>
      {/* La loupe est calée sur le champ seul : dans un cadre englobant la liste,
          elle se retrouve dessinée au milieu des résultats. */}
      <div className="relative">
        <label htmlFor="triage-target-search" className="sr-only">{placeholder}</label>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          id="triage-target-search"
          autoFocus={autoFocus}
          type="search"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-9 pr-4 py-2.5 bg-gray-50 rounded-xl border border-gray-200 text-[13px] text-gray-800 placeholder-gray-400 outline-none focus:border-gray-400"
        />
      </div>
      {(trimmed !== '' || filtered.length > 0) && (
        <div className="mt-1.5 max-h-52 overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-100 bg-white">
          {filtered.map(t => (
            <button type="button"
              key={t.id}
              onClick={() => { onPick(t); setQ('') }}
              className="w-full text-left px-3 py-2.5 hover:bg-gray-50"
            >
              <span className="text-[13px] font-semibold text-gray-900">{t.name}</span>
              {t.hint && <span className="text-[11px] text-gray-400 ml-2">{t.hint}</span>}
            </button>
          ))}
          {filtered.length === 0 && !canCreate && (
            <p className="text-[12px] text-gray-400 px-3 py-2.5">{emptyHint}</p>
          )}
          {canCreate && (
            <button type="button"
              onClick={() => { onCreate!(trimmed); setQ('') }}
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
