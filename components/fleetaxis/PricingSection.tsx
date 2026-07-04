'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import type { Translation } from '@/lib/fleetaxis-i18n'

export default function PricingSection({ t }: { t: Translation }) {
  const [tab, setTab] = useState<'monthly' | 'onetime'>('monthly')
  const p = t.pricing

  const isCustom = (price: string) => price === p.customQuote

  return (
    <section id="pricing" className="fx-section">
      <div className="fx-container">
        <h2 className="fx-section-title">{p.title}</h2>
        <p className="fx-section-sub">{p.sub}</p>

        <div className="fx-tabs" role="tablist">
          <button
            type="button" role="tab" aria-selected={tab === 'monthly'}
            className={`fx-tab${tab === 'monthly' ? ' fx-tab--active' : ''}`}
            onClick={() => setTab('monthly')}
          >{p.tabMonthly}</button>
          <button
            type="button" role="tab" aria-selected={tab === 'onetime'}
            className={`fx-tab${tab === 'onetime' ? ' fx-tab--active' : ''}`}
            onClick={() => setTab('onetime')}
          >{p.tabOnetime}</button>
        </div>

        {tab === 'monthly' ? (
          <div className="fx-price-grid">
            {p.monthly.map((plan) => {
              const featured = 'featured' in plan && plan.featured
              return (
              <div key={plan.name} className={`fx-price-card${featured ? ' fx-price-card--featured' : ''}`}>
                {featured && <span className="fx-price-badge">{p.popular}</span>}
                <h3 className="fx-price-name">{plan.name}</h3>
                <p className="fx-price-cap">{plan.cap}</p>

                <div className="fx-price-money-block">
                  {isCustom(plan.price) ? (
                    <div className="fx-price-custom">{plan.price}</div>
                  ) : (
                    <>
                      <span className="fx-price-amount">{plan.price}</span>
                      {plan.unit && <span className="fx-price-period"> {plan.unit}</span>}
                    </>
                  )}
                  {plan.per && <div className="fx-price-per">{plan.per}</div>}
                </div>

                <ul className="fx-price-features">
                  {plan.features.map((f) => (
                    <li key={f}><Check size={15} /> {f}</li>
                  ))}
                </ul>

                <button
                  type="button"
                  className={`fx-price-cta${plan.cta === 'start' ? ' fx-price-cta--primary' : ''}`}
                  onClick={() => { document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' }) }}
                >
                  {plan.cta === 'start' ? p.ctaStart : p.ctaContact}
                </button>
              </div>
              )
            })}
          </div>
        ) : (
          <div className="fx-table-wrap">
            <table className="fx-table">
              <thead>
                <tr>{p.oneTimeHead.map((h) => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {p.oneTime.map((row) => (
                  <tr key={row.name}>
                    <td className="fx-td-name">{row.name}</td>
                    <td>{row.fleet}</td>
                    <td className="fx-td-price">{row.price}</td>
                    <td>{row.incl}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'onetime' && <p className="fx-note">{p.oneTimeNote}</p>}

        {/* Bloc frais de déploiement — commun aux deux onglets */}
        <div className="fx-deploy">
          <h3 className="fx-deploy-title">{p.deployTitle}</h3>
          {p.deploy.map((d) => (
            <div key={d.scope} className="fx-deploy-row">
              <span className="fx-deploy-scope">{d.scope}</span>
              <span className="fx-deploy-desc">{d.desc}</span>
              <span className="fx-deploy-price fx-mono">{d.price}</span>
            </div>
          ))}
          <p className="fx-note">{p.deployNote}</p>
        </div>
      </div>
    </section>
  )
}
