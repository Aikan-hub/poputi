import { NextResponse } from "next/server"
import { createPayment } from "@/lib/yokassa"
import { createAccessIntent, YOKASSA_ACCESS_PRICE, hasActiveAccess } from "@/lib/yokassa-access"

const VK_TAG = /^id\d+$/i

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, message: "Некорректный JSON" }, { status: 400 })
  }

  const vkTag = typeof (body as { vkTag?: string }).vkTag === "string"
    ? (body as { vkTag: string }).vkTag.trim()
    : ""

  if (!VK_TAG.test(vkTag)) {
    return NextResponse.json({ ok: false, message: "Ожидается vkTag вида id123456" }, { status: 400 })
  }

  const vkId = vkTag.toLowerCase()

  const alreadyActive = await hasActiveAccess(vkId)
  if (alreadyActive) {
    return NextResponse.json({ ok: false, message: "Доступ уже активен" }, { status: 409 })
  }

  const returnUrl = typeof (body as { returnUrl?: string }).returnUrl === "string"
    ? (body as { returnUrl: string }).returnUrl
    : (process.env.NEXT_PUBLIC_APP_URL || "https://poputi-app.vercel.app")

  const result = await createPayment({
    amount: YOKASSA_ACCESS_PRICE,
    description: `Доступ водителя на 24ч — ${vkId}`,
    returnUrl,
    metadata: { vk_id: vkId, type: "driver_access" },
  })

  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.error }, { status: 502 })
  }

  const payment = result.payment
  const confirmationUrl = payment.confirmation?.confirmation_url

  if (!confirmationUrl) {
    return NextResponse.json({ ok: false, message: "Нет ссылки на оплату" }, { status: 502 })
  }

  const intent = await createAccessIntent(vkId, payment.id, YOKASSA_ACCESS_PRICE)
  if (!intent.ok) {
    return NextResponse.json({ ok: false, message: "Ошибка БД" }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    paymentId: payment.id,
    confirmationUrl,
  })
}
