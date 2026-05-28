"use client"

import { useState } from "react"
import { Clock, Navigation, Trash2 } from "lucide-react"
import { isPersistentRideType } from "@/lib/rides"
import { openRideNavigator } from "@/lib/ride-flow"
import {
  type RideStatus,
  statusLabel,
  canPassengerCancel,
  canDriverTake,
  canDriverArrive,
  canDriverStart,
  canDriverComplete,
} from "@/lib/ride-status"
import { supabase } from "@/lib/supabase-client"
import { BottomSheet, poputi } from "@/components/poputi/ui"
import { cn } from "@/lib/utils"
import type { DriverData, SupabaseRide } from "./types"

export function DriverBottomSheet({
  driver,
  viewerVkTag,
  userRole,
  onClose,
  onBooking,
  onCityPickup,
  onDriverOffer,
  onPassengerCancel,
  onDriverArrive,
  onDriverStart,
  onDriverComplete,
  onDelete,
  onStatusChanged,
}: {
  driver: DriverData
  viewerVkTag: string | null
  userRole: string
  onClose: () => void
  onBooking: () => void
  onCityPickup: (ride: SupabaseRide) => Promise<boolean>
  onDriverOffer: (ride: SupabaseRide, priceDelta: number) => Promise<boolean>
  onPassengerCancel: (ride: SupabaseRide) => Promise<boolean>
  onDriverArrive: (ride: SupabaseRide) => Promise<boolean>
  onDriverStart: (ride: SupabaseRide) => Promise<boolean>
  onDriverComplete: (ride: SupabaseRide) => Promise<boolean>
  onDelete?: () => void
  onStatusChanged?: () => void
}) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState<"offer" | "take" | "arrive" | "start" | "complete" | "cancel" | null>(null)
  const isStaticPoint = isPersistentRideType(driver.rideType)
  const isCity = (driver.rideType || "").trim() === "City"
  const isOwner = viewerVkTag != null && driver.vkId === viewerVkTag
  const status = ((driver.rideStatus as RideStatus | null) ?? "searching").trim() as RideStatus
  const viewerIsDriver = viewerVkTag != null && driver.driverId === viewerVkTag

  const canTakeCity = isCity && userRole === "Driver" && !isOwner && canDriverTake(status) && driver.activeRide
  const canArriveRide = isCity && viewerIsDriver && canDriverArrive(status, true) && driver.activeRide
  const canStartRide = isCity && viewerIsDriver && canDriverStart(status, true) && driver.activeRide
  const canCompleteRide = isCity && viewerIsDriver && canDriverComplete(status, true) && driver.activeRide
  const canCancelByPassenger = !isStaticPoint && isOwner && canPassengerCancel(status) && driver.activeRide

  const handleDelete = async () => {
    if (!driver.supabaseId || isDeleting || !isOwner) return
    setIsDeleting(true)
    const { error } = await supabase.from("rides").delete().eq("id", driver.supabaseId)
    setIsDeleting(false)
    if (!error && onDelete) {
      onDelete()
      onClose()
    }
  }

  const execAction = async (kind: "take" | "arrive" | "start" | "complete" | "cancel", fn: () => Promise<boolean>) => {
    setBusy(kind)
    setActionError(null)
    const ok = await fn()
    setBusy(null)
    if (ok) {
      onStatusChanged?.()
      onClose()
    } else {
      setActionError("Не удалось выполнить действие. Обновите карту и попробуйте снова.")
    }
  }

  const sendOffer = async (priceDelta: number) => {
    if (!driver.activeRide || busy !== null) return
    setBusy("offer")
    setActionError(null)
    const ok = await onDriverOffer(driver.activeRide, priceDelta)
    setBusy(null)
    if (ok) {
      setActionError("Отклик отправлен пассажиру в чат.")
    } else {
      setActionError("Не удалось отправить отклик. Возможно, заявка уже занята.")
    }
  }

  const openNavigator = () => {
    openRideNavigator({
      fromLat: driver.coords[0],
      fromLng: driver.coords[1],
      toText: driver.toLocation || driver.fromLocation,
    })
  }

  const passengerPhoto =
    driver.driverPhotoUrl ||
    (driver.activeRide?.avatar?.startsWith("http") ? driver.activeRide.avatar : null)

  if (canTakeCity) {
    return (
      <BottomSheet onClose={onClose} className="pb-12">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-2xl font-bold text-gray-900">{driver.price || 0} ₽</h3>
            <div className="mt-1 flex items-center gap-4 text-sm font-medium text-gray-500">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> ~{driver.timer || 5} мин до вас
              </span>
              <span>по карте</span>
            </div>
          </div>
          {passengerPhoto ? (
            <img src={passengerPhoto} alt="" className="h-12 w-12 rounded-full border-2 border-white object-cover shadow-sm" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-lg font-bold text-gray-600">
              {String(driver.name || "?").slice(0, 1)}
            </div>
          )}
        </div>

        <div className="mb-6 mt-4 rounded-xl bg-gray-50 p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-gray-800" />
            <p className="truncate text-sm font-medium text-gray-900">{driver.fromLocation || "—"}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#2787F5]" />
            <p className="truncate text-sm font-medium text-gray-900">{driver.toLocation || "—"}</p>
          </div>
        </div>

        {actionError && (
          <p className="mb-3 rounded-xl bg-[#F0F6FF] px-3 py-2 text-center text-sm text-[#2787F5]">{actionError}</p>
        )}

        <div className="space-y-3">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void sendOffer(0)}
            className={poputi.btnPrimary}
          >
            {busy === "offer" ? "Отправка…" : `Забрать за ${driver.price || 0} ₽`}
          </button>
          <div className="flex gap-2">
            {[10, 30, 50].map((val) => (
              <button
                key={val}
                type="button"
                disabled={busy !== null}
                onClick={() => void sendOffer(val)}
                className="poputi-btn-motion poputi-focus-ring flex-1 rounded-xl border border-gray-200 bg-white py-3 text-sm font-semibold text-gray-700 hover:border-[#2787F5] hover:text-[#2787F5] active:bg-gray-50 disabled:opacity-50"
              >
                +{val} ₽
              </button>
            ))}
          </div>
        </div>
      </BottomSheet>
    )
  }

  return (
    <BottomSheet onClose={onClose} maxHeight="78vh">
      <div className="app-scrollbar max-h-[70vh] overflow-y-auto">
        <div className="mb-4 flex items-center gap-4">
          {passengerPhoto ? (
            <img src={passengerPhoto} alt="" className="h-16 w-16 shrink-0 rounded-full object-cover shadow-sm ring-2 ring-[#2787F5]/20" />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#2787F5] text-xl font-bold text-white shadow-sm">
              {String(driver.avatar || "?").slice(0, 2)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-lg font-bold text-gray-900">{driver.name}</h3>
              {isCity && (
                <span className="shrink-0 rounded-full bg-[#F0F6FF] px-2 py-1 text-xs font-semibold text-[#2787F5]">
                  {statusLabel[status]}
                </span>
              )}
            </div>
            {isCity && (driver.fromLocation || driver.toLocation) && (
              <div className="mt-2 rounded-xl bg-gray-50 px-3 py-2 text-sm font-medium text-gray-900">
                <p className="truncate">{driver.fromLocation || "—"}</p>
                <p className="truncate text-gray-500">→ {driver.toLocation || "—"}</p>
              </div>
            )}
          </div>
          <div className="shrink-0 text-right">
            <div className="text-2xl font-bold text-gray-900">{driver.price > 0 ? `${driver.price} ₽` : "—"}</div>
          </div>
        </div>

        {actionError && (
          <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-center text-sm text-red-600">{actionError}</p>
        )}

        <div className="space-y-2">
          {viewerIsDriver && isCity && (
            <button
              type="button"
              onClick={openNavigator}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#F0F6FF] py-3 text-base font-semibold text-[#2787F5] transition-colors active:bg-[#F0F6FF]"
            >
              <Navigation className="h-4 w-4" />
              Открыть в навигаторе
            </button>
          )}

          {canArriveRide && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void execAction("arrive", () => onDriverArrive(driver.activeRide!))}
              className={cn(poputi.btnPrimary, "py-3 text-base")}
            >
              {busy === "arrive" ? "Отправляем…" : "На месте"}
            </button>
          )}

          {canStartRide && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void execAction("start", () => onDriverStart(driver.activeRide!))}
              className={cn(poputi.btnPrimary, "py-3 text-base")}
            >
              {busy === "start" ? "Стартуем…" : "Начать поездку"}
            </button>
          )}

          {canCompleteRide && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void execAction("complete", () => onDriverComplete(driver.activeRide!))}
              className="w-full rounded-xl bg-orange-500 py-3 text-base font-semibold text-white shadow-lg shadow-orange-500/25 active:scale-[0.98] disabled:opacity-50"
            >
              {busy === "complete" ? "Завершаем…" : "Завершить поездку"}
            </button>
          )}

          {canCancelByPassenger && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void execAction("cancel", () => onPassengerCancel(driver.activeRide!))}
              className="w-full rounded-xl bg-red-50 py-3 text-base font-semibold text-red-600 active:bg-red-100 disabled:opacity-50"
            >
              {busy === "cancel" ? "Отмена…" : "Отменить заказ"}
            </button>
          )}

          {!canTakeCity && !canStartRide && !canCompleteRide && !canCancelByPassenger && !canArriveRide && (
            <div className="rounded-xl bg-gray-50 px-3 py-2 text-center text-sm font-medium text-gray-500">
              {isCity ? statusLabel[status] : "Действия недоступны"}
            </div>
          )}

          {!isStaticPoint && !isCity && !isOwner && (
            <button type="button" onClick={onBooking} className={poputi.btnPrimary}>
              Забронировать
            </button>
          )}

          <button type="button" onClick={onClose} className={cn(poputi.btnGhost, "w-full")}>
            Закрыть
          </button>
        </div>

        {driver.supabaseId && !isStaticPoint && isOwner && (
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={isDeleting}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-red-50 py-3 font-medium text-red-600 active:bg-red-100 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            {isDeleting ? "Удаление…" : "Удалить мою заявку"}
          </button>
        )}
      </div>
    </BottomSheet>
  )
}
