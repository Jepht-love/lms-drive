import { Check, ArrowDown } from 'lucide-react'
import type { Translation } from '@/lib/fleetaxis-i18n'
import VehicleGrid from './VehicleGrid'

export default function HeroSection({ t }: { t: Translation }) {
  return (
    <header id="top" className="fx-container fx-hero">
      <div className="fx-hero-grid">
        <div className="fx-hero-text">
          <p className="fx-section-eyebrow">{t.hero.eyebrow}</p>
          <h1 className="fx-hero-h1">
            {t.hero.h1[0]}<br />{t.hero.h1[1]}
          </h1>
          <p className="fx-hero-sub">{t.hero.sub}</p>

          <div className="fx-cta-row">
            <a href="#contact" className="fx-btn fx-btn--primary">{t.hero.cta1}</a>
            <a href="#pricing" className="fx-btn fx-btn--secondary">
              {t.hero.cta2} <ArrowDown size={16} />
            </a>
          </div>

          <div className="fx-trust">
            {t.hero.trust.map((item) => (
              <span key={item} className="fx-trust-item">
                <Check size={15} /> {item}
              </span>
            ))}
          </div>
        </div>

        <VehicleGrid />
      </div>
    </header>
  )
}
