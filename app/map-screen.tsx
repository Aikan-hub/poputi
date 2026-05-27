"use client"

import { useEffect, useState, useCallback, useMemo, useRef } from "react"
import { YMaps, Map as YMap } from "@pbe/react-yandex-maps"
import { MapPin, Plus } from "lucide-react"
import { FloatingMapChrome, poputi } from "@/components/poputi/ui"
import { DriverActiveRideBar } from "@/components/poputi/driver-active-bar"
import { cn } from "@/lib/utils"
import { isPersistentRideType } from "@/lib/rides"
import { normalizeRideStatus } from "@/lib/ride-status"
import { APP_CITY_COORDS, type AppCity } from "@/lib/cities"
import type { DriverData, Mode, SupabaseRide, VkUserProfile } from "./types"
import { parseRideCoords, matchesCity, cityBoundsKm, getAvatarLabel, vkIdTagFromNumericId, isCityMapRide } from "./helpers"
import { getYandexMapsApiKey } from "@/lib/env"
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
  onRetryRides,
  onBackToCitySelect,
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
  onRetryRides?: () => void
  onBackToCitySelect: () => void
}) {
  return (
    <div className="flex h-full flex-col bg-gray-100">
      {mode === "city" ? (
        <CityMapView
          city={city}
          mode={mode}
          setMode={setMode}
          onBackToCitySelect={onBackToCitySelect}
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
          onRetryRides={onRetryRides}
        />
      ) : (
        <>
          <header className="relative z-20 shrink-0 border-b border-gray-100 bg-white px-4 py-3 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onBackToCitySelect}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-lg"
              >
                <span className="space-y-1.5">
                  <span className="block h-0.5 w-5 rounded-full bg-gray-800" />
                  <span className="block h-0.5 w-4 rounded-full bg-gray-800" />
                </span>
              </button>
              <div className="flex rounded-full bg-white/95 p-1 shadow-lg ring-1 ring-black/5">
                <button
                  type="button"
                  onClick={() => setMode("city")}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold text-gray-500"
                >
                  Город
                </button>
                <button
                  type="button"
                  onClick={() => setMode("intercity")}
                  className="rounded-full bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Межгород
                </button>
              </div>
              <div className="w-12" />
            </div>
          </header>
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
        </>
      )}
    </div>
  )
}

function CityMapView({
  city,
  mode,
  setMode,
  onBackToCitySelect,
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
  onRetryRides,
}: {
  city: AppCity
  mode: Mode
  setMode: (mode: Mode) => void
  onBackToCitySelect: () => void
  isVkReady: boolean
  vkUser: VkUserProfile | null
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
  onRetryRides?: () => void
}) {
  const cityCoords = APP_CITY_COORDS[city]
  const cityBounds = useMemo(() => cityBoundsKm(cityCoords, 50), [cityCoords])
  const mapOptions = useMemo(
    () => ({
      suppressMapOpenBlock: true,
      suppressObsoleteBrowserNotifier: true,
    }),
    []
  )
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
      if (!matchesCity(ride.city as AppCity | null, city)) return null
      if (!isCityMapRide(ride)) return null
      counters.cityMatched += 1

      if (!shouldDisplayRide(ride)) return null

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
  }, [rides, city, vkUser, shouldDisplayRide])

  const myActiveDriverRide = useMemo(() => {
    if (!viewerTag || userRole !== "Driver") return null
    return rides.find((r) => {
      if (!isCityMapRide(r)) return false
      if (r.driver_id !== viewerTag) return false
      const st = normalizeRideStatus(r.status)
      return st === "accepted" || st === "arrived" || st === "in_transit"
    })
  }, [rides, viewerTag, userRole])

  const activeDriverData = useMemo(() => {
    if (!myActiveDriverRide) return null
    const coords = parseRideCoords(myActiveDriverRide)
    if (!coords) return null
    const [lat, lng] = coords
    return {
      ride: {
        id: myActiveDriverRide.id,
        name: myActiveDriverRide.name || "Пассажир",
        avatar: getAvatarLabel(myActiveDriverRide.name || "П", myActiveDriverRide.avatar),
        coords: [lat, lng] as [number, number],
        price: myActiveDriverRide.price || 0,
        timer: 0,
        car: "",
        rating: myActiveDriverRide.rating || 5,
        trips: myActiveDriverRide.trips || 0,
        vkId: myActiveDriverRide.vk_id || "",
        telegram: myActiveDriverRide.telegram || "",
        supabaseId: myActiveDriverRide.id,
        driverId: myActiveDriverRide.driver_id ?? null,
        rideType: myActiveDriverRide.type,
        rideStatus: normalizeRideStatus(myActiveDriverRide.status),
        fromLocation: myActiveDriverRide.from_location,
        toLocation: myActiveDriverRide.to_location,
        activeRide: myActiveDriverRide,
      },
      passengerName: myActiveDriverRide.name || "Пассажир",
      passengerAvatar: myActiveDriverRide.avatar?.startsWith("http") ? myActiveDriverRide.avatar : undefined,
    }
  }, [myActiveDriverRide])

  const isPassenger = userRole !== "Driver"
  const showPassengerTeaser = isPassenger && !showAddRequest && !selectedDriver && !myActiveDriverRide

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
      <FloatingMapChrome
        city={city}
        mode={mode}
        onBackToCity={onBackToCitySelect}
        onModeCity={() => setMode("city")}
        onModeIntercity={() => setMode("intercity")}
        isDriver={userRole === "Driver"}
      />

      {ridesError && (
        <div className="absolute left-3 right-3 top-16 z-20 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 shadow-lg">
          <p className="text-sm font-medium text-red-600">Не удалось загрузить заявки</p>
          <p className="mt-0.5 text-xs text-gray-500">{ridesError}</p>
          {onRetryRides && (
            <button
              type="button"
              onClick={() => onRetryRides()}
              className="mt-2 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-[#2787F5] ring-1 ring-gray-200"
            >
              Повторить
            </button>
          )}
        </div>
      )}
      {isVkReady ? (
        <div className="poputi-yandex-map h-full w-full">
          <YMaps query={{ apikey: getYandexMapsApiKey(), lang: "ru_RU" }}>
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
              className="h-full w-full"
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
        </div>
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gray-100 text-gray-500">
          Инициализация VK Mini App...
        </div>
      )}

      {isVkReady && !isYandexReady && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-100/85 text-gray-500 backdrop-blur-sm">
          <div className="rounded-2xl bg-white px-4 py-3 text-sm font-medium shadow-sm ring-1 ring-gray-200">
            Загрузка карты...
          </div>
        </div>
      )}

      {showPassengerTeaser && (
        <button
          type="button"
          onClick={() => setShowAddRequest(true)}
          className={cn(
            "absolute bottom-0 left-0 right-0 z-10 px-6 pb-8 pt-4 text-left",
            poputi.sheet
          )}
        >
          <h2 className="text-xl font-bold text-gray-900">Куда поедем?</h2>
          <p className="mt-1 text-sm text-gray-500">Нажмите, чтобы указать маршрут и цену</p>
        </button>
      )}

      {userRole === "Driver" && !myActiveDriverRide && (
        <button
          type="button"
          onClick={() => setShowAddRequest(true)}
          className="absolute bottom-6 right-4 z-10 flex h-14 w-14 items-center justify-center rounded-full bg-[#2787F5] text-white shadow-xl shadow-[#2787F5]/30 ring-4 ring-white/90 transition-transform active:scale-95"
          aria-label="Новая заявка"
        >
          <Plus className="h-7 w-7" />
        </button>
      )}

      {activeDriverData && (
        <DriverActiveRideBar
          ride={activeDriverData.ride}
          passengerName={activeDriverData.passengerName}
          passengerAvatarUrl={activeDriverData.passengerAvatar}
          passengerRating={myActiveDriverRide?.rating}
          onChat={() =>
            void onBooking({
              name: activeDriverData.passengerName,
              avatar: activeDriverData.ride.avatar,
              vkId: myActiveDriverRide?.vk_id,
            })
          }
          onArrive={() => onDriverArrive(myActiveDriverRide!)}
          onStart={() => onDriverStart(myActiveDriverRide!)}
          onComplete={() => onDriverComplete(myActiveDriverRide!)}
        />
      )}

      {showAddRequest && isPassenger && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 text-[#2787F5]">
          <MapPin size={48} className="poputi-map-pin drop-shadow-lg" fill="currentColor" />
        </div>
      )}

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
