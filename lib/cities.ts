/** Два города приложения — жёсткое разделение данных в UI и в Supabase (`rides.city`). */
export const APP_CITIES = ["Шумиха", "Тюмень"] as const

export type AppCity = (typeof APP_CITIES)[number]

export const DEFAULT_APP_CITY: AppCity = "Шумиха"

/** Центр карты для геокодера и Yandex Map */
export const APP_CITY_COORDS: Record<AppCity, [number, number]> = {
  Шумиха: [55.2285, 63.2951],
  Тюмень: [57.1522, 65.5272],
}

export function isAppCity(value: string): value is AppCity {
  return (APP_CITIES as readonly string[]).includes(value)
}
