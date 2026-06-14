'use client'

import { useState, useRef, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

interface InlineEditFieldProps {
  value: string
  onSave: (newValue: string) => Promise<void>
  multiline?: boolean
  placeholder?: string
  displayClassName?: string
}

export default function InlineEditField({ value, onSave, multiline, placeholder, displayClassName }: InlineEditFieldProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null)

  useEffect(() => { if (editing) ref.current?.focus() }, [editing])

  const save = async () => {
    if (draft === value) { setEditing(false); return }
    setSaving(true)
    await onSave(draft)
    setSaving(false)
    setEditing(false)
  }

  if (editing) {
    const Field = multiline ? 'textarea' : 'input'
    return (
      <Field
        ref={ref}
        value={draft}
        onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' && !multiline) save() }}
        className="w-full text-[13px] text-gray-700 border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-gray-300"
        rows={multiline ? 3 : undefined}
      />
    )
  }

  return (
    <button onClick={() => setEditing(true)} className={`text-left w-full min-h-[auto] ${displayClassName ?? 'text-[13px] text-gray-700'}`}>
      <AnimatePresence mode="wait">
        <motion.span key={saving ? 'saving' : 'idle'} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {saving ? 'Enregistrement...' : value || <span className="text-gray-400">{placeholder ?? 'Cliquer pour éditer'}</span>}
        </motion.span>
      </AnimatePresence>
    </button>
  )
}
