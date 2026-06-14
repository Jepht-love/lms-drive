'use client'

import DeleteButton from '@/components/ui/DeleteButton'
import { deleteReservation } from '@/lib/actions/delete'

export default function DeleteReservationButton({ reservationId, reservationNumber }: { reservationId: string; reservationNumber: string }) {
  return (
    <DeleteButton
      onConfirm={() => deleteReservation(reservationId)}
      label="Supprimer la réservation"
      confirmMessage={`Supprimer ${reservationNumber} ? Cette action est irréversible.`}
      variant="icon"
    />
  )
}
