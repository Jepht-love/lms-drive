import { Clock } from 'lucide-react'
import { libelleDelai, type TonDelai } from '@/lib/format/delai'

// Pastille de délai, reprise de la maquette du 29/07/2026 : fond plein, coins
// arrondis, horloge au-dessus et le mot en dessous. Le composant `badge` de
// shadcn ne convient pas ici (pilule horizontale, sans icône, et ses variantes
// n'ont ni ambre ni orange) : la maquette prime sur le socle.
//
// La couleur porte deux informations, et c'est voulu :
//
// 1. La TEINTE dit ce qu'on compte. Le chaud compte une voiture qui doit
//    rentrer, le bleu une voiture qui doit partir. Sans cette distinction, un
//    départ dans 5 jours et un retour dans 5 jours donnent la même pastille, et
//    il faut relire la ligne pour savoir de quoi on parle.
// 2. La DENSITÉ dit l'urgence, et elle monte à mesure que l'échéance approche :
//    fond le plus neutre au loin, de plus en plus dense ensuite, jusqu'au bloc
//    plein à texte blanc pour le jour même et pour l'échéance dépassée.
//
// Les deux derniers tons chauds reprennent tels quels les blocs que le gérant a
// déjà sous les yeux : orange plein pour un retour du jour, rouge plein pour un
// retard. Un véhicule non restitué est l'alerte la plus forte de l'écran, elle
// ne peut pas être le fond le plus pâle des cinq.

/** Ce que la pastille décompte : un retour attendu, ou un départ à venir. */
export type FamilleDelai = 'retour' | 'depart'

const PALETTES: Record<FamilleDelai, Record<TonDelai, string>> = {
  retour: {
    lointain:   'bg-gray-100 text-gray-600',
    proche:     'bg-amber-100 text-amber-700',
    demain:     'bg-amber-200 text-amber-800',
    aujourdhui: 'bg-orange-500 text-white',
    retard:     'bg-red-500 text-white',
  },
  depart: {
    lointain:   'bg-blue-50 text-blue-700',
    proche:     'bg-blue-100 text-blue-700',
    demain:     'bg-blue-200 text-blue-800',
    aujourdhui: 'bg-blue-500 text-white',
    // Seul ton qui sort du bleu : un client qui n'est pas venu chercher sa
    // voiture est une relance à passer, pas un véhicule dehors qui n'est pas
    // rentré. Il garde donc l'orange que le gérant voit aujourd'hui, distinct
    // du rouge réservé aux retours dépassés.
    retard:     'bg-orange-500 text-white',
  },
}

interface DelaiPastilleProps {
  /** Jours d'écart, déjà calculés par l'écran. Négatif = échéance dépassée. */
  jours: number
  /** L'échéance : sert à écrire la date au-delà d'un mois. Voir `libelleDelai`. */
  echeance: string | number | Date
  /** Voir `libelleDelai` : retard alors que le compte de jours vaut encore 0. */
  enRetard?: boolean
  /** Retour attendu par défaut : c'est le cas le plus fréquent de l'écran. */
  famille?: FamilleDelai
  className?: string
}

export default function DelaiPastille({ jours, echeance, enRetard, famille = 'retour', className = '' }: DelaiPastilleProps) {
  const { libelle, ton } = libelleDelai(jours, echeance, enRetard)
  return (
    <div className={`min-w-[64px] rounded-2xl px-3 py-2.5 flex flex-col items-center justify-center gap-1 flex-shrink-0 ${PALETTES[famille][ton]} ${className}`}>
      <Clock className="w-5 h-5" />
      <span className="text-[11px] font-bold leading-none whitespace-nowrap">{libelle}</span>
    </div>
  )
}
