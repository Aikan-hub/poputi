"use client"

import { useEffect, useState } from "react"
import { assertNotBanned, BANNED_USER_MESSAGE } from "@/lib/banned-users"
import { geocodeAddress, randomCoordsNearCity } from "@/lib/geocode"
import { supabase } from "@/lib/supabase-client"
import { APP_CITY_COORDS, type AppCity } from "@/lib/cities"
import { getYandexMapsApiKey } from "@/lib/env"
import type { AddModalVariant, Mode, VkUserProfile } from "./types"
import { vkIdTagFromNumericId } from "./helpers"
import { BottomSheet, RouteTimeline, poputi } from "@/components/poputi/ui"
import { MessageSquare, Navigation } from "lucide-react"
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
  const [seatCount, setSeatCount] = useState(3)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [citySuggestions, setCitySuggestions] = useState<{ text: string; lat: number; lng: number }[]>([])
  const [cityCoordsOverride, setCityCoordsOverride] = useState<{ lat: number; lng: number } | null>(null)

  const vkTag = vkUser?.id ? vkIdTagFromNumericId(vkUser.id) : ""

  useEffect(() => {
    if (variant !== "cityDriver" && variant !== "cityPassenger") return
    const q = whereStanding.trim()
    if (q.length < 3) {
      setCitySuggestions([])
      return
    }
    const handle = setTimeout(async () => {
      try {
        const resp = await fetch(
          `https://geocode-maps.yandex.ru/1.x/?apikey=${getYandexMapsApiKey()}&format=json&geocode=${encodeURIComponent(`${city}, ${q}`)}`
        )
        const data = await resp.json()
        const members = data.response?.GeoObjectCollection?.featureMember || []
        const items = members.slice(0, 5).map((m: { GeoObject?: { name?: string; metaDataProperty?: { GeocoderMetaData?: { text?: string } }; Point?: { pos?: string } } }) => {
          const name = m.GeoObject?.name
          const text = m.GeoObject?.metaDataProperty?.GeocoderMetaData?.text
          const pos = m.GeoObject?.Point?.pos
          if (!pos) return null
          const [lngStr, latStr] = pos.split(" ")
          return {
            text: text || name || q,
            lat: parseFloat(latStr),
            lng: parseFloat(lngStr),
          }
        })
        setCitySuggestions(items.filter(Boolean) as { text: string; lat: number; lng: number }[])
      } catch {
        setCitySuggestions([])
      }
    }, 400)
    return () => clearTimeout(handle)
  }, [variant, whereStanding, city])

  const resolveCoords = async (addr: string) => {
    const geocoded = await geocodeAddress(city, addr)
    if (geocoded) return geocoded
    if (cityCoordsOverride) return cityCoordsOverride
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
    const lat = cityCoordsOverride?.lat ?? pinCoords?.lat ?? fallbackLat
    const lng = cityCoordsOverride?.lng ?? pinCoords?.lng ?? fallbackLng

    setIsSubmitting(true)
    setSubmitError(null)

    const fromBase = whereStanding.trim()
    const avatarUrl = vkUser?.photo_200 || null
    const fullRow = {
      lat,
      lng,
      price: 0,
      type: "Driver",
      status: "searching",
      from_location: fromBase,
      to_location: toCity.trim(),
      comment: comment.trim() || null,
      name: vkUser ? `${vkUser.first_name} ${vkUser.last_name}`.trim() : "Пользователь VK",
      vk_id: vkTag,
      avatar: avatarUrl,
      city,
      total_seats: citySeats,
      available_seats: citySeats,
    }

    const legacyRow = {
      lat,
      lng,
      price: 0,
      type: "Driver",
      from_location: comment.trim() ? `${fromBase} · ${comment.trim().slice(0, 280)}` : fromBase,
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
    if (!whereStanding.trim() || !toCity.trim() || !price || isSubmitting) return
    if (!(await guardBanned())) return

    setIsSubmitting(true)
    setSubmitError(null)

    const coords = await resolveCoords(whereStanding.trim())
    const priceNum = parseInt(price, 10)
    const avatarUrl = vkUser?.photo_200 || null

    const fullRow = {
      lat: coords.lat,
      lng: coords.lng,
      price: priceNum,
      type: "City",
      status: "searching",
      from_location: whereStanding.trim(),
      to_location: toCity.trim(),
      comment: comment.trim() || null,
      name: vkUser ? `${vkUser.first_name} ${vkUser.last_name}`.trim() : "Пользователь VK",
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
    if (!price || !address.trim() || !to.trim() || isSubmitting) return
    if (!(await guardBanned())) return

    setIsSubmitting(true)
    setSubmitError(null)

    const coords = address.trim() ? await resolveCoords(address.trim()) : randomCoordsNearCity(city)
    const fromLoc = address.trim()
    const toLoc = to.trim()
    const departAtIso = departAtLocal ? new Date(departAtLocal).toISOString() : null
    const avatarUrl = vkUser?.photo_200 || null

    const fullRow: Record<string, unknown> = {
      lat: coords.lat,
      lng: coords.lng,
      price: parseInt(price, 10),
      type: userRole,
      status: "searching",
      from_location: fromLoc,
      to_location: toLoc,
      comment: comment.trim() || null,
      name: vkUser ? `${vkUser.first_name} ${vkUser.last_name}`.trim() : "Пользователь VK",
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
      price: parseInt(price, 10),
      type: userRole,
      from_location: comment.trim() ? `${fromLoc} · ${comment.trim().slice(0, 200)}` : fromLoc,
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
        <h2 className="mb-1 text-xl font-bold text-gray-900">По городу — водитель</h2>
        <p className="mb-4 rounded-xl bg-gray-50 px-3 py-2 text-sm leading-relaxed text-gray-500">
          Точка на карте — центр экрана при открытии формы. Передвиньте карту и откройте снова, чтобы сменить пин.
        </p>
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Где я стою (ориентир)"
            value={whereStanding}
            {...disableT9}
            onChange={(e) => {
              setWhereStanding(e.target.value)
              setCityCoordsOverride(null)
            }}
            className={cn(poputi.input, "w-full")}
          />
          {citySuggestions.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              {citySuggestions.map((sug, idx) => (
                <button
                  type="button"
                  key={`${sug.text}-${idx}`}
                  onClick={() => {
                    setWhereStanding(sug.text)
                    setCityCoordsOverride({ lat: sug.lat, lng: sug.lng })
                    setCitySuggestions([])
                  }}
                  className="block w-full px-4 py-2.5 text-left text-sm text-gray-800 active:bg-gray-50"
                >
                  {sug.text}
                </button>
              ))}
            </div>
          )}
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
          <div className="rounded-xl bg-gray-100 px-4 py-3">
            <p className="text-sm font-medium text-gray-900">Свободных мест</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[1, 2, 3, 4].map((seat) => (
                <button
                  key={seat}
                  type="button"
                  onClick={() => setCitySeats(seat)}
                  className={`h-10 w-10 rounded-full border text-sm font-semibold transition-colors ${
                    seat <= citySeats ? "border-[#2787F5] bg-[#2787F5] text-white" : "border-gray-200 bg-white text-gray-900"
                  }`}
                >
                  {seat}
                </button>
              ))}
            </div>
          </div>
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
      <BottomSheet onClose={onClose} className="max-h-[86vh] overflow-y-auto pb-12">
          <h2 className="mb-6 text-xl font-bold text-gray-900">Куда поедем?</h2>
          <div className="space-y-3">
            <RouteTimeline
              from={whereStanding}
              onFromChange={(v) => {
                setWhereStanding(v)
                setCityCoordsOverride(null)
              }}
              to={toCity}
              onToChange={setToCity}
              fromPlaceholder="Откуда забрать"
              toPlaceholder="Куда едем?"
              toExtra={
                <Navigation className="pointer-events-none absolute right-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-400" />
              }
            />
            {citySuggestions.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                {citySuggestions.map((sug, idx) => (
                  <button
                    type="button"
                    key={`${sug.text}-${idx}`}
                    onClick={() => {
                      setWhereStanding(sug.text)
                      setCityCoordsOverride({ lat: sug.lat, lng: sug.lng })
                      setCitySuggestions([])
                    }}
                    className="block w-full px-4 py-2.5 text-left text-sm text-gray-800 active:bg-gray-50"
                  >
                    {sug.text}
                  </button>
                ))}
              </div>
            )}
            <div className="mt-4 flex gap-3">
              <div className={cn(poputi.input, "flex-1")}>
                <p className="mb-0.5 text-xs text-gray-500">Предложите цену</p>
                <div className="flex items-baseline gap-1">
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full bg-transparent text-lg font-bold text-gray-900 outline-none"
                    placeholder="400"
                  />
                  <span className="font-medium text-gray-500">₽</span>
                </div>
              </div>
              <button
                type="button"
                className={cn(poputi.input, "flex flex-1 flex-col justify-center")}
                onClick={() => {
                  const el = document.getElementById("poputi-ride-comment")
                  el?.focus()
                }}
              >
                <div className="flex items-center gap-2 text-gray-500">
                  <MessageSquare className="h-[18px] w-[18px]" />
                  <span className="text-sm">Комментарий</span>
                </div>
              </button>
            </div>
            <textarea
              id="poputi-ride-comment"
              placeholder="Комментарий для водителя"
              value={comment}
              {...disableT9}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              className={cn(poputi.input, "mt-1 w-full resize-none")}
            />
            {submitError && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{submitError}</p>}
            <button
              type="button"
              onClick={() => void handleSubmitCityPassenger()}
              disabled={isSubmitting || !price || !whereStanding.trim() || !toCity.trim()}
              className={cn(poputi.btnPrimary, "mt-2")}
            >
              {isSubmitting ? "Публикация…" : "Заказать"}
            </button>
          </div>
        </BottomSheet>
    )
  }

  return (
    <BottomSheet onClose={onClose} className="max-h-[86vh] overflow-y-auto pb-12">
      <h2 className="mb-1 text-xl font-bold text-gray-900">Межгород — {city}</h2>
      <p className="mb-4 rounded-xl bg-[#F0F6FF] px-3 py-2 text-sm text-[#2787F5]">
        Заявка попадёт во вкладку «Межгород» для вашего города отправления.
      </p>
      <div className="space-y-3">
        <input
          type="text"
          placeholder="Откуда (город или адрес)"
          value={address}
          {...disableT9}
          onChange={(e) => setAddress(e.target.value)}
          className={cn(poputi.input, "w-full")}
        />
        <input
          type="text"
          placeholder="Куда"
          value={to}
          {...disableT9}
          onChange={(e) => setTo(e.target.value)}
          className={cn(poputi.input, "w-full")}
        />
        <input
          type="datetime-local"
          value={departAtLocal}
          onChange={(e) => setDepartAtLocal(e.target.value)}
          className={cn(poputi.input, "w-full")}
        />
        <p className="-mt-2 text-xs text-gray-500">Время выезда (необязательно)</p>
        <input
          type="number"
          placeholder="Цена за место (₽)"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className={cn(poputi.input, "w-full")}
        />
        <input
          type="text"
          placeholder="Авто (напр. Kia Rio)"
          value={carModel}
          {...disableT9}
          onChange={(e) => setCarModel(e.target.value)}
          className={cn(poputi.input, "w-full")}
        />
        <textarea
          placeholder="Комментарий"
          value={comment}
          {...disableT9}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
          className={cn(poputi.input, "w-full resize-none")}
        />
        <div className="rounded-xl bg-gray-100 px-4 py-3">
          <p className="text-sm font-medium text-gray-900">Мест в салоне</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {[1, 2, 3, 4].map((seat) => (
              <button
                key={seat}
                type="button"
                onClick={() => setSeatCount(seat)}
                className={`h-10 w-10 rounded-full border text-sm font-semibold transition-colors ${
                  seat <= seatCount ? "border-[#2787F5] bg-[#2787F5] text-white" : "border-gray-200 bg-white text-gray-900"
                }`}
              >
                {seat}
              </button>
            ))}
          </div>
        </div>
        {submitError && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{submitError}</p>}
      </div>
      <button
        type="button"
        onClick={() => void handleSubmitIntercity()}
        disabled={isSubmitting || !price || !address.trim() || !to.trim()}
        className={cn(poputi.btnPrimary, "mt-4")}
      >
        {isSubmitting ? "Публикация…" : "Опубликовать в межгород"}
      </button>
    </BottomSheet>
  )
}
