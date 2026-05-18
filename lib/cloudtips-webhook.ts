import crypto from "crypto"

/** Подпись тела webhook: HMAC-SHA256(UTF-8 body, secret) → Base64, см. CloudTips API «Уведомления». */
export function verifyCloudtipsWebhookSignature(rawBody: string, headerHmac: string | null, secret: string): boolean {
  if (!headerHmac || !secret || !rawBody) return false
  const expected = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64")
  try {
    const a = Buffer.from(expected, "utf8")
    const b = Buffer.from(headerHmac.trim(), "utf8")
    if (a.length !== b.length) return false
    return crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export function parseCloudtipsFormBody(rawBody: string): Record<string, string> {
  const params = new URLSearchParams(rawBody)
  const out: Record<string, string> = {}
  params.forEach((v, k) => {
    out[k.toLowerCase()] = v
  })
  return out
}

export function isCloudtipsSuccess(fields: Record<string, string>): boolean {
  const s = (fields.success || "").toLowerCase()
  return s === "true" || s === "1"
}
