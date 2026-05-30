import { getSupabaseAdmin } from "@/lib/supabase-admin"

export const YOKASSA_ACCESS_PRICE = 300
export const YOKASSA_ACCESS_DURATION_HOURS = 24

export type DriverAccessRow = {
  id: string
  vk_id: string
  yokassa_payment_id: string
  amount: number
  status: "pending" | "paid"
  created_at: string
  paid_at: string | null
  expires_at: string | null
}

export async function hasActiveAccess(vkId: string): Promise<boolean> {
  const admin = getSupabaseAdmin()
  if (!admin) return false

  const now = new Date().toISOString()
  const { data, error } = await admin
    .from("driver_access_payments")
    .select("id")
    .eq("vk_id", vkId.toLowerCase())
    .eq("status", "paid")
    .gt("expires_at", now)
    .limit(1)

  if (error) {
    console.error("yokassa hasActiveAccess:", error)
    return false
  }

  return Array.isArray(data) && data.length > 0
}

export async function createAccessIntent(vkId: string, paymentId: string, amount: number) {
  const admin = getSupabaseAdmin()
  if (!admin) return { ok: false as const, error: "Supabase not configured" }

  const { error } = await admin.from("driver_access_payments").insert({
    vk_id: vkId.toLowerCase(),
    yokassa_payment_id: paymentId,
    amount,
    status: "pending",
  })

  if (error) {
    console.error("yokassa createAccessIntent:", error)
    return { ok: false as const, error: error.message }
  }

  return { ok: true as const }
}

export async function confirmPayment(paymentId: string): Promise<boolean> {
  const admin = getSupabaseAdmin()
  if (!admin) return false

  const expiresAt = new Date(
    Date.now() + YOKASSA_ACCESS_DURATION_HOURS * 60 * 60 * 1000
  ).toISOString()

  const { error, count } = await admin
    .from("driver_access_payments")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      expires_at: expiresAt,
    })
    .eq("yokassa_payment_id", paymentId)
    .eq("status", "pending")

  if (error) {
    console.error("yokassa confirmPayment:", error)
    return false
  }

  return true
}
