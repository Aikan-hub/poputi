import { DEFAULT_APP_CITY, isAppCity, type AppCity } from "@/lib/cities"

export const SELECTED_CITY_KEY = "poputi_selected_city"
export const INTRO_CITY_DONE_KEY = "poputi_intro_city_done"

export function loadStoredCity(): AppCity | null {
  if (typeof window === "undefined") return null
  const raw = window.localStorage.getItem(SELECTED_CITY_KEY)
  return raw && isAppCity(raw) ? raw : null
}

export function storeSelectedCity(city: AppCity): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(SELECTED_CITY_KEY, city)
  window.localStorage.setItem(INTRO_CITY_DONE_KEY, "1")
}

export function loadIntroCityDone(): boolean {
  if (typeof window === "undefined") return false
  return window.localStorage.getItem(INTRO_CITY_DONE_KEY) === "1" && !!loadStoredCity()
}
