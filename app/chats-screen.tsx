"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { ChevronLeft, MessageCircle, Send, Trash2, UserRound } from "lucide-react"
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
        <p className="mt-4 text-sm leading-relaxed text-[#818C99]">Войдите через VK, чтобы пользоваться чатами.</p>
        <button type="button" className="mt-4 rounded-xl bg-[#F0F6FF] px-4 py-2 text-sm font-semibold text-[#2787F5]" onClick={() => setSelectedChat(null)}>
          Назад к списку
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-[#F7F8FA]">
      <header className="border-b border-[#E1E3E6]/80 bg-white px-4 py-4 shadow-sm">
        <h1 className="text-2xl font-bold leading-tight text-[#2C2D2E]">Чаты</h1>
        <p className="mt-0.5 text-sm text-[#818C99]">Диалоги по поездкам и отзывам</p>
      </header>

      <div className="app-scrollbar min-h-0 flex-1 overflow-y-auto p-3">
        {chatsLoading && (
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-white py-16 text-[#818C99] shadow-sm ring-1 ring-[#E1E3E6]/70">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-[#2787F5] border-t-transparent" />
            <span className="text-sm">Загрузка чатов…</span>
          </div>
        )}
        {!chatsLoading && !vkUser && (
          <div className="rounded-2xl bg-white px-4 py-12 text-center shadow-sm ring-1 ring-[#E1E3E6]/70">
            <UserRound className="mx-auto h-9 w-9 text-[#AEB7C2]" />
            <p className="mt-3 text-sm text-[#818C99]">Войдите через VK Mini App, чтобы видеть свои диалоги.</p>
          </div>
        )}
        {!chatsLoading && vkUser && chats.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[#D3D9DE] bg-white px-4 py-12 text-center">
            <MessageCircle className="mx-auto h-10 w-10 text-[#AEB7C2]" />
            <p className="mt-3 text-sm leading-relaxed text-[#818C99]">
              Пока нет диалогов. Они появятся после бронирования поездки или оценки попутчика.
            </p>
          </div>
        )}
        {!chatsLoading &&
          vkUser &&
          chats.map((chat) => (
            <div key={chat.id} className="mb-2 flex items-stretch overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-[#E1E3E6]/70">
              <button
                type="button"
                onClick={() => setSelectedChat(chat)}
                className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left transition-colors active:bg-[#EBEDF0]"
              >
                <div
                  className="relative shrink-0 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation()
                    onOpenProfile(chat)
                  }}
                >
                  {chat.avatarUrl ? (
                    <img src={chat.avatarUrl} alt="" className="h-14 w-14 rounded-full object-cover shadow-sm ring-2 ring-[#2787F5]/20" />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#2787F5] text-base font-semibold text-white shadow-sm">
                      {chat.avatar}
                    </div>
                  )}
                  {chat.unread > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#E64646] text-xs font-medium text-white">
                      {chat.unread}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="truncate font-semibold text-[#2C2D2E]">{chat.name}</h3>
                    <span className="shrink-0 text-xs text-[#818C99]">{chat.time}</span>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-[#818C99]">{chat.lastMessage}</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => void onDeleteChat(chat.id)}
                className="flex shrink-0 items-center justify-center px-3 text-[#AEB7C2] transition-colors active:bg-[#FAEBEB] active:text-[#E64646]"
                aria-label="Удалить чат"
              >
                <Trash2 className="h-5 w-5" />
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
    <div className="flex h-full flex-col bg-[#EBEDF0]">
      <header className="flex items-center gap-3 border-b border-[#E1E3E6]/80 bg-white px-4 py-3 shadow-sm">
        <button type="button" onClick={onBack} className="-ml-1 rounded-full p-1 text-[#2787F5] active:bg-[#F0F6FF]" aria-label="Назад">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <button type="button" onClick={onOpenProfile} className="flex flex-1 items-center gap-3 text-left">
          {chat.avatarUrl ? (
            <img src={chat.avatarUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover shadow-sm ring-2 ring-[#2787F5]/20" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2787F5] font-semibold text-white">
              {chat.avatar}
            </div>
          )}
          <div className="min-w-0">
            <h2 className="truncate font-semibold text-[#2C2D2E]">{chat.name}</h2>
            <p className="text-xs text-[#818C99]">Диалог в облаке</p>
          </div>
        </button>
      </header>

      <div className="app-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
        {loading && (
          <p className="py-8 text-center text-sm text-[#818C99]">Загрузка сообщений…</p>
        )}
        {!loading && messages.length === 0 && (
          <p className="py-8 text-center text-sm text-[#818C99]">Напишите первое сообщение.</p>
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
                    msg.isMe ? "rounded-br-md bg-[#2787F5] text-white" : "rounded-bl-md bg-white text-[#2C2D2E] ring-1 ring-[#E1E3E6]/70"
                  }`}
                >
                  {msg.text}
                </div>
              )}
            </div>
          ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-[#E1E3E6] bg-white p-3 shadow-[0_-8px_24px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Сообщение..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSend()
            }}
            disabled={sending}
            className="min-w-0 flex-1 rounded-full bg-[#F2F3F5] px-4 py-2.5 text-[#2C2D2E] placeholder-[#818C99] outline-none ring-1 ring-transparent transition focus:bg-white focus:ring-2 focus:ring-[#2787F5] disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={sending || !message.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#2787F5] text-white shadow-sm shadow-[#2787F5]/20 transition-colors active:bg-[#1F6AD8] disabled:bg-[#D3D9DE] disabled:text-[#818C99] disabled:shadow-none"
          >
            <Send className="h-5 w-5" />
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
  return (
    <div className="w-full max-w-[92%] rounded-2xl bg-white p-3 shadow-sm ring-1 ring-[#E1E3E6]/80">
      <div className="flex items-center gap-3">
        {offer.driverAvatarUrl ? (
          <img src={offer.driverAvatarUrl} alt="" className="h-12 w-12 rounded-full object-cover ring-2 ring-[#2787F5]/20" />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#2787F5] font-bold text-white">
            {offer.driverName.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-[#2C2D2E]">{offer.driverName}</p>
          <p className="text-xs text-[#818C99]">
            {offer.driverCar || "Авто"} · ★ {(offer.driverRating ?? 5).toFixed(1)} · {offer.pickupEtaMin ?? 7} мин
          </p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-[#00BFA5]">{offer.price} ₽</p>
          <p className="text-xs text-[#818C99]">итого</p>
        </div>
      </div>
      <div className="mt-3 rounded-xl bg-[#F7F8FA] px-3 py-2 text-sm font-medium text-[#2C2D2E]">
        {(offer.from || "Откуда") + " → " + (offer.to || "Куда")}
      </div>
      {decided ? (
        <div className="mt-3 rounded-xl bg-[#F0F6FF] py-2 text-center text-sm font-semibold text-[#2787F5]">
          {offer.status === "accepted" ? "Отклик принят" : "Отклик отклонён"}
        </div>
      ) : isPassenger ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={onReject} className="rounded-xl bg-[#FAEBEB] py-2.5 text-sm font-semibold text-[#E64646]">
            Отказать
          </button>
          <button type="button" onClick={onAccept} className="rounded-xl bg-[#2787F5] py-2.5 text-sm font-semibold text-white">
            Согласиться
          </button>
        </div>
      ) : (
        <div className="mt-3 rounded-xl bg-[#F7F8FA] py-2 text-center text-sm font-medium text-[#818C99]">
          Ожидаем ответа пассажира
        </div>
      )}
    </div>
  )
}

export function PublicProfileModal({ profile, onClose }: { profile: ChatData; onClose: () => void }) {
  return (
    <div className="absolute inset-0 bg-black/50 flex items-end z-50" onClick={onClose}>
      <div
        className="bg-white rounded-t-2xl w-full max-h-[80%] overflow-y-auto animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4">
          <div className="w-10 h-1 bg-[#D3D9DE] rounded-full mx-auto mb-4" />

          <div className="flex items-center gap-4 mb-6">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt="" className="w-20 h-20 rounded-full object-cover shadow-lg ring-2 ring-[#2787F5]/20" />
            ) : (
              <div className="w-20 h-20 bg-[#2787F5] rounded-full flex items-center justify-center text-white font-bold text-2xl">
                {profile.avatar}
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold text-[#2C2D2E]">{profile.name}</h2>
              <div className="flex items-center gap-1 mt-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span key={star} className={`text-lg ${star <= Math.round(profile.rating) ? "text-[#FFC107]" : "text-[#E1E3E6]"}`}>
                    ★
                  </span>
                ))}
                <span className="text-[#818C99] ml-1">{profile.rating}</span>
              </div>
            </div>
          </div>

          <div className="bg-[#F7F8FA] rounded-2xl p-4 mb-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-[#2787F5]">{profile.trips}</div>
                <div className="text-sm text-[#818C99]">поездок</div>
              </div>
              <div className="bg-white rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-[#4BB34B]">{profile.rating}</div>
                <div className="text-sm text-[#818C99]">рейтинг</div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-[#F7F8FA] p-4 text-center text-sm leading-relaxed text-[#818C99]">
            Связаться можно только внутри приложения: откройте вкладку «Чаты» внизу экрана и выберите диалог с этим пользователем.
          </div>

          <button
            onClick={onClose}
            className="w-full mt-4 py-3 rounded-xl bg-[#EBEDF0] text-[#2C2D2E] font-medium active:bg-[#D3D9DE] transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  )
}
