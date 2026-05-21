"use client"

import { useState, useEffect } from "react"

const _avatarB64Cache: Record<string, string> = {}
const _avatarLoadingUrls: Record<string, boolean> = {}

export function loadAvatarAsBase64(url: string, onDone: (b64: string) => void) {
  if (_avatarB64Cache[url]) { onDone(_avatarB64Cache[url]); return }
  if (_avatarLoadingUrls[url]) return
  _avatarLoadingUrls[url] = true
  const img = new Image()
  img.crossOrigin = "anonymous"
  img.onload = () => {
    const c = document.createElement("canvas")
    c.width = 56; c.height = 56
    const ctx = c.getContext("2d")
    if (ctx) {
      ctx.drawImage(img, 0, 0, 56, 56)
      try {
        const b64 = c.toDataURL("image/png")
        _avatarB64Cache[url] = b64
        onDone(b64)
      } catch { /* tainted canvas, CORS blocked */ }
    }
    delete _avatarLoadingUrls[url]
  }
  img.onerror = () => { delete _avatarLoadingUrls[url] }
  img.src = url
}

export function useAvatarBase64(url: string | null): string | null {
  const [b64, setB64] = useState<string | null>(() =>
    url ? _avatarB64Cache[url] ?? null : null
  )
  useEffect(() => {
    if (!url) { setB64(null); return }
    if (_avatarB64Cache[url]) { setB64(_avatarB64Cache[url]); return }
    loadAvatarAsBase64(url, setB64)
  }, [url])
  return b64
}
