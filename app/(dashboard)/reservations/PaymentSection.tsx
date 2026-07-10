'use client'

import { useState } from 'react'
import SendPaymentEmailButton from './SendPaymentEmailButton'
import PaymentCountdown from './PaymentCountdown'

interface Props {
  reservationId: string
  clientEmail: string | null
  clientName: string
  reservationNumber: string
  initialDeadline: string | null
}

export default function PaymentSection(props: Props) {
  const [deadline, setDeadline] = useState<string | null>(props.initialDeadline)

  if (!props.clientEmail) return null

  return (
    <>
      {deadline && (
        <PaymentCountdown reservationId={props.reservationId} deadline={deadline} />
      )}

      {!deadline && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <SendPaymentEmailButton
            reservationId={props.reservationId}
            clientEmail={props.clientEmail}
            clientName={props.clientName}
            reservationNumber={props.reservationNumber}
            onDeadlineSet={setDeadline}
          />
        </div>
      )}
    </>
  )
}
