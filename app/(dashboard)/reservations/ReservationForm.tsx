'use client'

import { useActionState, useState, useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { calculateRentalDays, calculateRentalPrice, formatPrice } from '@/lib/utils'
import { getMissingClientFields } from '@/lib/clients/completeness'
import { useToast } from '@/components/Toast'
import DateTimeField from '@/components/ui/DateTimeField'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Style commun des <select> natifs — alignés sur la primitive Input (le formulaire
// poste via `name`, donc on garde des selects natifs plutôt que Radix Select).
const selectClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'

// Libellé de champ — identité LMS Drive (petit, majuscules) via la primitive Label.
const labelClass = 'mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-muted-foreground'

interface Vehicle {
  id: string; plate: string; brand: string; model: string
  daily_price: number | null; weekly_price: number | null
  deposit_amount: number | null; km_included_daily: number | null
  extra_km_price: number | null
}

interface Client {
  id: string; first_name: string; last_name: string; phone: string; status?: string
  address?: string | null
  id_doc_front_path?: string | null
  id_doc_back_path?: string | null
  license_front_path?: string | null
}

interface Props {
  action: (formData: FormData) => Promise<{ error: string } | void>
  vehicles: Vehicle[]
  clients: Client[]
  defaultClientId?: string
  defaultVehicleId?: string
  defaultStartDatetime?: string
  defaultEndDatetime?: string
}

export default function ReservationForm({ action, vehicles, clients, defaultClientId, defaultVehicleId, defaultStartDatetime, defaultEndDatetime }: Props) {
  const { show } = useToast()
  const [state, formAction, pending] = useActionState(async (_prev: any, formData: FormData) => {
    const result = await action(formData)
    if (!result?.error) show('Réservation créée', 'success')
    return result
  }, null)

  const [selectedVehicleId, setSelectedVehicleId] = useState(defaultVehicleId ?? '')
  const [startDatetime, setStartDatetime] = useState(defaultStartDatetime ? toDatetimeLocal(new Date(defaultStartDatetime)) : '')
  const [endDatetime, setEndDatetime] = useState(defaultEndDatetime ? toDatetimeLocal(new Date(defaultEndDatetime)) : '')
  const [dailyPrice, setDailyPrice] = useState('')
  const [creatingNewClient, setCreatingNewClient] = useState(false)
  const [acompte, setAcompte] = useState('')
  const [discount, setDiscount] = useState('')
  const [selectedClientId, setSelectedClientId] = useState(defaultClientId ?? '')
  const [clientQuery, setClientQuery] = useState('')
  const [showClientResults, setShowClientResults] = useState(false)
  const [durDays, setDurDays] = useState(0)
  const [durHours, setDurHours] = useState(0)
  const [dossierConfirmed, setDossierConfirmed] = useState(false)

  const selectedClient = clients.find(c => c.id === selectedClientId)
  // Dossier incomplet : on alerte dès qu'un client EXISTANT sélectionné manque
  // d'identité / adresse / pièces. La création reste possible après confirmation
  // explicite (choix « alerte + confirmation »). Le mode « nouveau client » inline
  // n'est pas concerné : ses pièces seront ajoutées depuis la fiche client ensuite.
  const missingFields = selectedClient && !creatingNewClient ? getMissingClientFields(selectedClient) : []
  const dossierBlocked = missingFields.length > 0 && !dossierConfirmed
  const filteredClients = clientQuery.trim()
    ? clients.filter(c => {
        const q = clientQuery.trim().toLowerCase()
        return `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) || c.phone?.toLowerCase().includes(q)
      }).slice(0, 8)
    : []

  const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId)

  useEffect(() => {
    if (selectedVehicle?.daily_price) {
      setDailyPrice(selectedVehicle.daily_price.toString())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVehicleId])

  // Changer de client réinitialise la confirmation « dossier incomplet »
  // pour éviter qu'une validation précédente ne s'applique au nouveau client.
  useEffect(() => { setDossierConfirmed(false) }, [selectedClientId])

  // Synchronise les champs durée quand les dates sont saisies manuellement
  useEffect(() => {
    if (startDatetime && endDatetime) {
      const diffMs = new Date(endDatetime).getTime() - new Date(startDatetime).getTime()
      if (diffMs > 0) {
        const totalHours = Math.floor(diffMs / 3600000)
        setDurDays(Math.floor(totalHours / 24))
        setDurHours(totalHours % 24)
      }
    }
  }, [startDatetime, endDatetime])

  const days = startDatetime && endDatetime
    ? calculateRentalDays(startDatetime, endDatetime)
    : 0

  function setDuration(hours: number) {
    const start = startDatetime ? new Date(startDatetime) : new Date()
    const end = new Date(start.getTime() + hours * 3600000)
    if (!startDatetime) setStartDatetime(toDatetimeLocal(start))
    setEndDatetime(toDatetimeLocal(end))
  }

  const totalPrice = days > 0 && dailyPrice
    ? calculateRentalPrice(Number(dailyPrice), selectedVehicle?.weekly_price ?? null, days)
    : 0
  const discountNum = Math.max(0, Number(discount) || 0)
  const netTotal = Math.max(0, totalPrice - discountNum)

  return (
    <form action={formAction} className="space-y-6">
      {state?.error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm font-medium text-destructive">
          {state.error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Véhicule & client */}
        <Card>
          <CardHeader className="p-5 pb-0">
            <CardTitle className="text-base font-semibold">Véhicule &amp; client</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-5">
            <div>
              <Label htmlFor="vehicle_id" className={labelClass}>Véhicule *</Label>
              <select
                id="vehicle_id"
                name="vehicle_id"
                value={selectedVehicleId}
                onChange={e => setSelectedVehicleId(e.target.value)}
                required
                className={selectClass}
              >
                <option value="">— Choisir un véhicule —</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.brand} {v.model} — {v.plate} {v.daily_price ? `(${v.daily_price}€/j)` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <Label htmlFor="client_search" className={`${labelClass} mb-0`}>Client *</Label>
                <button
                  type="button"
                  onClick={() => setCreatingNewClient(v => !v)}
                  className="text-xs font-semibold text-foreground hover:underline"
                >
                  {creatingNewClient ? 'Choisir un client existant' : '+ Nouveau client'}
                </button>
              </div>
              {creatingNewClient ? (
                <div className="grid grid-cols-3 gap-2">
                  <Input name="new_client_first_name" placeholder="Prénom" required enterKeyHint="next" />
                  <Input name="new_client_last_name" placeholder="Nom" required enterKeyHint="next" />
                  <Input name="new_client_phone" type="tel" placeholder="Téléphone" required inputMode="tel" autoComplete="tel" enterKeyHint="done" />
                </div>
              ) : (
                <div className="relative">
                  <input type="hidden" name="client_id" value={selectedClientId} />
                  <Input
                    id="client_search"
                    type="text"
                    placeholder="Rechercher par nom ou téléphone..."
                    value={selectedClient ? `${selectedClient.first_name} ${selectedClient.last_name} — ${selectedClient.phone}` : clientQuery}
                    onChange={e => { setSelectedClientId(''); setClientQuery(e.target.value); setShowClientResults(true) }}
                    onFocus={() => setShowClientResults(true)}
                    onBlur={() => setTimeout(() => {
                      if (!selectedClientId) setClientQuery('')
                      setShowClientResults(false)
                    }, 150)}
                    required
                  />
                  {showClientResults && filteredClients.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full overflow-y-auto rounded-md border border-border bg-popover shadow-md max-h-56">
                      {filteredClients.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          disabled={c.status === 'blackliste'}
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => { setSelectedClientId(c.id); setClientQuery(''); setShowClientResults(false) }}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                        >
                          {c.status === 'blackliste' ? '⚠ ' : ''}{c.first_name} {c.last_name} — {c.phone}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Dossier incomplet — alerte + confirmation avant création (client existant) */}
            {missingFields.length > 0 && (
              <div className="flex items-start gap-3 rounded-md border border-orange-200 bg-orange-50 px-3 py-2.5">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-orange-500" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-orange-800">Dossier incomplet — impossibilité de louer</p>
                  <p className="mt-0.5 text-[11px] text-orange-600">Manquant : {missingFields.join(', ')}</p>
                  <label className="mt-2 flex cursor-pointer select-none items-start gap-2">
                    <input
                      type="checkbox"
                      checked={dossierConfirmed}
                      onChange={e => setDossierConfirmed(e.target.checked)}
                      className="mt-0.5 h-4 w-4 flex-shrink-0 accent-orange-600"
                    />
                    <span className="text-[11px] font-semibold text-orange-800">
                      Je confirme créer la réservation malgré le dossier incomplet
                    </span>
                  </label>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dates */}
        <Card>
          <CardHeader className="p-5 pb-0">
            <CardTitle className="text-base font-semibold">Dates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-5">
            <div>
              <Label className={labelClass}>Départ *</Label>
              <DateTimeField
                name="start_datetime"
                value={startDatetime}
                onChange={setStartDatetime}
                required
                grouped
              />
            </div>
            <div>
              <Label className={labelClass}>Retour *</Label>
              <DateTimeField
                name="end_datetime"
                value={endDatetime}
                onChange={setEndDatetime}
                required
                min={startDatetime}
                grouped
              />
            </div>
            <div>
              <Label className={labelClass}>Durée</Label>
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <Input
                    type="number" min="0" placeholder="0"
                    value={durDays || ''}
                    onChange={e => {
                      const d = Math.max(0, parseInt(e.target.value) || 0)
                      setDurDays(d)
                      setDuration(d * 24 + durHours)
                    }}
                  />
                  <span className="mt-0.5 block text-[10px] text-muted-foreground">jours</span>
                </div>
                <div className="flex-1">
                  <Input
                    type="number" min="0" max="23" placeholder="0"
                    value={durHours || ''}
                    onChange={e => {
                      const h = Math.min(23, Math.max(0, parseInt(e.target.value) || 0))
                      setDurHours(h)
                      setDuration(durDays * 24 + h)
                    }}
                  />
                  <span className="mt-0.5 block text-[10px] text-muted-foreground">heures</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tarification */}
      <Card>
        <CardHeader className="p-5 pb-0">
          <CardTitle className="text-base font-semibold">Tarification</CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label htmlFor="daily_price" className={labelClass}>Prix/jour (€) *</Label>
              <Input
                id="daily_price"
                type="number"
                name="daily_price"
                value={dailyPrice}
                onChange={e => setDailyPrice(e.target.value)}
                required
                step="0.01"
                min="0"
                inputMode="decimal"
                enterKeyHint="next"
              />
            </div>
            <div>
              <Label htmlFor="km_included" className={labelClass}>KM inclus/jour</Label>
              <Input
                id="km_included"
                type="number"
                name="km_included"
                defaultValue={selectedVehicle?.km_included_daily?.toString() ?? ''}
                inputMode="numeric"
                enterKeyHint="next"
              />
            </div>
            <div>
              <Label htmlFor="extra_km_price" className={labelClass}>Supplément KM (€/km)</Label>
              <Input
                id="extra_km_price"
                type="number"
                name="extra_km_price"
                defaultValue={selectedVehicle?.extra_km_price?.toString() ?? ''}
                step="0.01"
                inputMode="decimal"
                enterKeyHint="next"
              />
            </div>
            <div>
              <Label htmlFor="deposit_amount" className={labelClass}>Caution (€)</Label>
              <Input
                id="deposit_amount"
                type="number"
                name="deposit_amount"
                defaultValue={selectedVehicle?.deposit_amount?.toString() ?? ''}
                step="0.01"
                inputMode="decimal"
                enterKeyHint="next"
              />
            </div>
            <div>
              <Label htmlFor="deposit_method" className={labelClass}>Mode caution</Label>
              <select id="deposit_method" name="deposit_method" className={selectClass}>
                <option value="">— Choisir —</option>
                <option value="especes">Espèces</option>
                <option value="virement">Virement</option>
                <option value="cb">Carte bancaire</option>
                <option value="cheque">Chèque</option>
              </select>
            </div>
            <div>
              <Label htmlFor="deposit_ref" className={labelClass}>Référence caution</Label>
              <Input id="deposit_ref" type="text" name="deposit_ref" enterKeyHint="next" />
            </div>
            <div>
              <Label htmlFor="payment_amount" className={labelClass}>Acompte encaissé (€)</Label>
              <Input
                id="payment_amount"
                type="number"
                name="payment_amount"
                value={acompte}
                onChange={e => setAcompte(e.target.value)}
                step="0.01"
                min="0"
                placeholder="0"
                inputMode="decimal"
                enterKeyHint="done"
              />
            </div>
          </div>

          {/* Réduction manuelle (montant fixe en €), déduite du total */}
          <div className="mt-4">
            <Label htmlFor="discount_amount" className={labelClass}>Réduction (€)</Label>
            <Input
              id="discount_amount"
              type="number"
              name="discount_amount"
              value={discount}
              onChange={e => setDiscount(e.target.value)}
              step="0.01"
              min="0"
              placeholder="0"
              inputMode="decimal"
              enterKeyHint="done"
            />
          </div>

          {totalPrice > 0 && (
            <div className="mt-4 space-y-2 rounded-md border border-border bg-muted p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Total estimé ({days} jour{days > 1 ? 's' : ''})</span>
                <span className={discountNum > 0 ? 'text-base font-bold text-foreground line-through opacity-50' : 'text-xl font-bold text-foreground'}>{formatPrice(totalPrice)}</span>
              </div>
              {discountNum > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-green-700">Réduction</span>
                    <span className="text-sm font-bold text-green-700">− {formatPrice(discountNum)}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-border pt-2">
                    <span className="text-sm font-medium text-foreground">Total après réduction</span>
                    <span className="text-xl font-bold text-foreground">{formatPrice(netTotal)}</span>
                  </div>
                </>
              )}
              {Number(acompte) > 0 && (
                <div className="flex items-center justify-between border-t border-border pt-2">
                  <span className="text-sm font-medium text-muted-foreground">Reste à payer (acompte {formatPrice(Number(acompte))})</span>
                  <span className="text-lg font-bold text-foreground">{formatPrice(Math.max(0, netTotal - Number(acompte)))}</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader className="p-5 pb-0">
          <CardTitle className="text-base font-semibold">Notes internes</CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <Textarea
            name="internal_notes"
            rows={2}
            placeholder="Observations, demandes spéciales..."
            className="resize-none"
          />
        </CardContent>
      </Card>

      <p className="text-[11px] text-muted-foreground">* Champ obligatoire</p>
      <Button type="submit" disabled={pending || dossierBlocked} size="lg">
        {pending ? 'Création...' : 'Créer la réservation'}
      </Button>
    </form>
  )
}
