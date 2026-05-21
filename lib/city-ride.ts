import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Tries to atomically assign a City ride to a driver.
 * Mirrors the in-app fallback logic with extra resilience for old schemas (no status column).
 */
export async function tryCityPickupFallback(
  supabase: SupabaseClient,
  rideId: number,
  driverTag: string
): Promise<boolean> {
  const tryWithPayload = async (payload: Record<string, unknown>) => {
    const { data, error } = await supabase
      .from("rides")
      .update(payload)
      .eq("id", rideId)
      .eq("type", "City")
      .eq("status", "searching")
      .select("id")
    return { rows: data, err: error }
  }

  // 1) Primary: set status + partner (preferred, modern schema)
  let { rows, err } = await tryWithPayload({ status: "accepted", partner_vk_id: driverTag, driver_id: driverTag })

  // 2) If column status is missing (old DB without migration), retry without touching status
  const statusMissing =
    err &&
    ((err as { code?: string; message?: string }).code === "42703" ||
      (err as { message?: string }).message?.toLowerCase().includes("status"))
  if (statusMissing) {
    const second = await tryWithPayload({ partner_vk_id: driverTag })
    rows = second.rows
    err = second.err
  }

  // 3) If still nothing and status exists, try partner null fallback (race-y cases)
  if ((err || !rows?.length) && !statusMissing) {
    const third = await supabase
      .from("rides")
      .update({ status: "accepted", partner_vk_id: driverTag, driver_id: driverTag })
      .eq("id", rideId)
      .eq("type", "City")
      .is("partner_vk_id", null)
      .select("id")
    rows = third.data
    err = third.error
  }

  if (err || !rows?.length) return false
  return true
}
