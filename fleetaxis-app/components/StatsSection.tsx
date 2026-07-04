import type { Translation } from '@/lib/i18n'

export default function StatsSection({ t }: { t: Translation }) {
  return (
    <section className="fx-section fx-section--secondary">
      <div className="fx-container">
        <div className="fx-stats-grid">
          {t.stats.items.map((s) => (
            <div key={s.label} className="fx-stat">
              <div className="fx-stat-value fx-mono">{s.value}</div>
              <div className="fx-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
