import type { SupabaseClient } from "@supabase/supabase-js"

export interface ChatThreadRow {
  id: string
  vk_lower: string
  vk_higher: string
  last_message: string
  last_message_at: string
  peer_labels: Record<string, string> | null
}

export interface ChatMessageRow {
  id: number
  thread_id: string
  sender_vk_id: string
  body: string
  metadata?: unknown | null
  created_at: string
}

export function sortVkPair(a: string, b: string): readonly [string, string] {
  const x = a.trim()
  const y = b.trim()
  return x <= y ? [x, y] : [y, x]
}

export async function ensureChatThread(
  supabase: SupabaseClient,
  vk1: string,
  vk2: string,
  peerLabels?: Record<string, string>
): Promise<string | null> {
  const [lo, hi] = sortVkPair(vk1, vk2)
  const { data: found, error: selErr } = await supabase
    .from("chat_threads")
    .select("id, peer_labels")
    .eq("vk_lower", lo)
    .eq("vk_higher", hi)
    .maybeSingle()

  if (selErr) {
    console.error("ensureChatThread select", selErr)
    return null
  }

  if (found?.id) {
    if (peerLabels && Object.keys(peerLabels).length > 0) {
      const merged = { ...(found.peer_labels as Record<string, string> | null), ...peerLabels }
      await supabase.from("chat_threads").update({ peer_labels: merged }).eq("id", found.id)
    }
    return found.id as string
  }

  const { data: ins, error: insErr } = await supabase
    .from("chat_threads")
    .insert({
      vk_lower: lo,
      vk_higher: hi,
      last_message: "",
      peer_labels: peerLabels || {},
    })
    .select("id")
    .single()

  if (insErr) {
    console.error("ensureChatThread insert", insErr)
    return null
  }
  return (ins?.id as string) ?? null
}

export async function fetchThreadsForUser(supabase: SupabaseClient, myTag: string): Promise<ChatThreadRow[]> {
  const { data, error } = await supabase
    .from("chat_threads")
    .select("*")
    .or(`vk_lower.eq.${myTag},vk_higher.eq.${myTag}`)
    .order("last_message_at", { ascending: false })

  if (error) {
    console.error("fetchThreadsForUser", error)
    return []
  }
  return (data as ChatThreadRow[]) ?? []
}

export async function fetchThreadMessages(supabase: SupabaseClient, threadId: string): Promise<ChatMessageRow[]> {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })

  if (error) {
    console.error("fetchThreadMessages", error)
    return []
  }
  return (data as ChatMessageRow[]) ?? []
}

export async function appendThreadMessage(
  supabase: SupabaseClient,
  threadId: string,
  senderVkId: string,
  body: string,
  metadata?: unknown
): Promise<boolean> {
  const trimmed = body.trim()
  if (!trimmed) return false

  const payload: Record<string, unknown> = {
    thread_id: threadId,
    sender_vk_id: senderVkId.trim(),
    body: trimmed,
  }
  if (metadata !== undefined) payload.metadata = metadata

  const { error: mErr } = await supabase.from("chat_messages").insert(payload)
  if (mErr) {
    console.error("appendThreadMessage insert", mErr)
    return false
  }

  const { error: uErr } = await supabase
    .from("chat_threads")
    .update({
      last_message: trimmed.slice(0, 500),
      last_message_at: new Date().toISOString(),
    })
    .eq("id", threadId)

  if (uErr) console.error("appendThreadMessage update thread", uErr)

  // VK-уведомление получателю о новом сообщении
  void notifyThreadPeer(supabase, threadId, senderVkId.trim(), trimmed)

  return !uErr
}

/** Отправляем VK-уведомление второму участнику чата */
async function notifyThreadPeer(
  supabase: SupabaseClient,
  threadId: string,
  senderTag: string,
  messagePreview: string
): Promise<void> {
  try {
    const { data: thread } = await supabase
      .from("chat_threads")
      .select("vk_lower, vk_higher, peer_labels")
      .eq("id", threadId)
      .maybeSingle()
    if (!thread) return
    const peerTag = thread.vk_lower === senderTag ? thread.vk_higher : thread.vk_lower
    if (!peerTag) return
    const peerVkNumeric = peerTag.replace(/^id/i, "")
    if (!peerVkNumeric || !/^\d+$/.test(peerVkNumeric)) return
    const senderName =
      (thread.peer_labels as Record<string, string> | null)?.[senderTag] || "Попутчик"
    const preview = messagePreview.length > 80 ? messagePreview.slice(0, 77) + "…" : messagePreview
    void supabase.functions.invoke("notify-vk", {
      body: {
        vk_user_id: peerVkNumeric,
        message: `${senderName}: ${preview}`,
      },
    })
  } catch (e) {
    console.warn("notifyThreadPeer failed", e)
  }
}

export async function deleteChatThread(supabase: SupabaseClient, threadId: string): Promise<boolean> {
  const { error } = await supabase.from("chat_threads").delete().eq("id", threadId)
  if (error) {
    console.error("deleteChatThread", error)
    return false
  }
  return true
}
