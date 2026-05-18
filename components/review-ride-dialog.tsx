"use client"

import { useState } from "react"
import { Star, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
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
  const [rating, setRating] = useState(5)
  const [hover, setHover] = useState<number | null>(null)
  const [comment, setComment] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const displayStars = hover ?? rating

  const handleSubmit = async () => {
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
    setRating(5)
    setHover(null)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-w-md gap-0 overflow-hidden border-0 bg-white p-0 text-[#2C2D2E] shadow-2xl sm:max-w-md">
        <div className="relative bg-gradient-to-r from-[#2787F5] to-[#5BA3FF] px-6 pb-8 pt-6 text-white">
          <DialogClose className="absolute right-4 top-4 rounded-lg p-1 text-white/90 transition-colors hover:bg-white/15 hover:text-white">
            <X className="h-5 w-5" />
            <span className="sr-only">Закрыть</span>
          </DialogClose>
          <DialogHeader className="space-y-1 pr-10 text-left">
            <DialogTitle className="text-xl font-bold text-white">Оценить попутчика</DialogTitle>
            <p className="text-sm text-white/90">
              Поездка с <span className="font-semibold">{targetDisplayName}</span>
            </p>
          </DialogHeader>
        </div>
        <div className="space-y-4 px-6 py-5">
          <div>
            <p className="mb-3 text-sm font-medium text-[#2C2D2E]">Ваша оценка</p>
            <div className="flex justify-center gap-1 sm:justify-start">
              {[1, 2, 3, 4, 5].map((i) => (
                <button
                  key={i}
                  type="button"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => setRating(i)}
                  className="rounded-xl p-1.5 transition-transform hover:scale-110 active:scale-95"
                  aria-label={`${i} из 5`}
                >
                  <Star
                    className={cn(
                      "h-10 w-10 transition-colors duration-150",
                      i <= displayStars ? "fill-[#FFC107] text-[#FFC107] drop-shadow-sm" : "fill-none text-[#D3D9DE]"
                    )}
                    strokeWidth={1.5}
                  />
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-[#2C2D2E]">Комментарий (необязательно)</p>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Как прошла поездка?"
              className="min-h-[96px] resize-none rounded-xl border-[#E1E3E6] bg-[#F7F8FA] text-[#2C2D2E] focus-visible:ring-[#2787F5]"
              maxLength={500}
            />
          </div>
          {error && <p className="text-sm text-[#E64646]">{error}</p>}
        </div>
        <DialogFooter className="border-t border-[#E1E3E6] bg-[#F7F8FA] px-6 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="rounded-xl">
            Отмена
          </Button>
          <Button type="button" className="rounded-xl bg-[#2787F5] hover:bg-[#1F6AD8]" onClick={handleSubmit} disabled={saving}>
            {saving ? "Отправка…" : "Оценить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
