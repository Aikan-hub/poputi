"use client"

import { useEffect, useState, useCallback, useMemo, useRef } from "react"
import { YMaps, Map as YMap, Placemark } from "@pbe/react-yandex-maps"
import bridge from "@vkontakte/vk-bridge"
import { AdminPanel } from "@/components/admin-panel"
import { CityIntroSplash } from "@/components/city-intro-splash"
import { IntercityDriverManageModal } from "@/components/intercity-driver-manage-modal"
import { IntercitySeatBookModal } from "@/components/intercity-seat-book-modal"
import { ReviewRideDialog } from "@/components/review-ride-dialog"
import { isAdminVkUser } from "@/lib/admin-config"
import { isPersistentRideType, isRideWithinActiveWindow } from "@/lib/rides"
import {
  type RideStatus,
  statusLabel,
  canPassengerCancel,
  canDriverTake,
  canDriverStart,
  canDriverComplete,
  isActiveStatus,
} from "@/lib/ride-status"
import { cityRadarMarkerColor, cityRideTimeProgress, shouldPulseCityRadar } from "@/lib/city-radar"
import {
  appendThreadMessage,
  deleteChatThread,
  ensureChatThread,
  fetchThreadMessages,
  fetchThreadsForUser,
  type ChatThreadRow,
} from "@/lib/chats-db"
import {
  DRIVER_ACCESS_PRICE_LABEL,
  checkDriverInvoicePaid,
  createDriverPaymentIntent,
  grantDriverAccessLocally,
  hasDriverAccess,
  openPaymentUrl,
  setPendingDriverInvoice,
  syncDriverAccessFromServer,
} from "@/lib/driver-payment"
import { rpcBookIntercitySeat } from "@/lib/intercity-booking"
import { supabase } from "@/lib/supabase-client"
import { APP_CITY_COORDS, type AppCity, DEFAULT_APP_CITY } from "@/lib/cities"
import { calculateUserLevel, isLegendLevel } from "@/lib/user-level"
import {
  Map,
  MessageCircle,
  User,
  ChevronLeft,
  Plus,
  Zap,
  Clock,
  Car,
  Send,
  ExternalLink,
  Trash2,
  Shield,
  Crown,
} from "lucide-react"

/** Чат из Supabase `chat_threads`; `id` === `threadId` (uuid). */
export type ChatData = {
  id: string
  threadId: string
  name: string
  avatar: string
  lastMessage: string
  time: string
  unread: number
  rating: number
  trips: number
  vkId: string
  telegram: string
  vkTag?: string
}

const getAvatarLabel = (name: string, avatar?: string) => {
  if (avatar && !avatar.startsWith("http")) return avatar
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("")
  return initials || "П"
}

function formatChatListTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  const now = new Date()
  const sameDay =
    d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  if (sameDay) {
    return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
  }
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })
}

function threadRowToChatData(row: ChatThreadRow, myTag: string): ChatData {
  const peerVk = row.vk_lower === myTag ? row.vk_higher : row.vk_lower
  const labels = row.peer_labels || {}
  const displayName = labels[peerVk]?.trim() || `Пользователь ${peerVk.replace(/^id/i, "")}`
  return {
    id: row.id,
    threadId: row.id,
    name: displayName,
    avatar: getAvatarLabel(displayName),
    lastMessage: row.last_message || "Нет сообщений",
    time: formatChatListTime(row.last_message_at),
    unread: 0,
    rating: 5,
    trips: 0,
    vkId: peerVk,
    vkTag: peerVk,
    telegram: "",
  }
}

/** Как `vk_id` сохраняется в Supabase при создании заявки */
function vkIdTagFromNumericId(id: number): string {
  return `id${id}`
}

function rideTypeLabelRu(type: string | null | undefined): string {
  const t = (type || "").trim()
  const map: Record<string, string> = {
    Driver: "Водитель",
    Passenger: "Пассажир",
    City: "Город",
    Static: "Статичная точка",
    AdminPoint: "Точка админа",
  }
  return map[t] || t || "—"
}

// VK messages permission flag
const VK_MSGS_ALLOWED_KEY = "vk_msgs_allowed"
// TODO: замените на реальный ID группы VK (число)
const VK_GROUP_ID = 238429423
const ROLE_KEY = "poputi_role"

function resolveReviewTargetVk(ride: SupabaseRide, myTag: string): string | null {
  const owner = (ride.vk_id || "").trim()
  const partner = (ride.partner_vk_id || "").trim()
  if (owner === myTag && partner) return partner
  if (partner === myTag && owner) return owner
  return null
}

function targetDisplayLabelForReview(ride: SupabaseRide, myTag: string): string {
  const owner = (ride.vk_id || "").trim()
  if (owner !== myTag) return ride.name?.trim() || "Пользователь"
  return "Попутчик"
}

type Tab = "map" | "chats" | "profile"
type Mode = "city" | "intercity"

type DriverData = {
  id: number
  name: string
  avatar: string
  coords: [number, number]
  price: number
  timer: number
  car: string
  rating: number
  trips: number
  vkId: string
  telegram: string
  supabaseId?: number
  driverId?: string | null
  rideType?: string | null
  rideStatus?: string | null
  rideComment?: string | null
  fromLocation?: string
  toLocation?: string
  activeRide?: SupabaseRide
  driverPhotoUrl?: string
}

type RideData = {
  id: number
  from: string
  to: string
  price: number
  driver: string
  avatar: string
  time: string
  seats: number
  boosted: boolean
  car: string
  rating: number
  trips: number
  vkId: string
  telegram: string
  supabaseId?: number
  rawRide?: SupabaseRide
  isLegendDriver?: boolean
  availableSeats?: number
  totalSeats?: number
  driverPhotoUrl?: string
}

// Supabase ride type
interface SupabaseRide {
  id: number
  lat: number | null
  lng: number | null
  price: number
  type: string
  created_at: string
  from_location?: string
  to_location?: string
  name?: string
  avatar?: string
  car?: string
  rating?: number
  trips?: number
  vk_id?: string
  partner_vk_id?: string | null
  driver_id?: string | null
  telegram?: string
  seats?: number
  total_seats?: number
  available_seats?: number
  city?: string | null
  status?: string | null
  comment?: string | null
}

interface VkUserProfile {
  id: number
  first_name: string
  last_name: string
  photo_200?: string
}

declare global {
  interface Window {
    __VK_INIT_READY__?: boolean
    vkBridgeInitialized?: boolean
    ymaps?: unknown
  }
}

export default function PoputiApp() {
  const [selectedCity, setSelectedCity] = useState<AppCity>(DEFAULT_APP_CITY)
  const [activeTab, setActiveTab] = useState<Tab>("map")
  const [mode, setMode] = useState<Mode>("city")
  const [selectedDriver, setSelectedDriver] = useState<DriverData | null>(null)
  const [isDriverState, setIsDriverState] = useState(() => {
    if (typeof window === "undefined") return false
    return window.localStorage.getItem(ROLE_KEY) === "driver"
  })
  const setIsDriver = useCallback((next: boolean) => {
    setIsDriverState(next)
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ROLE_KEY, next ? "driver" : "passenger")
    }
  }, [])
  const isDriver = isDriverState
  const [showAddRequest, setShowAddRequest] = useState(false)
  const [intercityAddRequestOpen, setIntercityAddRequestOpen] = useState(false)
  const [selectedChat, setSelectedChat] = useState<ChatData | null>(null)
  const [publicProfile, setPublicProfile] = useState<ChatData | null>(null)
  const [chats, setChats] = useState<ChatData[]>([])
  const [chatsLoading, setChatsLoading] = useState(false)
  const [rides, setRides] = useState<SupabaseRide[]>([])
  const [isVkReady, setIsVkReady] = useState(false)
  const [vkUser, setVkUser] = useState<VkUserProfile | null>(null)
  const [activeScreen, setActiveScreen] = useState<"main" | "admin">("main")
  const [introCityDone, setIntroCityDone] = useState(false)
  const [driverAccessRev, setDriverAccessRev] = useState(0)
  const [intercityManageRide, setIntercityManageRide] = useState<SupabaseRide | null>(null)
  const [intercitySeatBookRide, setIntercitySeatBookRide] = useState<SupabaseRide | null>(null)
  const [vkMsgsAllowed, setVkMsgsAllowed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false
    return window.localStorage.getItem(VK_MSGS_ALLOWED_KEY) === "1"
  })

  // Ensure default role = passenger; if stored driver but нет доступа — сбросить
  useEffect(() => {
    if (typeof window === "undefined") return
    const stored = window.localStorage.getItem(ROLE_KEY)
    const hasAccess = hasDriverAccess()
    if (!stored) {
      window.localStorage.setItem(ROLE_KEY, "passenger")
      setIsDriverState(false)
      return
    }
    if (stored === "driver" && !hasAccess) {
      window.localStorage.setItem(ROLE_KEY, "passenger")
      setIsDriverState(false)
    }
  }, [driverAccessRev])

  useEffect(() => {
    if (!vkUser || !introCityDone) return
    const tag = vkIdTagFromNumericId(vkUser.id)
    void syncDriverAccessFromServer(tag).then((granted) => {
      if (granted) setDriverAccessRev((v) => v + 1)
    })
  }, [vkUser, introCityDone])

  useEffect(() => {
    if (window.vkBridgeInitialized || window.__VK_INIT_READY__) {
      setIsVkReady(true)
      return
    }

    const onBridgeReady = () => setIsVkReady(true)
    const onBridgeFailed = () => setIsVkReady(true)
    window.addEventListener("vk-bridge-ready", onBridgeReady)
    window.addEventListener("vk-bridge-failed", onBridgeFailed)

    // Fallback for non-VK environments where bridge init may not resolve.
    const fallbackTimer = window.setTimeout(() => setIsVkReady(true), 1500)

    return () => {
      window.removeEventListener("vk-bridge-ready", onBridgeReady)
      window.removeEventListener("vk-bridge-failed", onBridgeFailed)
      window.clearTimeout(fallbackTimer)
    }
  }, [])

  // Запрос разрешения на сообщения от сообщества (один раз)
  useEffect(() => {
    if (!isVkReady || vkMsgsAllowed || !vkUser) return
    if (!VK_GROUP_ID) return // напоминание: подставить реальный ID
    void bridge
      .send("VKWebAppAllowMessagesFromGroup", { group_id: VK_GROUP_ID, key: "poputi_notify" })
      .then((res) => {
        if (res?.result) {
          setVkMsgsAllowed(true)
          if (typeof window !== "undefined") window.localStorage.setItem(VK_MSGS_ALLOWED_KEY, "1")
        }
      })
      .catch((err) => {
        console.warn("AllowMessagesFromGroup declined", err)
      })
  }, [isVkReady, vkMsgsAllowed, vkUser])

  // Fetch rides from Supabase (только выбранный город)
  const fetchRides = useCallback(async () => {
    const { data, error } = await supabase.from("rides").select("*").eq("city", selectedCity)
    if (data && !error) {
      setRides(data)
    }
  }, [selectedCity])

  const loadChats = useCallback(async () => {
    if (!vkUser) {
      setChats([])
      setChatsLoading(false)
      return
    }
    setChatsLoading(true)
    const tag = vkIdTagFromNumericId(vkUser.id)
    const rows = await fetchThreadsForUser(supabase, tag)
    setChats(rows.map((row) => threadRowToChatData(row, tag)))
    setChatsLoading(false)
  }, [vkUser])

  useEffect(() => {
    if (!isVkReady || !introCityDone) return
    void fetchRides()
  }, [fetchRides, isVkReady, introCityDone])

  // Realtime обновление списка заявок по городу
  useEffect(() => {
    if (!isVkReady || !introCityDone) return

    const channel = supabase
      .channel(`rides_city_${selectedCity}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rides", filter: `city=eq.${selectedCity}` },
        () => {
          void fetchRides()
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [isVkReady, introCityDone, selectedCity, fetchRides])

  // Realtime по конкретной заявке (когда открыта)
  useEffect(() => {
    const rideId =
      selectedDriver?.supabaseId || intercityManageRide?.id || intercitySeatBookRide?.id || null
    if (!rideId || !isVkReady || !introCityDone) return

    const channel = supabase
      .channel(`ride_${rideId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rides", filter: `id=eq.${rideId}` }, () => {
        void fetchRides()
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [selectedDriver?.supabaseId, intercityManageRide?.id, intercitySeatBookRide?.id, fetchRides, isVkReady, introCityDone])

  useEffect(() => {
    if (!isVkReady || !introCityDone || !vkUser) return
    void loadChats()
  }, [isVkReady, introCityDone, vkUser, loadChats])

  useEffect(() => {
    if (!isVkReady) return

    let isMounted = true
    bridge
      .send("VKWebAppGetUserInfo")
      .then((user) => {
        if (!isMounted) return
        setVkUser({
          id: user.id,
          first_name: user.first_name,
          last_name: user.last_name,
          photo_200: user.photo_200,
        })
      })
      .catch((error) => {
        console.error("VKWebAppGetUserInfo failed", error)
      })

    return () => {
      isMounted = false
    }
  }, [isVkReady])

  // Handle booking — поток в Supabase + открыть чат
  const handleBooking = useCallback(
    async (person: {
      name: string
      avatar: string
      rating?: number
      trips?: number
      vkId?: string
      telegram?: string
      messageIntro?: string
    }) => {
      const peerVk = (person.vkId || "").trim()
      if (vkUser && peerVk) {
        const myTag = vkIdTagFromNumericId(vkUser.id)
        const myName = `${vkUser.first_name} ${vkUser.last_name}`.trim()
        const threadId = await ensureChatThread(supabase, myTag, peerVk, {
          [myTag]: myName,
          [peerVk]: person.name,
        })
        const intro =
          person.messageIntro?.trim() ||
          `Здравствуйте! Интересует ваша заявка (${person.name}).`
        if (threadId) {
          await appendThreadMessage(supabase, threadId, myTag, intro)
        }
        await loadChats()
        const list = await fetchThreadsForUser(supabase, myTag)
        const mapped = list.map((row) => threadRowToChatData(row, myTag))
        const found = mapped.find((c) => c.vkTag === peerVk || c.vkId === peerVk)
        if (found) setSelectedChat(found)
        setSelectedDriver(null)
        setActiveTab("chats")
        return
      }

      setSelectedChat(null)
      setSelectedDriver(null)
    },
    [vkUser, loadChats]
  )

  const handleCityPickup = useCallback(
    async (ride: SupabaseRide): Promise<boolean> => {
      if (!vkUser) return false
      if ((ride.type || "").trim() !== "City") return false
      const driverTag = vkIdTagFromNumericId(vkUser.id)
      const ownerTag = (ride.vk_id || "").trim()
      if (!ownerTag || ownerTag === driverTag) return false

      const { data, error } = await supabase
        .from("rides")
        .update({ status: "accepted", partner_vk_id: driverTag, driver_id: driverTag })
        .eq("id", ride.id)
        .eq("type", "City")
        .eq("status", "searching")
        .is("driver_id", null)
        .select("id")

      if (error || !data?.length) {
        // fallback: if status column mismatch (legacy), try without status filter
        const second = await supabase
          .from("rides")
          .update({ status: "accepted", partner_vk_id: driverTag, driver_id: driverTag })
          .eq("id", ride.id)
          .eq("type", "City")
          .is("driver_id", null)
          .select("id")
        if (second.error || !second.data?.length) return false
      }

      await fetchRides()

      // Notify passenger via Edge Function (if vk_id present)
      const passengerVk = (ride.vk_id || "").replace(/^id/i, "")
      if (passengerVk) {
        void supabase.functions.invoke("notify-vk", {
          body: {
            vk_user_id: passengerVk,
            message: "Водитель найден! Зайдите в приложение Попути, чтобы согласовать детали.",
          },
        })
      }

      const displayName = ride.name?.trim() || "Пассажир"
      const avatarLabel = getAvatarLabel(displayName, ride.avatar)
      let intro = `Здравствуйте! Забираю вас по городу: ${ride.from_location || "—"} → ${ride.to_location || "—"}. Напишите точку подачи и остановки.`
      if (ride.comment?.trim()) {
        intro += `\n\nКомментарий к заявке: ${ride.comment.trim()}`
      }
      await handleBooking({
        name: displayName,
        avatar: avatarLabel,
        rating: ride.rating,
        trips: ride.trips,
        vkId: ride.vk_id,
        telegram: ride.telegram,
        messageIntro: intro,
      })
      return true
    },
    [vkUser, fetchRides, handleBooking]
  )

  const handlePassengerCancel = useCallback(
    async (ride: SupabaseRide): Promise<boolean> => {
      if (!vkUser) return false
      const myTag = vkIdTagFromNumericId(vkUser.id)
      if ((ride.vk_id || "").trim() !== myTag) return false
      const { data, error } = await supabase
        .from("rides")
        .update({ status: "cancelled" })
        .eq("id", ride.id)
        .in("status", ["searching", "accepted"])
        .eq("vk_id", myTag)
        .select("id")
      if (error || !data?.length) return false
      await fetchRides()
      return true
    },
    [vkUser, fetchRides]
  )

  const handleDriverStart = useCallback(
    async (ride: SupabaseRide): Promise<boolean> => {
      if (!vkUser) return false
      const driverTag = vkIdTagFromNumericId(vkUser.id)
      const { data, error } = await supabase
        .from("rides")
        .update({ status: "in_transit" })
        .eq("id", ride.id)
        .eq("driver_id", driverTag)
        .eq("status", "accepted")
        .select("id")
      if (error || !data?.length) return false
      await fetchRides()
      return true
    },
    [vkUser, fetchRides]
  )

  const handleDriverComplete = useCallback(
    async (ride: SupabaseRide): Promise<boolean> => {
      if (!vkUser) return false
      const driverTag = vkIdTagFromNumericId(vkUser.id)
      const { data, error } = await supabase
        .from("rides")
        .update({ status: "completed" })
        .eq("id", ride.id)
        .eq("driver_id", driverTag)
        .eq("status", "in_transit")
        .select("id")
      if (error || !data?.length) return false
      await fetchRides()
      return true
    },
    [vkUser, fetchRides]
  )

  const handleIntercityReserve = useCallback(
    async (ride: SupabaseRide): Promise<boolean> => {
      if (!vkUser) return false
      const myTag = vkIdTagFromNumericId(vkUser.id)
      const res = await rpcBookIntercitySeat(supabase, ride.id, myTag)
      if (!res.ok) return false
      await fetchRides()
      const displayName = ride.name?.trim() || "Пользователь"
      const avatarLabel = getAvatarLabel(displayName, ride.avatar)
      await handleBooking({
        name: displayName,
        avatar: avatarLabel,
        rating: ride.rating,
        trips: ride.trips,
        vkId: ride.vk_id,
        telegram: ride.telegram,
        messageIntro: `Здравствуйте! Я забронировал место в поездке ${ride.from_location || "—"} → ${ride.to_location || "—"}.`,
      })
      return true
    },
    [vkUser, fetchRides, handleBooking]
  )

  const appendReviewChatMessage = useCallback(
    async (targetVkTag: string, targetDisplayName: string, message: string) => {
      if (!vkUser) return
      const myTag = vkIdTagFromNumericId(vkUser.id)
      const peer = targetVkTag.trim()
      const myName = `${vkUser.first_name} ${vkUser.last_name}`.trim()
      const threadId = await ensureChatThread(supabase, myTag, peer, {
        [myTag]: myName,
        [peer]: targetDisplayName,
      })
      if (!threadId) return
      await appendThreadMessage(supabase, threadId, myTag, message)
      await loadChats()
    },
    [vkUser, loadChats]
  )

  if (activeScreen === "admin") {
    return (
      <div className="max-w-md mx-auto h-screen relative shadow-2xl overflow-hidden bg-[#EBEDF0] flex flex-col">
        <AdminPanel
          variant="embedded"
          initialAdminCity={selectedCity}
          onBackToMap={() => {
            setActiveScreen("main")
            setActiveTab("map")
          }}
          onRidesChanged={fetchRides}
        />
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto h-screen relative shadow-2xl overflow-hidden bg-[#EBEDF0] flex flex-col">
      {!introCityDone ? (
        <CityIntroSplash
          isVkReady={isVkReady}
          selectedCity={selectedCity}
          onSelectCity={(c) => {
            setSelectedCity(c)
            setIntroCityDone(true)
          }}
        />
      ) : (
        <>
          {/* Public Profile Modal */}
          {publicProfile && (
            <PublicProfileModal profile={publicProfile} onClose={() => setPublicProfile(null)} />
          )}
          {intercityManageRide && vkUser && (
            <IntercityDriverManageModal
              ride={intercityManageRide}
              driverVkTag={vkIdTagFromNumericId(vkUser.id)}
              onClose={() => setIntercityManageRide(null)}
              onUpdated={fetchRides}
            />
          )}
          {intercitySeatBookRide && vkUser && (
            <IntercitySeatBookModal
              ride={intercitySeatBookRide}
              viewerVkTag={vkIdTagFromNumericId(vkUser.id)}
              onClose={() => setIntercitySeatBookRide(null)}
              onConfirm={async () => {
                const ok = await handleIntercityReserve(intercitySeatBookRide)
                if (ok) setIntercitySeatBookRide(null)
                return ok
              }}
            />
          )}

          {/* Content Area */}
          <div className="flex-1 overflow-hidden">
            {activeTab === "map" && (
              <MapScreen
                city={selectedCity}
                isVkReady={isVkReady}
                vkUser={vkUser}
                mode={mode}
                setMode={setMode}
                selectedDriver={selectedDriver}
                setSelectedDriver={setSelectedDriver}
                showAddRequest={showAddRequest}
                setShowAddRequest={setShowAddRequest}
                onBooking={handleBooking}
                rides={rides}
                onRideAdded={fetchRides}
                userRole={isDriver ? "Driver" : "Passenger"}
                onRideDeleted={fetchRides}
                onOpenIntercityManage={setIntercityManageRide}
                onOpenIntercitySeatBook={setIntercitySeatBookRide}
                onCityPickup={handleCityPickup}
                onPassengerCancel={handlePassengerCancel}
                onDriverStart={handleDriverStart}
                onDriverComplete={handleDriverComplete}
                onRideStatusChanged={fetchRides}
                intercityAddRequestOpen={intercityAddRequestOpen}
                setIntercityAddRequestOpen={setIntercityAddRequestOpen}
              />
            )}
            {activeTab === "chats" && (
              <ChatsScreen
                selectedChat={selectedChat}
                setSelectedChat={setSelectedChat}
                chats={chats}
                chatsLoading={chatsLoading}
                vkUser={vkUser}
                onOpenProfile={setPublicProfile}
                onDeleteChat={async (threadId) => {
                  const ok = await deleteChatThread(supabase, threadId)
                  if (ok) {
                    setChats((prev) => prev.filter((c) => c.id !== threadId))
                    setSelectedChat((cur) => (cur?.id === threadId ? null : cur))
                  }
                  void loadChats()
                }}
                onMessagesChanged={loadChats}
              />
            )}
            {activeTab === "profile" && (
            <ProfileScreen
              isDriver={isDriver}
              setIsDriver={setIsDriver}
              vkUser={vkUser}
              historyCity={selectedCity}
              showAdminEntry={isAdminVkUser(vkUser?.id)}
              onOpenAdmin={() => setActiveScreen("admin")}
              appendReviewChatMessage={appendReviewChatMessage}
              onDriverPaymentVerified={() => setDriverAccessRev((v) => v + 1)}
            />
            )}
          </div>

          <nav className="safe-area-bottom flex items-center justify-around border-t border-[#D3D9DE] bg-white px-4 py-2">
            <NavButton
              icon={<Map className="h-6 w-6" />}
              label="Карта"
              isActive={activeTab === "map"}
              onClick={() => setActiveTab("map")}
            />
            <NavButton
              icon={<MessageCircle className="h-6 w-6" />}
              label="Чаты"
              isActive={activeTab === "chats"}
              onClick={() => setActiveTab("chats")}
              badge={chats.reduce((sum, c) => sum + c.unread, 0)}
            />
            <NavButton
              icon={<User className="h-6 w-6" />}
              label="Профиль"
              isActive={activeTab === "profile"}
              onClick={() => setActiveTab("profile")}
            />
          </nav>
        </>
      )}
    </div>
  )
}

function NavButton({
  icon,
  label,
  isActive,
  onClick,
  badge,
}: {
  icon: React.ReactNode
  label: string
  isActive: boolean
  onClick: () => void
  badge?: number
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 px-4 py-1 rounded-lg transition-colors relative ${
        isActive ? "text-[#2787F5]" : "text-[#818C99]"
      }`}
    >
      {icon}
      <span className="text-xs font-medium">{label}</span>
      {badge && badge > 0 && (
        <span className="absolute -top-0.5 right-2 bg-[#E64646] text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-medium">
          {badge}
        </span>
      )}
    </button>
  )
}

function MapScreen({
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
  onPassengerCancel,
  onDriverStart,
  onDriverComplete,
  onRideStatusChanged,
  intercityAddRequestOpen,
  setIntercityAddRequestOpen,
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
  onPassengerCancel: (ride: SupabaseRide) => Promise<boolean>
  onDriverStart: (ride: SupabaseRide) => Promise<boolean>
  onDriverComplete: (ride: SupabaseRide) => Promise<boolean>
  onRideStatusChanged: () => void
  intercityAddRequestOpen: boolean
  setIntercityAddRequestOpen: (v: boolean) => void
}) {
  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center justify-between bg-white px-4 py-3 shadow-sm">
        <span className="font-semibold text-[#2C2D2E]">{city}</span>

        {/* Mode Toggle */}
        <div className="flex rounded-lg bg-[#EBEDF0] p-0.5">
          <button
            type="button"
            onClick={() => setMode("city")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
              mode === "city" ? "bg-white text-[#2787F5] shadow-sm" : "text-[#818C99]"
            }`}
          >
            Город
          </button>
          <button
            type="button"
            onClick={() => setMode("intercity")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
              mode === "intercity" ? "bg-white text-[#2787F5] shadow-sm" : "text-[#818C99]"
            }`}
          >
            Межгород
          </button>
        </div>

        <div className="flex items-center gap-1 text-sm text-[#818C99]">
          <span className="h-2 w-2 rounded-full bg-[#4BB34B]" />
          <span>онлайн</span>
        </div>
      </header>

      {/* Content */}
      {mode === "city" ? (
        <CityMapView
          city={city}
          isVkReady={isVkReady}
          vkUser={vkUser}
          selectedDriver={selectedDriver}
          setSelectedDriver={setSelectedDriver}
          showAddRequest={showAddRequest}
          setShowAddRequest={setShowAddRequest}
          onBooking={onBooking}
          onCityPickup={onCityPickup}
          onPassengerCancel={onPassengerCancel}
          onDriverStart={onDriverStart}
          onDriverComplete={onDriverComplete}
          onRideStatusChanged={onRideStatusChanged}
          rides={rides}
          onRideAdded={onRideAdded}
          userRole={userRole}
          onRideDeleted={onRideDeleted}
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
  isVkReady,
  vkUser,
  selectedDriver,
  setSelectedDriver,
  showAddRequest,
  setShowAddRequest,
  onBooking,
  onCityPickup,
  onPassengerCancel,
  onDriverStart,
  onDriverComplete,
  onRideStatusChanged,
  rides,
  onRideAdded,
  userRole,
  onRideDeleted,
}: {
  city: AppCity
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
  onPassengerCancel: (ride: SupabaseRide) => Promise<boolean>
  onDriverStart: (ride: SupabaseRide) => Promise<boolean>
  onDriverComplete: (ride: SupabaseRide) => Promise<boolean>
  onRideStatusChanged: () => void
  rides: SupabaseRide[]
  onRideAdded: () => void
  userRole: string
  onRideDeleted: () => void
}) {
  const cityCoords = APP_CITY_COORDS[city]
  const [isYandexReady, setIsYandexReady] = useState(false)
  const mapInstanceRef = useRef<{ getCenter: () => number[] } | null>(null)
  const [addPinCoords, setAddPinCoords] = useState<{ lat: number; lng: number } | null>(null)
  const viewerTag = vkUser ? vkIdTagFromNumericId(vkUser.id) : null

  const shouldDisplayRide = (ride: SupabaseRide) => {
    const st = (ride.status as RideStatus | null) ?? "searching"
    const isOwner = viewerTag && ride.vk_id === viewerTag
    const isDriver = viewerTag && ride.driver_id === viewerTag
    if (st === "searching") return true
    if (st === "accepted" || st === "in_transit") return Boolean(isOwner || isDriver)
    if (st === "completed" || st === "cancelled") return Boolean(isOwner || isDriver)
    return false
  }

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

  useEffect(() => {
    let attempts = 0
    const maxAttempts = 60
    const interval = setInterval(() => {
      if (typeof window !== "undefined" && "ymaps" in window) {
        setIsYandexReady(true)
        clearInterval(interval)
        return
      }

      attempts += 1
      if (attempts >= maxAttempts) {
        clearInterval(interval)
      }
    }, 500)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex-1 relative overflow-hidden">
      {/* Yandex Map */}
      {isVkReady && isYandexReady ? (
        <YMaps query={{ apikey: "77552578-1483-4cc6-8510-a0a7f7f340aa" }}>
          <YMap
            instanceRef={(inst) => {
              mapInstanceRef.current = (inst as { getCenter: () => number[] } | null) ?? null
            }}
            defaultState={{ center: cityCoords, zoom: 14 }}
            state={{ center: cityCoords, zoom: 14 }}
            className="w-full h-full"
            options={{ suppressMapOpenBlock: true }}
          >
            {rides
              .filter((ride) => {
                if (ride.lat == null || ride.lng == null) return false
                if (!isRideWithinActiveWindow(ride.created_at, ride.type)) return false
                return shouldDisplayRide(ride)
              })
              .map((ride) => {
                const createdAt = new Date(ride.created_at).getTime()
                const now = Date.now()
                const elapsedMin = Math.floor((now - createdAt) / 60000)
                const persistent = isPersistentRideType(ride.type)
                const timer = persistent ? 180 : Math.max(0, 180 - elapsedMin)

                const rideAsDriver: DriverData = {
                  id: ride.id,
                  name: ride.name || "Пользователь",
                  avatar: getAvatarLabel(ride.name || "Пользователь", ride.avatar),
                  coords: [ride.lat, ride.lng] as [number, number],
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
                  rideStatus: (ride.status as RideStatus | null) ?? "searching",
                  rideComment: ride.comment ?? null,
                  fromLocation: ride.from_location,
                  toLocation: ride.to_location,
                  activeRide: ride,
                }

                return (
                  <DriverPlacemark
                    key={`supabase-${ride.id}`}
                    driver={rideAsDriver}
                    isPersistent={persistent}
                    createdAt={ride.created_at}
                    rideType={ride.type}
                    onClick={() => setSelectedDriver(rideAsDriver)}
                  />
                )
              })}
          </YMap>
        </YMaps>
      ) : (
        <div className="h-full w-full flex items-center justify-center bg-[#EBEDF0] text-[#818C99]">
          {isVkReady ? "Загрузка карты..." : "Инициализация VK Mini App..."}
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowAddRequest(true)}
        className="absolute bottom-6 right-4 z-10 flex h-14 w-14 items-center justify-center rounded-full bg-[#2787F5] text-white shadow-lg transition-transform active:scale-95"
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
          onPassengerCancel={onPassengerCancel}
          onDriverStart={onDriverStart}
          onDriverComplete={onDriverComplete}
          onStatusChanged={onRideStatusChanged}
          onDelete={onRideDeleted}
        />
      )}

      {/* Add Request Modal — быстрый город */}
      {showAddRequest && (
        <AddRequestModal
          variant={userRole === "Driver" ? "city" : "intercity"}
          pinCoords={addPinCoords}
          onClose={() => setShowAddRequest(false)}
          onRideAdded={onRideAdded}
          userRole={userRole}
          city={city}
          vkUser={vkUser}
        />
      )}
    </div>
  )
}

function DriverPlacemark({
  driver,
  isPersistent,
  createdAt,
  rideType,
  onClick,
}: {
  driver: DriverData
  isPersistent?: boolean
  createdAt: string
  rideType: string | null | undefined
  onClick: () => void
}) {
  const [, setTick] = useState(0)
  const avatarUrl =
    (driver.driverPhotoUrl && driver.driverPhotoUrl.startsWith("http") && driver.driverPhotoUrl) ||
    (driver.activeRide?.avatar && driver.activeRide.avatar.startsWith("http") ? driver.activeRide.avatar : null)

  const createdMs = new Date(createdAt).getTime()
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 15000)
    return () => clearInterval(interval)
  }, [])

  const elapsedMin = Math.max(0, Math.floor((Date.now() - createdMs) / 60000))
  const isEarlyPulse = elapsedMin < 10

  const progress = isPersistent ? 100 : (driver.timer / 180) * 100
  const circumference = 2 * Math.PI * 24
  const dashOffset = circumference * (1 - progress / 100)

  const ringColor = (() => {
    const percent = driver.timer / 180
    if (percent > 0.66) return "#4BB34B" // green
    if (percent > 0.33) return "#FFA000" // yellow
    return "#E64646" // red
  })()

  const coreFill = avatarUrl ? `url(#avatar-${driver.id})` : "#4BB34B"

  const label = String(driver.avatar || "?")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .slice(0, 3)

  const svgIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56">
      ${
        avatarUrl
          ? `<defs>
              <pattern id="avatar-${driver.id}" patternUnits="objectBoundingBox" width="1" height="1">
                <image href="${avatarUrl}" x="0" y="0" width="56" height="56" preserveAspectRatio="xMidYMid slice" />
              </pattern>
            </defs>`
          : ""
      }
      <circle cx="28" cy="28" r="24" fill="none" stroke="#E1E3E6" stroke-width="3"/>
      <g transform="translate(56, 0) scale(-1, 1)">
        <circle cx="28" cy="28" r="24" fill="none" stroke="${ringColor}" stroke-width="3" 
          stroke-linecap="round" stroke-dasharray="${circumference}" 
          stroke-dashoffset="${dashOffset}" 
          transform="rotate(-90 28 28)"/>
      </g>
      <circle cx="28" cy="28" r="18" fill="${coreFill}"/>
      ${
        avatarUrl
          ? ""
          : `<text x="28" y="33" text-anchor="middle" fill="white" font-size="10" font-weight="bold" font-family="Arial">${label}</text>`
      }
      ${
        isEarlyPulse
          ? `<circle cx="28" cy="28" r="26" fill="none" stroke="${ringColor}" stroke-width="2" opacity="0.35">
               <animate attributeName="r" values="24;34;24" dur="1.6s" repeatCount="indefinite" />
               <animate attributeName="opacity" values="0.35;0.08;0.35" dur="1.6s" repeatCount="indefinite" />
             </circle>`
          : ""
      }
    </svg>
  `

  return (
    <Placemark
      geometry={driver.coords}
      options={{
        iconLayout: "default#image",
        iconImageHref: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgIcon)}`,
        iconImageSize: [56, 56],
        iconImageOffset: [-28, -28],
      }}
      onClick={onClick}
    />
  )
}

function DriverBottomSheet({
  driver,
  viewerVkTag,
  userRole,
  onClose,
  onBooking,
  onCityPickup,
  onPassengerCancel,
  onDriverStart,
  onDriverComplete,
  onDelete,
  onStatusChanged,
}: {
  driver: DriverData
  viewerVkTag: string | null
  userRole: string
  onClose: () => void
  onBooking: () => void
  onCityPickup: (ride: SupabaseRide) => Promise<boolean>
  onPassengerCancel: (ride: SupabaseRide) => Promise<boolean>
  onDriverStart: (ride: SupabaseRide) => Promise<boolean>
  onDriverComplete: (ride: SupabaseRide) => Promise<boolean>
  onDelete?: () => void
  onStatusChanged?: () => void
}) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState<"take" | "start" | "complete" | "cancel" | null>(null)
  const isStaticPoint = isPersistentRideType(driver.rideType)
  const isCity = (driver.rideType || "").trim() === "City"
  const isOwner = viewerVkTag != null && driver.vkId === viewerVkTag
  const status = ((driver.rideStatus as RideStatus | null) ?? "searching").trim() as RideStatus
  const viewerIsDriver = viewerVkTag != null && driver.driverId === viewerVkTag

  const canTakeCity = isCity && userRole === "Driver" && !isOwner && canDriverTake(status) && driver.activeRide
  const canStartRide = isCity && viewerIsDriver && canDriverStart(status, true) && driver.activeRide
  const canCompleteRide = isCity && viewerIsDriver && canDriverComplete(status, true) && driver.activeRide
  const canCancelByPassenger = !isStaticPoint && isOwner && canPassengerCancel(status) && driver.activeRide

  const handleDelete = async () => {
    if (!driver.supabaseId || isDeleting || !isOwner) return
    setIsDeleting(true)

    const { error } = await supabase.from("rides").delete().eq("id", driver.supabaseId)

    setIsDeleting(false)

    if (!error && onDelete) {
      onDelete()
      onClose()
    }
  }

  const execAction = async (kind: "take" | "start" | "complete" | "cancel", fn: () => Promise<boolean>) => {
    setBusy(kind)
    setActionError(null)
    const ok = await fn()
    setBusy(null)
    if (ok) {
      onStatusChanged?.()
      onClose()
    } else {
      setActionError("Не удалось выполнить действие. Обновите карту и попробуйте снова.")
    }
  }

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 rounded-t-2xl bg-white shadow-2xl animate-in slide-in-from-bottom duration-300">
      <div className="p-4">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#D3D9DE]" />

        <div className="mb-4 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#2787F5] text-xl font-bold text-white">
            {driver.avatar}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-[#2C2D2E]">{driver.name}</h3>
              {isCity && (
                <span className="rounded-full bg-[#F2F3F5] px-2 py-1 text-xs font-semibold text-[#2C2D2E]">
                  {statusLabel[status]}
                </span>
              )}
            </div>
            {isCity && (driver.fromLocation || driver.toLocation) && (
              <p className="mt-1 text-sm text-[#2C2D2E]">
                <span className="text-[#818C99]">Маршрут:</span>{" "}
                {(driver.fromLocation || "—") + " → " + (driver.toLocation || "—")}
              </p>
            )}
            {isCity && driver.rideComment ? (
              <p className="mt-1 line-clamp-3 text-sm text-[#818C99]">
                <span className="font-medium text-[#2C2D2E]">Комментарий:</span> {driver.rideComment}
              </p>
            ) : null}
            {!isCity && (
              <div className="mt-1 flex items-center gap-2 text-sm text-[#818C99]">
                <Car className="h-4 w-4" />
                <span>{driver.car}</span>
              </div>
            )}
            <div className="mt-1 flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <span
                  key={star}
                  className={`text-sm ${star <= Math.round(driver.rating) ? "text-[#FFC107]" : "text-[#E1E3E6]"}`}
                >
                  ★
                </span>
              ))}
              <span className="ml-1 text-sm text-[#818C99]">{driver.rating}</span>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-2xl font-bold text-[#2787F5]">{driver.price > 0 ? `${driver.price} ₽` : "—"}</div>
            <div className="mt-0.5 flex items-center justify-end gap-1 text-sm text-[#818C99]">
              <Clock className="h-3 w-3" />
              <span>{isStaticPoint ? "Постоянная точка" : `${driver.timer} мин`}</span>
            </div>
          </div>
        </div>

        {actionError && (
          <p className="mb-3 rounded-xl bg-[#FAEBEB] px-3 py-2 text-center text-sm text-[#E64646]">{actionError}</p>
        )}

        <div className="space-y-2">
          {canTakeCity && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void execAction("take", () => onCityPickup(driver.activeRide!))}
              className="w-full rounded-xl bg-[#2787F5] py-4 text-base font-semibold text-white transition-colors active:bg-[#1F6AD8] disabled:opacity-50"
            >
              {busy === "take" ? "Берём заявку…" : "Взять заказ"}
            </button>
          )}

          {canStartRide && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void execAction("start", () => onDriverStart(driver.activeRide!))}
              className="w-full rounded-xl bg-[#2787F5] py-3 text-base font-semibold text-white transition-colors active:bg-[#1F6AD8] disabled:opacity-50"
            >
              {busy === "start" ? "Стартуем…" : "Начать поездку"}
            </button>
          )}

          {canCompleteRide && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void execAction("complete", () => onDriverComplete(driver.activeRide!))}
              className="w-full rounded-xl bg-[#4BB34B] py-3 text-base font-semibold text-white transition-colors active:bg-[#429C41] disabled:opacity-50"
            >
              {busy === "complete" ? "Завершаем…" : "Завершить поездку"}
            </button>
          )}

          {canCancelByPassenger && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void execAction("cancel", () => onPassengerCancel(driver.activeRide!))}
              className="w-full rounded-xl bg-[#FAEBEB] py-3 text-base font-semibold text-[#E64646] transition-colors active:bg-[#F5D6D6] disabled:opacity-50"
            >
              {busy === "cancel" ? "Отмена…" : "Отменить заказ"}
            </button>
          )}

          {!canTakeCity && !canStartRide && !canCompleteRide && !canCancelByPassenger && (
            <div className="rounded-xl bg-[#F7F8FA] px-3 py-2 text-center text-sm text-[#818C99]">
              {isCity ? statusLabel[status] : "Действия недоступны"}
            </div>
          )}

          {!isStaticPoint && !isCity && !isOwner && (
            <button
              type="button"
              onClick={onBooking}
              className="w-full rounded-xl bg-[#2787F5] py-3 font-medium text-white transition-colors active:bg-[#1F6AD8]"
            >
              Забронировать
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-[#EBEDF0] py-3 font-medium text-[#2C2D2E] transition-colors active:bg-[#D3D9DE]"
          >
            Закрыть
          </button>
        </div>

        {driver.supabaseId && !isStaticPoint && isOwner && (
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={isDeleting}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#FAEBEB] py-3 font-medium text-[#E64646] transition-colors active:bg-[#F5D6D6] disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            {isDeleting ? "Удаление..." : "Удалить мою заявку"}
          </button>
        )}
      </div>
    </div>
  )
}

function AddRequestModal({
  variant,
  pinCoords,
  onClose,
  onRideAdded,
  userRole,
  city,
  vkUser,
}: {
  variant: "city" | "intercity"
  pinCoords?: { lat: number; lng: number } | null
  onClose: () => void
  onRideAdded: () => void
  userRole: string
  city: AppCity
  vkUser: VkUserProfile | null
}) {
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

  const handleSubmitCity = async () => {
    if (!whereStanding.trim() || !toCity.trim() || isSubmitting) return
    const [fallbackLat, fallbackLng] = APP_CITY_COORDS[city]
    const lat = pinCoords?.lat ?? fallbackLat
    const lng = pinCoords?.lng ?? fallbackLng

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

  const handleSubmitIntercity = async () => {
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
      type: userRole,
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
        type: userRole,
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

  if (variant === "city") {
    return (
      <div className="absolute inset-0 z-30 flex items-end bg-black/50" onClick={onClose}>
        <div
          className="w-full animate-in rounded-t-2xl bg-white duration-300 slide-in-from-bottom"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-4">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#D3D9DE]" />

            <h2 className="mb-1 text-xl font-bold text-[#2C2D2E]">По городу</h2>
            <p className="mb-4 text-sm text-[#818C99]">
              Точка на карте — центр экрана карты при открытии формы (передвиньте карту и откройте снова, чтобы
              сменить пин).
            </p>

            <div className="space-y-3">
              <input
                type="text"
                placeholder="Где я стою (ориентир)"
                value={whereStanding}
                onChange={(e) => setWhereStanding(e.target.value)}
                className="w-full rounded-xl bg-[#F2F3F5] px-4 py-3 text-[#2C2D2E] placeholder-[#818C99] outline-none focus:ring-2 focus:ring-[#2787F5]"
              />
              <input
                type="text"
                placeholder="Куда еду по городу"
                value={toCity}
                onChange={(e) => setToCity(e.target.value)}
                className="w-full rounded-xl bg-[#F2F3F5] px-4 py-3 text-[#2C2D2E] placeholder-[#818C99] outline-none focus:ring-2 focus:ring-[#2787F5]"
              />
            <textarea
              placeholder="Комментарий (необязательно): детали, время, что везёте…"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-xl bg-[#F2F3F5] px-4 py-3 text-[#2C2D2E] placeholder-[#818C99] outline-none focus:ring-2 focus:ring-[#2787F5]"
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
              className="mt-4 w-full rounded-xl bg-[#2787F5] py-3.5 font-semibold text-white transition-colors active:bg-[#1F6AD8] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "Публикация…" : "Опубликовать"}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="absolute inset-0 z-30 flex items-end bg-black/50" onClick={onClose}>
      <div
        className="w-full animate-in rounded-t-2xl bg-white duration-300 slide-in-from-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#D3D9DE]" />

          <h2 className="mb-4 text-xl font-bold text-[#2C2D2E]">Новая заявка</h2>

          <div className="space-y-3">
            <input
              type="text"
              placeholder="Адрес отправления (напр. Ленина 42)"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-xl bg-[#F2F3F5] px-4 py-3 text-[#2C2D2E] placeholder-[#818C99] outline-none focus:ring-2 focus:ring-[#2787F5]"
            />
            <input
              type="text"
              placeholder="Куда"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-xl bg-[#F2F3F5] px-4 py-3 text-[#2C2D2E] placeholder-[#818C99] outline-none focus:ring-2 focus:ring-[#2787F5]"
            />
            <input
              type="number"
              placeholder="Бюджет (₽)"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full rounded-xl bg-[#F2F3F5] px-4 py-3 text-[#2C2D2E] placeholder-[#818C99] outline-none focus:ring-2 focus:ring-[#2787F5]"
            />
            <textarea
              placeholder="Комментарий (необязательно)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              className="w-full resize-none rounded-xl bg-[#F2F3F5] px-4 py-3 text-[#2C2D2E] placeholder-[#818C99] outline-none focus:ring-2 focus:ring-[#2787F5]"
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
            className="mt-4 w-full rounded-xl bg-[#2787F5] py-3.5 font-semibold text-white transition-colors active:bg-[#1F6AD8] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Получение координат..." : "Опубликовать"}
          </button>
        </div>
      </div>
    </div>
  )
}

function IntercityFeed({
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
    <div className="relative flex-1 overflow-hidden">
      <div className="h-full space-y-3 overflow-y-auto p-4">
        {allRides.map((ride) => (
          <RideCard
            key={ride.supabaseId != null ? `db-${ride.supabaseId}` : `mock-${ride.id}`}
            ride={ride}
            vkUser={vkUser}
            onBooking={onBooking}
            onRideDeleted={onRideDeleted}
            onOpenDriverManage={onOpenDriverManage}
            onOpenSeatBook={onOpenSeatBook}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={() => setIntercityAddRequestOpen(true)}
        className="absolute bottom-6 right-4 z-10 flex h-14 w-14 items-center justify-center rounded-full bg-[#2787F5] text-white shadow-lg transition-transform active:scale-95"
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

  return (
    <div className={`rounded-2xl bg-white p-4 shadow-sm ${cardRing}`}>
      <div className="flex items-start gap-3">
        {ride.driverPhotoUrl ? (
          <img
            src={ride.driverPhotoUrl}
            alt=""
            className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-[#2787F5]/20"
          />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#2787F5] text-sm font-semibold text-white">
            {ride.avatar}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <h3 className="font-semibold text-[#2C2D2E]">{ride.driver}</h3>
                {ride.isLegendDriver && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                    <Crown className="h-3 w-3" />
                    Легенда
                  </span>
                )}
              </div>
              <div className="mt-1 text-[#2C2D2E]">
                <span>{ride.from}</span>
                <span className="mx-2 text-[#818C99]">→</span>
                <span>{ride.to}</span>
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
              </div>
            </div>

            <div className="shrink-0 text-right">
              <div className="text-xl font-bold text-[#2787F5]">{ride.price} ₽</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        {!isBoosted && (
          <button
            type="button"
            onClick={() => setIsBoosted(true)}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-[#FFF8E1] px-4 py-2 text-sm font-medium text-[#FFA000] transition-colors active:bg-[#FFECB3]"
          >
            <Zap className="h-4 w-4" />
            Boost
          </button>
        )}
        <button
          type="button"
          onClick={() => (ride.rawRide ? openSeatModal() : handleMockBook())}
          disabled={bookDisabled}
          className="flex-1 rounded-xl bg-[#2787F5] py-2 font-medium text-white transition-colors active:bg-[#1F6AD8] disabled:cursor-not-allowed disabled:opacity-45"
        >
          Забронировать место
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

function ChatsScreen({
  selectedChat,
  setSelectedChat,
  chats,
  chatsLoading,
  vkUser,
  onOpenProfile,
  onDeleteChat,
  onMessagesChanged,
}: {
  selectedChat: ChatData | null
  setSelectedChat: (chat: ChatData | null) => void
  chats: ChatData[]
  chatsLoading: boolean
  vkUser: VkUserProfile | null
  onOpenProfile: (profile: ChatData) => void
  onDeleteChat: (threadId: string) => void | Promise<void>
  onMessagesChanged: () => void | Promise<void>
}) {
  if (selectedChat && vkUser) {
    return (
      <ChatView
        chat={selectedChat}
        myVkTag={vkIdTagFromNumericId(vkUser.id)}
        onBack={() => setSelectedChat(null)}
        onOpenProfile={() => onOpenProfile(selectedChat)}
        onMessagesChanged={onMessagesChanged}
      />
    )
  }

  if (selectedChat && !vkUser) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-white p-6 text-center">
        <p className="text-sm text-[#818C99]">Войдите через VK, чтобы пользоваться чатами.</p>
        <button type="button" className="mt-4 font-medium text-[#2787F5]" onClick={() => setSelectedChat(null)}>
          Назад к списку
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-white">
      <header className="border-b border-[#E1E3E6] bg-white px-4 py-3">
        <h1 className="text-xl font-bold text-[#2C2D2E]">Чаты</h1>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {chatsLoading && (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-[#818C99]">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-[#2787F5] border-t-transparent" />
            <span className="text-sm">Загрузка чатов…</span>
          </div>
        )}
        {!chatsLoading && !vkUser && (
          <p className="px-4 py-12 text-center text-sm text-[#818C99]">Войдите через VK Mini App, чтобы видеть свои диалоги.</p>
        )}
        {!chatsLoading && vkUser && chats.length === 0 && (
          <p className="px-4 py-12 text-center text-sm text-[#818C99]">
            Пока нет диалогов. Они появятся после бронирования поездки или оценки попутчика.
          </p>
        )}
        {!chatsLoading &&
          vkUser &&
          chats.map((chat) => (
            <div key={chat.id} className="flex items-stretch border-b border-[#E1E3E6] last:border-b-0">
              <button
                type="button"
                onClick={() => setSelectedChat(chat)}
                className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#F7F8FA] active:bg-[#EBEDF0]"
              >
                <div
                  className="relative shrink-0 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation()
                    onOpenProfile(chat)
                  }}
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#2787F5] text-base font-semibold text-white">
                    {chat.avatar}
                  </div>
                  {chat.unread > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#E64646] text-xs font-medium text-white">
                      {chat.unread}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-[#2C2D2E]">{chat.name}</h3>
                    <span className="shrink-0 text-xs text-[#818C99]">{chat.time}</span>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-[#818C99]">{chat.lastMessage}</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => void onDeleteChat(chat.id)}
                className="flex shrink-0 items-center justify-center px-3 text-[#818C99] transition-colors hover:bg-[#FAEBEB] hover:text-[#E64646] active:bg-[#F5D6D6]"
                aria-label="Удалить чат"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          ))}
      </div>
    </div>
  )
}

function ChatView({
  chat,
  myVkTag,
  onBack,
  onOpenProfile,
  onMessagesChanged,
}: {
  chat: ChatData
  myVkTag: string
  onBack: () => void
  onOpenProfile: () => void
  onMessagesChanged: () => void | Promise<void>
}) {
  const [message, setMessage] = useState("")
  const [messages, setMessages] = useState<{ id: number; text: string; isMe: boolean }[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  const threadId = chat.threadId

  const reloadMessages = useCallback(async () => {
    setLoading(true)
    const rows = await fetchThreadMessages(supabase, threadId)
    setMessages(
      rows.map((m) => ({
        id: m.id,
        text: m.body,
        isMe: m.sender_vk_id.trim() === myVkTag,
      }))
    )
    setLoading(false)
  }, [threadId, myVkTag])

  useEffect(() => {
    void reloadMessages()
  }, [reloadMessages])

  const handleSend = async () => {
    const t = message.trim()
    if (!t || sending) return
    setSending(true)
    const ok = await appendThreadMessage(supabase, threadId, myVkTag, t)
    setSending(false)
    if (!ok) return
    setMessage("")
    await reloadMessages()
    void onMessagesChanged()
  }

  return (
    <div className="flex h-full flex-col bg-[#EBEDF0]">
      <header className="flex items-center gap-3 bg-white px-4 py-3 shadow-sm">
        <button type="button" onClick={onBack} className="-ml-1 p-1 text-[#2787F5]">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <button type="button" onClick={onOpenProfile} className="flex flex-1 items-center gap-3 text-left">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2787F5] font-semibold text-white">
            {chat.avatar}
          </div>
          <div>
            <h2 className="font-semibold text-[#2C2D2E]">{chat.name}</h2>
            <p className="text-xs text-[#818C99]">Диалог в облаке</p>
          </div>
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
        {loading && (
          <p className="py-8 text-center text-sm text-[#818C99]">Загрузка сообщений…</p>
        )}
        {!loading && messages.length === 0 && (
          <p className="py-8 text-center text-sm text-[#818C99]">Напишите первое сообщение.</p>
        )}
        {!loading &&
          messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.isMe ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                  msg.isMe ? "rounded-br-md bg-[#2787F5] text-white" : "rounded-bl-md bg-white text-[#2C2D2E]"
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}
      </div>

      <div className="border-t border-[#E1E3E6] bg-white p-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Сообщение..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSend()
            }}
            disabled={sending}
            className="flex-1 rounded-full bg-[#F2F3F5] px-4 py-2.5 text-[#2C2D2E] placeholder-[#818C99] outline-none focus:ring-2 focus:ring-[#2787F5] disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={sending || !message.trim()}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2787F5] text-white transition-colors active:bg-[#1F6AD8] disabled:opacity-50"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  )
}

function PublicProfileModal({ profile, onClose }: { profile: ChatData; onClose: () => void }) {
  return (
    <div className="absolute inset-0 bg-black/50 flex items-end z-50" onClick={onClose}>
      <div
        className="bg-white rounded-t-2xl w-full max-h-[80%] overflow-y-auto animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4">
          {/* Handle */}
          <div className="w-10 h-1 bg-[#D3D9DE] rounded-full mx-auto mb-4" />

          {/* Profile Header */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-20 h-20 bg-[#2787F5] rounded-full flex items-center justify-center text-white font-bold text-2xl">
              {profile.avatar}
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#2C2D2E]">{profile.name}</h2>
              <div className="flex items-center gap-1 mt-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span key={star} className={`text-lg ${star <= Math.round(profile.rating) ? "text-[#FFC107]" : "text-[#E1E3E6]"}`}>
                    ★
                  </span>
                ))}
                <span className="text-[#818C99] ml-1">{profile.rating}</span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="bg-[#F7F8FA] rounded-2xl p-4 mb-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-[#2787F5]">{profile.trips}</div>
                <div className="text-sm text-[#818C99]">поездок</div>
              </div>
              <div className="bg-white rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-[#4BB34B]">{profile.rating}</div>
                <div className="text-sm text-[#818C99]">рейтинг</div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-[#F7F8FA] p-4 text-center text-sm leading-relaxed text-[#818C99]">
            Связаться можно только внутри приложения: откройте вкладку «Чаты» внизу экрана и выберите диалог с этим пользователем.
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="w-full mt-4 py-3 rounded-xl bg-[#EBEDF0] text-[#2C2D2E] font-medium active:bg-[#D3D9DE] transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  )
}

function RideHistoryModal({
  open,
  onClose,
  vkUser,
  historyCity,
  appendReviewChatMessage,
  onProfileStatsReload,
}: {
  open: boolean
  onClose: () => void
  vkUser: VkUserProfile | null
  historyCity: AppCity
  appendReviewChatMessage: (targetVkTag: string, targetDisplayName: string, message: string) => void | Promise<void>
  onProfileStatsReload: () => void
}) {
  const [rows, setRows] = useState<SupabaseRide[]>([])
  const [reviewedRideIds, setReviewedRideIds] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewRide, setReviewRide] = useState<SupabaseRide | null>(null)

  const reload = useCallback(async () => {
    if (!vkUser) {
      setRows([])
      setReviewedRideIds(new Set())
      setLoading(false)
      setError("Войдите через VK Mini App, чтобы увидеть свои заявки.")
      return
    }
    const tag = vkIdTagFromNumericId(vkUser.id)
    setLoading(true)
    setError(null)

    const revRes = await supabase.from("reviews").select("ride_id").eq("reviewer_vk_id", tag)
    if (!revRes.error && revRes.data) {
      setReviewedRideIds(new Set(revRes.data.map((r: { ride_id: number }) => r.ride_id)))
    } else {
      setReviewedRideIds(new Set())
    }

    const ridesRes = await supabase
      .from("rides")
      .select("*")
      .eq("city", historyCity)
      .or(`vk_id.eq.${tag},partner_vk_id.eq.${tag}`)
      .order("created_at", { ascending: false })

    if (ridesRes.error) {
      const fb = await supabase
        .from("rides")
        .select("*")
        .eq("vk_id", tag)
        .eq("city", historyCity)
        .order("created_at", { ascending: false })
      setLoading(false)
      if (fb.error) {
        setError("Не удалось загрузить заявки.")
        setRows([])
        return
      }
      setRows((fb.data as SupabaseRide[]) ?? [])
      setError(null)
      return
    }

    setLoading(false)
    setRows((ridesRes.data as SupabaseRide[]) ?? [])
    setError(null)
  }, [vkUser, historyCity])

  useEffect(() => {
    if (!open) return
    void reload()
  }, [open, reload])

  if (!open) return null

  const myTag = vkUser ? vkIdTagFromNumericId(vkUser.id) : ""

  return (
    <>
      <div
        className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50"
        onClick={onClose}
        role="presentation"
      >
      <div
        className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="ride-history-title"
      >
        <div className="shrink-0 border-b border-[#E1E3E6] px-4 py-3">
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-[#D3D9DE]" />
          <div className="flex items-center justify-between gap-2">
            <h2 id="ride-history-title" className="text-lg font-bold text-[#2C2D2E]">
              История заявок
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-2 py-1 text-sm font-medium text-[#2787F5] hover:bg-[#EBEDF0]"
            >
              Закрыть
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {loading && <p className="text-center text-sm text-[#818C99]">Загрузка…</p>}
          {error && !loading && <p className="text-center text-sm text-[#E64646]">{error}</p>}
          {!loading && !error && rows.length === 0 && (
            <p className="text-center text-sm text-[#818C99]">Пока нет сохранённых заявок с этим профилем VK.</p>
          )}
          {!loading && !error && rows.length > 0 && (
            <ul className="space-y-3">
              {rows.map((r) => {
                const from = r.from_location || "—"
                const to = r.to_location || "—"
                const dateStr = new Date(r.created_at).toLocaleString("ru-RU", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
                const targetVk = myTag ? resolveReviewTargetVk(r, myTag) : null
                const canReview = Boolean(targetVk && !reviewedRideIds.has(r.id))
                return (
                  <li
                    key={r.id}
                    className="rounded-xl border border-[#E1E3E6] bg-[#F7F8FA] p-3.5 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-[#2C2D2E]">
                          {from}
                          <span className="mx-1.5 text-[#818C99]">→</span>
                          {to}
                        </p>
                        <p className="mt-1 text-xs text-[#818C99]">{dateStr}</p>
                      </div>
                      <span className="shrink-0 text-lg font-bold text-[#2787F5]">
                        {r.price != null ? `${r.price} ₽` : "—"}
                      </span>
                    </div>
                    <p className="mt-2 text-xs font-medium text-[#818C99]">
                      Тип: <span className="text-[#2C2D2E]">{rideTypeLabelRu(r.type)}</span>
                    </p>
                    {canReview && targetVk && (
                      <button
                        type="button"
                        onClick={() => {
                          setReviewRide(r)
                          setReviewOpen(true)
                        }}
                        className="mt-3 w-full rounded-xl bg-white py-2.5 text-sm font-semibold text-[#2787F5] shadow-sm ring-1 ring-[#E1E3E6] transition-colors hover:bg-[#EBEDF0]"
                      >
                        Завершить поездку / Оценить попутчика
                      </button>
                    )}
                    {!canReview && targetVk && reviewedRideIds.has(r.id) && (
                      <p className="mt-2 text-center text-xs text-[#818C99]">Оценка уже оставлена</p>
                    )}
                    {!targetVk && myTag && (
                      <p className="mt-2 text-xs text-[#818C99]">
                        Чтобы оценить попутчика, в заявке должен быть указан второй участник (поле partner_vk_id в базе).
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
      {reviewRide && vkUser && resolveReviewTargetVk(reviewRide, myTag) && (
        <ReviewRideDialog
          open={reviewOpen}
          onOpenChange={(v) => {
            setReviewOpen(v)
            if (!v) setReviewRide(null)
          }}
          rideId={reviewRide.id}
          reviewerVkId={myTag}
          targetVkId={resolveReviewTargetVk(reviewRide, myTag)!}
          targetDisplayName={targetDisplayLabelForReview(reviewRide, myTag)}
          onSuccess={(msg) => {
            const tVk = resolveReviewTargetVk(reviewRide, myTag)
            if (!tVk) return
            void (async () => {
              await appendReviewChatMessage(tVk, targetDisplayLabelForReview(reviewRide, myTag), msg)
              onProfileStatsReload()
              setReviewedRideIds((prev) => new Set(prev).add(reviewRide.id))
              void reload()
            })()
          }}
        />
      )}
    </>
  )
}

function ProfileScreen({
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
  const confirmRoleSwitch = useCallback((target: "driver" | "passenger") => {
    if (typeof window === "undefined") return true
    const label = target === "driver" ? "Водитель" : "Пассажир"
    return window.confirm(`Переключить роль на «${label}»?`)
  }, [])
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
    <div className="h-full bg-white overflow-y-auto">
      <RideHistoryModal
        open={rideHistoryOpen}
        onClose={() => setRideHistoryOpen(false)}
        vkUser={vkUser}
        historyCity={historyCity}
        appendReviewChatMessage={appendReviewChatMessage}
        onProfileStatsReload={loadProfileStats}
      />
      {/* Header */}
      <header className="bg-[#2787F5] px-4 pt-8 pb-6">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          {vkUser?.photo_200 ? (
            <img
              src={vkUser.photo_200}
              alt={fullName}
              className="w-20 h-20 rounded-full object-cover shadow-lg"
            />
          ) : (
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-[#2787F5] font-bold text-2xl shadow-lg">
              {avatarFallback}
            </div>
          )}
          <div className="text-white">
            <h1 className="text-2xl font-bold">{fullName}</h1>
            <a
              href={profileLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/80 underline"
            >
              {profileLink}
            </a>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Role Toggle — segmented control */}
        <div className="bg-[#F7F8FA] rounded-2xl p-4">
          <div className="flex flex-col gap-3">
            <div>
              <h3 className="font-semibold text-[#2C2D2E]">Роль</h3>
              <p className="text-sm text-[#818C99]">
                {isDriver ? "Вы принимаете заказы" : "Вы ищете поездки"}
              </p>
            </div>
            <div
              className="flex w-full flex-row gap-0 rounded-full bg-gray-100 p-1"
              role="tablist"
              aria-label="Роль в приложении"
            >
              <button
                type="button"
                role="tab"
                aria-selected={!isDriver}
                onClick={() => {
                  if (!confirmRoleSwitch("passenger")) return
                  setIsDriver(false)
                }}
                className={`flex-1 rounded-full py-2.5 px-4 text-center text-sm font-semibold whitespace-nowrap transition-all duration-200 ease-out ${
                  !isDriver
                    ? "bg-white font-bold text-gray-900 shadow-md"
                    : "bg-transparent font-semibold text-gray-600 shadow-none"
                }`}
              >
                Пассажир
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={isDriver}
                onClick={async () => {
                  if (!confirmRoleSwitch("driver")) return
                  if (hasDriverAccess()) {
                    setIsDriver(true)
                    return
                  }
                  if (!vkUser) return
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
                className={`flex-1 rounded-full py-2.5 px-4 text-center text-sm font-semibold whitespace-nowrap transition-all duration-200 ease-out ${
                  isDriver
                    ? "bg-white font-bold text-gray-900 shadow-md"
                    : "bg-transparent font-semibold text-gray-600 shadow-none"
                }`}
              >
                Водитель
              </button>
            </div>
          </div>
        </div>

        {/* Stats: уровень, рейтинг, поездки */}
        <div className="rounded-2xl bg-[#F7F8FA] p-4">
          <h3 className="mb-3 font-semibold text-[#2C2D2E]">Статистика</h3>
          <div className="mb-4 rounded-xl bg-white px-4 py-3 text-center shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-[#818C99]">Уровень</p>
            <p className="mt-1 text-lg font-bold text-[#2787F5]">
              {calculateUserLevel(profileStats.totalRides, profileStats.averageRating)}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-white p-4 text-center shadow-sm">
              <p className="text-xs font-medium text-[#818C99]">Рейтинг (⭐)</p>
              <div className="mt-1 flex items-center justify-center gap-0.5 text-[#FFC107]">
                {[1, 2, 3, 4, 5].map((s) => (
                  <span key={s} className="text-lg">
                    {s <= Math.round(profileStats.averageRating) ? "★" : "☆"}
                  </span>
                ))}
              </div>
              <p className="mt-1 text-2xl font-bold text-[#2C2D2E]">{profileStats.averageRating.toFixed(1)}</p>
              <p className="text-xs text-[#818C99]">Отзывов: {profileStats.reviewsReceived}</p>
            </div>
            <div className="rounded-xl bg-white p-4 text-center shadow-sm">
              <p className="text-xs font-medium text-[#818C99]">Поездок</p>
              <p className="mt-2 text-3xl font-bold text-[#2787F5]">{profileStats.totalRides}</p>
            </div>
          </div>
        </div>

        {/* Menu */}
        <div className="overflow-hidden rounded-2xl bg-[#F7F8FA]">
          <button
            type="button"
            onClick={() => setRideHistoryOpen(true)}
            className="flex w-full items-center gap-3 border-b border-[#E1E3E6] px-4 py-3.5 text-left transition-colors hover:bg-[#EBEDF0] active:bg-[#E1E3E6]"
          >
            <span className="text-[#2787F5]">
              <Clock className="h-5 w-5" />
            </span>
            <span className="font-medium text-[#2C2D2E]">История заявок</span>
            <ChevronLeft className="ml-auto h-5 w-5 shrink-0 rotate-180 text-[#818C99]" />
          </button>
          {showAdminEntry && (
            <button
              type="button"
              onClick={onOpenAdmin}
              className="flex w-full items-center gap-3 border-t border-[#E1E3E6] px-4 py-3.5 text-left transition-colors hover:bg-[#EBEDF0] active:bg-[#E1E3E6]"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <span className="shrink-0 text-[#2787F5]">
                <Shield className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-[#2C2D2E]">Админ-панель</span>
                <span className="text-sm text-[#818C99]">Для управления приложением</span>
              </span>
              <ChevronLeft className="h-5 w-5 shrink-0 rotate-180 text-[#818C99]" />
            </button>
          )}
        </div>
      </div>

      {driverPayOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onClick={() => {
            setDriverPayOpen(false)
            setDriverChecking(false)
          }}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
            role="dialog"
            aria-labelledby="driver-pay-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="driver-pay-title" className="text-lg font-bold text-[#2C2D2E]">
              Доступ водителя — {DRIVER_ACCESS_PRICE_LABEL}
            </h2>
            {driverPayError && (
              <p className="mt-2 rounded-lg bg-[#FAEBEB] px-3 py-2 text-sm text-[#E64646]">{driverPayError}</p>
            )}
            {!driverPayError && (
              <p className="mt-2 text-sm text-[#818C99]">
                Оплатите на странице CloudTips. После оплаты нажмите «Проверить оплату» — мы сверим данные с
                сервером CloudTips.
              </p>
            )}
            {driverCheckHint && (
              <p className="mt-2 rounded-lg bg-[#FFF8E1] px-3 py-2 text-sm text-[#2C2D2E]">{driverCheckHint}</p>
            )}
            {driverPayUrl ? (
              <button
                type="button"
                onClick={() => void openPaymentUrl(driverPayUrl)}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#2787F5] py-3 text-sm font-semibold text-white"
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
                className="w-full rounded-xl bg-[#4BB34B] py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {driverChecking ? "Проверка…" : "Проверить оплату"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDriverPayOpen(false)
                  setDriverChecking(false)
                }}
                className="w-full rounded-xl bg-[#EBEDF0] py-3 text-sm font-semibold text-[#2C2D2E]"
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
