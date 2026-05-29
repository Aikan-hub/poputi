"use client"

import { useRouter } from "next/navigation"
import { AdminPanel } from "@/components/admin-panel"

export default function AdminPage() {
  const router = useRouter()

  return (
    <AdminPanel
      variant="page"
      onBackToMap={() => {
        router.push("/")
      }}
    />
  )
}
