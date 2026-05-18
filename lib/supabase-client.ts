import { createClient } from "@supabase/supabase-js"

/** Единый клиент для клиентских компонентов (тот же URL/ключ, что в приложении). */
export const supabase = createClient(
  "https://tcyycrokhmmvrbspamox.supabase.co",
  "sb_publishable_FS2VPiU_5b3vs8jG541YVw_TroedygI"
)
