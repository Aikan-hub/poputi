import { RIDE_ACTIVE_MS } from "@/lib/rides"

/** Пульсация «радара» только в первые 10 минут после создания */
export const CITY_RADAR_PULSE_MS = 10 * 60 * 1000

/** 0 — только что создана, 1 — конец окна активности (3 ч) */
export function cityRideTimeProgress(createdAt: string): number {
  const t0 = new Date(createdAt).getTime()
  if (!Number.isFinite(t0)) return 0
  const elapsed = Math.max(0, Date.now() - t0)
  return Math.min(1, elapsed / RIDE_ACTIVE_MS)
}

/**
 * Цвет маркера City: от ярко-зелёного к очень тёмно-красному за 3 часа.
 */
export function cityRadarMarkerColor(progress: number): string {
  const p = Math.min(1, Math.max(0, progress))
  // #22c55e → #2a0808
  const r = Math.round(34 + (42 - 34) * p)
  const g = Math.round(197 + (8 - 197) * p)
  const b = Math.round(94 + (8 - 94) * p)
  return `rgb(${r},${g},${b})`
}

export function shouldPulseCityRadar(rideType: string | null | undefined, createdAt: string): boolean {
  if ((rideType || "").trim() !== "City") return false
  const t0 = new Date(createdAt).getTime()
  if (!Number.isFinite(t0)) return false
  return Date.now() - t0 < CITY_RADAR_PULSE_MS
}
