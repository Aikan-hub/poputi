"use client"

import { useLayoutEffect } from "react"
import bridge from "@vkontakte/vk-bridge"

declare global {
  interface Window {
    eruda?: { init: () => void }
    __ERUDA_INITIALIZED__?: boolean
    __VK_INIT_READY__?: boolean
    __VK_INIT_STARTED__?: boolean
    __VK_INIT_PROMISE__?: Promise<boolean>
  }
}

function startVkInit(): Promise<boolean> {
  if (typeof window === "undefined") {
    return Promise.resolve(false)
  }

  if (window.__VK_INIT_PROMISE__) {
    return window.__VK_INIT_PROMISE__
  }

  window.__VK_INIT_STARTED__ = true
  window.__VK_INIT_PROMISE__ = bridge.send("VKWebAppInit")
    .then(() => true)
    .catch(() => {
      return new Promise<boolean>((resolve) => {
        setTimeout(() => {
          bridge.send("VKWebAppInit")
            .then(() => resolve(true))
            .catch(() => resolve(false))
        }, 500)
      })
    })
    .then((ok) => {
      window.__VK_INIT_READY__ = ok
      window.dispatchEvent(new Event(ok ? "vk-bridge-ready" : "vk-bridge-failed"))
      return ok
    })

  return window.__VK_INIT_PROMISE__
}

// Start as early as possible (module evaluation on client).
void startVkInit()

export function AppBootstrap() {
  useLayoutEffect(() => {
    void startVkInit()

    if (!window.eruda || window.__ERUDA_INITIALIZED__) return
    window.eruda.init()
    window.__ERUDA_INITIALIZED__ = true
  }, [])

  return null
}
