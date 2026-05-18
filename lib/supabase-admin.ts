import { createClient, type SupabaseClient } from "@supabase/supabase-js"

const DEFAULT_URL = "https://tcyycrokhmmvrbspamox.supabase.co"

let _cached: SupabaseClient | null = null

/** Клиент с service role только для Route Handlers (не импортировать в клиентские компоненты). */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (_cached) return _cached
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null
  _cached = createClient(url, key)
  return _cached
}
