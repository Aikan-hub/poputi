import bridge from "@vkontakte/vk-bridge"

import { driverCloudtipsPayUrl, DRIVER_ACCESS_AMOUNT } from "@/lib/driver-payment-config"

export { DRIVER_ACCESS_AMOUNT as DRIVER_ACCESS_PRICE_NUMBER } from "@/lib/driver-payment-config"
export const DRIVER_ACCESS_PRICE_LABEL = `${DRIVER_ACCESS_AMOUNT} ₽`

const STORAGE_KEY = "poputi_driver_cloudtips_access_v1"
const SESSION_INVOICE_KEY = "poputi_driver_payment_invoice_v1"

export function hasDriverAccess(): boolean {
  if (typeof window === "undefined") return false
  return window.localStorage.getItem(STORAGE_KEY) === "1"
}

export function grantDriverAccessLocally(): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STORAGE_KEY, "1")
}

export function clearPendingDriverInvoice(): void {
  if (typeof window === "undefined") return
  window.sessionStorage.removeItem(SESSION_INVOICE_KEY)
}

export function getPendingDriverInvoice(): string | null {
  if (typeof window === "undefined") return null
  return window.sessionStorage.getItem(SESSION_INVOICE_KEY)
}

export function setPendingDriverInvoice(invoiceId: string): void {
  if (typeof window === "undefined") return
  window.sessionStorage.setItem(SESSION_INVOICE_KEY, invoiceId)
}

/** Синхронизация с сервером: если в БД уже есть paid — выставить локальный доступ. */
export async function syncDriverAccessFromServer(vkTag: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/driver-payment/check-access?vkTag=${encodeURIComponent(vkTag)}`)
    if (!res.ok) return false
    const j = (await res.json()) as { ok?: boolean; hasPaidAccess?: boolean }
    if (j.hasPaidAccess) {
      grantDriverAccessLocally()
      return true
    }
  } catch (e) {
    console.error("syncDriverAccessFromServer", e)
  }
  return false
}

export async function createDriverPaymentIntent(
  vkTag: string
): Promise<{ ok: true; invoiceId: string; payUrl: string } | { ok: false; message: string }> {
  try {
    const res = await fetch("/api/driver-payment/intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vkTag }),
    })
    const j = (await res.json()) as { ok?: boolean; invoiceId?: string; payUrl?: string; message?: string }
    if (!res.ok || !j.ok || !j.invoiceId || !j.payUrl) {
      return { ok: false, message: j.message || "Не удалось создать оплату" }
    }
    return { ok: true, invoiceId: j.invoiceId, payUrl: j.payUrl }
  } catch {
    return { ok: false, message: "Сеть недоступна" }
  }
}

export async function checkDriverInvoicePaid(invoiceId: string): Promise<"paid" | "pending" | "missing" | "error"> {
  try {
    const res = await fetch(`/api/driver-payment/status?invoiceId=${encodeURIComponent(invoiceId)}`)
    if (!res.ok) return "error"
    const j = (await res.json()) as { ok?: boolean; paid?: boolean; status?: string }
    if (!j.ok) return "error"
    if (j.status === "missing") return "missing"
    return j.paid ? "paid" : "pending"
  } catch {
    return "error"
  }
}

export async function openPaymentUrl(url: string): Promise<void> {
  try {
    await (bridge as { send: (m: string, p?: { url: string }) => Promise<unknown> }).send("VKWebAppOpenLink", { url })
  } catch {
    try {
      window.open(url, "_blank", "noopener,noreferrer")
    } catch {
      window.location.href = url
    }
  }
}
