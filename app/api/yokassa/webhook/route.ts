import { NextResponse } from "next/server"
import { confirmPayment } from "@/lib/yokassa-access"
import type { YookassaPaymentStatus } from "@/lib/yokassa"

type WebhookEvent = {
  type: string
  event: string
  object: {
    id: string
    status: YookassaPaymentStatus
    amount: { value: string; currency: string }
    paid: boolean
    metadata?: Record<string, string>
  }
}

export async function POST(req: Request) {
  let event: WebhookEvent
  try {
    event = (await req.json()) as WebhookEvent
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }

  if (event.event !== "payment.succeeded") {
    return NextResponse.json({ ok: true })
  }

  const paymentId = event.object?.id
  if (!paymentId) {
    return NextResponse.json({ ok: true })
  }

  const metadata = event.object.metadata || {}
  if (metadata.type !== "driver_access") {
    return NextResponse.json({ ok: true })
  }

  await confirmPayment(paymentId)

  return NextResponse.json({ ok: true })
}
