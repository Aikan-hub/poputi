/**
 * Публичные ключи для клиента (только NEXT_PUBLIC_*).
 * Важно: обращаться к process.env.NEXT_PUBLIC_* статически — иначе Next не
 * встроит значения в клиентский бандл (динамический process.env[name] = undefined).
 */

function requirePublicEnv(value: string | undefined, name: string): string {
  const trimmed = value?.trim()
  if (!trimmed) {
    throw new Error(
      `${name} не задан. Скопируйте .env.example → .env.local и заполните ключи.`,
    )
  }
  return trimmed
}

export function getSupabaseUrl(): string {
  return requirePublicEnv(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL")
}

export function getSupabaseAnonKey(): string {
  return requirePublicEnv(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  )
}

export function getYandexMapsApiKey(): string {
  return requirePublicEnv(
    process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY,
    "NEXT_PUBLIC_YANDEX_MAPS_API_KEY",
  )
}
