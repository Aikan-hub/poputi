import { APP_CITY_COORDS, type AppCity } from "@/lib/cities"
import { getYandexMapsApiKey } from "@/lib/env"

export async function geocodeAddress(
  city: AppCity,
  address: string
): Promise<{ lat: number; lng: number } | null> {
  const q = address.trim()
  if (!q) return null
  try {
    const url = `https://geocode-maps.yandex.ru/1.x/?apikey=${getYandexMapsApiKey()}&format=json&geocode=${encodeURIComponent(`${city}, ${q}`)}`
    const response = await fetch(url)
    const data = await response.json()
    const pos = data.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject?.Point?.pos
    if (!pos) return null
    const [lngStr, latStr] = pos.split(" ")
    const lat = parseFloat(latStr)
    const lng = parseFloat(lngStr)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    return { lat, lng }
  } catch {
    return null
  }
}

export function randomCoordsNearCity(city: AppCity): { lat: number; lng: number } {
  const [cityLat, cityLng] = APP_CITY_COORDS[city]
  return {
    lat: cityLat + (Math.random() - 0.5) * 0.01,
    lng: cityLng + (Math.random() - 0.5) * 0.01,
  }
}
