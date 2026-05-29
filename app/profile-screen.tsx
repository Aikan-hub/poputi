"use client"

import { useState, useCallback, useEffect } from "react"
import type { ReactNode } from "react"
import {
  Bell,
  Briefcase,
  Car,
  ChevronLeft,
  Clock,
  ExternalLink,
  GraduationCap,
  Home,
  MapPinned,
  Minus,
  Plus,
  Radar,
  Route,
  Shield,
  Star,
  TrainFront,
  Trophy,
} from "lucide-react"
import {
  averageFromReviewRatings,
  filledStarCount,
  formatRatingDisplay,
  hasHighRating,
  ratingForLevel,
} from "@/lib/profile-rating"
import { calculateUserLevel } from "@/lib/user-level"
import {
  DEFAULT_USER_SETTINGS,
  loadUserSettings,
  storeUserSettings,
  type UserSettings,
} from "@/lib/user-settings"
import { cn } from "@/lib/utils"
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
import {
  formatRuPhoneDisplay,
  formatRuPhoneInput,
  isValidRuPhone,
  ruPhoneValidationMessage,
} from "@/lib/ru-phone"
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
  const [roleConfirmTarget, setRoleConfirmTarget] = useState<"driver" | "passenger" | null>(null)
  const [roleSwitching, setRoleSwitching] = useState(false)
  const [profileStats, setProfileStats] = useState<{
    totalRides: number
    averageRating: number | null
    reviewsReceived: number
  }>({
    totalRides: 0,
    averageRating: null,
    reviewsReceived: 0,
  })
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS)

  useEffect(() => {
    setSettings(loadUserSettings())
  }, [])

  const updateSettings = useCallback((updater: (current: UserSettings) => UserSettings) => {
    setSettings((current) => {
      const next = updater(current)
      storeUserSettings(next)
      return next
    })
  }, [])

  const loadProfileStats = useCallback(async () => {
    if (!vkUser) {
      setProfileStats({ totalRides: 0, averageRating: null, reviewsReceived: 0 })
      return
    }
    const tag = vkIdTagFromNumericId(vkUser.id)
    const [profRes, reviewsRes] = await Promise.all([
      supabase.from("profiles").select("total_rides").eq("vk_id", tag).maybeSingle(),
      supabase.from("reviews").select("rating").eq("target_vk_id", tag),
    ])
    const p = profRes.data as { total_rides?: number } | null
    const ratings = (reviewsRes.data ?? []).map((row) => Number((row as { rating: number }).rating))
    const reviewsReceived = ratings.length
    setProfileStats({
      totalRides: p?.total_rides ?? 0,
      averageRating: averageFromReviewRatings(ratings),
      reviewsReceived,
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
  const level = calculateUserLevel(
    profileStats.totalRides,
    ratingForLevel(profileStats.averageRating)
  )
  const starCount = filledStarCount(profileStats.averageRating)
  const ratingLabel = formatRatingDisplay(profileStats.averageRating)
  const progressTarget = nextLevelTarget(profileStats.totalRides)
  const progressPct =
    progressTarget == null ? 100 : Math.min(100, Math.round((profileStats.totalRides / progressTarget) * 100))
  const trustBadges = buildTrustBadges(
    profileStats.totalRides,
    profileStats.averageRating,
    profileStats.reviewsReceived,
    settings,
    isDriver
  )

  const closeRoleConfirm = useCallback(() => {
    if (roleSwitching) return
    setRoleConfirmTarget(null)
  }, [roleSwitching])

  const confirmSwitchToDriver = useCallback(async () => {
    setRoleSwitching(true)
    try {
      if (hasDriverAccess()) {
        setIsDriver(true)
        setRoleConfirmTarget(null)
        return
      }
      if (!vkUser) {
        grantDriverAccessLocally()
        onDriverPaymentVerified?.()
        setIsDriver(true)
        setRoleConfirmTarget(null)
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
        setRoleConfirmTarget(null)
        setDriverPayOpen(true)
        return
      }
      setDriverInvoiceId(created.invoiceId)
      setDriverPayUrl(created.payUrl)
      setPendingDriverInvoice(created.invoiceId)
      setRoleConfirmTarget(null)
      await openPaymentUrl(created.payUrl)
      setDriverPayOpen(true)
    } finally {
      setRoleSwitching(false)
    }
  }, [vkUser, setIsDriver, onDriverPaymentVerified])

  const confirmSwitchToPassenger = useCallback(() => {
    setIsDriver(false)
    setRoleConfirmTarget(null)
  }, [setIsDriver])

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
      <header className="relative overflow-hidden bg-gradient-to-b from-[#2787F5] via-[#2680EB] to-[#1F6AD8] px-4 pb-10 pt-6 text-white">
        <div
          className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full border border-white/15 bg-white/5"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-6 left-6 h-24 w-24 rounded-full border border-white/10 bg-white/5"
          aria-hidden
        />

        <div className="relative rounded-2xl border border-white/30 bg-white/10 p-4 shadow-[0_12px_32px_rgba(15,45,90,0.25)] backdrop-blur-[2px]">
          <div className="flex items-start gap-4">
            <div className="shrink-0 rounded-full border-2 border-white/50 bg-white/10 p-0.5 shadow-md">
              {vkUser?.photo_200 ? (
                <img
                  src={vkUser.photo_200}
                  alt={fullName}
                  width={72}
                  height={72}
                  className="h-[4.5rem] w-[4.5rem] rounded-full object-cover"
                />
              ) : (
                <div className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full border border-[#2787F5]/20 bg-white text-xl font-bold text-[#2787F5]">
                  {avatarFallback}
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-lg border border-white/35 bg-white/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                  {isDriver ? <Car className="h-3.5 w-3.5" aria-hidden /> : null}
                  {isDriver ? "Водитель" : "Пассажир"}
                </span>
                {profileStats.reviewsReceived > 0 && profileStats.averageRating != null ? (
                  <span className="inline-flex items-center gap-1 rounded-lg border border-white/25 bg-white/10 px-2 py-1 text-[11px] font-semibold text-white/90">
                    <Star className="h-3 w-3 fill-yellow-300 text-yellow-300" aria-hidden />
                    {ratingLabel}
                  </span>
                ) : (
                  <span className="rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-[11px] font-semibold text-white/75">
                    Нет отзывов
                  </span>
                )}
              </div>

              <h1 className="mt-2 truncate text-xl font-bold leading-tight tracking-tight sm:text-2xl">
                {fullName}
              </h1>

              {trustBadges.length > 0 ? (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {trustBadges.slice(0, 3).map((badge) => (
                    <span
                      key={badge}
                      className="rounded-lg border border-white/25 bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white/95"
                    >
                      {badge}
                    </span>
                  ))}
                </div>
              ) : null}

              <a
                href={profileLink}
                target="_blank"
                rel="noopener noreferrer"
                className="poputi-focus-ring mt-3 inline-flex max-w-full items-center gap-1.5 rounded-lg border border-white/30 bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:border-white/50 hover:bg-white/20"
              >
                <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
                <span className="truncate">
                  {vkUser ? `vk.com/id${vkUser.id}` : "vk.com"}
                </span>
              </a>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/20 pt-4">
            <div className="rounded-xl border border-white/25 bg-white/10 px-2 py-2.5 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-white/65">Уровень</p>
              <p className="mt-0.5 truncate text-sm font-bold">{level}</p>
            </div>
            <div className="rounded-xl border border-white/25 bg-white/10 px-2 py-2.5 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-white/65">Поездок</p>
              <p className="mt-0.5 text-sm font-bold tabular-nums">{profileStats.totalRides}</p>
            </div>
            <div className="rounded-xl border border-white/25 bg-white/10 px-2 py-2.5 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-white/65">Отзывов</p>
              <p className="mt-0.5 text-sm font-bold tabular-nums">{profileStats.reviewsReceived}</p>
            </div>
          </div>

          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-white/70">
              <span>Прогресс уровня</span>
              <span className="tabular-nums">{progressPct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full border border-white/20 bg-white/15">
              <div
                className="h-full rounded-full border-r border-white/20 bg-white shadow-sm transition-[width] duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      <div className="-mt-5 space-y-4 p-4 pb-8">
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
                  if (!isDriver) return
                  setRoleConfirmTarget("passenger")
                }}
                className={`poputi-btn-motion poputi-focus-ring flex-1 whitespace-nowrap rounded-lg px-4 py-2.5 text-center text-sm font-semibold duration-200 ease-out ${
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
                onClick={() => {
                  if (isDriver) return
                  setRoleConfirmTarget("driver")
                }}
                className={`poputi-btn-motion poputi-focus-ring flex-1 whitespace-nowrap rounded-lg px-4 py-2.5 text-center text-sm font-semibold duration-200 ease-out ${
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
              {level}
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
              <div className="h-full rounded-full bg-[#2787F5]" style={{ width: `${progressPct}%` }} />
            </div>
            <p className="mt-2 text-center text-xs font-medium text-gray-500">
              {progressTarget == null
                ? "Максимальный уровень открыт"
                : `${Math.max(0, progressTarget - profileStats.totalRides)} поездок до следующего уровня`}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-gray-50 p-4 text-center">
              <p className="text-xs font-semibold text-gray-500">Рейтинг</p>
              <div className="mt-1 flex items-center justify-center gap-0.5 text-yellow-400">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={cn(
                      "h-4 w-4",
                      s <= starCount ? "fill-current" : "text-gray-200"
                    )}
                  />
                ))}
              </div>
              <p className="mt-1 text-2xl font-bold text-gray-900">{ratingLabel}</p>
              <p className="text-xs text-gray-500">
                {profileStats.reviewsReceived === 0
                  ? "Пока нет отзывов"
                  : `Отзывов: ${profileStats.reviewsReceived}`}
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4 text-center">
              <p className="text-xs font-semibold text-gray-500">Поездок</p>
              <p className="mt-2 text-3xl font-bold text-[#2787F5]">{profileStats.totalRides}</p>
              <p className="text-xs text-gray-500">завершено</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <SettingsSection
            icon={<Radar className="h-5 w-5" />}
            title="Радар"
            caption="Фильтрует варианты на карте под ваш стиль поездок"
          >
            <div className="grid grid-cols-2 gap-2">
              <SettingsInput
                label="Радиус, км"
                type="number"
                min={1}
                max={100}
                value={String(settings.radar.radiusKm)}
                onChange={(value) =>
                  updateSettings((current) => ({
                    ...current,
                    radar: { ...current.radar, radiusKm: Number(value) },
                  }))
                }
              />
              <SettingsInput
                label="До, ₽"
                type="number"
                min={0}
                max={50000}
                step={100}
                value={String(settings.radar.maxPrice)}
                onChange={(value) =>
                  updateSettings((current) => ({
                    ...current,
                    radar: { ...current.radar, maxPrice: Number(value) },
                  }))
                }
              />
              <SettingsInput
                label="Рейтинг от"
                type="number"
                min={1}
                max={5}
                value={String(settings.radar.minRating)}
                onChange={(value) =>
                  updateSettings((current) => ({
                    ...current,
                    radar: { ...current.radar, minRating: Number(value) },
                  }))
                }
              />
              <TogglePill
                label="Только свежие"
                checked={settings.radar.freshOnly}
                onChange={(checked) =>
                  updateSettings((current) => ({
                    ...current,
                    radar: { ...current.radar, freshOnly: checked },
                  }))
                }
              />
            </div>
          </SettingsSection>

          <SettingsSection
            icon={<Route className="h-5 w-5" />}
            title="Быстрые маршруты"
            caption="Появятся в форме заявки как готовые шаблоны"
          >
            <div className="space-y-3">
              {settings.routes.map((route, index) => (
                <QuickRouteCard
                  key={route.id}
                  route={route}
                  onFromChange={(value) =>
                    updateSettings((current) => ({
                      ...current,
                      routes: current.routes.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, from: value } : item
                      ),
                    }))
                  }
                  onToChange={(value) =>
                    updateSettings((current) => ({
                      ...current,
                      routes: current.routes.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, to: value } : item
                      ),
                    }))
                  }
                />
              ))}
            </div>
          </SettingsSection>

          {isDriver ? (
            <SettingsSection
              icon={<Car className="h-5 w-5" />}
              title="Водитель"
              caption="Авто и условия подтянутся в межгород"
            >
              <div className="grid gap-3">
                <SettingsInput
                  label="Авто"
                  value={settings.driver.carModel}
                  placeholder="Kia Rio"
                  onChange={(value) =>
                    updateSettings((current) => ({
                      ...current,
                      driver: { ...current.driver, carModel: value },
                    }))
                  }
                />
                <div className="grid grid-cols-2 gap-3">
                  <SettingsInput
                    label="Цвет"
                    value={settings.driver.carColor}
                    placeholder="белый"
                    onChange={(value) =>
                      updateSettings((current) => ({
                        ...current,
                        driver: { ...current.driver, carColor: value },
                      }))
                    }
                  />
                  <SettingsInput
                    label="Мест"
                    type="number"
                    min={1}
                    max={8}
                    value={String(settings.driver.seats)}
                    onChange={(value) =>
                      updateSettings((current) => ({
                        ...current,
                        driver: { ...current.driver, seats: Number(value) },
                      }))
                    }
                  />
                </div>
                <PaymentMethodControl
                  value={settings.driver.paymentMethod}
                  onChange={(value) =>
                    updateSettings((current) => ({
                      ...current,
                      driver: { ...current.driver, paymentMethod: value },
                    }))
                  }
                />
                <SettingsInput
                  label="На линии до"
                  type="time"
                  value={settings.driver.onlineUntil}
                  onChange={(value) =>
                    updateSettings((current) => ({
                      ...current,
                      driver: { ...current.driver, onlineUntil: value },
                    }))
                  }
                />
              </div>
            </SettingsSection>
          ) : null}

          <SettingsSection
            icon={<Bell className="h-5 w-5" />}
            title="Уведомления"
            caption="Что важно подсвечивать и присылать через VK"
          >
            <div className="space-y-2">
              <ToggleRow
                label="Водители рядом"
                checked={settings.notifications.nearbyDrivers}
                onChange={(checked) =>
                  updateSettings((current) => ({
                    ...current,
                    notifications: { ...current.notifications, nearbyDrivers: checked },
                  }))
                }
              />
              <ToggleRow
                label="Ответы в чатах"
                checked={settings.notifications.replies}
                onChange={(checked) =>
                  updateSettings((current) => ({
                    ...current,
                    notifications: { ...current.notifications, replies: checked },
                  }))
                }
              />
              <ToggleRow
                label="Поездка скоро"
                checked={settings.notifications.rideSoon}
                onChange={(checked) =>
                  updateSettings((current) => ({
                    ...current,
                    notifications: { ...current.notifications, rideSoon: checked },
                  }))
                }
              />
              <ToggleRow
                label="VK-сообщения"
                checked={settings.notifications.vkMessages}
                onChange={(checked) =>
                  updateSettings((current) => ({
                    ...current,
                    notifications: { ...current.notifications, vkMessages: checked },
                  }))
                }
              />
            </div>
          </SettingsSection>

          <SettingsSection
            icon={<Shield className="h-5 w-5" />}
            title="Безопасность"
            caption="Контакт и приватность для активных поездок"
          >
            <div className="grid gap-3">
              <SettingsInput
                label="Доверенный контакт"
                value={settings.safety.trustedContactName}
                placeholder="Имя"
                onChange={(value) =>
                  updateSettings((current) => ({
                    ...current,
                    safety: { ...current.safety, trustedContactName: value },
                  }))
                }
              />
              <SettingsPhoneInput
                label="Телефон"
                value={settings.safety.trustedContactPhone}
                onChange={(value) =>
                  updateSettings((current) => ({
                    ...current,
                    safety: { ...current.safety, trustedContactPhone: value },
                  }))
                }
              />
              <ToggleRow
                label="Делиться поездкой"
                checked={settings.safety.shareRide}
                onChange={(checked) =>
                  updateSettings((current) => ({
                    ...current,
                    safety: { ...current.safety, shareRide: checked },
                  }))
                }
              />
              <ToggleRow
                label="Скрывать VK до принятия"
                checked={settings.safety.hideVkUntilAccepted}
                onChange={(checked) =>
                  updateSettings((current) => ({
                    ...current,
                    safety: { ...current.safety, hideVkUntilAccepted: checked },
                  }))
                }
              />
            </div>
          </SettingsSection>

          <SettingsSection
            icon={<MapPinned className="h-5 w-5" />}
            title="Бейджи профиля"
            caption="Показывают, почему с вами спокойнее ехать"
          >
            <div className="flex flex-wrap gap-2">
              {trustBadges.map((badge) => (
                <span key={badge} className="rounded-full bg-[#F0F6FF] px-3 py-1.5 text-xs font-bold text-[#2787F5]">
                  {badge}
                </span>
              ))}
            </div>
          </SettingsSection>
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

      {roleConfirmTarget ? (
        <RoleSwitchConfirmDialog
          target={roleConfirmTarget}
          switching={roleSwitching}
          onCancel={closeRoleConfirm}
          onConfirm={() => {
            if (roleConfirmTarget === "driver") {
              void confirmSwitchToDriver()
              return
            }
            confirmSwitchToPassenger()
          }}
        />
      ) : null}

      {driverPayOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 safe-area-bottom">
          <button
            type="button"
            className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm motion-reduce:backdrop-blur-none"
            aria-label="Закрыть окно оплаты"
            onClick={() => {
              setDriverPayOpen(false)
              setDriverChecking(false)
            }}
          />
          <div
            className="relative w-full max-w-sm overscroll-contain rounded-[2rem] bg-white p-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="driver-pay-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="driver-pay-title" className="text-lg font-bold text-gray-900">
              Доступ водителя — {DRIVER_ACCESS_PRICE_LABEL}
            </h2>
            {driverPayError ? (
              <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">
                {driverPayError}
              </p>
            ) : null}
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
                className="poputi-btn-motion poputi-focus-ring mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#2787F5] py-3 text-sm font-semibold text-white shadow-lg shadow-[#2787F5]/30 hover:bg-[#1F6AD8] active:scale-[0.98]"
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
                className="poputi-btn-motion poputi-focus-ring w-full rounded-xl bg-gray-900 py-3 text-sm font-semibold text-white hover:bg-gray-800 active:scale-[0.98] disabled:bg-gray-200 disabled:text-gray-400"
              >
                {driverChecking ? "Проверка…" : "Проверить оплату"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDriverPayOpen(false)
                  setDriverChecking(false)
                }}
                className="poputi-btn-motion poputi-focus-ring w-full rounded-xl bg-gray-100 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-200 active:scale-95"
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

function RoleSwitchConfirmDialog({
  target,
  switching,
  onCancel,
  onConfirm,
}: {
  target: "driver" | "passenger"
  switching: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const isDriver = target === "driver"
  const titleId = isDriver ? "role-confirm-driver-title" : "role-confirm-passenger-title"

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !switching) onCancel()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onCancel, switching])

  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center p-4 sm:items-center safe-area-bottom">
      <button
        type="button"
        className="absolute inset-0 bg-gray-900/45 backdrop-blur-sm motion-reduce:backdrop-blur-none motion-reduce:animate-none animate-in fade-in duration-200"
        aria-label="Отменить смену роли"
        disabled={switching}
        onClick={onCancel}
      />
      <div
        className="relative w-full max-w-sm motion-reduce:animate-none animate-in slide-in-from-bottom-4 fade-in duration-300 sm:zoom-in-95"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="overflow-hidden rounded-[1.75rem] border border-gray-100 bg-white shadow-2xl">
          <div
            className={cn(
              "px-6 pb-5 pt-6 text-center",
              isDriver
                ? "bg-gradient-to-b from-[#2787F5] to-[#1F6AD8] text-white"
                : "bg-gradient-to-b from-gray-50 to-white text-gray-900"
            )}
          >
            <div
              className={cn(
                "mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border shadow-md",
                isDriver
                  ? "border-white/35 bg-white/15 text-white"
                  : "border-[#2787F5]/20 bg-[#F0F6FF] text-[#2787F5]"
              )}
            >
              {isDriver ? <Car className="h-8 w-8" aria-hidden /> : <MapPinned className="h-8 w-8" aria-hidden />}
            </div>
            <h2 id={titleId} className="mt-4 text-xl font-bold tracking-tight">
              {isDriver ? "Стать водителем?" : "Стать пассажиром?"}
            </h2>
            <p
              className={cn(
                "mt-2 text-sm leading-relaxed",
                isDriver ? "text-white/85" : "text-gray-500"
              )}
            >
              {isDriver
                ? "Сможете принимать заказы в межгороде. Ниже появятся поля авто и условий поездки."
                : "Будете искать поездки на карте. Поля авто скроются, но сохранятся в настройках."}
            </p>
          </div>

          <ul className="space-y-2 border-b border-gray-100 px-6 py-4 text-sm text-gray-600">
            {(isDriver
              ? ["Приём заявок в межгороде", "Настройка авто и оплаты", "Режим «на линии»"]
              : ["Поиск поездок на карте", "Заявки как пассажир", "Без полей водителя"]
            ).map((item) => (
              <li key={item} className="flex items-center gap-2.5">
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                    isDriver ? "bg-[#F0F6FF] text-[#2787F5]" : "bg-gray-100 text-gray-600"
                  )}
                  aria-hidden
                >
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-2 p-4">
            <button
              type="button"
              disabled={switching}
              onClick={onConfirm}
              className={cn(
                "poputi-btn-motion poputi-focus-ring w-full rounded-xl py-3.5 text-sm font-bold text-white shadow-lg active:scale-[0.98] disabled:opacity-70",
                isDriver
                  ? "bg-[#2787F5] shadow-[#2787F5]/30 hover:bg-[#1F6AD8]"
                  : "bg-gray-900 shadow-gray-900/20 hover:bg-gray-800"
              )}
            >
              {switching
                ? "Переключаем…"
                : isDriver
                  ? "Да, я водитель"
                  : "Да, я пассажир"}
            </button>
            <button
              type="button"
              disabled={switching}
              onClick={onCancel}
              className="poputi-btn-motion poputi-focus-ring w-full rounded-xl bg-gray-100 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-200 active:scale-95 disabled:opacity-60"
            >
              {isDriver ? "Остаться пассажиром" : "Остаться водителем"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SettingsSection({
  icon,
  title,
  caption,
  children,
}: {
  icon: ReactNode
  title: string
  caption: string
  children: ReactNode
}) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-3.5 shadow-sm">
      <div className="mb-2.5 flex items-start gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F0F6FF] text-[#2787F5]">
          {icon}
        </span>
        <div className="min-w-0">
          <h3 className="text-[15px] font-bold leading-tight text-gray-900">{title}</h3>
          <p className="mt-0.5 text-xs leading-snug text-gray-500">{caption}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

const QUICK_ROUTE_META: Record<
  string,
  {
    icon: typeof Home
    iconClass: string
    chipClass: string
    fromPlaceholder: string
    toPlaceholder: string
  }
> = {
  home: {
    icon: Home,
    iconClass: "border-amber-200/80 bg-amber-50 text-amber-600",
    chipClass: "bg-amber-50 text-amber-700",
    fromPlaceholder: "Дом, улица…",
    toPlaceholder: "Куда обычно едете…",
  },
  work: {
    icon: Briefcase,
    iconClass: "border-violet-200/80 bg-violet-50 text-violet-600",
    chipClass: "bg-violet-50 text-violet-700",
    fromPlaceholder: "Офис, район…",
    toPlaceholder: "Пункт назначения…",
  },
  station: {
    icon: TrainFront,
    iconClass: "border-sky-200/80 bg-sky-50 text-sky-600",
    chipClass: "bg-sky-50 text-sky-700",
    fromPlaceholder: "Вокзал, станция…",
    toPlaceholder: "Куда после поезда…",
  },
  study: {
    icon: GraduationCap,
    iconClass: "border-emerald-200/80 bg-emerald-50 text-emerald-600",
    chipClass: "bg-emerald-50 text-emerald-700",
    fromPlaceholder: "Университет, кампус…",
    toPlaceholder: "Обратно или в город…",
  },
}

function QuickRouteCard({
  route,
  onFromChange,
  onToChange,
}: {
  route: { id: string; label: string; from: string; to: string }
  onFromChange: (value: string) => void
  onToChange: (value: string) => void
}) {
  const meta =
    QUICK_ROUTE_META[route.id] ?? {
      icon: MapPinned,
      iconClass: "border-[#2787F5]/25 bg-[#F0F6FF] text-[#2787F5]",
      chipClass: "bg-[#F0F6FF] text-[#2787F5]",
      fromPlaceholder: "Откуда",
      toPlaceholder: "Куда",
    }
  const Icon = meta.icon
  const isFilled = Boolean(route.from.trim() && route.to.trim())
  const isPartial = Boolean(route.from.trim() || route.to.trim())

  return (
    <article className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border shadow-sm",
              meta.iconClass
            )}
          >
            <Icon className="h-4 w-4" strokeWidth={2.25} aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold leading-tight text-gray-900">{route.label}</p>
            <p className="text-[10px] leading-tight text-gray-500">
              {isFilled ? "Готов к подстановке в заявку" : isPartial ? "Дозаполните вторую точку" : "Шаблон маршрута"}
            </p>
          </div>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
            isFilled ? meta.chipClass : "bg-gray-100 text-gray-400"
          )}
        >
          {isFilled ? "Готов" : isPartial ? "Частично" : "Пусто"}
        </span>
      </div>

      <div className="relative px-3 py-2.5">
        <div className="relative">
          <div
            className="pointer-events-none absolute left-2.5 top-6 bottom-6 w-0.5 -translate-x-1/2 rounded-full bg-gradient-to-b from-gray-300 via-gray-200 to-[#2787F5]/70"
            aria-hidden
          />
          <div className="space-y-2">
            <QuickRoutePointField
              label="Откуда"
              value={route.from}
              placeholder={meta.fromPlaceholder}
              variant="from"
              onChange={onFromChange}
            />
            <QuickRoutePointField
              label="Куда"
              value={route.to}
              placeholder={meta.toPlaceholder}
              variant="to"
              onChange={onToChange}
            />
          </div>
        </div>
      </div>
    </article>
  )
}

function QuickRoutePointField({
  label,
  value,
  placeholder,
  variant,
  onChange,
}: {
  label: string
  value: string
  placeholder: string
  variant: "from" | "to"
  onChange: (value: string) => void
}) {
  const isTo = variant === "to"

  return (
    <div className="flex items-stretch gap-2.5">
      <div className="flex w-5 shrink-0 justify-center self-start pt-4">
        <span
          className={cn(
            "relative z-10 box-border h-2.5 w-2.5 shrink-0 rounded-full border-2 shadow-sm",
            isTo ? "border-[#2787F5] bg-[#2787F5]" : "border-gray-800 bg-white"
          )}
          aria-hidden
        />
      </div>
      <label
        className={cn(
          "min-w-0 flex-1 rounded-lg border bg-gray-50/80 px-2.5 py-2 transition-[border-color,background-color,box-shadow]",
          "focus-within:border-[#2787F5]/35 focus-within:bg-white focus-within:shadow-sm focus-within:ring-2 focus-within:ring-[#2787F5]/12",
          value.trim() ? "border-gray-200" : "border-gray-100"
        )}
      >
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</span>
        <input
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className="mt-0.5 w-full border-0 bg-transparent py-0.5 text-sm font-semibold leading-tight text-gray-900 placeholder:font-medium placeholder:text-gray-300 outline-none focus:ring-0"
          aria-label={`${label}, ${placeholder}`}
        />
      </label>
    </div>
  )
}

function clampNumber(value: number, min?: number, max?: number) {
  let next = value
  if (min != null) next = Math.max(min, next)
  if (max != null) next = Math.min(max, next)
  return next
}

function SettingsInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  error,
  onBlur,
  inputMode,
  autoComplete,
  min,
  max,
  step = 1,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: "text" | "number" | "time" | "tel"
  placeholder?: string
  error?: string | null
  onBlur?: () => void
  inputMode?: "text" | "numeric" | "tel"
  autoComplete?: string
  min?: number
  max?: number
  step?: number
}) {
  if (type === "number") {
    const parsed = Number(value)
    const numeric = Number.isFinite(parsed) ? parsed : (min ?? 0)
    const atMin = min != null && numeric <= min
    const atMax = max != null && numeric >= max

    const applyDelta = (delta: number) => {
      onChange(String(clampNumber(numeric + delta * step, min, max)))
    }

    return (
      <div className="rounded-xl border border-gray-100 bg-gray-50/90 px-2 py-1.5">
        <span className="block truncate text-[10px] font-semibold leading-tight text-gray-500">{label}</span>
        <div className="mt-0.5 flex items-center gap-1">
          <button
            type="button"
            aria-label={`Уменьшить: ${label}`}
            disabled={atMin}
            onClick={() => applyDelta(-1)}
            className="poputi-btn-motion poputi-focus-ring flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center disabled:cursor-not-allowed"
          >
            <span
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200/90 bg-white text-gray-600 shadow-sm",
                atMin && "opacity-40"
              )}
            >
              <Minus className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
            </span>
          </button>
          <input
            type="text"
            inputMode="numeric"
            value={value}
            placeholder={placeholder}
            onChange={(event) => {
              const raw = event.target.value.replace(/[^\d]/g, "")
              if (raw === "") {
                onChange("")
                return
              }
              onChange(String(clampNumber(Number(raw), min, max)))
            }}
            onBlur={() => {
              if (value === "" || !Number.isFinite(Number(value))) {
                onChange(String(min ?? 0))
              }
              onBlur?.()
            }}
            className={cn(
              "min-w-0 flex-1 border-0 bg-transparent py-0.5 text-center text-base font-bold tabular-nums leading-none text-gray-900 outline-none focus:ring-0",
              error && "text-red-700"
            )}
            aria-invalid={error ? true : undefined}
            aria-label={label}
          />
          <button
            type="button"
            aria-label={`Увеличить: ${label}`}
            disabled={atMax}
            onClick={() => applyDelta(1)}
            className="poputi-btn-motion poputi-focus-ring flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center disabled:cursor-not-allowed"
          >
            <span
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-lg border border-[#2787F5]/30 bg-[#2787F5] text-white shadow-sm shadow-[#2787F5]/20",
                atMax && "opacity-40"
              )}
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
            </span>
          </button>
        </div>
        {error ? <p className="mt-0.5 text-[11px] font-medium text-red-600">{error}</p> : null}
      </div>
    )
  }

  return (
    <label className="block rounded-xl border border-gray-100 bg-gray-50/90 px-2.5 py-1.5 focus-within:border-[#2787F5]/30 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#2787F5]/12">
      <span className="text-[10px] font-semibold text-gray-500">{label}</span>
      <input
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        className={cn(
          "mt-0.5 w-full border-0 bg-transparent py-0.5 text-sm font-semibold text-gray-900 shadow-none ring-0 ring-offset-0 placeholder:text-gray-300 outline-none focus:border-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0",
          error && "text-red-700"
        )}
        aria-invalid={error ? true : undefined}
      />
      {error ? <p className="mt-0.5 text-[11px] font-medium text-red-600">{error}</p> : null}
    </label>
  )
}

function SettingsPhoneInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  const [touched, setTouched] = useState(false)
  const display = formatRuPhoneDisplay(value)
  const error = touched ? ruPhoneValidationMessage(value) : null

  return (
    <SettingsInput
      label={label}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      value={display}
      placeholder="+7 (900) 000-00-00"
      error={error}
      onChange={(raw) => onChange(formatRuPhoneInput(raw))}
      onBlur={() => setTouched(true)}
    />
  )
}

function TogglePill({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "flex min-h-[3.75rem] w-full touch-manipulation flex-col justify-between rounded-xl border px-2.5 py-2 text-left transition-[border-color,background-color,box-shadow]",
        checked
          ? "border-[#2787F5]/35 bg-[#F0F6FF] shadow-sm shadow-[#2787F5]/10"
          : "border-gray-100 bg-gray-50/90"
      )}
      aria-pressed={checked}
    >
      <span className="text-[10px] font-semibold leading-tight text-gray-500">{label}</span>
      <span
        className={cn(
          "text-sm font-bold leading-none",
          checked ? "text-[#2787F5]" : "text-gray-400"
        )}
      >
        {checked ? "Вкл" : "Выкл"}
      </span>
    </button>
  )
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-2xl bg-gray-50 px-3 py-2.5 text-left"
      aria-pressed={checked}
    >
      <span className="text-sm font-semibold text-gray-900">{label}</span>
      <span className={cn("h-6 w-11 rounded-full p-0.5 transition-colors", checked ? "bg-[#2787F5]" : "bg-gray-300")}>
        <span
          className={cn(
            "block h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
            checked ? "translate-x-5" : "translate-x-0"
          )}
        />
      </span>
    </button>
  )
}

function PaymentMethodControl({
  value,
  onChange,
}: {
  value: UserSettings["driver"]["paymentMethod"]
  onChange: (value: UserSettings["driver"]["paymentMethod"]) => void
}) {
  const options: { value: UserSettings["driver"]["paymentMethod"]; label: string }[] = [
    { value: "any", label: "Любая" },
    { value: "transfer", label: "Перевод" },
    { value: "cash", label: "Наличные" },
  ]

  return (
    <div className="rounded-2xl bg-gray-50 p-1">
      <div className="mb-1 px-2 text-xs font-semibold text-gray-500">Оплата</div>
      <div className="grid grid-cols-3 gap-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-xl px-2 py-2 text-xs font-bold transition-colors",
              value === option.value ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
            )}
            aria-pressed={value === option.value}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function nextLevelTarget(totalRides: number): number | null {
  if (totalRides <= 5) return 6
  if (totalRides <= 20) return 21
  if (totalRides <= 50) return 51
  return null
}

function buildTrustBadges(
  totalRides: number,
  averageRating: number | null,
  reviewsReceived: number,
  settings: UserSettings,
  isDriver: boolean
): string[] {
  const badges = [calculateUserLevel(totalRides, ratingForLevel(averageRating))]
  if (hasHighRating(averageRating, reviewsReceived)) badges.push("Высокий рейтинг")
  if (totalRides >= 10) badges.push("Опытный попутчик")
  if (isValidRuPhone(settings.safety.trustedContactPhone) && settings.safety.trustedContactPhone.trim()) {
    badges.push("Контакт безопасности")
  }
  if (isDriver && settings.driver.carModel.trim()) badges.push("Авто указано")
  if (settings.notifications.vkMessages) badges.push("На связи")
  return [...new Set(badges)]
}
