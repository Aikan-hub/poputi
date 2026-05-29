/** Заявка пассажира по городу (не водитель на линии). */
export function isCityPassengerRide(type: string | null | undefined): boolean {
  const t = (type || "").trim()
  if (t === "Driver" || t === "Static" || t === "AdminPoint") return false
  return t === "City" || t === "Passenger" || !t
}

export function passengerSeatCountFromRide(ride: {
  total_seats?: number | null
  seats?: number | null
  type?: string | null
} | null | undefined): number {
  if (!ride || !isCityPassengerRide(ride.type)) return 1
  const raw = ride.total_seats ?? ride.seats ?? 1
  const n = Math.floor(Number(raw))
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.min(4, n)
}

export function formatPassengerSeatsLabel(count: number): string {
  const n = Math.min(4, Math.max(1, Math.floor(count) || 1))
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return `${n} место`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${n} места`
  return `${n} мест`
}
