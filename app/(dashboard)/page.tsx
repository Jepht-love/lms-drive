import { createClient } from '@/lib/supabase/server'
import { fetchAllAlerts } from '@/lib/utils/alerts'
import Link from 'next/link'
import {
  differenceInDays, format, isSameDay,
  startOfDay, endOfDay, addDays,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  ChevronRight, AlertTriangle, CheckCircle2, Plus,
  Wrench, Clock, FileText, type LucideIcon,
} from 'lucide-react'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getVehicle(r: any) { return Array.isArray(r.vehicles) ? r.vehicles[0] : r.vehicles }
function getClient(r: any)  { return Array.isArray(r.clients)  ? r.clients[0]  : r.clients  }

const TASK_STATUS_BADGE: Record<string, string> = {
  a_faire:  'bg-gray-100 text-gray-600',
  en_cours: 'bg-blue-50 text-blue-700',
  termine:  'bg-green-50 text-green-700',
  reporte:  'bg-orange-50 text-orange-700',
  annule:   'bg-red-50 text-red-600',
}
const TASK_STATUS_LABEL: Record<string, string> = {
  a_faire:  'À faire',
  en_cours: 'En cours',
  termine:  'Terminé',
  reporte:  'Reporté',
  annule:   'Annulé',
}
type AlertGroup = {
  type: string
  label: string
  icon: LucideIcon
  href: string
  cardBg: string; cardBorder: string
  labelColor: string; iconColor: string
  badgeBg: string; badgeText: string
}
const ALERT_GROUPS: AlertGroup[] = [
  { type: 'retard',   label: 'Retour en retard',      icon: AlertTriangle, href: '/reservations',
    cardBg: 'bg-red-50',    cardBorder: 'border-red-100',    labelColor: 'text-red-700',    iconColor: 'text-red-500',    badgeBg: 'bg-red-500',    badgeText: 'text-white' },
  { type: 'contrat',  label: 'Contrat à signer',       icon: FileText,      href: '/contracts',
    cardBg: 'bg-red-50',    cardBorder: 'border-red-100',    labelColor: 'text-red-700',    iconColor: 'text-red-500',    badgeBg: 'bg-red-500',    badgeText: 'text-white' },
  { type: 'ct',       label: 'Contrôle technique',     icon: AlertTriangle, href: '/vehicles',
    cardBg: 'bg-orange-50', cardBorder: 'border-orange-100', labelColor: 'text-orange-700', iconColor: 'text-orange-500', badgeBg: 'bg-orange-500', badgeText: 'text-white' },
  { type: 'assurance',label: 'Assurance',              icon: AlertTriangle, href: '/vehicles',
    cardBg: 'bg-orange-50', cardBorder: 'border-orange-100', labelColor: 'text-orange-700', iconColor: 'text-orange-500', badgeBg: 'bg-orange-500', badgeText: 'text-white' },
  { type: 'revision', label: 'Révision / Entretien',   icon: Wrench,        href: '/vehicles',
    cardBg: 'bg-amber-50',  cardBorder: 'border-amber-100',  labelColor: 'text-amber-700',  iconColor: 'text-amber-500',  badgeBg: 'bg-amber-400',  badgeText: 'text-white' },
  { type: 'lavage',   label: 'Lavage avant location',  icon: Wrench,        href: '/maintenance',
    cardBg: 'bg-cyan-50',   cardBorder: 'border-cyan-100',   labelColor: 'text-cyan-700',   iconColor: 'text-cyan-500',   badgeBg: 'bg-cyan-500',   badgeText: 'text-white' },
  { type: 'tache',      label: 'Tâche en retard',        icon: Clock,         href: '/tasks',
    cardBg: 'bg-gray-50',   cardBorder: 'border-gray-200',   labelColor: 'text-gray-600',   iconColor: 'text-gray-400',   badgeBg: 'bg-gray-400',   badgeText: 'text-white' },
  { type: 'infraction', label: 'Infraction non réglée',  icon: AlertTriangle, href: '/incidents/infractions',
    cardBg: 'bg-orange-50', cardBorder: 'border-orange-100', labelColor: 'text-orange-700', iconColor: 'text-orange-500', badgeBg: 'bg-orange-500', badgeText: 'text-white' },
  { type: 'sinistre',   label: 'Sinistre en cours',      icon: AlertTriangle, href: '/incidents/accidents',
    cardBg: 'bg-red-50',    cardBorder: 'border-red-100',    labelColor: 'text-red-700',    iconColor: 'text-red-500',    badgeBg: 'bg-red-500',    badgeText: 'text-white' },
  { type: 'document',   label: 'Document expiré',        icon: FileText,      href: '/documents',
    cardBg: 'bg-amber-50',  cardBorder: 'border-amber-100',  labelColor: 'text-amber-700',  iconColor: 'text-amber-500',  badgeBg: 'bg-amber-400',  badgeText: 'text-white' },
]

const TASK_TYPE_LABELS: Record<string, string> = {
  lavage:               'Lavage',
  preparation:          'Préparation',
  rendez_vous_client:   'RDV Client',
  rendez_vous_garage:   'RDV Garage',
  livraison:            'Livraison',
  recuperation:         'Récupération',
  entretien:            'Entretien',
  controle_etat_lieux:  'État des lieux',
  paiement_caution:     'Caution',
  document_manquant:    'Document',
  autre:                'Tâche',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase   = await createClient()
  const now        = new Date()
  const todayStart = startOfDay(now)
  const todayEnd   = endOfDay(now)
  const in7Days    = addDays(now, 7)

  // ── Profil ────────────────────────────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile }  = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user?.id ?? '')
    .single()
  const isManager = profile?.role === 'gerant' || profile?.role === 'associe'

  // ── Flotte ────────────────────────────────────────────────────────────────
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('id, plate, brand, model, status, insurance_expiry, ct_date, next_service_date, next_service_km, current_km')
    .eq('is_active', true)

  const total          = vehicles?.length ?? 0
  const disponibles    = vehicles?.filter(v => v.status === 'disponible').length ?? 0
  const enLocation     = vehicles?.filter(v => ['loue', 'reserve'].includes(v.status)).length ?? 0
  const immobilises    = vehicles?.filter(v =>
    ['maintenance', 'hors_service', 'en_verification', 'immobilise', 'mis_a_disposition'].includes(v.status)
  ).length ?? 0
  const tauxOccupation = total > 0 ? Math.round((enLocation / total) * 100) : 0

  // ── Réservations ──────────────────────────────────────────────────────────
  const { data: reservations } = await supabase
    .from('reservations')
    .select(`
      id, status, start_datetime, end_datetime, total_price,
      vehicles ( id, plate, brand, model ),
      clients  ( id, first_name, last_name, phone )
    `)
    .in('status', ['confirmee', 'en_cours', 'en_retard'])
    .lte('start_datetime', in7Days.toISOString())
    .order('start_datetime', { ascending: true })

  const departsAujourdhui = reservations?.filter(r =>
    r.status === 'confirmee' &&
    new Date(r.start_datetime) >= todayStart &&
    new Date(r.start_datetime) <= todayEnd
  ) ?? []

  const retoursAujourdhui = reservations?.filter(r =>
    (r.status === 'en_cours' || r.status === 'en_retard') &&
    new Date(r.end_datetime) >= todayStart &&
    new Date(r.end_datetime) <= todayEnd
  ) ?? []

  const enLocationNow = reservations?.filter(r =>
    r.status === 'en_cours' || r.status === 'en_retard'
  ) ?? []

  // ── Tâches du jour ────────────────────────────────────────────────────────
  const { data: todayTasks } = await supabase
    .from('tasks')
    .select(`
      id, title, type, status, due_datetime,
      vehicles ( plate ),
      profiles!tasks_assigned_to_fkey ( full_name )
    `)
    .gte('due_datetime', todayStart.toISOString())
    .lte('due_datetime', todayEnd.toISOString())
    .neq('status', 'annule')
    .order('due_datetime', { ascending: true })

  // ── Alertes ───────────────────────────────────────────────────────────────
  const alerts = await fetchAllAlerts()

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ═══ 1. STATS FLOTTE ════════════════════════════════════════════════ */}
      {isManager && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-black uppercase tracking-widest text-gray-900">FLOTTE</h2>
            <Link href="/vehicles" className="text-[11px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1">
              TOUT VOIR <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          {/* PARC TOTAL — noir */}
          <Link href="/vehicles" className="block">
            <div className="bg-[#111111] rounded-3xl p-4">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">
                    PARC TOTAL
                  </p>
                  <p className="font-black text-white leading-none" style={{ fontSize: 32 }}>
                    {total}
                  </p>
                  <p className="text-xs text-gray-500 mt-1.5">
                    véhicule{total > 1 ? 's' : ''} actif{total > 1 ? 's' : ''}
                  </p>
                </div>
                <div className="text-right pb-0.5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">
                    OCCUPATION
                  </p>
                  <p className="text-xl font-black text-white">{tauxOccupation}%</p>
                  <div className="w-16 h-1 bg-gray-700 rounded-full mt-2 ml-auto">
                    <div className="h-full bg-white/60 rounded-full"
                      style={{ width: `${tauxOccupation}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </Link>

          {/* DISPONIBLES + EN LOCATION */}
          <div className="grid grid-cols-2 gap-3">
            <Link href="/vehicles?status=disponible">
              <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm flex flex-col gap-2.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">DISPONIBLES</span>
                <p className="font-black text-gray-900 leading-none" style={{ fontSize: 28 }}>{disponibles}</p>
              </div>
            </Link>

            <Link href="/vehicles?status=loue">
              <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm flex flex-col gap-2.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">EN LOCATION</span>
                <p className="font-black text-gray-900 leading-none" style={{ fontSize: 28 }}>{enLocation}</p>
              </div>
            </Link>
          </div>

          {/* IMMOBILISÉS */}
          <Link href="/vehicles?status=maintenance" className="block">
            <div className={`rounded-3xl px-5 py-4 flex items-center justify-between border shadow-sm ${
              immobilises > 0 ? 'bg-orange-50 border-orange-100' : 'bg-white border-gray-100'
            }`}>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">IMMOBILISÉS</p>
                <p className="text-xs text-gray-400 mt-0.5">entretien · réparation · sinistre · CT</p>
              </div>
              <div className="flex items-center gap-3">
                <p className={`text-2xl font-black ${immobilises > 0 ? 'text-orange-500' : 'text-gray-300'}`}>
                  {immobilises > 0 ? immobilises : '0'}
                </p>
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </div>
            </div>
          </Link>
        </section>
      )}

      {/* ═══ 2. PROGRAMME DU JOUR ═══════════════════════════════════════════ */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-900">
            Programme du jour
          </h2>
          <Link href="/calendar" className="text-[11px] text-gray-400 font-medium flex items-center gap-1">
            CALENDRIER <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        {departsAujourdhui.length === 0 && retoursAujourdhui.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm text-center">
            <p className="text-sm text-gray-300 font-medium">Aucun mouvement aujourd'hui</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {departsAujourdhui.map((r, i) => {
              const v = getVehicle(r); const c = getClient(r)
              return (
                <Link key={r.id} href={`/reservations/${r.id}`}>
                  <div className={`flex items-center gap-4 px-4 py-4 hover:bg-gray-50 transition-colors ${
                    i < departsAujourdhui.length - 1 || retoursAujourdhui.length > 0
                      ? 'border-b border-gray-50' : ''
                  }`}>
                    <span className="w-12 text-sm font-black text-gray-900 font-mono text-center flex-shrink-0">
                      {format(new Date(r.start_datetime), 'HH:mm')}
                    </span>
                    <span className="text-[10px] font-black uppercase px-2.5 py-1.5 rounded-full bg-black text-white flex-shrink-0">
                      DÉPART
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">
                        {c?.first_name} {c?.last_name}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {v?.plate} · {v?.brand} {v?.model}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-200 flex-shrink-0" />
                  </div>
                </Link>
              )
            })}

            {retoursAujourdhui.map((r, i) => {
              const v = getVehicle(r); const c = getClient(r)
              const isLate = r.status === 'en_retard'
              return (
                <Link key={r.id} href={`/reservations/${r.id}`}>
                  <div className={`flex items-center gap-4 px-4 py-4 transition-colors ${
                    i < retoursAujourdhui.length - 1 ? 'border-b border-gray-50' : ''
                  } ${isLate ? 'bg-red-50/60 hover:bg-red-50' : 'hover:bg-gray-50'}`}>
                    <span className="w-12 text-sm font-black text-gray-900 font-mono text-center flex-shrink-0">
                      {format(new Date(r.end_datetime), 'HH:mm')}
                    </span>
                    <span className={`text-[10px] font-black uppercase px-2.5 py-1.5 rounded-full flex-shrink-0 ${
                      isLate ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {isLate ? 'RETARD' : 'RETOUR'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">
                        {c?.first_name} {c?.last_name}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {v?.plate} · {v?.brand} {v?.model}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-200 flex-shrink-0" />
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* ═══ 3. VÉHICULES EN LOCATION avec countdown 64×64 ════════════════ */}
      {enLocationNow.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-900">
              En location · {enLocationNow.length}
            </h2>
            <Link href="/reservations?status=en_cours" className="text-[11px] text-gray-400 font-medium flex items-center gap-1">
              TOUT VOIR <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-2">
            {enLocationNow.map(r => {
              const v           = getVehicle(r)
              const c           = getClient(r)
              const daysLeft    = differenceInDays(startOfDay(new Date(r.end_datetime)), todayStart)
              const isLate      = r.status === 'en_retard'
              const isReturnToday = daysLeft === 0 && !isLate

              return (
                <Link key={r.id} href={`/reservations/${r.id}`}>
                  <div className={`bg-white rounded-2xl p-4 border shadow-sm ${
                    isLate ? 'border-red-200 bg-red-50/30' : 'border-gray-100'
                  }`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-base font-black text-gray-900">{v?.plate}</span>
                          <span className="text-xs text-gray-400">{v?.brand} {v?.model}</span>
                        </div>
                        <p className="text-sm text-gray-600">{c?.first_name} {c?.last_name}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          Retour : {format(new Date(r.end_datetime), 'dd MMM à HH:mm', { locale: fr })}
                        </p>
                      </div>

                      {/* Countdown 64×64 */}
                      <div className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center flex-shrink-0 ${
                        isLate          ? 'bg-red-500'
                        : isReturnToday ? 'bg-orange-500'
                        : daysLeft <= 2 ? 'bg-orange-100'
                        : 'bg-gray-100'
                      }`}>
                        <span className={`text-2xl font-black leading-none ${
                          isLate || isReturnToday ? 'text-white' : daysLeft <= 2 ? 'text-orange-600' : 'text-gray-700'
                        }`}>
                          {isLate ? `+${Math.abs(daysLeft)}` : daysLeft}
                        </span>
                        <span className={`text-[10px] font-bold mt-0.5 ${
                          isLate          ? 'text-red-100'
                          : isReturnToday ? 'text-orange-100'
                          : daysLeft <= 2 ? 'text-orange-500'
                          : 'text-gray-400'
                        }`}>
                          {isLate ? 'j retard' : isReturnToday ? 'auj.' : 'jours'}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* ═══ 4. ALERTES — groupées par catégorie ═══════════════════════════ */}
      {alerts.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-[11px] font-black uppercase tracking-widest text-gray-900">Alertes</h2>
            <span className="w-5 h-5 bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center">
              {alerts.length > 9 ? '9+' : alerts.length}
            </span>
          </div>

          <div className="space-y-2">
            {ALERT_GROUPS.map(group => {
              const groupAlerts = alerts.filter(a => a.type === group.type)
              if (groupAlerts.length === 0) return null
              const GroupIcon = group.icon
              return (
                <div key={group.type} className={`rounded-2xl border overflow-hidden ${group.cardBg} ${group.cardBorder}`}>
                  {/* En-tête de groupe */}
                  <div className={`flex items-center justify-between px-4 py-3 border-b ${group.cardBorder}`}>
                    <div className="flex items-center gap-2">
                      <GroupIcon className={`w-4 h-4 ${group.iconColor}`} />
                      <span className={`text-[11px] font-black uppercase tracking-wide ${group.labelColor}`}>
                        {group.label}
                      </span>
                      <span className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center ${group.badgeBg} ${group.badgeText}`}>
                        {groupAlerts.length}
                      </span>
                    </div>
                    <Link href={group.href} className={`text-[10px] font-bold uppercase ${group.labelColor} opacity-50`}>
                      VOIR →
                    </Link>
                  </div>

                  {/* Lignes d'alertes */}
                  {groupAlerts.map((alert, i) => (
                    <Link key={alert.id} href={alert.href}>
                      <div className={`flex items-center gap-3 px-4 py-3 transition-colors hover:brightness-95 ${
                        i < groupAlerts.length - 1 ? `border-b ${group.cardBorder}` : ''
                      }`}>
                        <p className={`flex-1 min-w-0 text-xs font-semibold ${group.labelColor} opacity-80 truncate`}>
                          {alert.sublabel}
                        </p>
                        <ChevronRight className={`w-4 h-4 ${group.iconColor} opacity-40 flex-shrink-0`} />
                      </div>
                    </Link>
                  ))}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ═══ 5. SEMAINE ════════════════════════════════════════════════════ */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-900">Semaine</h2>
          <Link href="/calendar" className="text-[11px] text-gray-400 font-medium flex items-center gap-1">
            TOUT VOIR <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 7 }, (_, i) => addDays(todayStart, i)).map((day, i) => {
              const isToday     = i === 0
              const isTomorrow  = i === 1
              const dayDeparts  = reservations?.filter(r =>
                isSameDay(new Date(r.start_datetime), day) && r.status === 'confirmee'
              ) ?? []
              const dayReturns  = reservations?.filter(r =>
                isSameDay(new Date(r.end_datetime), day) &&
                (r.status === 'en_cours' || r.status === 'en_retard')
              ) ?? []

              return (
                <div key={day.toISOString()} className="flex flex-col items-center gap-1.5">
                  <span className="text-[9px] font-bold uppercase text-gray-400 capitalize">
                    {format(day, 'EEE', { locale: fr })}
                  </span>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
                    isToday ? 'bg-black text-white' : 'text-gray-900'
                  }`}>
                    <span className="text-xs font-black">{format(day, 'd')}</span>
                  </div>
                  {isTomorrow && !isToday && (
                    <span className="text-[8px] text-gray-300 font-medium -mt-0.5">demain</span>
                  )}
                  <div className="flex flex-col items-center gap-0.5 min-h-[12px]">
                    {dayDeparts.length > 0 && (
                      <div className="w-1.5 h-1.5 rounded-full bg-black" />
                    )}
                    {dayReturns.length > 0 && (
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    )}
                    {dayDeparts.length === 0 && dayReturns.length === 0 && (
                      <span className="text-[8px] text-gray-200">—</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Légende */}
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-50">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-black" />
              <span className="text-[10px] text-gray-400">Départ</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              <span className="text-[10px] text-gray-400">Retour</span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ 6. TÂCHES DU JOUR ══════════════════════════════════════════════ */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-900">
              Tâches du jour
            </h2>
            {(todayTasks?.length ?? 0) > 0 && (
              <span className="w-5 h-5 bg-gray-200 rounded-full text-gray-600 text-[10px] font-bold flex items-center justify-center">
                {todayTasks!.length}
              </span>
            )}
          </div>
          <Link href="/tasks/new" className="flex items-center gap-1 text-[11px] text-gray-400 font-medium hover:text-gray-700 transition-colors">
            <Plus className="w-3.5 h-3.5" /> CRÉER
          </Link>
        </div>

        {!todayTasks || todayTasks.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
            <CheckCircle2 className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400 font-medium">Aucune tâche prévue aujourd'hui</p>
            <Link href="/tasks/new" className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-black underline underline-offset-2">
              <Plus className="w-3.5 h-3.5" /> Créer une tâche
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
            {todayTasks.map(task => {
              const tv       = Array.isArray((task as any).vehicles) ? (task as any).vehicles[0] : (task as any).vehicles
              const assignee = Array.isArray((task as any).profiles) ? (task as any).profiles[0] : (task as any).profiles
              return (
                <Link key={task.id} href={`/tasks/${task.id}`}>
                  <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors">
                    <span className="w-12 text-xs font-mono font-bold text-gray-600 text-center flex-shrink-0">
                      {format(new Date(task.due_datetime), 'HH:mm')}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{task.title}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[10px] font-semibold text-gray-400 uppercase">
                          {TASK_TYPE_LABELS[task.type ?? 'autre']}
                        </span>
                        {tv && <span className="text-[10px] text-gray-400">· {(tv as any).plate}</span>}
                        {assignee && <span className="text-[10px] text-gray-400">· {(assignee as any).full_name}</span>}
                      </div>
                    </div>
                    <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full flex-shrink-0 ${
                      TASK_STATUS_BADGE[task.status] ?? 'bg-gray-100 text-gray-600'
                    }`}>
                      {TASK_STATUS_LABEL[task.status] ?? task.status}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* État vide global */}
      {enLocationNow.length === 0 && alerts.length === 0 &&
       departsAujourdhui.length === 0 && retoursAujourdhui.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <CheckCircle2 className="w-10 h-10 text-gray-200" />
          <p className="text-sm font-semibold text-gray-400">Tout est calme aujourd'hui</p>
        </div>
      )}

    </div>
  )
}
