export type ChatData = {
  id: string
  threadId: string
  name: string
  avatar: string
  avatarUrl?: string
  lastMessage: string
  time: string
  unread: number
  rating: number
  trips: number
  vkId: string
  telegram: string
  vkTag?: string
}

export type PeerProfile = {
  avatar_url?: string
  display_name?: string
  total_rides?: number
  average_rating?: number
}

export type Tab = "map" | "chats" | "profile"
export type Mode = "city" | "intercity"

export type DriverData = {
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

export type RideData = {
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

export interface SupabaseRide {
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

export interface VkUserProfile {
  id: number
  first_name: string
  last_name: string
  photo_200?: string
}

export type AddModalVariant = "cityDriver" | "cityPassenger" | "intercity"

declare global {
  interface Window {
    __VK_INIT_READY__?: boolean
    vkBridgeInitialized?: boolean
    ymaps?: unknown
  }
}
