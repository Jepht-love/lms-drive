import type { MaintenanceFlag } from '@/types/database'

const SEV_CLS: Record<MaintenanceFlag['severity'], string> = {
  attention: 'bg-orange-100 text-orange-700',
  rayure:    'bg-yellow-100 text-yellow-700',
  dommage:   'bg-red-100 text-red-700',
}

const SEV_LABEL: Record<MaintenanceFlag['severity'], string> = {
  attention: 'À surveiller',
  rayure:    'Rayure',
  dommage:   'Dommage',
}

/**
 * Une ligne de dommage déclaré. Constat seul, aucune action.
 *
 * Remplace ResolveDamageRow depuis le 01/08/2026, sur décision de Jeff. Cette
 * ligne portait auparavant deux boutons, « Devis » et « Réparé ». Les deux sont
 * partis, et pour la même raison : **déclarer un dommage arrive avant qu'un devis
 * existe**, et une réparation passe désormais obligatoirement par une intervention
 * au garage (page entretien du véhicule). Le montant du garage se saisit donc là,
 * jamais ici.
 *
 * Ce qu'elle attend : un dégât de `vehicles.maintenance_flags`.
 * Ce qu'elle produit : rien, elle n'écrit pas.
 *
 * Partagée par la fiche véhicule et la page entretien.
 *
 * Ce qu'il ne faut pas casser : la mise en page passe à la ligne sur téléphone
 * (`flex-wrap`). Sans ça, la gravité, le libellé et la provenance se chevauchent
 * en largeur iPhone, constaté par Jeff le 01/08/2026.
 */
export default function DamageRow({ flag }: { flag: MaintenanceFlag }) {
  return (
    <div className="rounded-xl bg-gray-50 px-2.5 py-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${SEV_CLS[flag.severity] ?? 'bg-gray-100 text-gray-700'}`}>
          {SEV_LABEL[flag.severity] ?? flag.severity}
        </span>
        <span className="text-sm text-gray-700 min-w-0 flex-1 break-words">{flag.label}</span>
        {flag.source === 'manuel' && (
          <span className="text-[10px] text-gray-400">déclaré à la main</span>
        )}
        {/* Un dommage déjà confié au garage ne peut plus repartir dans une autre
            intervention : le dire, sinon on le croit oublié. */}
        {flag.intervention_id && (
          <span className="text-[10px] font-semibold text-blue-600">au garage</span>
        )}
      </div>
    </div>
  )
}
