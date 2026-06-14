'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import VehicleInspectionMap from '@/components/vehicle-schema/VehicleInspectionMap'
import SignatureCanvas from '@/components/signature/SignatureCanvas'
import { MANDATORY_PHOTOS } from '@/components/vehicle-schema/zones'
import { VEHICLE_ZONES as NEW_ZONES, type DamageEntry } from '@/components/vehicle-schema/inspection-types'
import FuelGauge from '@/components/FuelGauge'
import { createClient } from '@/lib/supabase/client'
import { compressImageToBase64 } from '@/lib/utils'
import { calculateLateFee, calculateExtraKm } from '@/lib/calculations/fees'
import { Camera, CheckCircle2, AlertTriangle, X, ChevronRight, Clock, Gauge } from 'lucide-react'

interface Props {
  type: 'depart' | 'arrivee'
  contractId: string
  vehicleId: string
  vehicleKm: number
  reservationId: string
  // Props EDL retour uniquement
  vehicleCategory?: string
  reservationEndDatetime?: string
  kmAtDeparture?: number
  fuelAtDeparture?: number
  kmIncluded?: number
  extraKmPrice?: number
}

type Step = 'info' | 'schema' | 'photos' | 'signatures' | 'done'

interface ComputedFees {
  lateMinutes: number
  lateFeeAmount: number
  extraKmCount: number
  extraKmAmount: number
}

export default function InspectionFlow({
  type,
  contractId,
  vehicleId,
  vehicleKm,
  reservationId,
  vehicleCategory = 'citadine',
  reservationEndDatetime,
  kmAtDeparture,
  fuelAtDeparture,
  kmIncluded = 200,
  extraKmPrice = 2,
}: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState<Step>('info')
  const [kmReading, setKmReading] = useState(vehicleKm)
  const [fuelLevel, setFuelLevel] = useState(4) // 0-8 segments
  const [exteriorCleanliness, setExteriorCleanliness] = useState(3)
  const [interiorCleanliness, setInteriorCleanliness] = useState(3)
  const [damages, setDamages] = useState<Record<string, DamageEntry[]>>({})
  const [photos, setPhotos] = useState<Record<string, string>>({})
  const [clientSig, setClientSig] = useState<string | null>(null)
  // Signature agent supprimée pour l'EDL — remplacée par le cachet entreprise
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [computedFees, setComputedFees] = useState<ComputedFees | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [currentPhotoType, setCurrentPhotoType] = useState<string | null>(null)

  const photoCount = Object.keys(photos).length
  const mandatoryCompleted = photoCount >= 3
  const damageCount = Object.values(damages).flat().length
  const damagedZoneCount = Object.values(damages).filter(e => e.length > 0).length

  function handleDamageAdd(zoneId: string, entry: DamageEntry) {
    setDamages(prev => ({
      ...prev,
      [zoneId]: [...(prev[zoneId] ?? []), entry],
    }))
  }

  function handleDamageRemove(zoneId: string, index: number) {
    setDamages(prev => ({
      ...prev,
      [zoneId]: (prev[zoneId] ?? []).filter((_, i) => i !== index),
    }))
  }

  function triggerPhoto(photoType: string) {
    setCurrentPhotoType(photoType)
    photoInputRef.current?.click()
  }

  async function handlePhotoCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !currentPhotoType) return
    const compressed = await compressImageToBase64(file)
    setPhotos(prev => ({ ...prev, [currentPhotoType]: compressed }))
    e.target.value = ''
  }

  async function handleSubmit() {
    if (!clientSig) { setError('La signature du client est requise'); return }
    setSaving(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non authentifié')

      const { data: inspection, error: inspErr } = await supabase
        .from('inspections')
        .insert({
          contract_id: contractId,
          vehicle_id: vehicleId,
          type,
          km_reading: kmReading,
          fuel_level: fuelLevel,
          exterior_cleanliness: exteriorCleanliness,
          interior_cleanliness: interiorCleanliness,
          damaged_zones: Object.entries(damages)
            .filter(([, entries]) => entries.length > 0)
            .flatMap(([zoneId, entries]) => entries.map(entry => ({
              id: zoneId,
              label: NEW_ZONES.find(z => z.id === zoneId)?.label ?? zoneId,
              severity: entry.severity,
              description: entry.comment,
              photos: entry.photos,
            }))),
          client_signature_svg: clientSig,
          agent_signature_svg: null,
          signed_at: new Date().toISOString(),
          performed_by: user.id,
          device_info: navigator.userAgent,
        })
        .select('id')
        .single()

      if (inspErr || !inspection) throw new Error(inspErr?.message ?? 'Erreur création EDL')

      for (const [photoType, dataUrl] of Object.entries(photos)) {
        const base64 = dataUrl.split(',')[1]
        const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
        const path = `inspections/${inspection.id}/${photoType}.jpg`
        await supabase.storage.from('vehicle-photos').upload(path, bytes, {
          contentType: 'image/jpeg',
          upsert: true,
        })
        await supabase.from('inspection_photos').insert({
          inspection_id: inspection.id,
          photo_type: photoType,
          storage_path: path,
          taken_by: user.id,
        })
      }

      await supabase.from('vehicles').update({ current_km: kmReading }).eq('id', vehicleId)

      if (type === 'depart') {
        await supabase.from('reservations').update({ status: 'en_cours' }).eq('id', reservationId)
      } else {
        // Calcul frais retard
        const now = new Date()
        let lateMinutes = 0
        let lateFeeAmount = 0
        if (reservationEndDatetime) {
          lateMinutes = Math.max(0, Math.round((now.getTime() - new Date(reservationEndDatetime).getTime()) / 60000))
          lateFeeAmount = calculateLateFee(vehicleCategory, lateMinutes)
        }

        // Calcul dépassement km
        const depKm = kmAtDeparture ?? vehicleKm
        const { extraKm: extraKmCount, amount: extraKmAmount } = calculateExtraKm(
          depKm,
          kmReading,
          kmIncluded,
          extraKmPrice,
        )

        await supabase.from('reservations').update({
          status: 'terminee',
          late_minutes: lateMinutes,
          late_fee_amount: lateFeeAmount,
          extra_km_count: extraKmCount,
          extra_km_amount: extraKmAmount,
        }).eq('id', reservationId)

        setComputedFees({ lateMinutes, lateFeeAmount, extraKmCount, extraKmAmount })
      }

      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: `inspection_${type}_created`,
        entity_type: 'inspections',
        entity_id: inspection.id,
        metadata: { km_reading: kmReading, damaged_zones_count: damageCount },
      })

      setStep('done')
    } catch (e: any) {
      setError(e.message ?? 'Erreur lors de l\'enregistrement')
    } finally {
      setSaving(false)
    }
  }

  if (step === 'done') {
    const totalExtra = (computedFees?.lateFeeAmount ?? 0) + (computedFees?.extraKmAmount ?? 0)
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            État des lieux {type === 'depart' ? 'de départ' : 'de retour'} enregistré
          </h2>
          <p className="text-slate-500">KM : {kmReading.toLocaleString('fr-FR')} · {damagedZoneCount} zone(s) signalée(s)</p>
        </div>

        {/* Récap frais EDL retour */}
        {type === 'arrivee' && computedFees && totalExtra > 0 && (
          <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
            <div className="bg-amber-50 px-5 py-3 border-b border-amber-100">
              <p className="font-semibold text-amber-800 text-sm">Frais complémentaires calculés</p>
            </div>
            <div className="divide-y divide-slate-50">
              {computedFees.lateFeeAmount > 0 && (
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                      <Clock className="w-4 h-4 text-red-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Frais de retard</p>
                      <p className="text-xs text-slate-400">
                        {computedFees.lateMinutes} min · tolérance 60 min · {vehicleCategory === 'sportif' ? '150' : '50'} €/h
                      </p>
                    </div>
                  </div>
                  <span className="text-base font-bold text-red-600">+{computedFees.lateFeeAmount.toLocaleString('fr-FR')} €</span>
                </div>
              )}
              {computedFees.extraKmCount > 0 && (
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                      <Gauge className="w-4 h-4 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Dépassement kilométrique</p>
                      <p className="text-xs text-slate-400">{computedFees.extraKmCount} km × {extraKmPrice} €/km</p>
                    </div>
                  </div>
                  <span className="text-base font-bold text-orange-600">+{computedFees.extraKmAmount.toLocaleString('fr-FR')} €</span>
                </div>
              )}
              <div className="flex items-center justify-between px-5 py-4 bg-slate-50">
                <span className="text-sm font-bold text-slate-700">Total frais supplémentaires</span>
                <span className="text-lg font-bold text-slate-900">{totalExtra.toLocaleString('fr-FR')} €</span>
              </div>
            </div>
          </div>
        )}

        {type === 'arrivee' && computedFees && totalExtra === 0 && (
          <div className="bg-green-50 rounded-2xl border border-green-100 px-5 py-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
            <p className="text-sm text-green-700 font-medium">
              Aucun frais supplémentaire — restitution dans les délais et kilométrage respecté.
            </p>
          </div>
        )}

        <button
          onClick={() => router.push(`/reservations/${reservationId}`)}
          className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
        >
          Retour à la réservation
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Barre de progression */}
      <div className="flex items-center gap-2">
        {(['info', 'schema', 'photos', 'signatures'] as Step[]).map((s, i) => {
          const steps: Step[] = ['info', 'schema', 'photos', 'signatures']
          const currentIdx = steps.indexOf(step)
          return (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                step === s ? 'bg-blue-600 text-white' :
                i < currentIdx ? 'bg-green-500 text-white' :
                'bg-slate-100 text-slate-400'
              }`}>
                {i < currentIdx ? '✓' : i + 1}
              </div>
              <span className={`text-xs hidden sm:block ${step === s ? 'font-medium text-slate-900' : 'text-slate-400'}`}>
                {['Infos', 'Zones', 'Photos', 'Signature'][i]}
              </span>
              {i < 3 && <div className="flex-1 h-0.5 bg-slate-100" />}
            </div>
          )
        })}
      </div>

      {/* Étape : Infos */}
      {step === 'info' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-5">
          <h3 className="font-semibold text-slate-800">Informations de base</h3>

          {/* ── Relevé de bord : kilométrage + carburant ── */}
          <div className="bg-slate-900 rounded-2xl p-4 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Relevé de bord</p>

            <div className="grid grid-cols-2 gap-3">
              {/* Kilométrage */}
              <div className="bg-slate-800 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Kilométrage</p>
                </div>
                <input
                  type="number"
                  value={kmReading}
                  onChange={e => setKmReading(Number(e.target.value))}
                  min={vehicleKm}
                  className="w-full bg-slate-700 text-white text-xl font-bold px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 text-center tracking-widest"
                />
                <p className="text-[10px] text-slate-500 text-center">
                  {type === 'arrivee' && kmReading > (kmAtDeparture ?? vehicleKm) ? (
                    <>
                      +{(kmReading - (kmAtDeparture ?? vehicleKm)).toLocaleString('fr-FR')} km
                      {kmReading - (kmAtDeparture ?? vehicleKm) > kmIncluded && (
                        <span className="ml-1 text-orange-400 font-semibold">
                          ({(kmReading - (kmAtDeparture ?? vehicleKm) - kmIncluded).toLocaleString('fr-FR')} dépassement)
                        </span>
                      )}
                    </>
                  ) : (
                    <span>actuel : {vehicleKm.toLocaleString('fr-FR')} km</span>
                  )}
                </p>
              </div>

              {/* Carburant */}
              <div className="bg-slate-800 rounded-xl p-3 space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Carburant</p>
                <p className="text-xl font-bold text-white text-center tracking-wide">{fuelLevel}/8</p>
                <div className="flex justify-center">
                  <FuelGauge level={fuelLevel} onChange={setFuelLevel} />
                </div>
                <p className="text-[10px] text-slate-500 text-center">
                  {type === 'arrivee' && fuelAtDeparture != null ? (
                    fuelLevel < fuelAtDeparture ? (
                      <>
                        Départ : {fuelAtDeparture}/8
                        <span className="ml-1 text-orange-400 font-semibold">
                          (manque {fuelAtDeparture - fuelLevel}/8)
                        </span>
                      </>
                    ) : (
                      <>Départ : {fuelAtDeparture}/8 · <span className="text-green-400">niveau OK</span></>
                    )
                  ) : (
                    <span>plein = 8/8</span>
                  )}
                </p>
              </div>
            </div>

            {/* Rappel km inclus — EDL retour uniquement */}
            {type === 'arrivee' && (
              <div className="bg-slate-800 rounded-xl px-3 py-2 flex items-center gap-2">
                <Gauge className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                <p className="text-[10px] text-slate-300">
                  Départ : <strong className="text-white">{(kmAtDeparture ?? vehicleKm).toLocaleString('fr-FR')} km</strong>
                  {' · '}Inclus : <strong className="text-white">{kmIncluded.toLocaleString('fr-FR')} km</strong>
                  {' · '}Sup : <strong className="text-white">{extraKmPrice} €/km</strong>
                </p>
              </div>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Propreté extérieure : <strong>{exteriorCleanliness}/5</strong>
              </label>
              <input type="range" min={1} max={5} value={exteriorCleanliness}
                onChange={e => setExteriorCleanliness(Number(e.target.value))}
                className="w-full h-3 rounded-full accent-blue-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Propreté intérieure : <strong>{interiorCleanliness}/5</strong>
              </label>
              <input type="range" min={1} max={5} value={interiorCleanliness}
                onChange={e => setInteriorCleanliness(Number(e.target.value))}
                className="w-full h-3 rounded-full accent-blue-600"
              />
            </div>
          </div>

          <button
            onClick={() => setStep('schema')}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            Suivant : État des zones <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Étape : Schéma */}
      {step === 'schema' && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500 text-center">Appuyez sur une zone pour signaler un dommage</p>

          <VehicleInspectionMap
            damages={damages}
            onDamageAdd={handleDamageAdd}
            onDamageRemove={handleDamageRemove}
          />

          {damagedZoneCount > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <h4 className="font-medium text-slate-700 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                {damagedZoneCount} zone(s) · {damageCount} dommage(s)
              </h4>
              <div className="space-y-2">
                {Object.entries(damages)
                  .filter(([, entries]) => entries.length > 0)
                  .map(([zoneId, entries]) => {
                    const zone = NEW_ZONES.find(z => z.id === zoneId)
                    return (
                      <div key={zoneId} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50">
                        <div className="flex-1 min-w-0">
                          <span className={`text-xs px-2 py-0.5 rounded-full mr-2 font-medium ${
                            entries[0].severity === 'dommage'   ? 'bg-red-100 text-red-700' :
                            entries[0].severity === 'rayure'    ? 'bg-yellow-100 text-yellow-700' :
                            'bg-orange-100 text-orange-700'
                          }`}>
                            {entries.length > 1 ? `${entries.length}×` : entries[0].severity}
                          </span>
                          <span className="text-sm font-medium text-slate-800">{zone?.label ?? zoneId}</span>
                          {entries[0].comment && (
                            <p className="text-xs text-slate-400 mt-0.5 truncate">{entries[0].comment}</p>
                          )}
                        </div>
                        <button
                          onClick={() => setDamages(prev => {
                            const next = { ...prev }
                            delete next[zoneId]
                            return next
                          })}
                          className="p-1 hover:bg-red-50 rounded-lg ml-2"
                        >
                          <X className="w-4 h-4 text-slate-400 hover:text-red-500" />
                        </button>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}

          <button
            onClick={() => setStep('photos')}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            Suivant : Photos ({photoCount} prise{photoCount > 1 ? 's' : ''}) <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Étape : Photos */}
      {step === 'photos' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <h3 className="font-semibold text-slate-800 mb-1">
              Photos de l'état des lieux
              <span className="ml-2 text-sm font-normal text-slate-500">({photoCount} prise{photoCount > 1 ? 's' : ''})</span>
            </h3>
            <p className="text-xs text-slate-400 mb-3">Minimum 3 photos requises.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {MANDATORY_PHOTOS.map(p => {
                const taken = photos[p.type]
                return (
                  <button
                    key={p.type}
                    type="button"
                    onClick={() => triggerPhoto(p.type)}
                    className={`relative aspect-[4/3] rounded-xl overflow-hidden border-2 transition-all ${
                      taken ? 'border-green-400' : 'border-dashed border-slate-200 hover:border-blue-400'
                    }`}
                  >
                    {taken ? (
                      <>
                        <img src={taken} alt={p.label} className="w-full h-full object-cover" />
                        <div className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                          <span className="text-white text-xs">✓</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full bg-slate-50 gap-1.5 p-2">
                        <Camera className="w-6 h-6 text-slate-300" />
                        <span className="text-xs text-slate-400 text-center leading-tight">{p.label}</span>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handlePhotoCapture}
          />

          {!mandatoryCompleted && (
            <p className="text-sm text-amber-600 bg-amber-50 rounded-xl px-4 py-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              Minimum 3 photos requises — {photoCount}/3
            </p>
          )}

          <button
            onClick={() => setStep('signatures')}
            disabled={!mandatoryCompleted}
            className="w-full py-3 bg-blue-600 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            Suivant : Signatures <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Étape : Signatures */}
      {step === 'signatures' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-5">
            <h3 className="font-semibold text-slate-800">Signatures</h3>
            <SignatureCanvas
              label="Signature du client *"
              onSign={setClientSig}
              onClear={() => setClientSig(null)}
              height={160}
            />
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Pour l&apos;agence</p>
              <div className="flex items-center justify-center h-[120px] rounded-xl border-2 border-dashed border-slate-200 bg-slate-50">
                <div className="border-2 border-blue-600/40 rounded-lg px-5 py-2.5 text-center">
                  <p className="text-sm font-black uppercase tracking-wide text-blue-600/80">Cachet de l&apos;entreprise</p>
                  <p className="text-[10px] uppercase tracking-widest text-blue-600/50 mt-0.5">Apposé automatiquement</p>
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={saving || !clientSig}
            className="w-full py-3.5 bg-green-600 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl font-bold hover:bg-green-700 transition-colors"
          >
            {saving ? 'Enregistrement...' : '✓ Valider l\'état des lieux'}
          </button>
        </div>
      )}

    </div>
  )
}
