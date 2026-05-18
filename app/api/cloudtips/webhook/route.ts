import { NextResponse } from "next/server"

import {
  isCloudtipsSuccess,
  parseCloudtipsFormBody,
  verifyCloudtipsWebhookSignature,
} from "@/lib/cloudtips-webhook"
import { DRIVER_ACCESS_AMOUNT, DRIVER_CLOUDTIPS_LAYOUT_ID } from "@/lib/driver-payment-config"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

/** CloudTips ожидает JSON { "code": 0 } и HTTP 200. */
function cloudtipsAck() {
  return NextResponse.json({ code: 0 }, { status: 200 })
}

export async function POST(req: Request) {
  const secret = process.env.CLOUDTIPS_WEBHOOK_SECRET
  const rawBody = await req.text()
  const hmacHeader = req.headers.get("x-content-hmac")

  if (!secret) {
    console.error("CLOUDTIPS_WEBHOOK_SECRET is not set")
    return cloudtipsAck()
  }

  if (!verifyCloudtipsWebhookSignature(rawBody, hmacHeader, secret)) {
    console.warn("CloudTips webhook: invalid HMAC")
    return cloudtipsAck()
  }

  const fields = parseCloudtipsFormBody(rawBody)
  if (!isCloudtipsSuccess(fields)) {
    return cloudtipsAck()
  }

  const layoutId = (fields.layoutid || "").toLowerCase()
  if (layoutId !== DRIVER_CLOUDTIPS_LAYOUT_ID.toLowerCase()) {
    return cloudtipsAck()
  }

  const invoiceId = (fields.invoiceid || "").trim()
  if (!invoiceId) {
    return cloudtipsAck()
  }

  const amount = Number.parseFloat(fields.amount || "")
  if (Number.isFinite(amount) && amount > 0 && amount < DRIVER_ACCESS_AMOUNT - 5) {
    // небольшой запас на комиссии/округление
    console.warn("CloudTips webhook: amount below threshold", amount)
    return cloudtipsAck()
  }

  const admin = getSupabaseAdmin()
  if (!admin) {
    console.error("Supabase admin missing on webhook")
    return cloudtipsAck()
  }

  const tx = (fields.transactionid || "").trim()
  const { error } = await admin
    .from("driver_payment_intents")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      transaction_id: tx || null,
      amount: Number.isFinite(amount) ? amount : null,
      currency: fields.currency || null,
    })
    .eq("invoice_id", invoiceId)
    .eq("status", "pending")

  if (error) {
    console.error("CloudTips webhook update", error)
  }

  return cloudtipsAck()
}
