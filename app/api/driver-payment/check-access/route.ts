import { NextResponse } from "next/server"

import { getSupabaseAdmin } from "@/lib/supabase-admin"

const VK_TAG = /^id\d+$/i

/** Есть ли у пользователя подтверждённая оплата (любой успешный invoice). */
export async function GET(req: Request) {
  const admin = getSupabaseAdmin()
  if (!admin) {
    return NextResponse.json({ ok: false, hasPaidAccess: false, message: "Сервер не настроен" }, { status: 503 })
  }

  const { searchParams } = new URL(req.url)
  const vkTag = (searchParams.get("vkTag") || "").trim()
  if (!VK_TAG.test(vkTag)) {
    return NextResponse.json({ ok: false, hasPaidAccess: false, message: "Некорректный vkTag" }, { status: 400 })
  }

  const normalized = vkTag.toLowerCase().startsWith("id") ? vkTag : `id${vkTag}`

  const { data, error } = await admin
    .from("driver_payment_intents")
    .select("invoice_id")
    .eq("vk_id", normalized)
    .eq("status", "paid")
    .limit(1)

  if (error) {
    console.error("driver_payment check-access", error)
    return NextResponse.json({ ok: false, hasPaidAccess: false }, { status: 500 })
  }

  const hasPaidAccess = Array.isArray(data) && data.length > 0
  return NextResponse.json({ ok: true, hasPaidAccess })
}
