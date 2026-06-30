'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, ShieldCheck, FolderArchive, LayoutDashboard } from 'lucide-react'
import { APP_TABS, ALL_TAB_KEYS } from '@/lib/navigation/tabs'
import { DOCUMENT_CATEGORIES } from '@/lib/documents/categories'
import Toggle from '@/components/ui/Toggle'

const ALL_DOC_KEYS = DOCUMENT_CATEGORIES.map(c => c.id as string)

interface Props {
  memberId: string
  role: string
  initialTabs: string[] | null
  initialDocCategories: string[] | null
  initialCanViewFleet: boolean
}

export default function MemberTabsEditor({
  memberId, role, initialTabs, initialDocCategories, initialCanViewFleet,
}: Props) {
  const router = useRouter()
  const [tabs, setTabs] = useState<string[]>(initialTabs ?? ALL_TAB_KEYS)
  const [docCats, setDocCats] = useState<string[]>(initialDocCategories ?? ALL_DOC_KEYS)
  const [canViewFleet, setCanViewFleet] = useState<boolean>(initialCanViewFleet)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggle(key: string) {
    setTabs(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }
  function toggleDoc(key: string) {
    setDocCats(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  async function save() {
    setSaving(true); setError(null)
    try {
      const res = await fetch(`/api/team/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          allowed_tabs: tabs,
          allowed_doc_categories: docCats,
          can_view_fleet: canViewFleet,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data?.error) throw new Error(data?.error ?? "Échec de l'enregistrement")
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
      router.refresh()
    } catch (e: any) {
      setError(e?.message ?? 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-indigo-600" />
        <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">Permissions du membre</p>
      </div>

      {/* Onglets accessibles */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Onglets accessibles</p>
          <button
            type="button"
            onClick={() => setTabs(tabs.length === ALL_TAB_KEYS.length ? [] : ALL_TAB_KEYS)}
            className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700"
          >
            {tabs.length === ALL_TAB_KEYS.length ? 'Tout décocher' : 'Tout cocher'}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {APP_TABS.map(t => {
            const on = tabs.includes(t.key)
            return (
              <button
                key={t.key} type="button"
                onClick={() => toggle(t.key)}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl border-2 text-left transition-all ${
                  on ? 'border-black bg-black text-white' : 'border-gray-100 bg-gray-50 text-gray-700 hover:border-gray-200'
                }`}
              >
                <span className="text-sm font-semibold">{t.label}</span>
                {on && (
                  <div className="w-4 h-4 bg-white rounded-full flex items-center justify-center flex-shrink-0">
                    <div className="w-2 h-2 bg-black rounded-full" />
                  </div>
                )}
              </button>
            )
          })}
        </div>
        {tabs.length === 0 && (
          <p className="text-xs font-semibold text-amber-600">Aucun onglet coché — le membre n&apos;aura accès à aucune section.</p>
        )}
      </div>

      {/* Catégories de documents */}
      <div className="space-y-2 pt-1 border-t border-gray-50">
        <div className="flex items-center gap-2 pt-3">
          <FolderArchive className="w-3.5 h-3.5 text-gray-400" />
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Documents visibles</p>
        </div>
        <p className="text-xs text-gray-400">Catégories de la bibliothèque documentaire accessibles à ce membre.</p>
        <div className="grid grid-cols-2 gap-2">
          {DOCUMENT_CATEGORIES.map(c => {
            const on = docCats.includes(c.id)
            return (
              <button
                key={c.id} type="button"
                onClick={() => toggleDoc(c.id)}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl border-2 text-left transition-all ${
                  on ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-100 bg-gray-50 text-gray-700 hover:border-gray-200'
                }`}
              >
                <span className="text-sm font-semibold">{c.label}</span>
                {on && (
                  <div className="w-4 h-4 bg-white rounded-full flex items-center justify-center flex-shrink-0">
                    <div className="w-2 h-2 bg-indigo-600 rounded-full" />
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Bloc Flotte (dashboard) */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-50">
        <div className="flex items-center gap-2 min-w-0">
          <LayoutDashboard className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-700">Bloc « Flotte » du tableau de bord</p>
            <p className="text-xs text-gray-400">Compteurs parc, disponibles, immobilisés.</p>
          </div>
        </div>
        <Toggle checked={canViewFleet} onChange={setCanViewFleet} />
      </div>

      {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      <button
        onClick={save}
        disabled={saving}
        className={`w-full flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 ${
          saved ? 'bg-green-100 text-green-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'
        }`}
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
        {saved ? 'Enregistré ✓' : 'Enregistrer les permissions'}
      </button>
    </div>
  )
}
