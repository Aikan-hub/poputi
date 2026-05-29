/** Средняя оценка только по фактическим отзывам (1–5). Без отзывов — null. */
export function averageFromReviewRatings(ratings: number[]): number | null {
  const valid = ratings.filter((r) => r >= 1 && r <= 5)
  if (valid.length === 0) return null
  const sum = valid.reduce((acc, r) => acc + r, 0)
  return Math.round((sum / valid.length) * 10) / 10
}

/** Для уровня: без отзывов рейтинг не завышает «Легенду». */
export function ratingForLevel(average: number | null): number {
  return average ?? 0
}

export function formatRatingDisplay(average: number | null): string {
  return average == null ? "—" : average.toFixed(1)
}

export function filledStarCount(average: number | null): number {
  if (average == null) return 0
  return Math.max(0, Math.min(5, Math.round(average)))
}

export function hasHighRating(average: number | null, reviewsCount: number): boolean {
  return reviewsCount > 0 && average != null && average >= 4.8
}
