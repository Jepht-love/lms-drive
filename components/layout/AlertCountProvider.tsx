'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

// Fournit le nombre d'alertes à l'en-tête ET à la barre de navigation via une
// SEULE requête client, en dehors du chemin critique de rendu. Avant, le layout
// bloquait le premier affichage sur ~10 requêtes Supabase (fetchAllAlerts) juste
// pour ce compteur. Ici, la coque s'affiche immédiatement et le badge se remplit
// juste après.
//
// Réactivité (retour gérant 2026-07-22 : « le voyant rouge ne se met pas à jour
// rapidement quand on résout/supprime une alerte ») : le badge se recharge
//   - à chaque changement de page (résoudre une alerte ailleurs → revenir met à jour),
//   - au focus / retour au premier plan (PWA iOS),
//   - toutes les 30 s tant que l'onglet est visible (filet de sécurité),
//   - à la demande via l'événement global `alerts:changed` (voir notifyAlertsChanged).
const AlertCountContext = createContext(0)
const AlertRefreshContext = createContext<() => void>(() => {})

export function useAlertCount() {
  return useContext(AlertCountContext)
}

/** Recharge le compteur d'alertes à la demande depuis un composant. */
export function useRefreshAlertCount() {
  return useContext(AlertRefreshContext)
}

/** Déclenche un rafraîchissement immédiat du badge, même hors de l'arbre React
 *  (après une server action, un fetch de résolution/suppression d'alerte…). */
export function notifyAlertsChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('alerts:changed'))
}

const POLL_MS = 30_000

export default function AlertCountProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0)
  const pathname = usePathname()
  const aliveRef = useRef(true)

  const load = useCallback(() => {
    return fetch('/api/alerts/count')
      .then(r => r.json())
      .then(d => { if (aliveRef.current) setCount(d.count ?? 0) })
      .catch(() => {})
  }, [])

  // Rechargement au changement de page (couvre aussi le tout premier affichage).
  useEffect(() => { load() }, [pathname, load])

  useEffect(() => {
    aliveRef.current = true
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    const onChanged = () => load()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', load)
    window.addEventListener('alerts:changed', onChanged)
    const id = setInterval(() => { if (document.visibilityState === 'visible') load() }, POLL_MS)
    return () => {
      aliveRef.current = false
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', load)
      window.removeEventListener('alerts:changed', onChanged)
      clearInterval(id)
    }
  }, [load])

  return (
    <AlertRefreshContext.Provider value={load}>
      <AlertCountContext.Provider value={count}>{children}</AlertCountContext.Provider>
    </AlertRefreshContext.Provider>
  )
}
