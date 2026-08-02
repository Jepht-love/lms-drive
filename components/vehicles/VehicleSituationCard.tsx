import type { ReactNode } from 'react'
import type { SituationVehicule } from '@/lib/vehicles/situation'
import { fmtAgence } from '@/lib/format/heureAgence'

/**
 * La carte noire qui dit où est un véhicule : « Revient le 31 août à 12:50, en
 * location, Rayane Jeguirim », « En déplacement », ou « Disponible ».
 *
 * D'où ça vient. Écrite dans l'écran Réservations le 28/07/2026, sortie de cet
 * écran le 02/08/2026 sur demande de Jeff (remarque 46) pour servir aussi à
 * Suivi véhicule et à Déplacements. Le rendu ne doit pas changer d'un écran à
 * l'autre : c'est tout l'intérêt de la partager.
 *
 * Ce qu'elle attend : une situation calculée par `fetchSituationVehicule`, et le
 * bouton d'action propre à l'écran (`action`), qui est le seul élément variable.
 *
 * À ne pas casser :
 *  - **les heures passent par `fmtAgence`.** Ces trois écrans sont calculés sur
 *    le serveur, et Vercel tourne en temps universel : un retour à 12:50 s'y
 *    écrirait 10:50 l'été. La version d'origine utilisait le fuseau du serveur,
 *    corrigé en sortant le composant ;
 *  - l'ordre des trois cas : location en cours, puis déplacement, puis
 *    disponible. Une voiture chez un client n'est jamais annoncée disponible,
 *    même si une ligne de déplacement traîne.
 */
export default function VehicleSituationCard({
  situation,
  action,
}: {
  situation: SituationVehicule
  action?: ReactNode
}) {
  const heure = (iso: string) =>
    fmtAgence(iso, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="bg-[#111111] text-white rounded-2xl p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">{situation.label}</p>

      {situation.enCours ? (
        <>
          <p className={`text-lg font-black mt-1 ${situation.enCours.enRetard ? 'text-red-400' : ''}`}>
            {situation.enCours.enRetard ? 'Devait revenir le ' : 'Revient le '}
            {heure(situation.enCours.fin)}
          </p>
          <p className="text-xs text-white/60 mt-0.5">
            {situation.enCours.enRetard ? 'En retard' : 'En location'} · {situation.enCours.client}
          </p>
        </>
      ) : situation.deplacement ? (
        <>
          <p className="text-lg font-black mt-1 text-indigo-300">En déplacement</p>
          <p className="text-xs text-white/60 mt-0.5">
            {situation.deplacement.motif}
            {situation.deplacement.retour
              ? ` · retour prévu le ${heure(situation.deplacement.retour)}`
              : ' · retour non renseigné'}
          </p>
        </>
      ) : (
        <>
          <p className="text-lg font-black mt-1 text-emerald-300">Disponible</p>
          {situation.precedente && (
            <p className="text-xs text-white/60 mt-0.5">
              Rentré le {heure(situation.precedente.fin)} · {situation.precedente.client}
            </p>
          )}
        </>
      )}

      {situation.suivante && (
        <p className="text-xs text-white/60 mt-1.5 pt-1.5 border-t border-white/10">
          Repart le {heure(situation.suivante.debut)} · {situation.suivante.client}
        </p>
      )}

      {/* Ligne d'entretien : uniquement sur Suivi véhicule, où c'est
          l'information utile à côté de la disponibilité (demande du 02/08/2026). */}
      {situation.entretien && (
        <p className={`text-xs mt-1.5 pt-1.5 border-t border-white/10 ${situation.entretien.urgent ? 'text-amber-300' : 'text-white/60'}`}>
          {situation.entretien.texte}
        </p>
      )}

      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}
