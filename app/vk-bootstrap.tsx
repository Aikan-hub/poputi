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

/**
 * iOS VK WebView: запрещаем bounce scroll на document, если скроллить некуда.
 * Внутренние scrollable-контейнеры (app-scrollbar) работают штатно.
 */
function patchIosBounceScroll() {
  if (typeof document === "undefined") return

  document.addEventListener(
    "touchmove",
    (e) => {
      // Разрешаем скролл внутри элементов с overflow: auto/scroll
      let el = e.target as HTMLElement | null
      while (el && el !== document.body) {
        const style = window.getComputedStyle(el)
        const oy = style.overflowY
        if ((oy === "auto" || oy === "scroll") && el.scrollHeight > el.clientHeight) {
          return // внутренний скроллер — не трогаем
        }
        el = el.parentElement
      }
      // Если дошли до body — блокируем (это bounce)
      e.preventDefault()
    },
    { passive: false }
  )
}

/** Блокируем pinch-zoom (iOS игнорирует user-scalable=no с iOS 10+) */
function patchPinchZoom() {
  if (typeof document === "undefined") return

  document.addEventListener(
    "gesturestart",
    (e) => e.preventDefault(),
    { passive: false }
  )
  document.addEventListener(
    "gesturechange",
    (e) => e.preventDefault(),
    { passive: false }
  )
  document.addEventListener(
    "gestureend",
    (e) => e.preventDefault(),
    { passive: false }
  )

  // Блокируем multi-touch zoom
  document.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length > 1) e.preventDefault()
    },
    { passive: false }
  )
}

export function AppBootstrap() {
  useLayoutEffect(() => {
    void startVkInit()
    patchIosBounceScroll()
    patchPinchZoom()
    loadErudaDevTools()
  }, [])

  return null
}
