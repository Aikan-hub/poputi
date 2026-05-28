"use client"

import { useCallback, useEffect, useId, useRef, useState } from "react"
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
  const titleId = useId()
  const commentId = useId()
  const panelRef = useRef<HTMLDivElement>(null)

  const close = useCallback(() => onOpenChange(false), [onOpenChange])

  useEffect(() => {
    if (!open) {
      setRating(0)
      setComment("")
      setError(null)
      setSaving(false)
      return
    }
    panelRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, close])

  const handleSubmit = async () => {
    if (rating === 0 || saving) return
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
    close()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 safe-area-bottom">
      <button
        type="button"
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm motion-reduce:backdrop-blur-none"
        aria-label="Закрыть окно оценки"
        onClick={close}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative w-full max-w-sm overscroll-contain rounded-[2rem] bg-white p-6 text-center shadow-2xl outline-none motion-reduce:animate-none animate-in fade-in zoom-in-95 duration-200"
      >
        <button
          type="button"
          onClick={close}
          className="absolute right-4 top-4 rounded-full bg-gray-50 p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2787F5] focus-visible:ring-offset-2"
          aria-label="Закрыть"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>

        <div
          className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#F0F6FF] text-[#2787F5]"
          aria-hidden
        >
          <CheckCircle2 className="h-8 w-8" />
        </div>

        <h2 id={titleId} className="mb-1 text-balance text-2xl font-bold text-gray-900">
          Поездка завершена
        </h2>
        <p className="mb-6 text-pretty text-sm text-gray-500">
          Оцените {targetDisplayName}, чтобы мы знали, как всё прошло
        </p>

        <div
          role="radiogroup"
          aria-label="Оценка поездки"
          className="mb-6 flex justify-center gap-1"
        >
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              role="radio"
              aria-checked={rating === star}
              onClick={() => setRating(star)}
              className={cn(
                "rounded-lg p-1.5 transition-[color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2787F5] focus-visible:ring-offset-2 motion-reduce:active:scale-100 active:scale-90",
                rating >= star ? "text-amber-400" : "text-gray-200"
              )}
              aria-label={`${star} из 5`}
            >
              <Star size={36} fill="currentColor" aria-hidden />
            </button>
          ))}
        </div>

        <label htmlFor={commentId} className="sr-only">
          Комментарий к оценке
        </label>
        <textarea
          id={commentId}
          name="review_comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Напишите пару слов…"
          autoComplete="off"
          spellCheck
          className="mb-4 h-24 w-full resize-none rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm transition-[background-color,box-shadow] focus:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2787F5]"
          maxLength={500}
        />

        {error ? (
          <p className="mb-3 text-sm text-red-600" role="alert" aria-live="polite">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={rating === 0 || saving}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2787F5] py-4 font-semibold text-white shadow-lg shadow-[#2787F5]/25 transition-[background-color,transform,opacity] hover:bg-[#1F6AD8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2787F5] focus-visible:ring-offset-2 disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none motion-reduce:active:scale-100 active:scale-[0.98]"
        >
          <Send className="h-[18px] w-[18px]" aria-hidden />
          {saving ? "Отправка…" : "Отправить оценку"}
        </button>
      </div>
    </div>
  )
}
