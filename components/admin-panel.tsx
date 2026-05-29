"use client"

/**
 * Vercel: задайте `NEXT_PUBLIC_ADMIN_PASSWORD` в Environment Variables и
 * выполните redeploy. Без переменной вход будет использовать "slikemercedes".
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Activity,
  ArrowLeft,
  Ban,
  LogOut,
  Map as MapIcon,
  Pencil,
  RefreshCw,
  Shield,
  Trash2,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { APP_CITIES, DEFAULT_APP_CITY, type AppCity, isAppCity } from "@/lib/cities"
import { cn } from "@/lib/utils"
import { isPersistentRideType, isRideWithinActiveWindow, RIDE_ACTIVE_MS } from "@/lib/rides"
import { supabase } from "@/lib/supabase-client"

const SESSION_AUTH_KEY = "poputi_admin_authorized"

export interface RideRow {
  id: number
  lat: number | null
  lng: number | null
  price: number | null
  type: string | null
  created_at: string
  from_location?: string | null
  to_location?: string | null
  name?: string | null
  avatar?: string | null
  vk_id?: string | null
  city?: string | null
}

function startOfTodayLocal(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export type AdminPanelVariant = "page" | "embedded"

export function AdminPanel({
  variant = "page",
  initialAdminCity = DEFAULT_APP_CITY,
  onBackToMap,
  onRidesChanged,
}: {
  variant?: AdminPanelVariant
  /** Город по умолчанию в админке (например, совпадает с выбранным на карте). */
  initialAdminCity?: AppCity
  /** VK Mini App: вернуться к карте без смены URL */
  onBackToMap?: () => void
  /** Вызвать после изменений в `rides`, чтобы обновить карту в родителе */
  onRidesChanged?: () => void
}) {
  const router = useRouter()
  const embedded = variant === "embedded"
  const [mounted, setMounted] = useState(false)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [password, setPassword] = useState("")
  const [loginError, setLoginError] = useState<string | null>(null)

  const [adminCity, setAdminCity] = useState<AppCity>(initialAdminCity)
  const [rides, setRides] = useState<RideRow[]>([])
  const [bannedUsers, setBannedUsers] = useState<{ vk_id: string; display_name?: string; reason?: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingBanList, setLoadingBanList] = useState(false)

  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [clearingOld, setClearingOld] = useState(false)
  const [clearingIntercity, setClearingIntercity] = useState(false)

  const [editOpen, setEditOpen] = useState(false)
  const [editingRide, setEditingRide] = useState<RideRow | null>(null)
  const [editFrom, setEditFrom] = useState("")
  const [editTo, setEditTo] = useState("")
  const [editPrice, setEditPrice] = useState("")
  const [editType, setEditType] = useState("")
  const [editCity, setEditCity] = useState<AppCity>(DEFAULT_APP_CITY)
  const [savingEdit, setSavingEdit] = useState(false)

  const [banOpen, setBanOpen] = useState(false)
  const [banVkId, setBanVkId] = useState("")
  const [banName, setBanName] = useState("")
  const [banReason, setBanReason] = useState("")
  const [savingBan, setSavingBan] = useState(false)

  const adminPassword =
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_ADMIN_PASSWORD
      ? process.env.NEXT_PUBLIC_ADMIN_PASSWORD
      : "slikemercedes"

  const notifyRidesChanged = useCallback(() => {
    onRidesChanged?.()
  }, [onRidesChanged])

  useEffect(() => {
    setMounted(true)
    if (typeof window !== "undefined" && sessionStorage.getItem(SESSION_AUTH_KEY) === "1") {
      setIsAuthorized(true)
    }
  }, [])

  useEffect(() => {
    setAdminCity(initialAdminCity)
  }, [initialAdminCity])

  const fetchRides = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from("rides")
      .select("*")
      .eq("city", adminCity)
      .order("created_at", { ascending: false })
    setLoading(false)
    if (!error) setRides((data as RideRow[]) ?? [])
  }, [adminCity])

  const fetchBanned = useCallback(async () => {
    setLoadingBanList(true)
    const { data, error } = await supabase.from("banned_users").select("*").order("created_at", { ascending: false })
    setLoadingBanList(false)
    if (!error) setBannedUsers((data as typeof bannedUsers) ?? [])
  }, [])

  useEffect(() => {
    if (!mounted || !isAuthorized) return
    void fetchRides()
    void fetchBanned()
  }, [mounted, isAuthorized, fetchRides, fetchBanned])

  const activeRidesCount = useMemo(
    () => rides.filter((r) => isRideWithinActiveWindow(r.created_at, r.type)).length,
    [rides]
  )
  const registeredUsersCount = useMemo(() => {
    const ids = new Set<string>()
    for (const r of rides) if (r.vk_id?.trim()) ids.add(r.vk_id.trim())
    return ids.size
  }, [rides])

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError(null)
    if (password === adminPassword) {
      sessionStorage.setItem(SESSION_AUTH_KEY, "1")
      setIsAuthorized(true)
    } else {
      setLoginError("Неверный пароль.")
    }
  }

  const handleLogout = () => {
    sessionStorage.removeItem(SESSION_AUTH_KEY)
    setIsAuthorized(false)
    setRides([])
  }

  const exitAdmin = useCallback(() => {
    if (onBackToMap) {
      onBackToMap()
      return
    }
    router.push("/")
  }, [onBackToMap, router])

  const handleDeleteOne = async (id: number) => {
    setDeletingId(id)
    const { error } = await supabase.from("rides").delete().eq("id", id)
    setDeletingId(null)
    if (!error) {
      setRides((prev) => prev.filter((r) => r.id !== id))
      notifyRidesChanged()
    }
  }

  const handleClearOldRides = async () => {
    if (!window.confirm("Удалить все заявки за прошлые дни? (постоянные точки Static / AdminPoint не удаляются)")) return
    setClearingOld(true)
    const boundary = startOfTodayLocal().toISOString()
    const { error } = await supabase
      .from("rides")
      .delete()
      .eq("city", adminCity)
      .lt("created_at", boundary)
      .not("type", "eq", "Static")
      .not("type", "eq", "AdminPoint")
    setClearingOld(false)
    if (!error) {
      void fetchRides()
      notifyRidesChanged()
    }
  }

  const handleClearExpiredIntercity = async () => {
    if (!window.confirm("Удалить старый межгород (старше 3 часов)? Постоянные точки не затрагиваются.")) return
    setClearingIntercity(true)
    const boundary = new Date(Date.now() - RIDE_ACTIVE_MS).toISOString()
    const { error } = await supabase
      .from("rides")
      .delete()
      .eq("city", adminCity)
      .not("from_location", "is", null)
      .not("to_location", "is", null)
      .lt("created_at", boundary)
      .not("type", "eq", "Static")
      .not("type", "eq", "AdminPoint")
    setClearingIntercity(false)
    if (!error) {
      void fetchRides()
      notifyRidesChanged()
    }
  }

  const openEdit = (ride: RideRow) => {
    setEditingRide(ride)
    setEditFrom(ride.from_location || "")
    setEditTo(ride.to_location || "")
    setEditPrice(ride.price ? ride.price.toString() : "")
    setEditType(ride.type || "Passenger")
    const c = ride.city?.trim()
    setEditCity(c && isAppCity(c) ? c : adminCity)
    setEditOpen(true)
  }

  const saveEdit = async () => {
    if (!editingRide) return
    setSavingEdit(true)
    const { error } = await supabase
      .from("rides")
      .update({
        from_location: editFrom,
        to_location: editTo,
        price: editPrice ? Number(editPrice) : null,
        type: editType,
        city: editCity,
      })
      .eq("id", editingRide.id)
    setSavingEdit(false)
    if (!error) {
      setEditOpen(false)
      void fetchRides()
      notifyRidesChanged()
    }
  }

  const openBan = (ride: RideRow) => {
    setBanVkId(ride.vk_id || "")
    setBanName(ride.name || "")
    setBanReason("")
    setBanOpen(true)
  }

  const confirmBan = async () => {
    if (!banVkId.trim()) return
    setSavingBan(true)
    const { error } = await supabase.from("banned_users").insert({
      vk_id: banVkId,
      display_name: banName,
      reason: banReason,
    })
    setSavingBan(false)
    if (!error || error.code === "23505") {
      setBanOpen(false)
      void fetchBanned()
    }
  }

  const unban = async (vk_id: string) => {
    const { error } = await supabase.from("banned_users").delete().eq("vk_id", vk_id)
    if (!error) void fetchBanned()
  }

  const shellClass = embedded
    ? "h-full min-h-0 flex flex-col bg-[#EBEDF0] text-[#2C2D2E] overflow-hidden"
    : "min-h-screen bg-[#EBEDF0] text-[#2C2D2E]"

  const loginShellClass = embedded
    ? "h-full min-h-0 flex flex-col items-center justify-center px-4 bg-[#EBEDF0] text-[#2C2D2E]"
    : "min-h-screen bg-[#EBEDF0] text-[#2C2D2E] flex flex-col items-center justify-center px-4"

  if (!mounted) {
    return (
      <div className={embedded ? "h-full flex items-center justify-center text-[#818C99] bg-[#EBEDF0]" : "min-h-screen bg-[#EBEDF0] flex items-center justify-center text-[#818C99]"}>
        Загрузка…
      </div>
    )
  }

  if (!isAuthorized) {
    return (
      <div className={loginShellClass}>
        <div className="w-full max-w-md">
          <button
            type="button"
            onClick={exitAdmin}
            className="poputi-focus-ring mb-4 inline-flex items-center gap-2 rounded-xl px-2 py-2 text-sm font-semibold text-[#818C99] transition-colors hover:bg-white/80 hover:text-[#2C2D2E]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            На главную
          </button>

          <div className="rounded-2xl border border-[#E1E3E6] bg-white p-8 shadow-xl">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F0F6FF] text-[#2787F5]">
                <Shield className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-[#2C2D2E]">Попути — Админ</h1>
                <p className="text-sm text-[#818C99]">Авторизация</p>
              </div>
            </div>
            <form onSubmit={handleLogin} className="space-y-4">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="border-transparent bg-[#F2F3F5] text-[#2C2D2E] placeholder:text-[#818C99] focus-visible:ring-[#2787F5]"
                placeholder="Пароль"
                autoComplete="current-password"
              />
              {loginError && <p className="text-sm text-[#E64646]">{loginError}</p>}
              <Button type="submit" className="w-full bg-[#2787F5] font-bold text-white hover:bg-[#1F6AD8]">
                Войти
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={exitAdmin}
                className="w-full text-[#818C99] hover:bg-[#F2F3F5] hover:text-[#2C2D2E]"
              >
                Отмена
              </Button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={shellClass}>
      <header className="shrink-0 border-b border-[#D3D9DE]/80 bg-white/95 px-4 py-3 shadow-sm backdrop-blur sm:px-6">
        <div className={embedded ? "flex items-center justify-between gap-2" : "mx-auto flex max-w-6xl items-center justify-between"}>
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            {onBackToMap ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onBackToMap}
                className="shrink-0 border-[#D3D9DE] bg-white text-[#2C2D2E] hover:bg-[#F2F3F5]"
              >
                <ArrowLeft className="mr-1 h-4 w-4" />
                <MapIcon className="mr-1 hidden h-4 w-4 sm:inline" />
                <span className="hidden sm:inline">{embedded ? "Назад на карту" : "На главную"}</span>
                <span className="sm:hidden">{embedded ? "Карта" : "Назад"}</span>
              </Button>
            ) : null}
            <Shield className="h-6 w-6 shrink-0 text-[#2787F5]" />
            <h1 className="truncate text-lg font-bold text-[#2C2D2E]">Центр управления</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="shrink-0 text-[#818C99] hover:bg-[#F2F3F5] hover:text-[#2C2D2E]">
            <LogOut className="mr-2 h-4 w-4" /> Выход
          </Button>
        </div>
      </header>

      <main className={embedded ? "app-scrollbar min-h-0 flex-1 overflow-y-auto p-4 space-y-5" : "mx-auto max-w-6xl p-4 sm:p-6 space-y-5"}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="border-[#E1E3E6] bg-white text-[#2C2D2E] shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#818C99]">
                <Activity className="h-4 w-4" /> Активные поездки
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-[#00BFA5]">{activeRidesCount}</div>
            </CardContent>
          </Card>
          <Card className="border-[#E1E3E6] bg-white text-[#2C2D2E] shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#818C99]">
                <Shield className="h-4 w-4" /> Пользователи
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-[#2787F5]">{registeredUsersCount}</div>
            </CardContent>
          </Card>
        </div>

        <div className="rounded-2xl border border-[#E1E3E6] bg-white p-3 shadow-sm">
          <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-[#818C99]">Заявки города</p>
          <div className="flex w-full gap-0 rounded-xl bg-[#EBEDF0] p-1" role="tablist" aria-label="Город в админке">
            {APP_CITIES.map((c) => (
              <button
                key={c}
                type="button"
                role="tab"
                aria-selected={adminCity === c}
                onClick={() => setAdminCity(c)}
                className={cn(
                  "poputi-btn-motion poputi-focus-ring flex-1 rounded-lg py-2.5 px-3 text-center text-sm font-semibold",
                  adminCity === c
                    ? "bg-[#2787F5] text-white shadow-sm"
                    : "text-[#818C99] active:bg-white/60"
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <Tabs defaultValue="rides">
          <TabsList className="bg-[#DDE3EA] p-1 text-[#818C99]">
            <TabsTrigger value="rides" className="data-[state=active]:bg-white data-[state=active]:text-[#2C2D2E]">
              Список заявок
            </TabsTrigger>
            <TabsTrigger value="bans" className="data-[state=active]:bg-white data-[state=active]:text-[#2C2D2E]">
              Черный список
            </TabsTrigger>
          </TabsList>

          <TabsContent value="rides" className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <Button onClick={() => void fetchRides()} disabled={loading} variant="outline" size="sm" className="border-[#D3D9DE] bg-white text-[#2C2D2E] hover:bg-[#F2F3F5] disabled:text-[#AEB7C2]">
                <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} /> Обновить
              </Button>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={handleClearOldRides} disabled={clearingOld} className="bg-white text-[#2C2D2E] hover:bg-[#F2F3F5]">
                  <Trash2 className="mr-2 h-4 w-4 text-[#FF9500]" /> Старые (Вчера)
                </Button>
                <Button variant="secondary" size="sm" onClick={handleClearExpiredIntercity} disabled={clearingIntercity} className="bg-white text-[#2C2D2E] hover:bg-[#F2F3F5]">
                  <Trash2 className="mr-2 h-4 w-4 text-[#E64646]" /> Межгород (&gt; 3ч)
                </Button>
              </div>
            </div>

            <Card className="overflow-hidden border-[#E1E3E6] bg-white shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="border-[#E1E3E6] bg-[#F7F8FA] hover:bg-[#F7F8FA]">
                    <TableHead className="text-[#818C99]">ID</TableHead>
                    <TableHead className="text-[#818C99]">Тип</TableHead>
                    <TableHead className="text-[#818C99]">Город</TableHead>
                    <TableHead className="text-[#818C99]">Маршрут</TableHead>
                    <TableHead className="text-[#818C99]">Цена</TableHead>
                    <TableHead className="text-right text-[#818C99]">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rides.map((ride) => (
                    <TableRow key={ride.id} className="border-[#E1E3E6] hover:bg-[#F7F8FA]">
                      <TableCell className="font-mono text-xs text-[#818C99]">{ride.id}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-[#D3D9DE] bg-white text-[10px] text-[#2C2D2E]">
                          {ride.type}
                          {isPersistentRideType(ride.type) ? " · ∞" : ""}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium text-[#2C2D2E]">{ride.city?.trim() || "—"}</TableCell>
                      <TableCell>
                        <div className="font-semibold text-[#2C2D2E]">{(ride.from_location || "—") + " → " + (ride.to_location || "—")}</div>
                        <div className="text-xs text-[#818C99]">{ride.name}</div>
                      </TableCell>
                      <TableCell className="font-bold text-[#00BFA5]">{ride.price ? `${ride.price}₽` : "—"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(ride)}>
                            <Pencil className="h-4 w-4 text-[#2787F5]" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openBan(ride)} disabled={!ride.vk_id}>
                            <Ban className="h-4 w-4 text-[#FF9500]" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteOne(ride.id)} disabled={deletingId === ride.id}>
                            <Trash2 className="h-4 w-4 text-[#E64646]" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="bans" className="mt-4">
            <Card className="overflow-hidden border-[#E1E3E6] bg-white shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="border-[#E1E3E6] bg-[#F7F8FA] hover:bg-[#F7F8FA]">
                    <TableHead className="text-[#818C99]">VK ID</TableHead>
                    <TableHead className="text-[#818C99]">Имя</TableHead>
                    <TableHead className="text-[#818C99]">Причина</TableHead>
                    <TableHead className="text-right text-[#818C99]">Действие</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bannedUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-[#818C99]">
                        Список пуст
                      </TableCell>
                    </TableRow>
                  ) : (
                    bannedUsers.map((b) => (
                      <TableRow key={b.vk_id} className="border-[#E1E3E6]">
                        <TableCell className="font-mono text-xs text-[#818C99]">{b.vk_id}</TableCell>
                        <TableCell className="font-medium text-[#2C2D2E]">{b.display_name}</TableCell>
                        <TableCell className="text-[#818C99]">{b.reason || "—"}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={() => unban(b.vk_id)}>
                            Разбанить
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="border-[#E1E3E6] bg-white text-[#2C2D2E]">
          <DialogHeader>
            <DialogTitle>Редактирование</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Откуда</Label>
              <Input value={editFrom} onChange={(e) => setEditFrom(e.target.value)} className="border-transparent bg-[#F2F3F5] text-[#2C2D2E] focus-visible:ring-[#2787F5]" />
            </div>
            <div className="space-y-2">
              <Label>Куда</Label>
              <Input value={editTo} onChange={(e) => setEditTo(e.target.value)} className="border-transparent bg-[#F2F3F5] text-[#2C2D2E] focus-visible:ring-[#2787F5]" />
            </div>
            <div className="space-y-2">
              <Label>Цена</Label>
              <Input type="number" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} className="border-transparent bg-[#F2F3F5] text-[#2C2D2E] focus-visible:ring-[#2787F5]" />
            </div>
            <div className="space-y-2">
              <Label>Тип</Label>
              <Select value={editType} onValueChange={setEditType}>
                <SelectTrigger className="border-transparent bg-[#F2F3F5] text-[#2C2D2E] focus:ring-[#2787F5]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Passenger">Пассажир</SelectItem>
                  <SelectItem value="Driver">Водитель</SelectItem>
                  <SelectItem value="Static">Статичная точка</SelectItem>
                  <SelectItem value="AdminPoint">Точка админа (legacy)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Город</Label>
              <Select value={editCity} onValueChange={(v) => setEditCity(v as AppCity)}>
                <SelectTrigger className="border-transparent bg-[#F2F3F5] text-[#2C2D2E] focus:ring-[#2787F5]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {APP_CITIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Отмена
            </Button>
            <Button onClick={saveEdit} disabled={savingEdit} className="bg-[#2787F5] text-white hover:bg-[#1F6AD8]">
              {savingEdit ? "Сохранение…" : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={banOpen} onOpenChange={setBanOpen}>
        <DialogContent className="border-[#E1E3E6] bg-white text-[#2C2D2E]">
          <DialogHeader>
            <DialogTitle>Блокировка</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>VK ID</Label>
              <Input value={banVkId} readOnly className="border-transparent bg-[#F2F3F5] text-[#818C99]" />
            </div>
            <div className="space-y-2">
              <Label>Причина</Label>
              <Input
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                name="ban_reason"
                autoComplete="off"
                spellCheck={false}
                className="border-transparent bg-[#F2F3F5] text-[#2C2D2E] focus-visible:ring-[#2787F5]"
                placeholder="Нарушение правил…"
                aria-label="Причина блокировки"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBanOpen(false)}>
              Отмена
            </Button>
            <Button variant="destructive" onClick={confirmBan} disabled={savingBan}>
              Забанить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
