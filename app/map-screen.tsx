"use client"

import { useEffect, useState, useCallback, useMemo, useRef } from "react"
import type { ReactNode } from "react"
import { YMaps, Map as YMap } from "@pbe/react-yandex-maps"
import {
  Activity,
  ChevronDown,
  ChevronUp,
  Clock3,
  MapPin,
  Navigation,
  Plus,
  Route,
  WalletCards,
} from "lucide-react"
import { FloatingMapChrome, poputi } from "@/components/poputi/ui"
import { DriverActiveRideBar } from "@/components/poputi/driver-active-bar"
import { cn } from "@/lib/utils"
import {
  formatPassengerSeatsLabel,
  isCityPassengerRide,
  passengerSeatCountFromRide,
} from "@/lib/passenger-seats"
import { isPersistentRideType, isRideVisibleOnMap, rideMapTimerMinutes } from "@/lib/rides"
import { normalizeRideStatus } from "@/lib/ride-status"
import { APP_CITY_COORDS, type AppCity } from "@/lib/cities"
import { DEFAULT_USER_SETTINGS, loadUserSettings, type UserSettings } from "@/lib/user-settings"
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
  const cityBounds = useMemo(() => cityBoundsKm(cityCoords, 22), [cityCoords])
  const mapOptions = useMemo(
    () => ({
      suppressMapOpenBlock: true,
      suppressObsoleteBrowserNotifier: true,
      restrictMapArea: cityBounds,
      minZoom: 11,
      maxZoom: 18,
    }),
    [cityBounds]
  )
  const [isYandexReady, setIsYandexReady] = useState(false)
  const [userSettings, setUserSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS)
  const yandexReadyRef = useRef(false)
  const mapInstanceRef = useRef<{ getCenter: () => number[] } | null>(null)
  const [addPinCoords, setAddPinCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [mapClock, setMapClock] = useState(0)
  const viewerTag = vkUser ? vkIdTagFromNumericId(vkUser.id) : null

  useEffect(() => {
    const id = setInterval(() => setMapClock((t) => t + 1), 15000)
    return () => clearInterval(id)
  }, [])

  const shouldDisplayRide = useCallback(
    (ride: SupabaseRide) => {
      if (!isRideVisibleOnMap(ride.created_at, ride.type, ride.status)) {
        const st = normalizeRideStatus(ride.status)
        if (st === "searching") return false
      }
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

      const persistent = isPersistentRideType(ride.type)
      const timer = rideMapTimerMinutes(ride.created_at, ride.type)
      if (!persistent && timer <= 0) return null
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
        requestedSeats: isCityPassengerRide(ride.type)
          ? passengerSeatCountFromRide(ride)
          : undefined,
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
  }, [rides, city, vkUser, shouldDisplayRide, mapClock])

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

  const rideRadar = useMemo(
    () => buildRideRadar(mapMarkers.markers, cityCoords, userSettings.radar),
    [mapMarkers.markers, cityCoords, userSettings.radar]
  )
  const isPassenger = userRole !== "Driver"
  const showPassengerTeaser = isPassenger && !showAddRequest && !selectedDriver && !myActiveDriverRide
  const showDriverRadar = !isPassenger && !showAddRequest && !selectedDriver && !myActiveDriverRide

  useEffect(() => {
    yandexReadyRef.current = false
    setIsYandexReady(false)
    mapInstanceRef.current = null
  }, [city])

  useEffect(() => {
    setUserSettings(loadUserSettings())
  }, [])

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
          Инициализация VK Mini App…
        </div>
      )}

      {isVkReady && !isYandexReady && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-100/85 text-gray-500 backdrop-blur-sm">
          <div className="rounded-2xl bg-white px-4 py-3 text-sm font-medium shadow-sm ring-1 ring-gray-200">
            Загрузка карты…
          </div>
        </div>
      )}

      {(showPassengerTeaser || showDriverRadar) && (
        <RideRadarPanel
          radar={rideRadar}
          onCreateRequest={() => setShowAddRequest(true)}
          onSelectRide={(driver) => setSelectedDriver(driver)}
        />
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

type RideRadarMarker = {
  driver: DriverData
  persistent: boolean
  createdAt: string
}

type RideRadarItem = {
  driver: DriverData
  routeTitle: string
  meta: string
  priceLabel: string
  distanceLabel: string
  freshnessLabel: string
  score: number
}

type RideRadar = {
  total: number
  freshCount: number
  averagePriceLabel: string
  items: RideRadarItem[]
}

function rideRadarItemKey(item: RideRadarItem) {
  return `${item.driver.id}-${item.driver.supabaseId ?? "ride"}`
}

function RideRadarPanel({
  radar,
  onCreateRequest,
  onSelectRide,
}: {
  radar: RideRadar
  onCreateRequest: () => void
  onSelectRide: (driver: DriverData) => void
}) {
  const hasRides = radar.total > 0
  const [panelOpen, setPanelOpen] = useState(false)
  const [expandedItemKey, setExpandedItemKey] = useState<string | null>(null)

  const summaryLabel = hasRides
    ? `${radar.total} ${pluralizeRu(radar.total, "вариант", "варианта", "вариантов")} рядом`
    : "Куда поедем?"

  return (
    <div className="absolute bottom-0 left-0 right-0 z-10 px-3 pb-3">
      <div className="poputi-glass overflow-hidden rounded-[1.5rem] px-3 shadow-[0_-12px_36px_-12px_rgba(15,23,42,0.18)]">
        <div className="flex items-center gap-2 py-2">
          <button
            type="button"
            onClick={() => hasRides && setPanelOpen((v) => !v)}
            disabled={!hasRides}
            className={cn(
              "poputi-focus-ring flex min-w-0 flex-1 items-center gap-2 rounded-xl text-left",
              hasRides && "py-0.5 pr-1"
            )}
            aria-expanded={hasRides ? panelOpen : undefined}
            aria-label={panelOpen ? "Свернуть радар" : "Развернуть радар"}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#EAF2FF] to-[#DCE9FF] ring-1 ring-[#2787F5]/15">
              <Activity className="h-3.5 w-3.5 text-[#2787F5]" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <span className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#2787F5]">
                Радар
              </span>
              <p className="truncate text-sm font-bold leading-tight text-gray-900">{summaryLabel}</p>
            </div>
            {hasRides && (
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/90 text-gray-600 ring-1 ring-gray-100 shadow-sm">
                {panelOpen ? (
                  <ChevronDown className="h-4 w-4" aria-hidden />
                ) : (
                  <ChevronUp className="h-4 w-4 rotate-180" aria-hidden />
                )}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={onCreateRequest}
            className="poputi-focus-ring poputi-grad-primary flex shrink-0 items-center gap-1 rounded-full px-3.5 py-1.5 text-xs font-bold text-white shadow-[0_8px_18px_-6px_rgba(39,135,245,0.55)] ring-1 ring-white/30 active:scale-95"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Заявка
          </button>
        </div>

        {panelOpen && hasRides && (
          <>
            <div className="flex gap-1.5 border-t border-gray-100 pb-2 pt-2">
              <RadarStatChip
                icon={<Navigation className="h-3 w-3" aria-hidden />}
                label="На карте"
                value={String(radar.total)}
              />
              <RadarStatChip
                icon={<WalletCards className="h-3 w-3" aria-hidden />}
                label="Средняя"
                value={radar.averagePriceLabel}
              />
              <RadarStatChip
                icon={<Clock3 className="h-3 w-3" aria-hidden />}
                label="Свежие"
                value={String(radar.freshCount)}
              />
            </div>

            <div className="max-h-[min(32vh,220px)] space-y-1 overflow-y-auto overscroll-contain border-t border-gray-100 pb-2 pt-2">
              {radar.items.map((item) => {
                const key = rideRadarItemKey(item)
                const isExpanded = expandedItemKey === key

                return (
                  <div
                    key={key}
                    className="overflow-hidden rounded-2xl bg-white/80 ring-1 ring-gray-100/90 shadow-[0_2px_8px_-4px_rgba(15,23,42,0.08)] transition-shadow hover:shadow-[0_8px_22px_-10px_rgba(39,135,245,0.25)]"
                  >
                    <div className="flex items-center gap-1 pr-1">
                      <button
                        type="button"
                        onClick={() => setExpandedItemKey(isExpanded ? null : key)}
                        className="poputi-focus-ring flex h-9 w-9 shrink-0 items-center justify-center text-gray-500"
                        aria-expanded={isExpanded}
                        aria-label={isExpanded ? "Свернуть заявку" : "Развернуть заявку"}
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" aria-hidden />
                        ) : (
                          <ChevronDown className="h-4 w-4" aria-hidden />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => onSelectRide(item.driver)}
                        className="poputi-focus-ring flex min-w-0 flex-1 items-center gap-2 py-2 pr-2 text-left"
                        aria-label={`Открыть поездку ${item.routeTitle}`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-bold text-gray-900">
                            {item.routeTitle}
                          </div>
                          {!isExpanded && (
                            <div className="truncate text-[11px] font-medium text-gray-500">
                              {item.meta} · {item.distanceLabel}
                            </div>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-xs font-bold text-gray-900">{item.priceLabel}</div>
                          <div className="text-[10px] font-medium text-gray-400">
                            {item.freshnessLabel}
                          </div>
                        </div>
                      </button>
                    </div>
                    {isExpanded && (
                      <div className="border-t border-gray-100 px-3 pb-2.5 pt-1">
                        <p className="text-[11px] font-medium text-gray-500">{item.meta}</p>
                        <p className="mt-0.5 text-[11px] text-gray-400">
                          {item.distanceLabel} · {item.freshnessLabel}
                        </p>
                        <button
                          type="button"
                          onClick={() => onSelectRide(item.driver)}
                          className="poputi-focus-ring mt-2 w-full rounded-lg bg-[#2787F5] px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          Открыть на карте
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {!hasRides && (
          <button
            type="button"
            onClick={onCreateRequest}
            className="poputi-focus-ring mb-2 w-full rounded-xl bg-gray-50 px-3 py-2.5 text-left"
          >
            <div className="text-xs font-bold text-gray-900">Создать заявку</div>
            <div className="mt-0.5 text-[11px] text-gray-500">
              Укажите маршрут и цену — водители увидят на карте
            </div>
          </button>
        )}
      </div>
    </div>
  )
}

function RadarStatChip({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0 flex-1 rounded-xl bg-white/80 px-2.5 py-1.5 ring-1 ring-gray-100/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-1 text-gray-400">
        {icon}
        <span className="truncate text-[10px] font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <div className="truncate text-xs font-bold text-gray-900">{value}</div>
    </div>
  )
}

function buildRideRadar(
  markers: RideRadarMarker[],
  cityCenter: [number, number],
  radarSettings: UserSettings["radar"]
): RideRadar {
  const scoredMarkers = markers
    .map((marker) => {
      const createdAt = new Date(marker.createdAt).getTime()
      const ageMinutes = Number.isFinite(createdAt) ? Math.max(0, Math.floor((Date.now() - createdAt) / 60000)) : 999
      const distanceKm = distanceKmBetween(cityCenter, marker.driver.coords)
      return { marker, ageMinutes, distanceKm }
    })
    .filter(({ marker, ageMinutes, distanceKm }) => {
      if (distanceKm > radarSettings.radiusKm) return false
      if (marker.driver.rating < radarSettings.minRating) return false
      if (radarSettings.maxPrice > 0 && marker.driver.price > radarSettings.maxPrice) return false
      if (radarSettings.freshOnly && ageMinutes > 15 && !marker.persistent) return false
      return true
    })

  const pricedMarkers = scoredMarkers.filter(({ marker }) => marker.driver.price > 0)
  const averagePrice =
    pricedMarkers.length > 0
      ? Math.round(pricedMarkers.reduce((sum, { marker }) => sum + marker.driver.price, 0) / pricedMarkers.length)
      : 0

  const items = scoredMarkers
    .map(({ marker, ageMinutes, distanceKm }) => {
      const driver = marker.driver
      const priceScore = driver.price > 0 ? driver.price / 1000 : 0.8
      const persistentBonus = marker.persistent ? -0.35 : 0
      const score = distanceKm * 1.15 + ageMinutes * 0.035 + priceScore + persistentBonus

      return {
        driver,
        routeTitle: routeTitle(driver),
        meta: [
          driver.name || "Пользователь",
          driver.car && driver.car !== "Авто" ? driver.car : null,
          isCityPassengerRide(driver.rideType) && driver.requestedSeats
            ? formatPassengerSeatsLabel(driver.requestedSeats)
            : null,
        ]
          .filter(Boolean)
          .join(" · "),
        priceLabel: driver.price > 0 ? `${driver.price} ₽` : "В чате",
        distanceLabel: formatDistance(distanceKm),
        freshnessLabel: formatFreshness(ageMinutes),
        score,
      }
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)

  return {
    total: scoredMarkers.length,
    freshCount: scoredMarkers.filter(({ ageMinutes }) => ageMinutes <= 15).length,
    averagePriceLabel: averagePrice > 0 ? `${averagePrice} ₽` : "—",
    items,
  }
}

function routeTitle(driver: DriverData): string {
  const from = driver.fromLocation?.trim()
  const to = driver.toLocation?.trim()
  if (from && to) return `${from} → ${to}`
  if (to) return `До ${to}`
  if (from) return `От ${from}`
  return driver.rideType === "Driver" ? "Водитель на линии" : "Поездка по городу"
}

function formatDistance(distanceKm: number): string {
  if (!Number.isFinite(distanceKm)) return "рядом"
  if (distanceKm < 1) return `${Math.max(100, Math.round(distanceKm * 1000 / 50) * 50)} м`
  return `${distanceKm.toFixed(distanceKm < 10 ? 1 : 0)} км`
}

function formatFreshness(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes > 180) return "давно"
  if (minutes < 1) return "сейчас"
  if (minutes < 60) return `${minutes} мин`
  return `${Math.floor(minutes / 60)} ч`
}

function distanceKmBetween(a: [number, number], b: [number, number]): number {
  const earthRadiusKm = 6371
  const dLat = toRadians(b[0] - a[0])
  const dLng = toRadians(b[1] - a[1])
  const lat1 = toRadians(a[0])
  const lat2 = toRadians(b[0])
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return 2 * earthRadiusKm * Math.asin(Math.min(1, Math.sqrt(h)))
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

function pluralizeRu(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}
