'use client'

// Étape finale de l'EDL « comme en agence de location » (ticket SAV gérant 21/07) :
// UNE page qui se déroule — le contrat descend, les zones de signature sont
// intégrées au fil du document, cliquables.
//   Départ : en-tête contrat → état des lieux (case + signature) → clauses
//            complètes → signature du contrat. 2 signatures, une page.
//   Retour : en-tête → comparaison départ/retour + frais → case + signature EDL.
//            Le contrat ne se re-signe pas (signé au départ).
import { AlertTriangle, Car, ChevronLeft, ClipboardCheck, FileText, Fuel, Gauge } from 'lucide-react'
import ZoneSignature from '@/components/signature/ZoneSignature'
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
}

interface Props {
  type: 'depart' | 'arrivee'
  contrat: ContratInfo | null // null = convention inter-agences (pas de contrat locataire)
  edl: RecapEdl
  retour?: RecapRetour | null
  reconnu: boolean
  setReconnu: (v: boolean) => void
  edlSig: string | null
  setEdlSig: (s: string | null) => void
  contratSig: string | null
  setContratSig: (s: string | null) => void
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

export default function RecapSignatures({
  type, contrat, edl, retour, reconnu, setReconnu,
  edlSig, setEdlSig, contratSig, setContratSig,
  saving, error, onBack, onSubmit,
}: Props) {
  const isDepart = type === 'depart'
  const totalFraisRetour = retour
    ? retour.lateFeeAmount + retour.extraKmAmount + retour.damageFeeAmount
    : 0

  const articles = contrat
    ? getLegalArticles({
        franchise: getFeesTable(contrat.categorie, contrat.isSmartFortwo).franchise,
        retardHeure: getFeesTable(contrat.categorie, contrat.isSmartFortwo).retard,
        caution: contrat.caution,
      })
    : []

  // La signature contrat n'est exigée qu'au départ avec un contrat locataire
  const needContratSig = isDepart && !!contrat
  const ready = reconnu && !!edlSig && (!needContratSig || !!contratSig)

  return (
    <div className="space-y-4">

      {/* ══ 1. EN-TÊTE CONTRAT — loueur, locataire, véhicule, dates, prix ══ */}
      {contrat && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-bold text-gray-900 text-lg">Contrat de location</h3>
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
        </div>
      )}

      {/* ══ 2. ÉTAT DES LIEUX — récap + comparaison retour + case + SIGNATURE ══ */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-blue-500" />
          <h3 className="font-bold text-gray-900">
            État des lieux de {isDepart ? 'départ' : 'retour'}
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
        {edl.zonesAbimees.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {edl.zonesAbimees.map((z, i) => (
              <span key={i} className="text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-100 rounded-full px-2.5 py-1">
                {z.label}
              </span>
            ))}
          </div>
        )}

        {/* Comparaison + frais — EDL retour uniquement */}
        {!isDepart && retour && (
          <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-4 space-y-2">
            <p className="text-xs font-black uppercase tracking-wide text-amber-700">
              Comparaison départ / retour
            </p>
            {retour.nouvellesZones.length > 0 ? (
              <p className="text-sm text-gray-700">
                <strong>{retour.nouvellesZones.length}</strong> nouveau{retour.nouvellesZones.length > 1 ? 'x' : ''} dommage{retour.nouvellesZones.length > 1 ? 's' : ''} : {retour.nouvellesZones.join(', ')}
              </p>
            ) : (
              <p className="text-sm text-gray-700">Aucun nouveau dommage par rapport au départ.</p>
            )}
            {retour.zonesPreexistantes.length > 0 && (
              <p className="text-xs text-gray-500">
                Déjà présents au départ (non facturés) : {retour.zonesPreexistantes.join(', ')}
              </p>
            )}
            <div className="divide-y divide-amber-100 text-sm">
              {retour.lateFeeAmount > 0 && (
                <div className="flex justify-between py-1.5">
                  <span className="text-gray-600">Frais de retard ({Math.round(retour.lateMinutes)} min)</span>
                  <span className="font-bold text-red-600">+{fmtPrix(retour.lateFeeAmount)}</span>
                </div>
              )}
              {retour.extraKmAmount > 0 && (
                <div className="flex justify-between py-1.5">
                  <span className="text-gray-600">Km supplémentaires ({retour.extraKmCount})</span>
                  <span className="font-bold text-red-600">+{fmtPrix(retour.extraKmAmount)}</span>
                </div>
              )}
              {retour.damageFeeAmount > 0 && (
                <div className="flex justify-between py-1.5">
                  <span className="text-gray-600">Dommages constatés</span>
                  <span className="font-bold text-red-600">+{fmtPrix(retour.damageFeeAmount)}</span>
                </div>
              )}
              <div className="flex justify-between py-1.5">
                <span className="font-bold text-gray-900">Total frais supplémentaires</span>
                <span className="font-black text-gray-900">{fmtPrix(totalFraisRetour)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Petite case de reconnaissance + signature EDL cliquable */}
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
      </div>

      {/* ══ 3. CLAUSES DU CONTRAT (le contrat « descend ») — départ seulement ══ */}
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

          {/* ══ 4. SIGNATURE DU CONTRAT — tout en bas, comme en agence ══ */}
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
          ) : needContratSig ? 'Valider départ + contrat' : 'Valider l\'état des lieux'}
        </button>
      </div>
    </div>
  )
}
