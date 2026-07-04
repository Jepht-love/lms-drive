'use client'

import type { Lang, Translation } from '@/lib/i18n'

function LogoMark() {
  return (
    <svg className="fx-logo-mark" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="0.5" y="0.5" width="8.5" height="8.5" rx="1.5" fill="#1D6AF0" />
      <rect x="11" y="0.5" width="8.5" height="8.5" rx="1.5" fill="#243B5E" />
      <rect x="0.5" y="11" width="8.5" height="8.5" rx="1.5" fill="#243B5E" />
      <rect x="11" y="11" width="8.5" height="8.5" rx="1.5" fill="#243B5E" />
    </svg>
  )
}

export default function Navbar({
  t, lang, setLang,
}: { t: Translation; lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <nav className="fx-nav">
      <div className="fx-container fx-nav-inner">
        <a href="#top" className="fx-logo" aria-label="FleetAxis">
          <LogoMark />
          <span className="fx-logo-text">FleetAxis</span>
        </a>

        <div className="fx-nav-links">
          <a href="#features" className="fx-nav-link">{t.nav.features}</a>
          <a href="#pricing" className="fx-nav-link">{t.nav.pricing}</a>
          <a href="#contact" className="fx-nav-link">{t.nav.contact}</a>
        </div>

        <div className="fx-nav-right">
          <div className="fx-lang" role="group" aria-label="Langue / Language">
            <button
              type="button"
              className={`fx-lang-btn${lang === 'fr' ? ' fx-lang-btn--active' : ''}`}
              onClick={() => setLang('fr')}
              aria-pressed={lang === 'fr'}
            >FR</button>
            <button
              type="button"
              className={`fx-lang-btn${lang === 'en' ? ' fx-lang-btn--active' : ''}`}
              onClick={() => setLang('en')}
              aria-pressed={lang === 'en'}
            >EN</button>
          </div>
          <a href="#contact" className="fx-nav-cta">{t.nav.demo}</a>
        </div>
      </div>
    </nav>
  )
}
