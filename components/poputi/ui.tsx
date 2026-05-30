"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** Premium 21st.dev-style design tokens */
export const poputi = {
  brand: "text-[#2787F5]",
  brandBg: "bg-[#2787F5]",
  brandBgHover: "hover:bg-[#1F6AD8]",
  brandMuted: "bg-[#F0F6FF]",
  brandMutedText: "text-[#2787F5]",
  ink: "text-gray-900",
  muted: "text-gray-500",
  surface: "bg-gradient-to-b from-[#F4F7FB] to-[#EEF2F8]",
  sheet:
    "rounded-t-[2rem] bg-white/95 backdrop-blur-xl shadow-[0_-16px_48px_-12px_rgba(15,23,42,0.18)] border border-white/60",
  input:
    "rounded-2xl border border-gray-100 bg-gray-50/90 px-3.5 py-3.5 text-sm font-medium text-gray-800 placeholder:text-gray-400 transition-[border-color,background-color,box-shadow] focus:border-[#2787F5]/40 focus:bg-white focus:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2787F5]/25",
  btnPrimary:
    "w-full rounded-2xl poputi-grad-primary py-4 text-base font-bold tracking-tight text-white shadow-[0_12px_28px_-8px_rgba(39,135,245,0.55)] transition-[background-color,transform,box-shadow] hover:shadow-[0_16px_36px_-8px_rgba(39,135,245,0.65)] motion-reduce:active:scale-100 active:scale-[0.98] disabled:bg-none disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2787F5] focus-visible:ring-offset-2",
  btnDark:
    "rounded-2xl bg-gradient-to-b from-gray-900 to-gray-800 py-3 text-sm font-bold text-white shadow-[0_8px_20px_-6px_rgba(15,23,42,0.5)] transition-[background-color,transform,box-shadow] hover:from-gray-800 hover:to-gray-700 motion-reduce:active:scale-100 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2",
  btnGhost:
    "rounded-2xl border border-gray-100 bg-white py-3 text-sm font-semibold text-gray-700 shadow-sm transition-[background-color,border-color,box-shadow,transform] hover:border-gray-200 hover:bg-gray-50 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-300 focus-visible:ring-offset-2",
  fab: "flex h-12 w-12 items-center justify-center rounded-full poputi-glass text-gray-800 shadow-[0_8px_22px_-8px_rgba(15,23,42,0.35)] transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2787F5] focus-visible:ring-offset-2 motion-reduce:active:scale-100 active:scale-95",
  overlay: "absolute inset-0 z-20 bg-gray-900/45 backdrop-blur-sm",
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
          className="absolute inset-0 bg-gray-900/45 backdrop-blur-sm motion-reduce:backdrop-blur-none animate-in fade-in duration-200"
          aria-label="Закрыть"
          onClick={onClose}
        />
      ) : (
        <div className="absolute inset-0 bg-gray-900/45 backdrop-blur-sm" aria-hidden />
      )}
      <div
        className={cn(
          "relative w-full overflow-hidden overscroll-contain p-6 motion-reduce:animate-none animate-in slide-in-from-bottom-4 fade-in duration-300",
          poputi.sheet,
          className
        )}
        style={{ maxHeight }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-gray-300/80" />
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
  const fieldClass = cn(poputi.input, "py-2.5 text-sm font-medium")

  return (
    <div className="relative">
      <div
        className="pointer-events-none absolute left-2.5 top-5 bottom-5 w-0.5 -translate-x-1/2 rounded-full bg-gradient-to-b from-gray-300 via-gray-200 to-[#2787F5]"
        aria-hidden
      />
      <div className="space-y-2">
        <div className="flex items-stretch gap-2.5">
          <div className="flex w-5 shrink-0 justify-center self-center">
            <span
              className="box-border h-2.5 w-2.5 shrink-0 rounded-full border-2 border-gray-800 bg-white shadow-sm"
              aria-hidden
            />
          </div>
          <input
            type="text"
            name="route_from"
            autoComplete="off"
            value={from}
            onChange={(e) => onFromChange(e.target.value)}
            placeholder={fromPlaceholder}
            aria-label={fromPlaceholder}
            className={cn(fieldClass, "min-w-0 flex-1")}
          />
        </div>
        <div className="flex items-stretch gap-2.5">
          <div className="flex w-5 shrink-0 justify-center self-center">
            <span
              className="box-border h-2.5 w-2.5 shrink-0 rounded-full border-2 border-[#2787F5] bg-[#2787F5] shadow-sm"
              aria-hidden
            />
          </div>
          <div className="relative min-w-0 flex-1">
            <input
              type="text"
              name="route_to"
              autoComplete="off"
              value={to}
              onChange={(e) => onToChange(e.target.value)}
              placeholder={toPlaceholder}
              aria-label={toPlaceholder}
              className={cn(fieldClass, "w-full pr-9")}
            />
            {toExtra}
          </div>
        </div>
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

      <div className="absolute left-1/2 top-4 z-20 flex -translate-x-1/2 rounded-full poputi-glass p-1 shadow-[0_10px_28px_-10px_rgba(15,23,42,0.35)]">
        <button
          type="button"
          onClick={onModeCity}
          className={cn(
            "relative rounded-full px-4 py-1.5 text-xs font-bold tracking-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2787F5]",
            mode === "city"
              ? "bg-gradient-to-b from-gray-900 to-gray-800 text-white shadow-[0_6px_14px_-6px_rgba(15,23,42,0.55)]"
              : "text-gray-600 hover:text-gray-900"
          )}
        >
          Город
        </button>
        <button
          type="button"
          onClick={onModeIntercity}
          className={cn(
            "relative rounded-full px-4 py-1.5 text-xs font-bold tracking-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2787F5]",
            mode === "intercity"
              ? "bg-gradient-to-b from-gray-900 to-gray-800 text-white shadow-[0_6px_14px_-6px_rgba(15,23,42,0.55)]"
              : "text-gray-600 hover:text-gray-900"
          )}
        >
          Межгород
        </button>
      </div>

      {isDriver ? (
        <div className="absolute right-4 top-4 z-20 flex items-center gap-2 rounded-full poputi-glass px-4 py-2 text-sm font-bold text-gray-900 shadow-[0_10px_28px_-10px_rgba(15,23,42,0.35)]">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#4BB34B] opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#4BB34B]" />
          </span>
          На линии
        </div>
      ) : onOpenProfile ? (
        <button
          type="button"
          onClick={onOpenProfile}
          className={cn(poputi.fab, "absolute right-4 top-4 z-20")}
          aria-label="Профиль"
        >
          <span className="text-xs font-bold text-gray-700">{city.slice(0, 2)}</span>
        </button>
      ) : null}
    </>
  )
}
