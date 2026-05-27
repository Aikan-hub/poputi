import type { SupabaseClient } from "@supabase/supabase-js"

export const BANNED_USER_MESSAGE =
  "Доступ ограничен. Обратитесь к администратору приложения, если считаете это ошибкой."

/** Кэш на сессию, чтобы не дергать БД на каждый клик. */
const banCache = new Map<string, { banned: boolean; at: number }>()
const CACHE_MS = 60_000

export async function isVkBanned(supabase: SupabaseClient, vkTag: string): Promise<boolean> {
  const tag = vkTag.trim()
  if (!tag) return false

  const cached = banCache.get(tag)
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.banned

  const { data, error } = await supabase.rpc("is_vk_banned", { p_vk_id: tag })
  let banned = false
  if (!error && typeof data === "boolean") {
    banned = data
  } else {
    const { data: row } = await supabase.from("banned_users").select("vk_id").eq("vk_id", tag).maybeSingle()
    banned = !!row?.vk_id
  }

  banCache.set(tag, { banned, at: Date.now() })
  return banned
}

export function clearBanCache(vkTag?: string): void {
  if (vkTag) banCache.delete(vkTag.trim())
  else banCache.clear()
}

export async function assertNotBanned(supabase: SupabaseClient, vkTag: string): Promise<string | null> {
  if (await isVkBanned(supabase, vkTag)) return BANNED_USER_MESSAGE
  return null
}
