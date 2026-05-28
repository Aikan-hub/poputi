"use client"

import { useState } from "react"
import { CheckCircle2, Clock, MessageSquare, Navigation } from "lucide-react"
import { cn } from "@/lib/utils"
import { poputi } from "@/components/poputi/ui"
import { openRideNavigator } from "@/lib/ride-flow"
import type { DriverData } from "@/app/types"
import {
  canDriverArrive,
  canDriverComplete,
  canDriverStart,
  type RideStatus,
} from "@/lib/ride-status"

export function DriverActiveRideBar({
  ride,
  passengerName,
  passengerAvatarUrl,
  passengerRating,
  onChat,
  onArrive,
  onStart,
  onComplete,
}: {
  ride: DriverData
  passengerName: string
  passengerAvatarUrl?: string
  passengerRating?: number
  onChat: () => void
  onArrive: () => Promise<boolean>
  onStart: () => Promise<boolean>
  onComplete: () => Promise<boolean>
}) {
  const status = (ride.rideStatus ?? "accepted") as RideStatus
  const [busy, setBusy] = useState(false)

  const action = (() => {
    if (canDriverArrive(status, true)) return { label: "На месте", color: "bg-gray-900", icon: Clock, fn: onArrive }
    if (canDriverStart(status, true)) return { label: "В пути", color: "bg-[#2787F5]", icon: Navigation, fn: onStart }
    if (canDriverComplete(status, true))
      return { label: "Завершить поездку", color: "bg-orange-500", icon: CheckCircle2, fn: onComplete }
    return null
  })()

  const runAction = async () => {
    if (!action || busy) return
    setBusy(true)
    await action.fn()
    setBusy(false)
  }

  const openNav = () => {
    openRideNavigator({
      fromLat: ride.coords[0],
      fromLng: ride.coords[1],
      toText: ride.toLocation || ride.fromLocation,
    })
  }

  const Icon = action?.icon ?? Clock

  return (
    <>
      <div className="absolute left-4 right-4 top-4 z-20 flex items-center justify-between rounded-2xl bg-white p-4 shadow-lg">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative shrink-0">
            {passengerAvatarUrl ? (
              <img src={passengerAvatarUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F0F6FF] text-lg font-bold text-[#2787F5]">
                {passengerName.slice(0, 1)}
              </div>
            )}
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-[#2787F5]" />
          </div>
          <div className="min-w-0">
            <h4 className="truncate font-bold text-gray-900">{passengerName}</h4>
            <p className="text-xs font-medium text-gray-500">
              Рейтинг {(passengerRating ?? 5).toFixed(1)}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onChat}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F0F6FF] text-[#2787F5] transition-colors hover:bg-[#F0F6FF]"
        >
          <MessageSquare className="h-[18px] w-[18px]" />
        </button>
      </div>

      <button
        type="button"
        onClick={openNav}
        className="absolute bottom-44 right-4 z-20 flex h-14 w-14 items-center justify-center rounded-full border border-gray-100 bg-white text-gray-900 shadow-lg transition-transform hover:scale-105 active:scale-95"
        aria-label="Навигатор"
      >
        <Navigation className="h-6 w-6 fill-[#2787F5] text-[#2787F5]" />
      </button>

      <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-20 flex h-64 flex-col justify-end bg-gradient-to-t from-black/60 to-transparent p-6 pb-10">
        <div className="pointer-events-auto flex items-center justify-between overflow-hidden rounded-[2rem] bg-white p-2 shadow-2xl">
          <div className="flex flex-col px-6 py-2">
            <span className="text-xs font-bold uppercase tracking-wide text-gray-400">К оплате</span>
            <span className="text-2xl font-black text-gray-900">
              {ride.price > 0 ? `${ride.price} ₽` : "—"}
            </span>
          </div>
          {action && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void runAction()}
              className={cn(
                "poputi-btn-motion poputi-focus-ring flex flex-1 items-center justify-center gap-2 rounded-[1.5rem] px-8 py-5 text-lg font-bold text-white shadow-lg active:scale-95 disabled:opacity-60",
                action.color
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{busy ? "…" : action.label}</span>
            </button>
          )}
        </div>
      </div>
    </>
  )
}
