import { Clock, Map, ClipboardCheck, Bell, FileText, Users } from 'lucide-react'
import type { Translation } from '@/lib/fleetaxis-i18n'

const ICONS = [Clock, Map, ClipboardCheck, Bell, FileText, Users]

export default function FeaturesSection({ t }: { t: Translation }) {
  return (
    <section id="features" className="fx-section">
      <div className="fx-container">
        <h2 className="fx-section-title">{t.features.title}</h2>
        <div className="fx-features-grid">
          {t.features.items.map((f, i) => {
            const Icon = ICONS[i]
            return (
              <article key={f.title} className="fx-feature-card">
                <div className="fx-feature-icon"><Icon size={22} /></div>
                <h3 className="fx-feature-title">{f.title}</h3>
                <p className="fx-feature-desc">{f.desc}</p>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
