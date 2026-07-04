import type { Translation } from '@/lib/fleetaxis-i18n'

export default function TargetSection({ t }: { t: Translation }) {
  return (
    <section className="fx-section fx-section--secondary">
      <div className="fx-container">
        <h2 className="fx-section-title">{t.targets.title}</h2>
        <div className="fx-targets">
          {t.targets.items.map((item) => (
            <div key={item.title} className="fx-target">
              <h3 className="fx-target-title">{item.title}</h3>
              <p className="fx-target-desc">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
