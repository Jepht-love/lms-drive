import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  BarChart3, CalendarDays, ClipboardList, Users, Car,
  FileText, AlertTriangle, Navigation, Settings,
  ChevronRight, LogOut, UsersRound, Wrench, Repeat, Wallet, Megaphone, FolderArchive, Mail,
} from 'lucide-react'
import { logout } from '@/lib/actions/auth'
import { allowedHrefSet } from '@/lib/navigation/tabs'

// ─── Modules principaux ───────────────────────────────────────────────────────
const modules = [
  { href: '/',               label: 'Tableau de bord',  icon: BarChart3,     desc: 'Vue d\'ensemble & alertes' },
  { href: '/calendrier',     label: 'Calendrier',        icon: CalendarDays,  desc: 'Planning de la flotte' },
  { href: '/reservations',   label: 'Réservations',      icon: ClipboardList, desc: 'Gérer les locations' },
  { href: '/clients',        label: 'Clients',            icon: Users,         desc: 'Base clients & dossiers' },
  { href: '/vehicles',       label: 'Véhicules',          icon: Car,           desc: 'Parc automobile' },
  { href: '/maintenance',    label: 'Entretien',          icon: Wrench,        desc: 'Interventions & suivi' },
  { href: '/contracts',      label: 'Contrats',           icon: FileText,      desc: 'Signatures & PDFs' },
  { href: '/incidents',      label: 'Incidents',          icon: AlertTriangle, desc: 'Sinistres & dommages' },
  { href: '/internal-trips', label: 'Déplacements',       icon: Navigation,    desc: 'Trajets internes' },
  { href: '/partnerships',   label: 'Partenariats',       icon: Repeat,        desc: 'Échanges inter-agences' },
]

const adminModules = [
  { href: '/accounting', label: 'Comptabilité', icon: Wallet,     desc: 'Mouvements & clôtures' },
  { href: '/marketing',  label: 'Marketing',    icon: Megaphone,  desc: 'Campagnes & ROI' },
  { href: '/equipe',     label: 'Équipe',       icon: UsersRound, desc: 'Membres & attributions tâches' },
  { href: '/documents',  label: 'Documents',    icon: FolderArchive, desc: 'Bibliothèque documentaire' },
  { href: '/emails',     label: 'Emails',       icon: Mail,       desc: 'Historique des envois' },
  { href: '/settings',   label: 'Paramètres',   icon: Settings,   desc: 'Configuration de l\'agence' },
]

const ROLE_LABELS: Record<string, string> = {
  gerant: 'Gérant',
  associe: 'Associé',
  employe: 'Employé',
  prestataire: 'Prestataire',
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function MenuPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  // Permissions par onglet — colonne optionnelle : requête séparée tolérante à
  // son absence (avant l'exécution de la migration 017, perm = null → accès complet).
  const { data: perm } = await supabase
    .from('profiles')
    .select('allowed_tabs')
    .eq('id', user.id)
    .maybeSingle()

  const isManager = profile?.role === 'gerant' || profile?.role === 'associe'

  // Permissions par onglet : un employé ne voit que ses sections autorisées
  // (allowed_tabs null/vide = accès complet). Les managers voient tout.
  const allowed = (perm as { allowed_tabs?: string[] | null } | null)?.allowed_tabs
  const allowedHrefs = allowedHrefSet(allowed)
  const visibleModules = isManager ? modules : modules.filter(m => allowedHrefs.has(m.href))

  const initials = profile?.full_name
    ?.split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) ?? '?'

  const roleLabel = ROLE_LABELS[profile?.role ?? ''] ?? profile?.role ?? ''

  return (
    // Casse le padding du layout pour aller bord-à-bord
    <div className="-mx-4 -mt-5 pb-2">

      {/* ─── Hero profil — fond noir pleine largeur ─── */}
      <div className="bg-[#1C1C1E] px-5 pt-5 pb-6" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center justify-between max-w-3xl mx-auto">

          {/* Avatar + info */}
          <div className="flex items-center gap-4">
            {/* Cercle initiales */}
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-lg font-black tracking-tight">{initials}</span>
            </div>
            {/* Nom + rôle */}
            <div>
              <p className="text-white text-base font-bold leading-tight">
                {profile?.full_name ?? user.email}
              </p>
              <p className="text-white/40 text-xs font-semibold tracking-widest uppercase mt-1">
                {roleLabel}
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* ─── Corps de la page — fond gris très clair ─── */}
      <div className="px-4 space-y-3 mt-4 max-w-3xl mx-auto">

        {/* Modules principaux */}
        <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
          {visibleModules.map(({ href, label, icon: Icon, desc }, i) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-4 px-4 py-4 hover:bg-gray-50 transition-colors active:bg-gray-100 ${
                i < modules.length - 1 ? 'border-b border-gray-50' : ''
              }`}
            >
              {/* Icône dans un carré gris */}
              <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-[#111111]" strokeWidth={1.8} />
              </div>

              {/* Texte */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#111111] leading-snug">{label}</p>
                <p className="text-xs text-gray-400 mt-0.5 leading-none">{desc}</p>
              </div>

              <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
            </Link>
          ))}
        </div>

        {/* Administration — réservé gérant/associé */}
        {isManager && (
          <div>
            <p className="px-1 pb-2 pt-1 text-[10px] font-black uppercase tracking-[0.15em] text-gray-400">
              Administration
            </p>
            <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
              {adminModules.map(({ href, label, icon: Icon, desc }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-4 px-4 py-4 hover:bg-gray-50 transition-colors active:bg-gray-100"
                >
                  <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-[#111111]" strokeWidth={1.8} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#111111] leading-snug">{label}</p>
                    <p className="text-xs text-gray-400 mt-0.5 leading-none">{desc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Déconnexion */}
        <div className="pt-1 pb-4">
          <form action={logout}>
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-2xl bg-white border border-gray-100 shadow-sm text-gray-500 hover:text-red-500 hover:border-red-100 hover:bg-red-50 transition-colors active:scale-[.99]"
            >
              <LogOut className="w-4 h-4 flex-shrink-0" strokeWidth={1.8} />
              <span className="text-sm font-semibold">Déconnexion</span>
            </button>
          </form>
        </div>

        {/* Version */}
        <p className="text-center text-[10px] text-gray-300 pb-2 tracking-wide">
          LMS Drive · v1.0 MVP
        </p>

      </div>
    </div>
  )
}
