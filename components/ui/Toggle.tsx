'use client'

interface ToggleProps {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  /** Si fourni, le libellé s'affiche à gauche et toute la ligne est cliquable. */
  label?: string
  /** Couleur de l'état activé. Par défaut noir LMS Drive #111111 (couleur de l'app). */
  onColor?: string
}

// Toggle style iOS Réglages : piste 51×31, knob 27px, noir app ON / gris OFF.
export default function Toggle({ checked, onChange, disabled, label, onColor = '#111111' }: ToggleProps) {
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
          // Position pilotée par `left` explicite dans les deux états → géométrie
          // déterministe et immunisée contre toute règle CSS de page (aucune règle
          // externe left/right ne peut s'appliquer, l'inline gagne). Le glissement
          // reste animé par translateX (compositeur, fluide), amplitude 0→20px.
          //   OFF : left 2 + 0  = 2px            (marge gauche 2px)
          //   ON  : left 2 + 20 = 22px → 22+27=49 (marge droite 2px)   piste 51px
          top: 2, left: 2, width: 27, height: 27,
          boxShadow: '0 2px 4px rgba(0,0,0,0.15), 0 2px 4px rgba(0,0,0,0.1)',
          transform: checked ? 'translateX(20px)' : 'translateX(0)',
          transition: 'transform 0.22s cubic-bezier(0.4, 0.0, 0.2, 1)',
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
