"use client"

import { useState, useCallback, useEffect } from "react"
import { ChevronLeft, Clock, ExternalLink, Shield, Star, Trophy } from "lucide-react"
import { calculateUserLevel } from "@/lib/user-level"
import {
  hasDriverAccess,
  createDriverPaymentIntent,
  checkDriverInvoicePaid,
  grantDriverAccessLocally,
  openPaymentUrl,
  setPendingDriverInvoice,
  DRIVER_ACCESS_PRICE_LABEL,
} from "@/lib/driver-payment"
import { supabase } from "@/lib/supabase-client"
import { type AppCity } from "@/lib/cities"
import { type VkUserProfile } from "./types"
import { vkIdTagFromNumericId } from "./helpers"
import { RideHistoryModal } from "./ride-history-modal"

export function ProfileScreen({
  isDriver,
  setIsDriver,
  vkUser,
  historyCity,
  showAdminEntry,
  onOpenAdmin,
  appendReviewChatMessage,
  onDriverPaymentVerified,
}: {
  isDriver: boolean
  setIsDriver: (value: boolean) => void
  vkUser: VkUserProfile | null
  historyCity: AppCity
  showAdminEntry: boolean
  onOpenAdmin: () => void
  appendReviewChatMessage: (targetVkTag: string, targetDisplayName: string, message: string) => void | Promise<void>
  onDriverPaymentVerified?: () => void
}) {
  const [rideHistoryOpen, setRideHistoryOpen] = useState(false)
  const [driverPayOpen, setDriverPayOpen] = useState(false)
  const [driverPayUrl, setDriverPayUrl] = useState("")
  const [driverInvoiceId, setDriverInvoiceId] = useState<string | null>(null)
  const [driverPayError, setDriverPayError] = useState<string | null>(null)
  const [driverChecking, setDriverChecking] = useState(false)
  const [driverCheckHint, setDriverCheckHint] = useState<string | null>(null)
  const [profileStats, setProfileStats] = useState({
    totalRides: 0,
    averageRating: 5,
    reviewsReceived: 0,
  })

  const loadProfileStats = useCallback(async () => {
    if (!vkUser) {
      setProfileStats({ totalRides: 0, averageRating: 5, reviewsReceived: 0 })
      return
    }
    const tag = vkIdTagFromNumericId(vkUser.id)
    const [profRes, countRes] = await Promise.all([
      supabase.from("profiles").select("total_rides, average_rating").eq("vk_id", tag).maybeSingle(),
      supabase.from("reviews").select("*", { count: "exact", head: true }).eq("target_vk_id", tag),
    ])
    const p = profRes.data as { total_rides?: number; average_rating?: number } | null
    setProfileStats({
      totalRides: p?.total_rides ?? 0,
      averageRating: Number(p?.average_rating ?? 5),
      reviewsReceived: countRes.count ?? 0,
    })
  }, [vkUser])

  useEffect(() => {
    void loadProfileStats()
  }, [loadProfileStats])

  const fullName = vkUser ? `${vkUser.first_name} ${vkUser.last_name}`.trim() : "Пользователь VK"
  const profileLink = vkUser ? `https://vk.com/id${vkUser.id}` : "https://vk.com"
  const avatarFallback = fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "VK"

  return (
    <div className="app-scrollbar h-full overflow-y-auto bg-gray-100">
      <RideHistoryModal
        open={rideHistoryOpen}
        onClose={() => setRideHistoryOpen(false)}
        vkUser={vkUser}
        historyCity={historyCity}
        appendReviewChatMessage={appendReviewChatMessage}
        onProfileStatsReload={loadProfileStats}
      />
      <header className="bg-[#2787F5] px-4 pb-8 pt-8 text-white shadow-sm">
        <div className="flex items-center gap-4">
          {vkUser?.photo_200 ? (
            <img
              src={vkUser.photo_200}
              alt={fullName}
              className="h-20 w-20 rounded-full object-cover shadow-lg ring-4 ring-white/25"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white text-2xl font-bold text-[#2787F5] shadow-lg ring-4 ring-white/25">
              {avatarFallback}
            </div>
          )}
          <div className="min-w-0">
            <div className="mb-1 inline-flex items-center rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold">
              {isDriver ? "Водитель" : "Пассажир"}
            </div>
            <h1 className="truncate text-2xl font-bold leading-tight">{fullName}</h1>
            <a
              href={profileLink}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate text-sm font-medium text-white/80 underline"
            >
              {profileLink}
            </a>
          </div>
        </div>
      </header>

      <div className="-mt-4 space-y-4 p-4 pb-8">
        <div className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100">
          <div className="flex flex-col gap-3">
            <div>
              <h3 className="font-bold text-gray-900">Роль</h3>
              <p className="text-sm text-gray-500">
                {isDriver ? "Вы принимаете заказы" : "Вы ищете поездки"}
              </p>
            </div>
            <div
              className="flex w-full flex-row gap-0 rounded-xl bg-gray-100 p-1"
              role="tablist"
              aria-label="Роль в приложении"
            >
              <button
                type="button"
                role="tab"
                aria-selected={!isDriver}
                onClick={() => {
                  setIsDriver(false)
                }}
                className={`flex-1 whitespace-nowrap rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition-all duration-200 ease-out ${
                  !isDriver
                    ? "bg-white font-bold text-gray-900 shadow-sm"
                    : "bg-transparent font-semibold text-gray-500 shadow-none"
                }`}
              >
                Пассажир
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={isDriver}
                onClick={async () => {
                  if (hasDriverAccess()) {
                    setIsDriver(true)
                    return
                  }
                  if (!vkUser) {
                    grantDriverAccessLocally()
                    onDriverPaymentVerified?.()
                    setIsDriver(true)
                    return
                  }
                  const tag = vkIdTagFromNumericId(vkUser.id)
                  setDriverPayError(null)
                  setDriverCheckHint(null)
                  const created = await createDriverPaymentIntent(tag)
                  if (!created.ok) {
                    setDriverInvoiceId(null)
                    setDriverPayUrl("")
                    setDriverPayError(created.message)
                    setDriverPayOpen(true)
                    return
                  }
                  setDriverInvoiceId(created.invoiceId)
                  setDriverPayUrl(created.payUrl)
                  setPendingDriverInvoice(created.invoiceId)
                  await openPaymentUrl(created.payUrl)
                  setDriverPayOpen(true)
                }}
                className={`flex-1 whitespace-nowrap rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition-all duration-200 ease-out ${
                  isDriver
                    ? "bg-white font-bold text-gray-900 shadow-sm"
                    : "bg-transparent font-semibold text-gray-500 shadow-none"
                }`}
              >
                Водитель
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100">
          <h3 className="mb-3 font-bold text-gray-900">Статистика</h3>
          <div className="mb-4 rounded-xl bg-[#F0F6FF] px-4 py-3">
            <div className="flex items-center justify-center gap-2 text-xs font-semibold uppercase text-gray-500">
              <Trophy className="h-4 w-4 text-[#2787F5]" />
              Уровень
            </div>
            <p className="mt-1 text-center text-lg font-bold text-[#2787F5]">
              {calculateUserLevel(profileStats.totalRides, profileStats.averageRating)}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-gray-50 p-4 text-center">
              <p className="text-xs font-semibold text-gray-500">Рейтинг</p>
              <div className="mt-1 flex items-center justify-center gap-0.5 text-yellow-400">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} className={`h-4 w-4 ${s <= Math.round(profileStats.averageRating) ? "fill-current" : ""}`} />
                ))}
              </div>
              <p className="mt-1 text-2xl font-bold text-gray-900">{profileStats.averageRating.toFixed(1)}</p>
              <p className="text-xs text-gray-500">Отзывов: {profileStats.reviewsReceived}</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4 text-center">
              <p className="text-xs font-semibold text-gray-500">Поездок</p>
              <p className="mt-2 text-3xl font-bold text-[#2787F5]">{profileStats.totalRides}</p>
              <p className="text-xs text-gray-500">завершено</p>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl bg-white shadow-sm border border-gray-100">
          <button
            type="button"
            onClick={() => setRideHistoryOpen(true)}
            className="flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3.5 text-left transition-colors active:bg-gray-50"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F0F6FF] text-[#2787F5]">
              <Clock className="h-5 w-5" />
            </span>
            <span className="font-medium text-gray-900">История заявок</span>
            <ChevronLeft className="ml-auto h-5 w-5 shrink-0 rotate-180 text-gray-400" />
          </button>
          {showAdminEntry && (
            <button
              type="button"
              onClick={onOpenAdmin}
              className="flex w-full items-center gap-3 border-t border-gray-100 px-4 py-3.5 text-left transition-colors active:bg-gray-50"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F0F6FF] text-[#2787F5]">
                <Shield className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-gray-900">Админ-панель</span>
                <span className="text-sm text-gray-500">Для управления приложением</span>
              </span>
              <ChevronLeft className="h-5 w-5 shrink-0 rotate-180 text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {driverPayOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4"
          role="presentation"
          onClick={() => {
            setDriverPayOpen(false)
            setDriverChecking(false)
          }}
        >
          <div
            className="w-full max-w-sm rounded-[2rem] bg-white p-6 shadow-2xl"
            role="dialog"
            aria-labelledby="driver-pay-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="driver-pay-title" className="text-lg font-bold text-gray-900">
              Доступ водителя — {DRIVER_ACCESS_PRICE_LABEL}
            </h2>
            {driverPayError && (
              <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{driverPayError}</p>
            )}
            {!driverPayError && (
              <p className="mt-2 text-sm text-gray-500">
                Оплатите на странице CloudTips. После оплаты нажмите «Проверить оплату» — мы сверим данные с
                сервером CloudTips.
              </p>
            )}
            {driverCheckHint && (
              <p className="mt-2 rounded-xl bg-yellow-50 px-3 py-2 text-sm text-gray-900">{driverCheckHint}</p>
            )}
            {driverPayUrl ? (
              <button
                type="button"
                onClick={() => void openPaymentUrl(driverPayUrl)}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#2787F5] py-3 text-sm font-semibold text-white shadow-lg shadow-[#2787F5]/30 transition-all hover:bg-[#1F6AD8] active:scale-[0.98]"
              >
                <ExternalLink className="h-4 w-4" />
                Открыть оплату ещё раз
              </button>
            ) : null}
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                disabled={driverChecking || !driverInvoiceId}
                onClick={async () => {
                  if (!driverInvoiceId) return
                  setDriverChecking(true)
                  setDriverCheckHint(null)
                  const st = await checkDriverInvoicePaid(driverInvoiceId)
                  setDriverChecking(false)
                  if (st === "paid") {
                    grantDriverAccessLocally()
                    onDriverPaymentVerified?.()
                    setIsDriver(true)
                    setDriverPayOpen(false)
                    setDriverInvoiceId(null)
                    setDriverPayUrl("")
                    return
                  }
                  if (st === "pending") {
                    setDriverCheckHint(
                      "Оплата пока не подтверждена. Завершите платёж на CloudTips и нажмите «Проверить оплату» снова через несколько секунд."
                    )
                    return
                  }
                  if (st === "missing") {
                    setDriverCheckHint("Счёт не найден. Закройте окно и снова выберите «Водитель», чтобы создать новую оплату.")
                    return
                  }
                  setDriverCheckHint("Не удалось проверить оплату. Проверьте интернет и попробуйте снова.")
                }}
                className="w-full rounded-xl bg-gray-900 py-3 text-sm font-semibold text-white transition-all hover:bg-gray-800 active:scale-[0.98] disabled:bg-gray-200 disabled:text-gray-400"
              >
                {driverChecking ? "Проверка…" : "Проверить оплату"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDriverPayOpen(false)
                  setDriverChecking(false)
                }}
                className="w-full rounded-xl bg-gray-100 py-3 text-sm font-semibold text-gray-600 transition-all hover:bg-gray-200 active:scale-95"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
