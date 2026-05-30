"use client"

import React from "react"

export function NavButton({
  icon,
  label,
  isActive,
  onClick,
  badge,
}: {
  icon: React.ReactNode
  label: string
  isActive: boolean
  onClick: () => void
  badge?: number
}) {
  const unread = badge ?? 0

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex min-h-[56px] min-w-16 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 transition-[background-color,color,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] poputi-focus-ring poputi-press ${
        isActive ? "text-[#2787F5]" : "text-[#818C99] hover:text-gray-700"
      }`}
      aria-current={isActive ? "page" : undefined}
      aria-label={label}
    >
      {/* Active pill indicator with subtle glow */}
      <span
        className={`pointer-events-none absolute inset-x-2 inset-y-1 -z-0 rounded-2xl transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isActive
            ? "bg-gradient-to-b from-[#EAF2FF] to-[#DCE9FF] opacity-100 shadow-[0_6px_18px_-8px_rgba(39,135,245,0.45)] ring-1 ring-[#2787F5]/15"
            : "opacity-0"
        }`}
        aria-hidden
      />

      <span
        className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center transition-transform duration-300 ${
          isActive ? "[&>svg]:stroke-[2.4] scale-[1.05]" : ""
        }`}
      >
        {icon}
        {unread > 0 ? (
          <span className="absolute -right-2 -top-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-gradient-to-br from-[#FF5A5F] to-[#E64646] px-1 text-[10px] font-bold leading-none text-white shadow-[0_2px_6px_rgba(230,70,70,0.45)] ring-2 ring-white">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </span>

      <span
        className={`relative z-10 text-[11px] leading-none tracking-tight transition-all duration-300 ${
          isActive ? "font-bold" : "font-semibold"
        }`}
      >
        {label}
      </span>
    </button>
  )
}
