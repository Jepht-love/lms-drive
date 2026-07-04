// Grille signature 5×5 — 25 véhicules avec pastille de statut.
// Distribution + délais FIXES (déterministes) pour éviter tout mismatch
// d'hydratation SSR/CSR : 14 verts (actif), 7 bleus (en déplacement), 4 gris (inactif).

type Status = 'green' | 'blue' | 'gray'

const CELLS: { status: Status; delay: number }[] = [
  { status: 'green', delay: 0 },    { status: 'blue', delay: 320 },  { status: 'green', delay: 640 },  { status: 'gray', delay: 0 },    { status: 'green', delay: 180 },
  { status: 'blue', delay: 900 },   { status: 'green', delay: 240 }, { status: 'green', delay: 560 },  { status: 'blue', delay: 120 },  { status: 'green', delay: 780 },
  { status: 'green', delay: 460 },  { status: 'gray', delay: 0 },    { status: 'green', delay: 700 },  { status: 'green', delay: 200 }, { status: 'blue', delay: 1040 },
  { status: 'gray', delay: 0 },     { status: 'green', delay: 380 }, { status: 'blue', delay: 620 },   { status: 'green', delay: 860 }, { status: 'green', delay: 300 },
  { status: 'green', delay: 520 },  { status: 'blue', delay: 140 },  { status: 'gray', delay: 0 },     { status: 'green', delay: 960 }, { status: 'blue', delay: 420 },
]

function SuvIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 13l1.5-4.2A2 2 0 0 1 6.4 7.5h8.8a2 2 0 0 1 1.7 1L19 13" />
      <path d="M2.5 13h19a.5.5 0 0 1 .5.5V16a1 1 0 0 1-1 1h-1" />
      <path d="M4 17H3a1 1 0 0 1-1-1v-2.5a.5.5 0 0 1 .5-.5" />
      <path d="M9 17h6" />
      <circle cx="7" cy="17" r="1.7" />
      <circle cx="17" cy="17" r="1.7" />
    </svg>
  )
}

export default function VehicleGrid() {
  return (
    <div className="fx-vgrid-wrap">
      <div className="fx-vgrid" role="img" aria-label="Flotte institutionnelle numérisée — 25 véhicules avec statut en temps réel">
        {CELLS.map((c, i) => (
          <div key={i} className="fx-vcell">
            <SuvIcon />
            <span
              className={`fx-vdot fx-vdot--${c.status}`}
              style={c.status !== 'gray' ? { animationDelay: `${c.delay}ms` } : undefined}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
