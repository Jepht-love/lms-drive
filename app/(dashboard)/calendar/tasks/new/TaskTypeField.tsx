'use client'

import { useState } from 'react'

const TYPES = [
  { id: 'lavage',              label: 'Lavage' },
  { id: 'preparation',         label: 'Préparation' },
  { id: 'rendez_vous_client',  label: 'RDV client' },
  { id: 'rendez_vous_garage',  label: 'RDV garage' },
  { id: 'livraison',           label: 'Livraison' },
  { id: 'recuperation',        label: 'Récupération' },
  { id: 'entretien',           label: 'Entretien' },
  { id: 'controle_etat_lieux', label: 'État des lieux' },
  { id: 'paiement_caution',    label: 'Paiement caution' },
  { id: 'document_manquant',   label: 'Document manquant' },
  { id: 'marketing',           label: 'Marketing' },
  { id: 'autre',               label: 'Autre' },
]

export { TYPES }

export default function TaskTypeField({ inputClassName, labelClassName }: { inputClassName: string; labelClassName: string }) {
  const [type, setType] = useState('')

  return (
    <>
      <div>
        <label className={labelClassName}>Type</label>
        <select name="type" className={inputClassName} value={type} onChange={e => setType(e.target.value)}>
          <option value="">— Sélectionner —</option>
          {TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </div>

      <div>
        <label className={labelClassName}>
          {type === 'autre' ? "Précisez le type de tâche *" : 'Description'}
        </label>
        <textarea name="description" rows={3} required={type === 'autre'}
          placeholder={type === 'autre' ? 'Quel est ce type de tâche ?' : 'Détails...'}
          className={`${inputClassName} resize-none ${type === 'autre' ? 'border-amber-200 bg-amber-50' : ''}`} />
      </div>
    </>
  )
}
