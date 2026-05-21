export type RideStatus = "searching" | "accepted" | "arrived" | "in_transit" | "completed" | "cancelled"

export const RIDE_STATUSES: RideStatus[] = ["searching", "accepted", "arrived", "in_transit", "completed", "cancelled"]

export const statusLabel: Record<RideStatus, string> = {
  searching: "В поиске",
  accepted: "Водитель найден",
  arrived: "Водитель на месте",
  in_transit: "В пути",
  completed: "Завершено",
  cancelled: "Отменена",
}

export const statusIcon: Record<RideStatus, "search" | "check" | "pin" | "car" | "flag" | "ban"> = {
  searching: "search",
  accepted: "check",
  arrived: "pin",
  in_transit: "car",
  completed: "flag",
  cancelled: "ban",
}

export function isActiveStatus(status: RideStatus | null | undefined): boolean {
  if (!status) return false
  return status === "searching" || status === "accepted" || status === "arrived" || status === "in_transit"
}

export function canPassengerCancel(status: RideStatus | null | undefined): boolean {
  return status === "searching" || status === "accepted"
}

export function canDriverTake(status: RideStatus | null | undefined): boolean {
  return status === "searching"
}

export function canDriverStart(status: RideStatus | null | undefined, isDriver: boolean): boolean {
  return isDriver && (status === "accepted" || status === "arrived")
}

export function canDriverComplete(status: RideStatus | null | undefined, isDriver: boolean): boolean {
  return isDriver && status === "in_transit"
}

export function canDriverArrive(status: RideStatus | null | undefined, isDriver: boolean): boolean {
  return isDriver && status === "accepted"
}

/** Приводит legacy-статусы из старой БД к актуальным значениям приложения. */
export function normalizeRideStatus(raw: string | null | undefined): RideStatus {
  const s = (raw ?? "").trim()
  if (!s || s === "open") return "searching"
  if (s === "in_progress") return "accepted"
  if ((RIDE_STATUSES as readonly string[]).includes(s)) return s as RideStatus
  return "searching"
}
