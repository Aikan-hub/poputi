"use client"

import dynamic from "next/dynamic"

const AppBootstrap = dynamic(() => import("./vk-bootstrap").then((mod) => mod.AppBootstrap), {
  ssr: false,
})

export function AppBootstrapLoader() {
  return <AppBootstrap />
}
