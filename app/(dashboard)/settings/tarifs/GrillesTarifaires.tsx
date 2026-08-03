'use client'

// ─── L'écran des grilles tarifaires ───────────────────────────────────────────
//
// **Deux présentations, une par taille d'écran** (format validé par Jeff le
// 02/08/2026). Le piège de cet écran est ses neuf valeurs par véhicule : un
// tableau à neuf colonnes ne tient pas sur un téléphone, et le gérant travaille
// dessus. On ne fait donc pas glisser un tableau unique — c'est exactement le
// défaut déjà signalé sur la liste des véhicules.
//
//   · Téléphone : la voiture se déplie, une valeur par ligne, saisie au pouce.
//   · Tablette et ordinateur : tout visible d'un coup, on compare et on corrige
//     dans les cases.
//
// Ce qu'il ne faut pas casser : une case vide efface la valeur, **zéro est une
// valeur valable** (« inclus, sans supplément »). Confondre les deux ferait
// remonter le tarif d'une grille sur une voiture dont le gérant a justement
// voulu qu'elle n'en ait pas.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, ChevronDown, ChevronUp, X, Pencil } from 'lucide-react'
import { useToast } from '@/components/Toast'
import { formatPrice } from '@/lib/utils'
import { CHAMPS_VEHICULE, CHAMPS_GRILLE, type PricingGrid } from '@/lib/pricing/grid'
import type { AgencySettings } from '@/lib/contracts/agency'
import {
  creerGrille, majGrille, supprimerGrille, attacherVehicule, majTarifsVehicule,
} from '@/lib/actions/pricing-grids'

export interface VehiculeTarife {
  id: string
  brand: string
  model: string
  plate: string | null
  pricing_grid_id: string | null
  daily_price: number | null
  price_day_weekend: number | null
  price_weekend_full: number | null
  weekly_price: number | null
  deposit_amount: number | null
  extra_km_price: number | null
  km_included_daily: number | null
  km_included_week: number | null
  unlimited_km_price: number | null
}

interface Props {
  grilles: PricingGrid[]
  vehicules: VehiculeTarife[]
  agence: AgencySettings
}

export default function GrillesTarifaires({ grilles, vehicules, agence }: Props) {
  const router = useRouter()
  const { show: toast } = useToast()
  const [pending, startTransition] = useTransition()
  const [creation, setCreation] = useState(false)
  const [ouvert, setOuvert] = useState<string | null>(null)
  const [ajoutSur, setAjoutSur] = useState<string | null>(null)
  const [edition, setEdition] = useState<string | null>(null)
  /** véhicule → { champ → valeur saisie }, tant que rien n'est enregistré. */
  const [saisies, setSaisies] = useState<Record<string, Record<string, string>>>({})

  const sansGrille = vehicules.filter(v => !v.pricing_grid_id)

  function valeur(v: VehiculeTarife, cle: string): string {
    const enCours = saisies[v.id]?.[cle]
    if (enCours !== undefined) return enCours
    const brute = (v as unknown as Record<string, number | null>)[cle]
    return brute != null ? String(brute) : ''
  }

  function saisir(vehicleId: string, cle: string, val: string) {
    setSaisies(s => ({ ...s, [vehicleId]: { ...(s[vehicleId] ?? {}), [cle]: val } }))
  }

  function enregistrerVehicule(v: VehiculeTarife) {
    const patch = saisies[v.id]
    if (!patch || Object.keys(patch).length === 0) return
    startTransition(async () => {
      const r = await majTarifsVehicule(v.id, patch)
      if (r?.error) { toast(r.error, 'error'); return }
      setSaisies(s => { const c = { ...s }; delete c[v.id]; return c })
      router.refresh()
      toast(`${v.brand} ${v.model} · tarifs enregistrés`)
    })
  }

  function soumettreGrille(e: React.FormEvent<HTMLFormElement>, grilleId?: string) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = grilleId ? await majGrille(grilleId, fd) : await creerGrille(fd)
      if (r?.error) { toast(r.error, 'error'); return }
      setCreation(false); setEdition(null)
      router.refresh()
      toast(grilleId ? 'Grille enregistrée' : 'Grille créée')
    })
  }

  function attacher(vehicleId: string, grilleId: string | null) {
    startTransition(async () => {
      const r = await attacherVehicule(vehicleId, grilleId)
      if (r?.error) { toast(r.error, 'error'); return }
      setAjoutSur(null)
      router.refresh()
      toast(grilleId ? 'Voiture ajoutée à la grille' : 'Voiture retirée de la grille')
    })
  }

  function supprimer(grilleId: string, nom: string, nbVoitures: number) {
    startTransition(async () => {
      const r = await supprimerGrille(grilleId)
      if (r?.error) { toast(r.error, 'error'); return }
      router.refresh()
      toast(nbVoitures > 0
        ? `Grille « ${nom} » supprimée · ${nbVoitures} voiture${nbVoitures > 1 ? 's' : ''} garde${nbVoitures > 1 ? 'nt' : ''} ses tarifs`
        : `Grille « ${nom} » supprimée`)
    })
  }

  const inputCls = 'w-full text-sm border border-gray-200 rounded-lg px-2.5 py-2 text-gray-900 focus:outline-none focus:border-gray-400'
  const labelCls = 'block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1'
  // Texte et marges réduits en dessous du grand écran : c'est ce qui fait tenir
  // neuf colonnes de chiffres dans la largeur d'une tablette sans les couper.
  const caseCls = 'w-full text-xs lg:text-sm border border-gray-200 rounded-lg px-1 lg:px-2 py-1.5 text-gray-900 text-right focus:outline-none focus:border-gray-400'

  return (
    <div className="space-y-4">

      {/* ── Les valeurs communes actuelles, pour comparaison ─────────────────
          Elles viennent des paramètres de l'agence et servent de dernier recours
          pour une voiture sans grille. */}
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
          Sans grille, une voiture retombe sur ces valeurs
        </p>
        <p className="text-xs text-gray-500 mt-1.5">
          Retard {formatPrice(agence.late_hourly_rate)}/h · {formatPrice(agence.late_daily_rate)}/jour ·
          Carburant {formatPrice(agence.fuel_rate_per_liter)}/L · Franchise {formatPrice(agence.insurance_deductible)}
        </p>
      </div>

      {/* ── Les grilles ─────────────────────────────────────────────────────── */}
      {grilles.map(g => {
        const siennes = vehicules.filter(v => v.pricing_grid_id === g.id)
        const libres = vehicules.filter(v => !v.pricing_grid_id)
        return (
          <div key={g.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

            {/* ── En-tête : le nom, puis les quatre valeurs communes EN LECTURE
                Format arrêté par Jeff : on lit la grille d'un coup d'œil, on ne
                la saisit pas en permanence. Le crayon bascule en modification,
                et lui seul montre des cases. */}
            {edition === g.id ? (
              <form onSubmit={e => soumettreGrille(e, g.id)} className="p-4 border-b border-gray-100 space-y-3">
                <input name="name" defaultValue={g.name} required aria-label="Nom de la grille"
                  className="w-full font-black uppercase tracking-wide text-sm border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-gray-400" />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {CHAMPS_GRILLE.map(c => (
                    <div key={c.cle}>
                      <label className={labelCls} htmlFor={`${g.id}-${c.cle}`}>{c.court}</label>
                      <input
                        id={`${g.id}-${c.cle}`} name={c.cle} type="number" step="0.01" min="0" inputMode="decimal"
                        defaultValue={(g as unknown as Record<string, number | null>)[c.cle] ?? ''}
                        placeholder="—" className={caseCls}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setEdition(null)} disabled={pending}
                    className="flex-1 py-2 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600 disabled:opacity-40">
                    Annuler
                  </button>
                  <button type="submit" disabled={pending}
                    className="flex-1 py-2 rounded-lg text-xs font-bold bg-[#111111] text-white disabled:opacity-40">
                    Enregistrer
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <h2 className="flex-1 min-w-0 text-sm font-black uppercase tracking-widest text-gray-900 truncate">
                    {g.name}
                  </h2>
                  <button type="button" onClick={() => setEdition(g.id)}
                    className="p-1.5 text-gray-300 rounded-lg hover:bg-gray-100 hover:text-gray-600 flex-shrink-0 inline-flex items-center justify-center"
                    title="Modifier la grille">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => supprimer(g.id, g.name, siennes.length)}
                    disabled={pending}
                    className="p-1.5 text-gray-300 rounded-lg hover:bg-red-50 hover:text-red-500 flex-shrink-0 inline-flex items-center justify-center"
                    title="Supprimer la grille">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {/* Une valeur par ligne sur téléphone, deux par ligne dès qu'il y
                    a la place. Le libellé à gauche, le montant à droite. */}
                {/* Largeur bornée : sur un grand écran, `justify-between` étalait
                    « Retard/h » et « 25,00 € » aux deux extrémités de la page,
                    avec un vide au milieu. La maquette les montre groupés. */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 mt-2 max-w-xl">
                  {CHAMPS_GRILLE.map(c => {
                    const v = (g as unknown as Record<string, number | null>)[c.cle]
                    return (
                      <div key={c.cle} className="flex items-baseline justify-between gap-2 py-0.5">
                        <span className="text-xs text-gray-500">{c.court}</span>
                        <span className="text-sm font-semibold text-gray-900">
                          {v != null ? `${formatPrice(v)}${c.unite === '€/L' ? '/L' : ''}` : '—'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Les voitures de la grille */}
            <div className="p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-gray-500">
                  {siennes.length} véhicule{siennes.length > 1 ? 's' : ''}
                </span>
                <button type="button" onClick={() => setAjoutSur(ajoutSur === g.id ? null : g.id)}
                  disabled={libres.length === 0}
                  className="inline-flex items-center gap-1 text-xs font-bold text-gray-600 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-50 disabled:opacity-40">
                  <Plus className="w-3.5 h-3.5" /> Ajouter
                </button>
              </div>

              {ajoutSur === g.id && (
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-1.5">
                  {libres.length === 0 ? (
                    <p className="text-xs text-gray-400">Toutes les voitures sont déjà rangées.</p>
                  ) : libres.map(v => (
                    <button type="button" key={v.id} onClick={() => attacher(v.id, g.id)} disabled={pending}
                      className="w-full text-left text-sm px-2.5 py-2 rounded-lg hover:bg-white disabled:opacity-40">
                      {v.brand} {v.model} <span className="text-gray-400 font-mono text-xs">{v.plate}</span>
                    </button>
                  ))}
                </div>
              )}

              {siennes.length === 0 ? (
                <p className="text-xs text-gray-400">
                  Aucune voiture. Ses tarifs communs ne s&apos;appliquent donc à personne.
                </p>
              ) : (
                <>
                  {/* ── TÉLÉPHONE : la voiture se déplie ───────────────────────
                      La bascule se fait à 768 px et non à 1024 : sur tablette,
                      la place existe pour le tableau complet, et le gérant
                      préfère tout voir d'un coup (Jeff, 03/08/2026). */}
                  <div className="md:hidden space-y-2">
                    {siennes.map(v => {
                      const deplie = ouvert === v.id
                      const modifie = Boolean(saisies[v.id] && Object.keys(saisies[v.id]).length)
                      return (
                        <div key={v.id} className="rounded-xl border border-gray-100">
                          <div className="flex items-center gap-2 p-3">
                            <button type="button" onClick={() => setOuvert(deplie ? null : v.id)}
                              className="flex-1 min-w-0 text-left">
                              <span className="block text-sm font-bold text-gray-900 truncate">{v.brand} {v.model}</span>
                              <span className="block text-[11px] font-mono text-gray-400">{v.plate}</span>
                            </button>
                            {deplie
                              ? <ChevronUp className="w-4 h-4 text-gray-300 flex-shrink-0" />
                              : <ChevronDown className="w-4 h-4 text-gray-300 flex-shrink-0" />}
                            <button type="button" onClick={() => attacher(v.id, null)} disabled={pending}
                              className="p-1.5 text-gray-300 rounded-lg hover:bg-red-50 hover:text-red-500 flex-shrink-0 inline-flex items-center justify-center"
                              title="Retirer de la grille">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          {deplie && (
                            <div className="px-3 pb-3 space-y-2">
                              {CHAMPS_VEHICULE.map(c => (
                                <div key={c.cle} className="flex items-center gap-2">
                                  <span className="flex-1 min-w-0 text-xs text-gray-500 truncate">{c.label}</span>
                                  <input
                                    type="number" step="0.01" min="0" inputMode="decimal"
                                    aria-label={`${c.label} · ${v.brand} ${v.model}`}
                                    value={valeur(v, c.cle)}
                                    onChange={e => saisir(v.id, c.cle, e.target.value)}
                                    placeholder="—"
                                    className="w-24 flex-shrink-0 text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-right focus:outline-none focus:border-gray-400"
                                  />
                                  <span className="w-6 flex-shrink-0 text-xs text-gray-400">{c.unite}</span>
                                </div>
                              ))}
                              <button type="button" onClick={() => enregistrerVehicule(v)}
                                disabled={pending || !modifie}
                                className="w-full py-2 rounded-lg text-xs font-bold bg-[#111111] text-white disabled:opacity-40">
                                Enregistrer
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* ── ORDINATEUR : tout visible, on compare ─────────────────
                      Le conteneur défile horizontalement au besoin, mais chaque
                      colonne garde une largeur FIXE : les lignes restent alignées
                      quelle que soit la longueur des nombres. */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr>
                          {/* Colonnes plus serrées sur tablette qu'en grand
                              écran : à 820 px, « 10 000 » se coupait dans sa
                              case (Jeff, 03/08/2026). Largeurs FIXES dans les
                              deux cas, pour que les lignes restent alignées. */}
                          <th className="text-left text-[10px] font-bold uppercase tracking-wide text-gray-400 pb-2 pr-2 w-[120px] lg:w-[180px]">Véhicule</th>
                          {CHAMPS_VEHICULE.map(c => (
                            <th key={c.cle} className="text-right text-[10px] font-bold uppercase tracking-wide text-gray-400 pb-2 px-0.5 lg:px-1 w-[62px] lg:w-[92px]">
                              {c.court}
                            </th>
                          ))}
                          <th className="w-[70px] lg:w-[92px]" />
                        </tr>
                      </thead>
                      <tbody>
                        {siennes.map(v => {
                          const modifie = Boolean(saisies[v.id] && Object.keys(saisies[v.id]).length)
                          return (
                            <tr key={v.id} className="border-t border-gray-50">
                              <td className="py-2 pr-2 w-[120px] lg:w-[180px]">
                                <span className="block text-sm font-semibold text-gray-900 truncate">{v.brand} {v.model}</span>
                                <span className="block text-[11px] font-mono text-gray-400 truncate">{v.plate}</span>
                              </td>
                              {CHAMPS_VEHICULE.map(c => (
                                <td key={c.cle} className="py-2 px-0.5 lg:px-1 w-[62px] lg:w-[92px]">
                                  <input
                                    type="number" step="0.01" min="0" inputMode="decimal"
                                    aria-label={`${c.label} · ${v.brand} ${v.model}`}
                                    value={valeur(v, c.cle)}
                                    onChange={e => saisir(v.id, c.cle, e.target.value)}
                                    placeholder="—"
                                    className={caseCls}
                                  />
                                </td>
                              ))}
                              <td className="py-2 pl-1 w-[70px] lg:w-[92px]">
                                <div className="flex items-center gap-1 justify-end">
                                  <button type="button" onClick={() => enregistrerVehicule(v)}
                                    disabled={pending || !modifie}
                                    className="px-2 py-1.5 rounded-lg text-xs font-bold bg-[#111111] text-white disabled:opacity-30">
                                    OK
                                  </button>
                                  <button type="button" onClick={() => attacher(v.id, null)} disabled={pending}
                                    className="p-1.5 text-gray-300 rounded-lg hover:bg-red-50 hover:text-red-500 inline-flex items-center justify-center"
                                    title="Retirer de la grille">
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        )
      })}

      {/* ── Créer une grille ────────────────────────────────────────────────── */}
      {creation ? (
        <form onSubmit={e => soumettreGrille(e)} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <div>
            <label className={labelCls} htmlFor="nouvelle-grille">Nom de la grille</label>
            <input id="nouvelle-grille" name="name" required placeholder="Ex : Sportive" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {CHAMPS_GRILLE.map(c => (
              <div key={c.cle}>
                <label className={labelCls} htmlFor={`new-${c.cle}`}>{c.court}</label>
                <input id={`new-${c.cle}`} name={c.cle} type="number" step="0.01" min="0" inputMode="decimal"
                  placeholder="—" className={caseCls} />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setCreation(false)} disabled={pending}
              className="flex-1 py-2 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600 disabled:opacity-40">
              Annuler
            </button>
            <button type="submit" disabled={pending}
              className="flex-1 py-2 rounded-lg text-xs font-bold bg-[#111111] text-white disabled:opacity-40">
              Créer la grille
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setCreation(true)}
          className="flex items-center justify-center gap-2 w-full py-3.5 bg-[#111111] text-white rounded-2xl font-bold text-sm hover:bg-gray-800 transition-colors active:scale-[.99]">
          <Plus className="w-4 h-4" /> Créer une grille
        </button>
      )}

      {/* ── Les voitures qui n'appartiennent à aucune grille ─────────────────
          Elles facturent leurs propres valeurs, exactement comme avant : c'est
          voulu, et c'est ce qui fait qu'aucune facture ne change le jour de la
          livraison. */}
      {sansGrille.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
            Sans grille · {sansGrille.length}
          </p>
          <p className="text-xs text-gray-400 mt-1 mb-2">
            Ces voitures facturent leurs propres tarifs. Rien ne change tant qu&apos;on ne les
            range pas dans une grille.
          </p>
          <div className="space-y-1">
            {sansGrille.map(v => (
              <p key={v.id} className="text-sm text-gray-700">
                {v.brand} {v.model} <span className="text-gray-400 font-mono text-xs">{v.plate}</span>
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
