'use client'

import { useActionState } from 'react'
import type { Vehicle } from '@/types/database'

interface VehicleFormProps {
  action: (formData: FormData) => Promise<{ error: string } | void>
  vehicle?: Vehicle
}

const FUEL_TYPES = ['essence', 'diesel', 'hybride', 'electrique']
const CATEGORIES = ['citadine', 'berline', 'suv', 'utilitaire']
const TRANSMISSIONS = ['manuelle', 'automatique']

export default function VehicleForm({ action, vehicle }: VehicleFormProps) {
  const [state, formAction, pending] = useActionState(async (_prev: any, formData: FormData) => {
    return action(formData)
  }, null)

  const v = vehicle

  return (
    <form action={formAction} className="space-y-6">
      {state?.error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      {/* Identification */}
      <Section title="Identification">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="Immatriculation *" name="plate" defaultValue={v?.plate} required placeholder="AA-123-BB" className="uppercase" />
          <Field label="Marque *" name="brand" defaultValue={v?.brand} required placeholder="Renault" />
          <Field label="Modèle *" name="model" defaultValue={v?.model} required placeholder="Clio" />
          <Field label="Version" name="version" defaultValue={v?.version ?? ''} placeholder="1.5 dCi 90ch" />
          <Field label="Année" name="year" type="number" defaultValue={v?.year?.toString() ?? ''} placeholder="2022" min="1990" max="2030" />
          <Field label="Couleur" name="color" defaultValue={v?.color ?? ''} placeholder="Blanc" />
          <Field label="VIN / N° de série" name="vin" defaultValue={v?.vin ?? ''} placeholder="VF1AB..." />
          <SelectField label="Carburant" name="fuel_type" defaultValue={v?.fuel_type ?? ''} options={FUEL_TYPES} />
          <SelectField label="Catégorie" name="category" defaultValue={v?.category ?? ''} options={CATEGORIES} />
          <SelectField label="Transmission" name="transmission" defaultValue={v?.transmission ?? ''} options={TRANSMISSIONS} />
          <Field label="Places" name="seats" type="number" defaultValue={v?.seats?.toString() ?? '5'} min="1" max="9" />
          <Field label="Portes" name="doors" type="number" defaultValue={v?.doors?.toString() ?? '5'} min="2" max="6" />
          <Field label="Puissance fiscale (CV)" name="fiscal_power" type="number" defaultValue={v?.fiscal_power?.toString() ?? ''} />
          <Field label="Puissance moteur (ch)" name="engine_power" type="number" defaultValue={v?.engine_power?.toString() ?? ''} />
          <Field label="KM actuels" name="current_km" type="number" defaultValue={v?.current_km?.toString() ?? '0'} min="0" />
        </div>
      </Section>

      {/* Tarification */}
      <Section title="Tarification">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="Prix/jour (€)" name="daily_price" type="number" defaultValue={v?.daily_price?.toString() ?? ''} placeholder="50" step="0.01" />
          <Field label="Prix/semaine (€)" name="weekly_price" type="number" defaultValue={v?.weekly_price?.toString() ?? ''} placeholder="300" step="0.01" />
          <Field label="Caution (€)" name="deposit_amount" type="number" defaultValue={v?.deposit_amount?.toString() ?? ''} placeholder="500" step="0.01" />
          <Field label="KM inclus/jour" name="km_included_daily" type="number" defaultValue={v?.km_included_daily?.toString() ?? ''} placeholder="200" />
          <Field label="Supplément KM (€/km)" name="extra_km_price" type="number" defaultValue={v?.extra_km_price?.toString() ?? ''} placeholder="0.15" step="0.01" />
          <Field label="Date de mise en location" name="rental_start_date" type="date" defaultValue={v?.rental_start_date ?? ''} />
        </div>
      </Section>

      {/* Assurance & entretien */}
      <Section title="Assurance & entretien">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="Assureur" name="insurance_company" defaultValue={v?.insurance_company ?? ''} />
          <Field label="N° contrat assurance" name="insurance_contract_ref" defaultValue={v?.insurance_contract_ref ?? ''} />
          <Field label="Expiration assurance" name="insurance_expiry" type="date" defaultValue={v?.insurance_expiry ?? ''} />
          <Field label="Contrôle technique" name="ct_date" type="date" defaultValue={v?.ct_date ?? ''} />
          <Field label="Prochain entretien KM" name="next_service_km" type="number" defaultValue={v?.next_service_km?.toString() ?? ''} />
          <Field label="Prochain entretien date" name="next_service_date" type="date" defaultValue={v?.next_service_date ?? ''} />
        </div>
      </Section>

      {/* Notes */}
      <Section title="Notes internes">
        <textarea
          name="notes"
          defaultValue={v?.notes ?? ''}
          rows={3}
          placeholder="Observations, historique..."
          className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
        />
      </Section>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="px-6 py-3 bg-[#111111] hover:bg-gray-800 disabled:opacity-60 text-white font-semibold rounded-xl transition-colors text-sm"
        >
          {pending ? 'Enregistrement...' : (vehicle ? 'Mettre à jour' : 'Créer le véhicule')}
        </button>
      </div>
    </form>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <h3 className="font-semibold text-slate-800 mb-4">{title}</h3>
      {children}
    </div>
  )
}

function Field({
  label, name, type = 'text', defaultValue = '', required = false,
  placeholder, min, max, step, className
}: {
  label: string; name: string; type?: string; defaultValue?: string
  required?: boolean; placeholder?: string; min?: string; max?: string
  step?: string; className?: string
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-xs font-medium text-slate-600 mb-1.5 uppercase tracking-wide">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        className={`w-full px-3 py-2.5 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${className ?? ''}`}
      />
    </div>
  )
}

function SelectField({
  label, name, defaultValue, options
}: {
  label: string; name: string; defaultValue?: string; options: string[]
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-xs font-medium text-slate-600 mb-1.5 uppercase tracking-wide">
        {label}
      </label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue ?? ''}
        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
      >
        <option value="">— Choisir —</option>
        {options.map(o => (
          <option key={o} value={o} className="capitalize">{o}</option>
        ))}
      </select>
    </div>
  )
}
