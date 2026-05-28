"use client"

import { useState, useCallback, useEffect } from "react"
import { ReviewRideDialog } from "@/components/review-ride-dialog"
import { supabase } from "@/lib/supabase-client"
import { type AppCity } from "@/lib/cities"
import { type SupabaseRide, type VkUserProfile } from "./types"
import {
  vkIdTagFromNumericId,
  rideTypeLabelRu,
  resolveReviewTargetVk,
  targetDisplayLabelForReview,
} from "./helpers"

export function RideHistoryModal({
  open,
  onClose,
  vkUser,
  historyCity,
  appendReviewChatMessage,
  onProfileStatsReload,
}: {
  open: boolean
  onClose: () => void
  vkUser: VkUserProfile | null
  historyCity: AppCity
  appendReviewChatMessage: (targetVkTag: string, targetDisplayName: string, message: string) => void | Promise<void>
  onProfileStatsReload: () => void
}) {
  const [rows, setRows] = useState<SupabaseRide[]>([])
  const [reviewedRideIds, setReviewedRideIds] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewRide, setReviewRide] = useState<SupabaseRide | null>(null)

  const reload = useCallback(async () => {
    if (!vkUser) {
      setRows([])
      setReviewedRideIds(new Set())
      setLoading(false)
      setError("Войдите через VK Mini App, чтобы увидеть свои заявки.")
      return
    }
    const tag = vkIdTagFromNumericId(vkUser.id)
    setLoading(true)
    setError(null)

    const [revRes, ridesRes] = await Promise.all([
      supabase.from("reviews").select("ride_id").eq("reviewer_vk_id", tag),
      supabase
        .from("rides")
        .select("*")
        .eq("city", historyCity)
        .or(`vk_id.eq.${tag},partner_vk_id.eq.${tag}`)
        .order("created_at", { ascending: false }),
    ])

    if (!revRes.error && revRes.data) {
      setReviewedRideIds(new Set(revRes.data.map((r: { ride_id: number }) => r.ride_id)))
    } else {
      setReviewedRideIds(new Set())
    }

    if (ridesRes.error) {
      const fb = await supabase
        .from("rides")
        .select("*")
        .eq("vk_id", tag)
        .eq("city", historyCity)
        .order("created_at", { ascending: false })
      setLoading(false)
      if (fb.error) {
        setError("Не удалось загрузить заявки.")
        setRows([])
        return
      }
      setRows((fb.data as SupabaseRide[]) ?? [])
      setError(null)
      return
    }

    setLoading(false)
    setRows((ridesRes.data as SupabaseRide[]) ?? [])
    setError(null)
  }, [vkUser, historyCity])

  useEffect(() => {
    if (!open) return
    void reload()
  }, [open, reload])

  if (!open) return null

  const myTag = vkUser ? vkIdTagFromNumericId(vkUser.id) : ""

  return (
    <>
      <div className="fixed inset-0 z-[60] flex items-end justify-center safe-area-bottom">
        <button
          type="button"
          className="absolute inset-0 bg-black/50"
          aria-label="Закрыть историю"
          onClick={onClose}
        />
      <div
        className="relative flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden overscroll-contain rounded-t-2xl bg-white motion-reduce:animate-none animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ride-history-title"
      >
        <div className="shrink-0 border-b border-gray-100 px-6 py-4">
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-gray-200" />
          <div className="flex items-center justify-between gap-2">
            <h2 id="ride-history-title" className="text-lg font-bold text-gray-900">
              История заявок
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="poputi-focus-ring rounded-lg px-2 py-1 text-sm font-medium text-[#2787F5] hover:bg-gray-50"
            >
              Закрыть
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {loading && <p className="text-center text-sm text-gray-400">Загрузка…</p>}
          {error && !loading ? (
            <p className="text-center text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
          {!loading && !error && rows.length === 0 && (
            <p className="text-center text-sm text-gray-500">Пока нет сохранённых заявок с этим профилем VK.</p>
          )}
          {!loading && !error && rows.length > 0 && (
            <ul className="space-y-3">
              {rows.map((r) => {
                const from = r.from_location || "—"
                const to = r.to_location || "—"
                const dateStr = new Date(r.created_at).toLocaleString("ru-RU", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
                const targetVk = myTag ? resolveReviewTargetVk(r, myTag) : null
                const canReview = Boolean(targetVk && !reviewedRideIds.has(r.id))
                return (
                  <li
                    key={r.id}
                    className="rounded-2xl border border-gray-100 bg-gray-50 p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-900">
                          {from}
                          <span className="mx-1.5 text-gray-400">→</span>
                          {to}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">{dateStr}</p>
                      </div>
                      <span className="shrink-0 text-lg font-bold text-gray-900">
                        {r.price != null ? `${r.price} ₽` : "—"}
                      </span>
                    </div>
                    <p className="mt-2 text-xs font-medium text-gray-500">
                      Тип: <span className="text-gray-900">{rideTypeLabelRu(r.type)}</span>
                    </p>
                    {canReview && targetVk && (
                      <button
                        type="button"
                        onClick={() => {
                          setReviewRide(r)
                          setReviewOpen(true)
                        }}
                        className="mt-3 w-full rounded-xl bg-[#2787F5] py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#2787F5]/30 transition-[background-color,transform] hover:bg-[#1F6AD8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2787F5] focus-visible:ring-offset-2 motion-reduce:active:scale-100 active:scale-[0.98]"
                      >
                        Завершить поездку / Оценить попутчика
                      </button>
                    )}
                    {!canReview && targetVk && reviewedRideIds.has(r.id) && (
                      <p className="mt-2 text-center text-xs text-gray-500">Оценка уже оставлена</p>
                    )}
                    {!targetVk && myTag && (
                      <p className="mt-2 text-xs text-gray-500">
                        Чтобы оценить попутчика, в заявке должен быть указан второй участник (поле partner_vk_id в базе).
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
      {reviewRide && vkUser && resolveReviewTargetVk(reviewRide, myTag) && (
        <ReviewRideDialog
          open={reviewOpen}
          onOpenChange={(v) => {
            setReviewOpen(v)
            if (!v) setReviewRide(null)
          }}
          rideId={reviewRide.id}
          reviewerVkId={myTag}
          targetVkId={resolveReviewTargetVk(reviewRide, myTag)!}
          targetDisplayName={targetDisplayLabelForReview(reviewRide, myTag)}
          onSuccess={(msg) => {
            const tVk = resolveReviewTargetVk(reviewRide, myTag)
            if (!tVk) return
            void (async () => {
              await appendReviewChatMessage(tVk, targetDisplayLabelForReview(reviewRide, myTag), msg)
              onProfileStatsReload()
              setReviewedRideIds((prev) => new Set(prev).add(reviewRide.id))
              void reload()
            })()
          }}
        />
      )}
    </>
  )
}
