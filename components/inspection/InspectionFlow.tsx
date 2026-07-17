'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import VehicleInspectionMap from '@/components/vehicle-schema/VehicleInspectionMap'
import SignatureCanvas from '@/components/signature/SignatureCanvas'
import { MANDATORY_PHOTOS } from '@/components/vehicle-schema/zones'
import { VEHICLE_ZONES as NEW_ZONES, INTERIOR_DAMAGE_ITEMS, graviteLabel, defaultDamagePrice, type DamageEntry } from '@/components/vehicle-schema/inspection-types'
import { useSavSection } from '@/lib/sav/context'
import { createClient } from '@/lib/supabase/client'
import { compressImageToBase64 } from '@/lib/utils'
import { calculateLateFee, calculateExtraKm } from '@/lib/calculations/fees'
import { reportVehicleIssues } from '@/lib/actions/vehicle-issues'
import { buildDamageFlag } from '@/lib/maintenance-health'
import { Camera, CheckCircle2, AlertTriangle, X, ChevronRight, ChevronLeft, Clock, Gauge, Fuel } from 'lucide-react'

interface Props {
  type: 'depart' | 'arrivee'
  contractId: string
  vehicleId: string
  vehicleKm: number
  // Optionnel : absent pour une convention inter-agences (EDL sans réservation
  // ni client). Dans ce cas on ne touche pas à `reservations` et on masque le
  // bloc d'envoi du contrat de restitution au locataire.
  reservationId?: string
  // Où renvoyer le bouton "Retour" sur l'écran final (défaut : la réservation).
  doneHref?: string
  // Props EDL retour uniquement
  vehicleCategory?: string
  reservationEndDatetime?: string
  kmAtDeparture?: number
  fuelRangeAtDeparture?: number
  kmIncluded?: number
  extraKmPrice?: number
  previousDamagedZones?: { id: string; label: string; severity: string; description?: string; photos?: string[] }[]
}

type Step = 'info' | 'schema' | 'photos' | 'signatures' | 'done'

interface ComputedFees {
  lateMinutes: number
  lateFeeAmount: number
  extraKmCount: number
  extraKmAmount: number
  damageFeeAmount: number
}

const CLEANLINESS_LEVELS = [
  { value: 1, label: 'Sale', bg: 'bg-red-500' },
  { value: 2, label: 'Moyen', bg: 'bg-orange-500' },
  { value: 3, label: 'Normal', bg: 'bg-blue-500' },
  { value: 4, label: 'Propre', bg: 'bg-green-500' },
  { value: 5, label: 'Très propre', bg: 'bg-green-800' },
] as const

function CleanlinessPicker({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label} : <strong>{CLEANLINESS_LEVELS.find(l => l.value === value)?.label}</strong>
      </label>
      <div className="flex gap-1.5">
        {CLEANLINESS_LEVELS.map(l => (
          <button
            key={l.value}
            type="button"
            onClick={() => onChange(l.value)}
            aria-label={l.label}
            className={`flex-1 h-10 rounded-lg transition-all ${l.bg} ${
              value === l.value ? 'ring-2 ring-offset-2 ring-gray-900 scale-105' : 'opacity-35'
            }`}
          />
        ))}
      </div>
    </div>
  )
}

export default function InspectionFlow({
  type,
  contractId,
  vehicleId,
  vehicleKm,
  reservationId,
  doneHref,
  vehicleCategory = 'citadine',
  reservationEndDatetime,
  kmAtDeparture,
  fuelRangeAtDeparture,
  kmIncluded = 200,
  extraKmPrice = 2,
  previousDamagedZones = [],
}: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState<Step>('info')

  // Contexte SAV : précise l'EDL (départ/retour) et l'étape en cours dans le ticket.
  const STEP_LABELS: Record<Step, string> = {
    info: 'infos', schema: 'schéma dégâts', photos: 'photos', signatures: 'signature', done: 'terminé',
  }
  useSavSection(`État des lieux ${type === 'depart' ? 'départ' : 'retour'} · ${STEP_LABELS[step]}`)

  const [kmReading, setKmReading] = useState(vehicleKm)
  const [fuelRangeKm, setFuelRangeKm] = useState(0)
  const [exteriorCleanliness, setExteriorCleanliness] = useState(3)
  const [interiorCleanliness, setInteriorCleanliness] = useState(3)
  const [damages, setDamages] = useState<Record<string, DamageEntry[]>>({})
  const [damagePrices, setDamagePrices] = useState<Record<string, number>>({})
  // Dégâts intérieurs facturés à l'EDL retour (poste → montant libre en €)
  const [interiorCharges, setInteriorCharges] = useState<Record<string, number>>({})
  // Photos des dégâts intérieurs : id du poste → liste de data URLs base64
  const [interiorPhotos, setInteriorPhotos] = useState<Record<string, string[]>>({})
  const [photos, setPhotos] = useState<Record<string, string>>({})
  const [clientSig, setClientSig] = useState<string | null>(null)
  // Signature agent supprimée pour l'EDL — remplacée par le cachet entreprise
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [computedFees, setComputedFees] = useState<ComputedFees | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [currentPhotoType, setCurrentPhotoType] = useState<string | null>(null)
  const [emailState, setEmailState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [emailMsg, setEmailMsg] = useState<string | null>(null)

  // EDL retour terminé : régénère le contrat complet (départ + retour) et l'envoie au client
  async function finalizeAndEmail() {
    setEmailState('sending'); setEmailMsg(null)
    try {
      // Persiste le PDF final (contrat + 2 EDL) dans la bibliothèque documentaire
      await fetch('/api/contracts/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractId }),
      })
      const res = await fetch('/api/contracts/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data?.error) throw new Error(data?.error ?? "Échec de l'envoi")
      setEmailState('sent')
    } catch (e: any) {
      setEmailState('error'); setEmailMsg(e?.message ?? 'Erreur lors de l\'envoi')
    }
  }

  // Les emplacements de MANDATORY_PHOTOS servent de repères (où photographier).
  // On n'impose qu'un minimum de 3 photos, pas la totalité.
  const photoCount = Object.keys(photos).length
  const mandatoryCompleted = photoCount >= 3
  const damageCount = Object.values(damages).flat().length
  const damagedZoneCount = Object.values(damages).filter(e => e.length > 0).length

  // Comparaison auto départ/retour : une zone déjà signalée au départ et
  // retrouvée au retour n'est pas une nouvelle dégradation — distinction
  // utile pour ne pas facturer un dommage préexistant ni rater un nouveau.
  const previousZoneIds = new Set(previousDamagedZones.map(z => z.id))
  const currentDamagedZoneIds = Object.entries(damages).filter(([, e]) => e.length > 0).map(([id]) => id)
  const newDamageZoneIds = currentDamagedZoneIds.filter(id => !previousZoneIds.has(id))
  const stillPresentZoneIds = currentDamagedZoneIds.filter(id => previousZoneIds.has(id))

  // Montant à facturer : uniquement les nouveaux dommages (pas ceux déjà
  // présents au départ) — prix par défaut de la grille, ajustable par zone.
  function priceForZone(zoneId: string): number {
    const stored = damagePrices[zoneId]
    if (stored != null) return stored
    return defaultDamagePrice(damages[zoneId]?.[0]?.type)
  }
  const exteriorDamageFee = type === 'arrivee'
    ? newDamageZoneIds.reduce((sum, id) => sum + priceForZone(id), 0)
    : 0
  // Dégâts intérieurs : somme des montants (positifs) saisis librement.
  const interiorDamageFee = type === 'arrivee'
    ? Object.values(interiorCharges).reduce((s, v) => s + (Number.isFinite(v) && v > 0 ? v : 0), 0)
    : 0
  const totalDamageFee = exteriorDamageFee + interiorDamageFee

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
    if (currentPhotoType.startsWith('interior:')) {
      // Photo d'un dégât intérieur — stockée inline base64 (même modèle que les
      // photos de dommages extérieurs sur le plan 3D).
      const itemId = currentPhotoType.slice('interior:'.length)
      setInteriorPhotos(prev => ({ ...prev, [itemId]: [...(prev[itemId] ?? []), compressed] }))
    } else {
      setPhotos(prev => ({ ...prev, [currentPhotoType]: compressed }))
    }
    e.target.value = ''
  }

  async function handleSubmit() {
    if (!clientSig) { setError('La signature du client est requise'); return }
    setSaving(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non authentifié')

      // Zones carrosserie (schéma) + dégâts intérieurs facturés à la restitution.
      const damagedZonesPayload = [
        ...Object.entries(damages)
          .filter(([, entries]) => entries.length > 0)
          .flatMap(([zoneId, entries]) => entries.map(entry => ({
            id: zoneId,
            label: NEW_ZONES.find(z => z.id === zoneId)?.label ?? zoneId,
            severity: entry.severity,
            type: entry.type ?? null,
            description: entry.comment,
            photos: entry.photos,
            // Prix retenu uniquement pour les nouveaux dommages à l'EDL retour
            // (pas ceux déjà présents au départ, jamais facturables au client).
            price: type === 'arrivee' && !previousZoneIds.has(zoneId) ? priceForZone(zoneId) : 0,
          }))),
        // Dégâts intérieurs (EDL retour) : postes prédéfinis + montant libre.
        ...(type === 'arrivee'
          ? INTERIOR_DAMAGE_ITEMS
              .filter(it => (interiorCharges[it.id] ?? 0) > 0)
              .map(it => ({
                id: it.id,
                label: it.label,
                severity: 'dommage' as DamageEntry['severity'],
                type: 'interieur',
                kind: 'interieur',
                description: 'Dégât intérieur',
                photos: interiorPhotos[it.id] ?? [],
                price: interiorCharges[it.id],
              }))
          : []),
      ]

      const { data: inspection, error: inspErr } = await supabase
        .from('inspections')
        .insert({
          contract_id: contractId,
          vehicle_id: vehicleId,
          type,
          km_reading: kmReading,
          fuel_range_km: fuelRangeKm,
          exterior_cleanliness: exteriorCleanliness,
          interior_cleanliness: interiorCleanliness,
          damaged_zones: damagedZonesPayload,
          client_signature_svg: clientSig,
          agent_signature_svg: null,
          signed_at: new Date().toISOString(),
          performed_by: user.id,
          device_info: navigator.userAgent,
        })
        .select('id')
        .single()

      if (inspErr || !inspection) throw new Error(inspErr?.message ?? 'Erreur création état des lieux')

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

      // Km monotone : n'avance jamais le compteur à la baisse (saisie erronée)
      await supabase.from('vehicles')
        .update({ current_km: kmReading })
        .eq('id', vehicleId)
        .lt('current_km', kmReading)

      // Niveau carburant actuel — reporté sur la fiche véhicule à chaque EDL
      // (départ ou retour), même unité que fuel_range_km sur l'inspection.
      await supabase.from('vehicles')
        .update({ current_fuel_range_km: fuelRangeKm })
        .eq('id', vehicleId)

      if (type === 'depart') {
        if (reservationId) await supabase.from('reservations').update({ status: 'en_cours' }).eq('id', reservationId)
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

        if (reservationId) await supabase.from('reservations').update({
          status: 'terminee',
          late_minutes: lateMinutes,
          late_fee_amount: lateFeeAmount,
          extra_km_count: extraKmCount,
          extra_km_amount: extraKmAmount,
          damage_fee_amount: totalDamageFee,
        }).eq('id', reservationId)

        // Alerte clôture contrat : notification + événement calendrier (fire & forget)
        if (reservationId) {
          const { data: ctInfo } = await supabase
            .from('contracts')
            .select('contract_number, reservation:reservations(client:clients(first_name, last_name), vehicle:vehicles(plate, brand, model))')
            .eq('id', contractId)
            .single()
          const clt = (ctInfo?.reservation as any)?.client
          const veh = (ctInfo?.reservation as any)?.vehicle
          const clientLabel = clt ? `${clt.first_name} ${clt.last_name}` : ''
          const vehLabel   = veh ? `${veh.brand} ${veh.model} (${veh.plate})` : ''
          const notifBody  = [clientLabel, vehLabel].filter(Boolean).join(' — ')

          await Promise.all([
            supabase.from('notifications').insert({
              user_id: null,
              type: 'contract_to_close',
              title: 'Clôture de contrat à valider',
              body: notifBody,
              entity_type: 'reservations',
              entity_id: reservationId,
            }),
            supabase.from('calendar_events').insert({
              title: `Clôturer contrat${clientLabel ? ' — ' + clientLabel : ''}`,
              description: vehLabel || null,
              event_type: 'tache',
              status: 'a_faire',
              start_at: now.toISOString(),
              end_at: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
              reservation_id: reservationId,
              vehicle_id: vehicleId,
            }),
          ])

          fetch('/api/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: 'Clôture de contrat à valider', body: notifBody }),
          }).catch(() => {})
        }

        // Dégradations relevées au retour → drapeaux « Dégradé » sur le véhicule
        // (badge visible, sans retirer le véhicule de la disponibilité)
        const issues = Object.entries(damages)
          .filter(([, entries]) => entries.length > 0)
          .flatMap(([zoneId, entries]) => entries.map(e =>
            buildDamageFlag(zoneId, NEW_ZONES.find(z => z.id === zoneId)?.label ?? zoneId, e.severity, inspection.id),
          ))
        if (issues.length > 0) {
          await reportVehicleIssues(vehicleId, issues, inspection.id)
        }

        setComputedFees({ lateMinutes, lateFeeAmount, extraKmCount, extraKmAmount, damageFeeAmount: totalDamageFee })
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
    const totalExtra = (computedFees?.lateFeeAmount ?? 0) + (computedFees?.extraKmAmount ?? 0) + (computedFees?.damageFeeAmount ?? 0)
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            État des lieux {type === 'depart' ? 'de départ' : 'de retour'} enregistré
          </h2>
          <p className="text-gray-500">KM : {kmReading.toLocaleString('fr-FR')} · {damagedZoneCount} zone(s) signalée(s)</p>
          {type === 'arrivee' && previousDamagedZones.length > 0 && (
            <p className="text-sm text-gray-400 mt-1">
              dont {stillPresentZoneIds.length} déjà signalée(s) au départ
              {newDamageZoneIds.length > 0 && <span className="text-red-500 font-semibold"> · {newDamageZoneIds.length} nouvelle(s)</span>}
            </p>
          )}
        </div>

        {/* Récap frais EDL retour */}
        {type === 'arrivee' && computedFees && totalExtra > 0 && (
          <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
            <div className="bg-amber-50 px-5 py-3 border-b border-amber-100">
              <p className="font-semibold text-amber-800 text-sm">Frais complémentaires calculés</p>
            </div>
            <div className="divide-y divide-gray-50">
              {computedFees.lateFeeAmount > 0 && (
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                      <Clock className="w-4 h-4 text-red-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Frais de retard</p>
                      <p className="text-xs text-gray-400">
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
                      <p className="text-sm font-semibold text-gray-900">Dépassement kilométrique</p>
                      <p className="text-xs text-gray-400">{computedFees.extraKmCount} km × {extraKmPrice} €/km</p>
                    </div>
                  </div>
                  <span className="text-base font-bold text-orange-600">+{computedFees.extraKmAmount.toLocaleString('fr-FR')} €</span>
                </div>
              )}
              {computedFees.damageFeeAmount > 0 && (
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Dommages constatés</p>
                      <p className="text-xs text-gray-400">{newDamageZoneIds.length} nouvelle(s) zone(s) endommagée(s)</p>
                    </div>
                  </div>
                  <span className="text-base font-bold text-red-600">+{computedFees.damageFeeAmount.toLocaleString('fr-FR')} €</span>
                </div>
              )}
              <div className="flex items-center justify-between px-5 py-4 bg-gray-50">
                <span className="text-sm font-bold text-gray-700">Total frais supplémentaires</span>
                <span className="text-lg font-bold text-gray-900">{totalExtra.toLocaleString('fr-FR')} €</span>
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

        {/* Contrat de restitution : contrat + EDL départ + EDL retour → envoi au locataire.
            Masqué en mode convention inter-agences (pas de locataire/réservation). */}
        {type === 'arrivee' && reservationId && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
            <div>
              <h3 className="font-semibold text-gray-900">Contrat de restitution</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Le contrat complet (conditions + état des lieux de départ et de retour, signés) est prêt.
                Faites-le relire et signer au locataire, puis envoyez-lui une copie par email.
              </p>
            </div>
            {emailState === 'sent' ? (
              <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-xl px-3 py-3">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                Contrat de restitution envoyé au locataire par email.
              </div>
            ) : (
              <button
                onClick={finalizeAndEmail}
                disabled={emailState === 'sending'}
                className="w-full py-3 bg-[#111111] text-white rounded-xl font-medium hover:bg-gray-800 transition-colors disabled:opacity-60"
              >
                {emailState === 'sending' ? 'Envoi du contrat…' : 'Envoyer le contrat de restitution au client'}
              </button>
            )}
            {emailState === 'error' && (
              <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{emailMsg}</p>
            )}
          </div>
        )}

        <button
          onClick={() => router.replace(doneHref ?? (reservationId ? `/reservations/${reservationId}` : '/partnerships'))}
          className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
        >
          {reservationId ? 'Retour à la réservation' : 'Retour à l\'opération'}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Input photo PARTAGÉ — monté en permanence (pas seulement à l'étape
          « Photos »). Sinon, à l'étape « Zones / schéma », le bouton caméra des
          dégâts intérieurs déclenche photoInputRef.current?.click() alors que
          l'input n'est pas dans le DOM → rien ne se passe (bug EDL retour). */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handlePhotoCapture}
      />

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
                'bg-gray-100 text-gray-400'
              }`}>
                {i < currentIdx ? '✓' : i + 1}
              </div>
              <span className={`text-xs hidden sm:block ${step === s ? 'font-medium text-gray-900' : 'text-gray-400'}`}>
                {['Infos', 'Zones', 'Photos', 'Signature'][i]}
              </span>
              {i < 3 && <div className="flex-1 h-0.5 bg-gray-100" />}
            </div>
          )
        })}
      </div>

      {/* Étape : Infos */}
      {step === 'info' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
          <h3 className="font-semibold text-gray-800">Informations de base</h3>

          {/* ── Relevé de bord : kilométrage + carburant ── */}
          <div className="bg-[#111111] rounded-2xl p-4 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Relevé de bord</p>

            <div className="grid grid-cols-2 gap-3">
              {/* Kilométrage */}
              <div className="bg-[#111111] rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Kilométrage</p>
                </div>
                <input
                  type="number"
                  inputMode="numeric"
                  value={kmReading}
                  onChange={e => setKmReading(Number(e.target.value))}
                  min={vehicleKm}
                  className="w-full bg-gray-700 text-white text-xl font-bold px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 text-center tracking-widest"
                />
                <p className="text-[10px] text-gray-500 text-center">
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
              <div className="bg-[#111111] rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-1.5">
                  <Fuel className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Autonomie (km)</p>
                </div>
                <input
                  type="number"
                  inputMode="numeric"
                  value={fuelRangeKm}
                  onChange={e => setFuelRangeKm(Number(e.target.value))}
                  min={0}
                  className="w-full bg-gray-700 text-white text-xl font-bold px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 text-center tracking-widest"
                />
                <p className="text-[10px] text-gray-500 text-center">
                  {type === 'arrivee' && fuelRangeAtDeparture != null ? (
                    fuelRangeKm < fuelRangeAtDeparture ? (
                      <>
                        Départ : {fuelRangeAtDeparture.toLocaleString('fr-FR')} km
                        <span className="ml-1 text-orange-400 font-semibold">
                          (−{(fuelRangeAtDeparture - fuelRangeKm).toLocaleString('fr-FR')} km)
                        </span>
                      </>
                    ) : (
                      <>Départ : {fuelRangeAtDeparture.toLocaleString('fr-FR')} km · <span className="text-green-400">niveau OK</span></>
                    )
                  ) : (
                    <span>relevé ordinateur de bord</span>
                  )}
                </p>
              </div>
            </div>

            {/* Rappel km inclus — EDL retour uniquement */}
            {type === 'arrivee' && (
              <div className="bg-[#111111] rounded-xl px-3 py-2 flex items-center gap-2">
                <Gauge className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                <p className="text-[10px] text-gray-300">
                  Départ : <strong className="text-white">{(kmAtDeparture ?? vehicleKm).toLocaleString('fr-FR')} km</strong>
                  {' · '}Inclus : <strong className="text-white">{kmIncluded.toLocaleString('fr-FR')} km</strong>
                  {' · '}Sup : <strong className="text-white">{extraKmPrice} €/km</strong>
                </p>
              </div>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <CleanlinessPicker label="Propreté extérieure" value={exteriorCleanliness} onChange={setExteriorCleanliness} />
            <CleanlinessPicker label="Propreté intérieure" value={interiorCleanliness} onChange={setInteriorCleanliness} />
          </div>

          <button
            onClick={() => setStep('schema')}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors active:scale-[.97] transition-transform flex items-center justify-center gap-2"
          >
            Suivant : État des zones <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Étape : Schéma */}
      {step === 'schema' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500 text-center">Appuyez sur une zone pour signaler un dommage</p>

          {type === 'arrivee' && previousDamagedZones.length > 0 && (
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
              <h4 className="font-medium text-blue-800 mb-2 flex items-center gap-2 text-sm">
                <AlertTriangle className="w-4 h-4 text-blue-500" />
                Déjà signalé à l&apos;état des lieux de départ
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {previousDamagedZones.map(z => (
                  <span key={z.id} className="text-xs px-2.5 py-1 rounded-full bg-white border border-blue-200 text-blue-700 font-medium">
                    {z.label} · {graviteLabel(z.severity as DamageEntry['severity'])}
                  </span>
                ))}
              </div>
            </div>
          )}

          <VehicleInspectionMap
            damages={damages}
            onDamageAdd={handleDamageAdd}
            onDamageRemove={handleDamageRemove}
            previousZones={type === 'arrivee' ? previousDamagedZones : []}
          />

          {damagedZoneCount > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                {damagedZoneCount} zone(s) · {damageCount} dommage(s)
              </h4>
              <div className="space-y-2">
                {Object.entries(damages)
                  .filter(([, entries]) => entries.length > 0)
                  .map(([zoneId, entries]) => {
                    const zone = NEW_ZONES.find(z => z.id === zoneId)
                    const isNew = type === 'arrivee' && !previousZoneIds.has(zoneId)
                    return (
                      <div key={zoneId} className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 gap-2">
                        <div className="flex-1 min-w-0">
                          <span className={`text-xs px-2 py-0.5 rounded-full mr-2 font-medium ${
                            entries[0].severity === 'dommage'   ? 'bg-red-100 text-red-700' :
                            entries[0].severity === 'rayure'    ? 'bg-yellow-100 text-yellow-700' :
                            'bg-orange-100 text-orange-700'
                          }`}>
                            {entries.length > 1 ? `${entries.length}×` : graviteLabel(entries[0].severity)}
                          </span>
                          <span className="text-sm font-medium text-gray-800">{zone?.label ?? zoneId}</span>
                          {type === 'arrivee' && (
                            isNew
                              ? <span className="ml-2 text-[10px] font-bold uppercase text-red-500">nouveau</span>
                              : <span className="ml-2 text-[10px] font-bold uppercase text-blue-500">déjà signalé au départ</span>
                          )}
                          {entries[0].comment && (
                            <p className="text-xs text-gray-400 mt-0.5 truncate">{entries[0].comment}</p>
                          )}
                        </div>
                        {isNew && (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={priceForZone(zoneId)}
                              onChange={e => setDamagePrices(prev => ({ ...prev, [zoneId]: Number(e.target.value) }))}
                              className="w-20 text-sm text-right bg-white border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-400"
                            />
                            <span className="text-xs text-gray-400">€</span>
                          </div>
                        )}
                        <button
                          onClick={() => setDamages(prev => {
                            const next = { ...prev }
                            delete next[zoneId]
                            return next
                          })}
                          className="p-1 hover:bg-red-50 rounded-lg flex-shrink-0"
                        >
                          <X className="w-4 h-4 text-gray-400 hover:text-red-500" />
                        </button>
                      </div>
                    )
                  })}
              </div>
              {type === 'arrivee' && exteriorDamageFee > 0 && (
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                  <span className="text-sm font-bold text-gray-700">Sous-total carrosserie</span>
                  <span className="text-base font-bold text-red-600">{exteriorDamageFee.toLocaleString('fr-FR')} €</span>
                </div>
              )}
            </div>
          )}

          {/* Dégâts intérieurs à facturer (EDL retour uniquement) */}
          {type === 'arrivee' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <h4 className="font-medium text-gray-700 mb-1 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Dégâts intérieurs à facturer
              </h4>
              <p className="text-xs text-gray-400 mb-3">Renseignez un montant pour chaque poste dégradé (laisser vide si aucun).</p>
              <div className="space-y-3">
                {INTERIOR_DAMAGE_ITEMS.map(it => {
                  const val = interiorCharges[it.id]
                  const pics = interiorPhotos[it.id] ?? []
                  return (
                    <div key={it.id} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-gray-600 flex-1 min-w-0">{it.label}</span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {/* Bouton photo — obligatoire si le poste est facturé, disponible toujours */}
                          <button
                            type="button"
                            onClick={() => triggerPhoto(`interior:${it.id}`)}
                            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                              pics.length > 0
                                ? 'bg-green-100 text-green-600'
                                : 'bg-gray-100 text-gray-400 hover:bg-blue-50 hover:text-blue-500'
                            }`}
                            title={pics.length > 0 ? `${pics.length} photo(s) — ajouter` : 'Ajouter une photo'}
                          >
                            <Camera className="w-4 h-4" />
                          </button>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            inputMode="decimal"
                            placeholder="0"
                            value={val != null ? String(val) : ''}
                            onChange={e => {
                              const n = e.target.value === '' ? NaN : Number(e.target.value)
                              setInteriorCharges(prev => {
                                const next = { ...prev }
                                if (!Number.isFinite(n) || n <= 0) delete next[it.id]
                                else next[it.id] = n
                                return next
                              })
                            }}
                            className="w-24 text-sm text-right bg-white border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-400"
                          />
                          <span className="text-xs text-gray-400">€</span>
                        </div>
                      </div>
                      {/* Vignettes des photos prises pour ce poste */}
                      {pics.length > 0 && (
                        <div className="flex gap-1.5 flex-wrap pl-1">
                          {pics.map((url, i) => (
                            <div key={i} className="relative w-14 h-14">
                              <img src={url} alt="" className="w-full h-full object-cover rounded-lg border border-gray-200" />
                              <button
                                type="button"
                                onClick={() => setInteriorPhotos(prev => ({
                                  ...prev,
                                  [it.id]: (prev[it.id] ?? []).filter((_, j) => j !== i),
                                }))}
                                className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              {interiorDamageFee > 0 && (
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                  <span className="text-sm font-bold text-gray-700">Sous-total intérieur</span>
                  <span className="text-base font-bold text-red-600">{interiorDamageFee.toLocaleString('fr-FR')} €</span>
                </div>
              )}
            </div>
          )}

          {/* Total général des dégradations facturées au client */}
          {type === 'arrivee' && totalDamageFee > 0 && (
            <div className="flex items-center justify-between bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
              <span className="text-sm font-bold text-red-800">Total à facturer au client</span>
              <span className="text-lg font-black text-red-600">{totalDamageFee.toLocaleString('fr-FR')} €</span>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep('info')}
              className="px-5 py-3 bg-white border border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50 transition-colors active:scale-[.97] transition-transform flex items-center justify-center gap-1.5"
            >
              <ChevronLeft className="w-4 h-4" /> Retour
            </button>
            <button
              onClick={() => setStep('photos')}
              className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors active:scale-[.97] transition-transform flex items-center justify-center gap-2"
            >
              Suivant : Photos ({photoCount} prise{photoCount > 1 ? 's' : ''}) <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Étape : Photos */}
      {step === 'photos' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <h3 className="font-semibold text-gray-800 mb-1">
              Photos de l'état des lieux
              <span className="ml-2 text-sm font-normal text-gray-500">({photoCount} prise{photoCount > 1 ? 's' : ''})</span>
            </h3>
            <p className="text-xs text-gray-400 mb-3">Minimum 3 photos requises. Les emplacements ci-dessous indiquent où photographier (intérieur, extérieur, 4 côtés…).</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {MANDATORY_PHOTOS.map(p => {
                const taken = photos[p.type]
                return (
                  <button
                    key={p.type}
                    type="button"
                    onClick={() => triggerPhoto(p.type)}
                    className={`relative aspect-[4/3] rounded-xl overflow-hidden border-2 transition-all ${
                      taken ? 'border-green-400' : 'border-dashed border-gray-200 hover:border-blue-400'
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
                      <div className="flex flex-col items-center justify-center h-full bg-gray-50 gap-1.5 p-2">
                        <Camera className="w-6 h-6 text-gray-300" />
                        <span className="text-xs text-gray-400 text-center leading-tight">{p.label}</span>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {!mandatoryCompleted && (
            <p className="text-sm text-amber-600 bg-amber-50 rounded-xl px-4 py-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              Minimum 3 photos requises — {photoCount}/3
            </p>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep('schema')}
              className="px-5 py-3 bg-white border border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50 transition-colors active:scale-[.97] transition-transform flex items-center justify-center gap-1.5"
            >
              <ChevronLeft className="w-4 h-4" /> Retour
            </button>
            <button
              onClick={() => setStep('signatures')}
              disabled={!mandatoryCompleted}
              className="flex-1 py-3 bg-blue-600 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors active:scale-[.97] transition-transform flex items-center justify-center gap-2"
            >
              Suivant : Signatures <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Étape : Signatures */}
      {step === 'signatures' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
            <h3 className="font-semibold text-gray-800">Signatures</h3>
            <SignatureCanvas
              label="Signature du client *"
              onSign={setClientSig}
              onClear={() => setClientSig(null)}
              height={160}
            />
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Pour l&apos;agence</p>
              <div className="flex items-center justify-center h-[120px] rounded-xl border-2 border-dashed border-gray-200 bg-gray-50">
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

          <div className="flex gap-3">
            <button
              onClick={() => setStep('photos')}
              disabled={saving}
              className="px-5 py-3 bg-white border border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50 transition-colors active:scale-[.97] transition-transform flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" /> Retour
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || !clientSig}
              className="flex-1 py-3.5 bg-green-600 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl font-bold hover:bg-green-700 transition-colors active:scale-[.97] transition-transform"
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  Enregistrement…
                </span>
              ) : 'Valider l\'état des lieux'}
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
