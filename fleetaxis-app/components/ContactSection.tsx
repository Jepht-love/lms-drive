'use client'

import { useState } from 'react'
import type { Translation } from '@/lib/i18n'

const CONTACT_EMAIL = 'projobs01@gmail.com'

export default function ContactSection({ t }: { t: Translation }) {
  const c = t.contact
  const [form, setForm] = useState({ firstName: '', email: '', fleet: '', org: '', message: '' })

  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const subject = `FleetAxis — Demande de démonstration (${form.org || form.firstName || 'Organisation'})`
    const body = [
      `${c.firstName}: ${form.firstName}`,
      `${c.email}: ${form.email}`,
      `${c.fleetSize}: ${form.fleet}`,
      `${c.org}: ${form.org}`,
      '',
      form.message,
    ].join('\n')
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  return (
    <section id="contact" className="fx-section fx-section--secondary">
      <div className="fx-container">
        <div className="fx-contact-grid">
          <div>
            <h2 className="fx-section-title">{c.title}</h2>
            <p className="fx-section-sub" style={{ marginBottom: 0 }}>{c.sub}</p>
          </div>

          <form className="fx-form" onSubmit={handleSubmit}>
            <div className="fx-field-row">
              <div className="fx-field">
                <label className="fx-label" htmlFor="fx-firstname">{c.firstName}</label>
                <input id="fx-firstname" className="fx-input" type="text" value={form.firstName} onChange={update('firstName')} required />
              </div>
              <div className="fx-field">
                <label className="fx-label" htmlFor="fx-email">{c.email}</label>
                <input id="fx-email" className="fx-input" type="email" value={form.email} onChange={update('email')} required />
              </div>
            </div>

            <div className="fx-field-row">
              <div className="fx-field">
                <label className="fx-label" htmlFor="fx-fleet">{c.fleetSize}</label>
                <select id="fx-fleet" className="fx-select" value={form.fleet} onChange={update('fleet')} required>
                  <option value="" disabled>—</option>
                  {c.fleetOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="fx-field">
                <label className="fx-label" htmlFor="fx-org">{c.org}</label>
                <input id="fx-org" className="fx-input" type="text" value={form.org} onChange={update('org')} required />
              </div>
            </div>

            <div className="fx-field">
              <label className="fx-label" htmlFor="fx-message">{c.message}</label>
              <textarea id="fx-message" className="fx-textarea" value={form.message} onChange={update('message')} />
            </div>

            <button type="submit" className="fx-form-submit">{c.submit}</button>
            <p className="fx-rgpd">{c.rgpd}</p>
          </form>
        </div>
      </div>
    </section>
  )
}
