export type RideStatus = "searching" | "accepted" | "in_transit" | "completed" | "cancelled"

export const RIDE_STATUSES: RideStatus[] = ["searching", "accepted", "in_transit", "completed", "cancelled"]

export const statusLabel: Record<RideStatus, string> = {
  searching: "В поиске",
  accepted: "Водитель найден",
  in_transit: "В пути",
  completed: "Завершено",
  cancelled: "Отменена",
}

export const statusIcon: Record<RideStatus, "search" | "check" | "car" | "flag" | "ban"> = {
  searching: "search",
  accepted: "check",
  in_transit: "car",
  completed: "flag",
  cancelled: "ban",
}

export function isActiveStatus(status: RideStatus | null | undefined): boolean {
  if (!status) return false
  return status === "searching" || status === "accepted" || status === "in_transit"
}

export function canPassengerCancel(status: RideStatus | null | undefined): boolean {
  return status === "searching" || status === "accepted"
}

export function canDriverTake(status: RideStatus | null | undefined): boolean {
  return status === "searching"
}

export function canDriverStart(status: RideStatus | null | undefined, isDriver: boolean): boolean {
  return isDriver && status === "accepted"
}

export function canDriverComplete(status: RideStatus | null | undefined, isDriver: boolean): boolean {
  return isDriver && status === "in_transit"
}
