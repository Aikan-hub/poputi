"use client"

import { useCallback, useEffect, useState } from "react"
import { Car } from "lucide-react"
import { supabase } from "@/lib/supabase-client"
import {
  bookErrorMessage,
  fetchBookedPassengersForRide,
  fetchViewerBookingId,
  rpcCancelIntercityBooking,
  type BookedPassengerRow,
} from "@/lib/intercity-booking"

const PASSENGER_SLOT_COUNT = 4

export type IntercitySeatBookRide = {
  id: number
  name?: string
  avatar?: string
  car?: string
  from_location?: string
  to_location?: string
  vk_id?: string
  total_seats?: number
  available_seats?: number
  rating?: number
}

function passengerShortLabel(vkTag: string): string {
  const id = vkTag.replace(/^id/i, "")
  return id ? `id${id}` : "Пассажир"
}

function AvatarBubble({
  label,
  photoUrl,
  size = "md",
  ringClass = "ring-[#2787F5]/30",
}: {
  label: string
  photoUrl?: string | null
  size?: "md" | "lg"
  ringClass?: string
}) {
  const dim = size === "lg" ? "h-16 w-16 text-lg" : "h-12 w-12 text-sm"
  if (photoUrl && photoUrl.startsWith("http")) {
    return (
      <img
        src={photoUrl}
        alt=""
        className={`${dim} shrink-0 rounded-full object-cover ring-2 ${ringClass}`}
      />
    )
  }
  const initials = label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("")
  return (
    <div
      className={`${dim} flex shrink-0 items-center justify-center rounded-full bg-[#2787F5] font-semibold text-white ring-2 ${ringClass}`}
    >
      {initials || "?"}
    </div>
  )
}

export function IntercitySeatBookModal({
  ride,
  viewerVkTag,
  onClose,
  onConfirm,
  onCancelled,
}: {
  ride: IntercitySeatBookRide
  viewerVkTag: string
  onClose: () => void
  onConfirm: () => { ok: boolean; err?: string } | Promise<{ ok: boolean; err?: string }>
  onCancelled?: () => void | Promise<void>
}) {
  const [rows, setRows] = useState<BookedPassengerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [bookError, setBookError] = useState<string | null>(null)
  const [myBookingId, setMyBookingId] = useState<number | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    const [list, bookingId] = await Promise.all([
      fetchBookedPassengersForRide(supabase, ride.id),
      fetchViewerBookingId(supabase, ride.id, viewerVkTag),
    ])
    setRows(list.slice(0, PASSENGER_SLOT_COUNT))
    setMyBookingId(bookingId)
    setLoading(false)
  }, [ride.id, viewerVkTag])

  useEffect(() => {
    void reload()
  }, [reload])

  const driverName = ride.name?.trim() || "Водитель"
  const isOwner = ride.vk_id && viewerVkTag === ride.vk_id
  const available = Math.max(0, Math.floor(ride.available_seats ?? 0))
  const canBook = !isOwner && available > 0 && !loading

  const slotOccupants: (BookedPassengerRow | null)[] = Array.from({ length: PASSENGER_SLOT_COUNT }, (_, i) => rows[i] ?? null)

  const handleConfirm = async () => {
    if (!canBook || confirming) return
    setConfirming(true)
    setBookError(null)
    try {
      const result = await onConfirm()
      if (!result.ok) {
        setBookError(bookErrorMessage(result.err))
      } else {
        await reload()
      }
    } finally {
      setConfirming(false)
    }
  }

  const handleCancelBooking = async () => {
    if (!myBookingId || cancelling) return
    setCancelling(true)
    setBookError(null)
    const res = await rpcCancelIntercityBooking(supabase, myBookingId, viewerVkTag)
    setCancelling(false)
    if (!res.ok) {
      setBookError(bookErrorMessage(res.err))
      return
    }
    await reload()
    await onCancelled?.()
  }

  return (
    <div className="absolute inset-0 z-[60] flex items-end bg-gray-900/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="max-h-[92%] w-full animate-in slide-in-from-bottom overflow-y-auto rounded-t-[2rem] bg-white shadow-[0_-10px_40px_rgba(0,0,0,0.1)] duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-gray-200" />
          <div className="mb-1 flex items-center gap-2">
            <Car className="h-5 w-5 text-[#2787F5]" />
            <h2 className="text-lg font-bold text-gray-900">Схема салона</h2>
          </div>
          <p className="mb-4 text-sm text-gray-500">
            {(ride.from_location || "—") + " → " + (ride.to_location || "—")}
          </p>

          <div className="relative rounded-2xl border border-gray-200 bg-gradient-to-b from-gray-100 to-gray-200 p-4 shadow-inner">
            <p className="mb-3 text-center text-[11px] font-medium uppercase tracking-wide text-gray-500">
              вид сверху · вперёд ↑
            </p>

            <div className="mb-3 grid grid-cols-2 gap-3">
              <div className="flex flex-col items-center rounded-xl bg-white/90 p-3 shadow-sm ring-1 ring-[#2787F5]/25">
                <span className="mb-2 text-[10px] font-semibold uppercase text-[#2787F5]">Водитель</span>
                <AvatarBubble label={driverName} photoUrl={ride.avatar} size="lg" ringClass="ring-[#2787F5]/40" />
                <p className="mt-2 max-w-full truncate text-center text-sm font-semibold text-gray-900">{driverName}</p>
                <p className="text-xs text-gray-500">★ {(ride.rating ?? 5).toFixed(1)}</p>
              </div>

              <SeatCard
                title="Переднее справа"
                occupant={slotOccupants[0]}
                loading={loading}
              />
            </div>

            <p className="mb-2 text-center text-[10px] font-medium uppercase text-gray-500">Задний ряд</p>
            <div className="grid grid-cols-3 gap-2">
              <SeatCard title="Слева" occupant={slotOccupants[1]} loading={loading} />
              <SeatCard title="Центр" occupant={slotOccupants[2]} loading={loading} />
              <SeatCard title="Справа" occupant={slotOccupants[3]} loading={loading} />
            </div>

            <div className="pointer-events-none absolute left-1/2 top-8 h-[72%] w-[46%] -translate-x-1/2 rounded-[40%] border border-dashed border-gray-400/60" aria-hidden />
          </div>

          <p className="mt-3 text-center text-sm text-gray-900">
            Свободно мест: <span className="font-semibold text-[#2787F5]">{available}</span> из{" "}
            {Math.min(PASSENGER_SLOT_COUNT, ride.total_seats ?? PASSENGER_SLOT_COUNT)}
          </p>
          {isOwner && <p className="mt-1 text-center text-xs text-red-600">Это ваша поездка — бронирование недоступно.</p>}
          {!isOwner && available === 0 && (
            <p className="mt-1 text-center text-xs text-red-600">Мест больше нет.</p>
          )}
          {bookError && (
            <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-center text-sm text-red-600">{bookError}</p>
          )}

          {myBookingId && !isOwner && (
            <button
              type="button"
              disabled={cancelling}
              onClick={() => void handleCancelBooking()}
              className="mt-4 w-full rounded-xl bg-red-50 py-2.5 text-sm font-semibold text-red-600 active:bg-red-100 disabled:opacity-50"
            >
              {cancelling ? "Отмена…" : "Отменить мою бронь"}
            </button>
          )}

          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl bg-gray-100 py-3 font-medium text-gray-900 active:bg-gray-200"
            >
              Закрыть
            </button>
            <button
              type="button"
              disabled={!canBook || confirming || !!myBookingId}
              onClick={() => void handleConfirm()}
              className="flex-1 rounded-xl bg-[#2787F5] py-3 font-semibold text-white shadow-lg shadow-[#2787F5]/30 active:bg-[#1F6AD8] disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none"
            >
              {confirming ? "Бронируем…" : myBookingId ? "Уже забронировано" : "Забронировать"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SeatCard({
  title,
  occupant,
  loading,
}: {
  title: string
  occupant: BookedPassengerRow | null
  loading: boolean
}) {
  return (
    <div className="flex min-h-[118px] flex-col items-center rounded-xl bg-white/90 p-2 shadow-sm ring-1 ring-gray-200">
      <span className="mb-1.5 text-[9px] font-semibold uppercase leading-tight text-gray-500">{title}</span>
      {loading ? (
        <div className="flex flex-1 items-center justify-center text-xs text-gray-500">…</div>
      ) : occupant ? (
        <>
          <AvatarBubble
            label={passengerShortLabel(occupant.passengerVkId)}
            size="md"
            ringClass="ring-[#2787F5]/35"
          />
          <p className="mt-1.5 max-w-full truncate text-center text-[11px] font-medium text-gray-900">
            {passengerShortLabel(occupant.passengerVkId)}
          </p>
          <p className="text-[10px] text-gray-500">★ {occupant.averageRating.toFixed(1)}</p>
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed border-gray-300 bg-gray-50">
            <span className="text-lg text-gray-300">+</span>
          </div>
          <span className="text-[11px] font-medium text-gray-500">Свободно</span>
        </div>
      )}
    </div>
  )
}
