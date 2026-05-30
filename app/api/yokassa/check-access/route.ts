import { NextResponse } from "next/server"
import { hasActiveAccess } from "@/lib/yokassa-access"

const VK_TAG = /^id\d+$/i

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const vkTag = (searchParams.get("vkTag") || "").trim()

  if (!VK_TAG.test(vkTag)) {
    return NextResponse.json({ ok: false, hasAccess: false, message: "Некорректный vkTag" }, { status: 400 })
  }

  const hasAccess = await hasActiveAccess(vkTag)

  return NextResponse.json({ ok: true, hasAccess })
}
