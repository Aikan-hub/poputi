"use client"

import { useState } from "react"
import { Lock, Eye } from "lucide-react"
import { useDriverAccess } from "@/hooks/use-driver-access"
import { YokassaPaymentModal } from "@/components/yokassa-payment-modal"
import { YOKASSA_ACCESS_PRICE } from "@/lib/yokassa-access"
import { poputi } from "@/components/poputi/ui"

type Props = {
  vkTag: string | null
  userRole: string
  children: React.ReactNode
}

export function DriverAccessGate({ vkTag, userRole, children }: Props) {
  const [showPayModal, setShowPayModal] = useState(false)
  const { hasAccess, loading, refresh } = useDriverAccess(
    userRole === "Driver" ? vkTag : null
  )

  if (userRole !== "Driver" || hasAccess || loading) {
    return <>{children}</>
  }

  return (
    <>
      <div className="relative">
        <div className="pointer-events-none select-none opacity-30 blur-[2px]">
          {children}
        </div>

        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div className="mx-4 flex max-w-sm flex-col items-center gap-3 rounded-2xl bg-white/95 p-6 shadow-xl backdrop-blur-sm">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
              <Lock className="h-7 w-7 text-blue-600" />
            </div>
            <h3 className="text-center text-lg font-bold text-gray-900">
              Заявки пассажиров скрыты
            </h3>
            <p className="text-center text-sm text-gray-500">
              Оплатите доступ на 24 часа чтобы видеть все заявки пассажиров и принимать заказы
            </p>
            <button
              onClick={() => setShowPayModal(true)}
              className={`mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-semibold text-white ${poputi.brandBg} active:opacity-80`}
            >
              <Eye className="h-4 w-4" />
              Открыть доступ — {YOKASSA_ACCESS_PRICE} &#8381;
            </button>
          </div>
        </div>
      </div>

      {vkTag && (
        <YokassaPaymentModal
          open={showPayModal}
          onClose={() => setShowPayModal(false)}
          vkTag={vkTag}
          onSuccess={() => {
            setShowPayModal(false)
            refresh()
          }}
        />
      )}
    </>
  )
}
