"use client"

import { useState } from "react"
import { Clock, Navigation, Trash2 } from "lucide-react"
import {
  formatPassengerSeatsLabel,
  isCityPassengerRide,
  passengerSeatCountFromRide,
} from "@/lib/passenger-seats"
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

  const passengerSeats =
    isCity && isCityPassengerRide(driver.rideType)
      ? driver.requestedSeats ?? passengerSeatCountFromRide(driver.activeRide)
      : null

  if (canTakeCity) {
    const passengerInitial = String(driver.name || "?").slice(0, 1).toUpperCase()
    const etaLabel = `~${driver.timer || 5} мин`

    return (
      <BottomSheet onClose={onClose} className="pb-6">
        {/* Header: price + meta + avatar */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#EAF2FF] to-[#DCE9FF] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#2787F5] ring-1 ring-[#2787F5]/15">
              Новая заявка
            </div>
            <h3 className="mt-1.5 flex items-baseline gap-1 text-[1.65rem] font-black leading-none tracking-tight">
              <span className="poputi-grad-text">{driver.price || 0}</span>
              <span className="text-lg font-bold text-gray-400">₽</span>
            </h3>
            <div className="mt-2 flex flex-wrap items-center gap-1">
              <span className="inline-flex items-center gap-0.5 rounded-full bg-gray-50 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600 ring-1 ring-gray-100">
                <Clock className="h-2.5 w-2.5 text-gray-500" aria-hidden /> {etaLabel}
              </span>
              {passengerSeats != null && (
                <span className="rounded-full bg-gradient-to-r from-[#EAF2FF] to-[#DCE9FF] px-1.5 py-0.5 text-[10px] font-bold text-[#2787F5] ring-1 ring-[#2787F5]/15">
                  {formatPassengerSeatsLabel(passengerSeats)}
                </span>
              )}
              <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200/70">
                По карте
              </span>
            </div>
          </div>
          <div className="relative shrink-0">
            {passengerPhoto ? (
              <img
                src={passengerPhoto}
                alt=""
                className="h-11 w-11 rounded-full object-cover ring-2 ring-white shadow-[0_6px_16px_-6px_rgba(15,23,42,0.35)]"
              />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-full poputi-grad-primary text-base font-bold text-white ring-2 ring-white shadow-[0_6px_16px_-6px_rgba(39,135,245,0.55)]">
                {passengerInitial}
              </div>
            )}
            <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full border-[1.5px] border-white bg-[#4BB34B]">
              <span className="h-1 w-1 rounded-full bg-white" />
            </span>
          </div>
        </div>

        {/* Route timeline */}
        <div className="relative mb-3 mt-3 overflow-hidden rounded-xl border border-gray-100 bg-gradient-to-b from-white to-gray-50 p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="relative">
            <div
              className="pointer-events-none absolute left-[5px] top-3 bottom-3 w-0.5 rounded-full bg-gradient-to-b from-gray-300 via-gray-200 to-[#2787F5]/70"
              aria-hidden
            />
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <span className="relative z-10 flex h-3 w-3 shrink-0 items-center justify-center">
                  <span className="absolute h-3 w-3 rounded-full bg-gray-800" />
                  <span className="relative h-1 w-1 rounded-full bg-white" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-gray-400 leading-tight">Откуда</p>
                  <p className="truncate text-[13px] font-bold text-gray-900 leading-tight">{driver.fromLocation || "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="relative z-10 flex h-3 w-3 shrink-0 items-center justify-center">
                  <span className="absolute h-3 w-3 rounded-full bg-[#2787F5] shadow-[0_0_0_2px_rgba(39,135,245,0.18)]" />
                  <span className="relative h-1 w-1 rounded-full bg-white" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-[#2787F5] leading-tight">Куда</p>
                  <p className="truncate text-[13px] font-bold text-gray-900 leading-tight">{driver.toLocation || "—"}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {actionError && (
          <div className="mb-2 flex items-start gap-2 rounded-xl border border-[#2787F5]/15 bg-gradient-to-r from-[#EAF2FF] to-[#DCE9FF] px-2.5 py-1.5">
            <span className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-[#2787F5] text-[9px] font-bold text-white">i</span>
            <p className="text-[11px] font-semibold leading-snug text-[#1F6AD8]">{actionError}</p>
          </div>
        )}

        {/* Primary CTA */}
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void sendOffer(0)}
          className={cn(
            "poputi-btn-motion poputi-focus-ring poputi-grad-primary group relative w-full overflow-hidden rounded-xl py-3 text-sm font-bold tracking-tight text-white shadow-[0_10px_24px_-10px_rgba(39,135,245,0.6)] ring-1 ring-white/30 transition-all hover:shadow-[0_14px_30px_-10px_rgba(39,135,245,0.7)] active:scale-[0.98] disabled:bg-none disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none disabled:ring-0"
          )}
        >
          <span
            className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full"
            aria-hidden
          />
          <span className="relative inline-flex items-center justify-center gap-2">
            {busy === "offer" ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
                Отправка…
              </>
            ) : (
              <>Забрать за {driver.price || 0} ₽</>
            )}
          </span>
        </button>

        {/* Tip buttons */}
        <div className="mt-2">
          <p className="mb-1 text-center text-[9px] font-bold uppercase tracking-wide text-gray-400">
            Предложить выше
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {[10, 30, 50].map((val) => (
              <button
                key={val}
                type="button"
                disabled={busy !== null}
                onClick={() => void sendOffer(val)}
                className="poputi-btn-motion poputi-focus-ring group relative overflow-hidden rounded-xl border border-gray-100 bg-white py-1.5 text-xs font-bold text-gray-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5 hover:border-[#2787F5]/40 hover:bg-gradient-to-b hover:from-white hover:to-[#F0F6FF] hover:text-[#2787F5] hover:shadow-[0_8px_18px_-10px_rgba(39,135,245,0.35)] active:scale-95 disabled:opacity-50"
              >
                <span className="block text-[9px] font-bold leading-none text-gray-400 group-hover:text-[#2787F5]/70">
                  +
                </span>
                <span className="block text-[13px] font-black leading-tight tracking-tight">{val} ₽</span>
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
            {passengerSeats != null && userRole === "Driver" && (
              <p className="mt-2 text-sm font-semibold text-[#2787F5]">
                Нужно мест: {formatPassengerSeatsLabel(passengerSeats)}
              </p>
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
