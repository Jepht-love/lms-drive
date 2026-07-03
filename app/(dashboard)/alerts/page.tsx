import { fetchAllAlerts } from '@/lib/utils/alerts'
import { syncAlertsToCalendar } from '@/lib/calendar/syncAlerts'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  AlertTriangle, Clock, FileText, Wrench,
  ShieldAlert, ChevronRight, Bell, ArrowLeft,
} from 'lucide-react'
import type { AppAlert } from '@/lib/utils/alerts'
import { AnimatedList, AnimatedListItem } from '@/components/AnimatedList'
import BackButton from '@/components/ui/BackButton'

function AlertIcon({ type }: { type: string }) {
  const cls = 'w-5 h-5'
  if (type === 'contrat')  return <FileText   className={cls} />
  if (type === 'retard')   return <Clock      className={cls} />
  if (type === 'depart_imminent') return <Clock className={cls} />
  if (type === 'ct' || type === 'assurance') return <ShieldAlert className={cls} />
  if (type === 'revision') return <Wrench     className={cls} />
  if (type === 'lavage')   return <Wrench     className={cls} />
  if (type === 'tache')    return <Clock      className={cls} />
  return <AlertTriangle className={cls} />
}

function AlertGroup({
  title, items, bg, iconBg, iconColor,
}: {
  title: string
  items: AppAlert[]
  bg: string
  iconBg: string
  iconColor: string
}) {
  if (items.length === 0) return null
  return (
    <div className="px-4">
      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
          {title}
        </h2>
        <span className="text-[10px] font-black text-gray-400">— {items.length}</span>
      </div>
      <AnimatedList className="space-y-2">
        {items.map(alert => (
          <AnimatedListItem key={alert.id}>
          <Link href={alert.href}>
            <div className={`flex items-center gap-3 p-4 rounded-2xl border ${bg}`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg} ${iconColor}`}>
                <AlertIcon type={alert.type} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-black uppercase tracking-wide ${iconColor}`}>
                  {alert.label}
                </p>
                <p className="text-sm text-gray-600 line-clamp-2 mt-0.5">{alert.sublabel}</p>
                {alert.date && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {format(new Date(alert.date), 'dd MMM yyyy à HH:mm', { locale: fr })}
                  </p>
                )}
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
            </div>
          </Link>
          </AnimatedListItem>
        ))}
      </AnimatedList>
    </div>
  )
}

export default async function NotificationsPage() {
  const supabase = await createClient()
  const alerts    = await fetchAllAlerts(supabase)
  // Reflète les alertes urgentes/importantes sur le calendrier (rattrapage
  // paresseux à chaque visite, même mécanisme que le cron de /api/notifications).
  await syncAlertsToCalendar(createAdminClient(), alerts)
  const urgent    = alerts.filter(a => a.category === 'urgent')
  const important = alerts.filter(a => a.category === 'important')
  const info      = alerts.filter(a => a.category === 'info')

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <BackButton fallbackHref="/" className="p-2 rounded-xl hover:bg-gray-100 transition-colors -ml-2">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </BackButton>
          <Bell className="w-5 h-5 text-gray-400" />
          <h1 className="text-xl font-black text-gray-900">Alertes</h1>
        </div>
        {alerts.length > 0 && (
          <span className="w-7 h-7 bg-red-500 rounded-full text-white text-xs font-black flex items-center justify-center">
            {alerts.length > 99 ? '99+' : alerts.length}
          </span>
        )}
      </div>

      {alerts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          </div>
          <p className="text-lg font-black text-gray-700">Tout est à jour</p>
          <p className="text-sm text-gray-400 mt-2">Aucune alerte active pour le moment</p>
        </div>
      ) : (
        <div className="space-y-5 -mx-4">
          <AlertGroup
            title="URGENTS"
            items={urgent}
            bg="bg-red-50 border-red-100"
            iconBg="bg-red-100"
            iconColor="text-red-700"
          />
          <AlertGroup
            title="IMPORTANTS"
            items={important}
            bg="bg-orange-50 border-orange-100"
            iconBg="bg-orange-100"
            iconColor="text-orange-700"
          />
          <AlertGroup
            title="INFORMATIONS"
            items={info}
            bg="bg-gray-50 border-gray-100"
            iconBg="bg-gray-100"
            iconColor="text-gray-600"
          />
        </div>
      )}
    </div>
  )
}
