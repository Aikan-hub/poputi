"use client"

import { useState } from "react"
import { Car, Clock, MapPin, Trash2 } from "lucide-react"
import { isPersistentRideType } from "@/lib/rides"
import {
  type RideStatus,
  statusLabel,
  canPassengerCancel,
  canDriverTake,
  canDriverStart,
  canDriverComplete,
} from "@/lib/ride-status"
import { supabase } from "@/lib/supabase-client"
import type { DriverData, SupabaseRide } from "./types"

export function DriverBottomSheet({
  driver,
  viewerVkTag,
  userRole,
  onClose,
  onBooking,
  onCityPickup,
  onPassengerCancel,
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
  onPassengerCancel: (ride: SupabaseRide) => Promise<boolean>
  onDriverStart: (ride: SupabaseRide) => Promise<boolean>
  onDriverComplete: (ride: SupabaseRide) => Promise<boolean>
  onDelete?: () => void
  onStatusChanged?: () => void
}) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState<"take" | "start" | "complete" | "cancel" | null>(null)
  const isStaticPoint = isPersistentRideType(driver.rideType)
  const isCity = (driver.rideType || "").trim() === "City"
  const isOwner = viewerVkTag != null && driver.vkId === viewerVkTag
  const status = ((driver.rideStatus as RideStatus | null) ?? "searching").trim() as RideStatus
  const viewerIsDriver = viewerVkTag != null && driver.driverId === viewerVkTag

  const canTakeCity = isCity && userRole === "Driver" && !isOwner && canDriverTake(status) && driver.activeRide
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

  const execAction = async (kind: "take" | "start" | "complete" | "cancel", fn: () => Promise<boolean>) => {
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

  return (
    <div className="absolute inset-0 z-20 flex items-end" onClick={onClose}>
      <div
        className="max-h-[78vh] w-full overflow-hidden rounded-t-2xl bg-white shadow-2xl ring-1 ring-black/5 animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="app-scrollbar max-h-[78vh] overflow-y-auto p-4 pb-5">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#D3D9DE]" />

        <div className="mb-4 flex items-center gap-4">
          {driver.driverPhotoUrl ? (
            <img src={driver.driverPhotoUrl} alt="" className="h-16 w-16 shrink-0 rounded-full object-cover shadow-sm ring-2 ring-[#2787F5]/20" />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#2787F5] text-xl font-bold text-white shadow-sm">
              {driver.avatar}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-lg font-bold text-[#2C2D2E]">{driver.name}</h3>
              {isCity && (
                <span className="shrink-0 rounded-full bg-[#F0F6FF] px-2 py-1 text-xs font-semibold text-[#2787F5]">
                  {statusLabel[status]}
                </span>
              )}
            </div>
            {isCity && (driver.fromLocation || driver.toLocation) && (
              <div className="mt-2 rounded-xl bg-[#F7F8FA] px-3 py-2 text-sm font-medium text-[#2C2D2E]">
                <div className="flex min-w-0 items-center gap-2">
                  <MapPin className="h-4 w-4 shrink-0 text-[#2787F5]" />
                  <span className="truncate">{driver.fromLocation || "—"}</span>
                  <span className="shrink-0 text-[#818C99]">→</span>
                  <span className="truncate">{driver.toLocation || "—"}</span>
                </div>
              </div>
            )}
            {isCity && driver.rideComment ? (
              <p className="mt-2 line-clamp-3 rounded-xl bg-[#F7F8FA] px-3 py-2 text-sm leading-relaxed text-[#818C99]">
                <span className="font-medium text-[#2C2D2E]">Комментарий:</span> {driver.rideComment}
              </p>
            ) : null}
            {!isCity && (
              <div className="mt-1 flex items-center gap-2 text-sm text-[#818C99]">
                <Car className="h-4 w-4" />
                <span>{driver.car}</span>
              </div>
            )}
            <div className="mt-1 flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <span
                  key={star}
                  className={`text-sm ${star <= Math.round(driver.rating) ? "text-[#FFC107]" : "text-[#E1E3E6]"}`}
                >
                  ★
                </span>
              ))}
              <span className="ml-1 text-sm text-[#818C99]">{driver.rating}</span>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-2xl font-bold text-[#2787F5]">{driver.price > 0 ? `${driver.price} ₽` : "—"}</div>
            <div className="mt-0.5 flex items-center justify-end gap-1 text-sm text-[#818C99]">
              <Clock className="h-3 w-3" />
              <span>{isStaticPoint ? "Постоянная точка" : `${driver.timer} мин`}</span>
            </div>
          </div>
        </div>

        {actionError && (
          <p className="mb-3 rounded-xl bg-[#FAEBEB] px-3 py-2 text-center text-sm text-[#E64646]">{actionError}</p>
        )}

        <div className="space-y-2">
          {canTakeCity && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void execAction("take", () => onCityPickup(driver.activeRide!))}
              className="w-full rounded-xl bg-[#2787F5] py-4 text-base font-semibold text-white shadow-sm shadow-[#2787F5]/20 transition-colors active:bg-[#1F6AD8] disabled:opacity-50"
            >
              {busy === "take" ? "Берём заявку…" : "Взять заказ"}
            </button>
          )}

          {canStartRide && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void execAction("start", () => onDriverStart(driver.activeRide!))}
              className="w-full rounded-xl bg-[#2787F5] py-3 text-base font-semibold text-white shadow-sm shadow-[#2787F5]/20 transition-colors active:bg-[#1F6AD8] disabled:opacity-50"
            >
              {busy === "start" ? "Стартуем…" : "Начать поездку"}
            </button>
          )}

          {canCompleteRide && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void execAction("complete", () => onDriverComplete(driver.activeRide!))}
              className="w-full rounded-xl bg-[#4BB34B] py-3 text-base font-semibold text-white shadow-sm shadow-[#4BB34B]/20 transition-colors active:bg-[#429C41] disabled:opacity-50"
            >
              {busy === "complete" ? "Завершаем…" : "Завершить поездку"}
            </button>
          )}

          {canCancelByPassenger && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void execAction("cancel", () => onPassengerCancel(driver.activeRide!))}
              className="w-full rounded-xl bg-[#FAEBEB] py-3 text-base font-semibold text-[#E64646] transition-colors active:bg-[#F5D6D6] disabled:opacity-50"
            >
              {busy === "cancel" ? "Отмена…" : "Отменить заказ"}
            </button>
          )}

          {!canTakeCity && !canStartRide && !canCompleteRide && !canCancelByPassenger && (
            <div className="rounded-xl bg-[#F7F8FA] px-3 py-2 text-center text-sm font-medium text-[#818C99]">
              {isCity ? statusLabel[status] : "Действия недоступны"}
            </div>
          )}

          {!isStaticPoint && !isCity && !isOwner && (
            <button
              type="button"
              onClick={onBooking}
              className="w-full rounded-xl bg-[#2787F5] py-3 font-semibold text-white shadow-sm shadow-[#2787F5]/20 transition-colors active:bg-[#1F6AD8]"
            >
              Забронировать
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-[#EBEDF0] py-3 font-medium text-[#2C2D2E] transition-colors active:bg-[#D3D9DE]"
          >
            Закрыть
          </button>
        </div>

        {driver.supabaseId && !isStaticPoint && isOwner && (
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={isDeleting}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#FAEBEB] py-3 font-medium text-[#E64646] transition-colors active:bg-[#F5D6D6] disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            {isDeleting ? "Удаление..." : "Удалить мою заявку"}
          </button>
        )}
        </div>
      </div>
    </div>
  )
}
