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
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex min-w-20 flex-col items-center gap-1 rounded-xl px-3 py-1.5 transition-all duration-200 active:scale-[0.97] ${
        isActive ? "bg-[#F0F6FF] text-[#2787F5]" : "text-[#818C99] active:bg-[#F2F3F5]"
      }`}
      aria-current={isActive ? "page" : undefined}
    >
      <span className={isActive ? "[&>svg]:stroke-[2.4]" : ""}>{icon}</span>
      <span className={`text-xs ${isActive ? "font-semibold" : "font-medium"}`}>{label}</span>
      {badge && badge > 0 && (
        <span className="absolute right-3 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#E64646] px-1 text-xs font-semibold text-white shadow-sm ring-2 ring-white">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  )
}
