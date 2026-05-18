/**
 * Уровень по количеству поездок (`total_rides` в profiles) и среднему рейтингу.
 *
 * - 0–5 поездок → «Новичок»
 * - 6–20 → «Попутчик»
 * - 21–50 → «Штурман»
 * - более 50 и рейтинг ниже 4.8 → «Ветеран»
 * - более 50 и рейтинг ≥ 4.8 → «Легенда»
 */
export function calculateUserLevel(totalRides: number, averageRating: number): string {
  const rides = Math.max(0, Math.floor(totalRides))
  const rating = Number.isFinite(averageRating) ? averageRating : 5

  if (rides <= 5) return "Новичок"
  if (rides <= 20) return "Попутчик"
  if (rides <= 50) return "Штурман"
  if (rating >= 4.8) return "Легенда"
  return "Ветеран"
}

/** Уровень «Легенда»: более 50 поездок и средний рейтинг не ниже 4.8 */
export function isLegendLevel(totalRides: number, averageRating: number): boolean {
  return calculateUserLevel(totalRides, averageRating) === "Легенда"
}
