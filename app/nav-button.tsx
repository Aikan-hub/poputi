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
      className={`relative flex min-h-[52px] min-w-16 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 transition-all duration-200 active:scale-[0.97] ${
        isActive ? "bg-[#F0F6FF] text-[#2787F5]" : "text-[#818C99] active:bg-gray-100"
      }`}
      aria-current={isActive ? "page" : undefined}
    >
      <span className={`relative flex h-6 w-6 shrink-0 items-center justify-center ${isActive ? "[&>svg]:stroke-[2.4]" : ""}`}>
        {icon}
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#E64646] px-0.5 text-[10px] font-semibold leading-none text-white ring-2 ring-white">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </span>
      <span className={`text-xs leading-none ${isActive ? "font-semibold" : "font-medium"}`}>{label}</span>
    </button>
  )
}
