import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, ClipboardList } from 'lucide-react'
import SmartSearch from '@/components/ui/SmartSearch'
import { formatPrice, reservationDiscount } from '@/lib/utils'
import DeleteReservationButton from './DeleteReservationButton'
import VehicleFilter from './VehicleFilter'
import PaymentCountdownMini from './PaymentCountdownMini'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { AnimatedList, AnimatedListItem } from '@/components/AnimatedList'

// ─── Statuts ──────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; bar: string; badge: string }> = {
  option:    { label: 'À venir',     bar: 'bg-gray-300',   badge: 'bg-gray-100 text-gray-600' },
  confirmee: { label: 'Confirmée',  bar: 'bg-blue-400',   badge: 'bg-blue-50 text-blue-700' },
  en_cours:  { label: 'En location', bar: 'bg-green-500', badge: 'bg-green-50 text-green-700' },
  en_retard: { label: 'En retard',  bar: 'bg-red-500',    badge: 'bg-red-50 text-red-700' },
  terminee:  { label: 'Terminée',   bar: 'bg-gray-200',   badge: 'bg-gray-100 text-gray-500' },
  annulee:   { label: 'Annulée',    bar: 'bg-gray-100',   badge: 'bg-gray-50 text-gray-400' },
  non_presente: { label: 'Client non présenté', bar: 'bg-amber-400', badge: 'bg-amber-100 text-amber-800' },
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; vehicle?: string; q?: string }>
}) {
  const { status, vehicle, q } = await searchParams
  const supabase = await createClient()

  // Mise à jour auto des retards
  await supabase
    .from('reservations')
    .update({ status: 'en_retard' })
    .eq('status', 'en_cours')
    .lt('end_datetime', new Date().toISOString())

  // Véhicules du filtre. La page savait déjà filtrer par véhicule, mais rien ne
  // permettait d'en choisir un sans connaître son identifiant.
  const { data: vehiclesList } = await supabase
    .from('vehicles')
    .select('id, brand, model, plate')
    .eq('is_active', true)
    .order('brand')

  // Compteurs par statut (avant filtre)
  const { data: allRes } = await supabase
    .from('reservations')
    .select('status')
  const counts: Record<string, number> = {}
  for (const r of allRes ?? []) {
    counts[r.status] = (counts[r.status] ?? 0) + 1
  }

  // Requête filtrée
  let query = supabase
    .from('reservations')
    .select(
      '*, vehicle:vehicles(plate, brand, model, color, weekly_price), client:clients(first_name, last_name, phone)'
    )
    .order('start_datetime', { ascending: false })

  // « En location » = les voitures qui sont dehors, en retard ou non. Une
  // location dont l'heure de retour est dépassée bascule toute seule en
  // « en retard » (la mise à jour tout en haut de cette page), mais la voiture
  // n'est pas rentrée pour autant : c'est le sens métier, elle reste en
  // location. Le lien « Tout voir » du tableau de bord arrive ici avec
  // status=en_cours : la correction porte sur la lecture du paramètre, pas sur
  // le lien, et profite donc aux deux.
  //
  // ⚠️ Les deux écrans ne disent pas la même chose pour autant, et il ne faut
  // pas le croire : le compteur « En location » de l'accueil ajoute deux cas
  // que cette liste ne ramène pas, les réservations confirmées dont le départ
  // est dépassé sans état des lieux, et les véhicules mis à disposition chez un
  // partenaire. Le nombre de l'accueil reste donc supérieur. L'écart se réduit,
  // il ne disparaît pas. Décision de Jeff du 29/07/2026.
  if (status === 'en_cours') query = query.in('status', ['en_cours', 'en_retard'])
  else if (status)           query = query.eq('status', status)
  if (vehicle) query = query.eq('vehicle_id', vehicle)

  const { data: rawReservations } = await query

  // Recherche texte (n° réservation, véhicule, client) — filtrée en JS pour
  // couvrir les colonnes jointes sans complexifier la requête PostgREST.
  const needle = q?.trim().toLowerCase()
  const reservations = needle
    ? (rawReservations ?? []).filter(r => {
        const v = r.vehicle as any
        const c = r.client as any
        const haystack = [
          r.reservation_number, v?.plate, v?.brand, v?.model, c?.first_name, c?.last_name, c?.phone,
        ].filter(Boolean).join(' ').toLowerCase()
        return haystack.includes(needle)
      })
    : (rawReservations ?? [])

  // Deux filtres de statut seulement, décision de Jeff du 29/07/2026 : « En
  // location » et « Terminée », plus le choix du véhicule. Les cinq autres ont
  // été retirés de la barre en connaissance de cause, ils ne sont pas repliés
  // derrière un bouton. Ce sont toujours des statuts à part entière : « Toutes »
  // affiche leurs réservations (aucun filtre de statut n'est alors posé sur la
  // requête), la pastille de couleur de chaque ligne les nomme, et le compteur
  // de retards de l'en-tête continue de les signaler. Seul le raccourci de
  // filtrage disparaît. « En retard » n'a plus de pastille propre parce que ces
  // locations sont désormais comprises dans « En location ».
  const statuses = ['en_cours', 'terminee']
  const total = reservations.length

  // ── Le véhicule choisi : quand revient-il, et est-il libre maintenant ? ──────
  // Le cas d'usage de Jeff (28/07/2026) : un client appelle pour une voiture
  // précise, on veut répondre tout de suite « elle rentre jeudi à 10h » sans
  // ouvrir un autre onglet, puis créer la réservation avec ce véhicule déjà
  // choisi. On travaille sur TOUTES ses réservations, pas sur la liste filtrée
  // par statut : sinon un filtre « Confirmée » masquerait la location en cours.
  const maintenant = new Date()
  let vehiculeChoisi: {
    label: string
    enCours?: { fin: Date; client: string; enRetard: boolean }
    suivante?: { debut: Date; client: string }
    precedente?: { fin: Date; client: string }
  } | null = null

  if (vehicle) {
    const v = (vehiclesList ?? []).find(x => x.id === vehicle)
    const { data: sesResas } = await supabase
      .from('reservations')
      .select('start_datetime, end_datetime, status, client:clients(first_name, last_name)')
      .eq('vehicle_id', vehicle)
      .not('status', 'in', '("annulee","non_presente")')
      .order('start_datetime', { ascending: true })

    const nom = (r: any) => {
      const c = Array.isArray(r.client) ? r.client[0] : r.client
      return c ? `${c.first_name} ${c.last_name}`.trim() : 'Client'
    }
    const lignes = (sesResas ?? []).map((r: any) => ({
      debut: new Date(r.start_datetime),
      fin: new Date(r.end_datetime),
      client: nom(r),
      statut: r.status as string,
    }))

    // Le STATUT prime sur les dates. Une location « en retard » a une fin déjà
    // passée alors que la voiture est toujours dehors : se fier à la date
    // seule l'annonçait « disponible », ce qui est faux et dangereux — on
    // pourrait la relouer. Constaté à l'écran le 28/07/2026 sur la BMW M135i.
    const dehors = lignes.find(l => l.statut === 'en_cours' || l.statut === 'en_retard')
    const enCours = dehors ?? lignes.find(l => l.debut <= maintenant && l.fin > maintenant)
    const suivante = lignes.find(l => l.debut > maintenant && l !== enCours)
    // La plus récente réellement rendue : utile pour savoir depuis quand la
    // voiture est au dépôt. « Terminée » uniquement, pour la même raison.
    const precedente = [...lignes].reverse().find(l => l.statut === 'terminee')

    vehiculeChoisi = {
      label: v ? `${[v.brand, v.model].filter(Boolean).join(' ')} · ${v.plate}` : 'Véhicule',
      enCours: enCours && { fin: enCours.fin, client: enCours.client, enRetard: enCours.statut === 'en_retard' },
      suivante: suivante && { debut: suivante.debut, client: suivante.client },
      precedente: precedente && { fin: precedente.fin, client: precedente.client },
    }
  }

  return (
    <div className="space-y-4">

      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-gray-900">Réservations</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {total} résultat{total !== 1 ? 's' : ''}
            {counts['en_retard'] > 0 && (
              <span className="ml-2 text-red-500 font-semibold">
                · {counts['en_retard']} en retard
              </span>
            )}
          </p>
        </div>
        {/* Un véhicule choisi suit dans « Nouvelle » : le client appelle pour
            cette voiture-là, on ne la resélectionne pas à la main. */}
        <Link
          href={vehicle ? `/reservations/new?vehicle=${vehicle}` : '/reservations/new'}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#111111] text-white rounded-xl font-semibold hover:bg-gray-800 transition-colors text-sm active:scale-[.98]"
        >
          <Plus className="w-4 h-4" />
          Nouvelle
        </Link>
      </div>

      {/* Recherche */}
      <form method="get">
        {status && <input type="hidden" name="status" value={status} />}
        {vehicle && <input type="hidden" name="vehicle" value={vehicle} />}
        <SmartSearch name="q" placeholder="Rechercher par n°, véhicule, client…" scope="reservations" defaultValue={q ?? ''} />
      </form>

      {/* Filtres : le véhicule, puis les statuts. La rangée doit tenir sur une
          seule ligne d'iPhone (358 px utiles) : les nombres entre parenthèses
          sont retirés et les pastilles resserrées, ce qui la ramène à ~350 px
          mesurés. Le défilement latéral reste en place comme filet, pour les
          écrans plus étroits que 390 px. */}
      <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
        <VehicleFilter vehicles={vehiclesList ?? []} selected={vehicle} />
        <Link
          href="/reservations"
          className={`px-2.5 py-2 min-h-[44px] flex items-center rounded-xl text-sm font-semibold whitespace-nowrap transition-colors flex-shrink-0 ${
            !status ? 'bg-[#111111] text-white' : 'bg-white border border-gray-100 text-gray-600 hover:bg-gray-50 shadow-sm'
          }`}
        >
          Toutes
        </Link>
        {statuses.map(s => {
          const cfg = STATUS_CONFIG[s] ?? { label: s, badge: '', bar: '' }
          // Les deux filtres restent affichés même à zéro : un filtre vide est
          // une information, un filtre absent est une lacune.
          return (
            <Link
              key={s}
              href={`/reservations?status=${s}`}
              className={`px-2.5 py-2 min-h-[44px] flex items-center rounded-xl text-sm font-semibold whitespace-nowrap transition-colors flex-shrink-0 ${
                status === s
                  ? 'bg-[#111111] text-white'
                  : 'bg-white border border-gray-100 text-gray-600 hover:bg-gray-50 shadow-sm'
              }`}
            >
              {cfg.label}
            </Link>
          )
        })}
      </div>

      {/* Le véhicule choisi, en une carte : disponible ou non, et quand */}
      {vehiculeChoisi && (
        <div className="bg-[#111111] text-white rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">{vehiculeChoisi.label}</p>
          {vehiculeChoisi.enCours ? (
            <>
              <p className={`text-lg font-black mt-1 ${vehiculeChoisi.enCours.enRetard ? 'text-red-400' : ''}`}>
                {vehiculeChoisi.enCours.enRetard ? 'Devait revenir le ' : 'Revient le '}
                {format(vehiculeChoisi.enCours.fin, "d MMMM 'à' HH:mm", { locale: fr })}
              </p>
              <p className="text-xs text-white/60 mt-0.5">
                {vehiculeChoisi.enCours.enRetard ? 'En retard' : 'En location'} · {vehiculeChoisi.enCours.client}
              </p>
            </>
          ) : (
            <>
              <p className="text-lg font-black mt-1 text-emerald-300">Disponible</p>
              {vehiculeChoisi.precedente && (
                <p className="text-xs text-white/60 mt-0.5">
                  Rentré le {format(vehiculeChoisi.precedente.fin, "d MMMM 'à' HH:mm", { locale: fr })} · {vehiculeChoisi.precedente.client}
                </p>
              )}
            </>
          )}
          {vehiculeChoisi.suivante && (
            <p className="text-xs text-white/60 mt-1.5 pt-1.5 border-t border-white/10">
              Repart le {format(vehiculeChoisi.suivante.debut, "d MMMM 'à' HH:mm", { locale: fr })} · {vehiculeChoisi.suivante.client}
            </p>
          )}
          <Link
            href={`/reservations/new?vehicle=${vehicle}`}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-[#111111] bg-white px-3 py-2 rounded-lg"
          >
            <Plus className="w-3.5 h-3.5" /> Réserver ce véhicule
          </Link>
        </div>
      )}

      {/* Liste */}
      {total === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <ClipboardList className="w-12 h-12 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-400 font-medium text-sm">
            {needle ? `Aucun résultat pour « ${q} »` : 'Aucune réservation'}
          </p>
          <Link
            href="/reservations/new"
            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-black underline underline-offset-2"
          >
            <Plus className="w-4 h-4" /> Créer une réservation
          </Link>
        </div>
      ) : (
        <AnimatedList className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
          {reservations.map(r => {
            const cfg = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.option
            const v   = r.vehicle as any
            const c   = r.client as any
            const startDate = new Date(r.start_datetime)
            const endDate   = new Date(r.end_datetime)
            const { discount } = reservationDiscount(r as any)

            // Chrono acompte : 2 h depuis la création tant que l'option attend son acompte.
            const acompteDeadline = r.status === 'option' && r.payment_status === 'en_attente' && (r as any).created_at
              ? new Date(new Date((r as any).created_at).getTime() + 2 * 60 * 60 * 1000).toISOString()
              : null

            return (
              <AnimatedListItem key={r.id}>
              <div className="flex items-stretch hover:bg-gray-50/80 transition-colors group">
                {/* Barre statut gauche */}
                <div className={`w-1 flex-shrink-0 ${cfg.bar}`} />

                <Link
                  href={`/reservations/${r.id}`}
                  className="flex-1 min-w-0 flex items-center gap-3 px-4 py-3.5"
                >
                  {/* Infos principales */}
                  <div className="flex-1 min-w-0">
                    {/* Ligne 1 : plaque + véhicule + badge */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-gray-900 text-sm">
                        {v?.brand} {v?.model}{v?.color ? ` · ${v.color}` : ''}
                      </span>
                      <span className="font-mono text-gray-400 text-xs">
                        {v?.plate}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${cfg.badge}`}>
                        {cfg.label}
                      </span>
                    </div>
                    {/* Ligne 2 : client */}
                    <div className="text-sm font-semibold text-gray-800 mt-0.5">
                      {c?.first_name} {c?.last_name}
                    </div>
                    {/* Ligne 3 : dates + n° + countdown paiement */}
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {/* L'heure, pas seulement le jour : « 30 juil. » ne dit pas
                          si la voiture revient le matin ou le soir, donc pas si
                          elle est relouable dans la journée. Demande de Jeff du
                          28/07/2026. */}
                      <span className="text-xs text-gray-400">
                        {format(startDate, "d MMM 'à' HH:mm", { locale: fr })}
                        {' → '}
                        {format(endDate, "d MMM 'à' HH:mm", { locale: fr })}
                      </span>
                      <span className="text-gray-200">·</span>
                      <span className="text-xs text-gray-300 font-mono">{r.reservation_number}</span>
                      {acompteDeadline && (
                        <PaymentCountdownMini reservationId={r.id} deadline={acompteDeadline} />
                      )}
                    </div>
                  </div>

                  {/* Prix (+ remise éventuelle) */}
                  <div className="text-right flex-shrink-0">
                    <span className="text-base font-extrabold text-gray-900">
                      {formatPrice(r.total_price)}
                    </span>
                    {discount > 0 && (
                      <span className="block text-[10px] font-bold text-emerald-600 leading-tight">
                        remise −{formatPrice(discount)}
                      </span>
                    )}
                  </div>
                </Link>

                {/* Bouton supprimer */}
                <div className="flex items-center pr-3 flex-shrink-0">
                  <DeleteReservationButton
                    reservationId={r.id}
                    reservationNumber={r.reservation_number}
                  />
                </div>
              </div>
              </AnimatedListItem>
            )
          })}
        </AnimatedList>
      )}
    </div>
  )
}
