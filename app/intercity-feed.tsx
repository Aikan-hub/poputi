"use client"

import { useEffect, useState, useMemo } from "react"
import { Plus, Clock, User, Zap, Trash2, Crown, Route, CarFront } from "lucide-react"
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
        if (!r.from_location || !r.to_location) return false
        return isRideWithinActiveWindow(r.created_at, r.type)
      }),
    [rides]
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
    <div className="relative flex-1 overflow-hidden bg-[#EBEDF0]">
      <div className="app-scrollbar h-full space-y-3 overflow-y-auto p-4 pb-24">
        {allRides.length === 0 ? (
          <div className="flex min-h-[55vh] flex-col items-center justify-center rounded-2xl border border-dashed border-[#D3D9DE] bg-white/80 px-6 py-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#F0F6FF] text-[#2787F5]">
              <Route className="h-7 w-7" />
            </div>
            <h2 className="mt-4 text-lg font-bold text-[#2C2D2E]">Пока нет поездок</h2>
            <p className="mt-1 text-sm leading-relaxed text-[#818C99]">
              Создайте первую заявку, и она появится в ленте межгорода.
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
        className="absolute bottom-6 right-4 z-10 flex h-14 w-14 items-center justify-center rounded-full bg-[#2787F5] text-white shadow-xl shadow-[#2787F5]/25 ring-4 ring-white/90 transition-transform active:scale-95"
        aria-label="Новая заявка межгород"
      >
        <Plus className="h-7 w-7" />
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
  const [isBoosted, setIsBoosted] = useState(ride.boosted)
  const [isDeleting, setIsDeleting] = useState(false)

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

  const legendRing = ride.isLegendDriver
    ? "ring-2 ring-amber-400 shadow-[0_0_0_1px_rgba(251,191,36,0.35)]"
    : ""
  const cardRing = isBoosted ? "ring-2 ring-[#FFC107]" : legendRing
  const bookLabel = isOwner ? "Это ваша заявка" : avail <= 0 ? "Мест нет" : "Забронировать место"

  return (
    <div className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#E1E3E6]/70 ${cardRing}`}>
      <div className="flex items-start gap-3">
        {ride.driverPhotoUrl ? (
          <img
            src={ride.driverPhotoUrl}
            alt=""
            className="h-12 w-12 shrink-0 rounded-full object-cover shadow-sm ring-2 ring-[#2787F5]/20"
          />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#2787F5] text-sm font-semibold text-white shadow-sm">
            {ride.avatar}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <h3 className="truncate font-semibold text-[#2C2D2E]">{ride.driver}</h3>
                {ride.isLegendDriver && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                    <Crown className="h-3 w-3" />
                    Легенда
                  </span>
                )}
              </div>
              <div className="mt-2 rounded-xl bg-[#F7F8FA] px-3 py-2 text-sm font-medium text-[#2C2D2E]">
                <div className="flex min-w-0 items-center gap-2">
                  <Route className="h-4 w-4 shrink-0 text-[#2787F5]" />
                  <span className="truncate">{ride.from || "Откуда"}</span>
                  <span className="shrink-0 text-[#818C99]">→</span>
                  <span className="truncate">{ride.to || "Куда"}</span>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#818C99]">
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
              <div className="text-xl font-bold text-[#2787F5]">{ride.price} ₽</div>
              <div className="text-xs font-medium text-[#818C99]">за место</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        {!isBoosted && (
          <button
            type="button"
            onClick={() => setIsBoosted(true)}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-[#FFF8E1] px-4 py-2.5 text-sm font-semibold text-[#B66D00] transition-colors active:bg-[#FFECB3]"
          >
            <Zap className="h-4 w-4" />
            Boost
          </button>
        )}
        <button
          type="button"
          onClick={() => (ride.rawRide ? openSeatModal() : handleMockBook())}
          disabled={bookDisabled}
          className="flex-1 rounded-xl bg-[#2787F5] py-2.5 text-sm font-semibold text-white shadow-sm shadow-[#2787F5]/20 transition-colors active:bg-[#1F6AD8] disabled:cursor-not-allowed disabled:bg-[#D3D9DE] disabled:text-[#818C99] disabled:shadow-none"
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
          className="mt-2 w-full rounded-xl bg-[#F0F4FF] py-2.5 text-sm font-medium text-[#2787F5] transition-colors active:bg-[#E3EBFA]"
        >
          Управление поездкой
        </button>
      )}

      {isOwner && ride.supabaseId && (
        <button
          type="button"
          onClick={() => void handleDelete()}
          disabled={isDeleting}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#FAEBEB] py-2 text-sm font-medium text-[#E64646] transition-colors active:bg-[#F5D6D6] disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
          {isDeleting ? "Удаление..." : "Удалить мою заявку"}
        </button>
      )}
    </div>
  )
}
