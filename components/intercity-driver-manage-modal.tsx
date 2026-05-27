"use client"

import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase-client"
import {
  fetchBookedPassengersForRide,
  rpcMarkBookingNoShow,
  type BookedPassengerRow,
} from "@/lib/intercity-booking"

export type IntercityManageRide = {
  id: number
  vk_id?: string
  total_seats?: number
  available_seats?: number
  from_location?: string
  to_location?: string
}

function passengerLabel(vkTag: string): string {
  const id = vkTag.replace(/^id/i, "")
  return id ? `Пользователь ${id}` : "Пассажир"
}

export function IntercityDriverManageModal({
  ride,
  driverVkTag,
  onClose,
  onUpdated,
}: {
  ride: IntercityManageRide
  driverVkTag: string
  onClose: () => void
  onUpdated: () => void | Promise<void>
}) {
  const [rows, setRows] = useState<BookedPassengerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)

  const total = Math.max(1, Math.floor(ride.total_seats ?? 4))

  const reload = useCallback(async () => {
    setLoading(true)
    const list = await fetchBookedPassengersForRide(supabase, ride.id)
    setRows(list)
    setLoading(false)
  }, [ride.id])

  useEffect(() => {
    void reload()
  }, [reload])

  const onNoShow = async (bookingId: number) => {
    if (busyId != null) return
    setBusyId(bookingId)
    const res = await rpcMarkBookingNoShow(supabase, bookingId, driverVkTag)
    setBusyId(null)
    if (res.ok) {
      await reload()
      await onUpdated()
    }
  }

  return (
    <div className="absolute inset-0 z-50 flex items-end bg-gray-900/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="max-h-[85%] w-full animate-in slide-in-from-bottom overflow-y-auto rounded-t-[2rem] bg-white shadow-[0_-10px_40px_rgba(0,0,0,0.1)] duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-gray-200" />
          <h2 className="mb-1 text-xl font-bold text-gray-900">Места в поездке</h2>
          <p className="mb-4 text-sm text-gray-500">
            {(ride.from_location || "—") + " → " + (ride.to_location || "—")}
          </p>

          {loading ? (
            <p className="text-sm text-gray-500">Загрузка…</p>
          ) : (
            <ul className="space-y-3">
              {Array.from({ length: total }, (_, i) => {
                const seat = i + 1
                const row = rows[i]
                if (row) {
                  const name = passengerLabel(row.passengerVkId)
                  return (
                    <li
                      key={row.bookingId}
                      className="flex flex-col gap-2 rounded-xl border border-gray-100 bg-gray-50 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <div className="font-medium text-gray-900">
                          Место {seat}:{" "}
                          <span className="text-[#2787F5]">
                            Занято ({name}, ★ {row.averageRating.toFixed(1)})
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-gray-500">
                          Поездок в профиле: {row.totalRides}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={busyId === row.bookingId}
                        onClick={() => void onNoShow(row.bookingId)}
                        className="shrink-0 rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-600 transition-colors active:bg-amber-100 disabled:opacity-50"
                      >
                        {busyId === row.bookingId ? "…" : "Не явился"}
                      </button>
                    </li>
                  )
                }
                return (
                  <li
                    key={`free-${seat}`}
                    className="rounded-xl border border-dashed border-gray-200 bg-white px-3 py-2.5 text-gray-900"
                  >
                    Место {seat}: <span className="text-gray-500">Свободно</span>
                  </li>
                )
              })}
            </ul>
          )}

          <button
            type="button"
            onClick={onClose}
            className="mt-6 w-full rounded-xl bg-gray-100 py-3 font-medium text-gray-900 transition-colors active:bg-gray-200"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  )
}
