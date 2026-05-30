"use client"

import { useState, useEffect, useCallback } from "react"

const LOCAL_KEY = "poputi_yokassa_access_v1"
const EXPIRES_KEY = "poputi_yokassa_access_expires_v1"

export function useDriverAccess(vkTag: string | null) {
  const [hasAccess, setHasAccess] = useState(false)
  const [loading, setLoading] = useState(true)
  const [expiresAt, setExpiresAt] = useState<Date | null>(null)

  const checkLocal = useCallback(() => {
    if (typeof window === "undefined") return false
    const expires = window.localStorage.getItem(EXPIRES_KEY)
    if (!expires) return false
    const d = new Date(expires)
    if (d.getTime() > Date.now()) {
      setExpiresAt(d)
      return true
    }
    window.localStorage.removeItem(LOCAL_KEY)
    window.localStorage.removeItem(EXPIRES_KEY)
    return false
  }, [])

  const syncFromServer = useCallback(async () => {
    if (!vkTag) {
      setLoading(false)
      return
    }
    try {
      const res = await fetch(`/api/yokassa/check-access?vkTag=${encodeURIComponent(vkTag)}`)
      if (!res.ok) return
      const data = (await res.json()) as { ok: boolean; hasAccess: boolean }
      if (data.hasAccess) {
        grantLocalAccess()
        setHasAccess(true)
      }
    } catch (e) {
      console.error("syncDriverAccess:", e)
    } finally {
      setLoading(false)
    }
  }, [vkTag])

  useEffect(() => {
    if (checkLocal()) {
      setHasAccess(true)
      setLoading(false)
    } else {
      syncFromServer()
    }
  }, [checkLocal, syncFromServer])

  const refresh = useCallback(() => {
    setLoading(true)
    syncFromServer()
  }, [syncFromServer])

  return { hasAccess, loading, expiresAt, refresh }
}

export function grantLocalAccess() {
  if (typeof window === "undefined") return
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000)
  window.localStorage.setItem(LOCAL_KEY, "1")
  window.localStorage.setItem(EXPIRES_KEY, expires.toISOString())
}

export function clearLocalAccess() {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(LOCAL_KEY)
  window.localStorage.removeItem(EXPIRES_KEY)
}
