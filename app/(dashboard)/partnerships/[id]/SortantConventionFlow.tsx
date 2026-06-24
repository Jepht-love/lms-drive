import Link from 'next/link'
import { CheckCircle2, Circle, Lock, FileSignature, ClipboardList, ShieldCheck } from 'lucide-react'
import ValidateConventionButton from './ValidateConventionButton'

interface Props {
  operationId: string
  contractId: string | null
  contractStatus: string | null
  conventionSigned: boolean
  depSigned: boolean
  arrSigned: boolean
  closed: boolean
}

// Suivi du flux SORTANT : convention signée → EDL départ signé → EDL retour
// signé → clôturée. Calqué sur WorkflowStepper mais basé sur l'opération.
export default function SortantConventionFlow({
  operationId, contractId, conventionSigned, depSigned, arrSigned, closed,
}: Props) {
  const canValidate = conventionSigned && depSigned && arrSigned && !closed

  const steps = [
    {
      icon: <FileSignature className="w-4 h-4" />,
      label: 'Convention signée',
      sub: conventionSigned ? 'Signée par le représentant partenaire' : 'À établir et faire signer',
      done: conventionSigned,
      active: !conventionSigned,
      action: !conventionSigned ? (
        <Link href={`/partnerships/${operationId}/convention`} className="text-xs text-blue-600 hover:underline font-medium mt-1 block">
          Établir / signer la convention →
        </Link>
      ) : (
        <Link href={`/partnerships/${operationId}/convention`} className="text-xs text-slate-400 hover:underline mt-1 block">
          Revoir la convention
        </Link>
      ),
    },
    {
      icon: <ClipboardList className="w-4 h-4" />,
      label: 'État des lieux de départ signé',
      sub: depSigned ? 'Signé' : conventionSigned ? 'Constatez l\'état du véhicule remis' : 'Après la convention',
      done: depSigned,
      active: conventionSigned && !depSigned,
      locked: !conventionSigned,
      action: conventionSigned && !depSigned ? (
        <Link href={`/inspections/ia-departure/${operationId}`} className="text-xs text-blue-600 hover:underline font-medium mt-1 block">
          Faire l&apos;état des lieux de départ →
        </Link>
      ) : null,
    },
    {
      icon: <ClipboardList className="w-4 h-4" />,
      label: 'État des lieux de retour signé',
      sub: arrSigned ? 'Signé' : depSigned ? 'Au retour du véhicule' : 'Après l\'état des lieux de départ',
      done: arrSigned,
      active: depSigned && !arrSigned,
      locked: !depSigned,
      action: depSigned && !arrSigned && contractId ? (
        <Link href={`/inspections/ia-arrival/${contractId}`} className="text-xs text-purple-600 hover:underline font-medium mt-1 block">
          Faire l&apos;état des lieux de retour →
        </Link>
      ) : null,
    },
    {
      icon: <ShieldCheck className="w-4 h-4" />,
      label: 'Convention clôturée',
      sub: closed ? 'Clôturée — véhicule remis disponible' : canValidate ? 'Les 2 états des lieux sont signés' : 'Requiert les 2 états des lieux signés',
      done: closed,
      active: canValidate,
      locked: !canValidate && !closed,
      action: null,
    },
  ]

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-4">Convention & états des lieux</p>
      <div className="space-y-3">
        {steps.map((step, i) => (
          <div key={i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                step.done ? 'bg-emerald-100 text-emerald-600'
                : step.active ? 'bg-blue-100 text-blue-600 ring-2 ring-blue-200'
                : 'bg-slate-100 text-slate-400'
              }`}>
                {step.done ? <CheckCircle2 className="w-4 h-4" /> : step.locked ? <Lock className="w-3.5 h-3.5" /> : step.icon}
              </div>
              {i < steps.length - 1 && <div className={`w-0.5 mt-1 h-4 ${step.done ? 'bg-emerald-200' : 'bg-slate-100'}`} />}
            </div>
            <div className="flex-1 pb-1">
              <p className={`text-sm font-medium ${step.done ? 'text-emerald-700' : step.active ? 'text-slate-900' : 'text-slate-400'}`}>{step.label}</p>
              <p className={`text-xs mt-0.5 ${step.done ? 'text-emerald-600/70' : step.active ? 'text-slate-500' : 'text-slate-300'}`}>{step.sub}</p>
              {step.action}
            </div>
          </div>
        ))}
      </div>
      {canValidate && contractId && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <ValidateConventionButton contractId={contractId} />
        </div>
      )}
    </div>
  )
}
