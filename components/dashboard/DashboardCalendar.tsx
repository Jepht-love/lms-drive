'use client'

/**
 * Calendrier du tableau de bord — bande de jours qui roule, façon Google Agenda.
 *
 * La bande avance JOUR PAR JOUR sous le doigt, elle n'est donc pas alignée sur une
 * semaine et se retrouve à cheval sur deux : c'est voulu. Jeff a tranché le
 * 01/08/2026 (remarque 37) entre les deux gestes possibles — Google, retenu ici,
 * contre Apple, qui paginait par semaine entière et que cet écran faisait avant.
 * Ne pas revenir à la semaine en croyant corriger un défaut d'alignement.
 *
 * Le jour choisi reste au milieu des sept cases visibles. Les flèches ‹ › avancent
 * d'un jour, comme le geste. Un clic sur un jour affiche, en dessous, les tâches de
 * ce jour (à faire / à assigner). Chaque tâche ouvre le tiroir de l'événement
 * (/calendrier?event=<id>) : attribuer un membre PUIS ouvrir la résa.
 *
 * Même mécanisme que la bande de la page Calendrier (`MobileCalendar`) : si l'un
 * change, changer l'autre, deux gestes différents pour la même bande se verraient.
 *
 * Auto-alimenté : charge les 21 jours dessinés via
 * GET /api/calendar/events?start&end (même source que la page Calendrier).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, useMotionValue, animate } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  addDays, addWeeks, startOfWeek, isSameDay, isToday, format,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import type { CalendarEvent, EventType } from '@/types/calendar'
import LoadErrorBanner from '@/components/ui/LoadErrorBanner'

const ASSIGNABLE: EventType[] = [
  'depart_vehicule', 'retour_vehicule', 'tache',
  'rdv_client', 'rdv_garage', 'rdv_autre', 'livraison', 'recuperation',
]

const TYPE_META: Record<string, { label: string; badge: string }> = {
  depart_vehicule: { label: 'Départ',       badge: 'bg-gray-900 text-white' },
  retour_vehicule: { label: 'Retour',       badge: 'bg-blue-500 text-white' },
  reservation:     { label: 'Réservation',  badge: 'bg-gray-900 text-white' },
  rdv_client:      { label: 'RDV',          badge: 'bg-pink-500 text-white' },
  rdv_garage:      { label: 'RDV garage',   badge: 'bg-pink-500 text-white' },
  rdv_autre:       { label: 'RDV',          badge: 'bg-pink-500 text-white' },
  livraison:       { label: 'Livraison',    badge: 'bg-purple-500 text-white' },
  recuperation:    { label: 'Récupération', badge: 'bg-purple-500 text-white' },
  tache:           { label: 'Tâche',        badge: 'bg-purple-500 text-white' },
}
const DEFAULT_META = { label: 'Tâche', badge: 'bg-gray-500 text-white' }
const metaFor = (t: string) => TYPE_META[t] ?? DEFAULT_META

const dayKey = (d: Date) => format(d, 'yyyy-MM-dd')

function assigneeName(e: CalendarEvent): string | null {
  return e.assigned_profile?.full_name ?? e.team?.name ?? null
}
function needsAssignee(e: CalendarEvent): boolean {
  return ASSIGNABLE.includes(e.event_type) && !e.assigned_to && !e.assigned_team_id
}
// Le véhicule et sa couleur d'abord, la plaque ensuite (remarque 20 de Jeff,
// 30/07/2026). La couleur est un champ libre de la fiche : elle manque souvent,
// la ligne doit tenir sans elle.
function eventVehicule(e: CalendarEvent): string | null {
  const v = e.vehicles?.[0]
  if (!v) return null
  return `${[v.brand, v.model, v.color].filter(Boolean).join(' ')} · ${v.plate}`
}

/**
 * Ce qu'il y a à faire, sans répéter ce qui est déjà à l'écran.
 * Beaucoup de titres finissent par leur véhicule (« Départ — BMW Série 1
 * Blanc ») alors que la ligne du dessus le nomme déjà, et la pastille de gauche
 * annonce déjà « Départ ». On ne garde donc que ce que ces deux-là ne disent
 * pas. Retourne null quand il ne reste rien : la ligne disparaît au lieu de
 * répéter. Format arrêté par Jeff le 30/07/2026.
 */
function eventIntitule(e: CalendarEvent, libellePastille: string): string | null {
  const v = e.vehicles?.[0]
  const finDuTitre = e.title.split(' · ').slice(1).join(' · ')
  const finRepeteLeVehicule = Boolean(
    v && finDuTitre && [v.brand, v.model].filter(Boolean).some(
      mot => finDuTitre.toLowerCase().includes(String(mot).toLowerCase()),
    ),
  )
  const intitule = (finRepeteLeVehicule ? e.title.split(' · ')[0] : e.title).trim()
  if (!intitule) return null
  if (intitule.toLowerCase() === libellePastille.toLowerCase()) return null
  return intitule
}

/** La personne concernée : le client, sinon celui que la synchro a écrit en description. */
function eventPersonne(e: CalendarEvent): string | null {
  if (e.client) return `${e.client.first_name} ${e.client.last_name}`.trim()
  return e.description?.trim() || null
}

// La bande dessine 21 jours autour du jour choisi, qui reste à la 4ᵉ des 7 cases
// visibles. Mêmes valeurs que la page Calendrier : les deux bandes doivent bouger
// pareil.
const RAYON_JOURS = 10
const PLACE_DU_JOUR_CHOISI = 3

export default function DashboardCalendar() {
  const [selected, setSelected] = useState<Date>(() => new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  // Incrémenté par « Réessayer » : relance le chargement des jours affichés.
  const [reloadKey, setReloadKey] = useState(0)

  // Piste : largeur mesurée du conteneur, puis position (px) de la piste de 21 jours.
  const [w, setW] = useState(0)
  const x = useMotionValue(0)
  const largeurCase = w / 7
  const xRepos = -(RAYON_JOURS - PLACE_DU_JOUR_CHOISI) * largeurCase

  const containerRef = useCallback((el: HTMLDivElement | null) => {
    if (!el) return
    setW(el.offsetWidth)
    const ro = new ResizeObserver(() => setW(el.offsetWidth))
    ro.observe(el)
  }, [])

  useEffect(() => { x.set(xRepos) }, [xRepos, x])

  // Fait rouler la bande de n jours (spring), puis change le jour choisi et remet
  // la piste au repos : les 21 jours sont alors redessinés autour de la nouvelle
  // date, donc rien ne saute à l'œil.
  const glisseDeJours = useCallback((n: number) => {
    if (!largeurCase) return
    if (n === 0) {
      animate(x, xRepos, { type: 'spring', stiffness: 550, damping: 45 })
      return
    }
    animate(x, xRepos - n * largeurCase, {
      type: 'spring', stiffness: 550, damping: 45,
      onComplete: () => {
        setSelected(s => addDays(s, n))
        x.set(xRepos)
      },
    })
  }, [largeurCase, xRepos, x])

  const goToday = useCallback(() => {
    setSelected(new Date())
    x.set(xRepos)
  }, [xRepos, x])

  // Fenêtre chargée : de quoi couvrir les 21 jours dessinés quelle que soit la
  // position du jour choisi dans sa semaine. On s'accroche au lundi plutôt qu'au
  // jour lui-même pour ne PAS relancer une requête à chaque case franchie : sans
  // ça, faire rouler la bande d'un bout à l'autre du mois déclencherait trente
  // chargements.
  const ancrage = useMemo(() => startOfWeek(selected, { weekStartsOn: 1 }), [selected])

  useEffect(() => {
    const start = addDays(ancrage, -RAYON_JOURS)
    const end = addDays(ancrage, RAYON_JOURS + 7)
    let cancelled = false
    setLoading(true)
    setLoadFailed(false)
    fetch(`/api/calendar/events?start=${start.toISOString()}&end=${end.toISOString()}`)
      .then(r => {
        if (!r.ok) throw new Error(String(r.status))
        return r.json()
      })
      .then(data => { if (!cancelled) setEvents(Array.isArray(data) ? data : []) })
      // Des jours vides et des jours non chargés se ressemblent : on le dit,
      // sinon le tableau de bord laisse croire qu'il n'y a rien de prévu.
      .catch(() => { if (!cancelled) setLoadFailed(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [ancrage, reloadKey])

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const e of events) {
      const key = dayKey(new Date(e.start_at))
      const arr = map.get(key)
      if (arr) arr.push(e); else map.set(key, [e])
    }
    return map
  }, [events])

  const dayEvents = useCallback(
    (d: Date) => (eventsByDay.get(dayKey(d)) ?? [])
      .slice()
      .sort((a, b) => a.start_at.localeCompare(b.start_at)),
    [eventsByDay],
  )

  const selectedEvents = dayEvents(selected)
  const monthLabel = format(selected, 'MMMM yyyy', { locale: fr })
  const estAujourdhui = isToday(selected)

  const renderDay = (day: Date) => {
    const evs = dayEvents(day)
    const hasUnassigned = evs.some(needsAssignee)
    const selectedDay = isSameDay(day, selected)
    const today = isToday(day)
    return (
      <button
        key={day.toISOString()}
        type="button"
        style={{ width: largeurCase }}
        onClick={() => setSelected(day)}
        className="shrink-0 flex flex-col items-center gap-1 py-1 select-none"
      >
        <span className={`text-[9px] font-bold uppercase capitalize ${selectedDay ? 'text-gray-900' : 'text-gray-400'}`}>
          {format(day, 'EEE', { locale: fr })}
        </span>
        <span
          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-colors ${
            selectedDay ? 'bg-black text-white'
            : today ? 'bg-gray-100 text-gray-900 ring-1 ring-gray-900/20'
            : 'text-gray-900'
          }`}
        >
          {format(day, 'd')}
        </span>
        <span className="h-1.5 flex items-center">
          {evs.length > 0 && (
            <span className={`w-1.5 h-1.5 rounded-full ${hasUnassigned ? 'bg-amber-500' : selectedDay ? 'bg-gray-900' : 'bg-gray-300'}`} />
          )}
        </span>
      </button>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      {loadFailed && (
        <LoadErrorBanner
          className="mb-3"
          message="Semaine non chargée, les pastilles peuvent manquer."
          onRetry={() => setReloadKey(k => k + 1)}
        />
      )}
      {/* En-tête : mois + navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => glisseDeJours(-1)}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-gray-700 transition-colors"
          aria-label="Jour précédent"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-black text-gray-900 capitalize">{monthLabel}</span>
          {!estAujourdhui && (
            <button
              type="button"
              onClick={goToday}
              className="text-[10px] font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 px-2 py-0.5 rounded-full transition-colors"
            >
              Aujourd&apos;hui
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => glisseDeJours(1)}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-gray-700 transition-colors"
          aria-label="Jour suivant"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* La bande roule jour par jour sous le doigt (voir l'en-tête du fichier) */}
      <div ref={containerRef} className="overflow-hidden">
        <motion.div
          className="flex"
          style={{ x, width: largeurCase * (2 * RAYON_JOURS + 1) }}
          drag={largeurCase > 0 ? 'x' : false}
          dragConstraints={{
            left: xRepos - RAYON_JOURS * largeurCase,
            right: xRepos + RAYON_JOURS * largeurCase,
          }}
          dragElastic={0.08}
          onDragEnd={(_, info) => {
            // Combien de cases le doigt a-t-il parcourues ? Un geste court mais
            // lancé compte quand même pour un jour, sinon un « flick » rapide ne
            // fait rien et la bande a l'air bloquée.
            let n = Math.round((xRepos - x.get()) / largeurCase)
            if (n === 0 && Math.abs(info.velocity.x) > 450) n = info.velocity.x < 0 ? 1 : -1
            glisseDeJours(Math.max(-RAYON_JOURS, Math.min(RAYON_JOURS, n)))
          }}
        >
          {Array.from({ length: 2 * RAYON_JOURS + 1 }, (_, i) => addDays(selected, i - RAYON_JOURS)).map(renderDay)}
        </motion.div>
      </div>

      {/* Détail du jour sélectionné */}
      <div className="mt-4 pt-3 border-t border-gray-50">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-black uppercase tracking-widest text-gray-500">
            {isSameDay(selected, new Date()) ? "Aujourd'hui" : format(selected, 'EEEE d MMMM', { locale: fr })}
          </p>
          {selectedEvents.length > 0 && (
            <span className="text-[10px] font-bold text-gray-400">
              {selectedEvents.length} tâche{selectedEvents.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {loading ? (
          <div className="space-y-2 py-1">
            {[0, 1].map(i => <div key={i} className="h-9 rounded-lg bg-gray-50 animate-pulse" />)}
          </div>
        ) : selectedEvents.length === 0 ? (
          <p className="text-xs text-gray-300 py-3 text-center">Rien de prévu ce jour</p>
        ) : (
          <div className="space-y-1">
            {selectedEvents.map(e => {
              const meta = metaFor(e.event_type)
              const name = assigneeName(e)
              const toAssign = !name && needsAssignee(e)
              const vehicule = eventVehicule(e)
              const intitule = eventIntitule(e, meta.label)
              const personne = eventPersonne(e)
              return (
                <Link
                  key={e.id}
                  href={`/calendrier?event=${e.id}`}
                  className="flex items-center gap-2.5 py-1.5 px-1 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <span className="w-10 text-[11px] font-mono font-bold text-gray-500 flex-shrink-0 text-center">
                    {format(new Date(e.start_at), 'HH:mm')}
                  </span>
                  {/* La pastille rétrécit sur téléphone : à 390 px, ses 76 px
                      fixes plus la colonne de droite mangeaient la place et
                      coupaient la plaque (« Smart Fortwo · DQ… »). */}
                  <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-full flex-shrink-0 inline-flex items-center justify-center min-w-[52px] sm:min-w-[76px] ${meta.badge}`}>
                    {meta.label}
                  </span>
                  {/* Trois lignes : la voiture et sa plaque, ce qu'il y a à
                      faire, la personne concernée. Sans véhicule (un rendez-vous
                      client, par exemple), l'intitulé remonte en première ligne
                      pour ne pas laisser un blanc. */}
                  <div className="flex-1 min-w-0">
                    {vehicule
                      ? <span className="text-xs text-gray-900 font-semibold block truncate">{vehicule}</span>
                      : intitule && <span className="text-xs text-gray-900 font-semibold block truncate">{intitule}</span>}
                    {vehicule && intitule && (
                      <span className="text-[11px] text-gray-500 block truncate">{intitule}</span>
                    )}
                    <span className="block truncate">
                      {personne && <span className="text-[10px] text-gray-400">{personne}</span>}
                      {/* Qui s'en occupe : sous les trois lignes sur téléphone,
                          dans sa colonne de droite dès qu'il y a la place. */}
                      {name ? (
                        <span className="text-[10px] text-gray-400 sm:hidden">{personne ? ' · ' : ''}{name}</span>
                      ) : toAssign ? (
                        <span className="text-[10px] font-bold text-amber-600 sm:hidden">{personne ? ' · ' : ''}À assigner</span>
                      ) : null}
                    </span>
                  </div>
                  {name ? (
                    <span className="hidden sm:block text-[10px] text-gray-400 flex-shrink-0 max-w-[64px] truncate">{name}</span>
                  ) : toAssign ? (
                    <span className="hidden sm:block text-[10px] font-bold text-amber-600 flex-shrink-0">À assigner</span>
                  ) : null}
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
