'use client'

import { createContext, useContext, useEffect, useState } from 'react'

// Fournit le nombre d'alertes à l'en-tête ET à la barre de navigation via une
// SEULE requête client, en dehors du chemin critique de rendu. Avant, le layout
// bloquait le premier affichage sur ~10 requêtes Supabase (fetchAllAlerts) juste
// pour ce compteur. Ici, la coque s'affiche immédiatement et le badge se remplit
// juste après. Rafraîchi au retour au premier plan (utile sur PWA iOS).
const AlertCountContext = createContext(0)

export function useAlertCount() {
  return useContext(AlertCountContext)
}

export default function AlertCountProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let alive = true
    const load = () =>
      fetch('/api/alerts/count')
        .then(r => r.json())
        .then(d => { if (alive) setCount(d.count ?? 0) })
        .catch(() => {})

    load()
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { alive = false; document.removeEventListener('visibilitychange', onVisible) }
  }, [])

  return <AlertCountContext.Provider value={count}>{children}</AlertCountContext.Provider>
}
