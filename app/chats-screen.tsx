"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { Car, ChevronLeft, MessageCircle, Send, Star, Trash2, UserRound } from "lucide-react"

import { cn } from "@/lib/utils"
import { poputi } from "@/components/poputi/ui"
import { appendThreadMessage, fetchThreadMessages } from "@/lib/chats-db"
import { supabase } from "@/lib/supabase-client"
import type { ChatData, ChatMessageMetadata, RideOfferMetadata, VkUserProfile } from "./types"
import { vkIdTagFromNumericId } from "./helpers"

type ChatMsg = { id: number; text: string; isMe: boolean; metadata: ChatMessageMetadata; pending?: boolean }

export function ChatsScreen({
  selectedChat,
  setSelectedChat,
  chats,
  chatsLoading,
  vkUser,
  onOpenProfile,
  onDeleteChat,
  onMessagesChanged,
  onOfferAction,
}: {
  selectedChat: ChatData | null
  setSelectedChat: (chat: ChatData | null) => void
  chats: ChatData[]
  chatsLoading: boolean
  vkUser: VkUserProfile | null
  onOpenProfile: (profile: ChatData) => void
  onDeleteChat: (threadId: string) => void | Promise<void>
  onMessagesChanged: () => void | Promise<void>
  onOfferAction: (offerId: number, action: "accept" | "reject") => Promise<boolean>
}) {
  if (selectedChat && vkUser) {
    return (
      <ChatView
        chat={selectedChat}
        myVkTag={vkIdTagFromNumericId(vkUser.id)}
        onBack={() => setSelectedChat(null)}
        onOpenProfile={() => onOpenProfile(selectedChat)}
        onMessagesChanged={onMessagesChanged}
        onOfferAction={onOfferAction}
      />
    )
  }

  if (selectedChat && !vkUser) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-white p-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#F0F6FF] text-[#2787F5]">
          <MessageCircle className="h-7 w-7" />
        </div>
        <p className="mt-4 text-sm leading-relaxed text-gray-500">Войдите через VK, чтобы пользоваться чатами.</p>
        <button
          type="button"
          className="poputi-btn-motion poputi-focus-ring mt-4 rounded-xl bg-[#F0F6FF] px-4 py-2 text-sm font-semibold text-[#2787F5] hover:bg-[#E3EFFF]"
          onClick={() => setSelectedChat(null)}
        >
          Назад к списку
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-[#F4F7FB] to-[#EEF2F8]">
      <header className="border-b border-gray-200/60 bg-white/80 px-5 py-3 backdrop-blur-xl">
        <h1 className="text-lg font-bold leading-tight tracking-tight text-gray-950">Чаты</h1>
        <p className="mt-0.5 text-[11px] font-medium text-gray-500">Диалоги по поездкам</p>
      </header>

      <div className="app-scrollbar min-h-0 flex-1 overflow-y-auto p-3 space-y-2">
        {chatsLoading && (
          <div className="space-y-2" aria-label="Загрузка чатов" role="status">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                style={{ opacity: 1 - i * 0.25 }}
              >
                <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-gray-100">
                  <span className="poputi-shimmer absolute inset-0" />
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="relative h-3 w-2/5 overflow-hidden rounded-full bg-gray-100">
                    <span className="poputi-shimmer absolute inset-0" />
                  </div>
                  <div className="relative h-2.5 w-4/5 overflow-hidden rounded-full bg-gray-50">
                    <span className="poputi-shimmer absolute inset-0" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {!chatsLoading && !vkUser && (
          <div className="rounded-2xl bg-white px-4 py-12 text-center">
            <UserRound className="mx-auto h-9 w-9 text-gray-300" />
            <p className="mt-3 text-sm text-gray-500">Войдите через VK Mini App, чтобы видеть свои диалоги.</p>
          </div>
        )}
        {!chatsLoading && vkUser && chats.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="flex justify-center items-center gap-2 text-sm text-gray-400 font-medium">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#2787F5] opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#2787F5]" />
              </span>
              Ищем варианты…
            </div>
            <p className="mt-3 text-sm text-gray-500 text-center px-8">
              Диалоги появятся после бронирования поездки.
            </p>
          </div>
        )}
        {!chatsLoading &&
          vkUser &&
          chats.map((chat) => (
            <div
              key={chat.id}
              className="poputi-card poputi-press relative flex items-center rounded-2xl"
            >
              <button
                type="button"
                onClick={() => setSelectedChat(chat)}
                className="poputi-focus-ring flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-3 pr-1 text-left"
              >
                <div className="relative shrink-0">
                  {chat.avatarUrl ? (
                    <img
                      src={chat.avatarUrl}
                      alt=""
                      width={44}
                      height={44}
                      className="h-11 w-11 rounded-full object-cover bg-gray-100 ring-2 ring-white shadow-[0_4px_10px_-4px_rgba(15,23,42,0.3)]"
                    />
                  ) : (
                    <div className="flex h-11 w-11 items-center justify-center rounded-full poputi-grad-primary text-sm font-bold text-white ring-2 ring-white shadow-[0_4px_10px_-4px_rgba(39,135,245,0.5)]">
                      {chat.avatar}
                    </div>
                  )}
                  {chat.unread > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#2787F5] px-0.5 text-[9px] font-bold text-white ring-2 ring-white">
                      {chat.unread}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="truncate text-sm font-bold tracking-tight text-gray-900">{chat.name}</h3>
                    <span className="shrink-0 text-[11px] font-medium text-gray-400">{chat.time}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    {chat.rating > 0 && (
                      <span className="flex shrink-0 items-center gap-0.5 text-[11px] font-semibold text-amber-500">
                        <Star size={10} fill="currentColor" aria-hidden /> {chat.rating.toFixed(1)}
                      </span>
                    )}
                    <p className="truncate text-[13px] text-gray-500">{chat.lastMessage || "Нет сообщений"}</p>
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Удалить чат с «${chat.name}»? Сообщения будут удалены.`)) {
                    void onDeleteChat(chat.threadId)
                  }
                }}
                className="poputi-focus-ring mr-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500 active:bg-red-50 active:text-red-500"
                aria-label={`Удалить чат с ${chat.name}`}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </div>
          ))}
      </div>
    </div>
  )
}

function ChatView({
  chat,
  myVkTag,
  onBack,
  onOpenProfile,
  onMessagesChanged,
  onOfferAction,
}: {
  chat: ChatData
  myVkTag: string
  onBack: () => void
  onOpenProfile: () => void
  onMessagesChanged: () => void | Promise<void>
  onOfferAction: (offerId: number, action: "accept" | "reject") => Promise<boolean>
}) {
  const [message, setMessage] = useState("")
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const localIdCounter = useRef(-1)

  const threadId = chat.threadId

  // Initial load
  const loadMessages = useCallback(async () => {
    const rows = await fetchThreadMessages(supabase, threadId)
    setMessages(
      rows.map((m) => ({
        id: m.id,
        text: m.body,
        isMe: m.sender_vk_id.trim() === myVkTag,
        metadata: normalizeMessageMetadata(m.metadata),
      }))
    )
    setLoading(false)
  }, [threadId, myVkTag])

  useEffect(() => {
    setLoading(true)
    void loadMessages()
  }, [loadMessages])

  // Auto-scroll on new messages
  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return
    // Only auto-scroll if user is near bottom (within 120px)
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120
    if (isNearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages])

  // ===== REALTIME: подписка на INSERT в chat_messages =====
  // Вместо полного refetch — добавляем только новое сообщение
  useEffect(() => {
    const channel = supabase
      .channel(`chat_rt_${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          const row = payload.new as {
            id: number
            sender_vk_id: string
            body: string
            metadata?: unknown
          }
          const newMsg: ChatMsg = {
            id: row.id,
            text: row.body,
            isMe: (row.sender_vk_id || "").trim() === myVkTag,
            metadata: normalizeMessageMetadata(row.metadata),
          }
          setMessages((prev) => {
            // Убираем pending-дубликат с тем же текстом от меня
            if (newMsg.isMe) {
              const withoutPending = prev.filter(
                (m) => !(m.pending && m.text === newMsg.text)
              )
              // Не добавляем если id уже есть
              if (withoutPending.some((m) => m.id === newMsg.id)) return withoutPending
              return [...withoutPending, newMsg]
            }
            // Чужое сообщение — просто добавляем если нет дубликата
            if (prev.some((m) => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
          })
          void onMessagesChanged()
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [threadId, myVkTag, onMessagesChanged])

  // ===== REALTIME: подписка на UPDATE (для metadata — offer accept/reject) =====
  useEffect(() => {
    const channel = supabase
      .channel(`chat_upd_${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chat_messages",
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          const row = payload.new as { id: number; metadata?: unknown }
          setMessages((prev) =>
            prev.map((m) =>
              m.id === row.id
                ? { ...m, metadata: normalizeMessageMetadata(row.metadata) }
                : m
            )
          )
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [threadId])

  // Optimistic send
  const handleSend = async () => {
    const t = message.trim()
    if (!t || sending) return

    // Optimistic: сразу показываем сообщение
    const tempId = localIdCounter.current--
    const optimisticMsg: ChatMsg = {
      id: tempId,
      text: t,
      isMe: true,
      metadata: null,
      pending: true,
    }
    setMessages((prev) => [...prev, optimisticMsg])
    setMessage("")

    setSending(true)
    const ok = await appendThreadMessage(supabase, threadId, myVkTag, t)
    setSending(false)

    if (!ok) {
      // Откатываем optimistic
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
    }
    // Не вызываем reloadMessages — realtime INSERT подставит реальное сообщение
  }

  const handleOfferAction = async (messageId: number, offer: RideOfferMetadata, action: "accept" | "reject") => {
    const ok = await onOfferAction(offer.offerId, action)
    if (!ok) return
    const nextStatus: RideOfferMetadata["status"] = action === "accept" ? "accepted" : "rejected"
    const nextMetadata = { ...offer, status: nextStatus }
    setMessages((prev) =>
      prev.map((msg) => (msg.id === messageId ? { ...msg, metadata: nextMetadata } : msg))
    )
    await supabase.from("chat_messages").update({ metadata: nextMetadata }).eq("id", messageId)
    await appendThreadMessage(
      supabase,
      threadId,
      myVkTag,
      action === "accept" ? "Отклик принят. Можно договариваться о подаче." : "Отклик отклонён."
    )
    void onMessagesChanged()
  }

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-[#F4F7FB] to-[#EEF2F8]">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-gray-200/60 bg-white/80 px-4 py-2.5 backdrop-blur-xl">
        <button
          type="button"
          onClick={onBack}
          className="poputi-focus-ring -ml-1 flex h-9 w-9 items-center justify-center rounded-full transition-colors active:bg-gray-100"
          aria-label="Назад"
        >
          <ChevronLeft className="h-5 w-5 text-gray-600" aria-hidden />
        </button>
        <button type="button" onClick={onOpenProfile} className="flex flex-1 items-center gap-2.5 text-left">
          {chat.avatarUrl ? (
            <img
              src={chat.avatarUrl}
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 shrink-0 rounded-full object-cover bg-gray-100"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2787F5] text-sm font-bold text-white">
              {chat.avatar}
            </div>
          )}
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold leading-tight text-gray-900">{chat.name}</h2>
            <p className="text-[11px] text-gray-500">нажмите для профиля</p>
          </div>
        </button>
      </header>

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        className="app-scrollbar min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 py-3"
      >
        {loading && (
          <div className="flex items-center justify-center py-12">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#2787F5] border-t-transparent" />
          </div>
        )}
        {!loading && messages.length === 0 && (
          <p className="py-12 text-center text-sm text-gray-400">Напишите первое сообщение</p>
        )}
        {!loading &&
          messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.isMe ? "justify-end" : "justify-start"}`}>
              {msg.metadata?.kind === "ride_offer" ? (
                <RideOfferCard
                  offer={msg.metadata}
                  isPassenger={myVkTag === msg.metadata.passengerVkId}
                  onAccept={() => void handleOfferAction(msg.id, msg.metadata as RideOfferMetadata, "accept")}
                  onReject={() => void handleOfferAction(msg.id, msg.metadata as RideOfferMetadata, "reject")}
                />
              ) : (
                <div
                  className={cn(
                    "max-w-[78%] rounded-2xl px-3.5 py-2 text-[14px] leading-relaxed",
                    msg.isMe
                      ? "poputi-grad-primary rounded-br-md text-white shadow-[0_6px_14px_-6px_rgba(39,135,245,0.45)]"
                      : "rounded-bl-md border border-white/60 bg-white/85 text-gray-900 shadow-[0_1px_2px_rgba(15,23,42,0.06)] backdrop-blur-sm",
                    msg.pending && "opacity-60"
                  )}
                >
                  {msg.text}
                </div>
              )}
            </div>
          ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="safe-area-bottom border-t border-gray-200/60 bg-white/80 px-3 py-2 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <input
            type="text"
            autoComplete="off"
            placeholder="Сообщение…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSend()
            }}
            className="min-w-0 flex-1 rounded-full bg-gray-100 px-4 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:bg-white focus:ring-1 focus:ring-[#2787F5]/30"
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={!message.trim()}
            aria-label="Отправить"
            className="poputi-focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2787F5] text-white transition-transform active:scale-90 disabled:bg-gray-200 disabled:text-gray-400"
          >
            <Send className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  )
}

function normalizeMessageMetadata(value: unknown): ChatMessageMetadata {
  if (!value || typeof value !== "object") return null
  const maybe = value as Partial<RideOfferMetadata>
  if (maybe.kind !== "ride_offer" || typeof maybe.offerId !== "number") return null
  return maybe as RideOfferMetadata
}

function RideOfferCard({
  offer,
  isPassenger,
  onAccept,
  onReject,
}: {
  offer: RideOfferMetadata
  isPassenger: boolean
  onAccept: () => void
  onReject: () => void
}) {
  const decided = offer.status !== "pending"
  const isCounter = (offer.priceDelta ?? 0) > 0
  const isPrimary = !isCounter

  const hasRoute = Boolean(offer.from?.trim() || offer.to?.trim())

  return (
    <div className="poputi-card w-full max-w-full overflow-hidden rounded-2xl p-3.5">
      <div className="mb-1 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#EAF2FF] to-[#DCE9FF] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#2787F5] ring-1 ring-[#2787F5]/15">
        Отклик водителя
      </div>
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          {offer.driverAvatarUrl ? (
            <img
              src={offer.driverAvatarUrl}
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 rounded-full bg-gray-100 object-cover ring-2 ring-white shadow-[0_4px_10px_-4px_rgba(15,23,42,0.3)]"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full poputi-grad-primary text-base font-bold text-white ring-2 ring-white shadow-[0_4px_10px_-4px_rgba(39,135,245,0.5)]">
              {offer.driverName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <div className="flex items-center gap-1.5">
              <h4 className="text-sm font-bold tracking-tight text-gray-900">{offer.driverName}</h4>
              <div className="flex items-center gap-0.5 text-[11px] font-semibold text-amber-500">
                <Star size={10} fill="currentColor" /> {(offer.driverRating ?? 5).toFixed(1)}
              </div>
            </div>
            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-gray-500">
              <Car size={11} /> {offer.driverCar || "Авто"} · {offer.pickupEtaMin ?? 7} мин
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className={cn("text-lg font-black tracking-tight", isCounter ? "text-orange-500" : "text-gray-900")}>
            {offer.price} ₽
          </p>
          {isCounter && (
            <p className="text-[10px] font-semibold text-orange-400">+{offer.priceDelta} ₽ к цене</p>
          )}
        </div>
      </div>
      {hasRoute && (
        <div className="mb-3 flex min-w-0 items-center gap-1.5 rounded-xl bg-gray-50 px-2.5 py-2 text-xs font-semibold text-gray-900 ring-1 ring-gray-100">
          <span className="truncate">{offer.from?.trim() || "—"}</span>
          <span className="shrink-0 text-gray-400">→</span>
          <span className="truncate">{offer.to?.trim() || "—"}</span>
        </div>
      )}
      {decided ? (
        <div className={cn(
          "rounded-xl py-2 text-center text-xs font-bold",
          offer.status === "accepted"
            ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70"
            : "bg-gray-100 text-gray-500"
        )}>
          {offer.status === "accepted" ? "✓ Отклик принят" : "Отклик отклонён"}
        </div>
      ) : isPassenger ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onAccept}
            className="poputi-btn-motion poputi-focus-ring poputi-grad-primary flex-1 rounded-xl py-2.5 text-xs font-bold text-white shadow-[0_8px_18px_-6px_rgba(39,135,245,0.55)] ring-1 ring-white/30 active:scale-95"
          >
            Принять за {offer.price} ₽
          </button>
          <button
            type="button"
            onClick={onReject}
            className="poputi-btn-motion poputi-focus-ring rounded-xl bg-gray-100 px-5 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-200 active:scale-95"
          >
            Нет
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-1.5 rounded-xl bg-gray-50 py-2 text-center text-xs font-medium text-gray-500">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#2787F5] opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#2787F5]" />
          </span>
          Ожидаем ответа пассажира
        </div>
      )}
    </div>
  )
}

export function PublicProfileModal({ profile, onClose }: { profile: ChatData; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4 safe-area-bottom">
      <button
        type="button"
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
        aria-label="Закрыть профиль"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="public-profile-title"
        className="relative w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl animate-in slide-in-from-bottom-4 fade-in duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-5">
          {profile.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt=""
              width={56}
              height={56}
              className="h-14 w-14 rounded-full object-cover"
            />
          ) : (
            <div className="w-14 h-14 bg-[#2787F5] rounded-full flex items-center justify-center text-white font-bold text-xl">
              {profile.avatar}
            </div>
          )}
          <div>
            <h2 id="public-profile-title" className="text-lg font-bold text-gray-900">{profile.name}</h2>
            <div className="flex items-center gap-0.5 mt-0.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} size={14} className={s <= Math.round(profile.rating) ? "text-yellow-400 fill-yellow-400" : "text-gray-200"} />
              ))}
              <span className="text-sm text-gray-500 ml-1">{profile.rating}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="rounded-xl bg-gray-50 p-3 text-center">
            <div className="text-xl font-bold text-[#2787F5]">{profile.trips}</div>
            <div className="text-xs text-gray-500">поездок</div>
          </div>
          <div className="rounded-xl bg-gray-50 p-3 text-center">
            <div className="text-xl font-bold text-gray-900">{profile.rating}</div>
            <div className="text-xs text-gray-500">рейтинг</div>
          </div>
        </div>

        <p className="rounded-xl bg-gray-50 p-3 text-center text-xs text-gray-500">
          Связаться можно только через чат внутри приложения.
        </p>

        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full rounded-xl bg-gray-100 py-2.5 text-sm font-semibold text-gray-600 active:bg-gray-200"
        >
          Закрыть
        </button>
      </div>
    </div>
  )
}
