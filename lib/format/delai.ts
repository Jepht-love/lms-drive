import { fmtAgence } from '@/lib/format/heureAgence'

/**
 * Écrit un délai en jours de la façon dont le gérant le lit : un mot, pas un
 * nombre brut.
 *
 * Les pastilles du tableau de bord affichaient « 0 auj. », « 5 jours »,
 * « 33 jours » : un chiffre et une abréviation, illisibles d'un coup d'œil sur
 * un téléphone (retour Jeff du 29/07/2026). La règle retenue reprend la
 * maquette : « Aujourd'hui », « Demain », « Dans 2 jours », puis « Dans N
 * jours » jusqu'à un mois, la date au-delà, et « +N jours » quand l'échéance
 * est dépassée.
 *
 * Cette fonction ne calcule RIEN : elle reçoit un nombre de jours déjà calculé
 * par l'écran appelant et se contente de l'écrire. Elle vit ici, à côté de
 * `heureAgence`, parce qu'elle rend du texte : elle sert aussi bien à un écran
 * qu'à une notification ou à un e-mail, où aucun composant React ne passe.
 */

/** Les cinq tons de la maquette, du plus calme au plus urgent. */
export type TonDelai = 'aujourdhui' | 'demain' | 'proche' | 'lointain' | 'retard'

export interface Delai {
  /** Texte à afficher tel quel, déjà accordé au pluriel. */
  libelle: string
  ton: TonDelai
}

/**
 * Au-delà d'un mois, un nombre de jours à trois chiffres n'apprend rien : on ne
 * situe pas « Dans 340 jours » dans un calendrier, et le texte élargit la
 * pastille au détriment de la ligne du véhicule, à côté. La date reste courte
 * et se situe tout de suite.
 */
const SEUIL_DATE_JOURS = 30

/**
 * @param jours    Nombre de jours d'écart, déjà calculé. Positif = à venir,
 *                 négatif = échéance dépassée.
 * @param echeance L'échéance elle-même. Elle ne sert qu'au-delà d'un mois, pour
 *                 écrire la date à la place du nombre de jours, et passe par
 *                 `fmtAgence` : ce texte est fabriqué côté serveur, où Vercel
 *                 tourne en temps universel, et une échéance de fin de journée
 *                 s'écrirait sinon avec un jour de retard.
 * @param enRetard Force le ton « retard » alors que le compte de jours n'est
 *                 pas encore négatif : un retour dont l'HEURE est passée le jour
 *                 même est en retard, avec `jours` à 0. Sans ce drapeau il
 *                 s'afficherait « Aujourd'hui ».
 */
export function libelleDelai(
  jours: number,
  echeance: string | number | Date,
  enRetard = false,
): Delai {
  if (jours < 0) {
    const n = Math.abs(jours)
    return { libelle: `+${n} jour${n > 1 ? 's' : ''}`, ton: 'retard' }
  }
  if (enRetard) return { libelle: 'En retard', ton: 'retard' }
  if (jours === 0) return { libelle: 'Aujourd’hui', ton: 'aujourdhui' }
  if (jours === 1) return { libelle: 'Demain', ton: 'demain' }
  if (jours === 2) return { libelle: 'Dans 2 jours', ton: 'proche' }
  if (jours > SEUIL_DATE_JOURS) {
    // « Le 1er févr. » et non « Le 1 févr. » : en français le premier du mois
    // s'écrit en ordinal. Les autres jours restent des nombres simples, et le
    // motif ne peut pas attraper un 11 ou un 12 (chiffre collé, pas d'espace).
    const date = fmtAgence(echeance, { day: 'numeric', month: 'short' }).replace(/^1 /, '1er ')
    return { libelle: `Le ${date}`, ton: 'lointain' }
  }
  return { libelle: `Dans ${jours} jours`, ton: 'lointain' }
}
