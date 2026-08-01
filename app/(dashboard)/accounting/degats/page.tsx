import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Wrench, AlertTriangle } from 'lucide-react'
import BackButton from '@/components/ui/BackButton'
import { formatPrice } from '@/lib/utils'
import { periodRange } from '@/lib/accounting/categories'
import { damageTypeLabel } from '@/lib/vehicles/damage-catalog'
import type { MaintenanceFlag } from '@/types/database'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

/**
 * « Dégâts et réparations » — lot 3 du chantier cadré avec Jeff le 01/08/2026
 * (docs/PLAN-INTERVENTIONS-COMPTA.md).
 *
 * À quoi ça sert : mesurer si les frais de restitution facturés aux clients
 * amortissent les réparations payées au garage, véhicule par véhicule et sur une
 * période. C'est la lecture que le reste de la comptabilité ne donne pas : elle
 * range les recettes d'un côté et les dépenses de l'autre, sans jamais mettre en
 * face les 300 € encaissés sur une rayure et les 180 € versés pour la réparer.
 *
 * Ce que la page attend :
 *   · les dépenses de `financial_transactions` portant une `damage_origin`
 *     (écrites par settleIntervention, une par dégât réparé) ;
 *   · les dégâts eux-mêmes, dans `vehicles.maintenance_flags`, pour y lire ce qui
 *     a été facturé au client (`billed_amount`).
 * Le lien entre les deux est la référence `maintenance:<intervention>:<dégât>`.
 *
 * Ce qu'elle produit : rien. Elle ne fait que lire, elle n'écrit aucune écriture
 * et ne modifie aucun dégât.
 *
 * LES DEUX RÈGLES À NE PAS CASSER, toutes deux décidées par Jeff :
 *
 * 1. **La date du garage fait foi, et elle seule.** Une réparation entre dans le
 *    mois où le garage a été payé, jamais dans celui où le dégât a été constaté.
 *    La recette facturée au client voyage avec elle : on lit un couple, pas deux
 *    événements. C'est pour ça que le montant facturé est lu sur le dégât et non
 *    cherché dans les recettes du mois.
 * 2. **Rien n'apparaît avant la clôture de l'intervention.** Tant que le garage
 *    n'est pas réglé, aucune écriture n'existe, donc rien ici. Ne pas ajouter de
 *    ligne « prévu » ou « en cours » : demandé, puis écarté le 01/08/2026.
 *
 * Cas limite conservé : un dommage facturé au client mais jamais réparé n'a pas de
 * date de garage et n'entrerait dans aucun mois. Il s'affiche donc en tête, sur sa
 * propre liste, et rejoindra un mois le jour où la réparation aura lieu.
 *
 * Réservée au gérant et aux associés, comme toute la comptabilité (garde posée par
 * le layout, doublée ici).
 */

const PERIODS = [
  { id: 'month',      label: 'Mois' },
  { id: 'last_month', label: 'Mois préc.' },
  { id: 'quarter',    label: 'Trimestre' },
  { id: 'year',       label: 'Année' },
]

// L'ordre d'affichage des origines, du plus parlant au plus flou. « Location »
// d'abord : c'est la seule qui a une recette en face.
const ORIGINES: { id: string; label: string; hint: string; avecRecette: boolean }[] = [
  { id: 'location',        label: 'Facturé au client',   hint: 'Ce que le client a payé face à ce que la réparation a coûté', avecRecette: true },
  { id: 'non_facture',     label: 'Non facturé',         hint: 'Gestes commerciaux et prises en charge assurance', avecRecette: false },
  { id: 'usure',           label: 'Usure du temps',      hint: 'Le vieillissement du parc', avecRecette: false },
  { id: 'usage_interne',   label: 'Usage interne',       hint: "Ce que l'équipe abîme", avecRecette: false },
  { id: 'non_communiquee', label: 'Non communiquée',     hint: "Constaté sans qu'on sache d'où ça vient", avecRecette: false },
]

const pill = (active: boolean) =>
  `px-3.5 py-2 rounded-xl text-sm font-semibold whitespace-nowrap flex-shrink-0 transition-colors ${
    active ? 'bg-[#111111] text-white' : 'bg-white border border-gray-100 text-gray-600 hover:bg-gray-50 shadow-sm'
  }`

// La couleur avant la plaque, comme partout ailleurs (règle de Jeff du 30/07/2026).
function nomVehicule(v: { brand?: string | null; model?: string | null; color?: string | null; plate?: string | null } | null) {
  if (!v) return 'Véhicule supprimé'
  const nom = [v.brand, v.model, v.color].filter(Boolean).join(' ')
  return v.plate ? `${nom} · ${v.plate}` : nom
}

/** L'identifiant du dégât, extrait de `maintenance:<intervention>:<dégât>`. */
function degatDeLaReference(reference: string | null): string | null {
  if (!reference) return null
  const bouts = reference.split(':')
  return bouts.length >= 3 && bouts[0] === 'maintenance' ? bouts[2] : null
}

export default async function DegatsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>
}) {
  const { period = 'month', from: customFrom, to: customTo } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user?.id).single()
  if (!profile || !['gerant', 'associe'].includes(profile.role)) redirect('/')

  const surMesure = period === 'custom' && customFrom && customTo
  const { from, to, label } = surMesure
    ? { from: customFrom, to: customTo, label: `${customFrom} → ${customTo}` }
    : periodRange(period)

  const [{ data: depenses }, { data: vehicules }] = await Promise.all([
    supabase
      .from('financial_transactions')
      .select('id, date, amount, vehicle_id, damage_origin, damage_type, reference, notes')
      .eq('type', 'depense')
      .not('damage_origin', 'is', null)
      .gte('date', from).lte('date', to)
      .order('date', { ascending: false }),
    supabase.from('vehicles').select('id, plate, brand, model, color, maintenance_flags'),
  ])

  const vehiculeParId = new Map((vehicules ?? []).map(v => [v.id, v]))

  // Tous les dégâts du parc, rangés par identifiant : c'est là que vit le montant
  // facturé au client, que la dépense ne porte pas.
  const degatParId = new Map<string, MaintenanceFlag & { vehicleId: string }>()
  for (const v of vehicules ?? []) {
    for (const f of ((v.maintenance_flags ?? []) as MaintenanceFlag[])) {
      degatParId.set(f.id, { ...f, vehicleId: v.id })
    }
  }

  interface Ligne {
    id: string
    date: string
    libelle: string
    origine: string
    vehiculeId: string | null
    depense: number
    recette: number
    type: string | null
  }

  const lignes: Ligne[] = (depenses ?? []).map(t => {
    const degat = degatParId.get(degatDeLaReference(t.reference) ?? '')
    return {
      id: t.id,
      date: t.date,
      libelle: degat?.label || (t.notes ?? '').replace(/^Réparation\s*:\s*/, '') || 'Réparation',
      origine: t.damage_origin as string,
      vehiculeId: t.vehicle_id,
      depense: Number(t.amount) || 0,
      // La recette ne compte que pour un dégât réellement facturé. Une origine
      // « non facturé » porte un montant nul par construction.
      recette: t.damage_origin === 'location' ? Number(degat?.billed_amount ?? 0) : 0,
      type: t.damage_type ?? degat?.damage_type ?? null,
    }
  })

  const parOrigine = ORIGINES.map(o => {
    const siennes = lignes.filter(l => l.origine === o.id)
    return {
      ...o,
      lignes: siennes,
      depense: siennes.reduce((s, l) => s + l.depense, 0),
      recette: siennes.reduce((s, l) => s + l.recette, 0),
    }
  }).filter(o => o.lignes.length > 0)

  const totalDepense = lignes.reduce((s, l) => s + l.depense, 0)
  const totalRecette = lignes.reduce((s, l) => s + l.recette, 0)
  const solde = totalRecette - totalDepense

  // Facturés au client, jamais réparés : ils n'ont aucune date de garage et
  // n'entrent donc dans aucune période. Ils s'affichent à part, quelle que soit la
  // période choisie.
  const factureNonRepare = [...degatParId.values()]
    .filter(f => !f.repaired_at && (f.billed_amount ?? 0) > 0)
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))

  const lienPeriode = (id: string) => `/accounting/degats?period=${id}`

  return (
    <div className="space-y-4">
      <BackButton fallbackHref="/accounting" className="inline-flex items-center gap-1.5 text-sm text-gray-400 font-medium hover:text-gray-700 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Comptabilité
      </BackButton>
      <h1 className="text-xl font-black text-gray-900">Dégâts et réparations</h1>

      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {PERIODS.map(p => (
          <Link key={p.id} href={lienPeriode(p.id)} className={pill(period === p.id)}>
            {p.label}
          </Link>
        ))}
      </div>

      {/* Le résultat de la période, en une ligne */}
      <div className="bg-[#111111] text-white rounded-2xl p-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-1">
          Facturé moins réparé · {label}
        </p>
        <p className={`text-[32px] font-black leading-none ${solde < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
          {solde >= 0 ? '+' : '−'}{formatPrice(Math.abs(solde))}
        </p>
        <p className="text-xs text-white/60 mt-1.5">
          {formatPrice(totalRecette)} encaissés · {formatPrice(totalDepense)} payés au garage
          {lignes.length > 0 && ` · ${lignes.length} réparation${lignes.length > 1 ? 's' : ''}`}
        </p>
      </div>

      {lignes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <Wrench className="w-8 h-8 text-gray-200 mx-auto mb-2" />
          <p className="text-gray-400 font-medium text-sm">Aucune réparation sur la période</p>
          <p className="text-gray-300 text-xs mt-1">
            Une réparation apparaît ici le jour où son intervention est clôturée.
          </p>
        </div>
      ) : (
        parOrigine.map(o => (
          <div key={o.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[13px] font-black text-gray-900">{o.label}</p>
                <p className="text-sm font-black text-gray-900 flex-shrink-0">
                  {o.avecRecette && <span className="text-emerald-600">{formatPrice(o.recette)} </span>}
                  <span className="text-red-500">−{formatPrice(o.depense)}</span>
                </p>
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">{o.hint}</p>
            </div>
            <div className="divide-y divide-gray-50">
              {o.lignes.map(l => (
                <div key={l.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-gray-900 break-words">{l.libelle}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {nomVehicule(vehiculeParId.get(l.vehiculeId ?? '') ?? null)}
                      {' · '}{damageTypeLabel(l.type)}
                      {' · '}{format(new Date(l.date), 'd MMM yyyy', { locale: fr })}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[13px] font-black text-red-500">−{formatPrice(l.depense)}</p>
                    {o.avecRecette && (
                      <p className="text-[11px] font-semibold text-emerald-600">
                        {l.recette > 0 ? `+${formatPrice(l.recette)}` : 'rien facturé'}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {factureNonRepare.length > 0 && (
        <div className="bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[13px] font-black text-gray-900">Facturés, pas encore réparés</p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Encaissés auprès du client, jamais passés au garage. Hors période, hors totaux :
                ils rejoindront le mois de la réparation.
              </p>
            </div>
          </div>
          <div className="divide-y divide-gray-50">
            {factureNonRepare.map(f => (
              <Link
                key={f.id}
                href={`/maintenance/${f.vehicleId}`}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-gray-900 break-words">{f.label}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {nomVehicule(vehiculeParId.get(f.vehicleId) ?? null)} · {damageTypeLabel(f.damage_type)}
                  </p>
                </div>
                <p className="text-[13px] font-black text-emerald-600 flex-shrink-0">
                  +{formatPrice(f.billed_amount ?? 0)}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
