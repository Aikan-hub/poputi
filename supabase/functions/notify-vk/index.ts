// Supabase Edge Function: notify-vk
// Sends a VK message from the community to a user when a driver is assigned.
// Set env vars in Supabase:
//   VK_GROUP_TOKEN = <access_token_of_community_with_messages_permission>
//   VK_API_VERSION = 5.199 (or your target version)
//
// Deploy: `supabase functions deploy notify-vk`

import { serve } from "https://deno.land/std@0.192.0/http/server.ts"

type Payload = {
  vk_user_id?: number | string
  message?: string
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 })
  }

  let body: Payload
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "bad_json" }), { status: 400 })
  }

  const userIdRaw = body.vk_user_id
  const message = (body.message || "").trim()
  if (!userIdRaw || !message) {
    return new Response(JSON.stringify({ ok: false, error: "missing_params" }), { status: 400 })
  }

  const userId = typeof userIdRaw === "string" ? userIdRaw.replace(/^id/i, "") : String(userIdRaw)
  const token = Deno.env.get("VK_GROUP_TOKEN")
  const apiVersion = Deno.env.get("VK_API_VERSION") || "5.199"
  if (!token) {
    return new Response(JSON.stringify({ ok: false, error: "missing_token" }), { status: 500 })
  }

  const params = new URLSearchParams({
    user_id: userId,
    message,
    random_id: Date.now().toString(),
    v: apiVersion,
    access_token: token,
  })

  const vkRes = await fetch("https://api.vk.com/method/messages.send", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  })

  const json = await vkRes.json()
  if (!vkRes.ok || json.error) {
    console.error("VK messages.send error", json)
    return new Response(JSON.stringify({ ok: false, error: "vk_error", detail: json }), { status: 500 })
  }

  return new Response(JSON.stringify({ ok: true, response: json.response ?? null }), { headers: { "Content-Type": "application/json" } })
})
