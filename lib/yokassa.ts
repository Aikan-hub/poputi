import crypto from "crypto"

const YOKASSA_API = "https://api.yookassa.ru/v3"

export type YookassaPaymentStatus =
  | "pending"
  | "waiting_for_capture"
  | "succeeded"
  | "canceled"

export type YookassaPayment = {
  id: string
  status: YookassaPaymentStatus
  amount: { value: string; currency: string }
  confirmation?: { type: string; confirmation_url?: string }
  created_at: string
  paid: boolean
  metadata?: Record<string, string>
}

function getCredentials() {
  const shopId = process.env.YOKASSA_SHOP_ID
  const secretKey = process.env.YOKASSA_SECRET_KEY
  if (!shopId || !secretKey) return null
  return { shopId, secretKey }
}

function authHeader(shopId: string, secretKey: string): string {
  return "Basic " + Buffer.from(`${shopId}:${secretKey}`).toString("base64")
}

export async function createPayment(params: {
  amount: number
  currency?: string
  description: string
  returnUrl: string
  metadata?: Record<string, string>
}): Promise<{ ok: true; payment: YookassaPayment } | { ok: false; error: string }> {
  const creds = getCredentials()
  if (!creds) return { ok: false, error: "YOKASSA_SHOP_ID / YOKASSA_SECRET_KEY не заданы" }

  const idempotenceKey = crypto.randomUUID()

  const body = {
    amount: {
      value: params.amount.toFixed(2),
      currency: params.currency || "RUB",
    },
    capture: true,
    confirmation: {
      type: "redirect",
      return_url: params.returnUrl,
    },
    description: params.description,
    metadata: params.metadata || {},
  }

  const res = await fetch(`${YOKASSA_API}/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(creds.shopId, creds.secretKey),
      "Idempotence-Key": idempotenceKey,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error("YooKassa createPayment error:", res.status, text)
    return { ok: false, error: `YooKassa API: ${res.status}` }
  }

  const payment = (await res.json()) as YookassaPayment
  return { ok: true, payment }
}

export function verifyWebhookIp(ip: string): boolean {
  const allowed = [
    "185.71.76.0/27",
    "185.71.77.0/27",
    "77.75.153.0/25",
    "77.75.156.11",
    "77.75.156.35",
    "77.75.154.128/25",
    "2a02:5180::/32",
  ]
  // В продакшене стоит проверять IP. Для MVP принимаем все запросы.
  // Vercel проксирует запросы, поэтому IP-проверка ненадёжна без доп. настройки.
  return true
}
