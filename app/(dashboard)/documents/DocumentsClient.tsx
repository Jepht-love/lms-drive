'use client'

import { useState, useTransition, useMemo } from 'react'
import { Search, Eye, Share2, Download, Printer, Plus, Paperclip, Trash2, RefreshCw, History, ChevronDown, X } from 'lucide-react'
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_SUBCATEGORIES,
  SENSITIVE_SUBCATEGORIES,
  isExpiringSoon,
  type DocumentCategory,
} from '@/lib/documents/categories'
import Drawer from '@/components/Drawer'
import { AnimatedList, AnimatedListItem } from '@/components/AnimatedList'
import { uploadDocument, deleteDocument, replaceDocument } from '@/lib/actions/documents'
import { formatDate } from '@/lib/utils'

type Document = {
  id: string
  category: DocumentCategory
  subcategory: string
  name: string
  file_url: string
  file_type: string | null
  file_size: number | null
  entity_id: string | null
  entity_type: string | null
  is_auto_generated: boolean
  expiry_date: string | null
  created_at: string
  tags: string[] | null
  // Migration 050 (optionnels tant qu'elle n'est pas exécutée)
  status?: string | null
  version?: number | null
  supersedes_id?: string | null
  is_current?: boolean | null
}

type Vehicle  = { id: string; plate: string; brand: string; model: string }
type Client   = { id: string; first_name: string; last_name: string }
type Partner  = { id: string; name: string }

export type ReservationDoc = {
  id: string
  // 'convention' = mise à disposition inter-agences (partenaire) ; sinon location client.
  kind?: 'reservation' | 'convention'
  reservation_number: string
  status: string
  start_datetime: string
  end_datetime: string
  client_name: string
  vehicle_label: string
  contract_number: string | null
  contract_pdf_url: string | null
  contract_status: string | null
  invoice_number: string | null
  invoice_pdf_url: string | null
}

interface Props {
  documents: Document[]
  vehicles:  Vehicle[]
  clients:   Client[]
  partners:  Partner[]
  userRole:  string
  visibleCategories?: string[]
  reservationDocs: ReservationDoc[]
  docSignedUrls: Record<string, string>
}

const RESA_STATUS_LABEL: Record<string, string> = {
  option:    'En cours',
  confirmee: 'Confirmée',
  en_cours:  'En location',
  terminee:  'Terminée',
  annulee:   'Annulée',
  en_retard: 'En retard',
}

const RESA_STATUS_COLOR: Record<string, string> = {
  option:    'bg-gray-100 text-gray-500',
  confirmee: 'bg-blue-100 text-blue-700',
  en_cours:  'bg-amber-100 text-amber-700',
  terminee:  'bg-green-100 text-green-700',
  annulee:   'bg-red-100 text-red-500',
  en_retard: 'bg-orange-100 text-orange-600',
}

type ActiveTab = 'all' | DocumentCategory | 'reservations'

// Libellés courts pour le nommage automatique des pièces client
// (ex. « CNI Jean Dupont », « Justif. domicile Jean Dupont »).
const CLIENT_DOC_SHORT: Record<string, string> = {
  cni:            'CNI',
  passeport:      'Passeport',
  titre_sejour:   'Titre de séjour',
  justif_domicile:'Justif. domicile',
  permis:         'Permis',
  procuration:    'Procuration',
  autres:         'Document',
}

// Contrat de location, facture de restitution & convention de mise à disposition
// auto-archivés : déjà présents dans l'onglet « Contrats et factures » (tables
// contracts / invoices / inter_agency_rentals). On les masque des onglets
// catégorie pour ne pas les mélanger aux pièces client / partenaire.
const RESERVATION_AUTO_SUBCATS = new Set(['contrat_location', 'facture_restitution', 'convention_ia'])
function isReservationAutoDoc(doc: { is_auto_generated: boolean; subcategory: string }) {
  return doc.is_auto_generated && RESERVATION_AUTO_SUBCATS.has(doc.subcategory)
}

function fileExt(doc: Document) {
  return doc.file_type?.split('/')[1]?.substring(0, 3).toUpperCase() ?? 'DOC'
}

function ExpiryBadge({ date }: { date: string }) {
  const expired = new Date(date) < new Date()
  const soon    = !expired && isExpiringSoon(date)
  if (!expired && !soon) return null
  return (
    <span className={`ml-2 ${expired ? 'text-red-500' : 'text-orange-500'}`}>
      · Exp. {formatDate(date)}
    </span>
  )
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

// Statut effectif : « archive » stocké prime ; sinon dérivé de l'expiration.
type DocStatus = 'valide' | 'a_renouveler' | 'expire' | 'archive'
function docStatus(doc: Document): DocStatus {
  if (doc.status === 'archive' || doc.is_current === false) return 'archive'
  if (doc.expiry_date) {
    if (new Date(doc.expiry_date) < new Date()) return 'expire'
    if (isExpiringSoon(doc.expiry_date)) return 'a_renouveler'
  }
  return 'valide'
}

const STATUS_STYLE: Record<DocStatus, { label: string; cls: string }> = {
  valide:       { label: 'Valide',       cls: 'bg-green-100 text-green-700' },
  a_renouveler: { label: 'À renouveler', cls: 'bg-amber-100 text-amber-700' },
  expire:       { label: 'Expiré',       cls: 'bg-red-100 text-red-600' },
  archive:      { label: 'Archivé',      cls: 'bg-gray-100 text-gray-500' },
}

// Pastille de statut : masquée pour un doc « valide » v1 (liste calme) ; affichée
// dès qu'il y a un signal (à renouveler / expiré / archivé).
function StatusBadge({ doc }: { doc: Document }) {
  const st = docStatus(doc)
  if (st === 'valide') return null
  const s = STATUS_STYLE[st]
  return <span className={`ml-2 text-[10px] font-semibold px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>
}

export default function DocumentsClient({ documents, vehicles, clients, partners, userRole, visibleCategories, reservationDocs, docSignedUrls }: Props) {
  const allCatIds = ['entreprise', 'vehicule', 'client', 'partenaire']
  const visibleCats = visibleCategories ?? allCatIds
  const [category,    setCategory]    = useState<ActiveTab>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showUpload,  setShowUpload]  = useState(false)
  const [isPending,   startTransition] = useTransition()

  const urlFor = (doc: Document) => docSignedUrls[doc.id] ?? doc.file_url

  const [uploadCat,   setUploadCat]   = useState<DocumentCategory | ''>('')
  const [uploadSub,   setUploadSub]   = useState('')
  const [entityId,    setEntityId]    = useState('')
  const [docName,     setDocName]     = useState('')
  const [expiryDate,  setExpiryDate]  = useState('')
  const [file,        setFile]        = useState<File | null>(null)
  const [uploadError, setUploadError] = useState('')

  // Versionnement : cible de remplacement + fichier + expiration, et lignes dépliées
  const [replaceTarget, setReplaceTarget] = useState<Document | null>(null)
  const [replaceFile,   setReplaceFile]   = useState<File | null>(null)
  const [replaceExpiry, setReplaceExpiry] = useState('')
  const [replaceError,  setReplaceError]  = useState('')
  const [expandedHistory, setExpandedHistory] = useState<Set<string>>(new Set())

  const canSeeSensitive = ['gerant', 'associe'].includes(userRole)

  // Index global (toutes versions) pour reconstituer l'historique d'un document
  // en remontant la chaîne supersedes_id.
  const byId = useMemo(() => new Map(documents.map(d => [d.id, d])), [documents])
  const historyOf = (doc: Document): Document[] => {
    const chain: Document[] = []
    const seen = new Set<string>()
    let cur = doc.supersedes_id ? byId.get(doc.supersedes_id) : undefined
    while (cur && !seen.has(cur.id)) { seen.add(cur.id); chain.push(cur); cur = cur.supersedes_id ? byId.get(cur.supersedes_id) : undefined }
    return chain
  }

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase()
    return documents.filter(doc => {
      // Versions archivées masquées de la liste (visibles via l'historique).
      if (doc.is_current === false) return false
      // Contrats, factures de restitution & conventions auto-archivés : masqués des
      // onglets catégorie (ils ont leur onglet « Contrats et factures »), mais bien
      // présents dans « Tous » qui reste une vue exhaustive de tous les documents.
      if (category !== 'all' && isReservationAutoDoc(doc)) return false
      if (!canSeeSensitive && SENSITIVE_SUBCATEGORIES.includes(doc.subcategory)) return false
      if (category !== 'all' && category !== 'reservations' && doc.category !== category) return false
      if (!q) return true
      return (
        doc.name.toLowerCase().includes(q) ||
        displayDocName(doc).toLowerCase().includes(q) ||
        doc.subcategory.toLowerCase().includes(q) ||
        doc.tags?.some(t => t.toLowerCase().includes(q))
      )
    })
  }, [documents, category, searchQuery, canSeeSensitive])

  const grouped = useMemo(() => {
    const map = new Map<string, Document[]>()
    for (const doc of filtered) {
      if (!map.has(doc.subcategory)) map.set(doc.subcategory, [])
      map.get(doc.subcategory)!.push(doc)
    }
    return map
  }, [filtered])

  const filteredReservations = useMemo(() => {
    if (!searchQuery) return reservationDocs
    const q = searchQuery.toLowerCase().trim()
    return reservationDocs.filter(r => {
      // Recherche par date : taper « 21/07 » retrouve la résa/le contrat de cette
      // date (formats jj/mm/aa et jj/mm/aaaa, début comme fin de location).
      const dates = [r.start_datetime, r.end_datetime].flatMap(d => {
        const dt = new Date(d)
        return [
          dt.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' }),
          dt.toLocaleDateString('fr-FR'),
        ]
      }).join(' ')
      return (
        r.reservation_number.toLowerCase().includes(q) ||
        r.client_name.toLowerCase().includes(q) ||
        r.vehicle_label.toLowerCase().includes(q) ||
        (r.contract_number?.toLowerCase().includes(q) ?? false) ||
        (r.invoice_number?.toLowerCase().includes(q) ?? false) ||
        (r.kind === 'convention' && 'convention'.includes(q)) ||
        dates.includes(q)
      )
    })
  }, [reservationDocs, searchQuery])

  function getCategoryLabel(cat: string) {
    const visible = documents.filter(d => d.is_current !== false && (canSeeSensitive || !SENSITIVE_SUBCATEGORIES.includes(d.subcategory)))
    // « Tous » = vue exhaustive (auto inclus) ; les onglets catégorie excluent les auto.
    if (cat === 'all') return `Tous (${visible.length})`
    if (cat === 'reservations') return `Contrats et factures (${reservationDocs.length})`
    const found = DOCUMENT_CATEGORIES.find(c => c.id === cat)
    if (!found) return cat
    const count = visible.filter(d => d.category === cat && !isReservationAutoDoc(d)).length
    return `${found.label} (${count})`
  }

  function getSubLabel(sub: string) {
    for (const cat of Object.values(DOCUMENT_SUBCATEGORIES)) {
      const found = cat.find(s => s.id === sub)
      if (found) return found.label
    }
    return sub
  }

  // Nom auto d'une pièce client : « <libellé court> <Prénom Nom> » (ex. « CNI
  // Jean Dupont »). Renvoie '' si le client ou la sous-catégorie manque.
  function buildClientDocName(sub: string, clientId: string): string {
    const cl = clients.find(c => c.id === clientId)
    if (!cl || !sub) return ''
    const short = CLIENT_DOC_SHORT[sub] ?? getSubLabel(sub)
    return `${short} ${cl.first_name} ${cl.last_name}`.trim()
  }

  // Titre affiché d'un document. Pour une pièce client rattachée à un client
  // connu, on dérive toujours le nom canonique « <libellé> <Prénom Nom> » (ex.
  // « Titre de séjour Jean Dupont »). Ça uniformise l'affichage y compris pour
  // les pièces enregistrées avant le nommage automatique (nom stocké figé), sans
  // écriture en base ni re-téléversement. Repli : le nom stocké.
  function displayDocName(doc: Document): string {
    // Pièces d'identité client uniquement — pas les docs auto (contrat, facture,
    // convention) qui gardent leur nom d'archivage y compris dans « Tous ».
    if (doc.category === 'client' && doc.entity_id && !isReservationAutoDoc(doc)) {
      const auto = buildClientDocName(doc.subcategory, doc.entity_id)
      if (auto) return auto
    }
    return doc.name
  }

  function resetUpload() {
    setUploadCat(''); setUploadSub(''); setEntityId('')
    setDocName(''); setExpiryDate(''); setFile(null); setUploadError('')
    setShowUpload(false)
  }

  async function handleUpload() {
    if (!file || !docName || !uploadCat || !uploadSub) return
    setUploadError('')
    const fd = new FormData()
    fd.append('file', file)
    fd.append('category', uploadCat)
    fd.append('subcategory', uploadSub)
    fd.append('name', docName)
    if (entityId) {
      fd.append('entityId', entityId)
      fd.append('entityType',
        uploadCat === 'vehicule' ? 'vehicle' :
        uploadCat === 'client'   ? 'client'  : 'partner'
      )
    }
    if (expiryDate) fd.append('expiryDate', expiryDate)
    startTransition(async () => {
      try { await uploadDocument(fd); resetUpload() }
      catch (e: any) { setUploadError(e.message ?? 'Erreur upload') }
    })
  }

  async function handleDelete(doc: Document) {
    if (!confirm(`Supprimer « ${displayDocName(doc)} » ?`)) return
    startTransition(async () => {
      try { await deleteDocument(doc.id) }
      catch (e: any) { alert(e.message) }
    })
  }

  // Partage natif : ouvre la feuille de partage iOS/Android (Enregistrer dans
  // Fichiers, Messages, AirDrop…) SANS quitter l'application. Sur WKWebView / PC
  // sans Web Share, on retombe sur l'ouverture du document dans un nouvel onglet.
  // Corrige le piège du « Télécharger » qui affichait le PDF sans retour possible.
  // Visualiseur intégré : ouvrir un document dans l'app (avec un bouton X pour
  // fermer) au lieu de le charger « en plein écran » sans retour possible.
  const [viewDoc, setViewDoc] = useState<Document | null>(null)
  const [sharingId, setSharingId] = useState<string | null>(null)
  async function handleShare(doc: Document) {
    const url = urlFor(doc)
    setSharingId(doc.id)
    try {
      const nav = navigator as Navigator & { canShare?: (d?: any) => boolean }
      // 1) Partage du fichier lui-même (l'utilisateur peut l'enregistrer dans Fichiers)
      if (nav.canShare && typeof nav.share === 'function') {
        try {
          const res  = await fetch(url)
          const blob = await res.blob()
          const ext  = (doc.file_type?.split('/')[1] ?? 'pdf').split('+')[0]
          const safeName = displayDocName(doc).replace(/[^\w.\- ]+/g, '').trim() || 'document'
          const fileObj = new File([blob], `${safeName}.${ext}`, {
            type: blob.type || doc.file_type || 'application/octet-stream',
          })
          if (nav.canShare({ files: [fileObj] })) {
            await nav.share({ files: [fileObj], title: displayDocName(doc) })
            return
          }
        } catch { /* repli sur le partage d'URL ci-dessous */ }
      }
      // 2) Partage de l'URL (signée) à défaut du fichier
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: displayDocName(doc), url })
        return
      }
      // 3) Repli desktop : nouvel onglet
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (e: any) {
      // L'utilisateur a annulé la feuille de partage → ne rien faire.
      if (e?.name !== 'AbortError') window.open(url, '_blank', 'noopener,noreferrer')
    } finally {
      setSharingId(null)
    }
  }

  function resetReplace() {
    setReplaceTarget(null); setReplaceFile(null); setReplaceExpiry(''); setReplaceError('')
  }

  async function handleReplace() {
    if (!replaceTarget || !replaceFile) return
    setReplaceError('')
    const fd = new FormData()
    fd.append('file', replaceFile)
    if (replaceExpiry) fd.append('expiryDate', replaceExpiry)
    startTransition(async () => {
      try { await replaceDocument(replaceTarget.id, fd); resetReplace() }
      catch (e: any) { setReplaceError(e.message ?? 'Erreur remplacement') }
    })
  }

  function toggleHistory(id: string) {
    setExpandedHistory(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const categoryTabs: ActiveTab[] = ['all', ...(visibleCats as ActiveTab[])]
  if (canSeeSensitive) categoryTabs.push('reservations')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-gray-900">Documents</h1>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-[#111111] text-white rounded-xl font-semibold text-sm active:scale-[.97]"
        >
          <Plus className="w-4 h-4" /> Ajouter
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {categoryTabs.map(cat => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`flex-shrink-0 text-[12px] font-medium px-4 py-2.5 min-h-[44px] flex items-center justify-center rounded-2xl transition-colors ${
              category === cat
                ? 'bg-[#111111] text-white'
                : 'bg-white border border-gray-200 text-gray-600'
            }`}
          >
            {getCategoryLabel(cat)}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="search"
          placeholder="Rechercher un document, une réservation, un client..."
          className="w-full pl-9 pr-4 py-3 bg-white rounded-2xl border border-gray-200 text-[13px] text-gray-700 placeholder-gray-400"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      {category === 'reservations' ? (
        filteredReservations.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
            <p className="text-[14px] font-medium text-gray-500">Aucune réservation</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredReservations.map(r => (
              <div key={r.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0 flex-1">
                    {/* Titre = véhicule + période, pour retrouver un contrat en
                        tapant le nom du véhicule ou une date et voir aussitôt
                        qui a réservé, de quand à quand. */}
                    <p className="text-[13px] font-bold text-[#111111] truncate">{r.vehicle_label}</p>
                    <p className="text-[12px] font-semibold text-gray-600">
                      du {fmtDate(r.start_datetime)} au {fmtDate(r.end_datetime)}
                    </p>
                    <p className="text-[11px] text-gray-400 truncate">{r.client_name} · {r.reservation_number}</p>
                  </div>
                  <span className={`flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${RESA_STATUS_COLOR[r.status] ?? 'bg-gray-100 text-gray-500'}`}>
                    {RESA_STATUS_LABEL[r.status] ?? r.status}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {r.contract_pdf_url ? (
                    <a
                      href={r.contract_pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-[11px] font-semibold text-gray-700 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      {r.kind === 'convention' ? 'Convention' : 'Contrat'} {r.contract_number}
                    </a>
                  ) : (
                    <span className="text-[11px] text-gray-300 italic">
                      {r.contract_number
                        ? `${r.contract_number} — PDF non généré`
                        : (r.kind === 'convention' ? 'Aucune convention' : 'Aucun contrat')}
                    </span>
                  )}
                  {r.invoice_pdf_url && (
                    <a
                      href={r.invoice_pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 rounded-xl text-[11px] font-semibold text-blue-700 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Facture {r.invoice_number}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        grouped.size === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">📁</span>
            </div>
            <p className="text-[14px] font-medium text-gray-500 mb-1">Aucun document</p>
            <p className="text-[12px] text-gray-400">Ajoutez votre premier document via le bouton ci-dessus.</p>
          </div>
        ) : (
          <AnimatedList className="space-y-3">
            {Array.from(grouped.entries()).map(([sub, docs]) => (
              <AnimatedListItem key={sub}>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-50">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">{getSubLabel(sub)}</p>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {docs.map(doc => {
                      const history = historyOf(doc)
                      const isOpen = expandedHistory.has(doc.id)
                      return (
                      <div key={doc.id}>
                        <div className="flex items-center gap-3 px-4 py-3">
                          <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-[10px] font-bold text-gray-500">{fileExt(doc)}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium text-[#111111] truncate">
                              {displayDocName(doc)}
                              {(doc.version ?? 1) > 1 && (
                                <span className="ml-1.5 text-[10px] font-bold text-gray-400">v{doc.version}</span>
                              )}
                            </p>
                            <p className="text-[11px] text-gray-400 flex flex-wrap items-center">
                              {formatDate(doc.created_at)}
                              <StatusBadge doc={doc} />
                              {doc.expiry_date && <ExpiryBadge date={doc.expiry_date} />}
                              {doc.is_auto_generated && (
                                <span className="ml-2 text-blue-400">· Auto-généré</span>
                              )}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button onClick={() => setViewDoc(doc)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100" title="Visualiser">
                              <Eye className="w-4 h-4 text-gray-400" />
                            </button>
                            <button onClick={() => handleShare(doc)} disabled={sharingId === doc.id}
                              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 disabled:opacity-40" title="Partager / Enregistrer dans Fichiers">
                              <Share2 className="w-4 h-4 text-gray-400" />
                            </button>
                            <a href={urlFor(doc)} target="_blank" rel="noopener noreferrer"
                              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100" title="Imprimer">
                              <Printer className="w-4 h-4 text-gray-400" />
                            </a>
                            {!doc.is_auto_generated && (
                              <button onClick={() => setReplaceTarget(doc)} disabled={isPending}
                                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 disabled:opacity-40" title="Remplacer par une nouvelle version">
                                <RefreshCw className="w-4 h-4 text-gray-400" />
                              </button>
                            )}
                            <button onClick={() => handleDelete(doc)} disabled={isPending}
                              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 disabled:opacity-40" title="Supprimer">
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </button>
                          </div>
                        </div>

                        {history.length > 0 && (
                          <div className="px-4 pb-2">
                            <button onClick={() => toggleHistory(doc.id)}
                              className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-400 hover:text-gray-600">
                              <History className="w-3.5 h-3.5" />
                              {history.length} version{history.length > 1 ? 's' : ''} précédente{history.length > 1 ? 's' : ''}
                              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {isOpen && (
                              <div className="mt-1.5 pl-5 border-l-2 border-gray-100 space-y-1.5">
                                {history.map(h => (
                                  <div key={h.id} className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-gray-400 w-7">v{h.version ?? 1}</span>
                                    <span className="text-[11px] text-gray-400 flex-1 min-w-0 truncate">{formatDate(h.created_at)}</span>
                                    <button onClick={() => setViewDoc(h)}
                                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100" title="Visualiser">
                                      <Eye className="w-3.5 h-3.5 text-gray-400" />
                                    </button>
                                    <button onClick={() => handleShare(h)} disabled={sharingId === h.id}
                                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 disabled:opacity-40" title="Partager / Enregistrer dans Fichiers">
                                      <Share2 className="w-3.5 h-3.5 text-gray-400" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      )
                    })}
                  </div>
                </div>
              </AnimatedListItem>
            ))}
          </AnimatedList>
        )
      )}

      <Drawer open={showUpload} onClose={resetUpload} title="Ajouter un document">
        <div>
          <select value={uploadCat} onChange={e => { setUploadCat(e.target.value as DocumentCategory | ''); setUploadSub(''); setEntityId('') }}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-[13px] mb-3">
            <option value="">Catégorie...</option>
            {DOCUMENT_CATEGORIES.filter(c => visibleCats.includes(c.id)).map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>

          {uploadCat && (
            <select value={uploadSub} onChange={e => {
                const sub = e.target.value
                setUploadSub(sub)
                // Pièce client + client déjà choisi → nom généré automatiquement.
                if (uploadCat === 'client' && entityId) setDocName(buildClientDocName(sub, entityId))
              }}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-[13px] mb-3">
              <option value="">Sous-catégorie...</option>
              {DOCUMENT_SUBCATEGORIES[uploadCat].map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          )}

          {uploadCat === 'vehicule' && (
            <select value={entityId} onChange={e => setEntityId(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-[13px] mb-3">
              <option value="">Véhicule concerné (optionnel)...</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.brand} {v.model} · {v.plate}</option>)}
            </select>
          )}
          {uploadCat === 'client' && (
            <select value={entityId} onChange={e => {
                const cid = e.target.value
                setEntityId(cid)
                // Client choisi + sous-catégorie déjà sélectionnée → nom auto.
                if (cid && uploadSub) setDocName(buildClientDocName(uploadSub, cid))
              }} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-[13px] mb-3">
              <option value="">Client concerné (optionnel)...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
            </select>
          )}
          {uploadCat === 'partenaire' && (
            <select value={entityId} onChange={e => setEntityId(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-[13px] mb-3">
              <option value="">Agence partenaire (optionnel)...</option>
              {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}

          <input type="text" placeholder="Nom du document..." value={docName} onChange={e => setDocName(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-[13px] mb-3" />

          <div className="mb-3">
            <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1">Date d'expiration (optionnel)</label>
            <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-[13px]" />
          </div>

          <label className="flex items-center gap-3 border-2 border-dashed border-gray-300 rounded-xl px-4 py-4 cursor-pointer mb-4 hover:border-gray-400">
            <Paperclip className="w-5 h-5 text-gray-400 flex-shrink-0" />
            <span className="text-[13px] text-gray-500 truncate">
              {file ? file.name : 'Sélectionner un fichier (PDF, image...)'}
            </span>
            <input type="file" accept=".pdf,image/*,.doc,.docx" className="hidden"
              onChange={e => setFile(e.target.files?.[0] ?? null)} />
          </label>

          {uploadError && <p className="text-[12px] text-red-500 mb-3">{uploadError}</p>}

          <button onClick={handleUpload} disabled={!file || !docName || !uploadCat || !uploadSub || isPending}
            className="w-full py-4 rounded-2xl bg-[#111111] text-white text-[14px] font-medium disabled:opacity-40 active:scale-[.97]">
            {isPending ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </Drawer>

      <Drawer open={!!replaceTarget} onClose={resetReplace} title="Remplacer par une nouvelle version">
        <div>
          {replaceTarget && (
            <div className="mb-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
              <p className="text-[13px] font-semibold text-[#111111] truncate">{replaceTarget.name}</p>
              <p className="text-[11px] text-gray-400">
                Version actuelle v{replaceTarget.version ?? 1} · sera archivée et conservée dans l&apos;historique.
              </p>
            </div>
          )}

          <div className="mb-3">
            <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1">Nouvelle date d&apos;expiration (optionnel)</label>
            <input type="date" value={replaceExpiry} onChange={e => setReplaceExpiry(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-[13px]" />
          </div>

          <label className="flex items-center gap-3 border-2 border-dashed border-gray-300 rounded-xl px-4 py-4 cursor-pointer mb-4 hover:border-gray-400">
            <Paperclip className="w-5 h-5 text-gray-400 flex-shrink-0" />
            <span className="text-[13px] text-gray-500 truncate">
              {replaceFile ? replaceFile.name : 'Nouveau fichier (PDF, image...)'}
            </span>
            <input type="file" accept=".pdf,image/*,.doc,.docx" className="hidden"
              onChange={e => setReplaceFile(e.target.files?.[0] ?? null)} />
          </label>

          {replaceError && <p className="text-[12px] text-red-500 mb-3">{replaceError}</p>}

          <button onClick={handleReplace} disabled={!replaceFile || isPending}
            className="w-full py-4 rounded-2xl bg-[#111111] text-white text-[14px] font-medium disabled:opacity-40 active:scale-[.97]">
            {isPending ? 'Remplacement...' : 'Créer la nouvelle version'}
          </button>
        </div>
      </Drawer>

      {/* Visualiseur intégré — feuille partielle (≈85 % de l'écran) : on voit le
          document sans quitter l'app, la liste reste visible derrière, et le X
          referme la prévisualisation. */}
      {viewDoc && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center sm:justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setViewDoc(null)} />
          <div className="relative w-full sm:max-w-2xl h-[85vh] sm:h-[80vh] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-100 flex-shrink-0">
              <span className="text-[13px] font-bold text-[#111111] truncate">{displayDocName(viewDoc)}</span>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => handleShare(viewDoc)} disabled={sharingId === viewDoc.id}
                  className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 disabled:opacity-40 text-gray-500" title="Partager">
                  <Share2 className="w-[18px] h-[18px]" />
                </button>
                <button onClick={() => setViewDoc(null)} aria-label="Fermer la prévisualisation"
                  className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500" title="Fermer">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-gray-50 overflow-hidden">
              {viewDoc.file_type?.startsWith('image/') ? (
                <img src={urlFor(viewDoc)} alt={viewDoc.name} className="w-full h-full object-contain" />
              ) : (
                <iframe src={urlFor(viewDoc)} title={viewDoc.name} className="w-full h-full border-0" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
