"use client"

import { useState } from "react"
import { Clock, CreditCard, CheckCircle, Loader2, ShieldCheck, X } from "lucide-react"
import { poputi } from "@/components/poputi/ui"
import { grantLocalAccess } from "@/hooks/use-driver-access"

type Props = {
  open: boolean
  onClose: () => void
  vkTag: string
  onSuccess: () => void
}

type PayState = "idle" | "creating" | "waiting" | "success" | "error"

export function YokassaPaymentModal({ open, onClose, vkTag, onSuccess }: Props) {
  const [state, setState] = useState<PayState>("idle")
  const [error, setError] = useState("")
  const [confirmationUrl, setConfirmationUrl] = useState("")
  const [paymentId, setPaymentId] = useState("")

  const price = 300

  if (!open) return null

  async function handlePay() {
    setState("creating")
    setError("")

    try {
      const res = await fetch("/api/yokassa/create-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vkTag,
          returnUrl: window.location.href,
        }),
      })

      const data = (await res.json()) as {
        ok: boolean
        paymentId?: string
        confirmationUrl?: string
        message?: string
      }

      if (!data.ok || !data.confirmationUrl) {
        setState("error")
        setError(data.message || "Не удалось создать платёж")
        return
      }

      setPaymentId(data.paymentId || "")
      setConfirmationUrl(data.confirmationUrl)
      setState("waiting")

      window.open(data.confirmationUrl, "_blank", "noopener,noreferrer")
    } catch {
      setState("error")
      setError("Сеть недоступна")
    }
  }

  async function handleCheckPaid() {
    try {
      const res = await fetch(`/api/yokassa/check-access?vkTag=${encodeURIComponent(vkTag)}`)
      const data = (await res.json()) as { ok: boolean; hasAccess: boolean }
      if (data.hasAccess) {
        grantLocalAccess()
        setState("success")
        setTimeout(() => onSuccess(), 1500)
      } else {
        setError("Платёж ещё не подтверждён. Подождите немного и нажмите снова.")
      }
    } catch {
      setError("Ошибка проверки")
    }
  }

  function handleClose() {
    if (state !== "creating") {
      setState("idle")
      setError("")
      setConfirmationUrl("")
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
        aria-label="Закрыть"
        onClick={handleClose}
      />

      <div className="relative w-full max-w-md rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 active:bg-gray-200"
          aria-label="Закрыть"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="px-5 pb-6 pt-6">
          {state === "success" ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <CheckCircle className="h-16 w-16 text-green-500" />
              <p className="text-lg font-semibold">Доступ активирован!</p>
              <p className="text-center text-sm text-gray-500">
                Вам доступны заявки пассажиров на 24 часа
              </p>
            </div>
          ) : (
            <>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                  <ShieldCheck className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Доступ водителя</h3>
                  <p className="text-sm text-gray-500">Видеть заявки пассажиров</p>
                </div>
              </div>

              <div className="mb-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <span className="text-sm">Срок действия</span>
                  </div>
                  <span className="font-medium">24 часа</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-gray-400" />
                    <span className="text-sm">Стоимость</span>
                  </div>
                  <span className="text-lg font-bold">{price} &#8381;</span>
                </div>
              </div>

              <div className="mb-4 px-1 text-xs text-gray-500">
                После оплаты вы получите доступ ко всем активным заявкам пассажиров
                на 24 часа. Оплата через безопасный шлюз ЮKassa.
              </div>

              {error && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {state === "idle" || state === "error" ? (
                <button
                  onClick={handlePay}
                  className={`w-full rounded-xl py-3.5 font-semibold text-white transition-colors ${poputi.brandBg} active:opacity-80`}
                >
                  Оплатить {price} &#8381;
                </button>
              ) : state === "creating" ? (
                <button
                  disabled
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-400 py-3.5 font-semibold text-white"
                >
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Создаём платёж...
                </button>
              ) : state === "waiting" ? (
                <div className="space-y-3">
                  <a
                    href={confirmationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`block w-full rounded-xl py-3.5 text-center font-semibold text-white transition-colors ${poputi.brandBg} active:opacity-80`}
                  >
                    Перейти к оплате
                  </a>
                  <button
                    onClick={handleCheckPaid}
                    className="w-full rounded-xl border border-gray-300 py-3 font-medium text-gray-700 transition-colors active:bg-gray-100"
                  >
                    Я оплатил — проверить
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
