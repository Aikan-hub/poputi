"use client"

import { useEffect, useState, useMemo } from "react"
import { Plus, Clock, User, Trash2, Crown, Route, CarFront, CalendarClock } from "lucide-react"
import { matchesCity, formatDepartAt } from "./helpers"
import { isRideWithinActiveWindow } from "@/lib/rides"
import { isActiveStatus, type RideStatus } from "@/lib/ride-status"
import { isLegendLevel } from "@/lib/user-level"
import { supabase } from "@/lib/supabase-client"
import { type AppCity } from "@/lib/cities"
import { type SupabaseRide, type VkUserProfile, type RideData } from "./types"
import { getAvatarLabel, vkIdTagFromNumericId } from "./helpers"
import { AddRequestModal } from "./add-request-modal"

export function IntercityFeed({
  selectedCity,
  vkUser,
  onBooking,
  rides,
  onRideDeleted,
  onOpenDriverManage,
  onOpenSeatBook,
  intercityAddRequestOpen,
  setIntercityAddRequestOpen,
  onRideAdded,
  userRole,
}: {
  selectedCity: AppCity
  vkUser: VkUserProfile | null
  onBooking: (person: {
    name: string
    avatar: string
    rating?: number
    trips?: number
    vkId?: string
    telegram?: string
    messageIntro?: string
  }) => void | Promise<void>
  rides: SupabaseRide[]
  onRideDeleted?: () => void
  onOpenDriverManage: (ride: SupabaseRide) => void
  onOpenSeatBook: (ride: SupabaseRide) => void
  intercityAddRequestOpen: boolean
  setIntercityAddRequestOpen: (v: boolean) => void
  onRideAdded: () => void
  userRole: string
}) {
  const dbIntercityRows = useMemo(
    () =>
      rides.filter((r) => {
        if ((r.type || "").trim() === "City") return false
        if (!matchesCity(r.city, selectedCity)) return false
        if (!r.from_location || !r.to_location) return false
        return isRideWithinActiveWindow(r.created_at, r.type)
      }),
    [rides, selectedCity]
  )

  const [legendByVk, setLegendByVk] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const tags = [...new Set(dbIntercityRows.map((r) => r.vk_id).filter(Boolean))] as string[]
    if (tags.length === 0) {
      setLegendByVk({})
      return
    }
    let cancelled = false
    void supabase
      .from("profiles")
      .select("vk_id, total_rides, average_rating")
      .in("vk_id", tags)
      .then(({ data }) => {
        if (cancelled) return
        const m: Record<string, boolean> = {}
        for (const row of data || []) {
          const vk = row.vk_id as string
          m[vk] = isLegendLevel(Number(row.total_rides) || 0, Number(row.average_rating) || 5)
        }
        setLegendByVk(m)
      })
    return () => {
      cancelled = true
    }
  }, [dbIntercityRows])

  const intercityRides: RideData[] = useMemo(
    () =>
      dbIntercityRows
        .filter((r) => isActiveStatus((r.status as RideStatus | null) ?? "searching"))
        .map((r) => {
        const display = r.name || "Пользователь"
        const photo = r.avatar?.startsWith("http") ? r.avatar : undefined
        const total = Math.max(1, r.total_seats ?? r.seats ?? 4)
        const avail =
          typeof r.available_seats === "number" ? r.available_seats : (r.seats ?? total)
        return {
          id: r.id,
          from: r.from_location || "",
          to: r.to_location || "",
          price: r.price,
          driver: display,
          avatar: getAvatarLabel(display, r.avatar),
          driverPhotoUrl: photo,
          time: new Date(r.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
          seats: avail,
          boosted: false,
          car: r.car || "Авто",
          rating: r.rating || 4.5,
          trips: r.trips || 0,
          vkId: r.vk_id || "",
          telegram: r.telegram || "",
          supabaseId: r.id,
          rawRide: r,
          isLegendDriver: r.vk_id ? !!legendByVk[r.vk_id] : false,
          availableSeats: avail,
          totalSeats: total,
          driverId: r.driver_id || null,
        }
        }),
    [dbIntercityRows, legendByVk]
  )

  const allRides = useMemo(() => {
    const merged = [...intercityRides]
    merged.sort((a, b) => {
      const d = (b.isLegendDriver ? 1 : 0) - (a.isLegendDriver ? 1 : 0)
      if (d !== 0) return d
      const sa = a.supabaseId ?? 0
      const sb = b.supabaseId ?? 0
      if (sa !== sb) return sb - sa
      return b.id - a.id
    })
    return merged
  }, [intercityRides])

  return (
    <div className="relative flex-1 overflow-hidden bg-gradient-to-b from-[#F4F7FB] to-[#EEF2F8]">
      <div className="app-scrollbar h-full space-y-3 overflow-y-auto p-4 pb-24">
        {allRides.length === 0 ? (
          <div className="poputi-card relative flex min-h-[55vh] flex-col items-center justify-center overflow-hidden rounded-[1.5rem] px-6 py-10 text-center">
            <div className="poputi-aurora opacity-50" aria-hidden />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl poputi-grad-primary text-white shadow-[0_14px_30px_-10px_rgba(39,135,245,0.55)] ring-1 ring-white/40 poputi-float">
              <Route className="h-7 w-7" />
            </div>
            <h2 className="relative mt-5 text-xl font-black tracking-tight text-gray-950">Пока нет поездок</h2>
            <p className="relative mt-1.5 max-w-xs text-sm font-medium leading-relaxed text-gray-500">
              Создайте заявку кнопкой «+» — маршрут из города <span className="font-bold text-gray-800">{selectedCity}</span>.
            </p>
          </div>
        ) : (
          allRides.map((ride) => (
            <RideCard
              key={ride.supabaseId != null ? `db-${ride.supabaseId}` : `mock-${ride.id}`}
              ride={ride}
              vkUser={vkUser}
              onBooking={onBooking}
              onRideDeleted={onRideDeleted}
              onOpenDriverManage={onOpenDriverManage}
              onOpenSeatBook={onOpenSeatBook}
            />
          ))
        )}
      </div>
      <button
        type="button"
        onClick={() => setIntercityAddRequestOpen(true)}
        className="poputi-grad-primary absolute bottom-6 right-4 z-10 flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-[0_18px_36px_-10px_rgba(39,135,245,0.65)] ring-1 ring-white/40 transition-transform hover:scale-[1.04] active:scale-95"
        aria-label="Новая заявка межгород"
      >
        <Plus className="h-7 w-7" />
        <span className="pointer-events-none absolute inset-0 rounded-2xl poputi-pulse-ring" aria-hidden />
      </button>
      {intercityAddRequestOpen && (
        <AddRequestModal
          variant="intercity"
          onClose={() => setIntercityAddRequestOpen(false)}
          onRideAdded={onRideAdded}
          userRole={userRole}
          mode="intercity"
          city={selectedCity}
          vkUser={vkUser}
        />
      )}
    </div>
  )
}

function RideCard({
  ride,
  vkUser,
  onBooking,
  onRideDeleted,
  onOpenDriverManage,
  onOpenSeatBook,
}: {
  ride: RideData
  vkUser: VkUserProfile | null
  onBooking: (person: {
    name: string
    avatar: string
    rating?: number
    trips?: number
    vkId?: string
    telegram?: string
    messageIntro?: string
  }) => void | Promise<void>
  onRideDeleted?: () => void
  onOpenDriverManage: (ride: SupabaseRide) => void
  onOpenSeatBook: (ride: SupabaseRide) => void
}) {
  const [isDeleting, setIsDeleting] = useState(false)
  const departLabel = formatDepartAt(ride.rawRide?.depart_at)

  const viewerTag = vkUser ? vkIdTagFromNumericId(vkUser.id) : null
  const isOwner = viewerTag != null && ride.vkId === viewerTag
  const avail = ride.availableSeats ?? ride.seats
  const totalP = ride.totalSeats ?? ride.seats ?? 4

  const handleDelete = async () => {
    if (!ride.supabaseId || isDeleting || !isOwner) return
    setIsDeleting(true)

    const { error } = await supabase.from("rides").delete().eq("id", ride.supabaseId)

    setIsDeleting(false)

    if (!error && onRideDeleted) {
      onRideDeleted()
    }
  }

  const handleMockBook = () => {
    void onBooking({
      name: ride.driver,
      avatar: ride.avatar,
      rating: ride.rating,
      trips: ride.trips,
      vkId: ride.vkId,
      telegram: ride.telegram,
    })
  }

  const openSeatModal = () => {
    if (ride.rawRide) onOpenSeatBook(ride.rawRide)
  }

  const canBookDb = !!ride.rawRide && !!vkUser && !isOwner && avail > 0
  const canBookMock = !ride.rawRide && !!vkUser && avail > 0
  const bookDisabled = ride.rawRide ? !canBookDb : !canBookMock

  const cardRing = ride.isLegendDriver
    ? "ring-2 ring-amber-400 shadow-[0_18px_36px_-14px_rgba(251,191,36,0.45)]"
    : ""
  const bookLabel = isOwner ? "Это ваша заявка" : avail <= 0 ? "Мест нет" : "Забронировать место"

  return (
    <div className={`poputi-card poputi-card-hover rounded-[1.25rem] p-4 ${cardRing}`}>
      <div className="flex items-start gap-3">
        {ride.driverPhotoUrl ? (
          <img
            src={ride.driverPhotoUrl}
            alt=""
            className="h-12 w-12 shrink-0 rounded-full object-cover bg-gray-100"
          />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full poputi-grad-primary text-sm font-bold text-white shadow-[0_8px_18px_-8px_rgba(39,135,245,0.55)] ring-1 ring-white/40">
            {ride.avatar}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <h3 className="truncate font-bold text-gray-900">{ride.driver}</h3>
                {ride.isLegendDriver && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                    <Crown className="h-3 w-3" />
                    Легенда
                  </span>
                )}
              </div>
              <div className="mt-2 rounded-xl bg-gray-50 px-3 py-2 text-sm font-medium text-gray-900">
                <div className="flex min-w-0 items-center gap-2">
                  <Route className="h-4 w-4 shrink-0 text-[#2787F5]" />
                  <span className="truncate">{ride.from || "Откуда"}</span>
                  <span className="shrink-0 text-gray-400">→</span>
                  <span className="truncate">{ride.to || "Куда"}</span>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                {departLabel && (
                  <div className="flex items-center gap-1 text-[#2787F5]">
                    <CalendarClock className="h-4 w-4" />
                    <span>{departLabel}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>{ride.time}</span>
                </div>
                <div className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  <span>
                    {avail} свободно из {totalP}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <CarFront className="h-4 w-4" />
                  <span>{ride.car}</span>
                </div>
              </div>
            </div>

            <div className="shrink-0 text-right">
              <div className="text-xl font-bold text-gray-900">{ride.price} ₽</div>
              <div className="text-xs font-medium text-gray-500">за место</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3">
        <button
          type="button"
          onClick={() => (ride.rawRide ? openSeatModal() : handleMockBook())}
          disabled={bookDisabled}
          className="poputi-btn-motion poputi-focus-ring poputi-grad-primary w-full rounded-2xl py-3 text-sm font-bold text-white shadow-[0_12px_28px_-8px_rgba(39,135,245,0.55)] ring-1 ring-white/30 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-none disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none disabled:ring-0"
        >
          {bookLabel}
        </button>
      </div>

      {isOwner && ride.rawRide && (
        <button
          type="button"
          onClick={() => {
            const r = ride.rawRide
            if (r) onOpenDriverManage(r)
          }}
          className="mt-2 w-full rounded-xl bg-[#F0F6FF] py-2.5 text-sm font-medium text-[#2787F5] transition-colors active:bg-[#F0F6FF]"
        >
          Управление поездкой
        </button>
      )}

      {isOwner && ride.supabaseId && (
        <button
          type="button"
          onClick={() => void handleDelete()}
          disabled={isDeleting}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-red-50 py-2 text-sm font-medium text-red-600 transition-colors active:bg-red-100 disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
          {isDeleting ? "Удаление…" : "Удалить мою заявку"}
        </button>
      )}
    </div>
  )
}
