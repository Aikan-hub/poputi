import type { SupabaseClient } from "@supabase/supabase-js"
import { averageFromReviewRatings } from "@/lib/profile-rating"

export interface UserProfileRow {
  vk_id: string
  total_rides: number
  average_rating: number
}

async function getProfile(supabase: SupabaseClient, vkId: string): Promise<UserProfileRow | null> {
  const { data, error } = await supabase.from("profiles").select("vk_id, total_rides, average_rating").eq("vk_id", vkId).maybeSingle()
  if (error || !data) return null
  return data as UserProfileRow
}

async function upsertProfilePartial(
  supabase: SupabaseClient,
  vkId: string,
  patch: Partial<Pick<UserProfileRow, "total_rides" | "average_rating">>
) {
  const existing = await getProfile(supabase, vkId)
  const row: UserProfileRow = {
    vk_id: vkId,
    total_rides: patch.total_rides ?? existing?.total_rides ?? 0,
    average_rating: patch.average_rating ?? existing?.average_rating ?? 5,
  }
  const { error } = await supabase.from("profiles").upsert(
    {
      vk_id: row.vk_id,
      total_rides: row.total_rides,
      average_rating: row.average_rating,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "vk_id" }
  )
  return error
}

/** Средняя оценка по всем отзывам на пользователя. Без отзывов — null. */
export async function computeAverageRatingForTarget(
  supabase: SupabaseClient,
  targetVkId: string
): Promise<number | null> {
  const { data, error } = await supabase.from("reviews").select("rating").eq("target_vk_id", targetVkId)
  if (error || !data?.length) return null
  const ratings = data.map((r: { rating: number }) => Number(r.rating))
  return averageFromReviewRatings(ratings)
}

export async function bumpTotalRides(supabase: SupabaseClient, vkId: string): Promise<void> {
  const existing = await getProfile(supabase, vkId)
  const next = (existing?.total_rides ?? 0) + 1
  const avg = (await computeAverageRatingForTarget(supabase, vkId)) ?? 0
  await upsertProfilePartial(supabase, vkId, { total_rides: next, average_rating: avg })
}

export function buildReviewChatMessage(rating: number, comment: string): string {
  const c = comment.trim()
  if (c) {
    return `Оставил(а) оценку: ${rating}⭐. Комментарий: ${c}`
  }
  return `Оставил(а) оценку: ${rating}⭐.`
}

export async function submitRideReview(params: {
  supabase: SupabaseClient
  rideId: number
  reviewerVkId: string
  targetVkId: string
  rating: number
  comment: string
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const { supabase, rideId, reviewerVkId, targetVkId, rating, comment } = params

  const { error: insErr } = await supabase.from("reviews").insert({
    ride_id: rideId,
    reviewer_vk_id: reviewerVkId,
    target_vk_id: targetVkId,
    rating,
    comment: comment.trim() || null,
  })

  if (insErr) {
    if (insErr.code === "23505") {
      return { ok: false, message: "Вы уже оставили отзыв по этой поездке." }
    }
    return { ok: false, message: insErr.message || "Не удалось сохранить отзыв." }
  }

  await bumpTotalRides(supabase, reviewerVkId)
  await bumpTotalRides(supabase, targetVkId)

  const newAvgTarget = await computeAverageRatingForTarget(supabase, targetVkId)
  const newAvgReviewer = await computeAverageRatingForTarget(supabase, reviewerVkId)
  const targetProf = await getProfile(supabase, targetVkId)
  const reviewerProf = await getProfile(supabase, reviewerVkId)

  await upsertProfilePartial(supabase, targetVkId, {
    total_rides: targetProf?.total_rides,
    average_rating: newAvgTarget ?? 0,
  })
  await upsertProfilePartial(supabase, reviewerVkId, {
    total_rides: reviewerProf?.total_rides,
    average_rating: newAvgReviewer ?? 0,
  })

  return { ok: true }
}
