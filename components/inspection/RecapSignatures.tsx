'use client'

// Étape finale de l'EDL « comme en agence de location » (ticket SAV gérant 21/07) :
// UNE page qui se déroule — le contrat descend, les zones de signature sont
// intégrées au fil du document, cliquables.
//   Départ : en-tête contrat → état des lieux PRÉVISUALISÉ (schéma, zones
//            relevées, photos jointes) + case + signature → clauses complètes
//            → signature du contrat. 2 signatures, une page.
//   Retour : comparaison EDL aller/retour (schémas côte à côte + photos des
//            dommages) → contrat de restitution avec chiffrage → case +
//            signature EDL. Le contrat ne se re-signe pas (signé au départ).
import { AlertTriangle, Camera, Car, ChevronLeft, ClipboardCheck, FileText, Fuel, Gauge } from 'lucide-react'
import ZoneSignature from '@/components/signature/ZoneSignature'
import VehicleInspectionMap from '@/components/vehicle-schema/VehicleInspectionMap'
import DamageComparison from '@/components/vehicle-schema/DamageComparison'
import { VEHICLE_ZONES, graviteLabel, type DamageEntry } from '@/components/vehicle-schema/inspection-types'
import { getFeesTable, getLegalArticles, VIDEO_CLAUSE } from '@/lib/contracts/legal-articles'

export interface ContratInfo {
  numero: string
  clientNom: string
  clientPhone?: string | null
  clientAddress?: string | null
  vehiculeLabel: string
  plate: string
  debut: string
  fin: string
  prixJour: number | null
  total: number | null
  kmInclus: number
  caution: number
  categorie: string
  isSmartFortwo: boolean
}

export interface RecapEdl {
  km: number
  fuelRangeKm: number
  photoCount: number
  zonesAbimees: { label: string; severity: string }[]
}

export interface RecapRetour {
  kmDepart: number
  fuelDepart: number
  nouvellesZones: string[]
  zonesPreexistantes: string[]
  lateMinutes: number
  lateFeeAmount: number
  extraKmCount: number
  extraKmAmount: number
  damageFeeAmount: number
  // Facture de restitution : chaque frais ligne par ligne (dommages, retard, km sup)
  lignes: { label: string; montant: number }[]
}

export interface PhotoJointe {
  label: string
  url: string
}

interface Props {
  type: 'depart' | 'arrivee'
  contrat: ContratInfo | null // null = convention inter-agences (pas de contrat locataire)
  edl: RecapEdl
  retour?: RecapRetour | null
  damages: Record<string, DamageEntry[]>
  photosJointes: PhotoJointe[]
  previousDamages?: Record<string, DamageEntry[]> | null
  reconnu: boolean
  setReconnu: (v: boolean) => void
  edlSig: string | null
  setEdlSig: (s: string | null) => void
  contratSig: string | null
  setContratSig: (s: string | null) => void
  factureSig: string | null
  setFactureSig: (s: string | null) => void
  saving: boolean
  error: string | null
  onBack: () => void
  onSubmit: () => void
}

function fmtDate(dt: string) {
  try {
    return new Date(dt).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  } catch { return dt }
}

const fmtPrix = (n: number | null | undefined) =>
  n == null ? '—' : `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €`

function GaleriePhotos({ titre, photos }: { titre: string; photos: PhotoJointe[] }) {
  if (photos.length === 0) return null
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 flex items-center gap-1.5">
        <Camera className="w-3.5 h-3.5" /> {titre} ({photos.length})
      </p>
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
        {photos.map((p, i) => (
          <figure key={i} className="space-y-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={p.label} className="w-full aspect-square object-cover rounded-lg border border-gray-100" />
            <figcaption className="text-[9px] text-gray-400 truncate text-center">{p.label}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  )
}

export default function RecapSignatures({
  type, contrat, edl, retour, damages, photosJointes, previousDamages,
  reconnu, setReconnu, edlSig, setEdlSig, contratSig, setContratSig,
  factureSig, setFactureSig, saving, error, onBack, onSubmit,
}: Props) {
  const isDepart = type === 'depart'
  const totalFraisRetour = retour
    ? retour.lateFeeAmount + retour.extraKmAmount + retour.damageFeeAmount
    : 0
  // Facture de restitution : signature exigée uniquement s'il y a des frais
  const aDesFrais = !isDepart && totalFraisRetour > 0

  const articles = contrat
    ? getLegalArticles({
        franchise: getFeesTable(contrat.categorie, contrat.isSmartFortwo).franchise,
        retardHeure: getFeesTable(contrat.categorie, contrat.isSmartFortwo).retard,
        caution: contrat.caution,
      })
    : []

  // La signature contrat n'est exigée qu'au départ avec un contrat locataire
  const needContratSig = isDepart && !!contrat
  const ready = reconnu && !!edlSig
    && (!needContratSig || !!contratSig)
    && (!aDesFrais || !!factureSig)

  // Détail des zones relevées sur cet EDL (gravité + commentaire) + leurs photos
  const zonesRelevees = Object.entries(damages)
    .filter(([, entries]) => entries.length > 0)
    .map(([zoneId, entries]) => ({
      zoneId,
      label: VEHICLE_ZONES.find(z => z.id === zoneId)?.label ?? zoneId,
      entries,
    }))
  const photosDommages: PhotoJointe[] = zonesRelevees.flatMap(z =>
    z.entries.flatMap(e => e.photos.map(url => ({ label: z.label, url }))),
  )

  /* ── En-tête contrat (réutilisé : « location » au départ, « restitution » au retour) ── */
  const enTeteContrat = contrat && (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-gray-900 text-lg">
            {isDepart ? 'Contrat de location' : 'Contrat de restitution'}
          </h3>
          <p className="text-xs text-gray-400 font-mono">{contrat.numero}</p>
        </div>
        <FileText className="w-5 h-5 text-gray-300 flex-shrink-0" />
      </div>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Loueur</p>
          <p className="font-bold text-gray-900">LMS Drive</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Locataire</p>
          <p className="font-bold text-gray-900">{contrat.clientNom}</p>
          {contrat.clientPhone && <p className="text-xs text-gray-500">{contrat.clientPhone}</p>}
          {contrat.clientAddress && <p className="text-xs text-gray-400">{contrat.clientAddress}</p>}
        </div>
      </div>
      <div className="rounded-xl bg-gray-50 p-3 flex items-center gap-3">
        <Car className="w-5 h-5 text-gray-400 flex-shrink-0" />
        <div>
          <p className="font-bold text-gray-900">{contrat.vehiculeLabel}</p>
          <p className="text-xs text-gray-400 font-mono">{contrat.plate}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-blue-50 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-blue-500">Départ</p>
          <p className="font-bold text-gray-900">{fmtDate(contrat.debut)}</p>
        </div>
        <div className="rounded-xl bg-purple-50 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-purple-500">Retour prévu</p>
          <p className="font-bold text-gray-900">{fmtDate(contrat.fin)}</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 text-sm">
        <div className="rounded-xl bg-gray-50 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Prix/jour</p>
          <p className="font-bold text-gray-900">{fmtPrix(contrat.prixJour)}</p>
        </div>
        <div className="rounded-xl bg-gray-50 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">KM inclus</p>
          <p className="font-bold text-gray-900">{contrat.kmInclus}</p>
        </div>
        <div className="rounded-xl bg-green-50 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-green-600">Total</p>
          <p className="font-bold text-green-800">{fmtPrix(contrat.total)}</p>
        </div>
      </div>
    </>
  )

  /* ── Case de reconnaissance + signature EDL ── */
  const caseEtSignatureEdl = (
    <>
      <label className="flex items-start gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={reconnu}
          onChange={e => setReconnu(e.target.checked)}
          className="mt-0.5 w-5 h-5 rounded border-gray-300 accent-blue-600"
        />
        <span className="text-sm text-gray-700">
          Le locataire reconnaît l&apos;état du véhicule constaté ci-dessus
          {edl.photoCount > 0 ? ' (photos horodatées à l\'appui)' : ''}.
        </span>
      </label>
      <ZoneSignature
        label={`Signature de l'état des lieux ${isDepart ? 'départ' : 'retour'}`}
        value={edlSig}
        onChange={setEdlSig}
      />
    </>
  )

  return (
    <div className="space-y-4">

      {/* ══ DÉPART · 1. EN-TÊTE CONTRAT — loueur, locataire, véhicule, dates, prix ══ */}
      {isDepart && contrat && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          {enTeteContrat}
        </div>
      )}

      {/* ══ ÉTAT DES LIEUX — relevé, schéma/comparaison, photos ══ */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-blue-500" />
          <h3 className="font-bold text-gray-900">
            {isDepart ? 'État des lieux de départ' : 'Comparaison états des lieux départ / retour'}
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-gray-50 p-3 flex items-center gap-2.5">
            <Gauge className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Kilométrage</p>
              <p className="font-bold text-gray-900">{edl.km.toLocaleString('fr-FR')} km</p>
              {!isDepart && retour && (
                <p className="text-[10px] text-gray-400">départ : {retour.kmDepart.toLocaleString('fr-FR')} km</p>
              )}
            </div>
          </div>
          <div className="rounded-xl bg-gray-50 p-3 flex items-center gap-2.5">
            <Fuel className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Autonomie</p>
              <p className="font-bold text-gray-900">{edl.fuelRangeKm} km</p>
              {!isDepart && retour && (
                <p className="text-[10px] text-gray-400">départ : {retour.fuelDepart} km</p>
              )}
            </div>
          </div>
        </div>

        <p className="text-sm text-gray-500">
          {edl.photoCount} photo{edl.photoCount > 1 ? 's' : ''} horodatée{edl.photoCount > 1 ? 's' : ''} ·{' '}
          {edl.zonesAbimees.length === 0
            ? 'aucune zone signalée'
            : `${edl.zonesAbimees.length} zone${edl.zonesAbimees.length > 1 ? 's' : ''} signalée${edl.zonesAbimees.length > 1 ? 's' : ''}`}
        </p>

        {/* DÉPART : schéma du véhicule + zones relevées + photos jointes */}
        {isDepart && (
          <>
            <VehicleInspectionMap
              damages={damages}
              onDamageAdd={() => {}}
              onDamageRemove={() => {}}
              readonly
              phase="departure"
            />
            {zonesRelevees.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Éléments relevés</p>
                {zonesRelevees.map(z => (
                  <div key={z.zoneId} className="flex items-start justify-between gap-3 rounded-xl bg-amber-50/70 border border-amber-100 px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900">{z.label}</p>
                      {z.entries[0]?.comment && (
                        <p className="text-xs text-gray-500 truncate">{z.entries[0].comment}</p>
                      )}
                    </div>
                    <span className="text-xs font-bold text-amber-700 flex-shrink-0">
                      {graviteLabel(z.entries[0]?.severity)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <GaleriePhotos titre="Photos jointes à l'état des lieux" photos={[...photosJointes, ...photosDommages]} />
          </>
        )}

        {/* RETOUR : schémas départ/retour côte à côte + photos des dommages */}
        {!isDepart && (
          <>
            <DamageComparison
              departureDamages={previousDamages ?? {}}
              returnDamages={damages}
            />
            <GaleriePhotos titre="Photos des dommages constatés au retour" photos={photosDommages} />
            <GaleriePhotos titre="Photos jointes à l'état des lieux retour" photos={photosJointes} />
          </>
        )}

        {/* DÉPART : case + signature EDL directement sous l'état des lieux */}
        {isDepart && caseEtSignatureEdl}
      </div>

      {/* ══ RETOUR · CONTRAT DE RESTITUTION — en-tête + conditions + case + signature EDL ══ */}
      {!isDepart && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          {enTeteContrat}
          {/* Le contrat « descend » aussi au retour : conditions signées au départ,
              relues avant de signer la restitution (pas de re-signature contrat). */}
          {contrat && (
            <>
              <h4 className="font-bold text-gray-900 text-sm">Conditions de location (signées au départ)</h4>
              <div className="max-h-[300px] overflow-y-auto rounded-xl border border-gray-100 bg-gray-50/60 p-4 space-y-4">
                {articles.map(a => (
                  <div key={a.title}>
                    <p className="text-xs font-black uppercase tracking-wide text-gray-700 mb-1">{a.title}</p>
                    <p className="text-xs leading-relaxed text-gray-500 whitespace-pre-line">{a.body}</p>
                  </div>
                ))}
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-gray-700 mb-1">ÉTAT DES LIEUX PAR PHOTOS</p>
                  <p className="text-xs leading-relaxed text-gray-500">{VIDEO_CLAUSE}</p>
                </div>
              </div>
            </>
          )}
          {caseEtSignatureEdl}
        </div>
      )}

      {/* ══ RETOUR · FACTURE DE RESTITUTION — lignes détaillées + total + signature ══ */}
      {!isDepart && retour && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-red-500" />
            <h3 className="font-bold text-gray-900">Facture de restitution</h3>
          </div>

          {retour.zonesPreexistantes.length > 0 && (
            <p className="text-xs text-gray-500">
              Déjà présents au départ (non facturés) : {retour.zonesPreexistantes.join(', ')}
            </p>
          )}

          {retour.lignes.length === 0 ? (
            <div className="rounded-xl bg-green-50 border border-green-100 p-4 text-center">
              <p className="text-sm font-bold text-green-700">Aucun frais — rien à facturer</p>
              <p className="text-xs text-green-600 mt-0.5">Véhicule rendu conforme, dans les délais et le kilométrage inclus.</p>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-gray-100 overflow-hidden">
                {retour.lignes.map((l, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between gap-3 px-4 py-2.5 text-sm ${i % 2 ? 'bg-gray-50/60' : 'bg-white'}`}
                  >
                    <span className="text-gray-700 min-w-0">{l.label}</span>
                    <span className="font-bold text-red-600 flex-shrink-0">{fmtPrix(l.montant)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-3 px-4 py-3 bg-red-50 border-t border-red-100">
                  <span className="font-black uppercase tracking-wide text-gray-900 text-sm">Total à facturer</span>
                  <span className="font-black text-red-700 text-lg">{fmtPrix(totalFraisRetour)}</span>
                </div>
              </div>

              {/* Signature de la facture de restitution */}
              <ZoneSignature
                label="Signature de la facture de restitution"
                value={factureSig}
                onChange={setFactureSig}
              />
            </>
          )}
        </div>
      )}

      {/* ══ DÉPART · CLAUSES DU CONTRAT (le contrat « descend ») ══ */}
      {needContratSig && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h3 className="font-bold text-gray-900">Conditions de location</h3>
          <div className="max-h-[420px] overflow-y-auto rounded-xl border border-gray-100 bg-gray-50/60 p-4 space-y-4">
            {articles.map(a => (
              <div key={a.title}>
                <p className="text-xs font-black uppercase tracking-wide text-gray-700 mb-1">{a.title}</p>
                <p className="text-xs leading-relaxed text-gray-500 whitespace-pre-line">{a.body}</p>
              </div>
            ))}
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-gray-700 mb-1">ÉTAT DES LIEUX PAR PHOTOS</p>
              <p className="text-xs leading-relaxed text-gray-500">{VIDEO_CLAUSE}</p>
            </div>
          </div>

          {/* SIGNATURE DU CONTRAT — tout en bas, comme en agence */}
          <ZoneSignature
            label="Signature du contrat de location"
            value={contratSig}
            onChange={setContratSig}
          />
          <div className="flex items-center justify-center h-[90px] rounded-xl border-2 border-dashed border-gray-200 bg-gray-50">
            <div className="border-2 border-blue-600/40 rounded-lg px-5 py-2 text-center">
              <p className="text-xs font-black uppercase tracking-wide text-blue-600/80">Cachet de l&apos;entreprise</p>
              <p className="text-[10px] uppercase tracking-widest text-blue-600/50 mt-0.5">Apposé automatiquement</p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onBack}
          disabled={saving}
          className="px-5 py-3 bg-white border border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50 transition-colors active:scale-[.97] flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          <ChevronLeft className="w-4 h-4" /> Retour
        </button>
        <button
          onClick={onSubmit}
          disabled={saving || !ready}
          className="flex-1 py-3.5 bg-green-600 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl font-bold hover:bg-green-700 transition-colors active:scale-[.97]"
        >
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              Enregistrement…
            </span>
          ) : needContratSig ? 'Valider départ + contrat' : 'Valider'}
        </button>
      </div>
    </div>
  )
}
