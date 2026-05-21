"use client"

import { useEffect, useState, useCallback, useMemo, useRef } from "react"
import { YMaps, Map as YMap } from "@pbe/react-yandex-maps"
import { MapPin, Plus } from "lucide-react"
import { isPersistentRideType } from "@/lib/rides"
import { normalizeRideStatus } from "@/lib/ride-status"
import { APP_CITY_COORDS, type AppCity } from "@/lib/cities"
import type { DriverData, Mode, SupabaseRide, VkUserProfile } from "./types"
import { parseRideCoords, matchesCity, cityBoundsKm, getAvatarLabel, vkIdTagFromNumericId } from "./helpers"
import { DriverPlacemark } from "./driver-placemark"
import { DriverBottomSheet } from "./driver-bottom-sheet"
import { AddRequestModal } from "./add-request-modal"
import { IntercityFeed } from "./intercity-feed"

export function MapScreen({
  city,
  isVkReady,
  vkUser,
  mode,
  setMode,
  selectedDriver,
  setSelectedDriver,
  showAddRequest,
  setShowAddRequest,
  onBooking,
  rides,
  onRideAdded,
  userRole,
  onRideDeleted,
  onOpenIntercityManage,
  onOpenIntercitySeatBook,
  onCityPickup,
  onDriverOffer,
  onPassengerCancel,
  onDriverArrive,
  onDriverStart,
  onDriverComplete,
  onRideStatusChanged,
  intercityAddRequestOpen,
  setIntercityAddRequestOpen,
  ridesError,
}: {
  city: AppCity
  isVkReady: boolean
  vkUser: VkUserProfile | null
  mode: Mode
  setMode: (mode: Mode) => void
  selectedDriver: DriverData | null
  setSelectedDriver: (driver: DriverData | null) => void
  showAddRequest: boolean
  setShowAddRequest: (show: boolean) => void
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
  onRideAdded: () => void
  userRole: string
  onRideDeleted: () => void
  onOpenIntercityManage: (ride: SupabaseRide) => void
  onOpenIntercitySeatBook: (ride: SupabaseRide) => void
  onCityPickup: (ride: SupabaseRide) => Promise<boolean>
  onDriverOffer: (ride: SupabaseRide, priceDelta: number) => Promise<boolean>
  onPassengerCancel: (ride: SupabaseRide) => Promise<boolean>
  onDriverArrive: (ride: SupabaseRide) => Promise<boolean>
  onDriverStart: (ride: SupabaseRide) => Promise<boolean>
  onDriverComplete: (ride: SupabaseRide) => Promise<boolean>
  onRideStatusChanged: () => void
  intercityAddRequestOpen: boolean
  setIntercityAddRequestOpen: (v: boolean) => void
  ridesError: string | null
}) {
  return (
    <div className="flex h-full flex-col bg-[#EBEDF0]">
      <header className="relative z-20 shrink-0 border-b border-[#E1E3E6]/80 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-medium text-[#818C99]">
              <MapPin className="h-3.5 w-3.5" />
              <span>Ваш город</span>
            </div>
            <span className="block truncate text-lg font-bold leading-tight text-[#2C2D2E]">{city}</span>
          </div>

          <div className="flex shrink-0 rounded-xl bg-[#EBEDF0] p-1">
            <button
              type="button"
              onClick={() => setMode("city")}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition-all ${
                mode === "city" ? "bg-white text-[#2787F5] shadow-sm" : "text-[#818C99] active:bg-white/60"
              }`}
            >
              Город
            </button>
            <button
              type="button"
              onClick={() => setMode("intercity")}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition-all ${
                mode === "intercity" ? "bg-white text-[#2787F5] shadow-sm" : "text-[#818C99] active:bg-white/60"
              }`}
            >
              Межгород
            </button>
          </div>

          <div className="hidden items-center gap-1 rounded-full bg-[#F0FFF0] px-2 py-1 text-xs font-medium text-[#4BB34B] min-[390px]:flex">
            <span className="h-2 w-2 rounded-full bg-[#4BB34B]" />
            <span>онлайн</span>
          </div>
        </div>
      </header>

      {mode === "city" ? (
        <CityMapView
          city={city}
          mode={mode}
          isVkReady={isVkReady}
          vkUser={vkUser}
          selectedDriver={selectedDriver}
          setSelectedDriver={setSelectedDriver}
          showAddRequest={showAddRequest}
          setShowAddRequest={setShowAddRequest}
          onBooking={onBooking}
          onCityPickup={onCityPickup}
          onDriverOffer={onDriverOffer}
          onPassengerCancel={onPassengerCancel}
          onDriverArrive={onDriverArrive}
          onDriverStart={onDriverStart}
          onDriverComplete={onDriverComplete}
          onRideStatusChanged={onRideStatusChanged}
          rides={rides}
          onRideAdded={onRideAdded}
          userRole={userRole}
          onRideDeleted={onRideDeleted}
          ridesError={ridesError}
        />
      ) : (
        <IntercityFeed
          selectedCity={city}
          vkUser={vkUser}
          onBooking={onBooking}
          rides={rides}
          onRideDeleted={onRideDeleted}
          onOpenDriverManage={onOpenIntercityManage}
          onOpenSeatBook={onOpenIntercitySeatBook}
          intercityAddRequestOpen={intercityAddRequestOpen}
          setIntercityAddRequestOpen={setIntercityAddRequestOpen}
          onRideAdded={onRideAdded}
          userRole={userRole}
        />
      )}
    </div>
  )
}

function CityMapView({
  city,
  mode,
  isVkReady,
  vkUser,
  selectedDriver,
  setSelectedDriver,
  showAddRequest,
  setShowAddRequest,
  onBooking,
  onCityPickup,
  onDriverOffer,
  onPassengerCancel,
  onDriverArrive,
  onDriverStart,
  onDriverComplete,
  onRideStatusChanged,
  rides,
  onRideAdded,
  userRole,
  onRideDeleted,
  ridesError,
}: {
  city: AppCity
  isVkReady: boolean
  vkUser: VkUserProfile | null
  selectedDriver: DriverData | null
  setSelectedDriver: (driver: DriverData | null) => void
  showAddRequest: boolean
  setShowAddRequest: (show: boolean) => void
  mode: Mode
  onBooking: (person: {
    name: string
    avatar: string
    rating?: number
    trips?: number
    vkId?: string
    telegram?: string
    messageIntro?: string
  }) => void | Promise<void>
  onCityPickup: (ride: SupabaseRide) => Promise<boolean>
  onDriverOffer: (ride: SupabaseRide, priceDelta: number) => Promise<boolean>
  onPassengerCancel: (ride: SupabaseRide) => Promise<boolean>
  onDriverArrive: (ride: SupabaseRide) => Promise<boolean>
  onDriverStart: (ride: SupabaseRide) => Promise<boolean>
  onDriverComplete: (ride: SupabaseRide) => Promise<boolean>
  onRideStatusChanged: () => void
  rides: SupabaseRide[]
  onRideAdded: () => void
  userRole: string
  onRideDeleted: () => void
  ridesError: string | null
}) {
  const cityCoords = APP_CITY_COORDS[city]
  const cityBounds = useMemo(() => cityBoundsKm(cityCoords, 50), [cityCoords])
  const mapOptions = useMemo(() => ({ suppressMapOpenBlock: true }), [])
  const [isYandexReady, setIsYandexReady] = useState(false)
  const yandexReadyRef = useRef(false)
  const mapInstanceRef = useRef<{ getCenter: () => number[] } | null>(null)
  const [addPinCoords, setAddPinCoords] = useState<{ lat: number; lng: number } | null>(null)
  const viewerTag = vkUser ? vkIdTagFromNumericId(vkUser.id) : null

  const shouldDisplayRide = useCallback(
    (ride: SupabaseRide) => {
      const st = normalizeRideStatus(ride.status)
      const isOwner = Boolean(viewerTag && ride.vk_id === viewerTag)
      const isDriver = Boolean(
        viewerTag && (ride.driver_id === viewerTag || ride.partner_vk_id === viewerTag)
      )
      if (st === "searching") return true
      if (st === "accepted" || st === "arrived" || st === "in_transit") return isOwner || isDriver
      if (st === "completed" || st === "cancelled") return isOwner || isDriver
      return true
    },
    [viewerTag]
  )

  const mapMarkers = useMemo(() => {
    const counters = {
      total: rides.length,
      cityMatched: 0,
      withCoords: 0,
      visible: 0,
    }

    const markers = rides.map((ride) => {
      if (matchesCity(ride.city as AppCity | null, city)) counters.cityMatched += 1

      const coords = parseRideCoords(ride)
      if (!coords) return null
      counters.withCoords += 1

      counters.visible += 1

      const createdAt = new Date(ride.created_at).getTime()
      const now = Date.now()
      const elapsedMin = Math.floor((now - createdAt) / 60000)
      const persistent = isPersistentRideType(ride.type)
      const timer = persistent ? 180 : Math.max(0, 180 - elapsedMin)
      const [lat, lng] = coords

      const rideAsDriver: DriverData = {
        id: ride.id,
        name: ride.name || "Пользователь",
        avatar:
          (ride.avatar && ride.avatar.startsWith("http") && ride.avatar) ||
          (vkUser ? `${vkUser.first_name} ${vkUser.last_name}` : getAvatarLabel(ride.name || "Пользователь", ride.avatar)),
        coords: [lat, lng],
        price: ride.price || 0,
        timer,
        car: ride.car || "Авто",
        rating: ride.rating || 4.5,
        trips: ride.trips || 0,
        vkId: ride.vk_id || "",
        telegram: ride.telegram || "",
        supabaseId: ride.id,
        driverId: ride.driver_id ?? null,
        driverPhotoUrl: ride.avatar?.startsWith("http") ? ride.avatar : undefined,
        rideType: ride.type,
        rideStatus: normalizeRideStatus(ride.status),
        rideComment: ride.comment ?? null,
        fromLocation: ride.from_location,
        toLocation: ride.to_location,
        activeRide: ride,
      }

      return {
        key: `supabase-${ride.id}`,
        driver: rideAsDriver,
        persistent,
        createdAt: ride.created_at,
        rideType: ride.type,
      }
    }).filter(Boolean) as {
      key: string
      driver: DriverData
      persistent: boolean
      createdAt: string
      rideType: string | null | undefined
    }[]

    return { markers, counters }
  }, [rides, city, vkUser])

  useEffect(() => {
    yandexReadyRef.current = false
    setIsYandexReady(false)
    mapInstanceRef.current = null
  }, [city])

  useEffect(() => {
    if (!showAddRequest) return
    const m = mapInstanceRef.current
    if (m) {
      const c = m.getCenter()
      setAddPinCoords({ lat: c[0], lng: c[1] })
    } else {
      const [la, ln] = APP_CITY_COORDS[city]
      setAddPinCoords({ lat: la, lng: ln })
    }
  }, [showAddRequest, city])

  return (
    <div className="relative flex-1 overflow-hidden">
      <div className="absolute left-3 top-3 z-20 rounded-full bg-white/95 px-3 py-2 text-xs font-semibold text-[#2C2D2E] shadow-lg ring-1 ring-[#E1E3E6]/80 backdrop-blur">
        На карте: {mapMarkers.markers.length}
        {ridesError && (
          <span className="ml-2 text-[#E64646]">Ошибка</span>
        )}
      </div>
      {isVkReady ? (
        <YMaps query={{ apikey: "77552578-1483-4cc6-8510-a0a7f7f340aa", lang: "ru_RU" }}>
          <YMap
            key={city}
            instanceRef={(inst) => {
              mapInstanceRef.current = (inst as { getCenter: () => number[] } | null) ?? null
              if (inst && !yandexReadyRef.current) {
                yandexReadyRef.current = true
                setIsYandexReady(true)
              }
            }}
            defaultState={{ center: cityCoords, zoom: 14 }}
            className="w-full h-full"
            options={mapOptions}
          >
            {mapMarkers.markers.map((marker) => (
              <DriverPlacemark
                key={marker.key}
                driver={marker.driver}
                isPersistent={marker.persistent}
                createdAt={marker.createdAt}
                rideType={marker.rideType}
                onClick={() => setSelectedDriver(marker.driver)}
              />
            ))}
          </YMap>
        </YMaps>
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[#EBEDF0] text-[#818C99]">
          Инициализация VK Mini App...
        </div>
      )}

      {isVkReady && !isYandexReady && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#EBEDF0]/85 text-[#818C99] backdrop-blur-sm">
          <div className="rounded-2xl bg-white px-4 py-3 text-sm font-medium shadow-sm ring-1 ring-[#E1E3E6]">
            Загрузка карты...
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowAddRequest(true)}
        className="absolute bottom-6 right-4 z-10 flex h-14 w-14 items-center justify-center rounded-full bg-[#2787F5] text-white shadow-xl shadow-[#2787F5]/25 ring-4 ring-white/90 transition-transform active:scale-95"
        aria-label="Новая заявка"
      >
        <Plus className="h-7 w-7" />
      </button>

      {selectedDriver && (
        <DriverBottomSheet
          driver={selectedDriver}
          viewerVkTag={vkUser ? vkIdTagFromNumericId(vkUser.id) : null}
          userRole={userRole}
          onClose={() => setSelectedDriver(null)}
          onBooking={() =>
            void onBooking({
              name: selectedDriver.name,
              avatar: selectedDriver.avatar,
              rating: selectedDriver.rating,
              trips: selectedDriver.trips,
              vkId: selectedDriver.vkId,
              telegram: selectedDriver.telegram,
            })
          }
          onCityPickup={onCityPickup}
          onDriverOffer={onDriverOffer}
          onPassengerCancel={onPassengerCancel}
          onDriverArrive={onDriverArrive}
          onDriverStart={onDriverStart}
          onDriverComplete={onDriverComplete}
          onStatusChanged={onRideStatusChanged}
          onDelete={onRideDeleted}
        />
      )}

      {showAddRequest && (
        <AddRequestModal
          variant={mode === "city" ? (userRole === "Driver" ? "cityDriver" : "cityPassenger") : "intercity"}
          pinCoords={addPinCoords}
          onClose={() => setShowAddRequest(false)}
          onRideAdded={onRideAdded}
          userRole={userRole}
          mode={mode}
          city={city}
          vkUser={vkUser}
        />
      )}
    </div>
  )
}
