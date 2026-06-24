import { CheckCircle2, Circle, Lock, ClipboardList, FileSignature, ShieldCheck, CalendarCheck, RotateCcw } from 'lucide-react'
import Link from 'next/link'
import ValidateContractButton from './ValidateContractButton'
import { resetInspection } from '@/lib/actions/delete'

interface InspectionInfo {
  id: string
  type: 'depart' | 'arrivee'
  hasSig: boolean
  signedAt?: string | null
  damages: number
}

interface Props {
  reservationId: string
  contractId?: string | null
  contractStatus?: string | null
  reservationStatus: string
  inspections: InspectionInfo[]
}

export default function WorkflowStepper({
  reservationId,
  contractId,
  contractStatus,
  reservationStatus,
  inspections,
}: Props) {
  const depInsp = inspections.find(i => i.type === 'depart')
  const arrInsp = inspections.find(i => i.type === 'arrivee')

  const step1Done = !!contractId
  const step2Done = !!depInsp?.hasSig
  const step3Done = !!arrInsp?.hasSig
  const step4Done = contractStatus === 'cloture'

  const canValidate = step1Done && step2Done && step3Done && !step4Done

  // Actions reset (server actions bound) — cast as void for form action compatibility
  const resetDep = depInsp?.id
    ? (resetInspection.bind(null, depInsp.id, `/inspections/departure/${reservationId}`) as unknown as () => Promise<void>)
    : null
  const resetArr = arrInsp?.id && contractId
    ? (resetInspection.bind(null, arrInsp.id, `/inspections/arrival/${contractId}`) as unknown as () => Promise<void>)
    : null

  const steps = [
    {
      num: 1,
      icon: <CalendarCheck className="w-4 h-4" />,
      label: 'Contrat établi',
      sublabel: step1Done ? `N° ${contractId?.slice(-6).toUpperCase()}` : 'Démarrez l\'état des lieux de départ',
      done: step1Done,
      active: !step1Done,
      resetAction: null as ((() => Promise<void>) | null),
      resetLabel: null as string | null,
    },
    {
      num: 2,
      icon: <ClipboardList className="w-4 h-4" />,
      label: 'État des lieux de départ signé',
      sublabel: step2Done
        ? `Signé${depInsp?.signedAt ? ' · ' + new Date(depInsp.signedAt).toLocaleDateString('fr-FR') : ''}${depInsp?.damages ? ` · ${depInsp.damages} dommage(s)` : ' · Aucun dommage'}`
        : step1Done ? 'En attente de l\'état des lieux' : 'Créer le contrat en premier',
      done: step2Done,
      active: step1Done && !step2Done,
      locked: !step1Done,
      resetAction: (!step4Done && step2Done && resetDep) ? resetDep : null,
      resetLabel: 'Corriger l\'état des lieux de départ',
      action: step1Done && !step2Done ? (
        <Link
          href={`/inspections/departure/${reservationId}`}
          className="text-xs text-blue-600 hover:underline font-medium mt-1 block"
        >
          Faire l'état des lieux de départ →
        </Link>
      ) : null,
    },
    {
      num: 3,
      icon: <ClipboardList className="w-4 h-4" />,
      label: 'État des lieux de retour signé',
      sublabel: step3Done
        ? `Signé${arrInsp?.signedAt ? ' · ' + new Date(arrInsp.signedAt).toLocaleDateString('fr-FR') : ''}${arrInsp?.damages ? ` · ${arrInsp.damages} dommage(s)` : ' · Aucun dommage'}`
        : step2Done ? 'En attente du retour véhicule' : 'Après l\'état des lieux de départ',
      done: step3Done,
      active: step2Done && !step3Done,
      locked: !step2Done,
      resetAction: (!step4Done && step3Done && resetArr) ? resetArr : null,
      resetLabel: 'Corriger l\'état des lieux de retour',
      action: step2Done && !step3Done && contractId ? (
        <Link
          href={`/inspections/arrival/${contractId}`}
          className="text-xs text-purple-600 hover:underline font-medium mt-1 block"
        >
          Faire l'état des lieux de retour →
        </Link>
      ) : null,
    },
    {
      num: 4,
      icon: <ShieldCheck className="w-4 h-4" />,
      label: 'Contrat validé & clôturé',
      sublabel: step4Done
        ? 'Contrat clôturé — caution libérable'
        : canValidate
          ? 'Les 2 états des lieux sont signés — vous pouvez valider'
          : 'Requiert les 2 états des lieux signés',
      done: step4Done,
      active: canValidate,
      locked: !canValidate && !step4Done,
      resetAction: null as ((() => Promise<void>) | null),
      resetLabel: null as string | null,
    },
  ]

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
      <h3 className="font-semibold text-slate-800 text-sm mb-4">Suivi de la location</h3>

      <div className="space-y-3">
        {steps.map((step, i) => (
          <div key={step.num} className="flex gap-3">
            {/* Icone statut */}
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                step.done ? 'bg-emerald-100 text-emerald-600'
                : step.active ? 'bg-blue-100 text-blue-600 ring-2 ring-blue-200'
                : 'bg-slate-100 text-slate-400'
              }`}>
                {step.done
                  ? <CheckCircle2 className="w-4 h-4" />
                  : step.locked
                    ? <Lock className="w-3.5 h-3.5" />
                    : step.icon}
              </div>
              {i < steps.length - 1 && (
                <div className={`w-0.5 mt-1 h-4 ${step.done ? 'bg-emerald-200' : 'bg-slate-100'}`} />
              )}
            </div>

            {/* Contenu */}
            <div className="flex-1 pb-1">
              <div className="flex items-center justify-between gap-2">
                <p className={`text-sm font-medium ${
                  step.done ? 'text-emerald-700'
                  : step.active ? 'text-slate-900'
                  : 'text-slate-400'
                }`}>
                  {step.label}
                </p>
                {/* Bouton corriger EDL */}
                {step.resetAction && (
                  <form action={step.resetAction}>
                    <button
                      type="submit"
                      className="flex items-center gap-1 text-xs text-orange-500 hover:text-orange-700 font-medium transition-colors"
                      title={step.resetLabel ?? ''}
                    >
                      <RotateCcw className="w-3 h-3" />
                      Corriger
                    </button>
                  </form>
                )}
              </div>
              <p className={`text-xs mt-0.5 ${
                step.done ? 'text-emerald-600/70'
                : step.active ? 'text-slate-500'
                : 'text-slate-300'
              }`}>
                {step.sublabel}
              </p>
              {step.action}
            </div>
          </div>
        ))}
      </div>

      {/* Bouton de validation */}
      {canValidate && contractId && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <ValidateContractButton contractId={contractId} />
        </div>
      )}

      {/* Contrat clôturé : message */}
      {step4Done && (
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2 text-emerald-700">
          <ShieldCheck className="w-4 h-4 flex-shrink-0" />
          <p className="text-xs font-medium">Contrat clôturé — la caution peut être libérée</p>
        </div>
      )}
    </div>
  )
}
