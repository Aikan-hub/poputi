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
    <div className="absolute inset-0 z-50 flex items-end bg-black/50" onClick={onClose}>
      <div
        className="max-h-[85%] w-full animate-in slide-in-from-bottom overflow-y-auto rounded-t-2xl bg-white duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#D3D9DE]" />
          <h2 className="mb-1 text-xl font-bold text-[#2C2D2E]">Места в поездке</h2>
          <p className="mb-4 text-sm text-[#818C99]">
            {(ride.from_location || "—") + " → " + (ride.to_location || "—")}
          </p>

          {loading ? (
            <p className="text-sm text-[#818C99]">Загрузка…</p>
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
                      className="flex flex-col gap-2 rounded-xl border border-[#E1E3E6] bg-[#F7F8FA] p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <div className="font-medium text-[#2C2D2E]">
                          💺 Место {seat}:{" "}
                          <span className="text-[#2787F5]">
                            Занято ({name}, ★ {row.averageRating.toFixed(1)})
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-[#818C99]">
                          Поездок в профиле: {row.totalRides}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={busyId === row.bookingId}
                        onClick={() => void onNoShow(row.bookingId)}
                        className="shrink-0 rounded-xl bg-[#FFF3E0] px-3 py-2 text-sm font-medium text-[#E67600] transition-colors active:bg-[#FFE0B2] disabled:opacity-50"
                      >
                        {busyId === row.bookingId ? "…" : "Не явился"}
                      </button>
                    </li>
                  )
                }
                return (
                  <li
                    key={`free-${seat}`}
                    className="rounded-xl border border-dashed border-[#D3D9DE] bg-white px-3 py-2.5 text-[#2C2D2E]"
                  >
                    💺 Место {seat}: <span className="text-[#818C99]">Свободно</span>
                  </li>
                )
              })}
            </ul>
          )}

          <button
            type="button"
            onClick={onClose}
            className="mt-6 w-full rounded-xl bg-[#EBEDF0] py-3 font-medium text-[#2C2D2E] transition-colors active:bg-[#D3D9DE]"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  )
}
