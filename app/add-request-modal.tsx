"use client"

import { useEffect, useState } from "react"
import { assertNotBanned, BANNED_USER_MESSAGE } from "@/lib/banned-users"
import { geocodeAddress, randomCoordsNearCity } from "@/lib/geocode"
import { supabase } from "@/lib/supabase-client"
import { APP_CITY_COORDS, type AppCity } from "@/lib/cities"
import {
  DEFAULT_USER_SETTINGS,
  loadUserSettings,
  type RouteTemplate,
  type UserSettings,
} from "@/lib/user-settings"
import type { AddModalVariant, Mode, VkUserProfile } from "./types"
import { vkIdTagFromNumericId } from "./helpers"
import { BottomSheet, RouteTimeline, poputi } from "@/components/poputi/ui"
import { Minus, Navigation, Plus } from "lucide-react"
import { cn } from "@/lib/utils"

async function insertRideWithFallback(
  fullRow: Record<string, unknown>,
  legacyRow: Record<string, unknown>
): Promise<{ error: { message: string } | null }> {
  let { error } = await supabase.from("rides").insert([fullRow])
  if (!error) return { error: null }
  const second = await supabase.from("rides").insert([legacyRow])
  error = second.error
  if (!error) return { error: null }
  const { total_seats: _a, available_seats: _b, depart_at: _d, car: _c, ...minimal } = legacyRow
  const third = await supabase.from("rides").insert([minimal])
  return { error: third.error }
}

const MIN_RIDE_PRICE = 90
const PRICE_STEP = 10

function normalizePriceDigits(raw: string): string {
  return raw.replace(/\D/g, "")
}

function parseRidePrice(raw: string): number | null {
  const digits = normalizePriceDigits(raw)
  if (!digits) return null
  return parseInt(digits, 10)
}

function isRidePriceValid(raw: string): boolean {
  const n = parseRidePrice(raw)
  return n != null && n >= MIN_RIDE_PRICE
}

function clampRidePrice(raw: string): number {
  const n = parseRidePrice(raw)
  if (n == null) return MIN_RIDE_PRICE
  return Math.max(MIN_RIDE_PRICE, n)
}

export function AddRequestModal({
  variant,
  pinCoords,
  onClose,
  onRideAdded,
  userRole,
  mode,
  city,
  vkUser,
}: {
  variant: AddModalVariant
  pinCoords?: { lat: number; lng: number } | null
  onClose: () => void
  onRideAdded: () => void
  userRole: string
  mode: Mode
  city: AppCity
  vkUser: VkUserProfile | null
}) {
  const disableT9 = {
    autoComplete: "off" as const,
    autoCorrect: "off" as const,
    spellCheck: false as const,
    inputMode: "text" as const,
  }
  const [whereStanding, setWhereStanding] = useState("")
  const [toCity, setToCity] = useState("")
  const [comment, setComment] = useState("")
  const [address, setAddress] = useState("")
  const [to, setTo] = useState("")
  const [price, setPrice] = useState("")
  const [carModel, setCarModel] = useState("")
  const [departAtLocal, setDepartAtLocal] = useState("")
  const [citySeats, setCitySeats] = useState(4)
  const [seatCount, setSeatCount] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS)

  const vkTag = vkUser?.id ? vkIdTagFromNumericId(vkUser.id) : ""

  useEffect(() => {
    const loaded = loadUserSettings()
    setSettings(loaded)
    setCitySeats(loaded.driver.seats)
    const carLabel = [loaded.driver.carModel, loaded.driver.carColor].filter(Boolean).join(", ")
    if (carLabel) setCarModel(carLabel)
  }, [])

  const applyRouteTemplate = (route: RouteTemplate) => {
    if (variant === "intercity") {
      setAddress(route.from)
      setTo(route.to)
    } else {
      setWhereStanding(route.from)
      setToCity(route.to)
    }
  }

  const resolveCoords = async (addr: string) => {
    const geocoded = await geocodeAddress(city, addr)
    if (geocoded) return geocoded
    if (pinCoords) return pinCoords
    return randomCoordsNearCity(city)
  }

  const guardBanned = async (): Promise<boolean> => {
    if (!vkTag) return true
    const msg = await assertNotBanned(supabase, vkTag)
    if (msg) {
      setSubmitError(msg)
      return false
    }
    return true
  }

  const handleSubmitCityDriver = async () => {
    if (!whereStanding.trim() || !toCity.trim() || isSubmitting) return
    if (!(await guardBanned())) return

    const [fallbackLat, fallbackLng] = APP_CITY_COORDS[city]
    const lat = pinCoords?.lat ?? fallbackLat
    const lng = pinCoords?.lng ?? fallbackLng

    setIsSubmitting(true)
    setSubmitError(null)

    const fromBase = whereStanding.trim()
    const avatarUrl = settings.privacy.hideAvatar ? null : (vkUser?.photo_200 || null)
    const driverNote = buildDriverNote(settings)
    const fullRow = {
      lat,
      lng,
      price: 0,
      type: "Driver",
      status: "searching",
      from_location: fromBase,
      to_location: toCity.trim(),
      comment: [comment.trim(), driverNote].filter(Boolean).join(" · ") || null,
      name: vkUser
        ? (settings.privacy.hideAvatar
            ? (vkUser.first_name?.trim() || "Аноним")
            : `${vkUser.first_name} ${vkUser.last_name}`.trim())
        : "Пользователь VK",
      vk_id: vkTag,
      avatar: avatarUrl,
      car: carModel.trim() || null,
      city,
      total_seats: citySeats,
      available_seats: citySeats,
    }

    const legacyRow = {
      lat,
      lng,
      price: 0,
      type: "Driver",
      from_location: [fromBase, comment.trim(), driverNote].filter(Boolean).join(" · ").slice(0, 320),
      to_location: toCity.trim(),
      name: fullRow.name,
      vk_id: vkTag,
      city,
    }

    const { error } = await insertRideWithFallback(fullRow, legacyRow)
    setIsSubmitting(false)
    if (error) {
      setSubmitError(error.message.includes("user_banned") ? BANNED_USER_MESSAGE : error.message || "Не удалось опубликовать.")
      return
    }
    onRideAdded()
    onClose()
  }

  const handleSubmitCityPassenger = async () => {
    if (!whereStanding.trim() || !toCity.trim() || !isRidePriceValid(price) || isSubmitting) return
    if (!(await guardBanned())) return

    setIsSubmitting(true)
    setSubmitError(null)

    const coords = await resolveCoords(whereStanding.trim())
    const priceNum = clampRidePrice(price)
    const avatarUrl = settings.privacy.hideAvatar ? null : (vkUser?.photo_200 || null)

    const fullRow = {
      lat: coords.lat,
      lng: coords.lng,
      price: priceNum,
      type: "City",
      status: "searching",
      from_location: whereStanding.trim(),
      to_location: toCity.trim(),
      comment: comment.trim() || null,
      name: vkUser
        ? (settings.privacy.hideAvatar
            ? (vkUser.first_name?.trim() || "Аноним")
            : `${vkUser.first_name} ${vkUser.last_name}`.trim())
        : "Пользователь VK",
      vk_id: vkTag,
      avatar: avatarUrl,
      city,
      total_seats: seatCount,
      available_seats: seatCount,
    }

    const legacyRow = {
      lat: coords.lat,
      lng: coords.lng,
      price: priceNum,
      type: "City",
      from_location: fullRow.from_location,
      to_location: fullRow.to_location,
      name: fullRow.name,
      vk_id: vkTag,
      city,
    }

    const { error } = await insertRideWithFallback(fullRow, legacyRow)
    setIsSubmitting(false)
    if (error) {
      setSubmitError(error.message.includes("user_banned") ? BANNED_USER_MESSAGE : error.message || "Не удалось опубликовать.")
      return
    }
    onRideAdded()
    onClose()
  }

  const handleSubmitIntercity = async () => {
    if (!isRidePriceValid(price) || !address.trim() || !to.trim() || isSubmitting) return
    if (!(await guardBanned())) return

    setIsSubmitting(true)
    setSubmitError(null)

    const coords = address.trim() ? await resolveCoords(address.trim()) : randomCoordsNearCity(city)
    const fromLoc = address.trim()
    const toLoc = to.trim()
    const departAtIso = departAtLocal ? new Date(departAtLocal).toISOString() : null
    const avatarUrl = settings.privacy.hideAvatar ? null : (vkUser?.photo_200 || null)
    const driverNote = userRole === "Driver" ? buildDriverNote(settings) : ""
    const priceNum = clampRidePrice(price)

    const fullRow: Record<string, unknown> = {
      lat: coords.lat,
      lng: coords.lng,
      price: priceNum,
      type: userRole,
      status: "searching",
      from_location: fromLoc,
      to_location: toLoc,
      comment: [comment.trim(), driverNote].filter(Boolean).join(" · ") || null,
      name: vkUser
        ? (settings.privacy.hideAvatar
            ? (vkUser.first_name?.trim() || "Аноним")
            : `${vkUser.first_name} ${vkUser.last_name}`.trim())
        : "Пользователь VK",
      vk_id: vkTag,
      avatar: avatarUrl,
      city,
      total_seats: seatCount,
      available_seats: seatCount,
      car: carModel.trim() || null,
      depart_at: departAtIso,
    }

    const legacyRow: Record<string, unknown> = {
      lat: coords.lat,
      lng: coords.lng,
      price: priceNum,
      type: userRole,
      from_location: [fromLoc, comment.trim(), driverNote].filter(Boolean).join(" · ").slice(0, 320),
      to_location: toLoc,
      name: fullRow.name,
      vk_id: vkTag,
      city,
    }

    const { error } = await insertRideWithFallback(fullRow, legacyRow)
    setIsSubmitting(false)
    if (error) {
      setSubmitError(error.message.includes("user_banned") ? BANNED_USER_MESSAGE : error.message || "Не удалось опубликовать.")
      return
    }
    onRideAdded()
    onClose()
  }

  if (variant === "cityDriver") {
    return (
      <BottomSheet onClose={onClose} className="max-h-[86vh] overflow-y-auto pb-12">
        <header className="mb-3">
          <h2 className="text-lg font-bold tracking-tight text-gray-900">На линию — водитель</h2>
          <p className="mt-0.5 text-xs text-gray-500">По городу · пассажиры увидят вас на карте</p>
        </header>
        <p className="mb-3 rounded-xl bg-gray-50 px-3 py-2 text-xs leading-relaxed text-gray-500 ring-1 ring-gray-100">
          Точка на карте — центр экрана при открытии формы. Передвиньте карту и откройте снова, чтобы сменить пин.
        </p>
        <RouteTemplatePicker routes={settings.routes} onSelect={applyRouteTemplate} />
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Где я стою (ориентир)"
            value={whereStanding}
            {...disableT9}
            onChange={(e) => setWhereStanding(e.target.value)}
            className={cn(poputi.input, "w-full")}
          />
          <input
            type="text"
            placeholder="Куда еду по городу"
            value={toCity}
            {...disableT9}
            onChange={(e) => setToCity(e.target.value)}
            className={cn(poputi.input, "w-full")}
          />
          <textarea
            placeholder="Комментарий (необязательно)"
            value={comment}
            {...disableT9}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            className={cn(poputi.input, "w-full resize-none")}
          />
          <SeatCountPicker value={citySeats} onChange={setCitySeats} label="Свободных мест" />
          {submitError && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{submitError}</p>}
        </div>
        <button
          type="button"
          onClick={() => void handleSubmitCityDriver()}
          disabled={isSubmitting || !whereStanding.trim() || !toCity.trim()}
          className={cn(poputi.btnPrimary, "mt-4")}
        >
          {isSubmitting ? "Публикация…" : "Опубликовать на карте"}
        </button>
      </BottomSheet>
    )
  }

  if (variant === "cityPassenger") {
    return (
      <BottomSheet onClose={onClose} className="max-h-[88vh] overflow-y-auto pb-10">
        <header className="mb-3">
          <h2 className="text-lg font-bold tracking-tight text-gray-900">Куда поедем?</h2>
          <p className="mt-0.5 text-xs text-gray-500">По городу · водители увидят заявку на карте</p>
        </header>

        <RouteTemplatePicker routes={settings.routes} onSelect={applyRouteTemplate} />

        <section className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
          <RouteTimeline
            from={whereStanding}
            onFromChange={setWhereStanding}
            to={toCity}
            onToChange={setToCity}
            fromPlaceholder="Откуда забрать"
            toPlaceholder="Куда едем?"
            toExtra={
              <Navigation className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            }
          />
        </section>

        <section className="mt-2.5 space-y-2.5 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
          <RidePriceStepper value={price} onChange={setPrice} />
          <div>
            <label
              htmlFor="poputi-ride-comment"
              className="text-[10px] font-semibold uppercase tracking-wide text-gray-500"
            >
              Комментарий водителю
            </label>
            <textarea
              id="poputi-ride-comment"
              name="city_passenger_comment"
              placeholder="Необязательно"
              value={comment}
              {...disableT9}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              className={cn(poputi.input, "mt-1 w-full resize-none py-2.5 text-sm")}
            />
          </div>
          <SeatCountPicker value={seatCount} onChange={setSeatCount} label="Сколько мест нужно" />
        </section>

        {submitError ? (
          <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">
            {submitError}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => void handleSubmitCityPassenger()}
          disabled={isSubmitting || !isRidePriceValid(price) || !whereStanding.trim() || !toCity.trim()}
          className={cn(poputi.btnPrimary, "mt-4 py-3.5 text-base")}
        >
          {isSubmitting ? "Публикация…" : "Заказать поездку"}
        </button>
      </BottomSheet>
    )
  }

  return (
    <BottomSheet onClose={onClose} className="max-h-[86vh] overflow-y-auto pb-12">
      <header className="mb-3">
        <h2 className="text-lg font-bold tracking-tight text-gray-900">Межгород — {city}</h2>
        <p className="mt-0.5 text-xs text-gray-500">Маршрут попадёт во вкладку «Межгород» вашего города</p>
      </header>
      <RouteTemplatePicker routes={settings.routes} onSelect={applyRouteTemplate} />
      <div className="space-y-3">
        <input
          type="text"
          name="intercity_from"
          placeholder="Откуда (город или адрес)…"
          value={address}
          {...disableT9}
          onChange={(e) => setAddress(e.target.value)}
          aria-label="Откуда"
          className={cn(poputi.input, "w-full")}
        />
        <input
          type="text"
          name="intercity_to"
          placeholder="Куда…"
          value={to}
          {...disableT9}
          onChange={(e) => setTo(e.target.value)}
          aria-label="Куда"
          className={cn(poputi.input, "w-full")}
        />
        <input
          type="datetime-local"
          name="intercity_depart_at"
          value={departAtLocal}
          onChange={(e) => setDepartAtLocal(e.target.value)}
          aria-label="Время выезда"
          className={cn(poputi.input, "w-full")}
        />
        <p className="-mt-2 text-xs text-gray-500">Время выезда (необязательно)</p>
        <RidePriceStepper value={price} onChange={setPrice} label="Цена за место" />
        <input
          type="text"
          name="intercity_car"
          placeholder="Авто (напр. Kia Rio)…"
          value={carModel}
          {...disableT9}
          onChange={(e) => setCarModel(e.target.value)}
          aria-label="Автомобиль"
          className={cn(poputi.input, "w-full")}
        />
        <textarea
          name="intercity_comment"
          placeholder="Комментарий…"
          value={comment}
          {...disableT9}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
          aria-label="Комментарий"
          className={cn(poputi.input, "w-full resize-none")}
        />
        <SeatCountPicker value={seatCount} onChange={setSeatCount} label="Мест в салоне" />
        {submitError && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{submitError}</p>}
      </div>
      <button
        type="button"
        onClick={() => void handleSubmitIntercity()}
        disabled={isSubmitting || !isRidePriceValid(price) || !address.trim() || !to.trim()}
        className={cn(poputi.btnPrimary, "mt-4")}
      >
        {isSubmitting ? "Публикация…" : "Опубликовать в межгород"}
      </button>
    </BottomSheet>
  )
}

function RouteTemplatePicker({
  routes,
  onSelect,
}: {
  routes: RouteTemplate[]
  onSelect: (route: RouteTemplate) => void
}) {
  if (routes.length === 0) return null

  return (
    <div className="mb-3 flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {routes.map((route) => {
        const hasPoints = Boolean(route.from.trim() || route.to.trim())
        return (
          <button
            key={route.id}
            type="button"
            onClick={() => onSelect(route)}
            className={cn(
              "poputi-focus-ring shrink-0 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors active:scale-[0.98]",
              hasPoints
                ? "border-[#2787F5]/30 bg-[#F0F6FF] text-[#2787F5]"
                : "border-gray-200 bg-gray-50 text-gray-500"
            )}
          >
            {route.label}
          </button>
        )
      })}
    </div>
  )
}

function SeatCountPicker({
  value,
  onChange,
  label,
}: {
  value: number
  onChange: (seats: number) => void
  label: string
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {[1, 2, 3, 4].map((seat) => {
          const selected = seat === value
          return (
            <button
              key={seat}
              type="button"
              onClick={() => onChange(seat)}
              className={cn(
                "poputi-focus-ring h-10 w-10 rounded-full border text-sm font-semibold transition-colors",
                selected
                  ? "border-[#2787F5] bg-[#2787F5] text-white"
                  : "border-gray-200 bg-white text-gray-900"
              )}
              aria-label={`${seat} ${seat === 1 ? "место" : seat < 5 ? "места" : "мест"}`}
              aria-pressed={selected}
            >
              {seat}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function RidePriceStepper({
  value,
  onChange,
  label = "Ваша цена",
}: {
  value: string
  onChange: (value: string) => void
  label?: string
}) {
  const numeric = parseRidePrice(value) ?? MIN_RIDE_PRICE
  const atMin = numeric <= MIN_RIDE_PRICE

  const bump = (delta: number) => {
    onChange(String(clampRidePrice(String(numeric + delta * PRICE_STEP))))
  }

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
        <p className="text-[10px] text-gray-400">от {MIN_RIDE_PRICE} ₽</p>
      </div>
      <div className="flex items-center gap-1.5 rounded-xl border border-gray-100 bg-gray-50/90 px-2 py-1.5">
        <button
          type="button"
          aria-label="Уменьшить цену"
          disabled={atMin}
          onClick={() => bump(-1)}
          className="poputi-focus-ring flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center disabled:opacity-40"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 shadow-sm">
            <Minus className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
          </span>
        </button>
        <input
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(normalizePriceDigits(e.target.value))}
          onBlur={() => {
            if (!value) return
            onChange(String(clampRidePrice(value)))
          }}
          aria-label={label}
          aria-invalid={value.length > 0 && !isRidePriceValid(value) ? true : undefined}
          className="min-w-0 flex-1 border-0 bg-transparent py-0.5 text-center text-xl font-bold tabular-nums leading-none text-gray-900 outline-none focus:ring-0"
          placeholder={String(MIN_RIDE_PRICE)}
        />
        <span className="shrink-0 pr-0.5 text-sm font-semibold text-gray-500">₽</span>
        <button
          type="button"
          aria-label="Увеличить цену"
          onClick={() => bump(1)}
          className="poputi-focus-ring flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#2787F5]/30 bg-[#2787F5] text-white shadow-sm shadow-[#2787F5]/20">
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
          </span>
        </button>
      </div>
    </div>
  )
}

function buildDriverNote(settings: UserSettings): string {
  const parts = []
  if (settings.driver.paymentMethod === "transfer") parts.push("оплата переводом")
  if (settings.driver.paymentMethod === "cash") parts.push("оплата наличными")
  if (settings.driver.onlineUntil) parts.push(`на линии до ${settings.driver.onlineUntil}`)
  return parts.join(", ")
}
