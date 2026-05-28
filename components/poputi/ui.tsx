"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** VK-синяя палитра (как в оригинале до редизайна) */
export const poputi = {
  brand: "text-[#2787F5]",
  brandBg: "bg-[#2787F5]",
  brandBgHover: "hover:bg-[#1F6AD8]",
  brandMuted: "bg-[#F0F6FF]",
  brandMutedText: "text-[#2787F5]",
  ink: "text-gray-900",
  muted: "text-gray-500",
  surface: "bg-gray-100",
  sheet: "rounded-t-[2rem] bg-white shadow-[0_-10px_40px_rgba(0,0,0,0.1)]",
  input:
    "rounded-xl bg-gray-100 px-3.5 py-3.5 text-sm font-medium text-gray-800 placeholder:text-gray-400 focus:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2787F5]/40",
  btnPrimary:
    "w-full rounded-xl bg-[#2787F5] py-4 text-lg font-semibold text-white shadow-lg shadow-[#2787F5]/30 transition-[background-color,transform,box-shadow] hover:bg-[#1F6AD8] motion-reduce:active:scale-100 active:scale-[0.98] disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2787F5] focus-visible:ring-offset-2",
  btnDark:
    "rounded-xl bg-gray-900 py-3 text-sm font-semibold text-white shadow-md shadow-gray-900/20 transition-[background-color,transform] hover:bg-gray-800 motion-reduce:active:scale-100 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2",
  btnGhost:
    "rounded-xl bg-gray-100 py-3 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-300 focus-visible:ring-offset-2",
  fab: "flex h-12 w-12 items-center justify-center rounded-full bg-white text-gray-800 shadow-lg transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2787F5] focus-visible:ring-offset-2 motion-reduce:active:scale-100 active:scale-95",
  overlay: "absolute inset-0 z-20 bg-black/20",
  focusRing: "poputi-focus-ring",
  btnMotion: "poputi-btn-motion",
} as const

export function BottomSheet({
  onClose,
  children,
  className,
  maxHeight = "86vh",
}: {
  onClose?: () => void
  children: ReactNode
  className?: string
  maxHeight?: string
}) {
  return (
    <div className="absolute inset-0 z-30 flex items-end">
      {onClose ? (
        <button
          type="button"
          className="absolute inset-0 bg-black/20"
          aria-label="Закрыть"
          onClick={onClose}
        />
      ) : (
        <div className="absolute inset-0 bg-black/20" aria-hidden />
      )}
      <div
        className={cn(
          "relative w-full overflow-hidden overscroll-contain p-6 motion-reduce:animate-none animate-in slide-in-from-bottom duration-300",
          poputi.sheet,
          className
        )}
        style={{ maxHeight }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="mx-auto mb-6 h-1.5 w-12 rounded-full bg-gray-200" />
        {children}
      </div>
    </div>
  )
}

export function RouteTimeline({
  from,
  to,
  onFromChange,
  onToChange,
  fromPlaceholder = "Откуда",
  toPlaceholder = "Куда едем?",
  toExtra,
}: {
  from: string
  onFromChange: (v: string) => void
  to: string
  onToChange: (v: string) => void
  fromPlaceholder?: string
  toPlaceholder?: string
  toExtra?: ReactNode
}) {
  return (
    <div className="relative pl-10">
      <div className="absolute bottom-9 left-4 top-3 flex w-0.5 flex-col items-center bg-gray-200">
        <div className="absolute -left-1 -top-0.5 h-2.5 w-2.5 rounded-full bg-gray-800" />
        <div className="absolute -bottom-0.5 -left-1 h-2.5 w-2.5 rounded-full bg-[#2787F5]" />
      </div>
      <input
        type="text"
        name="route_from"
        autoComplete="off"
        value={from}
        onChange={(e) => onFromChange(e.target.value)}
        placeholder={fromPlaceholder}
        aria-label={fromPlaceholder}
        className={cn(poputi.input, "mb-2 w-full")}
      />
      <div className="relative">
        <input
          type="text"
          name="route_to"
          autoComplete="off"
          value={to}
          onChange={(e) => onToChange(e.target.value)}
          placeholder={toPlaceholder}
          aria-label={toPlaceholder}
          className={cn(poputi.input, "w-full pr-10")}
        />
        {toExtra}
      </div>
    </div>
  )
}

export function FloatingMapChrome({
  city,
  mode,
  onBackToCity,
  onModeCity,
  onModeIntercity,
  isDriver,
  onOpenProfile,
}: {
  city: string
  mode: "city" | "intercity"
  onBackToCity: () => void
  onModeCity: () => void
  onModeIntercity: () => void
  isDriver: boolean
  onOpenProfile?: () => void
}) {
  return (
    <>
      <button
        type="button"
        onClick={onBackToCity}
        className={cn(poputi.fab, "absolute left-4 top-4 z-20")}
        aria-label="Сменить город"
      >
        <span className="space-y-1.5">
          <span className="block h-0.5 w-5 rounded-full bg-gray-800" />
          <span className="block h-0.5 w-4 rounded-full bg-gray-800" />
        </span>
      </button>

      <div className="absolute left-1/2 top-4 z-20 flex -translate-x-1/2 rounded-full bg-white/95 p-1 shadow-lg ring-1 ring-black/5 backdrop-blur">
        <button
          type="button"
          onClick={onModeCity}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2787F5]",
            mode === "city" ? "bg-gray-900 text-white" : "text-gray-500"
          )}
        >
          Город
        </button>
        <button
          type="button"
          onClick={onModeIntercity}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2787F5]",
            mode === "intercity" ? "bg-gray-900 text-white" : "text-gray-500"
          )}
        >
          Межгород
        </button>
      </div>

      {isDriver ? (
        <div className="absolute right-4 top-4 z-20 flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-gray-900 shadow-lg">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#4BB34B]" />
          На линии
        </div>
      ) : onOpenProfile ? (
        <button
          type="button"
          onClick={onOpenProfile}
          className={cn(poputi.fab, "absolute right-4 top-4 z-20")}
          aria-label="Профиль"
        >
          <span className="text-xs font-bold text-gray-600">{city.slice(0, 2)}</span>
        </button>
      ) : null}
    </>
  )
}
