'use client'

import { useMemo } from 'react'
import Image from 'next/image'
import { ArrowLeft, CheckCircle2, FileDown } from 'lucide-react'
import Link from 'next/link'
import BackButton from '@/components/ui/BackButton'
import VehicleInspectionMap from '@/components/vehicle-schema/VehicleInspectionMap'
import { graviteLabel, type DamageEntry, type DamageSeverity } from '@/components/vehicle-schema/inspection-types'
import { getLegalArticles, getFeesTable, VIDEO_CLAUSE, type MontantsContrat } from '@/lib/contracts/legal-articles'
import type { PosteFrais } from '@/lib/contracts/frais-restitution'
import { calculateRentalDays, rentalPriceBreakdown, ratesFor, formatDate } from '@/lib/utils'
import { formatPhoneFr, splitAddressFr } from '@/lib/format/coordonnees'

// État des lieux de départ assemblé côté serveur (page.tsx) pour être relu dans
// la prévisualisation du contrat, juste avant la signature.
export interface DepartInspection {
  kmReading: number
  fuelRangeKm: number
  exteriorCleanliness: number
  interiorCleanliness: number
  damagedZones: any[]
  clientSignature: string | null
  signedAt: string | null
  photos: { url: string; label: string }[]
}

interface Props {
  contract: any
  reservation: any
  vehicle: any
  client: any
  agency: any
  // Contexte d'enchaînement : 'depart' = on arrive directement de la validation
  // de l'EDL départ (bannière + « Terminer » revient à la réservation).
  chain?: string | null
  departInspection?: DepartInspection | null
  /** Franchise et tarif de retard résolus par la grille tarifaire du véhicule. */
  montantsContrat?: MontantsContrat | null
  /**
   * Le tableau des frais de restitution réglé par le gérant. Absent, l'aperçu
   * imprime le contrat type — exactement ce que le PDF imprimera.
   */
  postesFrais?: PosteFrais[] | null
}

// ⚠️ RÈGLE (gérant, 06/08/2026) : cet aperçu à l'écran doit rester IDENTIQUE à 100 %
// au PDF du contrat (`lib/pdf/contract-template.tsx`). Même ordre des blocs, mêmes
// informations, rien d'un côté qui manque de l'autre. Toute modif ici se reporte
// sur le PDF, et inversement. L'ordre voulu, de haut en bas :
//   1. Le contrat (en-tête, loueur/locataire, véhicule, dates, prix, dépôt)
//   2. L'état des lieux de départ (le plus important : schéma, relevés, dommages, photos)
//   3. Les conditions générales
//   4. La clause photo horodatée
//   5. Le tableau récapitulatif des frais
//   6. La signature (contrat + EDL) avec le cachet et le logo du loueur

const CLEANLINESS_LABELS: Record<number, string> = {
  1: 'Sale', 2: 'Moyen', 3: 'Normal', 4: 'Propre', 5: 'Très propre',
}

function formatDateTime(dt?: string) {
  if (!dt) return '—'
  try {
    return new Date(dt).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return dt }
}

function formatPrice(n?: number) {
  if (n == null) return '—'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
}

export default function ContractPreviewClient({ contract, reservation, vehicle, client, agency, chain, departInspection, montantsContrat, postesFrais }: Props) {
  // Détail du prix facturé, calculé par la MÊME fonction que le formulaire et le
  // PDF — jamais une seconde implémentation de la règle tarifaire.
  const priceLines = useMemo(() => {
    if (!reservation?.start_datetime || !reservation?.end_datetime) return []
    const days = calculateRentalDays(reservation.start_datetime, reservation.end_datetime)
    if (days <= 0) return []
    const { lines } = rentalPriceBreakdown(
      ratesFor(
        Number(reservation.daily_price ?? 0),
        vehicle,
        // L'aperçu doit dire exactement ce que le PDF imprime, option comprise.
        reservation.unlimited_km ? Number(reservation.unlimited_km_price ?? 0) : null,
      ),
      new Date(reservation.start_datetime),
      days,
    )
    const jour = (d: Date) => formatDate(d, 'EEEE d MMMM')
    return lines.map(l => {
      if (l.kind === 'day') {
        return { label: jour(l.date), detail: l.weekend ? 'Tarif week-end' : 'Tarif semaine', amount: l.amount, highlight: false }
      }
      if (l.kind === 'week') {
        return { label: `${jour(l.from)} → ${jour(l.to)}`, detail: 'Forfait semaine 7 jours', amount: l.amount, highlight: true }
      }
      if (l.kind === 'unlimitedKm') {
        return {
          label: 'Kilométrage illimité',
          detail: l.amount === 0
            ? 'Option offerte, aucun kilomètre supplémentaire facturé'
            : 'Option, aucun kilomètre supplémentaire facturé',
          amount: l.amount,
          highlight: true,
        }
      }
      return {
        label: `${jour(l.from)} → ${jour(l.to)}`,
        detail: `Forfait week-end, au lieu de ${formatPrice(l.instead)}`,
        amount: l.amount,
        highlight: true,
      }
    })
  }, [reservation, vehicle])

  const isSigned = contract.status === 'signe' || contract.status === 'cloture'

  // Schéma readonly de l'EDL départ : reconstruit le Record<zoneId, DamageEntry[]>
  // à partir des zones stockées (les postes intérieurs n'ont pas de zone carrosserie).
  const departDamages = useMemo<Record<string, DamageEntry[]>>(() => {
    const map: Record<string, DamageEntry[]> = {}
    for (const z of departInspection?.damagedZones ?? []) {
      if (z?.kind === 'interieur' || z?.type === 'interieur' || !z?.id) continue
      ;(map[z.id] ??= []).push({
        severity: (z.severity ?? 'dommage') as DamageSeverity,
        type: z.type ?? undefined,
        comment: z.description ?? '',
        photos: Array.isArray(z.photos) ? z.photos : [],
      })
    }
    return map
  }, [departInspection])
  const departDamageCount = Object.keys(departDamages).length

  const isSport = vehicle?.category === 'sportif'
  const isSmartFortwo =
    vehicle?.model?.toLowerCase().includes('smart') ||
    vehicle?.brand?.toLowerCase().includes('smart') ||
    false
  // Les montants viennent de la grille tarifaire du véhicule, comme dans le PDF
  // (03/08/2026). Sans grille, ce sont les valeurs historiques du contrat papier.
  const fees = getFeesTable(vehicle?.category ?? 'citadine', isSmartFortwo, montantsContrat, postesFrais)
  const articles = getLegalArticles({
    franchise: fees.franchise,
    retardHeure: fees.retard,
    caution: reservation?.deposit_amount ?? 0,
  })

  // Adresse de l'agence découpée en rue / code postal / ville pour s'aligner sur
  // celle du locataire (qui, elle, a déjà ces trois champs séparés en base).
  const agencyAddr = splitAddressFr(agency?.address)

  // La signature (et la génération/l'envoi du PDF) se fait désormais PENDANT
  // l'état des lieux de départ (InspectionFlow) — cette page est une pure
  // prévisualisation : le client y relit le contrat, rien ne s'y signe.

  // Bloc EDL départ, réutilisé (remonté sous le contrat car c'est la partie la
  // plus importante). Sa SIGNATURE n'est plus ici : elle vit dans le bloc du bas,
  // regroupée avec le cachet et le logo (gérant, 06/08/2026).
  const etatDesLieux = departInspection && (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
          État des lieux de départ
        </h2>
        {departInspection.signedAt && (
          <span className="text-xs text-gray-400">le {formatDateTime(departInspection.signedAt)}</span>
        )}
      </div>

      {/* Relevés */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
        <div className="bg-gray-50 rounded-xl p-2">
          <p className="text-xs text-gray-500">Kilométrage</p>
          <p className="font-bold text-gray-900">{departInspection.kmReading.toLocaleString('fr-FR')} km</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-2">
          <p className="text-xs text-gray-500">Autonomie</p>
          <p className="font-bold text-gray-900">{departInspection.fuelRangeKm.toLocaleString('fr-FR')} km</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-2">
          <p className="text-xs text-gray-500">Propreté ext.</p>
          <p className="font-bold text-gray-900">{CLEANLINESS_LABELS[departInspection.exteriorCleanliness] ?? '—'}</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-2">
          <p className="text-xs text-gray-500">Propreté int.</p>
          <p className="font-bold text-gray-900">{CLEANLINESS_LABELS[departInspection.interiorCleanliness] ?? '—'}</p>
        </div>
      </div>

      {/* Schéma des dommages constatés au départ (lecture seule) */}
      {departDamageCount > 0 ? (
        <>
          <VehicleInspectionMap
            damages={departDamages}
            onDamageAdd={() => {}}
            onDamageRemove={() => {}}
            readonly
            phase="departure"
            previousZones={[]}
          />
          <div className="space-y-1.5">
            {departInspection.damagedZones.map((z: any) => (
              <div key={z.id} className="flex items-center gap-2 text-sm">
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-semibold flex-shrink-0">
                  {graviteLabel((z.severity ?? 'dommage') as DamageSeverity)}
                </span>
                {/* Libellé « Zone sélectionnée » retiré : générique, il n'apprend rien
                    (gérant, 06/08/2026). On garde la gravité (pastille orange = dommage
                    au départ) et la description réelle du dommage. */}
                {z.description
                  ? <span className="text-gray-800 truncate">{z.description}</span>
                  : <span className="text-gray-500 truncate">Dommage au départ</span>}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3 text-sm text-green-700 font-medium">
          Aucun dommage constaté au départ.
        </div>
      )}

      {/* Photos de l'état des lieux */}
      {departInspection.photos.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {departInspection.photos.map(p => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={p.url}
              src={p.url}
              alt={p.label}
              className="w-20 h-20 object-cover rounded-lg border border-gray-200"
            />
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F2F2F7]">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <BackButton fallbackHref={`/contracts/${contract.id}`} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </BackButton>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-gray-900 truncate">{contract.contract_number}</h1>
          <p className="text-xs text-gray-500">Prévisualisation contrat</p>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
          isSigned ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
        }`}>
          {isSigned ? 'Signé' : 'À signer'}
        </span>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">

        {/* Bannière d'enchaînement depuis l'EDL départ */}
        {chain === 'depart' && !isSigned && (
          <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
            <p className="text-sm text-green-800">
              <strong>État des lieux de départ enregistré.</strong> Dernière étape : faites relire et signer le contrat au locataire ci-dessous.
            </p>
          </div>
        )}

        {/* ── 1. En-tête contrat ── (même agencement que le PDF : titre « Contrat de
             location » centré, logo à gauche, référence à droite. Le SIRET,
             l'adresse et le téléphone de l'agence vivent dans l'encadré Loueur,
             pas dans l'en-tête, pour coller au document signé — gérant, 05/08/2026). */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <p className="text-center text-xl font-bold uppercase tracking-wide text-gray-700 mb-4">
            Contrat de location
          </p>
          {/* items-end : le bas du logo (le mot « DRIVE ») s'aligne exactement sur
              le bas du bloc de référence, donc sur la ligne « Réf. » (gérant, 06/08/2026). */}
          <div className="flex items-end justify-between gap-4 mb-6 pb-4 border-b border-gray-100">
            <Image src="/logo.png" alt="Logo agence" width={140} height={104} className="w-[140px] h-[104px] object-contain flex-shrink-0" />
            <div className="text-right flex-shrink-0">
              <p className="font-mono font-bold text-gray-800">{contract.contract_number}</p>
              <p className="text-xs text-gray-400">Réf. {reservation?.reservation_number}</p>
            </div>
          </div>

          {/* Parties */}
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Loueur</p>
              <p className="font-semibold text-gray-900">{agency?.company_name ?? 'LMS Drive'}</p>
              {agency?.phone && <p className="text-xs text-gray-500 mt-0.5">{formatPhoneFr(agency.phone)}</p>}
              {agencyAddr.rue && <p className="text-xs text-gray-500">{agencyAddr.rue}</p>}
              {agencyAddr.cp && <p className="text-xs text-gray-500">{agencyAddr.cp}</p>}
              {agencyAddr.ville && <p className="text-xs text-gray-500">{agencyAddr.ville}</p>}
              {agency?.email && <p className="text-xs text-gray-500">{agency.email}</p>}
              {/* Espace avant le bloc légal : il détache SIRET / N° TVA du bloc
                  contact (gérant, 05/08/2026). */}
              {agency?.siret && <p className="text-xs text-gray-500 mt-2">SIRET : {agency.siret}</p>}
              {agency?.vat_number && <p className="text-xs text-gray-500">N° TVA : {agency.vat_number}</p>}
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Locataire</p>
              <p className="font-semibold text-gray-900">{client?.first_name} {client?.last_name}</p>
              <p className="text-xs text-gray-500">{formatPhoneFr(client?.phone)}</p>
              {client?.address && <p className="text-xs text-gray-500">{client.address}</p>}
              {client?.postal_code && <p className="text-xs text-gray-500">{client.postal_code}</p>}
              {client?.city && <p className="text-xs text-gray-500">{client.city}</p>}
              {client?.email && <p className="text-xs text-gray-500">{client?.email}</p>}
              {client?.license_number && <p className="text-xs text-gray-500">Permis : {client?.license_number}</p>}
            </div>
          </div>

          {/* Véhicule */}
          <div className="bg-[#111111] rounded-xl p-4 mb-4 text-white">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Véhicule loué</p>
            <p className="font-bold text-lg">{vehicle?.brand} {vehicle?.model} {vehicle?.version}</p>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <span className="bg-gray-700 text-gray-300 font-mono text-xs font-normal px-2 py-0.5 rounded">{vehicle?.plate}</span>
              {vehicle?.color && <span className="text-gray-300 text-sm">{vehicle?.color}</span>}
              {vehicle?.category && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  isSport ? 'bg-red-900 text-red-300' : 'bg-blue-900 text-blue-300'
                }`}>
                  {isSport ? 'Sportif' : isSmartFortwo ? 'Smart Fortwo' : 'Citadine'}
                </span>
              )}
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-blue-50 rounded-xl p-3">
              <p className="text-xs text-blue-600 font-medium mb-1">Départ</p>
              <p className="font-semibold text-gray-900">{formatDateTime(reservation?.start_datetime)}</p>
            </div>
            <div className="bg-purple-50 rounded-xl p-3">
              <p className="text-xs text-purple-600 font-medium mb-1">Retour prévu</p>
              <p className="font-semibold text-gray-900">{formatDateTime(reservation?.end_datetime)}</p>
            </div>
          </div>

          {/* Tarification */}
          <div className="grid grid-cols-3 gap-2 mb-2 text-center">
            <div className="bg-gray-50 rounded-xl p-2">
              <p className="text-xs text-gray-500">Prix / jour</p>
              <p className="font-bold text-gray-900">{formatPrice(reservation?.daily_price)}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-2">
              <p className="text-xs text-gray-500">KM inclus</p>
              {/* Sous l'option illimité, on l'écrit en toutes lettres : le « ∞ »
                  passait pour un champ vide (gérant, 05/08/2026). */}
              <p className="font-bold text-gray-900">{reservation?.unlimited_km ? 'Illimité' : (reservation?.km_included ?? '∞')}</p>
            </div>
            <div className="bg-green-50 rounded-xl p-2">
              <p className="text-xs text-green-700">Total TTC</p>
              <p className="font-bold text-green-800">{formatPrice(reservation?.total_price)}</p>
            </div>
          </div>

          {/* Détail du prix : sans lui, « 80 € / jour » et « 450 € » pour 7 jours
              ne se relient pas (c'est le forfait semaine qui joue). Même défaut
              que sur le PDF, corrigé le 27/07/2026. */}
          {priceLines.length > 0 && (
            <div className="mb-4 rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Détail de la période louée</p>
              {priceLines.map((l, i) => (
                <div key={i} className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-gray-500 capitalize">{l.label}</span>
                  <span className="flex items-center gap-2">
                    <span className={l.highlight ? 'text-green-700' : 'text-gray-500'}>{l.detail}</span>
                    <span className="font-semibold text-gray-900 tabular-nums">{formatPrice(l.amount)}</span>
                  </span>
                </div>
              ))}
            </div>
          )}

          {reservation?.deposit_amount && (
            <div className="p-3 bg-amber-50 rounded-xl flex items-center justify-between">
              <span className="text-sm text-amber-800 font-medium">Dépôt de garantie</span>
              <span className="font-bold text-amber-900">{formatPrice(reservation.deposit_amount)}</span>
            </div>
          )}
        </div>

        {/* ── 2. État des lieux de départ (remonté ici : partie la plus importante) ── */}
        {etatDesLieux}

        {/* ── 3. Conditions générales · 14 articles ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-5">
            Conditions générales de location
          </h2>
          <div className="space-y-5">
            {articles.map(art => (
              <div key={art.title}>
                <h3 className="text-xs font-bold text-gray-800 mb-1.5">Art. {art.title}</h3>
                <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">{art.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── 4. Clause photo horodatée ── */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
          <h2 className="text-xs font-bold text-blue-800 uppercase tracking-wide mb-2">
            Clause photo horodatée · État des lieux
          </h2>
          <p className="text-xs text-blue-700 leading-relaxed">{VIDEO_CLAUSE}</p>
        </div>

        {/* ── 5. Tableau récapitulatif des frais (en bas) ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-1">
            Tableau récapitulatif des frais
          </h2>
          <p className="text-xs text-gray-400 mb-4">
            Catégorie : {isSport ? 'Véhicule Sportif' : isSmartFortwo ? 'Smart Fortwo' : 'Citadine'}
          </p>
          <div className="divide-y divide-gray-100">
            {fees.rows.map((row, i) => (
              <div key={row.label} className={`flex items-center justify-between py-2.5 ${
                i < 2 ? (isSport ? 'bg-red-50 -mx-2 px-2 rounded-lg' : 'bg-blue-50 -mx-2 px-2 rounded-lg') : ''
              }`}>
                <span className="text-sm text-gray-700">{row.label}</span>
                <span className={`text-sm font-semibold ${
                  i < 2 ? (isSport ? 'text-red-700' : 'text-blue-700') : 'text-gray-900'
                }`}>{row.value}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 mt-3">
            Montants TTC. La franchise est applicable par sinistre et par véhicule.
          </p>
        </div>

        {/* ── 6. Signature (contrat + EDL), cachet et logo du loueur (bas de page) ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          {!isSigned && (
            <p className="text-sm text-gray-500 text-center mb-5">
              Ce contrat se signe pendant l&apos;état des lieux de départ : le client relit
              les conditions puis signe le contrat et l&apos;EDL en une seule fois.
            </p>
          )}
          <div className="flex flex-wrap items-end justify-between gap-6">
            {/* Signature du locataire : elle vaut pour le contrat ET l'état des lieux,
                apposée en un seul geste au départ. */}
            <div className="flex-1 min-w-[180px]">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5">
                Signature du contrat de location + état des lieux
              </p>
              {(contract.client_signature_svg || departInspection?.clientSignature) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={contract.client_signature_svg || departInspection?.clientSignature}
                  alt="Signature du locataire"
                  className="h-16 border border-gray-200 rounded-lg object-contain bg-white px-4"
                />
              ) : (
                <div className="h-16 flex items-center justify-center border border-dashed border-gray-200 rounded-lg text-xs text-gray-400 px-4">
                  En attente de signature
                </div>
              )}
              {isSigned && contract.signed_at && (
                <p className="text-xs text-gray-400 mt-1.5">
                  Signé le {new Date(contract.signed_at).toLocaleString('fr-FR')}
                </p>
              )}
            </div>

            {/* Cachet du loueur : il porte l'identité de l'agence et vaut signature
                côté loueur. Pas de logo à côté, il ferait doublon (gérant, 06/08/2026). */}
            <div className="flex flex-col items-center">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5">Cachet du loueur (vaut signature)</p>
              <div className="h-16 w-40 flex items-center justify-center border border-gray-200 rounded-lg bg-gray-50">
                <Image src="/cachet-lms.png" alt="Cachet du loueur" width={120} height={48} className="object-contain max-h-full" />
              </div>
            </div>
          </div>

          {!isSigned && reservation?.id && (
            <div className="mt-6 text-center">
              <Link
                href={`/inspections/departure/${reservation.id}`}
                className="inline-flex items-center justify-center gap-2 px-5 py-3.5 bg-[#111111] hover:bg-gray-800 text-white font-semibold rounded-xl transition-colors text-sm"
              >
                Faire l&apos;état des lieux de départ
              </Link>
            </div>
          )}
          {isSigned && (
            <div className="mt-5 text-center">
              <Link href={`/contracts/${contract.id}`} className="inline-flex items-center gap-2 text-sm text-gray-600 font-medium hover:underline">
                <FileDown className="w-4 h-4" />
                Retour au contrat
              </Link>
            </div>
          )}
        </div>

        <div className="h-6" />
      </div>
    </div>
  )
}
