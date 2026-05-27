"use client"

import { useState } from "react"
import { CheckCircle2, Send, Star, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase-client"
import { buildReviewChatMessage, submitRideReview } from "@/lib/review-actions"

export function ReviewRideDialog({
  open,
  onOpenChange,
  rideId,
  reviewerVkId,
  targetVkId,
  targetDisplayName,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  rideId: number
  reviewerVkId: string
  targetVkId: string
  targetDisplayName: string
  onSuccess: (chatMessage: string) => void
}) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const handleSubmit = async () => {
    if (rating === 0) return
    setSaving(true)
    setError(null)
    const res = await submitRideReview({
      supabase,
      rideId,
      reviewerVkId,
      targetVkId,
      rating,
      comment,
    })
    setSaving(false)
    if (!res.ok) {
      setError(res.message)
      return
    }
    const msg = buildReviewChatMessage(rating, comment)
    onSuccess(msg)
    onOpenChange(false)
    setComment("")
    setRating(0)
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => onOpenChange(false)} />
      <div className="relative w-full max-w-sm rounded-[2rem] bg-white p-6 text-center shadow-2xl">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 rounded-full bg-gray-50 p-2 text-gray-400 transition-colors hover:text-gray-600"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#F0F6FF] text-[#2787F5]">
          <CheckCircle2 className="h-8 w-8" />
        </div>

        <h2 className="mb-1 text-2xl font-bold text-gray-900">Поездка завершена</h2>
        <p className="mb-6 text-sm text-gray-500">
          Оцените {targetDisplayName}, чтобы мы знали, как всё прошло
        </p>

        <div className="mb-6 flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              className={cn("p-1 transition-transform active:scale-75", rating >= star ? "text-yellow-400" : "text-gray-200")}
              aria-label={`${star} из 5`}
            >
              <Star size={36} fill="currentColor" />
            </button>
          ))}
        </div>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Напишите пару слов..."
          className="mb-4 h-24 w-full resize-none rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2787F5]"
          maxLength={500}
        />

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={rating === 0 || saving}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 py-4 font-semibold text-white transition-all hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400"
        >
          <Send className="h-[18px] w-[18px]" />
          {saving ? "Отправка…" : "Отправить"}
        </button>
      </div>
    </div>
  )
}
