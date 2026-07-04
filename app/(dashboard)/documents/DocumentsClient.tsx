'use client'

import { useState, useTransition, useMemo } from 'react'
import { Search, Eye, Download, Printer, Plus, Paperclip, Trash2, RefreshCw, History, ChevronDown } from 'lucide-react'
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
  option:    'Option',
  confirmee: 'Confirmée',
  en_cours:  'En cours',
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
      if (!canSeeSensitive && SENSITIVE_SUBCATEGORIES.includes(doc.subcategory)) return false
      if (category !== 'all' && category !== 'reservations' && doc.category !== category) return false
      if (!q) return true
      return (
        doc.name.toLowerCase().includes(q) ||
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
    const q = searchQuery.toLowerCase()
    return reservationDocs.filter(r =>
      r.reservation_number.toLowerCase().includes(q) ||
      r.client_name.toLowerCase().includes(q) ||
      r.vehicle_label.toLowerCase().includes(q)
    )
  }, [reservationDocs, searchQuery])

  function getCategoryLabel(cat: string) {
    const current = documents.filter(d => d.is_current !== false)
    if (cat === 'all') return `Tous (${current.filter(d => canSeeSensitive || !SENSITIVE_SUBCATEGORIES.includes(d.subcategory)).length})`
    if (cat === 'reservations') return `Réservations (${reservationDocs.length})`
    const found = DOCUMENT_CATEGORIES.find(c => c.id === cat)
    if (!found) return cat
    const count = current.filter(d => d.category === cat && (canSeeSensitive || !SENSITIVE_SUBCATEGORIES.includes(d.subcategory))).length
    return `${found.label} (${count})`
  }

  function getSubLabel(sub: string) {
    for (const cat of Object.values(DOCUMENT_SUBCATEGORIES)) {
      const found = cat.find(s => s.id === sub)
      if (found) return found.label
    }
    return sub
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
    if (!confirm(`Supprimer « ${doc.name} » ?`)) return
    startTransition(async () => {
      try { await deleteDocument(doc.id) }
      catch (e: any) { alert(e.message) }
    })
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
                    <p className="text-[13px] font-bold text-[#111111]">{r.reservation_number}</p>
                    <p className="text-[11px] text-gray-500 truncate">{r.client_name}</p>
                    <p className="text-[11px] text-gray-400 truncate">{r.vehicle_label}</p>
                    <p className="text-[11px] text-gray-400">
                      {fmtDate(r.start_datetime)} → {fmtDate(r.end_datetime)}
                    </p>
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
                      Contrat {r.contract_number}
                    </a>
                  ) : (
                    <span className="text-[11px] text-gray-300 italic">
                      {r.contract_number ? `${r.contract_number} — PDF non généré` : 'Aucun contrat'}
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
                              {doc.name}
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
                            <a href={urlFor(doc)} target="_blank" rel="noopener noreferrer"
                              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100" title="Visualiser">
                              <Eye className="w-4 h-4 text-gray-400" />
                            </a>
                            <a href={urlFor(doc)} download target="_blank" rel="noopener noreferrer"
                              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100" title="Télécharger">
                              <Download className="w-4 h-4 text-gray-400" />
                            </a>
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
                            {!doc.is_auto_generated && (
                              <button onClick={() => handleDelete(doc)} disabled={isPending}
                                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 disabled:opacity-40">
                                <Trash2 className="w-4 h-4 text-red-400" />
                              </button>
                            )}
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
                                    <a href={urlFor(h)} target="_blank" rel="noopener noreferrer"
                                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100" title="Visualiser">
                                      <Eye className="w-3.5 h-3.5 text-gray-400" />
                                    </a>
                                    <a href={urlFor(h)} download target="_blank" rel="noopener noreferrer"
                                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100" title="Télécharger">
                                      <Download className="w-3.5 h-3.5 text-gray-400" />
                                    </a>
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
            <select value={uploadSub} onChange={e => setUploadSub(e.target.value)}
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
            <select value={entityId} onChange={e => setEntityId(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-[13px] mb-3">
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
    </div>
  )
}
