import { NextResponse } from "next/server"

import { getSupabaseAdmin } from "@/lib/supabase-admin"

export async function GET(req: Request) {
  const admin = getSupabaseAdmin()
  if (!admin) {
    return NextResponse.json({ ok: false, message: "Сервер не настроен" }, { status: 503 })
  }

  const { searchParams } = new URL(req.url)
  const invoiceId = (searchParams.get("invoiceId") || "").trim()
  if (!invoiceId) {
    return NextResponse.json({ ok: false, message: "Нет invoiceId" }, { status: 400 })
  }

  const { data, error } = await admin
    .from("driver_payment_intents")
    .select("status")
    .eq("invoice_id", invoiceId)
    .maybeSingle()

  if (error) {
    console.error("driver_payment status", error)
    return NextResponse.json({ ok: false, message: "Ошибка БД" }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ ok: true, status: "missing" as const, paid: false })
  }

  const paid = data.status === "paid"
  return NextResponse.json({
    ok: true,
    status: data.status as string,
    paid,
  })
}
