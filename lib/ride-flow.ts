import type { SupabaseClient } from "@supabase/supabase-js"

import { appendThreadMessage, ensureChatThread } from "@/lib/chats-db"

export type RideOfferPayload = {
  rideId: number
  passengerVkId: string
  driverVkId: string
  driverName: string
  driverAvatar?: string | null
  driverCar?: string | null
  driverRating?: number | null
  pickupEtaMin?: number | null
  basePrice: number
  priceDelta: number
  from?: string | null
  to?: string | null
}

export type RideOfferMessageMetadata = {
  kind: "ride_offer"
  offerId: number
  rideId: number
  driverVkId: string
  passengerVkId: string
  driverName: string
  driverAvatarUrl?: string | null
  driverCar?: string | null
  driverRating?: number | null
  pickupEtaMin?: number | null
  price: number
  status: "pending" | "accepted" | "rejected" | "cancelled"
  from?: string | null
  to?: string | null
}

export async function createRideOffer(
  supabase: SupabaseClient,
  payload: RideOfferPayload
): Promise<{ ok: true; offerId: number } | { ok: false; message: string }> {
  const price = Math.max(0, Math.round(payload.basePrice + payload.priceDelta))
  const insertPayload = {
    ride_id: payload.rideId,
    passenger_vk_id: payload.passengerVkId,
    driver_vk_id: payload.driverVkId,
    price,
    price_delta: payload.priceDelta,
    status: "pending",
    driver_name: payload.driverName,
    driver_avatar: payload.driverAvatar ?? null,
    driver_car: payload.driverCar ?? null,
    driver_rating: payload.driverRating ?? null,
    pickup_eta_min: payload.pickupEtaMin ?? null,
  }

  const { data, error } = await supabase
    .from("ride_offers")
    .insert(insertPayload)
    .select("id")
    .single()

  if (error || !data?.id) {
    return { ok: false, message: error?.message || "Не удалось отправить отклик" }
  }

  const metadata: RideOfferMessageMetadata = {
    kind: "ride_offer",
    offerId: Number(data.id),
    rideId: payload.rideId,
    driverVkId: payload.driverVkId,
    passengerVkId: payload.passengerVkId,
    driverName: payload.driverName,
    driverAvatarUrl: payload.driverAvatar ?? null,
    driverCar: payload.driverCar ?? "Авто",
    driverRating: payload.driverRating ?? 5,
    pickupEtaMin: payload.pickupEtaMin ?? 7,
    price,
    status: "pending",
    from: payload.from ?? null,
    to: payload.to ?? null,
  }

  const threadId = await ensureChatThread(supabase, payload.driverVkId, payload.passengerVkId, {
    [payload.driverVkId]: payload.driverName,
    [payload.passengerVkId]: "Пассажир",
  })
  if (threadId) {
    await appendThreadMessage(
      supabase,
      threadId,
      payload.driverVkId,
      `Отклик на поездку: ${metadata.from || "—"} → ${metadata.to || "—"} за ${price} ₽`,
      metadata
    )
  }

  return { ok: true, offerId: Number(data.id) }
}

export async function acceptRideOffer(
  supabase: SupabaseClient,
  offerId: number,
  passengerVkId: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc("accept_ride_offer", {
    p_offer_id: offerId,
    p_passenger_vk_id: passengerVkId,
  })
  if (!error && (data as { ok?: boolean } | null)?.ok) return true

  const { data: offer } = await supabase
    .from("ride_offers")
    .select("id, ride_id, driver_vk_id, passenger_vk_id, price, status")
    .eq("id", offerId)
    .eq("passenger_vk_id", passengerVkId)
    .eq("status", "pending")
    .maybeSingle()

  if (!offer) return false

  const rideId = Number(offer.ride_id)
  const driverVkId = String(offer.driver_vk_id)
  const price = Number(offer.price) || 0

  const { error: rideErr } = await supabase
    .from("rides")
    .update({ status: "accepted", partner_vk_id: driverVkId, driver_id: driverVkId, price })
    .eq("id", rideId)
    .eq("vk_id", passengerVkId)
    .in("status", ["searching", "open"])

  if (rideErr) return false

  await supabase.from("ride_offers").update({ status: "accepted" }).eq("id", offerId)
  await supabase
    .from("ride_offers")
    .update({ status: "rejected" })
    .eq("ride_id", rideId)
    .neq("id", offerId)
    .eq("status", "pending")

  return true
}

export async function rejectRideOffer(
  supabase: SupabaseClient,
  offerId: number,
  passengerVkId: string
): Promise<boolean> {
  const { error } = await supabase
    .from("ride_offers")
    .update({ status: "rejected" })
    .eq("id", offerId)
    .eq("passenger_vk_id", passengerVkId)
    .eq("status", "pending")
  return !error
}

export function openRideNavigator(params: {
  fromLat?: number | null
  fromLng?: number | null
  toLat?: number | null
  toLng?: number | null
  toText?: string | null
}) {
  const toLat = params.toLat ?? params.fromLat
  const toLng = params.toLng ?? params.fromLng
  const label = encodeURIComponent(params.toText || "Точка поездки")
  const urls: string[] = []

  if (toLat != null && toLng != null && Number.isFinite(toLat) && Number.isFinite(toLng)) {
    urls.push(`yandexnavi://build_route_on_map?lat_to=${toLat}&lon_to=${toLng}`)
    urls.push(`dgis://2gis.ru/routeSearch/rsType/car/to/${toLng},${toLat}`)
    urls.push(`https://yandex.ru/maps/?rtext=~${toLat},${toLng}&rtt=auto`)
  } else if (params.toText?.trim()) {
    urls.push(`https://yandex.ru/maps/?text=${label}`)
    urls.push(`https://2gis.ru/search/${label}`)
  }

  const [primary, fallback] = urls
  if (!primary) return
  window.location.href = primary
  if (fallback) {
    window.setTimeout(() => {
      window.location.href = fallback
    }, 900)
  }
}
