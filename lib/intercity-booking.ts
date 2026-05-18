import type { SupabaseClient } from "@supabase/supabase-js"

export type RpcBookResult = { ok: boolean; err?: string }

export async function rpcBookIntercitySeat(
  supabase: SupabaseClient,
  rideId: number,
  passengerVkId: string
): Promise<RpcBookResult> {
  const { data, error } = await supabase.rpc("book_intercity_seat", {
    p_ride_id: rideId,
    p_passenger_vk_id: passengerVkId,
  })
  if (error) {
    console.error("book_intercity_seat", error)
    return { ok: false, err: "rpc" }
  }
  const row = data as { ok?: boolean; err?: string } | null
  if (!row || row.ok !== true) return { ok: false, err: row?.err || "unknown" }
  return { ok: true }
}

export async function rpcMarkBookingNoShow(
  supabase: SupabaseClient,
  bookingId: number,
  driverVkId: string
): Promise<RpcBookResult> {
  const { data, error } = await supabase.rpc("mark_booking_no_show", {
    p_booking_id: bookingId,
    p_driver_vk_id: driverVkId,
  })
  if (error) {
    console.error("mark_booking_no_show", error)
    return { ok: false, err: "rpc" }
  }
  const row = data as { ok?: boolean; err?: string } | null
  if (!row || row.ok !== true) return { ok: false, err: row?.err || "unknown" }
  return { ok: true }
}

export async function rpcAcceptCityRide(
  supabase: SupabaseClient,
  rideId: number,
  driverVkId: string
): Promise<RpcBookResult> {
  const { data, error } = await supabase.rpc("accept_city_ride", {
    p_ride_id: rideId,
    p_driver_vk_id: driverVkId,
  })
  if (error) {
    // Function is not deployed yet on some environments.
    if ((error.code || "").trim() === "PGRST202") {
      return { ok: false, err: "missing_fn" }
    }
    console.error("accept_city_ride", error)
    return { ok: false, err: "rpc" }
  }
  const row = data as { ok?: boolean; err?: string } | null
  if (!row || row.ok !== true) return { ok: false, err: row?.err || "unknown" }
  return { ok: true }
}

export type BookedPassengerRow = {
  bookingId: number
  passengerVkId: string
  createdAt: string
  totalRides: number
  averageRating: number
}

export async function fetchBookedPassengersForRide(
  supabase: SupabaseClient,
  rideId: number
): Promise<BookedPassengerRow[]> {
  const { data: bookings, error: bErr } = await supabase
    .from("bookings")
    .select("id, passenger_vk_id, created_at")
    .eq("ride_id", rideId)
    .eq("status", "booked")
    .order("created_at", { ascending: true })

  if (bErr || !bookings?.length) return []

  const tags = [...new Set(bookings.map((b) => b.passenger_vk_id as string))]
  const { data: profiles } = await supabase
    .from("profiles")
    .select("vk_id, total_rides, average_rating")
    .in("vk_id", tags)

  const profMap = new Map<string, { total_rides: number; average_rating: number }>()
  for (const p of profiles || []) {
    profMap.set(p.vk_id as string, {
      total_rides: Number(p.total_rides) || 0,
      average_rating: Number(p.average_rating) || 5,
    })
  }

  return bookings.map((b) => {
    const pr = profMap.get(b.passenger_vk_id as string)
    return {
      bookingId: b.id as number,
      passengerVkId: b.passenger_vk_id as string,
      createdAt: b.created_at as string,
      totalRides: pr?.total_rides ?? 0,
      averageRating: pr?.average_rating ?? 5,
    }
  })
}
