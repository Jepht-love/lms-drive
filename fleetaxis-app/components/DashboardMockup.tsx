// Maquette animée du tableau de bord FleetAxis — pur CSS, SSR-safe.

const vehicles = [
  { name: 'Toyota Hilux', plate: 'DK-4521-A', statusKey: 'active' as const },
  { name: 'Renault Master', plate: 'DK-7830-B', statusKey: 'maintenance' as const },
  { name: 'Peugeot 3008', plate: 'DK-2204-C', statusKey: 'assigned' as const },
  { name: 'Ford Transit', plate: 'DK-9115-D', statusKey: 'available' as const },
]

const STATUS_DOT = {
  active: 'fx-dm-dot--green',
  maintenance: 'fx-dm-dot--yellow',
  assigned: 'fx-dm-dot--blue',
  available: 'fx-dm-dot--gray',
} as const

export default function DashboardMockup() {
  return (
    <div className="fx-dm" role="img" aria-label="Aperçu du tableau de bord FleetAxis">
      {/* Barre chrome macOS */}
      <div className="fx-dm-chrome">
        <div className="fx-dm-chrome-dots">
          <span /><span /><span />
        </div>
        <span className="fx-dm-chrome-title">FleetAxis · Tableau de bord</span>
        <span className="fx-dm-chrome-badge">● Live</span>
      </div>

      <div className="fx-dm-body">
        {/* Panneau liste */}
        <div className="fx-dm-list">
          <p className="fx-dm-list-label">FLOTTE · 4 véhicules</p>
          {vehicles.map((v, i) => (
            <div key={v.plate} className={`fx-dm-row${i === 0 ? ' fx-dm-row--active' : ''}`}>
              <span className={`fx-dm-dot ${STATUS_DOT[v.statusKey]}`} />
              <div>
                <div className="fx-dm-row-name">{v.name}</div>
                <div className="fx-dm-row-plate">{v.plate}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Panneau détail — véhicule actif */}
        <div className="fx-dm-detail">
          <div className="fx-dm-detail-header">
            <span className="fx-dm-detail-vname">Toyota Hilux</span>
            <span className="fx-dm-badge fx-dm-badge--green">En course</span>
          </div>

          <div className="fx-dm-fields">
            <div className="fx-dm-field">
              <span className="fx-dm-field-label">Départ</span>
              <span className="fx-dm-field-value">08:30 · Dakar</span>
            </div>
            <div className="fx-dm-field">
              <span className="fx-dm-field-label">Destination</span>
              <span className="fx-dm-field-value">Thiès</span>
            </div>
            <div className="fx-dm-field">
              <span className="fx-dm-field-label">Chauffeur</span>
              <span className="fx-dm-field-value">I. Sow</span>
            </div>
            <div className="fx-dm-field">
              <span className="fx-dm-field-label">Kilométrage</span>
              <span className="fx-dm-field-value fx-mono">48 230 km</span>
            </div>
            <div className="fx-dm-field">
              <span className="fx-dm-field-label">EDL départ</span>
              <span className="fx-dm-field-value fx-dm-ok">✓ Signé · 08:15</span>
            </div>
            <div className="fx-dm-field">
              <span className="fx-dm-field-label">Retour prévu</span>
              <span className="fx-dm-field-value">~16:30</span>
            </div>
          </div>

          {/* Progression du trajet */}
          <div className="fx-dm-route">
            <div className="fx-dm-route-track">
              <div className="fx-dm-route-fill" />
              <span className="fx-dm-route-dot" />
            </div>
            <div className="fx-dm-route-labels">
              <span>Dakar</span>
              <span>Thiès</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
