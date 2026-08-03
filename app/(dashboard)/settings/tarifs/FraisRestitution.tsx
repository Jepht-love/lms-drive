'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronRight, ScrollText, Plus, Trash2, ArrowUp, ArrowDown, Check, RotateCcw, Lock, AlertTriangle, Pencil } from 'lucide-react'
import { useToast } from '@/components/Toast'
import { valeurImprimee, type PosteFrais, type ScopeFrais } from '@/lib/contracts/frais-restitution'
import {
  reprendreContratType, ajouterPoste, majPoste, retirerPoste, remettrePoste, deplacerPoste,
} from '@/lib/actions/restitution-fees'

/**
 * La grille des frais de restitution, celle qui s'imprime au contrat.
 *
 * Deux listes, comme le contrat papier : les sportives et le reste du parc.
 * Tant qu'une liste n'a pas été reprise en main, elle s'affiche en lecture et
 * le contrat imprime le modèle écrit dans le code — c'est ce qui garantit
 * qu'aucun montant ne bouge le jour de la livraison.
 *
 * ⚠️ Ce qu'il ne faut pas casser :
 * - **Les franchises et le retard restent en lecture**, avec leur cadenas. Leur
 *   montant vient de la grille tarifaire du véhicule : les rendre saisissables
 *   ferait afficher deux chiffres contradictoires sur le même contrat.
 * - **Retirer un poste relié à un constat de dommage** (rayure, jante,
 *   pare-brise, pneu) prive ce dommage de son tarif automatique dans la facture
 *   de restitution. L'avertissement avant suppression n'est pas décoratif.
 * - Rien ne s'efface : un poste retiré descend dans « Postes retirés ».
 */
export interface BlocFrais {
  scope: ScopeFrais
  titre: string
  /** La liste a été reprise en main : elle vit en base et s'édite. */
  personnalise: boolean
  postes: PosteFrais[]
  corbeille: PosteFrais[]
  /** Valeurs de référence des postes pilotés par la grille tarifaire. */
  franchiseTxt: string
  retardTxt: string
}

export default function FraisRestitution({ blocs }: { blocs: BlocFrais[] }) {
  const router = useRouter()
  const { show: toast } = useToast()
  const [pending, startTransition] = useTransition()
  const [ouvert, setOuvert] = useState<ScopeFrais | null>(null)
  const [corbeilleOuverte, setCorbeilleOuverte] = useState<ScopeFrais | null>(null)
  /** poste → champ → valeur saisie, tant que rien n'est enregistré. */
  const [saisies, setSaisies] = useState<Record<string, Record<string, string>>>({})
  /** poste dont la suppression attend une confirmation. */
  const [aRetirer, setARetirer] = useState<string | null>(null)

  function valeur(p: PosteFrais, cle: 'label' | 'amount' | 'note'): string {
    const enCours = saisies[p.id!]?.[cle]
    if (enCours !== undefined) return enCours
    if (cle === 'amount') return p.amount != null ? String(p.amount) : ''
    return (p[cle] as string | null) ?? ''
  }

  function saisir(id: string, cle: string, val: string) {
    setSaisies(s => ({ ...s, [id]: { ...(s[id] ?? {}), [cle]: val } }))
  }

  function enregistrer(p: PosteFrais) {
    const patch = saisies[p.id!]
    if (!patch || Object.keys(patch).length === 0) return
    startTransition(async () => {
      const r = await majPoste(p.id!, {
        label: patch.label,
        note: patch.note,
        amount: patch.amount !== undefined
          ? (patch.amount.trim() === '' ? null : Number(patch.amount.replace(',', '.')))
          : undefined,
      })
      if (r?.error) { toast(r.error, 'error'); return }
      setSaisies(s => { const c = { ...s }; delete c[p.id!]; return c })
      router.refresh()
      toast('Poste enregistré')
    })
  }

  function action(fn: () => Promise<{ error?: string } | void>, message: string) {
    startTransition(async () => {
      const r = await fn()
      if (r && 'error' in r && r.error) { toast(r.error, 'error'); return }
      setARetirer(null)
      router.refresh()
      toast(message)
    })
  }

  const champ = 'text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-900 focus:outline-none focus:border-gray-400'
  const bouton = 'p-1.5 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-40'

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-start gap-2.5">
        <ScrollText className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-900">
            Frais de restitution
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Ce que le locataire signe au contrat. Un contrat déjà signé garde ses montants ;
            seuls les contrats à venir suivent tes changements.
          </p>
        </div>
      </div>

      {blocs.map(bloc => {
        const estOuvert = ouvert === bloc.scope
        return (
          <div key={bloc.scope} className="border-b border-gray-100 last:border-b-0">
            {/* Même en-tête que les grilles tarifaires (Jeff, 03/08/2026) : le
                crayon se voit sans rien déplier. Il vivait avant sous les 27
                lignes, sous forme de bouton, et personne ne le trouvait. */}
            <div className="w-full flex items-center gap-2 px-4 py-3">
              <button
                type="button"
                onClick={() => setOuvert(estOuvert ? null : bloc.scope)}
                className="flex-1 min-w-0 flex items-center gap-2 text-left -my-1 py-1"
              >
                {estOuvert
                  ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                <span className="text-sm font-bold text-gray-900 flex-1 min-w-0 truncate">{bloc.titre}</span>
                {!bloc.personnalise && (
                  <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full flex-shrink-0">
                    Contrat type
                  </span>
                )}
                <span className="text-[11px] text-gray-400 flex-shrink-0 w-[70px] text-right">
                  {bloc.postes.length} postes
                </span>
              </button>
              {/* Le crayon reste affiché même quand la liste est déjà reprise en
                  main : sinon le bloc d'à côté perdrait son alignement, et rien
                  ne dirait plus qu'elle se modifie. Sur une liste déjà reprise
                  il déplie, sans rien réécrire. */}
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setOuvert(bloc.scope)
                  if (!bloc.personnalise) {
                    action(() => reprendreContratType(bloc.scope), 'Liste reprise, tu peux la modifier')
                  }
                }}
                className="w-7 flex-shrink-0 p-1.5 text-gray-300 rounded-lg hover:bg-gray-100 hover:text-gray-600 inline-flex items-center justify-center disabled:opacity-40"
                title="Modifier ces frais"
              >
                <Pencil className="w-4 h-4" />
              </button>
            </div>

            {estOuvert && (
              <div className="px-4 pb-4">
                {!bloc.personnalise ? (
                  <>
                    {bloc.postes.map((p, i) => (
                      <div key={i} className="flex flex-col sm:flex-row sm:items-start gap-0.5 sm:gap-3 py-2 border-b border-gray-50">
                        <span className="text-xs text-gray-500 sm:text-gray-600 sm:flex-1 sm:min-w-0">{p.label}</span>
                        {/* Même mise en forme que le contrat : « 5 000 € », jamais « 5000 € ». */}
                        <span className="text-xs font-bold text-gray-900 sm:w-[240px] lg:w-[340px] sm:flex-shrink-0 sm:text-right">
                          {valeurImprimee(p, { franchiseTxt: bloc.franchiseTxt, retardTxt: bloc.retardTxt })}
                        </span>
                      </div>
                    ))}
                  </>
                ) : (
                  <>
                    {bloc.postes.map((p, i) => {
                      const modifie = Boolean(saisies[p.id!] && Object.keys(saisies[p.id!]).length)
                      const pilote = Boolean(p.source)
                      return (
                        <div key={p.id} className="py-2 border-b border-gray-50">
                          <div className="flex flex-col md:flex-row md:items-center gap-2">
                            <input
                              value={valeur(p, 'label')}
                              onChange={e => saisir(p.id!, 'label', e.target.value)}
                              aria-label="Nom du poste"
                              className={`${champ} md:flex-1 md:min-w-0`}
                            />
                            <div className="flex items-center gap-2 md:flex-shrink-0">
                              {/* Largeur fixe identique pour tous les postes, pilotés
                                  par la grille ou non : sans elle, les boutons d'une
                                  ligne de franchise ne tombaient pas à l'aplomb des
                                  autres. */}
                              <div className="flex items-center gap-2 flex-1 min-w-0 md:flex-none md:w-[342px]">
                              {pilote ? (
                                <span className="flex items-center gap-1.5 text-xs font-bold text-gray-900 min-w-0">
                                  <Lock className="w-3 h-3 text-gray-300 flex-shrink-0" />
                                  <span className="truncate">
                                    {p.source === 'franchise' ? bloc.franchiseTxt : bloc.retardTxt}
                                  </span>
                                </span>
                              ) : (
                                <>
                                  <input
                                    value={valeur(p, 'amount')}
                                    onChange={e => saisir(p.id!, 'amount', e.target.value)}
                                    inputMode="decimal"
                                    placeholder="—"
                                    aria-label="Montant en euros"
                                    className={`${champ} w-[76px] flex-shrink-0 text-right`}
                                  />
                                  <span className="text-xs text-gray-400 w-[10px] flex-shrink-0">€</span>
                                  <input
                                    value={valeur(p, 'note')}
                                    onChange={e => saisir(p.id!, 'note', e.target.value)}
                                    placeholder="précision (« par heure », « sur devis »…)"
                                    aria-label="Précision"
                                    className={`${champ} flex-1 min-w-0`}
                                  />
                                </>
                              )}
                              </div>
                              <button
                                type="button" disabled={!modifie || pending}
                                onClick={() => enregistrer(p)}
                                aria-label="Enregistrer ce poste"
                                className={`w-[34px] h-[30px] flex-shrink-0 rounded-lg text-[11px] font-bold transition-colors ${
                                  modifie ? 'bg-[#111111] text-white hover:bg-gray-800' : 'bg-gray-100 text-gray-300'
                                }`}
                              >
                                {modifie ? 'OK' : <Check className="w-3.5 h-3.5 mx-auto" />}
                              </button>
                              <button type="button" disabled={pending} className={bouton}
                                aria-label="Monter ce poste"
                                onClick={() => action(() => deplacerPoste(p.id!, 'haut'), 'Ordre modifié')}>
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button type="button" disabled={pending} className={bouton}
                                aria-label="Descendre ce poste"
                                onClick={() => action(() => deplacerPoste(p.id!, 'bas'), 'Ordre modifié')}>
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                              <button type="button" disabled={pending}
                                aria-label="Retirer ce poste"
                                onClick={() => setARetirer(aRetirer === p.id ? null : p.id!)}
                                className={`${bouton} hover:text-red-500`}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {aRetirer === p.id && (
                            <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                              <span className="flex items-start gap-2 text-[11px] text-amber-800 flex-1 min-w-0">
                                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                                {p.damageKey
                                  ? "Ce poste tarife un dommage constaté à l'état des lieux. Retiré, ce dommage arrivera sans prix dans la facture."
                                  : 'Le poste descend dans « Postes retirés », tu pourras le remettre.'}
                              </span>
                              <div className="flex gap-2 flex-shrink-0">
                                <button type="button" onClick={() => setARetirer(null)}
                                  className="px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-amber-200 text-amber-800">
                                  Annuler
                                </button>
                                <button type="button" disabled={pending}
                                  onClick={() => action(() => retirerPoste(p.id!), 'Poste retiré')}
                                  className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-amber-600 text-white disabled:opacity-40">
                                  Retirer
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}

                    <button
                      type="button" disabled={pending}
                      onClick={() => action(() => ajouterPoste(bloc.scope), 'Poste ajouté')}
                      className="mt-3 flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      <Plus className="w-3.5 h-3.5" /> Ajouter un poste
                    </button>

                    {bloc.corbeille.length > 0 && (
                      <div className="mt-4 border-t border-gray-100 pt-3">
                        <button
                          type="button"
                          onClick={() => setCorbeilleOuverte(corbeilleOuverte === bloc.scope ? null : bloc.scope)}
                          className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-gray-400 hover:text-gray-600"
                        >
                          {corbeilleOuverte === bloc.scope
                            ? <ChevronDown className="w-3.5 h-3.5" />
                            : <ChevronRight className="w-3.5 h-3.5" />}
                          Postes retirés · {bloc.corbeille.length}
                        </button>
                        {corbeilleOuverte === bloc.scope && (
                          <div className="mt-2">
                            {bloc.corbeille.map(p => (
                              <div key={p.id} className="flex items-center gap-3 py-1.5">
                                <span className="text-xs text-gray-400 flex-1 min-w-0 truncate line-through">{p.label}</span>
                                <button
                                  type="button" disabled={pending}
                                  onClick={() => action(() => remettrePoste(p.id!), 'Poste remis dans la liste')}
                                  className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-600 hover:text-gray-900 flex-shrink-0"
                                >
                                  <RotateCcw className="w-3 h-3" /> Remettre
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
