"use client"

import { useEffect, useState, useMemo } from "react"
import { Placemark } from "@pbe/react-yandex-maps"
import { isPersistentRideType } from "@/lib/rides"
import type { DriverData } from "./types"
import { useAvatarBase64 } from "./avatar-cache"

export function DriverPlacemark({
  driver,
  isPersistent,
  createdAt,
  rideType,
  locked,
  onClick,
}: {
  driver: DriverData
  isPersistent?: boolean
  createdAt: string
  rideType: string | null | undefined
  locked?: boolean
  onClick: () => void
}) {
  const [, setTick] = useState(0)
  const avatarUrl =
    (driver.driverPhotoUrl && driver.driverPhotoUrl.startsWith("http") && driver.driverPhotoUrl) ||
    (driver.activeRide?.avatar && driver.activeRide.avatar.startsWith("http") ? driver.activeRide.avatar : null)

  const avatarBase64 = useAvatarBase64(avatarUrl)

  const createdMs = new Date(createdAt).getTime()
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 10000)
    return () => clearInterval(interval)
  }, [])

  const elapsedMin = Math.max(0, Math.floor((Date.now() - createdMs) / 60000))
  const isEarlyPulse = elapsedMin < 10

  if (!isPersistent && driver.timer <= 0) {
    return null
  }

  const progress = isPersistent ? 100 : (driver.timer / 180) * 100
  const circumference = 2 * Math.PI * 24
  const dashOffset = circumference * (1 - progress / 100)

  const ringColor = (() => {
    const percent = driver.timer / 180
    if (percent > 0.66) return "#4BB34B"
    if (percent > 0.33) return "#FFA000"
    return "#E64646"
  })()

  const hasAvatar = Boolean(avatarBase64)
  const coreFill = hasAvatar ? `url(#avatar-${driver.id})` : "#4BB34B"

  const label = String(driver.avatar || "?")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .slice(0, 3)

  const rt = (rideType || "").trim()
  const isDriverType = rt === "Driver"
  const isPassengerType = rt === "Passenger" || rt === "City" || !rt
  const badgeColor = isDriverType ? "#4BB34B" : "#2787F5"
  const showBadge = isDriverType || isPassengerType

  const CY = 38
  const BY = 10

  const placemarkOptions = useMemo(() => {
    const badgeSvg = showBadge
      ? `<circle cx="28" cy="${BY}" r="9" fill="${badgeColor}" stroke="white" stroke-width="1.5"/>
         ${
           isDriverType
             ? `<path d="M22 ${BY + 3} L22 ${BY} L24 ${BY - 4} L32 ${BY - 4} L34 ${BY} L34 ${BY + 3} Z" fill="white"/>
                <circle cx="24.5" cy="${BY + 3}" r="1.3" fill="${badgeColor}"/>
                <circle cx="31.5" cy="${BY + 3}" r="1.3" fill="${badgeColor}"/>`
             : `<path d="M28 ${BY - 2} C28 ${BY - 5} 23 ${BY - 5} 23 ${BY - 1} C23 ${BY + 2} 28 ${BY + 5} 28 ${BY + 5} C28 ${BY + 5} 33 ${BY + 2} 33 ${BY - 1} C33 ${BY - 5} 28 ${BY - 5} 28 ${BY - 2}Z" fill="white"/>`
         }`
      : ""

    const svgIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" width="56" height="66" viewBox="0 0 56 66"${locked ? ' opacity="0.35"' : ""}>
      ${
        hasAvatar
          ? `<defs>
              <clipPath id="clip-${driver.id}"><circle cx="28" cy="${CY}" r="18"/></clipPath>
            </defs>`
          : ""
      }
      <circle cx="28" cy="${CY}" r="24" fill="none" stroke="#E1E3E6" stroke-width="3"/>
      <g transform="translate(56, 0) scale(-1, 1)">
        <circle cx="28" cy="${CY}" r="24" fill="none" stroke="${ringColor}" stroke-width="3"
          stroke-linecap="round" stroke-dasharray="${circumference}"
          stroke-dashoffset="${dashOffset}"
          transform="rotate(-90 28 ${CY})"/>
      </g>
      ${
        hasAvatar
          ? `<circle cx="28" cy="${CY}" r="18" fill="#ddd"/>
             <image href="${avatarBase64}" x="10" y="${CY - 18}" width="36" height="36" clip-path="url(#clip-${driver.id})" preserveAspectRatio="xMidYMid slice"/>`
          : `<circle cx="28" cy="${CY}" r="18" fill="${coreFill}"/>
             <text x="28" y="${CY + 5}" text-anchor="middle" fill="white" font-size="10" font-weight="bold" font-family="Arial">${label}</text>`
      }
      ${badgeSvg}
      ${
        isEarlyPulse
          ? `<circle cx="28" cy="${CY}" r="26" fill="none" stroke="${ringColor}" stroke-width="2" opacity="0.35">
               <animate attributeName="r" values="24;34;24" dur="1.6s" repeatCount="indefinite" />
               <animate attributeName="opacity" values="0.35;0.08;0.35" dur="1.6s" repeatCount="indefinite" />
             </circle>`
          : ""
      }
    </svg>
  `
    return {
      iconLayout: "default#image",
      iconImageHref: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgIcon)}`,
      iconImageSize: [56, 66] as [number, number],
      iconImageOffset: [-28, -62] as [number, number],
    }
  }, [
    driver.id,
    driver.avatar,
    driver.timer,
    avatarBase64,
    hasAvatar,
    elapsedMin,
    isEarlyPulse,
    ringColor,
    dashOffset,
    circumference,
    coreFill,
    label,
    isPersistent,
    showBadge,
    badgeColor,
    isDriverType,
    locked,
  ])

  return (
    <Placemark geometry={driver.coords} options={placemarkOptions} onClick={locked ? undefined : onClick} />
  )
}
