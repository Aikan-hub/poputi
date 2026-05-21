"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase-client"
import { APP_CITY_COORDS, type AppCity } from "@/lib/cities"
import type { AddModalVariant, Mode, VkUserProfile } from "./types"
import { vkIdTagFromNumericId } from "./helpers"

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
  const [citySeats, setCitySeats] = useState(4)
  const [seatCount, setSeatCount] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [citySuggestions, setCitySuggestions] = useState<{ text: string; lat: number; lng: number }[]>([])
  const [cityCoordsOverride, setCityCoordsOverride] = useState<{ lat: number; lng: number } | null>(null)
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
          `https://geocode-maps.yandex.ru/1.x/?apikey=77552578-1483-4cc6-8510-a0a7f7f340aa&format=json&geocode=${encodeURIComponent(
            `${city}, ${q}`
          )}`
        )
        const data = await resp.json()
        const members = data.response?.GeoObjectCollection?.featureMember || []
        const items = members.slice(0, 5).map((m: any) => {
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
        setCitySuggestions(items.filter(Boolean))
      } catch {
        setCitySuggestions([])
      }
    }, 400)
    return () => clearTimeout(handle)
  }, [variant, whereStanding, city])

  const handleSubmitCity = async () => {
    if (!whereStanding.trim() || !toCity.trim() || isSubmitting) return
    const [fallbackLat, fallbackLng] = APP_CITY_COORDS[city]
    const lat = cityCoordsOverride?.lat ?? pinCoords?.lat ?? fallbackLat
    const lng = cityCoordsOverride?.lng ?? pinCoords?.lng ?? fallbackLng

    setIsSubmitting(true)
    setSubmitError(null)

    const fromBase = whereStanding.trim()
    const fromWithComment =
      comment.trim().length > 0 ? `${fromBase} · ${comment.trim().slice(0, 280)}` : fromBase

    const avatarUrl = vkUser?.photo_200 || null
    const fullRow = {
      lat,
      lng,
      price: 0,
      type: "City",
      status: "searching",
      from_location: fromBase,
      to_location: toCity.trim(),
      comment: comment.trim() || null,
      name: vkUser ? `${vkUser.first_name} ${vkUser.last_name}`.trim() : "Пользователь VK",
      vk_id: vkUser?.id ? vkIdTagFromNumericId(vkUser.id) : "",
      avatar: avatarUrl,
      city,
      total_seats: citySeats,
      available_seats: citySeats,
    }

    let { error } = await supabase.from("rides").insert([fullRow])
    if (error) {
      const legacyRow = {
        lat,
        lng,
        price: 0,
        type: "City",
        from_location: fromWithComment,
        to_location: toCity.trim(),
        name: fullRow.name,
        vk_id: fullRow.vk_id,
        city,
        total_seats: 4,
        available_seats: 4,
      }
      const second = await supabase.from("rides").insert([legacyRow])
      error = second.error
      if (error) {
        const { total_seats: _a, available_seats: _b, ...minimal } = legacyRow
        const third = await supabase.from("rides").insert([minimal])
        error = third.error
      }
    }

    setIsSubmitting(false)
    if (error) {
      setSubmitError(error.message || "Не удалось опубликовать заявку. Проверьте интернет и миграции в Supabase.")
      return
    }
    onRideAdded()
    onClose()
  }

  const handleSubmitIntercity = async (forceCityType?: boolean) => {
    if (!price || isSubmitting) return

    setIsSubmitting(true)
    setSubmitError(null)

    let lat: number
    let lng: number

    if (address.trim()) {
      try {
        const geocodeUrl = `https://geocode-maps.yandex.ru/1.x/?apikey=77552578-1483-4cc6-8510-a0a7f7f340aa&format=json&geocode=${encodeURIComponent(city + ", " + address)}`
        const response = await fetch(geocodeUrl)
        const data = await response.json()

        const pos = data.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject?.Point?.pos

        if (pos) {
          const [lngStr, latStr] = pos.split(" ")
          lng = parseFloat(lngStr)
          lat = parseFloat(latStr)
        } else {
          const [cityLat, cityLng] = APP_CITY_COORDS[city]
          lat = cityLat + (Math.random() - 0.5) * 0.01
          lng = cityLng + (Math.random() - 0.5) * 0.01
        }
      } catch {
        const [cityLat, cityLng] = APP_CITY_COORDS[city]
        lat = cityLat + (Math.random() - 0.5) * 0.01
        lng = cityLng + (Math.random() - 0.5) * 0.01
      }
    } else {
      const [cityLat, cityLng] = APP_CITY_COORDS[city]
      lat = cityLat + (Math.random() - 0.5) * 0.01
      lng = cityLng + (Math.random() - 0.5) * 0.01
    }

    const fromLoc = address.trim() || city
    const toLoc = to.trim() || city
    const fromWithNote =
      comment.trim().length > 0 ? `${fromLoc} · ${comment.trim().slice(0, 200)}` : fromLoc

    const avatarUrl = vkUser?.photo_200 || null
    const fullRow = {
      lat,
      lng,
      price: parseInt(price, 10),
      type: forceCityType ? "City" : userRole,
      status: "searching",
      from_location: fromLoc,
      to_location: toLoc,
      comment: comment.trim() || null,
      name: vkUser ? `${vkUser.first_name} ${vkUser.last_name}`.trim() : "Пользователь VK",
      vk_id: vkUser?.id ? vkIdTagFromNumericId(vkUser.id) : "",
      avatar: avatarUrl,
      city,
      total_seats: seatCount,
      available_seats: seatCount,
    }

    let { error } = await supabase.from("rides").insert([fullRow])
    if (error) {
      const legacyRow = {
        lat,
        lng,
        price: parseInt(price, 10),
        type: forceCityType ? "City" : userRole,
        from_location: fromWithNote,
        to_location: toLoc,
        name: fullRow.name,
        vk_id: fullRow.vk_id,
        city,
        total_seats: 4,
        available_seats: 4,
      }
      const second = await supabase.from("rides").insert([legacyRow])
      error = second.error
      if (error) {
        const { total_seats: _a, available_seats: _b, ...minimal } = legacyRow
        const third = await supabase.from("rides").insert([minimal])
        error = third.error
      }
    }

    setIsSubmitting(false)

    if (error) {
      setSubmitError(error.message || "Не удалось опубликовать заявку.")
      return
    }
    onRideAdded()
    onClose()
  }

  if (variant === "cityDriver") {
    return (
      <div className="absolute inset-0 z-30 flex items-end bg-black/45 backdrop-blur-[2px]" onClick={onClose}>
        <div
          className="max-h-[86vh] w-full overflow-hidden rounded-t-2xl bg-white shadow-2xl ring-1 ring-black/5 animate-in slide-in-from-bottom duration-300"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="app-scrollbar max-h-[86vh] overflow-y-auto p-4 pb-5">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#D3D9DE]" />

            <h2 className="mb-1 text-xl font-bold text-[#2C2D2E]">По городу</h2>
            <p className="mb-4 rounded-xl bg-[#F7F8FA] px-3 py-2 text-sm leading-relaxed text-[#818C99]">
              Точка на карте — центр экрана карты при открытии формы (передвиньте карту и откройте снова, чтобы
              сменить пин).
            </p>

            <div className="space-y-3">
              <input
                type="text"
                placeholder="Где я стою (ориентир)"
                value={whereStanding}
                {...disableT9}
                onChange={(e) => {
                  const v = e.target.value
                  setWhereStanding(v)
                  setCityCoordsOverride(null)
                }}
                className="w-full rounded-xl bg-[#F2F3F5] px-4 py-3 text-[#2C2D2E] placeholder-[#818C99] outline-none ring-1 ring-transparent transition focus:bg-white focus:ring-2 focus:ring-[#2787F5]"
              />
              {citySuggestions.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-[#E1E3E6] bg-white shadow-sm">
                  {citySuggestions.map((sug, idx) => (
                    <button
                      type="button"
                      key={`${sug.text}-${idx}`}
                      onClick={() => {
                        setWhereStanding(sug.text)
                        setCityCoordsOverride({ lat: sug.lat, lng: sug.lng })
                        setCitySuggestions([])
                      }}
                      className="block w-full px-4 py-2.5 text-left text-sm text-[#2C2D2E] active:bg-[#F2F3F5]"
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
                className="w-full rounded-xl bg-[#F2F3F5] px-4 py-3 text-[#2C2D2E] placeholder-[#818C99] outline-none ring-1 ring-transparent transition focus:bg-white focus:ring-2 focus:ring-[#2787F5]"
              />
            <textarea
              placeholder="Комментарий (необязательно): детали, время, что везёте…"
              value={comment}
              {...disableT9}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-xl bg-[#F2F3F5] px-4 py-3 text-[#2C2D2E] placeholder-[#818C99] outline-none ring-1 ring-transparent transition focus:bg-white focus:ring-2 focus:ring-[#2787F5]"
            />
            <div className="rounded-xl bg-[#F2F3F5] px-4 py-3">
              <p className="text-sm font-medium text-[#2C2D2E]">Свободных мест</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {[1, 2, 3, 4].map((seat) => (
                  <button
                    key={seat}
                    type="button"
                    onClick={() => setCitySeats(seat)}
                    className={`h-10 w-10 rounded-full border text-sm font-semibold transition-colors ${
                      seat <= citySeats
                        ? "border-[#2787F5] bg-[#2787F5] text-white"
                        : "border-[#D3D9DE] bg-white text-[#2C2D2E]"
                    }`}
                    aria-pressed={seat <= citySeats}
                  >
                    {seat}
                  </button>
                ))}
              </div>
            </div>
            {submitError && (
              <p className="rounded-xl bg-[#FAEBEB] px-3 py-2 text-sm text-[#E64646]">{submitError}</p>
            )}
            </div>

            <button
              type="button"
              onClick={() => void handleSubmitCity()}
              disabled={isSubmitting || !whereStanding.trim() || !toCity.trim()}
              className="mt-4 w-full rounded-xl bg-[#2787F5] py-3.5 font-semibold text-white shadow-sm shadow-[#2787F5]/20 transition-colors active:bg-[#1F6AD8] disabled:cursor-not-allowed disabled:bg-[#D3D9DE] disabled:text-[#818C99] disabled:shadow-none"
            >
              {isSubmitting ? "Публикация…" : "Опубликовать"}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (variant === "cityPassenger") {
    return (
      <div className="absolute inset-0 z-30 flex items-end bg-black/45 backdrop-blur-[2px]" onClick={onClose}>
        <div
          className="max-h-[86vh] w-full overflow-hidden rounded-t-2xl bg-white shadow-2xl ring-1 ring-black/5 animate-in slide-in-from-bottom duration-300"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="app-scrollbar max-h-[86vh] overflow-y-auto p-4 pb-5">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#D3D9DE]" />

            <h2 className="mb-1 text-xl font-bold text-[#2C2D2E]">Новая заявка</h2>
            <p className="mb-4 rounded-xl bg-[#F7F8FA] px-3 py-2 text-sm text-[#818C99]">Адрес привяжется к точке на карте.</p>

            <div className="space-y-3">
              <input
                type="text"
                placeholder="Адрес отправления (напр. Ленина 42)"
                value={whereStanding}
                {...disableT9}
                onChange={(e) => {
                  const v = e.target.value
                  setWhereStanding(v)
                  setCityCoordsOverride(null)
                }}
                className="w-full rounded-xl bg-[#F2F3F5] px-4 py-3 text-[#2C2D2E] placeholder-[#818C99] outline-none ring-1 ring-transparent transition focus:bg-white focus:ring-2 focus:ring-[#2787F5]"
              />
              {citySuggestions.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-[#E1E3E6] bg-white shadow-sm">
                  {citySuggestions.map((sug, idx) => (
                    <button
                      type="button"
                      key={`${sug.text}-${idx}`}
                      onClick={() => {
                        setWhereStanding(sug.text)
                        setCityCoordsOverride({ lat: sug.lat, lng: sug.lng })
                        setCitySuggestions([])
                      }}
                      className="block w-full px-4 py-2.5 text-left text-sm text-[#2C2D2E] active:bg-[#F2F3F5]"
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
                className="w-full rounded-xl bg-[#F2F3F5] px-4 py-3 text-[#2C2D2E] placeholder-[#818C99] outline-none ring-1 ring-transparent transition focus:bg-white focus:ring-2 focus:ring-[#2787F5]"
              />
              <input
                type="number"
                placeholder="Бюджет (₽)"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full rounded-xl bg-[#F2F3F5] px-4 py-3 text-[#2C2D2E] placeholder-[#818C99] outline-none ring-1 ring-transparent transition focus:bg-white focus:ring-2 focus:ring-[#2787F5]"
              />
              <textarea
                placeholder="Комментарий (необязательно)"
                value={comment}
                {...disableT9}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                className="w-full resize-none rounded-xl bg-[#F2F3F5] px-4 py-3 text-[#2C2D2E] placeholder-[#818C99] outline-none ring-1 ring-transparent transition focus:bg-white focus:ring-2 focus:ring-[#2787F5]"
              />
              <div className="rounded-xl bg-[#F2F3F5] px-4 py-3">
                <p className="text-sm font-medium text-[#2C2D2E]">Требуется мест</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5].map((seat) => (
                    <button
                      key={seat}
                      type="button"
                      onClick={() => setSeatCount(seat)}
                      className={`h-10 w-10 rounded-full border text-sm font-semibold transition-colors ${
                        seat <= seatCount
                          ? "border-[#2787F5] bg-[#2787F5] text-white"
                          : "border-[#D3D9DE] bg-white text-[#2C2D2E]"
                      }`}
                      aria-pressed={seat <= seatCount}
                    >
                      {seat}
                    </button>
                  ))}
                </div>
              </div>
              {submitError && (
                <p className="rounded-xl bg-[#FAEBEB] px-3 py-2 text-sm text-[#E64646]">{submitError}</p>
              )}
            </div>

            <button
              type="button"
              onClick={() => void handleSubmitIntercity(true)}
              disabled={isSubmitting || !price || !whereStanding.trim() || !toCity.trim()}
              className="mt-4 w-full rounded-xl bg-[#2787F5] py-3.5 font-semibold text-white shadow-sm shadow-[#2787F5]/20 transition-colors active:bg-[#1F6AD8] disabled:cursor-not-allowed disabled:bg-[#D3D9DE] disabled:text-[#818C99] disabled:shadow-none"
            >
              {isSubmitting ? "Публикация…" : "Опубликовать"}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="absolute inset-0 z-30 flex items-end bg-black/45 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className="max-h-[86vh] w-full overflow-hidden rounded-t-2xl bg-white shadow-2xl ring-1 ring-black/5 animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="app-scrollbar max-h-[86vh] overflow-y-auto p-4 pb-5">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#D3D9DE]" />

          <h2 className="mb-4 text-xl font-bold text-[#2C2D2E]">Новая заявка</h2>

          <div className="space-y-3">
            <input
              type="text"
              placeholder="Адрес отправления (напр. Ленина 42)"
              value={address}
              {...disableT9}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-xl bg-[#F2F3F5] px-4 py-3 text-[#2C2D2E] placeholder-[#818C99] outline-none ring-1 ring-transparent transition focus:bg-white focus:ring-2 focus:ring-[#2787F5]"
            />
            <input
              type="text"
              placeholder="Куда"
              value={to}
              {...disableT9}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-xl bg-[#F2F3F5] px-4 py-3 text-[#2C2D2E] placeholder-[#818C99] outline-none ring-1 ring-transparent transition focus:bg-white focus:ring-2 focus:ring-[#2787F5]"
            />
            <input
              type="number"
              placeholder="Бюджет (₽)"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full rounded-xl bg-[#F2F3F5] px-4 py-3 text-[#2C2D2E] placeholder-[#818C99] outline-none ring-1 ring-transparent transition focus:bg-white focus:ring-2 focus:ring-[#2787F5]"
            />
            <textarea
              placeholder="Комментарий (необязательно)"
              value={comment}
              {...disableT9}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              className="w-full resize-none rounded-xl bg-[#F2F3F5] px-4 py-3 text-[#2C2D2E] placeholder-[#818C99] outline-none ring-1 ring-transparent transition focus:bg-white focus:ring-2 focus:ring-[#2787F5]"
            />
            <div className="rounded-xl bg-[#F2F3F5] px-4 py-3">
              <p className="text-sm font-medium text-[#2C2D2E]">Требуется мест</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5].map((seat) => (
                  <button
                    key={seat}
                    type="button"
                    onClick={() => setSeatCount(seat)}
                    className={`h-10 w-10 rounded-full border text-sm font-semibold transition-colors ${
                      seat <= seatCount
                        ? "border-[#2787F5] bg-[#2787F5] text-white"
                        : "border-[#D3D9DE] bg-white text-[#2C2D2E]"
                    }`}
                    aria-pressed={seat <= seatCount}
                  >
                    {seat}
                  </button>
                ))}
              </div>
            </div>
            {submitError && (
              <p className="rounded-xl bg-[#FAEBEB] px-3 py-2 text-sm text-[#E64646]">{submitError}</p>
            )}
          </div>

          <button
            type="button"
            onClick={() => void handleSubmitIntercity()}
            disabled={isSubmitting || !price}
            className="mt-4 w-full rounded-xl bg-[#2787F5] py-3.5 font-semibold text-white shadow-sm shadow-[#2787F5]/20 transition-colors active:bg-[#1F6AD8] disabled:cursor-not-allowed disabled:bg-[#D3D9DE] disabled:text-[#818C99] disabled:shadow-none"
          >
            {isSubmitting ? "Получение координат..." : "Опубликовать"}
          </button>
        </div>
      </div>
    </div>
  )
}
