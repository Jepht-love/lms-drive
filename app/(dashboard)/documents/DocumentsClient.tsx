'use client'

import { useState, useTransition, useMemo } from 'react'
import {
  MagnifyingGlassIcon,
  EyeIcon,
  ArrowDownTrayIcon,
  EnvelopeIcon,
  PlusIcon,
  PaperClipIcon,
  XMarkIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_SUBCATEGORIES,
  SENSITIVE_SUBCATEGORIES,
  isExpiringSoon,
  type DocumentCategory,
} from '@/lib/documents/categories'
import Drawer from '@/components/Drawer'
import { AnimatedList, AnimatedListItem } from '@/components/AnimatedList'
import { uploadDocument, deleteDocument, sendDocumentByEmail } from '@/lib/actions/documents'
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
}

type Vehicle  = { id: string; plate: string; brand: string; model: string }
type Client   = { id: string; first_name: string; last_name: string }
type Partner  = { id: string; name: string }

interface Props {
  documents: Document[]
  vehicles:  Vehicle[]
  clients:   Client[]
  partners:  Partner[]
  userRole:  string
  visibleCategories?: string[]
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

export default function DocumentsClient({ documents, vehicles, clients, partners, userRole, visibleCategories }: Props) {
  const allCatIds = ['entreprise', 'vehicule', 'client', 'partenaire']
  const visibleCats = visibleCategories ?? allCatIds
  const categoryTabs = ['all', ...visibleCats] as ('all' | DocumentCategory)[]
  const [category,    setCategory]    = useState<'all' | DocumentCategory>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showUpload,  setShowUpload]  = useState(false)
  const [emailDoc,    setEmailDoc]    = useState<Document | null>(null)
  const [isPending,   startTransition] = useTransition()

  // Upload form state
  const [uploadCat,    setUploadCat]    = useState<DocumentCategory | ''>('')
  const [uploadSub,    setUploadSub]    = useState('')
  const [entityId,     setEntityId]     = useState('')
  const [docName,      setDocName]      = useState('')
  const [expiryDate,   setExpiryDate]   = useState('')
  const [file,         setFile]         = useState<File | null>(null)
  const [uploadError,  setUploadError]  = useState('')

  // Email form state
  const [recipientEmail, setRecipientEmail] = useState('')
  const [emailMessage,   setEmailMessage]   = useState('')
  const [emailError,     setEmailError]     = useState('')
  const [emailSent,      setEmailSent]      = useState(false)

  const canSeeSensitive = ['gerant', 'associe'].includes(userRole)

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase()
    return documents.filter(doc => {
      if (!canSeeSensitive && SENSITIVE_SUBCATEGORIES.includes(doc.subcategory)) return false
      if (category !== 'all' && doc.category !== category) return false
      if (!q) return true
      return (
        doc.name.toLowerCase().includes(q) ||
        doc.subcategory.toLowerCase().includes(q) ||
        doc.tags?.some(t => t.toLowerCase().includes(q))
      )
    })
  }, [documents, category, searchQuery, canSeeSensitive])

  // Group by subcategory
  const grouped = useMemo(() => {
    const map = new Map<string, Document[]>()
    for (const doc of filtered) {
      const key = doc.subcategory
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(doc)
    }
    return map
  }, [filtered])

  function getCategoryLabel(cat: string) {
    if (cat === 'all') return `Tous (${documents.filter(d => canSeeSensitive || !SENSITIVE_SUBCATEGORIES.includes(d.subcategory)).length})`
    const found = DOCUMENT_CATEGORIES.find(c => c.id === cat)
    if (!found) return cat
    const count = documents.filter(d => d.category === cat && (canSeeSensitive || !SENSITIVE_SUBCATEGORIES.includes(d.subcategory))).length
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

  function resetEmail() {
    setRecipientEmail(''); setEmailMessage(''); setEmailError(''); setEmailSent(false)
    setEmailDoc(null)
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

  async function handleSendEmail() {
    if (!emailDoc || !recipientEmail) return
    setEmailError('')
    startTransition(async () => {
      try {
        await sendDocumentByEmail(emailDoc.id, recipientEmail, emailMessage || undefined)
        setEmailSent(true)
      } catch (e: any) { setEmailError(e.message ?? 'Erreur envoi') }
    })
  }

  async function handleDelete(doc: Document) {
    if (!confirm(`Supprimer « ${doc.name} » ?`)) return
    startTransition(async () => {
      try { await deleteDocument(doc.id) }
      catch (e: any) { alert(e.message) }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-gray-900">Documents</h1>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-[#111111] text-white rounded-xl font-semibold text-sm active:scale-[.97]"
        >
          <PlusIcon className="w-4 h-4" /> Ajouter
        </button>
      </div>

      {/* Tabs catégorie */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {categoryTabs.map(cat => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`flex-shrink-0 text-[12px] font-medium px-4 py-2 rounded-2xl transition-colors ${
              category === cat
                ? 'bg-[#111111] text-white'
                : 'bg-white border border-gray-200 text-gray-600'
            }`}
          >
            {getCategoryLabel(cat)}
          </button>
        ))}
      </div>

      {/* Recherche */}
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="search"
          placeholder="Rechercher un document, un véhicule, un client..."
          className="w-full pl-9 pr-4 py-3 bg-white rounded-2xl border border-gray-200 text-[13px] text-gray-700 placeholder-gray-400"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Liste groupée */}
      {grouped.size === 0 ? (
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
              {docs.map(doc => (
                <div key={doc.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-bold text-gray-500">{fileExt(doc)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[#111111] truncate">{doc.name}</p>
                    <p className="text-[11px] text-gray-400 flex flex-wrap items-center">
                      {formatDate(doc.created_at)}
                      {doc.expiry_date && <ExpiryBadge date={doc.expiry_date} />}
                      {doc.is_auto_generated && (
                        <span className="ml-2 text-blue-400">· Auto-généré</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100"
                    >
                      <EyeIcon className="w-4 h-4 text-gray-400" />
                    </a>
                    <a
                      href={doc.file_url}
                      download
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100"
                    >
                      <ArrowDownTrayIcon className="w-4 h-4 text-gray-400" />
                    </a>
                    <button
                      onClick={() => { setEmailDoc(doc); setEmailSent(false) }}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100"
                    >
                      <EnvelopeIcon className="w-4 h-4 text-gray-400" />
                    </button>
                    {!doc.is_auto_generated && (
                      <button
                        onClick={() => handleDelete(doc)}
                        disabled={isPending}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 disabled:opacity-40"
                      >
                        <TrashIcon className="w-4 h-4 text-red-400" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          </AnimatedListItem>
        ))}
        </AnimatedList>
      )}

      {/* ── Drawer Upload ─────────────────────────────────────── */}
      <Drawer open={showUpload} onClose={resetUpload} title="Ajouter un document">
        <div>

            <select
              value={uploadCat}
              onChange={e => { setUploadCat(e.target.value as DocumentCategory | ''); setUploadSub(''); setEntityId('') }}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-[13px] mb-3"
            >
              <option value="">Catégorie...</option>
              {DOCUMENT_CATEGORIES.filter(c => visibleCats.includes(c.id)).map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>

            {uploadCat && (
              <select
                value={uploadSub}
                onChange={e => setUploadSub(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-[13px] mb-3"
              >
                <option value="">Sous-catégorie...</option>
                {DOCUMENT_SUBCATEGORIES[uploadCat].map(s => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
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

            <input
              type="text"
              placeholder="Nom du document..."
              value={docName}
              onChange={e => setDocName(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-[13px] mb-3"
            />

            <div className="mb-3">
              <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1">Date d'expiration (optionnel)</label>
              <input
                type="date"
                value={expiryDate}
                onChange={e => setExpiryDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-[13px]"
              />
            </div>

            <label className="flex items-center gap-3 border-2 border-dashed border-gray-300 rounded-xl px-4 py-4 cursor-pointer mb-4 hover:border-gray-400">
              <PaperClipIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <span className="text-[13px] text-gray-500 truncate">
                {file ? file.name : 'Sélectionner un fichier (PDF, image...)'}
              </span>
              <input
                type="file"
                accept=".pdf,image/*,.doc,.docx"
                className="hidden"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
              />
            </label>

            {uploadError && <p className="text-[12px] text-red-500 mb-3">{uploadError}</p>}

            <button
              onClick={handleUpload}
              disabled={!file || !docName || !uploadCat || !uploadSub || isPending}
              className="w-full py-4 rounded-2xl bg-[#111111] text-white text-[14px] font-medium disabled:opacity-40 active:scale-[.97]"
            >
              {isPending ? 'Enregistrement...' : 'Enregistrer'}
            </button>
        </div>
      </Drawer>

      {/* ── Drawer Email ──────────────────────────────────────── */}
      <Drawer open={!!emailDoc} onClose={resetEmail} title="Envoyer par email">
        <div>
            <p className="text-[12px] text-gray-400 mb-4 truncate">{emailDoc?.name}</p>

            {emailSent ? (
              <div className="py-8 text-center">
                <p className="text-[15px] font-semibold text-green-600 mb-1">Email envoyé ✓</p>
                <p className="text-[12px] text-gray-400">Le document a été transmis à {recipientEmail}</p>
                <button onClick={resetEmail} className="mt-4 text-[13px] text-gray-500 underline">Fermer</button>
              </div>
            ) : (
              <>
                <input
                  type="email"
                  placeholder="Adresse email destinataire..."
                  value={recipientEmail}
                  onChange={e => setRecipientEmail(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-[13px] mb-3"
                />
                <textarea
                  placeholder="Message (optionnel)..."
                  rows={3}
                  value={emailMessage}
                  onChange={e => setEmailMessage(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-[13px] mb-4 resize-none"
                />
                {emailError && <p className="text-[12px] text-red-500 mb-3">{emailError}</p>}
                <button
                  onClick={handleSendEmail}
                  disabled={!recipientEmail || isPending}
                  className="w-full py-4 rounded-2xl bg-[#111111] text-white text-[14px] font-medium disabled:opacity-40 active:scale-[.97]"
                >
                  {isPending ? 'Envoi...' : 'Envoyer'}
                </button>
              </>
            )}
        </div>
      </Drawer>
    </div>
  )
}
