"use client"

import { useLayoutEffect } from "react"

declare global {
  interface Window {
    eruda?: { init: () => void }
    vkBridgeInitialized?: boolean
    __ERUDA_INITIALIZED__?: boolean
    __VK_INIT_READY__?: boolean
    __VK_INIT_STARTED__?: boolean
    __VK_INIT_PROMISE__?: Promise<boolean>
  }
}

function loadErudaDevTools() {
  if (process.env.NODE_ENV === "production" || window.__ERUDA_INITIALIZED__) return

  const existing = document.querySelector('script[data-poputi-eruda="1"]')
  if (existing) return

  const script = document.createElement("script")
  script.src = "https://cdn.jsdelivr.net/npm/eruda"
  script.async = true
  script.dataset.poputiEruda = "1"
  script.onload = () => {
    if (!window.eruda || window.__ERUDA_INITIALIZED__) return
    window.eruda.init()
    window.__ERUDA_INITIALIZED__ = true
  }
  document.body.appendChild(script)
}

async function startVkInit(): Promise<boolean> {
  if (typeof window === "undefined") {
    return false
  }

  if (window.__VK_INIT_PROMISE__) {
    return window.__VK_INIT_PROMISE__
  }

  window.__VK_INIT_STARTED__ = true
  window.__VK_INIT_PROMISE__ = (async () => {
    const { default: bridge } = await import("@vkontakte/vk-bridge")

    const tryInit = () =>
      bridge
        .send("VKWebAppInit")
        .then(() => true)
        .catch(() => false)

    let ok = await tryInit()
    if (!ok) {
      await new Promise((resolve) => setTimeout(resolve, 500))
      ok = await tryInit()
    }

    window.__VK_INIT_READY__ = ok
    if (ok) window.vkBridgeInitialized = true
    window.dispatchEvent(new Event(ok ? "vk-bridge-ready" : "vk-bridge-failed"))
    return ok
  })()

  return window.__VK_INIT_PROMISE__
}

export function AppBootstrap() {
  useLayoutEffect(() => {
    void startVkInit()
    loadErudaDevTools()
  }, [])

  return null
}
