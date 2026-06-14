interface LmsLogoProps {
  size?: 'sm' | 'md' | 'lg'
  variant?: 'full' | 'icon'
}

export default function LmsLogo({ size = 'md', variant = 'full' }: LmsLogoProps) {
  const scales = { sm: 0.7, md: 1, lg: 1.4 }
  const s = scales[size]

  if (variant === 'icon') {
    return (
      <svg width={Math.round(32 * s)} height={Math.round(32 * s)} viewBox="0 0 32 32" fill="none">
        {/* Cercle fond doré subtil */}
        <circle cx="16" cy="16" r="15" fill="#C4A35A" opacity="0.12" />
        {/* Lignes de vitesse */}
        <line x1="4" y1="22" x2="10" y2="22" stroke="#C4A35A" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="2" y1="25" x2="9" y2="25" stroke="#C4A35A" strokeWidth="1" strokeLinecap="round" opacity="0.6"/>
        {/* L cursif simplifié */}
        <path d="M10 8 Q9.5 8 9 8.5 L9 23 Q9 24 10 24 L15 24" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        {/* M */}
        <path d="M15 24 L15 10 L19 18 L23 10 L23 24" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        {/* S avec voiture */}
        <path d="M26 14 Q29 13 28 17 Q27 19 24 19 Q21 19 22 23 Q23 25 27 24" stroke="#C4A35A" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
      </svg>
    )
  }

  return (
    <svg width={Math.round(120 * s)} height={Math.round(40 * s)} viewBox="0 0 120 40" fill="none">
      {/* Texte "lms" en style cursif — tracé SVG */}
      {/* L */}
      <path
        d="M4 8 Q3.5 8 3 9 L3 28 Q3 30 5 30 L12 30"
        stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none"
      />
      {/* m */}
      <path
        d="M13 18 Q13 15 15 14 Q17 13 18 15 L18 30 M18 18 Q18 15 20 14 Q22 13 23 15 L23 30"
        stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none"
      />
      {/* s avec silhouette voiture intégrée */}
      <path
        d="M29 17 Q35 14 34 19 Q33 22 28 22 Q25 22 26 27 Q27 31 34 29"
        stroke="#C4A35A" strokeWidth="2.2" strokeLinecap="round" fill="none"
      />
      {/* Petite voiture dans le S */}
      <path
        d="M28 20 L30 19 L32 19 L33 20 L33 21.5 L28 21.5 Z"
        fill="#C4A35A" opacity="0.7"
      />
      <circle cx="29.5" cy="22" r="0.8" fill="#C4A35A"/>
      <circle cx="32" cy="22" r="0.8" fill="#C4A35A"/>

      {/* Séparateur */}
      <line x1="40" y1="10" x2="40" y2="32" stroke="#2A2A2A" strokeWidth="1"/>

      {/* DRIVE — lettrage propre */}
      <text
        x="46" y="25"
        fill="white"
        fontSize="13"
        fontWeight="700"
        letterSpacing="4"
        fontFamily="Arial, sans-serif"
        style={{ fontSize: '13px' }}
      >
        DRIVE
      </text>

      {/* Lignes de vitesse sous DRIVE */}
      <line x1="46" y1="30" x2="68" y2="30" stroke="#C4A35A" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="46" y1="33" x2="60" y2="33" stroke="#C4A35A" strokeWidth="1" strokeLinecap="round" opacity="0.5"/>
    </svg>
  )
}
