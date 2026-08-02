'use client'

// Écran « Déplacements internes » (/internal-trips) : planifier, démarrer,
// terminer, modifier et supprimer un déplacement de service, plus l'historique.
//
// Il reçoit tout du serveur (page.tsx) : la flotte, les déplacements, l'équipe,
// le rôle. Il n'écrit qu'à travers les Server Actions de
// `lib/actions/internal-trips` et ne lit jamais la base directement.
//
// Panneau de disponibilité (demande Jeff du 29/07/2026) : cliquer la barre de
// recherche ouvre la liste de TOUTE la flotte sur une période « du … au … »,
// libres d'abord, les pris avec leur heure de retour. Il interroge
// `/api/vehicles/availability`, c'est-à-dire exactement le code qui refuse
// l'enregistrement (`vehiculesIndisponibles`) : aucune règle de disponibilité
// n'est réécrite ici, sinon l'écran dirait « libre » sur un véhicule que
// l'enregistrement refuserait. Un clic sur une ligne ouvre « Planifier » avec
// le véhicule et la période déjà remplis, y compris sur un véhicule pris (c'est
// l'enregistrement qui tranche, pas l'affichage).
//
// Contrôle réel à l'enregistrement (02/08/2026) : « Démarrer maintenant » et
// « Planifier » refusent désormais un véhicule occupé, ce que la phrase
// ci-dessus supposait déjà sans que ce soit vrai. Avant cette date, une voiture
// louée jusqu'au 31 août pouvait partir en déplacement sans un mot.
//
// Créneaux libres (30/07/2026) : un véhicule pris n'est plus un simple « occupé
// jusqu'à 15h ». Le panneau affiche les TROUS réellement libres à l'intérieur de
// la période demandée (une voiture rendue à 13h et reprise à 15h propose « Libre
// 13:00 - 15:00 »), et toucher un créneau reprend ses heures dans le formulaire
// plutôt que la période cherchée. Le calcul reste au même endroit
// (`analyserDisponibilite`) : ici, uniquement de l'affichage.
//
// À ne pas casser : la barre de recherche reste visible même sans aucun
// déplacement, c'est elle qui donne accès au panneau.
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { startTrip, endTrip, planTrip, startPlannedTrip, assignTrip, updateTrip, deleteTrip } from '@/lib/actions/internal-trips'
import { useToast } from '@/components/Toast'
import { formatDateTime, formatPrice } from '@/lib/utils'
import { internalTripPurposeLabel } from '@/lib/vehicles/internalTrips'
import { Plus, Navigation, Clock, CheckCircle2, CalendarClock, UserPlus, Play, Pencil, Trash2, User, Search, X, Loader2 } from 'lucide-react'
import Drawer from '@/components/Drawer'
import DateTimeField from '@/components/ui/DateTimeField'
import VehiclePicker from '@/components/vehicles/VehiclePicker'
import VehicleSituationCard from '@/components/vehicles/VehicleSituationCard'
import type { SituationVehicule } from '@/lib/vehicles/situation'

interface Vehicle { id: string; plate: string; brand: string; model: string; current_km: number }
interface Member { id: string; full_name: string; role: string }
interface Trip {
  id: string; vehicle_id: string; user_id: string | null
  start_datetime: string; end_datetime: string | null
  status: 'planifie' | 'en_cours' | 'termine' | 'annule'
  purpose: string; purpose_notes: string | null
  km_start: number | null; km_end: number | null
  fuel_start: number | null; fuel_end: number | null
  tolls_amount: number | null; expenses_amount: number | null
  vehicle: { plate: string; brand: string; model: string } | null
  user: { full_name: string } | null
}

const PURPOSES = [
  { value: 'livraison', label: 'Livraison' },
  { value: 'recuperation', label: 'Récupération' },
  { value: 'garage', label: 'Garage' },
  { value: 'preparation', label: 'Préparation' },
  { value: 'personnel', label: 'Personnel' },
  { value: 'autre', label: 'Autre' },
]

const tripLabel = (t: Trip) => internalTripPurposeLabel(t.purpose, t.purpose_notes)

/**
 * Nom d'usage d'un véhicule : la marque et le modèle. C'est l'identification
 * PRINCIPALE demandée par Jeff (remarque 40.2, redite le 02/08/2026) ; la plaque
 * reste affichée mais en second, en petit. Même ordre que le format commun des
 * lignes du tableau de bord. Ne pas revenir à la plaque en tête.
 */
const vehicleName = (v?: { brand: string; model: string } | null) =>
  v ? `${v.brand} ${v.model}`.trim() : 'Véhicule'

/** Motifs d'indisponibilité renvoyés par /api/vehicles/availability. */
const RAISON: Record<string, string> = {
  reservation: 'en location',
  garage: 'au garage',
  deplacement: 'déplacement interne',
}

/**
 * Même motif, mais quand personne ne sait quand le véhicule revient : location
 * non rendue, déplacement non clôturé. Annoncer une heure de retour déjà passée
 * ferait croire à une voiture disponible.
 */
const RAISON_RETOUR_INCONNU: Record<string, string> = {
  reservation: 'retour non fait',
  garage: 'au garage, sortie non connue',
  deplacement: 'déplacement en cours, retour inconnu',
}

/** Un trou libre à l'intérieur de la période cherchée. */
interface Creneau { debut: string; fin: string; libelle: string }
interface Dispo {
  raison: string | null
  jusqua: string | null
  retourInconnu: boolean
  creneaux: Creneau[]
}

/**
 * Instant ISO → valeur d'un champ date+heure (« YYYY-MM-DDTHH:mm »), à l'heure
 * du téléphone. Découper l'ISO à la main donnerait l'heure universelle, soit
 * deux heures de moins qu'affiché sur la carte l'été.
 */
function toDatetimeLocal(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Créneau planifié : « 12/08 09:00 → 17:30 » (même jour) ou les deux dates. */
function tripWindow(t: Trip) {
  if (!t.end_datetime) return formatDateTime(t.start_datetime)
  // Comparaison sur les dates FORMATÉES (heure locale) — comparer les ISO
  // reviendrait à comparer des jours UTC, faux pour un créneau qui passe minuit.
  const startTxt = formatDateTime(t.start_datetime)
  const endTxt = formatDateTime(t.end_datetime)
  return `${startTxt} → ${startTxt.slice(0, 10) === endTxt.slice(0, 10) ? endTxt.slice(11) : endTxt}`
}

export default function InternalTripsClient({
  vehicles, trips, members, isManager, currentUserId, vehiculeChoisi, situation,
}: {
  vehicles: Vehicle[]
  trips: Trip[]
  members: Member[]
  isManager: boolean
  currentUserId: string
  /** Véhicule choisi dans la liste déroulante, s'il y en a un. */
  vehiculeChoisi?: string
  /** Sa situation, calculée par le serveur (même carte que Réservations). */
  situation: SituationVehicule | null
}) {
  const router = useRouter()
  const { show } = useToast()
  const [showStartForm, setShowStartForm] = useState(false)
  const [showPlanForm, setShowPlanForm] = useState(false)
  const [endingTrip, setEndingTrip] = useState<Trip | null>(null)
  const [startingPlanned, setStartingPlanned] = useState<Trip | null>(null)
  const [assigningTrip, setAssigningTrip] = useState<Trip | null>(null)
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null)
  const [deletingTrip, setDeletingTrip] = useState<Trip | null>(null)
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  // Panneau de disponibilité ouvert par la barre de recherche.
  const [showDispo, setShowDispo] = useState(false)
  const [dispoFrom, setDispoFrom] = useState('')
  const [dispoTo, setDispoTo] = useState('')
  const [dispo, setDispo] = useState<Record<string, Dispo>>({})
  const [dispoEtat, setDispoEtat] = useState<'vide' | 'chargement' | 'ok' | 'echec'>('vide')
  // Début saisi dans le formulaire de planification : borne basse du champ « Fin ».
  const [planStart, setPlanStart] = useState('')
  // Véhicule et fin repris du panneau de disponibilité quand on planifie depuis
  // une ligne. Le tiroir est démonté à la fermeture, donc un `defaultValue`
  // suffit : il est relu à chaque ouverture.
  const [planVehicleId, setPlanVehicleId] = useState('')
  const [planEnd, setPlanEnd] = useState('')
  // Même rôle dans le formulaire de modification.
  const [editStart, setEditStart] = useState('')
  // Motif de chaque formulaire : « autre » fait apparaître un champ de précision
  // obligatoire (le mot « autre » seul ne dit rien au reste de l'équipe).
  const [planPurpose, setPlanPurpose] = useState('livraison')
  const [startPurpose, setStartPurpose] = useState('livraison')
  const [editPurpose, setEditPurpose] = useState('livraison')

  // Filtre local : pas d'URL par trajet (gérés en drawer), donc recherche en mémoire.
  const q = search.trim().toLowerCase()
  const matchTrip = (t: Trip) =>
    !q || [t.vehicle?.plate, t.vehicle?.brand, t.vehicle?.model, t.purpose, t.purpose_notes, t.user?.full_name]
      .filter(Boolean).join(' ').toLowerCase().includes(q)

  const plannedTrips   = trips.filter(t => t.status === 'planifie' && matchTrip(t))
  const activeTrips     = trips.filter(t => t.status === 'en_cours' && matchTrip(t))
  const completedTrips = trips.filter(t => t.status === 'termine' && matchTrip(t))

  const vehicleById = (id: string) => vehicles.find(v => v.id === id) ?? null
  const canManageTrip = (t: Trip) => isManager || t.user_id === currentUserId
  // Véhicule du déplacement en cours de modification : sert à rappeler son compteur.
  const editVehicle = editingTrip ? vehicleById(editingTrip.vehicle_id) : null
  function reset() {
    setShowStartForm(false); setShowPlanForm(false)
    setEndingTrip(null); setStartingPlanned(null); setAssigningTrip(null); setDeletingTrip(null)
    setEditingTrip(null)
    setSelectedVehicle(null); setError(null); setLoading(false)
    setPlanStart(''); setPlanEnd(''); setPlanVehicleId('')
    setPlanPurpose('livraison'); setStartPurpose('livraison')
    setEditStart(''); setEditPurpose('livraison')
  }

  // ── Panneau de disponibilité ───────────────────────────────────────────────
  /** Période proposée à l'ouverture : de la prochaine demi-heure, pour deux heures. */
  function periodeParDefaut(): [string, string] {
    const debut = new Date()
    debut.setMinutes(debut.getMinutes() > 30 ? 60 : 30, 0, 0)
    const fin = new Date(debut.getTime() + 2 * 60 * 60 * 1000)
    return [toDatetimeLocal(debut.toISOString()), toDatetimeLocal(fin.toISOString())]
  }

  function ouvrirDispo() {
    if (!dispoFrom || !dispoTo) {
      const [d, f] = periodeParDefaut()
      setDispoFrom(d); setDispoTo(f)
    }
    setShowDispo(true)
  }

  /**
   * Clic sur une ligne du panneau : « Planifier », véhicule et période repris.
   * Sur un véhicule partiellement pris, `creneau` reprend les heures du trou
   * libre plutôt que la période cherchée : c'est tout l'intérêt de l'afficher.
   */
  function planifierDepuisDispo(v: Vehicle, creneau?: Creneau) {
    setPlanVehicleId(v.id)
    setPlanStart(creneau ? toDatetimeLocal(creneau.debut) : dispoFrom)
    setPlanEnd(creneau ? toDatetimeLocal(creneau.fin) : dispoTo)
    setShowDispo(false)
    setError(null)
    setShowPlanForm(true)
  }

  // Disponibilité relue à chaque changement de période. La réponse vient de
  // `analyserDisponibilite`, le même code que celui qui refuse l'enregistrement.
  useEffect(() => {
    if (!showDispo) return
    if (!dispoFrom || !dispoTo || dispoFrom >= dispoTo) { setDispoEtat('vide'); return }
    const ctrl = new AbortController()
    setDispoEtat('chargement')
    const params = new URLSearchParams({ start: dispoFrom, end: dispoTo })
    fetch(`/api/vehicles/availability?${params}`, { signal: ctrl.signal })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('indisponible'))))
      .then(d => { setDispo(d.dispo ?? {}); setDispoEtat('ok') })
      .catch(e => { if (e?.name !== 'AbortError') setDispoEtat('echec') })
    return () => ctrl.abort()
  }, [showDispo, dispoFrom, dispoTo])

  /** Un véhicule sans entrée est considéré libre : la réponse ne l'a pas signalé. */
  const estLibre = (id: string) => !dispo[id] || dispo[id].raison === null
  const creneauxDe = (id: string) => dispo[id]?.creneaux ?? []

  // ── Disponibilité À L'INSTANT, pour « Démarrer maintenant » ────────────────
  // Le panneau ci-dessus répond sur une période choisie ; ce formulaire-ci part
  // tout de suite. Il interroge donc la même route sur la fenêtre que le serveur
  // contrôle réellement (l'heure courante plus le repli d'une heure), pour que la
  // liste ne propose jamais une voiture que l'enregistrement refuserait.
  //
  // Ajouté le 02/08/2026 : jusque-là la liste proposait toute la flotte, et Jeff
  // a pu lancer un déplacement sur une Citroën C3 partie chez un client.
  const [dispoNow, setDispoNow] = useState<Record<string, Dispo>>({})
  const [dispoNowPret, setDispoNowPret] = useState(false)
  useEffect(() => {
    if (!showStartForm) return
    const ctrl = new AbortController()
    setDispoNowPret(false)
    const debut = new Date()
    const fin = new Date(debut.getTime() + 60 * 60 * 1000)
    const params = new URLSearchParams({
      start: toDatetimeLocal(debut.toISOString()),
      end: toDatetimeLocal(fin.toISOString()),
    })
    fetch(`/api/vehicles/availability?${params}`, { signal: ctrl.signal })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('indisponible'))))
      .then(d => { setDispoNow(d.dispo ?? {}); setDispoNowPret(true) })
      // Échec réseau : on laisse la liste complète plutôt que de bloquer tout
      // départ. Le contrôle serveur reste le dernier mot.
      .catch(e => { if (e?.name !== 'AbortError') setDispoNowPret(false) })
    return () => ctrl.abort()
  }, [showStartForm])

  /** Motif qui empêche ce véhicule de partir maintenant, sinon null. */
  const prisMaintenant = (id: string): string | null => {
    if (!dispoNowPret) return null
    const d = dispoNow[id]
    return d?.raison ? (RAISON[d.raison] ?? 'indisponible') : null
  }

  // Trois groupes dans cet ordre : libres sur toute la période, libres sur une
  // partie seulement, pris de bout en bout. L'ordre de la flotte est conservé
  // dans chaque groupe (tri stable).
  const rang = (id: string) => (estLibre(id) ? 0 : creneauxDe(id).length > 0 ? 1 : 2)
  const vehiculesTries = [...vehicles].sort((a, b) => rang(a.id) - rang(b.id))
  const nbLibres = vehicles.filter(v => estLibre(v.id)).length
  const nbPartiels = vehicles.filter(v => !estLibre(v.id) && creneauxDe(v.id).length > 0).length

  /** Ouvre le tiroir de modification sur un déplacement planifié ou en cours. */
  function openEdit(t: Trip) {
    setEditingTrip(t)
    setEditStart(toDatetimeLocal(t.start_datetime))
    setEditPurpose(t.purpose)
    setError(null)
  }

  async function run(fn: () => Promise<{ error?: string; success?: boolean } | undefined>, okMsg: string) {
    setLoading(true); setError(null)
    try {
      const result = await fn()
      if (result?.error) { setError(result.error); return }
      show(okMsg, 'success'); reset(); router.refresh()
    } catch {
      setError('Erreur réseau : l’action n’a pas abouti. Réessayez.')
    } finally {
      setLoading(false)
    }
  }

  const handleStart        = (fd: FormData) => { run(() => startTrip(fd), 'Déplacement démarré') }
  const handlePlan          = (fd: FormData) => { run(() => planTrip(fd), 'Déplacement planifié') }
  const handleEnd           = (fd: FormData) => { if (endingTrip) run(() => endTrip(endingTrip.id, fd), 'Déplacement terminé') }
  const handleStartPlanned = (fd: FormData) => { if (startingPlanned) run(() => startPlannedTrip(startingPlanned.id, fd), 'Déplacement démarré') }
  const handleUpdate       = (fd: FormData) => { if (editingTrip) run(() => updateTrip(editingTrip.id, fd), 'Déplacement modifié') }

  async function handleAssign(fd: FormData) {
    if (!assigningTrip) return
    const userId = fd.get('user_id') as string
    if (!userId) { setError('Choisissez un conducteur'); return }
    run(() => assignTrip(assigningTrip.id, userId), 'Déplacement assigné')
  }

  function handleDelete() {
    if (deletingTrip) run(() => deleteTrip(deletingTrip.id), 'Déplacement supprimé')
  }

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <button type="button"
          onClick={() => setShowPlanForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-900 rounded-xl font-medium hover:bg-gray-50 transition-colors text-sm"
        >
          <CalendarClock className="w-4 h-4" /> Planifier un déplacement
        </button>
        <button type="button"
          onClick={() => setShowStartForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#111111] text-white rounded-xl font-medium hover:bg-gray-800 transition-colors text-sm"
        >
          <Plus className="w-4 h-4" /> Démarrer maintenant
        </button>
        {/* Choix d'un véhicule, comme dans Réservations : on veut savoir où en
            est une voiture précise avant de lui poser un déplacement. */}
        <VehiclePicker vehicles={vehicles} selected={vehiculeChoisi} basePath="/internal-trips" />
      </div>

      {situation && (
        <VehicleSituationCard
          situation={situation}
          action={
            situation.libre ? (
              <button
                type="button"
                onClick={() => { setPlanVehicleId(vehiculeChoisi ?? ''); setError(null); setShowPlanForm(true) }}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#111111] bg-white px-3 py-2 rounded-lg"
              >
                <CalendarClock className="w-3.5 h-3.5" /> Planifier un déplacement
              </button>
            ) : (
              // Voiture occupée : on ne ferme pas la porte, on montre les trous
              // réellement libres entre deux locations. C'est la demande de Jeff
              // du 02/08/2026, « prendre en compte les réservations entre dates
              // disponibles ».
              <button
                type="button"
                onClick={ouvrirDispo}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#111111] bg-white px-3 py-2 rounded-lg"
              >
                <CalendarClock className="w-3.5 h-3.5" /> Voir les créneaux libres
              </button>
            )
          }
        />
      )}

      {/* Recherche locale, toujours visible : c'est elle qui ouvre le panneau
          de disponibilité, même quand aucun déplacement n'existe encore. */}
      <div className="space-y-3">
        <div className="relative">
          <label htmlFor="trips-search" className="sr-only">Rechercher un déplacement ou voir les véhicules disponibles</label>
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            id="trips-search"
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onFocus={ouvrirDispo}
            onClick={ouvrirDispo}
            placeholder="Rechercher, ou voir les véhicules disponibles…"
            autoComplete="off"
            className="w-full bg-white border border-gray-100 shadow-sm rounded-xl pl-10 pr-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10"
          />
        </div>

        {/* Disponibilité de la flotte sur une période */}
        {showDispo && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">Véhicules disponibles</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {dispoEtat === 'ok'
                    ? `${nbLibres} libre${nbLibres > 1 ? 's' : ''}${nbPartiels > 0 ? ` · ${nbPartiels} avec un créneau` : ''} sur ${vehicles.length} · touchez pour planifier`
                    : 'Choisissez la période du déplacement'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDispo(false)}
                aria-label="Fermer la disponibilité"
                className="-mr-1 -mt-1 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="dispo-from" className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Du</label>
                <DateTimeField id="dispo-from" value={dispoFrom} onChange={setDispoFrom} className="px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm bg-white" />
              </div>
              <div>
                <label htmlFor="dispo-to" className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Au</label>
                <DateTimeField id="dispo-to" value={dispoTo} onChange={setDispoTo} min={dispoFrom || undefined} className="px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm bg-white" />
              </div>
            </div>

            {dispoEtat === 'vide' && (
              <p className="text-xs text-gray-400">Renseignez une période complète pour voir la flotte.</p>
            )}
            {dispoEtat === 'chargement' && (
              <p className="text-xs text-gray-400 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Vérification de la flotte…</p>
            )}
            {dispoEtat === 'echec' && (
              <p className="text-xs text-red-600">Disponibilité indisponible pour le moment. Réessayez.</p>
            )}
            {dispoEtat === 'ok' && vehicles.length === 0 && (
              <p className="text-xs text-gray-400">Aucun véhicule dans la flotte.</p>
            )}
            {dispoEtat === 'ok' && vehicles.length > 0 && (
              <div className="border border-gray-100 rounded-xl divide-y divide-gray-50 overflow-hidden max-h-72 overflow-y-auto">
                {vehiculesTries.map(v => {
                  const d = dispo[v.id]
                  const libre = estLibre(v.id)
                  const creneaux = creneauxDe(v.id)
                  // Trois cas, du meilleur au pire : libre partout, libre par
                  // morceaux (on annonce le premier trou), pris de bout en bout.
                  // Un retour non fait n'a pas d'heure à annoncer.
                  const motif = d?.raison ? (RAISON[d.raison] ?? 'indisponible') : ''
                  const detail = libre
                    ? 'Libre sur la période'
                    : creneaux.length > 0
                      ? `Libre ${creneaux[0].libelle}${creneaux.length > 1 ? ` · +${creneaux.length - 1} autre créneau` : ''}`
                      : d?.retourInconnu
                        ? (d.raison ? RAISON_RETOUR_INCONNU[d.raison] ?? motif : 'retour inconnu')
                        : d?.jusqua
                          ? `${motif} jusqu'au ${d.jusqua}`
                          : motif
                  // Vert = utilisable tout de suite, ambre = à regarder de près.
                  const couleurTexte = libre || creneaux.length > 0 ? 'text-green-600' : 'text-amber-600'
                  const couleurPastille = libre ? 'bg-green-500' : creneaux.length > 0 ? 'bg-green-300' : 'bg-amber-400'
                  return (
                    <div key={v.id}>
                      <button
                        type="button"
                        onClick={() => planifierDepuisDispo(v, creneaux[0])}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors"
                      >
                        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${couleurPastille}`} aria-hidden />
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-semibold text-gray-900 truncate">
                            {vehicleName(v)} <span className="text-xs font-mono font-normal text-gray-400">{v.plate}</span>
                          </span>
                          <span className={`block text-xs truncate ${couleurTexte}`}>{detail}</span>
                        </span>
                        <CalendarClock className="w-4 h-4 text-gray-300 flex-shrink-0" />
                      </button>
                      {/* Plusieurs trous libres : un bouton par créneau, sinon le
                          clic sur la ligne ne pourrait proposer que le premier.
                          Rangée qui défile pour ne jamais déborder sur téléphone. */}
                      {creneaux.length > 1 && (
                        <div className="flex gap-2 overflow-x-auto px-3 pb-2.5 -mt-0.5">
                          {creneaux.map(c => (
                            <button
                              key={c.debut}
                              type="button"
                              onClick={() => planifierDepuisDispo(v, c)}
                              className="flex-shrink-0 px-2.5 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-medium hover:bg-green-100 transition-colors"
                            >
                              {c.libelle}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Planned trips */}
      {plannedTrips.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-blue-500" /> Planifiés ({plannedTrips.length})
          </h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {plannedTrips.map(t => (
              <div key={t.id} className="bg-white rounded-2xl border-2 border-blue-100 shadow-sm p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 truncate">{vehicleName(t.vehicle)}</p>
                    <p className="text-xs text-gray-400 font-mono">{t.vehicle?.plate}</p>
                  </div>
                  <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full font-medium max-w-[55%] truncate">
                    {tripLabel(t)}
                  </span>
                </div>
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <CalendarClock className="w-3.5 h-3.5 flex-shrink-0" /> {tripWindow(t)}
                </p>
                <p className="text-xs mt-1 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-gray-400" />
                  {t.user?.full_name
                    ? <span className="text-gray-600">{t.user.full_name}</span>
                    : <span className="text-amber-600 font-medium">Non assigné</span>}
                </p>
                {/* Motif « autre » : la précision EST déjà le libellé du badge → pas de doublon. */}
                {t.purpose_notes && t.purpose !== 'autre' && <p className="text-xs text-gray-400 mt-1">{t.purpose_notes}</p>}

                <div className="mt-3 flex gap-2">
                  {!t.user_id && isManager && (
                    <button type="button"
                      onClick={() => { setAssigningTrip(t); setError(null) }}
                      className="flex-1 py-2 bg-[#111111] text-white rounded-xl text-sm font-medium hover:bg-gray-900 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <UserPlus className="w-4 h-4" /> Assigner
                    </button>
                  )}
                  {t.user_id && canManageTrip(t) && (
                    <button type="button"
                      onClick={() => { setStartingPlanned(t); setSelectedVehicle(vehicleById(t.vehicle_id)); setError(null) }}
                      className="flex-1 py-2 bg-[#111111] text-white rounded-xl text-sm font-medium hover:bg-gray-900 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Play className="w-4 h-4" /> Démarrer
                    </button>
                  )}
                  {canManageTrip(t) && (
                    <button type="button"
                      onClick={() => openEdit(t)}
                      className="px-3 py-2 border border-gray-200 text-gray-500 rounded-xl text-sm font-medium hover:bg-gray-50 hover:text-gray-900 transition-colors"
                      title="Modifier"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                  {canManageTrip(t) && (
                    <button type="button"
                      onClick={() => { setDeletingTrip(t); setError(null) }}
                      className="px-3 py-2 border border-gray-200 text-gray-500 rounded-xl text-sm font-medium hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active trips */}
      {activeTrips.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-green-500" /> En cours ({activeTrips.length})
          </h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {activeTrips.map(t => (
              <div key={t.id} className="bg-white rounded-2xl border-2 border-green-200 shadow-sm p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 truncate">{vehicleName(t.vehicle)}</p>
                    <p className="text-xs text-gray-400 font-mono">{t.vehicle?.plate}</p>
                  </div>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium max-w-[55%] truncate">
                    {tripLabel(t)}
                  </span>
                </div>
                <p className="text-xs text-gray-400">Depuis {formatDateTime(t.start_datetime)}</p>
                {t.end_datetime && t.end_datetime > t.start_datetime && (
                  <p className="text-xs text-gray-400">Retour prévu : {formatDateTime(t.end_datetime)}</p>
                )}
                {t.km_start != null && <p className="text-xs text-gray-400">KM départ : {t.km_start.toLocaleString('fr-FR')}</p>}
                {t.user?.full_name && <p className="text-xs text-gray-400">Conducteur : {t.user.full_name}</p>}
                {canManageTrip(t) && (
                  <div className="mt-3 flex gap-2">
                    <button type="button"
                      onClick={() => setEndingTrip(t)}
                      className="flex-1 py-2 bg-[#111111] text-white rounded-xl text-sm font-medium hover:bg-gray-900 transition-colors"
                    >
                      Terminer le déplacement
                    </button>
                    <button type="button"
                      onClick={() => openEdit(t)}
                      className="px-3 py-2 border border-gray-200 text-gray-500 rounded-xl text-sm font-medium hover:bg-gray-50 hover:text-gray-900 transition-colors"
                      title="Modifier"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button type="button"
                      onClick={() => { setDeletingTrip(t); setError(null) }}
                      className="px-3 py-2 border border-gray-200 text-gray-500 rounded-xl text-sm font-medium hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History */}
      <div>
        <h3 className="font-semibold text-gray-800 mb-3">Historique</h3>
        {completedTrips.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <Navigation className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">{q ? 'Aucun déplacement terminé ne correspond' : 'Aucun déplacement terminé'}</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
            {completedTrips.map(t => {
              const distance = t.km_end != null && t.km_start != null ? t.km_end - t.km_start : 0
              return (
                <div key={t.id} className="flex items-center gap-4 px-4 py-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 text-sm truncate">{vehicleName(t.vehicle)}</p>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full truncate max-w-[50%]">{tripLabel(t)}</span>
                    </div>
                    <p className="text-xs text-gray-500">
                      <span className="font-mono text-gray-400">{t.vehicle?.plate}</span>
                      {t.user?.full_name ? ` · ${t.user.full_name}` : ''} · {formatDateTime(t.start_datetime)}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-gray-900">{distance} km</p>
                    {(t.tolls_amount || t.expenses_amount) && (
                      <p className="text-xs text-gray-400">
                        {formatPrice((t.tolls_amount ?? 0) + (t.expenses_amount ?? 0))}
                      </p>
                    )}
                  </div>
                  {canManageTrip(t) && (
                    <button type="button"
                      onClick={() => { setDeletingTrip(t); setError(null) }}
                      className="flex-shrink-0 p-2 text-gray-300 rounded-lg hover:bg-red-50 hover:text-red-500 transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Plan Drawer */}
      <Drawer open={showPlanForm} onClose={reset} title="Planifier un déplacement">
        <form action={handlePlan} className="space-y-4">
          <div>
            <label htmlFor="plan-vehicle" className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Véhicule *</label>
            <select id="plan-vehicle" name="vehicle_id" required defaultValue={planVehicleId} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm bg-white">
              <option value="">· Choisir ·</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.brand} {v.model} · {v.plate}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="plan-start" className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Début *</label>
            <DateTimeField id="plan-start" name="start_datetime" required defaultValue={planStart} onChange={setPlanStart} className="px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm bg-white" />
          </div>
          <div>
            <label htmlFor="plan-end" className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Fin *</label>
            <DateTimeField id="plan-end" name="end_datetime" required defaultValue={planEnd} min={planStart || undefined} className="px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm bg-white" />
            <p className="text-[11px] text-gray-400 mt-1">Le véhicule est indisponible sur ce créneau (flotte, calendrier, réservations).</p>
          </div>
          <div>
            <label htmlFor="plan-purpose" className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Motif *</label>
            <select
              id="plan-purpose"
              name="purpose"
              required
              value={planPurpose}
              onChange={e => setPlanPurpose(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm bg-white"
            >
              {PURPOSES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="plan-notes" className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">
              {planPurpose === 'autre' ? 'Préciser le motif *' : 'Notes'}
            </label>
            <input
              id="plan-notes"
              type="text"
              name="purpose_notes"
              required={planPurpose === 'autre'}
              placeholder={planPurpose === 'autre' ? 'Ex. campagne de pub, usage particulier…' : 'Détails...'}
              enterKeyHint="done"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm"
            />
          </div>
          {isManager ? (
            <div>
              <label htmlFor="plan-driver" className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Conducteur</label>
              <select id="plan-driver" name="user_id" defaultValue="none" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm bg-white">
                <option value="none">· Non assigné ·</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
              </select>
              <p className="text-[11px] text-gray-400 mt-1">Laissez « Non assigné » pour attribuer plus tard.</p>
            </div>
          ) : (
            <p className="text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2">Ce déplacement vous sera assigné.</p>
          )}
          {error && <div className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</div>}
          <p className="text-[11px] text-gray-400">* Champ obligatoire</p>
          <button type="submit" disabled={loading} className="w-full py-3 bg-[#111111] text-white rounded-xl font-semibold disabled:opacity-50 transition-colors active:scale-[.97]">
            {loading ? 'Planification...' : 'Planifier'}
          </button>
        </form>
      </Drawer>

      {/* Assign Drawer */}
      <Drawer open={!!assigningTrip} onClose={reset} title={`Assigner · ${vehicleName(assigningTrip?.vehicle)}`}>
        <form action={handleAssign} className="space-y-4">
          <div>
            <label htmlFor="assign-driver" className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Conducteur *</label>
            <select id="assign-driver" name="user_id" required defaultValue="" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm bg-white">
              <option value="">· Choisir ·</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
            </select>
          </div>
          {error && <div className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</div>}
          <button type="submit" disabled={loading} className="w-full py-3 bg-[#111111] text-white rounded-xl font-semibold disabled:opacity-50 transition-colors active:scale-[.97]">
            {loading ? 'Assignation...' : 'Assigner'}
          </button>
        </form>
      </Drawer>

      {/* Start-planned Drawer */}
      <Drawer open={!!startingPlanned} onClose={reset} title={`Démarrer · ${vehicleName(startingPlanned?.vehicle)}`}>
        <form action={handleStartPlanned} className="space-y-4">
          <div>
            <label htmlFor="startp-km" className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">
              KM départ * {selectedVehicle && <span className="text-gray-400 font-normal">(actuel: {selectedVehicle.current_km?.toLocaleString('fr-FR') ?? '—'})</span>}
            </label>
            <input id="startp-km" type="number" name="km_start" required defaultValue={selectedVehicle?.current_km} inputMode="numeric" enterKeyHint="next" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm" />
          </div>
          <div>
            <label htmlFor="trip-plan-fuel-start" className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Autonomie carburant (km)</label>
            <input id="trip-plan-fuel-start" type="number" name="fuel_start" min="0" placeholder="Autonomie en km" inputMode="numeric" enterKeyHint="done" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm" />
          </div>
          {error && <div className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</div>}
          <button type="submit" disabled={loading} className="w-full py-3 bg-[#111111] text-white rounded-xl font-semibold disabled:opacity-50 transition-colors active:scale-[.97]">
            {loading ? 'Démarrage...' : 'Démarrer le déplacement'}
          </button>
        </form>
      </Drawer>

      {/* Start Drawer (immédiat) */}
      <Drawer open={showStartForm} onClose={reset} title="Démarrer un déplacement">
        <form action={handleStart} className="space-y-4">
          <div>
            <label htmlFor="start-vehicle" className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Véhicule *</label>
            <select
              id="start-vehicle"
              name="vehicle_id"
              required
              onChange={e => setSelectedVehicle(vehicles.find(v => v.id === e.target.value) ?? null)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm bg-white"
            >
              <option value="">· Choisir ·</option>
              {/* Un véhicule occupé reste visible mais ne se choisit pas : le
                  masquer laisserait croire qu'il n'existe pas. */}
              {vehicles.map(v => {
                const pris = prisMaintenant(v.id)
                return (
                  <option key={v.id} value={v.id} disabled={!!pris}>
                    {v.brand} {v.model} · {v.plate}{pris ? ` — ${pris}` : ''}
                  </option>
                )
              })}
            </select>
            {dispoNowPret && (
              <p className="text-[11px] text-gray-400 mt-1">
                {vehicles.filter(v => !prisMaintenant(v.id)).length} véhicule(s) disponible(s) maintenant.
                Les autres sont en location, au garage ou déjà en déplacement.
              </p>
            )}
          </div>
          <div>
            <label htmlFor="start-purpose" className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Motif *</label>
            <select
              id="start-purpose"
              name="purpose"
              required
              value={startPurpose}
              onChange={e => setStartPurpose(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm bg-white"
            >
              {PURPOSES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="start-notes" className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">
              {startPurpose === 'autre' ? 'Préciser le motif *' : 'Notes'}
            </label>
            <input
              id="start-notes"
              type="text"
              name="purpose_notes"
              required={startPurpose === 'autre'}
              placeholder={startPurpose === 'autre' ? 'Ex. campagne de pub, usage particulier…' : 'Détails...'}
              enterKeyHint="done"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm"
            />
          </div>
          {isManager && (
            <div>
              <label htmlFor="start-driver" className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Conducteur</label>
              <select id="start-driver" name="user_id" defaultValue={currentUserId} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm bg-white">
                {members.map(m => <option key={m.id} value={m.id}>{m.full_name}{m.id === currentUserId ? ' (moi)' : ''}</option>)}
              </select>
            </div>
          )}
          <div>
            <label htmlFor="start-km" className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">
              KM départ * {selectedVehicle && <span className="text-gray-400 font-normal">(actuel: {selectedVehicle.current_km?.toLocaleString('fr-FR') ?? '—'})</span>}
            </label>
            <input
              id="start-km"
              type="number"
              name="km_start"
              required
              defaultValue={selectedVehicle?.current_km}
              inputMode="numeric"
              enterKeyHint="next"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm"
            />
          </div>
          <div>
            <label htmlFor="trip-start-fuel-start" className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Autonomie carburant (km)</label>
            <input id="trip-start-fuel-start" type="number" name="fuel_start" min="0" placeholder="Autonomie en km" inputMode="numeric" enterKeyHint="next" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm" />
          </div>
          {error && <div className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</div>}
          <p className="text-[11px] text-gray-400">* Champ obligatoire</p>
          <button type="submit" disabled={loading} className="w-full py-3 bg-[#111111] text-white rounded-xl font-semibold disabled:opacity-50 transition-colors active:scale-[.97]">
            {loading ? 'Démarrage...' : 'Démarrer'}
          </button>
        </form>
      </Drawer>

      {/* End Drawer */}
      <Drawer open={!!endingTrip} onClose={reset} title={`Terminer · ${vehicleName(endingTrip?.vehicle)}`}>
        <form action={handleEnd} className="space-y-4">
          <div>
            <label htmlFor="end-km" className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">
              KM retour * <span className="text-gray-400 font-normal">(départ: {endingTrip?.km_start?.toLocaleString('fr-FR') ?? '—'})</span>
            </label>
            <input id="end-km" type="number" name="km_end" required min={endingTrip?.km_start ?? undefined} defaultValue={endingTrip?.km_start ?? undefined} inputMode="numeric" enterKeyHint="next" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm font-bold" />
          </div>
          <div>
            <label htmlFor="trip-end-fuel-end" className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Autonomie carburant (km)</label>
            <input id="trip-end-fuel-end" type="number" name="fuel_end" min="0" placeholder="Autonomie en km" inputMode="numeric" enterKeyHint="next" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="end-tolls" className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Péages (€)</label>
              <input id="end-tolls" type="number" name="tolls_amount" step="0.01" inputMode="decimal" enterKeyHint="next" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm" />
            </div>
            <div>
              <label htmlFor="end-expenses" className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Dépenses (€)</label>
              <input id="end-expenses" type="number" name="expenses_amount" step="0.01" inputMode="decimal" enterKeyHint="done" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm" />
            </div>
          </div>
          {error && <div className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</div>}
          <p className="text-[11px] text-gray-400">* Champ obligatoire</p>
          <button type="submit" disabled={loading} className="w-full py-3 bg-[#111111] text-white rounded-xl font-semibold disabled:opacity-50 transition-colors active:scale-[.97]">
            {loading ? 'Enregistrement...' : 'Terminer le déplacement'}
          </button>
        </form>
      </Drawer>

      {/* Edit Drawer (déplacement planifié ou en cours) */}
      {/* Le bouton d'enregistrement est passé dans la barre du bas de la fenêtre
          (`footer`) : ce formulaire est le plus long de l'écran et dépassait la
          hauteur d'un iPhone, obligeant à faire défiler pour l'atteindre
          (retour Jeff du 29/07/2026). Il reste rattaché au formulaire par
          `form="edit-trip-form"`, puisqu'il est désormais écrit en dehors. */}
      <Drawer
        open={!!editingTrip}
        onClose={reset}
        title={`Modifier · ${vehicleName(editingTrip?.vehicle)}`}
        footer={
          <button type="submit" form="edit-trip-form" disabled={loading} className="w-full py-3 bg-[#111111] text-white rounded-xl font-semibold disabled:opacity-50 transition-colors active:scale-[.97]">
            {loading ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        }
      >
        <form id="edit-trip-form" action={handleUpdate} className="space-y-4">
          <p className="text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2">
            Le véhicule ne se change pas : il est engagé sur ce déplacement.
            {/* Le carburant DE DÉPART a été saisi au démarrage, il n'est pas ici :
                l'annoncer avec ceux de la clôture ferait croire au gérant qu'il
                n'a rien relevé au départ. */}
            {editingTrip?.status === 'en_cours' && ' Le KM de retour, le carburant au retour, les péages et les frais se saisissent à la clôture. Le carburant relevé au départ ne se corrige pas ici.'}
          </p>
          <div>
            <label htmlFor="edit-start" className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">
              {editingTrip?.status === 'en_cours' ? 'Départ réel *' : 'Début prévu *'}
            </label>
            {/* `key` : le tiroir reste monté d'un déplacement à l'autre, sans quoi
                les champs garderaient les dates du déplacement précédemment ouvert. */}
            <DateTimeField
              key={`${editingTrip?.id}-start`}
              id="edit-start"
              name="start_datetime"
              required
              defaultValue={editingTrip ? toDatetimeLocal(editingTrip.start_datetime) : ''}
              onChange={setEditStart}
              className="px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm bg-white"
            />
          </div>
          <div>
            <label htmlFor="edit-end" className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Retour prévu *</label>
            <DateTimeField
              key={`${editingTrip?.id}-end`}
              id="edit-end"
              name="end_datetime"
              required
              defaultValue={editingTrip?.end_datetime ? toDatetimeLocal(editingTrip.end_datetime) : ''}
              min={editStart || undefined}
              className="px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm bg-white"
            />
            {/* Ce que cette date fait vraiment, et ce qu'elle ne fait pas : sur un
                déplacement en cours, la flotte compte le véhicule dehors jusqu'à la
                clôture, quelle que soit la date affichée ici. */}
            <p className="text-[11px] text-gray-400 mt-1">
              {editingTrip?.status === 'en_cours'
                ? 'Cette date bloque le calendrier et les réservations. Le véhicule reste compté hors flotte jusqu’à ce que vous terminiez le déplacement, même après cette date.'
                : 'Le véhicule est indisponible sur ce créneau (flotte, calendrier, réservations).'}
            </p>
          </div>
          <div>
            <label htmlFor="edit-purpose" className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Motif *</label>
            <select
              id="edit-purpose"
              name="purpose"
              required
              value={editPurpose}
              onChange={e => setEditPurpose(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm bg-white"
            >
              {PURPOSES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="edit-notes" className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">
              {editPurpose === 'autre' ? 'Préciser le motif *' : 'Notes'}
            </label>
            <input
              key={`${editingTrip?.id}-notes`}
              id="edit-notes"
              type="text"
              name="purpose_notes"
              required={editPurpose === 'autre'}
              defaultValue={editingTrip?.purpose_notes ?? ''}
              placeholder={editPurpose === 'autre' ? 'Ex. campagne de pub, usage particulier…' : 'Détails...'}
              enterKeyHint="done"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm"
            />
          </div>
          {isManager && (
            <div>
              <label htmlFor="edit-driver" className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">
                Conducteur {editingTrip?.status === 'en_cours' && '*'}
              </label>
              <select
                key={`${editingTrip?.id}-driver`}
                id="edit-driver"
                name="user_id"
                defaultValue={editingTrip?.user_id ?? 'none'}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm bg-white"
              >
                {editingTrip?.status !== 'en_cours' && <option value="none">· Non assigné ·</option>}
                {members.map(m => <option key={m.id} value={m.id}>{m.full_name}{m.id === currentUserId ? ' (moi)' : ''}</option>)}
              </select>
              <p className="text-[11px] text-gray-400 mt-1">C’est la personne désignée si une infraction tombe sur cette période.</p>
            </div>
          )}
          {/* KM de départ : un déplacement planifié n'en a pas encore, il est
              relevé au démarrage. */}
          {editingTrip?.status === 'en_cours' && (
            <div>
              <label htmlFor="edit-km" className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">
                KM départ {editVehicle && <span className="text-gray-400 font-normal">(compteur: {editVehicle.current_km?.toLocaleString('fr-FR') ?? '—'})</span>}
              </label>
              <input
                key={`${editingTrip?.id}-km`}
                id="edit-km"
                type="number"
                name="km_start"
                min="0"
                defaultValue={editingTrip?.km_start ?? undefined}
                inputMode="numeric"
                enterKeyHint="done"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/20 text-sm"
              />
            </div>
          )}
          {error && <div className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</div>}
          <p className="text-[11px] text-gray-400">* Champ obligatoire</p>
        </form>
      </Drawer>

      {/* Delete confirmation Drawer */}
      <Drawer open={!!deletingTrip} onClose={reset} title="Supprimer le déplacement">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Supprimer définitivement ce déplacement{deletingTrip?.vehicle ? ` (${vehicleName(deletingTrip.vehicle)} · ${deletingTrip.vehicle.plate})` : ''} ?
            {deletingTrip?.status === 'termine' && ' Les charges de péages/frais liées seront aussi retirées de la comptabilité.'}
          </p>
          {error && <div className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</div>}
          <div className="flex gap-2">
            <button type="button" onClick={reset} disabled={loading} className="flex-1 py-3 border border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50">
              Annuler
            </button>
            <button type="button" onClick={handleDelete} disabled={loading} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 active:scale-[.97]">
              {loading ? 'Suppression...' : 'Supprimer'}
            </button>
          </div>
        </div>
      </Drawer>
    </div>
  )
}
