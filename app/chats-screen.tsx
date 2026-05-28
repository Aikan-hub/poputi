"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { Car, ChevronLeft, MessageCircle, Send, Star, Trash2, UserRound } from "lucide-react"

import { cn } from "@/lib/utils"
import { poputi } from "@/components/poputi/ui"
import { appendThreadMessage, fetchThreadMessages } from "@/lib/chats-db"
import { supabase } from "@/lib/supabase-client"
import type { ChatData, ChatMessageMetadata, RideOfferMetadata, VkUserProfile } from "./types"
import { vkIdTagFromNumericId } from "./helpers"

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
    <div className="flex h-full flex-col bg-gray-50">
      <header className="border-b border-gray-100 bg-white px-6 py-4 shadow-sm">
        <h1 className="text-lg font-bold leading-tight text-gray-900">Отклики водителей</h1>
        <p className="mt-0.5 text-xs font-medium text-gray-500">Диалоги по поездкам</p>
      </header>

      <div className="app-scrollbar min-h-0 flex-1 overflow-y-auto p-4 space-y-3">
        {chatsLoading && (
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-white py-16 text-gray-400 shadow-sm border border-gray-100">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-[#2787F5] border-t-transparent" />
            <span className="text-sm">Загрузка чатов…</span>
          </div>
        )}
        {!chatsLoading && !vkUser && (
          <div className="rounded-2xl bg-white px-4 py-12 text-center shadow-sm border border-gray-100">
            <UserRound className="mx-auto h-9 w-9 text-gray-300" />
            <p className="mt-3 text-sm text-gray-500">Войдите через VK Mini App, чтобы видеть свои диалоги.</p>
          </div>
        )}
        {!chatsLoading && vkUser && chats.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="flex justify-center items-center gap-2 text-sm text-gray-400 font-medium">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#2787F5] opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-[#2787F5]" />
              </span>
              Ищем ещё варианты…
            </div>
            <p className="mt-4 text-sm leading-relaxed text-gray-500 text-center px-6">
              Пока нет диалогов. Они появятся после бронирования поездки или оценки попутчика.
            </p>
          </div>
        )}
        {!chatsLoading &&
          vkUser &&
          chats.map((chat) => (
            <div key={chat.id} className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100">
              <button
                type="button"
                onClick={() => setSelectedChat(chat)}
                className="flex w-full min-w-0 items-center gap-3 text-left"
              >
                <div
                  className="relative shrink-0 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation()
                    onOpenProfile(chat)
                  }}
                >
                  {chat.avatarUrl ? (
                    <img
                      src={chat.avatarUrl}
                      alt=""
                      width={48}
                      height={48}
                      className="h-12 w-12 rounded-full object-cover bg-gray-100"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#2787F5] text-base font-semibold text-white">
                      {chat.avatar}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-bold text-gray-900">{chat.name}</h3>
                    {chat.rating > 0 && (
                      <div className="flex items-center rounded-md bg-yellow-50 px-1.5 py-0.5 text-xs font-bold text-yellow-500">
                        <Star size={10} className="mr-0.5" fill="currentColor" /> {chat.rating.toFixed(1)}
                      </div>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-sm text-gray-500">{chat.lastMessage}</p>
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-xs text-gray-500">{chat.time}</span>
                  {chat.unread > 0 && (
                    <span className="mt-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-semibold text-white">
                      {chat.unread}
                    </span>
                  )}
                </div>
              </button>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedChat(chat)}
                  className="poputi-btn-motion poputi-focus-ring flex-1 rounded-xl bg-[#2787F5] py-3 text-sm font-semibold text-white shadow-md shadow-[#2787F5]/20 hover:bg-[#1F6AD8] active:scale-95"
                >
                  Открыть чат
                </button>
                <button
                  type="button"
                  onClick={() => void onDeleteChat(chat.id)}
                  className="poputi-btn-motion poputi-focus-ring rounded-xl bg-gray-100 px-6 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-200 active:scale-95"
                  aria-label="Удалить чат"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
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
  const [messages, setMessages] = useState<{ id: number; text: string; isMe: boolean; metadata: ChatMessageMetadata }[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const threadId = chat.threadId

  const reloadMessages = useCallback(async () => {
    setLoading(true)
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
    void reloadMessages()
  }, [reloadMessages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    const channel = supabase
      .channel(`chat_${threadId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `thread_id=eq.${threadId}` },
        () => {
          void reloadMessages()
        }
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [threadId, reloadMessages])

  const handleSend = async () => {
    const t = message.trim()
    if (!t || sending) return
    setSending(true)
    const ok = await appendThreadMessage(supabase, threadId, myVkTag, t)
    setSending(false)
    if (!ok) return
    setMessage("")
    await reloadMessages()
    void onMessagesChanged()
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
    await reloadMessages()
    void onMessagesChanged()
  }

  return (
    <div className="flex h-full flex-col bg-gray-50">
      <header className="sticky top-0 z-10 flex items-center gap-4 border-b border-gray-100 bg-white px-6 py-4 shadow-sm">
        <button
          type="button"
          onClick={onBack}
          className="poputi-focus-ring -ml-2 rounded-full p-2 transition-colors hover:bg-gray-100"
          aria-label="Назад"
        >
          <ChevronLeft className="h-6 w-6 text-gray-800" aria-hidden />
        </button>
        <button type="button" onClick={onOpenProfile} className="flex flex-1 items-center gap-3 text-left">
          {chat.avatarUrl ? (
            <img
              src={chat.avatarUrl}
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 shrink-0 rounded-full object-cover bg-gray-100"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2787F5] font-semibold text-white">
              {chat.avatar}
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-lg font-bold leading-tight text-gray-900">{chat.name}</h2>
            <p className="text-xs font-medium text-gray-500">Диалог по поездке</p>
          </div>
        </button>
      </header>

      <div className="app-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
        {loading && (
          <p className="py-8 text-center text-sm text-gray-400">Загрузка сообщений…</p>
        )}
        {!loading && messages.length === 0 && (
          <p className="py-8 text-center text-sm text-gray-400">Напишите первое сообщение.</p>
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
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
                    msg.isMe ? "rounded-br-md bg-[#2787F5] text-white" : "rounded-bl-md bg-white text-gray-900 ring-1 ring-gray-100"
                  }`}
                >
                  {msg.text}
                </div>
              )}
            </div>
          ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="safe-area-bottom border-t border-gray-100 bg-white p-3 shadow-[0_-8px_24px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-2">
          <label htmlFor="chat-message-input" className="sr-only">
            Сообщение
          </label>
          <input
            id="chat-message-input"
            name="message"
            type="text"
            autoComplete="off"
            placeholder="Сообщение…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSend()
            }}
            disabled={sending}
            className="min-w-0 flex-1 rounded-full bg-gray-100 px-4 py-2.5 text-gray-900 placeholder-gray-400 transition-[background-color,box-shadow] focus:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2787F5] disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={sending || !message.trim()}
            aria-label="Отправить сообщение"
            className="poputi-focus-ring flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#2787F5] text-white shadow-sm shadow-[#2787F5]/20 transition-colors hover:bg-[#1F6AD8] active:bg-[#1F6AD8] disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none"
          >
            <Send className="h-5 w-5" aria-hidden />
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

  return (
    <div className="w-full max-w-full rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          {offer.driverAvatarUrl ? (
            <img
              src={offer.driverAvatarUrl}
              alt=""
              width={48}
              height={48}
              className="h-12 w-12 rounded-full bg-gray-100 object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-lg font-bold text-gray-600">
              {offer.driverName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-gray-900">{offer.driverName}</h4>
              <div className="flex items-center rounded-md bg-yellow-50 px-1.5 py-0.5 text-xs font-bold text-yellow-500">
                <Star size={10} className="mr-0.5" fill="currentColor" /> {(offer.driverRating ?? 5).toFixed(1)}
              </div>
            </div>
            <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-gray-500">
              <Car size={12} /> {offer.driverCar || "Авто"} · {offer.pickupEtaMin ?? 7} мин
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className={cn("text-xl font-bold", isCounter ? "text-orange-500" : "text-gray-900")}>{offer.price} ₽</p>
          <p className="mt-0.5 text-xs font-medium text-gray-500">{offer.pickupEtaMin ?? 7} мин</p>
        </div>
      </div>
      {decided ? (
        <div className="rounded-xl bg-[#F0F6FF] py-2 text-center text-sm font-semibold text-[#2787F5]">
          {offer.status === "accepted" ? "Отклик принят" : "Отклик отклонён"}
        </div>
      ) : isPassenger ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onAccept}
            className={cn(
              "poputi-btn-motion poputi-focus-ring flex-1 rounded-xl py-3 text-sm font-semibold active:scale-95",
              isPrimary
                ? "bg-[#2787F5] text-white shadow-md shadow-[#2787F5]/20 hover:bg-[#1F6AD8]"
                : "bg-gray-900 text-white shadow-md shadow-gray-900/20 hover:bg-gray-800"
            )}
          >
            Согласиться
          </button>
          <button type="button" onClick={onReject} className={cn(poputi.btnGhost, "px-6")}>
            Отказать
          </button>
        </div>
      ) : (
        <div className="rounded-xl bg-gray-50 py-2 text-center text-sm font-medium text-gray-500">
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
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm motion-reduce:backdrop-blur-none"
        aria-label="Закрыть профиль"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="public-profile-title"
        className="relative w-full max-w-sm overscroll-contain rounded-[2rem] bg-white p-6 shadow-2xl motion-reduce:animate-none animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-4 mb-6">
          {profile.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt=""
              width={64}
              height={64}
              className="h-16 w-16 rounded-full object-cover shadow-lg"
            />
          ) : (
            <div className="w-16 h-16 bg-[#2787F5] rounded-full flex items-center justify-center text-white font-bold text-2xl">
              {profile.avatar}
            </div>
          )}
          <div>
            <h2 id="public-profile-title" className="text-balance text-xl font-bold text-gray-900">
              {profile.name}
            </h2>
            <div className="flex items-center gap-1 mt-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <span key={star} className={`text-lg ${star <= Math.round(profile.rating) ? "text-yellow-400" : "text-gray-200"}`}>
                  ★
                </span>
              ))}
              <span className="text-gray-500 ml-1">{profile.rating}</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-2xl p-4 mb-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-[#2787F5]">{profile.trips}</div>
              <div className="text-sm text-gray-500">поездок</div>
            </div>
            <div className="bg-white rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-gray-900">{profile.rating}</div>
              <div className="text-sm text-gray-500">рейтинг</div>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-gray-50 p-4 text-center text-sm leading-relaxed text-gray-500">
          Связаться можно только внутри приложения: откройте вкладку «Чаты» внизу экрана и выберите диалог с этим пользователем.
        </div>

        <button
          type="button"
          onClick={onClose}
          className="poputi-btn-motion poputi-focus-ring mt-4 w-full rounded-xl bg-gray-100 py-3 font-semibold text-gray-600 hover:bg-gray-200 active:scale-95"
        >
          Закрыть
        </button>
      </div>
    </div>
  )
}
