'use client'

// ─── Bouton d'écriture bloqué ─────────────────────────────────────────────────
//
// À quoi il sert : montrer une action d'écriture véhicule (Ajouter / Modifier /
// Supprimer, donc un prix) GRISÉE à qui n'a pas le droit, sans erreur. Il n'est
// PAS « disabled » : le clic est capté pour TRACER la tentative dans le journal
// d'audit — on veut savoir qui a essayé de toucher un prix (Jeff, 06/08/2026) —
// puis un message discret rappelle que c'est réservé au gérant. Il ne fait jamais
// l'action elle-même.
//
// Ce qu'il attend : le genre de tentative, et l'identifiant du véhicule quand il
// y en a un (modification / suppression). Ce qu'il produit : une ligne dans
// `audit_logs` (action `vehicle_write_blocked`) via la Server Action, et un toast.
// Ne pas le rendre « disabled » : un bouton désactivé n'émet pas de clic, donc ne
// tracerait rien — c'est justement l'inverse de ce qu'on veut ici.

import { useTransition } from 'react'
import { useToast } from '@/components/Toast'
import { journaliserTentativeEcritureVehicule } from '@/lib/actions/vehicles'

export default function BoutonEcritureBloque({
  genre,
  vehicleId,
  className,
  children,
}: {
  genre: 'ajout' | 'modification' | 'suppression'
  vehicleId?: string
  className?: string
  children: React.ReactNode
}) {
  const { show } = useToast()
  const [pending, start] = useTransition()
  return (
    <button
      type="button"
      aria-disabled="true"
      disabled={pending}
      title="Réservé au gérant"
      onClick={() =>
        start(async () => {
          await journaliserTentativeEcritureVehicule(genre, vehicleId)
          show('Réservé au gérant. Votre tentative a été enregistrée.', 'info')
        })
      }
      className={className}
    >
      {children}
    </button>
  )
}
