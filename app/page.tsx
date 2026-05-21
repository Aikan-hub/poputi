"use client"

import { useEffect, useState, useCallback } from "react"
import bridge from "@vkontakte/vk-bridge"
import { Map, MessageCircle, Shield, User } from "lucide-react"
import { AdminPanel } from "@/components/admin-panel"
import { CityIntroSplash } from "@/components/city-intro-splash"
import { IntercityDriverManageModal } from "@/components/intercity-driver-manage-modal"
import { IntercitySeatBookModal } from "@/components/intercity-seat-book-modal"
import { isAdminVkUser } from "@/lib/admin-config"
import {
  appendThreadMessage,
  deleteChatThread,
  ensureChatThread,
  fetchThreadsForUser,
} from "@/lib/chats-db"
import {
  hasDriverAccess,
  syncDriverAccessFromServer,
} from "@/lib/driver-payment"
import { rpcBookIntercitySeat } from "@/lib/intercity-booking"
import { supabase } from "@/lib/supabase-client"
import { DEFAULT_APP_CITY, type AppCity } from "@/lib/cities"
import type {
  ChatData,
  DriverData,
  PeerProfile,
  SupabaseRide,
  Tab,
  Mode,
  VkUserProfile,
} from "./types"
import {
  VK_MSGS_ALLOWED_KEY,
  VK_GROUP_ID,
  ROLE_KEY,
  getAvatarLabel,
  threadRowToChatData,
  vkIdTagFromNumericId,
} from "./helpers"
import { NavButton } from "./nav-button"
import { MapScreen } from "./map-screen"
import { ChatsScreen, PublicProfileModal } from "./chats-screen"
import { ProfileScreen } from "./profile-screen"

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
  const [ridesError, setRidesError] = useState<string | null>(null)
  const [vkMsgsAllowed, setVkMsgsAllowed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false
    return window.localStorage.getItem(VK_MSGS_ALLOWED_KEY) === "1"
  })
  const showAdminEntry = true

  useEffect(() => {
    if (typeof window === "undefined") return
    const stored = window.localStorage.getItem(ROLE_KEY)
    const access = hasDriverAccess()
    if (!stored) {
      window.localStorage.setItem(ROLE_KEY, "passenger")
      setIsDriverState(false)
      return
    }
    if (stored === "driver" && !access) {
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
    const onReady = () => setIsVkReady(true)
    const onFailed = () => setIsVkReady(true)
    window.addEventListener("vk-bridge-ready", onReady)
    window.addEventListener("vk-bridge-failed", onFailed)
    const fallback = window.setTimeout(() => setIsVkReady(true), 1500)
    return () => {
      window.removeEventListener("vk-bridge-ready", onReady)
      window.removeEventListener("vk-bridge-failed", onFailed)
      window.clearTimeout(fallback)
    }
  }, [])

  useEffect(() => {
    if (!isVkReady || vkMsgsAllowed || !vkUser) return
    if (!VK_GROUP_ID) return
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

  const fetchRides = useCallback(async () => {
    const { data, error } = await supabase
      .from("rides")
      .select("*")
      .order("created_at", { ascending: false })
    if (error) {
      console.warn("fetchRides error", error)
      setRidesError(error.message || "fetchRides error")
      return
    }
    setRidesError(null)
    setRides(data ?? [])
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
    const peerTags = [...new Set(rows.map((r) => (r.vk_lower === tag ? r.vk_higher : r.vk_lower)))]
    const peerProfiles: Record<string, PeerProfile> = {}
    if (peerTags.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("vk_id, avatar_url, display_name, total_rides, average_rating")
        .in("vk_id", peerTags)
      for (const p of profs || []) {
        peerProfiles[p.vk_id as string] = p as PeerProfile
      }
    }
    setChats(rows.map((row) => threadRowToChatData(row, tag, peerProfiles)))
    setChatsLoading(false)
  }, [vkUser])

  useEffect(() => {
    if (!isVkReady || !introCityDone) return
    void fetchRides()
  }, [fetchRides, isVkReady, introCityDone])

  useEffect(() => {
    if (!isVkReady || !introCityDone) return
    const channel = supabase
      .channel(`rides_city_${selectedCity}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rides", filter: `city=eq.${selectedCity}` },
        () => { void fetchRides() }
      )
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [isVkReady, introCityDone, selectedCity, fetchRides])

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
    return () => { void supabase.removeChannel(channel) }
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
        const tag = vkIdTagFromNumericId(user.id)
        const displayName = `${user.first_name} ${user.last_name}`.trim()
        void supabase.from("profiles").upsert(
          {
            vk_id: tag,
            avatar_url: user.photo_200 || null,
            display_name: displayName || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "vk_id", ignoreDuplicates: false }
        )
      })
      .catch((error) => {
        console.error("VKWebAppGetUserInfo failed", error)
      })
    return () => { isMounted = false }
  }, [isVkReady])

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
        const peerTags2 = [...new Set(list.map((r) => (r.vk_lower === myTag ? r.vk_higher : r.vk_lower)))]
        const pp: Record<string, PeerProfile> = {}
        if (peerTags2.length > 0) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("vk_id, avatar_url, display_name, total_rides, average_rating")
            .in("vk_id", peerTags2)
          for (const p of profs || []) pp[p.vk_id as string] = p as PeerProfile
        }
        const mapped = list.map((row) => threadRowToChatData(row, myTag, pp))
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
      <div className="relative mx-auto flex h-dvh max-w-md flex-col overflow-hidden bg-[#EBEDF0] shadow-2xl ring-1 ring-black/5">
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
    <div className="relative mx-auto flex h-dvh max-w-md flex-col overflow-hidden bg-[#EBEDF0] shadow-2xl ring-1 ring-black/5">
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
                ridesError={ridesError}
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
                showAdminEntry={showAdminEntry || isAdminVkUser(vkUser?.id)}
                onOpenAdmin={() => setActiveScreen("admin")}
                appendReviewChatMessage={appendReviewChatMessage}
                onDriverPaymentVerified={() => setDriverAccessRev((v) => v + 1)}
              />
            )}
          </div>

          <nav className="safe-area-bottom flex items-center justify-around border-t border-[#D3D9DE]/80 bg-white/95 px-3 pt-2 shadow-[0_-8px_24px_rgba(0,0,0,0.06)] backdrop-blur">
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
            {showAdminEntry && (
              <NavButton
                icon={<Shield className="h-6 w-6" />}
                label="Админ"
                isActive={false}
                onClick={() => setActiveScreen("admin")}
              />
            )}
          </nav>
        </>
      )}
    </div>
  )
}
