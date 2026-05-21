import type { ChatThreadRow } from "@/lib/chats-db"
import { isPersistentRideType } from "@/lib/rides"
import type { AppCity } from "@/lib/cities"
import type { ChatData, PeerProfile, SupabaseRide } from "./types"

export const VK_MSGS_ALLOWED_KEY = "vk_msgs_allowed"
export const VK_GROUP_ID = 238429423
export const ROLE_KEY = "poputi_role"

export function parseRideCoords(ride: SupabaseRide): [number, number] | null {
  const lat = typeof ride.lat === "string" ? parseFloat(ride.lat) : ride.lat
  const lng = typeof ride.lng === "string" ? parseFloat(ride.lng) : ride.lng
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return [lat, lng]
}

export function matchesCity(rideCity: string | null | undefined, selected: AppCity): boolean {
  const rc = (rideCity || "").trim()
  if (!rc) return true
  if (rc.toLowerCase() === selected.toLowerCase()) return true
  return true
}

export function isCityMapRideType(type: string | null | undefined): boolean {
  const t = (type || "").trim()
  if (!t) return true
  if (t === "City" || t === "Passenger" || t === "Driver") return true
  return isPersistentRideType(t)
}

export function cityBoundsKm(center: [number, number], radiusKm = 50): [[number, number], [number, number]] {
  const [lat, lng] = center
  const latDelta = radiusKm / 111
  const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180) || 1)
  return [
    [lat - latDelta, lng - lngDelta],
    [lat + latDelta, lng + lngDelta],
  ]
}

export const getAvatarLabel = (name: string, avatar?: string) => {
  if (avatar && !avatar.startsWith("http")) return avatar
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("")
  return initials || "П"
}

export function formatChatListTime(iso: string): string {
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

export function threadRowToChatData(
  row: ChatThreadRow,
  myTag: string,
  peerProfiles?: Record<string, PeerProfile>,
): ChatData {
  const peerVk = row.vk_lower === myTag ? row.vk_higher : row.vk_lower
  const labels = row.peer_labels || {}
  const prof = peerProfiles?.[peerVk]
  const displayName =
    prof?.display_name?.trim() || labels[peerVk]?.trim() || `Пользователь ${peerVk.replace(/^id/i, "")}`
  return {
    id: row.id,
    threadId: row.id,
    name: displayName,
    avatar: getAvatarLabel(displayName),
    avatarUrl: prof?.avatar_url || undefined,
    lastMessage: row.last_message || "Нет сообщений",
    time: formatChatListTime(row.last_message_at),
    unread: 0,
    rating: prof?.average_rating ?? 5,
    trips: prof?.total_rides ?? 0,
    vkId: peerVk,
    vkTag: peerVk,
    telegram: "",
  }
}

export function vkIdTagFromNumericId(id: number): string {
  return `id${id}`
}

export function rideTypeLabelRu(type: string | null | undefined): string {
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

export function resolveReviewTargetVk(ride: SupabaseRide, myTag: string): string | null {
  const owner = (ride.vk_id || "").trim()
  const partner = (ride.partner_vk_id || "").trim()
  if (owner === myTag && partner) return partner
  if (partner === myTag && owner) return owner
  return null
}

export function targetDisplayLabelForReview(ride: SupabaseRide, myTag: string): string {
  const owner = (ride.vk_id || "").trim()
  if (owner !== myTag) return ride.name?.trim() || "Пользователь"
  return "Попутчик"
}
