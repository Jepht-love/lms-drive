'use client'

interface ToggleProps {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  /** Si fourni, le libellé s'affiche à gauche et toute la ligne est cliquable. */
  label?: string
  /** Couleur de l'état activé. Par défaut #111111 (charte de l'app). */
  onColor?: string
}

// Interrupteur unique et cohérent pour toute l'app (remplace les toggles dupliqués
// à la main). Piste 44×24, knob 20px blanc avec ombre, glissement fluide.
export default function Toggle({ checked, onChange, disabled, label, onColor = '#111111' }: ToggleProps) {
  const track = (
    <span
      aria-hidden
      className={`relative inline-block w-11 h-6 rounded-full transition-colors flex-shrink-0 ${checked ? '' : 'bg-gray-300'}`}
      style={checked ? { backgroundColor: onColor } : undefined}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
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
