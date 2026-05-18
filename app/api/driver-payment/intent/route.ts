import { randomUUID } from "crypto"
import { NextResponse } from "next/server"

import { driverCloudtipsPayUrl, DRIVER_CLOUDTIPS_LAYOUT_ID } from "@/lib/driver-payment-config"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

const VK_TAG = /^id\d+$/i

export async function POST(req: Request) {
  const admin = getSupabaseAdmin()
  if (!admin) {
    return NextResponse.json(
      { ok: false, message: "Сервер: задайте SUPABASE_SERVICE_ROLE_KEY в Vercel." },
      { status: 503 }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, message: "Некорректный JSON" }, { status: 400 })
  }

  const raw = typeof (body as { vkTag?: string }).vkTag === "string" ? (body as { vkTag: string }).vkTag.trim() : ""
  if (!VK_TAG.test(raw)) {
    return NextResponse.json({ ok: false, message: "Ожидается vkTag вида id123456" }, { status: 400 })
  }

  const vkId = raw.toLowerCase()

  const { data: existing } = await admin
    .from("driver_payment_intents")
    .select("invoice_id, status")
    .eq("vk_id", vkId)
    .order("created_at", { ascending: false })
    .limit(1)

  if (existing?.[0]?.status === "paid") {
    return NextResponse.json({ ok: false, message: "Доступ уже оплачен" }, { status: 409 })
  }

  const invoiceId = randomUUID()
  const { error } = await admin.from("driver_payment_intents").insert({
    invoice_id: invoiceId,
    vk_id: vkId,
    layout_id: DRIVER_CLOUDTIPS_LAYOUT_ID,
    status: "pending",
  })

  if (error) {
    console.error("driver_payment intent insert", error)
    return NextResponse.json({ ok: false, message: "Не удалось создать счёт" }, { status: 500 })
  }

  const payUrl = driverCloudtipsPayUrl(invoiceId)

  return NextResponse.json({ ok: true, invoiceId, payUrl })
}
