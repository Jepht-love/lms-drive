import { Lock, ClipboardList, Globe, BarChart3 } from 'lucide-react'
import type { Translation } from '@/lib/fleetaxis-i18n'

const ICONS = [Lock, ClipboardList, Globe, BarChart3]

export default function ComplianceSection({ t }: { t: Translation }) {
  return (
    <section className="fx-section">
      <div className="fx-container">
        <h2 className="fx-section-title">{t.compliance.title}</h2>
        <div className="fx-badges">
          {t.compliance.badges.map((b, i) => {
            const Icon = ICONS[i]
            return (
              <div key={b.fr} className="fx-badge">
                <span className="fx-badge-icon"><Icon size={24} /></span>
                <p className="fx-badge-fr">{b.fr}</p>
                <p className="fx-badge-en">{b.en}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
