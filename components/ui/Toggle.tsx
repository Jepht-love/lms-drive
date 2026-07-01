'use client'

interface ToggleProps {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  /** Si fourni, le libellé s'affiche à gauche et toute la ligne est cliquable. */
  label?: string
  /** Couleur de l'état activé. Par défaut vert iOS #34C759. */
  onColor?: string
}

// Toggle style iOS Réglages : piste 51×31, knob 27px, vert ON / gris OFF.
export default function Toggle({ checked, onChange, disabled, label, onColor = '#34C759' }: ToggleProps) {
  const track = (
    <span
      aria-hidden
      className="relative inline-block rounded-full flex-shrink-0"
      style={{
        width: 51, height: 31,
        backgroundColor: checked ? onColor : '#E5E5EA',
        transition: 'background-color 0.2s ease',
      }}
    >
      <span
        className="absolute bg-white rounded-full"
        style={{
          top: 2, width: 27, height: 27,
          boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
          transform: checked ? 'translateX(20px)' : 'translateX(2px)',
          transition: 'transform 0.2s ease',
        }}
      />
    </span>
  )

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => { if (!disabled) onChange(!checked) }}
      className={`flex items-center disabled:opacity-60 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#111111]/30 ${
        label ? 'w-full justify-between gap-3 text-left' : ''
      }`}
    >
      {label && <span className="text-sm text-gray-700">{label}</span>}
      {track}
    </button>
  )
}
