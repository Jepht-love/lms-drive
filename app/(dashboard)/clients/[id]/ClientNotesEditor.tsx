'use client'

import InlineEditField from '@/components/InlineEditField'
import { updateClientNotes } from '@/lib/actions/clients'

export default function ClientNotesEditor({ clientId, notes }: { clientId: string; notes: string | null }) {
  return (
    <InlineEditField
      value={notes ?? ''}
      onSave={async (val) => {
        const result = await updateClientNotes(clientId, val)
        if (result && 'error' in result) return { error: result.error }
      }}
      multiline
      placeholder="Ajouter une note interne..."
      displayClassName="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed"
    />
  )
}
