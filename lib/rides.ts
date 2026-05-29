import type { SupabaseClient } from "@supabase/supabase-js"

/** 3 часа — срок «жизни» обычной заявки на карте / в межгороде. */
export const RIDE_ACTIVE_MS = 3 * 60 * 60 * 1000

/** Статусы, которые удаляем из БД после истечения 3 ч (активные поездки не трогаем). */
const PURGEABLE_EXPIRED_STATUSES = ["searching", "open", "cancelled", "completed"] as const

export function expiredRidesBoundaryIso(): string {
  return new Date(Date.now() - RIDE_ACTIVE_MS).toISOString()
}

const PERSISTENT_TYPES = new Set(["Static", "AdminPoint"])

export function isPersistentRideType(type: string | null | undefined): boolean {
  if (!type) return false
  return PERSISTENT_TYPES.has(type.trim())
}

/** Учитывается ли возраст заявки для авто-скрытия / очистки по таймеру. */
export function isRideExpiredByPolicy(createdAt: string, type: string | null | undefined): boolean {
  if (isPersistentRideType(type)) return false
  const created = new Date(createdAt).getTime()
  return Number.isFinite(created) && Date.now() - created >= RIDE_ACTIVE_MS
}

export function isRideWithinActiveWindow(createdAt: string, type: string | null | undefined): boolean {
  return !isRideExpiredByPolicy(createdAt, type)
}

/** Минут до снятия с карты (0 = кольцо серое, метку убираем). */
export function rideMapTimerMinutes(createdAt: string, type: string | null | undefined): number {
  if (isPersistentRideType(type)) return 180
  const created = new Date(createdAt).getTime()
  if (!Number.isFinite(created)) return 0
  const elapsedMin = Math.floor((Date.now() - created) / 60000)
  return Math.max(0, 180 - elapsedMin)
}

export function isRideVisibleOnMap(
  createdAt: string,
  type: string | null | undefined,
  status: string | null | undefined
): boolean {
  if (isPersistentRideType(type)) return true
  if (!isRideExpiredByPolicy(createdAt, type)) return true
  const st = (status || "").trim().toLowerCase()
  return st === "accepted" || st === "arrived" || st === "in_transit"
}

/** Удаляет из Supabase заявки старше 3 ч (кроме Static/AdminPoint и активных поездок). */
export async function purgeExpiredRides(
  supabase: SupabaseClient,
  options?: { city?: string }
): Promise<{ error: string | null }> {
  const boundary = expiredRidesBoundaryIso()
  let query = supabase
    .from("rides")
    .delete()
    .lt("created_at", boundary)
    .in("status", [...PURGEABLE_EXPIRED_STATUSES])
    .not("type", "eq", "Static")
    .not("type", "eq", "AdminPoint")

  if (options?.city) {
    query = query.eq("city", options.city)
  }

  const { error } = await query
  if (error) {
    console.warn("purgeExpiredRides", error.message)
    return { error: error.message }
  }
  return { error: null }
}
