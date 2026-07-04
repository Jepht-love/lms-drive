import type { Translation } from '@/lib/i18n'

export default function Footer({ t }: { t: Translation }) {
  return (
    <footer className="fx-footer">
      <div className="fx-container">
        <div className="fx-footer-inner">
          <div>
            <div className="fx-footer-brand">{t.footer.brand}</div>
            <a href={`mailto:${t.footer.mail}`} className="fx-footer-mail">{t.footer.mail}</a>
          </div>
          <nav className="fx-footer-links">
            {t.footer.links.map((l) => <a key={l} href="#">{l}</a>)}
          </nav>
        </div>
        <div className="fx-footer-legal">{t.footer.legal}</div>
      </div>
    </footer>
  )
}
