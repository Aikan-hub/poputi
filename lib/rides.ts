/** 3 часа — срок «жизни» обычной заявки на карте / в межгороде. */
export const RIDE_ACTIVE_MS = 3 * 60 * 60 * 1000

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
