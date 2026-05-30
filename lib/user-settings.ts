import { normalizeStoredRuPhone } from "./ru-phone"

export const USER_SETTINGS_KEY = "poputi_user_settings_v1"

export type RouteTemplate = {
  id: string
  label: string
  from: string
  to: string
}

export type UserSettings = {
  radar: {
    radiusKm: number
    maxPrice: number
    minRating: number
    freshOnly: boolean
  }
  routes: RouteTemplate[]
  driver: {
    carModel: string
    carColor: string
    seats: number
    paymentMethod: "any" | "transfer" | "cash"
    onlineUntil: string
  }
  notifications: {
    nearbyDrivers: boolean
    replies: boolean
    rideSoon: boolean
    vkMessages: boolean
  }
  safety: {
    trustedContactName: string
    trustedContactPhone: string
    shareRide: boolean
    hideVkUntilAccepted: boolean
  }
  privacy: {
    /** Скрывает аватар пользователя для других (показ инициалов) */
    hideAvatar: boolean
    /** Скрывает ссылку vk.com/idX в публичных карточках */
    hideVkLink: boolean
  }
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  radar: {
    radiusKm: 12,
    maxPrice: 1000,
    minRating: 4,
    freshOnly: false,
  },
  routes: [
    { id: "home", label: "Дом", from: "", to: "" },
    { id: "work", label: "Работа", from: "", to: "" },
    { id: "station", label: "Вокзал", from: "", to: "" },
    { id: "study", label: "Универ", from: "", to: "" },
  ],
  driver: {
    carModel: "",
    carColor: "",
    seats: 3,
    paymentMethod: "any",
    onlineUntil: "",
  },
  notifications: {
    nearbyDrivers: true,
    replies: true,
    rideSoon: true,
    vkMessages: true,
  },
  safety: {
    trustedContactName: "",
    trustedContactPhone: "",
    shareRide: false,
    hideVkUntilAccepted: true,
  },
  privacy: {
    hideAvatar: false,
    hideVkLink: false,
  },
}

export function loadUserSettings(): UserSettings {
  if (typeof window === "undefined") return DEFAULT_USER_SETTINGS
  const raw = window.localStorage.getItem(USER_SETTINGS_KEY)
  if (!raw) return DEFAULT_USER_SETTINGS

  try {
    const parsed = JSON.parse(raw) as Partial<UserSettings>
    return normalizeUserSettings(parsed)
  } catch {
    return DEFAULT_USER_SETTINGS
  }
}

export function storeUserSettings(settings: UserSettings): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(USER_SETTINGS_KEY, JSON.stringify(normalizeUserSettings(settings)))
}

export function normalizeUserSettings(settings: Partial<UserSettings>): UserSettings {
  const defaults = DEFAULT_USER_SETTINGS
  return {
    radar: {
      radiusKm: clampNumber(settings.radar?.radiusKm, 1, 50, defaults.radar.radiusKm),
      maxPrice: clampNumber(settings.radar?.maxPrice, 0, 10000, defaults.radar.maxPrice),
      minRating: clampNumber(settings.radar?.minRating, 0, 5, defaults.radar.minRating),
      freshOnly: settings.radar?.freshOnly ?? defaults.radar.freshOnly,
    },
    routes: normalizeRoutes(settings.routes),
    driver: {
      carModel: settings.driver?.carModel?.slice(0, 80) ?? defaults.driver.carModel,
      carColor: settings.driver?.carColor?.slice(0, 40) ?? defaults.driver.carColor,
      seats: clampNumber(settings.driver?.seats, 1, 4, defaults.driver.seats),
      paymentMethod: normalizePaymentMethod(settings.driver?.paymentMethod),
      onlineUntil: settings.driver?.onlineUntil?.slice(0, 5) ?? defaults.driver.onlineUntil,
    },
    notifications: {
      nearbyDrivers: settings.notifications?.nearbyDrivers ?? defaults.notifications.nearbyDrivers,
      replies: settings.notifications?.replies ?? defaults.notifications.replies,
      rideSoon: settings.notifications?.rideSoon ?? defaults.notifications.rideSoon,
      vkMessages: settings.notifications?.vkMessages ?? defaults.notifications.vkMessages,
    },
    safety: {
      trustedContactName: settings.safety?.trustedContactName?.slice(0, 80) ?? defaults.safety.trustedContactName,
      trustedContactPhone: normalizeStoredRuPhone(settings.safety?.trustedContactPhone),
      shareRide: settings.safety?.shareRide ?? defaults.safety.shareRide,
      hideVkUntilAccepted: settings.safety?.hideVkUntilAccepted ?? defaults.safety.hideVkUntilAccepted,
    },
    privacy: {
      hideAvatar: settings.privacy?.hideAvatar ?? defaults.privacy.hideAvatar,
      hideVkLink: settings.privacy?.hideVkLink ?? defaults.privacy.hideVkLink,
    },
  }
}

function normalizeRoutes(routes: UserSettings["routes"] | undefined): RouteTemplate[] {
  const source = routes?.length ? routes : DEFAULT_USER_SETTINGS.routes
  const normalized = source.slice(0, 4).map((route, index) => ({
    id: route.id || DEFAULT_USER_SETTINGS.routes[index]?.id || `route-${index}`,
    label: (route.label || DEFAULT_USER_SETTINGS.routes[index]?.label || `Маршрут ${index + 1}`).slice(0, 24),
    from: (route.from || "").slice(0, 120),
    to: (route.to || "").slice(0, 120),
  }))

  while (normalized.length < DEFAULT_USER_SETTINGS.routes.length) {
    normalized.push(DEFAULT_USER_SETTINGS.routes[normalized.length])
  }

  return normalized
}

function normalizePaymentMethod(value: unknown): UserSettings["driver"]["paymentMethod"] {
  if (value === "transfer" || value === "cash") return value
  return "any"
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const next = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(next)) return fallback
  return Math.min(max, Math.max(min, Math.round(next * 10) / 10))
}
