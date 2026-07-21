'use client'

import { useReducer, useRef, useState, useEffect } from 'react'
import { ArrowLeft, Camera, X, Plus } from 'lucide-react'
import { compressImageToBase64 } from '@/lib/utils'
import { PhotoLightbox } from '@/components/inspection/PhotoLightbox'
import {
  type DamageEntry,
  type DamageSeverity,
  DAMAGE_TYPES,
  GRAVITES,
  damageTypeLabel,
  graviteLabel,
} from './inspection-types'

// ─── Schéma EDL interactif — blueprint + zoom sur la partie cliquée ───────────
// Zones + fond partagés avec le PDF du contrat (source unique : ./edl-zones)
import { EDL_IMG as IMG, EDL_SRC as SRC, EDL_ZONES as ZONES, zoneBox, type Zone2D } from './edl-zones'

// Système de couleurs par STATUT (départ / retour), pas par gravité :
//   • dommage signalé AU DÉPART  → orange (#F97316) + badge « D »
//   • nouveau dommage AU RETOUR  → rouge  (#EF4444) + badge « R »
//   • les deux                   → rouge + badges D & R
//   • sélection active           → bleu par-dessus (fill), badges conservés
// Priorité visuelle : sélection > retour > départ > survol > mode zones.
type BadgeType = 'departure' | 'return' | 'both' | 'none'

function getZoneStyle(
  isSelected: boolean,
  isHovered: boolean,
  hasDep: boolean,
  hasRet: boolean,
  showZones: boolean,
): { fill: string; stroke: string; strokeWidth: number; dash?: string; badgeType: BadgeType } {
  let fill = 'rgba(0,0,0,0)'
  let stroke = 'transparent'
  let strokeWidth = 0
  let dash: string | undefined

  if (isSelected) {
    fill = 'rgba(59,130,246,0.30)'; stroke = '#3B82F6'; strokeWidth = 4
  } else if (hasRet) {
    fill = 'rgba(239,68,68,0.22)'; stroke = '#EF4444'; strokeWidth = 3
  } else if (hasDep) {
    fill = 'rgba(251,146,60,0.22)'; stroke = '#F97316'; strokeWidth = 3
  } else if (isHovered) {
    fill = 'rgba(59,130,246,0.10)'; stroke = '#93C5FD'; strokeWidth = 3
  } else if (showZones) {
    fill = 'rgba(100,116,139,0.06)'; stroke = '#94A3B8'; strokeWidth = 3; dash = '6,4'
  }

  const badgeType: BadgeType =
    hasDep && hasRet ? 'both' : hasDep ? 'departure' : hasRet ? 'return' : 'none'

  return { fill, stroke, strokeWidth, dash, badgeType }
}

// Zone signalée à l'EDL de départ — sert de référence visuelle au retour
// (pré-dessinée sur le schéma + photo de départ consultable pour comparaison).
export interface PreviousZone {
  id: string
  label: string
  severity: string
  description?: string
  photos?: string[]
}

interface Props {
  damages: Record<string, DamageEntry[]>
  onDamageAdd: (zoneId: string, entry: DamageEntry) => void
  onDamageRemove: (zoneId: string, index: number) => void
  readonly?: boolean
  previousZones?: PreviousZone[]
  // Phase de l'EDL. Au DÉPART, une zone saisie est un « dommage au départ »
  // (orange « D ») et non un « nouveau dommage au retour » (rouge « R »). Défaut
  // 'return' → comportement historique inchangé pour l'EDL retour.
  phase?: 'departure' | 'return'
}

export default function VehicleMap2D({ damages, onDamageAdd, onDamageRemove, readonly, previousZones = [], phase = 'return' }: Props) {
  const prevById = new Map(previousZones.map(z => [z.id, z]))
  const [selected, setSelected] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [showZones, setShowZones] = useState(false)
  // Formulaire de saisie
  const [dtype, setDtype] = useState<string>(DAMAGE_TYPES[0].id)
  const [gravite, setGravite] = useState<DamageSeverity>('rayure')
  const [comment, setComment] = useState('')
  const [pending, setPending] = useState<string[]>([])
  // Photo de départ ouverte en plein écran (null = lightbox fermée)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // viewBox animé
  const vb = useRef({ x: 0, y: 0, w: IMG, h: IMG })
  const raf = useRef<number | undefined>(undefined)
  const [, force] = useReducer((c: number) => c + 1, 0)

  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current) }, [])

  function animateTo(tx: number, ty: number, tw: number, th: number) {
    if (raf.current) cancelAnimationFrame(raf.current)
    const s = { ...vb.current }
    const t0 = performance.now()
    const dur = 380
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / dur)
      const e = 1 - Math.pow(1 - k, 3) // easeOutCubic
      vb.current = {
        x: s.x + (tx - s.x) * e,
        y: s.y + (ty - s.y) * e,
        w: s.w + (tw - s.w) * e,
        h: s.h + (th - s.h) * e,
      }
      force()
      if (k < 1) raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
  }

  function focusZone(z: Zone2D) {
    const pad = 1.9, MIN = 340
    const box = zoneBox(z)
    let side = Math.max(box.w, box.h) * pad
    side = Math.max(MIN, Math.min(side, IMG))
    const cx = box.x + box.w / 2, cy = box.y + box.h / 2
    const x = Math.max(0, Math.min(cx - side / 2, IMG - side))
    const y = Math.max(0, Math.min(cy - side / 2, IMG - side))
    animateTo(x, y, side, side)
  }

  function resetForm() {
    setDtype(DAMAGE_TYPES[0].id)
    setGravite('rayure')
    setComment('')
    setPending([])
  }

  function selectZone(z: Zone2D, zi: number) {
    resetForm()
    // Clé d'instance `${id}#${index}` : plusieurs vues peuvent partager le même
    // id de pièce (ex. aile arrière = vue arrière + vue profil). On ne surligne
    // que le polygone réellement cliqué, pas tous ceux qui portent cet id.
    setSelected(`${z.id}#${zi}`)
    focusZone(z)
  }

  function overview() {
    setSelected(null)
    animateTo(0, 0, IMG, IMG)
  }

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    const b64 = await compressImageToBase64(f)
    setPending(p => [...p, b64])
    e.target.value = ''
  }

  function addDamage() {
    if (!selId) return
    onDamageAdd(selId, { severity: gravite, type: dtype, comment: comment.trim(), photos: pending })
    resetForm()
  }

  // `selected` = clé d'instance `${id}#${index}` → on retrouve le polygone exact.
  const selIdx = selected ? Number(selected.slice(selected.indexOf('#') + 1)) : -1
  const zone = selIdx >= 0 ? (ZONES[selIdx] ?? null) : null
  const selId = zone?.id ?? null
  const existing = selId ? (damages[selId] ?? []) : []
  const prevSel = selId ? prevById.get(selId) : undefined

  // Légende : n'apparaît que s'il existe au moins un dommage. Au DÉPART, les zones
  // saisies comptent comme « dommage au départ » (orange) ; au RETOUR, `damages`
  // = nouveaux dommages (rouge) et `previousZones` = référence du départ (orange).
  const filledAny = Object.values(damages).some(a => a.length > 0)
  const anyDep = phase === 'departure' ? filledAny : previousZones.length > 0
  const anyRet = phase === 'departure' ? false : filledAny

  return (
    <div className="w-full max-w-[520px] mx-auto bg-white rounded-xl overflow-hidden">
      {/* Schéma */}
      <div className="relative">
        {/* Barre haute */}
        <div className="absolute top-2 left-2 right-2 z-10 flex items-center justify-between pointer-events-none">
          {selected ? (
            <button
              type="button"
              onClick={overview}
              className="pointer-events-auto flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide px-2.5 py-1.5 rounded-lg bg-gray-900 text-white shadow"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Vue d'ensemble
            </button>
          ) : <span />}
          {!readonly && !selected && (
            <button
              type="button"
              onClick={() => setShowZones(s => !s)}
              className={`pointer-events-auto text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-lg border transition-colors ${
                showZones ? 'bg-gray-900 text-white border-gray-900' : 'bg-white/80 text-gray-500 border-gray-200'
              }`}
            >
              Zones
            </button>
          )}
        </div>

        <svg
          viewBox={`${vb.current.x} ${vb.current.y} ${vb.current.w} ${vb.current.h}`}
          className="w-full"
          style={{ display: 'block', maxHeight: '64vh' }}
        >
          <image href={SRC} x={0} y={0} width={IMG} height={IMG} />

          {ZONES.map((z, zi) => {
            const filled = (damages[z.id]?.length ?? 0) > 0
            // Au DÉPART, une zone saisie est un dommage « départ » (orange « D ») ;
            // au RETOUR, c'est un nouveau dommage (rouge « R ») et `prevById` porte
            // la référence du départ.
            const hasRet = phase === 'departure' ? false : filled
            const hasDep = phase === 'departure' ? filled : prevById.has(z.id)
            const isSel = selected === `${z.id}#${zi}`
            const isHov = hovered === z.id
            const box = zoneBox(z)
            const cx = box.x + box.w / 2, cy = box.y + box.h / 2

            const style = getZoneStyle(isSel, isHov, hasDep, hasRet, showZones)
            // Position des badges : coin haut-droit de la boîte englobante.
            const bx = box.x + box.w - 6, by = box.y + 6
            const dCx = style.badgeType === 'both' ? bx - 30 : bx

            return (
              <g
                key={`${z.id}-${zi}`}
                onClick={() => selectZone(z, zi)}
                onMouseEnter={() => setHovered(z.id)}
                onMouseLeave={() => setHovered(h => (h === z.id ? null : h))}
                style={{ cursor: readonly && !filled ? 'default' : 'pointer' }}
              >
                {z.points ? (
                  <polygon points={z.points.map(p => p.join(',')).join(' ')} fill={style.fill} stroke={style.stroke} strokeWidth={style.strokeWidth} strokeDasharray={style.dash} strokeLinejoin="round" style={{ transition: 'fill 0.15s ease, stroke 0.15s ease' }} />
                ) : z.shape === 'ellipse' ? (
                  <ellipse cx={cx} cy={cy} rx={box.w / 2} ry={box.h / 2} fill={style.fill} stroke={style.stroke} strokeWidth={style.strokeWidth} strokeDasharray={style.dash} style={{ transition: 'fill 0.15s ease, stroke 0.15s ease' }} />
                ) : (
                  <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={z.rx ?? 8} fill={style.fill} stroke={style.stroke} strokeWidth={style.strokeWidth} strokeDasharray={style.dash} style={{ transition: 'fill 0.15s ease, stroke 0.15s ease' }} />
                )}
                {showZones && !hasRet && !hasDep && (
                  <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize={15} fontWeight={700} fill="#475569" style={{ pointerEvents: 'none', userSelect: 'none' }}>
                    {z.label}
                  </text>
                )}
                {/* Badge DÉPART — cercle orange « D » */}
                {(style.badgeType === 'departure' || style.badgeType === 'both') && (
                  <g style={{ pointerEvents: 'none' }}>
                    <circle cx={dCx} cy={by} r={13} fill="#F97316" stroke="white" strokeWidth={2} />
                    <text x={dCx} y={by} textAnchor="middle" dominantBaseline="middle" fontSize={15} fontWeight={800} fill="white" style={{ userSelect: 'none' }}>
                      D
                    </text>
                  </g>
                )}
                {/* Badge RETOUR — cercle rouge « R » */}
                {(style.badgeType === 'return' || style.badgeType === 'both') && (
                  <g style={{ pointerEvents: 'none' }}>
                    <circle cx={bx} cy={by} r={13} fill="#EF4444" stroke="white" strokeWidth={2} />
                    <text x={bx} y={by} textAnchor="middle" dominantBaseline="middle" fontSize={15} fontWeight={800} fill="white" style={{ userSelect: 'none' }}>
                      R
                    </text>
                  </g>
                )}
              </g>
            )
          })}
        </svg>

        {/* Légende couleurs — visible dès qu'un dommage départ ou retour existe */}
        {(anyDep || anyRet) && (
          <div style={{
            display: 'flex',
            gap: '16px',
            justifyContent: 'center',
            flexWrap: 'wrap',
            margin: '12px 12px 0',
            padding: '8px 16px',
            backgroundColor: '#F8FAFC',
            borderRadius: '10px',
            border: '1px solid #E2E8F0',
          }}>
            {anyDep && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#F97316', flexShrink: 0 }} />
                <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 500 }}>Dommage au départ</span>
              </div>
            )}
            {anyRet && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#EF4444', flexShrink: 0 }} />
                <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 500 }}>Nouveau dommage au retour</span>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#3B82F6', flexShrink: 0 }} />
              <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 500 }}>Zone sélectionnée</span>
            </div>
          </div>
        )}

        {!selected && !readonly && (
          <p className="text-center text-[11px] text-gray-400 pb-2">
            Touchez une partie du véhicule pour zoomer et constater un dommage
          </p>
        )}
      </div>

      {/* Panneau de saisie (zone sélectionnée) */}
      {zone && !readonly && (
        <div className="border-t border-gray-100 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-gray-900">{zone.label}</h3>
            {existing.length > 0 && (
              <span className="text-[11px] font-bold text-gray-400">{existing.length} dommage{existing.length > 1 ? 's' : ''}</span>
            )}
          </div>

          {/* Référence : ce qui avait été constaté au départ (photo comparative) */}
          {prevSel && (
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-blue-700 mb-1.5">Constaté au départ</p>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold border border-blue-200 text-blue-700 bg-white">
                  {graviteLabel(prevSel.severity as DamageSeverity)}
                </span>
                {prevSel.description && <span className="text-[11px] text-blue-800/80">{prevSel.description}</span>}
              </div>
              {prevSel.photos && prevSel.photos.length > 0 && (
                <div className="flex gap-2 mt-2 flex-wrap">
                  {prevSel.photos.map((p, pi) => (
                    <div key={pi} style={{ position: 'relative', cursor: 'zoom-in' }} onClick={() => setLightboxSrc(p)}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p}
                        alt="Dommage constaté au départ"
                        style={{
                          width: '96px',
                          height: '96px',
                          objectFit: 'cover',
                          borderRadius: '8px',
                          border: '2px solid #FED7AA',
                        }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          bottom: '4px',
                          right: '4px',
                          background: 'rgba(0,0,0,0.6)',
                          borderRadius: '4px',
                          padding: '2px 4px',
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                          <circle cx="11" cy="11" r="8" />
                          <path d="m21 21-4.35-4.35" />
                          <path d="M11 8v6M8 11h6" />
                        </svg>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[10px] text-blue-600/70 mt-1.5">Comparez avec l&apos;état actuel avant de constater un nouveau dommage.</p>
            </div>
          )}

          {/* Dommages existants */}
          {existing.length > 0 && (
            <div className="space-y-2">
              {existing.map((e, i) => {
                const g = GRAVITES.find(g => g.id === e.severity)
                return (
                  <div key={i} className="flex items-start gap-2 p-2.5 rounded-xl bg-gray-50">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {e.type && <span className="text-[11px] font-semibold text-gray-800">{damageTypeLabel(e.type)}</span>}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold border ${g?.chip ?? ''}`}>{graviteLabel(e.severity)}</span>
                      </div>
                      {e.comment && <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{e.comment}</p>}
                      {e.photos.length > 0 && (
                        <div className="flex gap-1.5 mt-1.5">
                          {e.photos.map((p, pi) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={pi} src={p} alt="" className="w-10 h-10 rounded-lg object-cover border border-gray-200" />
                          ))}
                        </div>
                      )}
                    </div>
                    <button onClick={() => onDamageRemove(selId!, i)} className="p-1.5 hover:bg-red-50 rounded-lg flex-shrink-0">
                      <X className="w-4 h-4 text-gray-400 hover:text-red-500" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Formulaire nouveau dommage */}
          <div className="space-y-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Type de dommage</p>
              <div className="flex flex-wrap gap-1.5">
                {DAMAGE_TYPES.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setDtype(t.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      dtype === t.id ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Gravité</p>
              <div className="grid grid-cols-3 gap-2">
                {GRAVITES.map(g => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setGravite(g.id)}
                    className={`py-2 rounded-xl text-sm font-semibold border transition-colors ${
                      gravite === g.id ? g.active : 'bg-white text-gray-600 border-gray-200'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Photos</p>
              <div className="flex items-center gap-2 flex-wrap">
                {pending.map((p, i) => (
                  <div key={i} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p} alt="" className="w-14 h-14 rounded-xl object-cover border border-gray-200" />
                    <button
                      type="button"
                      onClick={() => setPending(arr => arr.filter((_, j) => j !== i))}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray-900 text-white flex items-center justify-center"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-14 h-14 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-400 hover:border-gray-400"
                >
                  <Camera className="w-5 h-5" />
                </button>
              </div>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPhoto} />
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Commentaire</p>
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                rows={2}
                placeholder="Détails du dommage…"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm resize-none"
              />
            </div>

            <button
              onClick={addDamage}
              className="w-full py-3 bg-[#111111] text-white rounded-2xl text-sm font-bold flex items-center justify-center gap-2 active:scale-[.99]"
            >
              <Plus className="w-4 h-4" /> Ajouter le dommage
            </button>
          </div>
        </div>
      )}

      {/* Lightbox plein écran — photo de départ agrandie */}
      <PhotoLightbox
        src={lightboxSrc ?? ''}
        open={!!lightboxSrc}
        onClose={() => setLightboxSrc(null)}
      />
    </div>
  )
}
