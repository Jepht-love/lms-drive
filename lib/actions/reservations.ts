'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { assertPeriodOpen } from '@/lib/accounting/period-lock'
import { findBlockingInternalTrip } from '@/lib/vehicles/internalTrips'
import { Resend } from 'resend'
import { RESEND_FROM, resendTo } from '@/lib/email/config'

export async function sendPaymentInfoEmail(
  reservationId: string,
  clientEmail: string,
  clientName: string,
  reservationNumber: string,
): Promise<{ success?: boolean; deadline?: string; error?: string }> {
  // Garde d'authentification AVANT l'envoi : une action serveur exportée est
  // appelable directement par n'importe qui, et celle-ci consomme du quota
  // Resend et écrit dans `reservations`.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  if (!clientEmail) return { error: 'Pas d\'adresse email pour ce client' }
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { error: 'Clé RESEND_API_KEY manquante' }

  const sentAt = new Date()
  const deadline = new Date(sentAt.getTime() + 2 * 60 * 60 * 1000)

  const resend = new Resend(apiKey)
  const { error } = await resend.emails.send({
    from: RESEND_FROM,
    to: resendTo(clientEmail),
    subject: `Modalités de paiement — Réservation ${reservationNumber}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#111">
        <h2 style="margin-bottom:4px">Bonjour${clientName ? ` ${clientName}` : ''},</h2>
        <p>Concernant votre réservation <strong>${reservationNumber}</strong>, voici les modalités de règlement disponibles :</p>
        <ul style="line-height:2">
          <li>💳 <strong>Carte bancaire</strong></li>
          <li>🏦 <strong>Virement bancaire</strong></li>
          <li>💵 <strong>Espèces</strong></li>
        </ul>
        <p>Pour un paiement en espèces, merci de contacter l'agence afin de convenir d'un rendez-vous.</p>
        <p style="color:#e55;font-weight:bold">⏳ Merci de régler l'acompte sous 2 h. Sans règlement, votre réservation pourra être annulée et le véhicule remis en disponibilité.</p>
        <p style="color:#666;font-size:13px;margin-top:24px">— L'équipe LMS Drive</p>
      </div>
    `,
  })
  if (error) return { error: error.message }

  await supabase
    .from('reservations')
    .update({ payment_email_sent_at: sentAt.toISOString() })
    .eq('id', reservationId)

  revalidatePath(`/reservations/${reservationId}`)
  return { success: true, deadline: deadline.toISOString() }
}

export async function cancelReservationOnPaymentTimeout(
  reservationId: string,
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  // On récupère le véhicule AVANT de savoir si l'annulation s'applique, pour
  // pouvoir recalculer son statut ensuite (sinon un véhicule reste « réservé »
  // orphelin après annulation pour non-paiement).
  const { data: cancelled } = await supabase
    .from('reservations')
    .update({ status: 'annulee', payment_email_sent_at: null })
    .eq('id', reservationId)
    .eq('payment_status', 'en_attente')
    .select('vehicle_id')
    .maybeSingle()

  if (cancelled?.vehicle_id) await recomputeVehicleStatus(supabase, cancelled.vehicle_id)

  revalidatePath(`/reservations/${reservationId}`)
  revalidatePath('/reservations')
  revalidatePath('/')
  return { success: true }
}

export async function updatePaymentInfo(
  reservationId: string,
  data: {
    payment_status: string
    payment_method: string | null
    payment_amount: number | null
    payment_ref: string | null
    payment_date: string | null
    /**
     * Part du règlement qui solde les frais de restitution (km, retard,
     * dégâts). Volontairement HORS de `payment_amount` : la recette « location »
     * est posée en comptabilité avec `payment_amount`, alors que les frais y
     * figurent déjà dans leurs propres catégories à la clôture. Les mélanger
     * les compterait deux fois. Décision de Jeff du 28/07/2026.
     */
    fees_paid_amount?: number
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  // 1. Mettre à jour la réservation
  const { error } = await supabase
    .from('reservations')
    .update(data)
    .eq('id', reservationId)
  if (error) return { error: error.message }

  // 2. Synchroniser la comptabilité
  const txRef = `res_${reservationId}:paiement`
  const isPaid = data.payment_status === 'paye' || data.payment_status === 'partiel'

  if (isPaid && data.payment_amount && data.payment_amount > 0) {
    const { data: res } = await supabase
      .from('reservations')
      .select('vehicle_id, reservation_number, clients(first_name, last_name)')
      .eq('id', reservationId)
      .single()

    const today = new Date().toISOString().slice(0, 10)
    const periodLocked = await assertPeriodOpen(supabase, today)

    if (!periodLocked) {
      const cl = res?.clients && !Array.isArray(res.clients) ? res.clients : Array.isArray(res?.clients) ? res.clients[0] : null
      const clientName = cl ? `${cl.first_name} ${cl.last_name}`.trim() : null
      const adminTx = createAdminClient()

      // CA « location » compté une seule fois par réservation, ancré sur le paiement :
      // on retire toute recette location déjà posée pour cette résa (ancienne ligne de
      // paiement, OU ligne de base créée à la clôture) avant de reposer le montant payé
      // avec son mode de règlement. On ne touche jamais à une période figée (clôturée).
      const { data: prevLoc } = await adminTx
        .from('financial_transactions')
        .select('id, date')
        .eq('reservation_id', reservationId)
        .eq('category', 'location')
      for (const t of prevLoc ?? []) {
        if (await assertPeriodOpen(supabase, t.date)) continue
        await adminTx.from('financial_transactions').delete().eq('id', t.id)
      }

      await adminTx.from('financial_transactions').insert({
        date: today,
        type: 'recette',
        category: 'location',
        amount: data.payment_amount,
        vehicle_id: res?.vehicle_id ?? null,
        reservation_id: reservationId,
        supplier_beneficiary: clientName,
        payment_method: data.payment_method,
        reference: txRef,
        notes: res?.reservation_number ? `Paiement — ${res.reservation_number}` : null,
        created_by: user.id,
      })
    }
  } else {
    // Paiement annulé ou impayé → retirer la transaction comptable
    await createAdminClient().from('financial_transactions').delete().eq('reference', txRef)
  }

  revalidatePath(`/reservations/${reservationId}`)
  revalidatePath('/accounting')
  return { success: true }
}
import { logAudit } from '@/lib/audit/log'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateReservationNumber, calculateRentalDays, calculateRentalPrice, rentalPriceBreakdown, ratesFor, toYMD, type RentalRates } from '@/lib/utils'
import { businessNow } from '@/lib/calendar/dateUtils'
import { syncReservationToCalendar } from '@/lib/calendar/syncRental'
import { recomputeVehicleStatus } from '@/lib/vehicles/vehicleStatus'
import { broadcastPushToManagers } from '@/lib/push/broadcastPush'
import type { NotificationType } from '@/lib/push/notificationTypes'
import { generateInvoiceDraft } from '@/lib/actions/invoices'
import type { ReservationStatus } from '@/types/database'
import { jourHeureAgence, instantDepuisSaisie } from '@/lib/format/heureAgence'

/**
 * Fige la ventilation du prix telle qu'elle a été appliquée.
 *
 * Le prix se calcule à partir des tarifs COURANTS du véhicule. Sans cette
 * photographie, changer la grille tarifaire réécrirait tout l'historique et
 * l'analyse des offres deviendrait fausse rétroactivement — et surtout, la base
 * ne gardait que `total_price` : impossible de savoir QUELLE formule avait
 * produit ce montant. Stockée pour l'analyse, elle n'intervient dans aucun
 * calcul et ne s'affiche nulle part (décision du 27/07/2026).
 *
 * `start` doit être l'heure MURALE de l'agence : c'est elle qui dit quel jour de
 * la semaine est facturé.
 */
function buildPriceBreakdownRecord(rates: RentalRates, start: string | Date, days: number) {
  if (days <= 0) return null
  const { lines, total } = rentalPriceBreakdown(rates, start, days)
  if (!lines.length) return null
  return {
    rates: {
      daily: rates.daily,
      weekend: rates.weekend ?? null,
      weekendFull: rates.weekendFull ?? null,
      weekly: rates.weekly ?? null,
    },
    lines: lines.map(l => (
      l.kind === 'day'
        ? { kind: l.kind, date: toYMD(l.date), weekend: l.weekend, amount: l.amount }
        : l.kind === 'week'
          ? { kind: l.kind, from: toYMD(l.from), to: toYMD(l.to), amount: l.amount }
          : { kind: l.kind, from: toYMD(l.from), to: toYMD(l.to), amount: l.amount, instead: l.instead }
    )),
    total,
    days,
    computedAt: new Date().toISOString(),
  }
}

const DIACRITICS_RE = new RegExp('[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']', 'g')

function normalizeName(s: string): string {
  return s.normalize('NFD').replace(DIACRITICS_RE, '').trim().toLowerCase()
}

// Bloque le contournement « même personne, nouveau numéro » : vrai si un AUTRE
// client (nom+prénom identique, comparaison insensible accents/casse) est blacklisté.
async function isNameBlacklisted(
  supabase: Awaited<ReturnType<typeof createClient>>,
  firstName: string,
  lastName: string,
  excludeClientId?: string,
): Promise<boolean> {
  let query = supabase.from('clients').select('id, first_name, last_name').eq('status', 'blackliste')
  if (excludeClientId) query = query.neq('id', excludeClientId)
  const { data } = await query
  const target = normalizeName(`${firstName} ${lastName}`)
  return (data ?? []).some(c => normalizeName(`${c.first_name} ${c.last_name}`) === target)
}

function normalizePhone(s: string | null | undefined): string {
  return (s ?? '').replace(/[^0-9]/g, '')
}

function normalizeEmail(s: string | null | undefined): string {
  return (s ?? '').replace(/\s+/g, '').toLowerCase()
}

// Bloque le contournement « même personne, autre dossier » par les coordonnées :
// vrai si un client blacklisté partage le même téléphone OU le même email.
async function isContactBlacklisted(
  supabase: Awaited<ReturnType<typeof createClient>>,
  phone: string | null | undefined,
  email: string | null | undefined,
  excludeClientId?: string,
): Promise<boolean> {
  const p = normalizePhone(phone)
  const e = normalizeEmail(email)
  if (!p && !e) return false
  let query = supabase.from('clients').select('id, phone, email').eq('status', 'blackliste')
  if (excludeClientId) query = query.neq('id', excludeClientId)
  const { data } = await query
  return (data ?? []).some(c => {
    const cp = normalizePhone(c.phone)
    const ce = normalizeEmail(c.email)
    return (!!p && cp === p) || (!!e && ce === e)
  })
}

// Poste automatiquement le CA d'une location terminée en comptabilité (CDC :
// « les données financières seront intégrées à la comptabilité »). Idempotent —
// ne crée rien si une recette « location » existe déjà pour cette réservation.
// Utilise le client admin (service role) car la clôture peut être faite par un
// employé, alors que financial_transactions est en RLS gérant/associé.
async function postRentalRevenue(reservationId: string, userId: string) {
  const admin = createAdminClient()

  const { data: res } = await admin
    .from('reservations')
    .select('total_price, vehicle_id, end_datetime, reservation_number, extra_km_amount, late_fee_amount, late_fee_validated, deposit_deducted')
    .eq('id', reservationId)
    .single()
  if (!res) return

  // Idempotence PAR CATÉGORIE. Le CA « location » est ancré sur le paiement
  // (updatePaymentInfo, qui porte le mode de règlement pour la caisse) : ici on ne
  // reposte la base que si AUCUNE recette location n'existe encore (secours : résa
  // clôturée sans paiement enregistré). Les suppléments constatés au retour (km,
  // retard, dégâts) sont postés une seule fois chacun.
  const { data: existing } = await admin
    .from('financial_transactions')
    .select('category')
    .eq('reservation_id', reservationId)
  const posted = new Set((existing ?? []).map(t => t.category))

  // Date réelle de clôture (aujourd'hui), pas la date prévue de fin de location.
  // Sans ça, les retours tardifs postent dans le passé et n'apparaissent pas dans
  // les recettes du jour.
  const date = new Date().toISOString().slice(0, 10)
  const base = {
    date,
    type: 'recette' as const,
    vehicle_id: res.vehicle_id,
    reservation_id: reservationId,
    reference: res.reservation_number,
    created_by: userId,
  }
  const rows: Record<string, unknown>[] = []
  if ((res.total_price ?? 0) > 0 && !posted.has('location')) {
    rows.push({ ...base, category: 'location', amount: res.total_price, notes: `Location ${res.reservation_number}` })
  }
  if ((res.extra_km_amount ?? 0) > 0 && !posted.has('km_supplementaires')) {
    rows.push({ ...base, category: 'km_supplementaires', amount: res.extra_km_amount, notes: `Km supplémentaires ${res.reservation_number}` })
  }
  if ((res.late_fee_amount ?? 0) > 0 && res.late_fee_validated && !posted.has('frais_retard')) {
    rows.push({ ...base, category: 'frais_retard', amount: res.late_fee_amount, notes: `Frais de retard ${res.reservation_number}` })
  }
  if ((res.deposit_deducted ?? 0) > 0 && !posted.has('degats')) {
    rows.push({ ...base, category: 'degats', amount: res.deposit_deducted, notes: `Caution retenue ${res.reservation_number}` })
  }
  if (rows.length) await admin.from('financial_transactions').insert(rows)
}

export async function createReservation(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const vehicleId = (formData.get('vehicle_id') as string)?.trim()
  let clientId = (formData.get('client_id') as string)?.trim()
  const startDatetime = formData.get('start_datetime') as string
  const endDatetime = formData.get('end_datetime') as string
  const dailyPrice = Number(formData.get('daily_price'))

  if (!vehicleId) return { error: 'Veuillez sélectionner un véhicule.' }
  if (!startDatetime || !endDatetime) return { error: 'Veuillez renseigner les dates de début et de fin.' }

  // Deux formes de la même date, à ne pas confondre :
  //   · `startDatetime` / `endDatetime` — l'heure MURALE saisie (« 10:00 »).
  //     C'est elle qui dit quel jour de la semaine est facturé : convertie trop
  //     tôt, un départ le vendredi à 00:30 devient jeudi côté serveur (UTC) et
  //     perd sa majoration week-end.
  //   · `startInstant` / `endInstant` — l'instant réel, pour tout ce qui touche
  //     la base : écritures et comparaisons avec les colonnes horodatées.
  const startInstant = instantDepuisSaisie(startDatetime)
  const endInstant = instantDepuisSaisie(endDatetime)

  // Nouveau client créé à la volée (prénom/nom/téléphone uniquement)
  const newFirstName = (formData.get('new_client_first_name') as string)?.trim()
  const newLastName = (formData.get('new_client_last_name') as string)?.trim()
  const newPhone = (formData.get('new_client_phone') as string)?.trim()

  let clientName = ''

  if (newFirstName && newLastName && newPhone) {
    if (await isNameBlacklisted(supabase, newFirstName, newLastName)) {
      return { error: 'Ce nom correspond à un client blacklisté — réservation impossible.' }
    }
    if (await isContactBlacklisted(supabase, newPhone, null)) {
      return { error: 'Ce numéro correspond à un client blacklisté — réservation impossible.' }
    }
    const admin = createAdminClient()
    const { data: newClient, error: clientErr } = await admin
      .from('clients')
      .insert({ first_name: newFirstName, last_name: newLastName, phone: newPhone, created_by: user.id })
      .select('id')
      .single()
    if (clientErr || !newClient) return { error: clientErr?.message ?? 'Erreur lors de la création du client' }
    clientId = newClient.id
    clientName = `${newFirstName} ${newLastName}`
  } else {
    const { data: selectedClient } = await supabase
      .from('clients').select('status, first_name, last_name, phone, email').eq('id', clientId).maybeSingle()
    if (selectedClient?.status === 'blackliste') {
      return { error: 'Ce client est blacklisté — réservation impossible.' }
    }
    if (selectedClient && await isNameBlacklisted(supabase, selectedClient.first_name, selectedClient.last_name, clientId)) {
      return { error: 'Ce nom correspond à un client blacklisté sous un autre dossier — réservation impossible.' }
    }
    if (selectedClient && await isContactBlacklisted(supabase, selectedClient.phone, selectedClient.email, clientId)) {
      return { error: 'Les coordonnées de ce client correspondent à un client blacklisté sous un autre dossier — réservation impossible.' }
    }
    clientName = selectedClient ? `${selectedClient.first_name} ${selectedClient.last_name}` : ''
  }

  // Check conflict — chevauchement réel : l'existante commence avant la fin de
  // la nouvelle ET se termine après le début de la nouvelle. Le .or() précédent
  // combinait les deux conditions en OU au lieu de ET, donc presque toute paire
  // de réservations matchait (faux conflit permanent dès qu'un véhicule avait
  // déjà une réservation, même sans aucun chevauchement réel).
  const { data: conflicts } = await supabase
    .from('reservations')
    .select('id')
    .eq('vehicle_id', vehicleId)
    .not('status', 'in', '("annulee","terminee","non_presente")')
    .lt('start_datetime', endInstant)
    .gt('end_datetime', startInstant)
    .limit(1)

  if (conflicts && conflicts.length > 0) {
    return { error: 'Ce véhicule est déjà réservé sur cette période.' }
  }

  // Indisponibilité GARAGE : un RDV garage (calendrier) qui chevauche RÉELLEMENT le
  // créneau bloque la location — uniquement sur sa propre fenêtre. Un RDV 14h-17h
  // n'empêche pas une location à 18h ; il refuse une location qui recoupe 14h-17h.
  const { data: garageConflicts } = await supabase
    .from('calendar_events')
    .select('id')
    .eq('event_type', 'rdv_garage')
    .neq('status', 'annule')
    .contains('vehicle_ids', [vehicleId])
    .lt('start_at', endInstant)
    .gt('end_at', startInstant)
    .limit(1)

  if (garageConflicts && garageConflicts.length > 0) {
    return { error: 'Ce véhicule a un rendez-vous garage sur cette période.' }
  }

  // Indisponibilité DÉPLACEMENT INTERNE : un trajet interne qui chevauche le créneau
  // (ou un trajet en cours au retour inconnu) bloque la location.
  if (await findBlockingInternalTrip(supabase, vehicleId, startInstant, endInstant)) {
    return { error: 'Ce véhicule est utilisé pour un déplacement interne sur cette période.' }
  }

  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('daily_price, weekly_price, price_day_weekend, price_weekend_full, km_included_daily, extra_km_price, brand, model, color, plate')
    .eq('id', vehicleId)
    .single()

  const days = calculateRentalDays(startInstant, endInstant)
  // Le prix dépend des DATES : les jours de week-end sont facturés plus cher.
  const grossPrice = calculateRentalPrice(ratesFor(dailyPrice, vehicle), startDatetime, days)

  // Remise fidélité client appliquée automatiquement (tolérant à l'absence de la
  // colonne discount_percent avant la migration 019 → remise 0).
  const { data: cli } = await supabase
    .from('clients').select('discount_percent').eq('id', clientId).maybeSingle()
  const discountPct = Math.min(100, Math.max(0, Number((cli as { discount_percent?: number } | null)?.discount_percent ?? 0) || 0))
  const loyaltyPrice = discountPct > 0
    ? Math.round(grossPrice * (1 - discountPct / 100) * 100) / 100
    : grossPrice

  // Prix négocié saisi par le gérant : il REMPLACE le tarif au barème (remise
  // fidélité comprise) au lieu de s'en déduire. L'ancienne case « Réduction »
  // (montant fixe en €) a été retirée le 27/07/2026 : deux façons de baisser un
  // prix cohabitaient sans que le total sache dire laquelle avait joué. La
  // remise est désormais DÉRIVÉE de l'écart barème / prix appliqué, comme dans
  // « Modifier les dates & tarif ».
  const customTotalRaw = ((formData.get('custom_total') as string) ?? '').trim()
  const customTotal = customTotalRaw
    ? Math.max(0, Number(customTotalRaw.replace(',', '.')) || 0)
    : null
  const totalPrice = customTotal != null && customTotal > 0
    ? Math.round(customTotal * 100) / 100
    : loyaltyPrice
  const manualDiscount = Math.round((loyaltyPrice - totalPrice) * 100) / 100

  const paymentAmount = formData.get('payment_amount') ? Number(formData.get('payment_amount')) : 0

  const baseNotes = (formData.get('internal_notes') as string) || ''
  const noteParts: string[] = []
  if (baseNotes) noteParts.push(baseNotes)
  if (discountPct > 0) noteParts.push(`Remise fidélité ${discountPct}% appliquée (tarif ${grossPrice}€ → ${loyaltyPrice}€).`)
  if (manualDiscount > 0) noteParts.push(`Prix négocié : réduction de ${manualDiscount}€ accordée (${loyaltyPrice}€ → ${totalPrice}€).`)
  if (manualDiscount < 0) noteParts.push(`Prix négocié : majoration de ${-manualDiscount}€ appliquée (${loyaltyPrice}€ → ${totalPrice}€).`)
  const internalNotes = noteParts.length ? noteParts.join('\n') : null

  const payload = {
    reservation_number: generateReservationNumber(),
    vehicle_id: vehicleId,
    client_id: clientId,
    start_datetime: startInstant,
    end_datetime: endInstant,
    // Photographie de la ventilation, pour l'analyse ultérieure des offres.
    price_breakdown: buildPriceBreakdownRecord(ratesFor(dailyPrice, vehicle), startDatetime, days),
    status: 'option' as ReservationStatus,
    daily_price: dailyPrice,
    total_price: totalPrice,
    km_included: formData.get('km_included') ? Number(formData.get('km_included')) : vehicle?.km_included_daily ?? null,
    extra_km_price: formData.get('extra_km_price') ? Number(formData.get('extra_km_price')) : vehicle?.extra_km_price ?? null,
    deposit_amount: formData.get('deposit_amount') ? Number(formData.get('deposit_amount')) : null,
    deposit_method: formData.get('deposit_method') as string || null,
    deposit_ref: formData.get('deposit_ref') as string || null,
    payment_amount: paymentAmount > 0 ? paymentAmount : null,
    payment_status: paymentAmount > 0 ? (paymentAmount >= totalPrice ? 'paye' : 'partiel') : 'en_attente',
    internal_notes: internalNotes,
    created_by: user.id,
  }

  const { data, error } = await supabase.from('reservations').insert(payload).select('id').single()
  if (error) return { error: error.message }

  await recomputeVehicleStatus(supabase, vehicleId)

  // Acompte encaissé dès la création : il DOIT partir en comptabilité, comme un
  // paiement saisi ensuite depuis la fiche.
  //
  // Constat du 27/07/2026 : ce n'était pas le cas. L'insertion ci-dessus remplit
  // payment_amount et payment_status, mais rien ne créait l'écriture, alors que la
  // saisie manuelle le fait (cf. updatePaymentInfo). Résultat sur la base réelle :
  // 700 € encaissés sur deux réservations, introuvables dans les comptes.
  //
  // On délègue à updatePaymentInfo au lieu de recopier ici l'insertion comptable :
  // une seule logique de comptabilisation, donc pas deux versions qui divergent.
  // Le petit aller-retour supplémentaire est le prix de cette garantie.
  if (paymentAmount > 0) {
    await updatePaymentInfo(data.id, {
      payment_status: payload.payment_status,
      payment_method: (formData.get('payment_method') as string) || null,
      payment_amount: paymentAmount,
      payment_ref: (formData.get('payment_ref') as string) || null,
      payment_date: new Date().toISOString(),
    })
  }

  await supabase.from('audit_logs').insert({
    user_id: user.id,
    action: 'reservation_created',
    entity_type: 'reservations',
    entity_id: data.id,
    metadata: { reservation_number: payload.reservation_number },
  })

  await syncReservationToCalendar(data.id)

  // Trois lignes : qui, quelle voiture, quand. Format commun à toutes les
  // notifications depuis le 30/07/2026. La plaque s'ajoute au véhicule : deux
  // voitures du même modèle ne se distinguent que par elle.
  const vehLabel = vehicle
    ? `${[vehicle.brand, vehicle.model, vehicle.color].filter(Boolean).join(' ')}${vehicle.plate ? ` (${vehicle.plate})` : ''}`
    : ''
  await broadcastPushToManagers({
    title: 'Nouvelle réservation',
    body: [
      clientName || payload.reservation_number,
      vehLabel,
      `Départ le ${jourHeureAgence(startInstant)}`,
    ].filter(Boolean).join('\n'),
    url: `/reservations/${data.id}`,
  }, 'new_reservation_alert')

  revalidatePath('/')
  revalidatePath('/reservations')
  revalidatePath('/calendrier')
  redirect(`/reservations/${data.id}`)
}

// Bascule une réservation en « en cours » — appelée à la VALIDATION de l'état
// des lieux de départ (pas à l'ouverture de l'écran). Synchronise l'événement
// calendrier et recalcule le statut du véhicule.
export async function markReservationDeparted(reservationId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { data: r } = await supabase
    .from('reservations')
    .select('vehicle_id')
    .eq('id', reservationId)
    .single()

  const { error } = await supabase.from('reservations').update({ status: 'en_cours' }).eq('id', reservationId)
  if (error) return { error: error.message }

  await syncReservationToCalendar(reservationId)
  if (r?.vehicle_id) await recomputeVehicleStatus(supabase, r.vehicle_id)
  return { ok: true }
}

/**
 * Saisie/ajustement MANUEL du frais de retard sur une réservation, sans passer
 * par tout l'EDL retour. Le gérant décide du montant facturé (« je l'ai facturée
 * combien ») ; la durée en minutes est optionnelle (info/libellé de facture).
 *
 * Écrit `late_fee_amount`, `late_minutes` et `late_fee_validated` (true dès qu'un
 * montant > 0 est saisi : la saisie manuelle vaut validation). Ces champs sont
 * relus tels quels par la facture complémentaire (generateInvoiceDraft) et par la
 * comptabilité (postRentalRevenue). Si la réservation est déjà clôturée
 * (`terminee`), on synchronise immédiatement la ligne compta `frais_retard`
 * (création / mise à jour / suppression) pour refléter le montant saisi.
 */
export async function updateLateFee(
  reservationId: string,
  lateFeeAmount: number,
  lateMinutes: number | null,
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const amount = Math.max(0, Math.round((lateFeeAmount || 0) * 100) / 100)
  const minutes = lateMinutes != null && lateMinutes > 0 ? Math.round(lateMinutes) : 0
  const validated = amount > 0

  const { data: res, error } = await supabase
    .from('reservations')
    .update({ late_fee_amount: amount, late_minutes: minutes, late_fee_validated: validated })
    .eq('id', reservationId)
    .select('status, vehicle_id, reservation_number')
    .single()

  if (error) return { error: error.message }

  // Synchronisation comptable uniquement si la location est déjà clôturée : sinon
  // le frais sera posté normalement à la clôture (late_fee_validated est déjà à true).
  if (res?.status === 'terminee') {
    const admin = createAdminClient()
    const { data: existingTx } = await admin
      .from('financial_transactions')
      .select('id')
      .eq('reservation_id', reservationId)
      .eq('category', 'frais_retard')
      .maybeSingle()

    if (validated && !existingTx) {
      await admin.from('financial_transactions').insert({
        date: new Date().toISOString().slice(0, 10),
        type: 'recette',
        category: 'frais_retard',
        vehicle_id: res.vehicle_id,
        reservation_id: reservationId,
        reference: res.reservation_number,
        amount,
        notes: `Frais de retard ${res.reservation_number}`,
        created_by: user.id,
      })
    } else if (validated && existingTx) {
      await admin.from('financial_transactions').update({ amount }).eq('id', existingTx.id)
    } else if (!validated && existingTx) {
      // Retard retiré / remis à 0 → on supprime la recette correspondante.
      await admin.from('financial_transactions').delete().eq('id', existingTx.id)
    }
  }

  revalidatePath(`/reservations/${reservationId}`)
  return { success: true }
}

export async function updateReservationStatus(id: string, status: ReservationStatus) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { data: reservation } = await supabase
    .from('reservations')
    .select('vehicle_id, status, reservation_number, start_datetime, end_datetime, client:clients(first_name, last_name), vehicle:vehicles(brand, model, plate, color)')
    .eq('id', id)
    .single()

  if (!reservation) return { error: 'Réservation introuvable' }

  // BUG 1 — garde-fou serveur : « en_cours » (véhicule sorti / « en location »)
  // ne peut venir QUE de la validation de l'EDL départ (markReservationDeparted).
  // Une confirmation, même avec acompte, n'est PAS une sortie de véhicule. On
  // bloque donc tout passage manuel en_cours par cette action, pour empêcher
  // qu'un véhicule paraisse « loué » avant le départ réel (cf. STRATEGIE_BUGS
  // BUG 1). Le contrat, lui, est créé par la page EDL départ.
  if (status === 'en_cours') {
    return { error: "Démarrez la location via l'état des lieux de départ." }
  }

  const { error: updateError } = await supabase.from('reservations').update({ status }).eq('id', id)
  if (updateError) return { error: updateError.message }

  await recomputeVehicleStatus(supabase, reservation.vehicle_id)

  const clt = reservation.client as any
  const veh = reservation.vehicle as any
  const pushClientName = clt ? `${clt.first_name} ${clt.last_name}` : reservation.reservation_number
  const pushVehicle = veh ? `${veh.brand} ${veh.model}${veh.color ? ' ' + veh.color : ''} (${veh.plate})` : ''
  const fmtDate = (iso: string | null) => iso
    ? jourHeureAgence(iso)
    : ''
  const departFmt = fmtDate(reservation.start_datetime)
  const retourFmt = fmtDate(reservation.end_datetime)

  // Trois lignes partout : qui, quelle voiture, quand (Jeff, 30/07/2026).
  const troisLignes = (derniere: string) =>
    [pushClientName, pushVehicle, derniere].filter(Boolean).join('\n')
  const PUSH_LABELS: Partial<Record<ReservationStatus, { title: string; body: string }>> = {
    confirmee:  { title: 'Réservation confirmée', body: troisLignes(departFmt ? `Départ le ${departFmt}` : '') },
    en_cours:   { title: 'Départ effectué',        body: troisLignes(retourFmt ? `Retour prévu le ${retourFmt}` : '') },
    en_retard:  { title: 'Retour en retard',       body: troisLignes(retourFmt ? `Prévu le ${retourFmt}` : '') },
    terminee:   { title: 'Retour effectué',        body: troisLignes('Véhicule rendu') },
  }
  const PUSH_TYPES: Partial<Record<ReservationStatus, NotificationType>> = {
    confirmee: 'departure_alert',
    en_cours:  'departure_alert',
    en_retard: 'late_return_alert',
    terminee:  'return_alert',
  }
  const pushMsg = PUSH_LABELS[status]
  if (pushMsg) {
    await broadcastPushToManagers({ ...pushMsg, url: `/reservations/${id}` }, PUSH_TYPES[status])
  }

  // Location terminée → CA intégré automatiquement en comptabilité
  if (status === 'terminee') {
    await postRentalRevenue(id, user.id)
  }

  await supabase.from('audit_logs').insert({
    user_id: user.id,
    action: 'reservation_status_changed',
    entity_type: 'reservations',
    entity_id: id,
    metadata: { status },
  })

  await syncReservationToCalendar(id)

  revalidatePath(`/reservations/${id}`)
  revalidatePath('/reservations')
  revalidatePath('/accounting')
  revalidatePath('/')
  revalidatePath('/calendrier')
  return { success: true }
}

/**
 * Clôture une réservation dont le client n'est jamais venu chercher le véhicule.
 *
 * Besoin gérant du 27/07/2026. Sans ce geste, une réservation confirmée dont
 * l'heure de départ était passée restait en l'état indéfiniment : la voiture
 * demeurait bloquée alors qu'elle était au parking, et le tableau de bord devait
 * deviner s'il s'agissait d'un départ sans état des lieux ou d'un client absent.
 *
 * Ce que le clic déclenche :
 *   1. la réservation passe en « non_presente » (clôture, pas annulation) ;
 *   2. le véhicule est recalculé, donc libéré s'il n'a pas d'autre engagement ;
 *   3. la recette déjà encaissée est RECLASSÉE de « location » vers
 *      « acompte_conserve ». On ne crée ni ne supprime d'argent : l'acompte a été
 *      comptabilisé à l'encaissement et il reste acquis. Seule son étiquette
 *      change, pour que le chiffre d'affaires de location et la rentabilité du
 *      véhicule ne comptent pas une location qui n'a jamais eu lieu.
 *
 * Une période comptable déjà clôturée n'est jamais modifiée : si la recette y est
 * figée, elle reste telle quelle et la réservation est quand même close.
 */
export async function markReservationNoShow(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { data: reservation } = await supabase
    .from('reservations')
    .select('vehicle_id, status, start_datetime')
    .eq('id', id)
    .single()

  if (!reservation) return { error: 'Réservation introuvable' }

  // Garde-fou : le geste n'a de sens que sur une réservation encore en attente de
  // départ dont l'heure est passée. Une location démarrée se termine par l'état
  // des lieux d'arrivée, pas par ici.
  if (!['option', 'confirmee'].includes(reservation.status)) {
    return { error: 'Seule une réservation en option ou confirmée peut être clôturée ainsi.' }
  }
  if (new Date(reservation.start_datetime) > new Date()) {
    return { error: "L'heure de départ n'est pas encore passée." }
  }

  const { error: updateError } = await supabase
    .from('reservations')
    .update({ status: 'non_presente' })
    .eq('id', id)
  if (updateError) return { error: updateError.message }

  await recomputeVehicleStatus(supabase, reservation.vehicle_id)

  // Reclassement de la recette encaissée, hors période figée.
  const admin = createAdminClient()
  const { data: recettes } = await admin
    .from('financial_transactions')
    .select('id, date')
    .eq('reservation_id', id)
    .eq('category', 'location')
  for (const t of recettes ?? []) {
    if (await assertPeriodOpen(supabase, t.date)) continue
    await admin
      .from('financial_transactions')
      .update({ category: 'acompte_conserve' })
      .eq('id', t.id)
  }

  await supabase.from('audit_logs').insert({
    user_id: user.id,
    action: 'reservation_no_show',
    entity_type: 'reservations',
    entity_id: id,
    metadata: { previous_status: reservation.status },
  })

  await syncReservationToCalendar(id)

  revalidatePath(`/reservations/${id}`)
  revalidatePath('/reservations')
  revalidatePath('/accounting')
  revalidatePath('/vehicles')
  revalidatePath('/')
  revalidatePath('/calendrier')
  return { success: true }
}

export async function updateReservationDates(
  id: string,
  startDatetime: string,
  endDatetime: string,
  newDailyPrice?: number,
  // Prix total négocié : remplace le calcul au barème. Le taux journalier reste
  // la référence — l'écart (barème − prix négocié) est la réduction, affichée
  // sur la fiche résa (ticket SAV 23/07 : « modifier par prix » + mention réduction).
  customTotal?: number,
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { data: reservation } = await supabase
    .from('reservations')
    .select('daily_price, status, vehicle_id, vehicle:vehicles(daily_price, weekly_price, price_day_weekend, price_weekend_full)')
    .eq('id', id)
    .single()

  if (!reservation) return { error: 'Réservation introuvable' }

  // Heure murale pour le barème (jour de la semaine), instant pour la base —
  // voir le commentaire détaillé dans createReservation.
  const startInstant = instantDepuisSaisie(startDatetime)
  const endInstant = instantDepuisSaisie(endDatetime)

  const days = calculateRentalDays(startInstant, endInstant)
  if (days <= 0) return { error: 'Les dates sont invalides.' }

  // Même contrôle de chevauchement que createReservation (ET, pas OU) — sans ça,
  // déplacer les dates d'une réservation peut la faire chevaucher une autre.
  const { data: conflicts } = await supabase
    .from('reservations')
    .select('id')
    .eq('vehicle_id', reservation.vehicle_id)
    .neq('id', id)
    .not('status', 'in', '("annulee","terminee","non_presente")')
    .lt('start_datetime', endInstant)
    .gt('end_datetime', startInstant)
    .limit(1)

  if (conflicts && conflicts.length > 0) {
    return { error: 'Ce véhicule est déjà réservé sur cette période.' }
  }

  const effectiveDailyPrice = (newDailyPrice != null && newDailyPrice > 0)
    ? newDailyPrice
    : reservation.daily_price

  const vehicle = Array.isArray(reservation.vehicle) ? reservation.vehicle[0] : reservation.vehicle as any
  const standardPrice = calculateRentalPrice(
    ratesFor(effectiveDailyPrice, vehicle),
    startDatetime,
    days,
  )
  // Prix négocié fourni → il prime sur le barème ; sinon calcul standard.
  const totalPrice = (customTotal != null && customTotal > 0) ? customTotal : standardPrice
  const discount   = Math.round((standardPrice - totalPrice) * 100) / 100

  const { error } = await supabase.from('reservations').update({
    start_datetime: startInstant,
    end_datetime: endInstant,
    daily_price: effectiveDailyPrice,
    total_price: totalPrice,
    price_breakdown: buildPriceBreakdownRecord(ratesFor(effectiveDailyPrice, vehicle), startDatetime, days),
  }).eq('id', id)

  if (error) return { error: error.message }

  await supabase.from('audit_logs').insert({
    user_id: user.id,
    action: 'reservation_dates_updated',
    entity_type: 'reservations',
    entity_id: id,
    metadata: {
      start_datetime: startInstant,
      end_datetime: endInstant,
      daily_price: effectiveDailyPrice,
      total_price: totalPrice,
      standard_price: standardPrice,
      ...(discount > 0 ? { discount } : {}),
      days,
    },
  })

  await syncReservationToCalendar(id)

  revalidatePath('/')
  revalidatePath(`/reservations/${id}`)
  revalidatePath('/reservations')
  revalidatePath('/calendrier')
  return { success: true, totalPrice, days }
}

// Prolongation d'un contrat en cours : +jours (le km inclus/jour s'applique aux
// nouveaux jours), +prix recalculé sur la période totale. Règle métier : la
// prolongation doit être demandée AU PLUS TARD 12 h avant la fin prévue — au-delà,
// il faut créer une nouvelle réservation. Le « maintenant » est pris CÔTÉ SERVEUR.
const PROLONG_DEADLINE_HOURS = 12

export async function prolongReservation(
  id: string,
  additionalDays: number,
  newDailyPrice?: number,
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  if (!Number.isFinite(additionalDays) || additionalDays < 1) {
    return { error: 'Indiquez un nombre de jours de prolongation valide (≥ 1).' }
  }

  const { data: reservation } = await supabase
    .from('reservations')
    .select('start_datetime, end_datetime, daily_price, total_price, status, vehicle_id, vehicle:vehicles(daily_price, weekly_price, price_day_weekend, price_weekend_full)')
    .eq('id', id)
    .single()

  if (!reservation) return { error: 'Réservation introuvable' }
  if (!['en_cours', 'confirmee', 'en_retard'].includes(reservation.status)) {
    return { error: "Seule une location en cours peut être prolongée." }
  }

  // Garde-fou 12 h (heure serveur)
  const endMs = new Date(reservation.end_datetime).getTime()
  const deadlineMs = endMs - PROLONG_DEADLINE_HOURS * 3600 * 1000
  if (Date.now() > deadlineMs) {
    return {
      error: `La prolongation doit être demandée au moins ${PROLONG_DEADLINE_HOURS} h avant la fin prévue. Ce délai est dépassé — créez une nouvelle réservation.`,
    }
  }

  const newEnd = new Date(endMs + additionalDays * 24 * 3600 * 1000).toISOString()

  // Conflit : un autre engagement sur ce véhicule chevauche la période prolongée
  const { data: conflicts } = await supabase
    .from('reservations')
    .select('id')
    .eq('vehicle_id', reservation.vehicle_id)
    .neq('id', id)
    .not('status', 'in', '("annulee","terminee","non_presente")')
    .lt('start_datetime', newEnd)
    .gt('end_datetime', reservation.end_datetime)
    .limit(1)

  if (conflicts && conflicts.length > 0) {
    return { error: 'Le véhicule est déjà réservé juste après — prolongation impossible sur cette période.' }
  }

  // Même règle de chevauchement horaire que createReservation, appliquée à la
  // fenêtre ajoutée [fin actuelle → nouvelle fin].
  const { data: garageConflicts } = await supabase
    .from('calendar_events')
    .select('id')
    .eq('event_type', 'rdv_garage')
    .neq('status', 'annule')
    .contains('vehicle_ids', [reservation.vehicle_id])
    .lt('start_at', newEnd)
    .gt('end_at', reservation.end_datetime)
    .limit(1)
  if (garageConflicts && garageConflicts.length > 0) {
    return { error: 'Ce véhicule a un rendez-vous garage sur cette période — prolongation impossible.' }
  }

  if (await findBlockingInternalTrip(supabase, reservation.vehicle_id, reservation.end_datetime, newEnd)) {
    return { error: 'Ce véhicule est utilisé pour un déplacement interne sur cette période — prolongation impossible.' }
  }

  const vehicle = Array.isArray(reservation.vehicle) ? reservation.vehicle[0] : reservation.vehicle as any
  const effectiveDailyPrice = (newDailyPrice != null && newDailyPrice > 0) ? newDailyPrice : reservation.daily_price
  const totalDays    = calculateRentalDays(reservation.start_datetime, newEnd)
  const previousDays = calculateRentalDays(reservation.start_datetime, reservation.end_datetime)
  // On facture UNIQUEMENT les jours ajoutés (différence de barème avant/après) et
  // on les additionne au total existant : un prix négocié (réduction) sur la
  // période initiale est ainsi préservé au lieu d'être écrasé par un recalcul.
  const addedAmount = Math.round((
    calculateRentalPrice(ratesFor(effectiveDailyPrice, vehicle), reservation.start_datetime, totalDays)
    - calculateRentalPrice(ratesFor(effectiveDailyPrice, vehicle), reservation.start_datetime, previousDays)
  ) * 100) / 100
  const previousTotal = reservation.total_price ?? 0
  const newTotalPrice = Math.round((previousTotal + addedAmount) * 100) / 100

  const { error } = await supabase.from('reservations').update({
    end_datetime: newEnd,
    daily_price: effectiveDailyPrice,
    total_price: newTotalPrice,
    price_breakdown: buildPriceBreakdownRecord(
      ratesFor(effectiveDailyPrice, vehicle),
      businessNow(new Date(reservation.start_datetime)),
      totalDays,
    ),
  }).eq('id', id)

  if (error) return { error: error.message }

  await supabase.from('audit_logs').insert({
    user_id: user.id,
    action: 'reservation_prolonged',
    entity_type: 'reservations',
    entity_id: id,
    metadata: {
      additional_days: additionalDays,
      previous_end: reservation.end_datetime,
      new_end: newEnd,
      previous_total_price: previousTotal,
      added_amount: addedAmount,
      new_total_price: newTotalPrice,
      daily_price: effectiveDailyPrice,
    },
  })

  await syncReservationToCalendar(id)

  revalidatePath('/')
  revalidatePath(`/reservations/${id}`)
  revalidatePath('/reservations')
  revalidatePath('/calendrier')
  return { success: true, newEnd, newTotalPrice, totalDays }
}

export async function validateContract(contractId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { data: contract } = await supabase
    .from('contracts')
    .select('id, status, reservation_id')
    .eq('id', contractId)
    .single()

  if (!contract) return { error: 'Contrat introuvable' }
  if (contract.status === 'cloture') return { error: 'Contrat déjà clôturé' }

  // Vérifier EDL départ signé
  const { data: depInsp } = await supabase
    .from('inspections')
    .select('id, client_signature_svg')
    .eq('contract_id', contractId)
    .eq('type', 'depart')
    .not('client_signature_svg', 'is', null)
    .limit(1)
    .single()

  if (!depInsp) return { error: "L'état des lieux de départ signé est requis pour valider le contrat." }

  // Vérifier EDL retour signé
  const { data: arrInsp } = await supabase
    .from('inspections')
    .select('id, client_signature_svg')
    .eq('contract_id', contractId)
    .eq('type', 'arrivee')
    .not('client_signature_svg', 'is', null)
    .limit(1)
    .single()

  if (!arrInsp) return { error: "L'état des lieux de retour signé est requis pour valider le contrat." }

  const { error: contractCloseError } = await supabase.from('contracts').update({ status: 'cloture' }).eq('id', contractId)
  if (contractCloseError) return { error: contractCloseError.message }

  if (contract.reservation_id) {
    const admin = createAdminClient()
    const { data: closedRes, error: resUpdateError } = await admin
      .from('reservations')
      .update({ status: 'terminee' })
      .eq('id', contract.reservation_id)
      .select('vehicle_id')
      .single()
    if (resUpdateError) return { error: resUpdateError.message }
    // CA intégré automatiquement en comptabilité à la clôture du contrat
    await postRentalRevenue(contract.reservation_id, user.id)
    await syncReservationToCalendar(contract.reservation_id)
    if (closedRes) await recomputeVehicleStatus(supabase, closedRes.vehicle_id)
    // Phase D — brouillon de facture de restitution si des frais complémentaires existent
    await generateInvoiceDraft(contractId)

    // Opération inter-agences entrante : le véhicule était temporaire (partenaire)
    // → on l'archive, et on clôture l'opération liée.
    if (closedRes?.vehicle_id) {
      const { data: extVehicle } = await supabase
        .from('vehicles').select('is_external').eq('id', closedRes.vehicle_id).maybeSingle()
      if (extVehicle?.is_external) {
        await supabase.from('vehicles')
          .update({ is_active: false, status: 'hors_service' })
          .eq('id', closedRes.vehicle_id)
        await supabase.from('inter_agency_rentals')
          .update({ status: 'cloture', end_date_actual: new Date().toISOString() })
          .eq('client_reservation_id', contract.reservation_id)
      }
    }
  }

  // Journal d'audit — phrase lisible avec client + véhicule (ex. demandé par le
  // gérant : « Contrat validé — Babacar Diallo — Renault Captur »).
  let validatedSummary = 'Contrat validé'
  if (contract.reservation_id) {
    const { data: resInfo } = await supabase
      .from('reservations')
      .select('clients(first_name, last_name), vehicles(brand, model, plate)')
      .eq('id', contract.reservation_id).single()
    const cl = Array.isArray(resInfo?.clients) ? resInfo?.clients[0] : resInfo?.clients
    const ve = Array.isArray(resInfo?.vehicles) ? resInfo?.vehicles[0] : resInfo?.vehicles
    const who = [cl?.first_name, cl?.last_name].filter(Boolean).join(' ')
    const veh = ve ? `${ve.brand} ${ve.model}${ve.plate ? ` (${ve.plate})` : ''}` : ''
    validatedSummary = `Contrat validé${who ? ` — ${who}` : ''}${veh ? ` — ${veh}` : ''}`
  }
  await logAudit(supabase, {
    userId: user.id,
    action: 'contract_validated',
    entityType: 'contracts',
    entityId: contractId,
    summary: validatedSummary,
    metadata: { dep_inspection: depInsp.id, arr_inspection: arrInsp.id },
  })

  revalidatePath(`/reservations/${contract.reservation_id}`)
  revalidatePath('/reservations')
  revalidatePath('/accounting')
  revalidatePath('/calendrier')
  return { success: true }
}
