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
      className={`relative flex min-h-[48px] min-w-[56px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 transition-colors duration-200 poputi-focus-ring active:scale-[0.95] ${
        isActive ? "text-[#2787F5]" : "text-gray-400 active:text-gray-600"
      }`}
      aria-current={isActive ? "page" : undefined}
      aria-label={label}
    >
      <span className="relative flex h-6 w-6 shrink-0 items-center justify-center">
        {icon}
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#FF3B30] px-0.5 text-[9px] font-bold leading-none text-white ring-2 ring-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </span>
      <span className={`text-[10px] leading-none ${isActive ? "font-bold" : "font-medium"}`}>
        {label}
      </span>
      {/* Active dot indicator */}
      {isActive && (
        <span className="absolute -bottom-0.5 h-1 w-1 rounded-full bg-[#2787F5]" aria-hidden />
      )}
    </button>
  )
}
