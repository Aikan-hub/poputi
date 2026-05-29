"use client";

/**
 * Vercel: задайте `NEXT_PUBLIC_ADMIN_PASSWORD` в Environment Variables и
 * выполните redeploy. Без переменной вход будет использовать "slikemercedes".
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  Ban,
  LogOut,
  Pencil,
  RefreshCw,
  Shield,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  APP_CITIES,
  DEFAULT_APP_CITY,
  type AppCity,
  isAppCity,
} from "@/lib/cities";
import { cn } from "@/lib/utils";
import {
  isPersistentRideType,
  isRideWithinActiveWindow,
  purgeExpiredRides,
} from "@/lib/rides";
import { supabase } from "@/lib/supabase-client";

const SESSION_AUTH_KEY = "poputi_admin_authorized";

export interface RideRow {
  id: number;
  lat: number | null;
  lng: number | null;
  price: number | null;
  type: string | null;
  created_at: string;
  from_location?: string | null;
  to_location?: string | null;
  name?: string | null;
  avatar?: string | null;
  vk_id?: string | null;
  city?: string | null;
}

function startOfTodayLocal(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export type AdminPanelVariant = "page" | "embedded";

export function AdminPanel({
  variant = "page",
  initialAdminCity = DEFAULT_APP_CITY,
  onBackToMap,
  onRidesChanged,
}: {
  variant?: AdminPanelVariant;
  /** Город по умолчанию в админке (например, совпадает с выбранным на карте). */
  initialAdminCity?: AppCity;
  /** VK Mini App: вернуться к карте без смены URL */
  onBackToMap?: () => void;
  /** Вызвать после изменений в `rides`, чтобы обновить карту в родителе */
  onRidesChanged?: () => void;
}) {
  const router = useRouter();
  const embedded = variant === "embedded";
  const [mounted, setMounted] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);

  const [adminCity, setAdminCity] = useState<AppCity>(initialAdminCity);
  const [rides, setRides] = useState<RideRow[]>([]);
  const [bannedUsers, setBannedUsers] = useState<
    { vk_id: string; display_name?: string; reason?: string }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [loadingBanList, setLoadingBanList] = useState(false);

  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [clearingOld, setClearingOld] = useState(false);
  const [clearingIntercity, setClearingIntercity] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editingRide, setEditingRide] = useState<RideRow | null>(null);
  const [editFrom, setEditFrom] = useState("");
  const [editTo, setEditTo] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editType, setEditType] = useState("");
  const [editCity, setEditCity] = useState<AppCity>(DEFAULT_APP_CITY);
  const [savingEdit, setSavingEdit] = useState(false);

  const [banOpen, setBanOpen] = useState(false);
  const [banVkId, setBanVkId] = useState("");
  const [banName, setBanName] = useState("");
  const [banReason, setBanReason] = useState("");
  const [savingBan, setSavingBan] = useState(false);
  const [adminTab, setAdminTab] = useState<"rides" | "bans">("rides");

  const adminPassword =
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_ADMIN_PASSWORD
      ? process.env.NEXT_PUBLIC_ADMIN_PASSWORD
      : "slikemercedes";

  const notifyRidesChanged = useCallback(() => {
    onRidesChanged?.();
  }, [onRidesChanged]);

  useEffect(() => {
    setMounted(true);
    if (
      typeof window !== "undefined" &&
      sessionStorage.getItem(SESSION_AUTH_KEY) === "1"
    ) {
      setIsAuthorized(true);
    }
  }, []);

  useEffect(() => {
    setAdminCity(initialAdminCity);
  }, [initialAdminCity]);

  const fetchRides = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("rides")
      .select("*")
      .eq("city", adminCity)
      .order("created_at", { ascending: false });
    setLoading(false);
    if (!error) setRides((data as RideRow[]) ?? []);
  }, [adminCity]);

  const fetchBanned = useCallback(async () => {
    setLoadingBanList(true);
    const { data, error } = await supabase
      .from("banned_users")
      .select("*")
      .order("created_at", { ascending: false });
    setLoadingBanList(false);
    if (!error) setBannedUsers((data as typeof bannedUsers) ?? []);
  }, []);

  useEffect(() => {
    if (!mounted || !isAuthorized) return;
    void fetchRides();
    void fetchBanned();
  }, [mounted, isAuthorized, fetchRides, fetchBanned]);

  const activeRidesCount = useMemo(
    () =>
      rides.filter((r) => isRideWithinActiveWindow(r.created_at, r.type))
        .length,
    [rides],
  );
  const registeredUsersCount = useMemo(() => {
    const ids = new Set<string>();
    for (const r of rides) if (r.vk_id?.trim()) ids.add(r.vk_id.trim());
    return ids.size;
  }, [rides]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    if (password === adminPassword) {
      sessionStorage.setItem(SESSION_AUTH_KEY, "1");
      setIsAuthorized(true);
    } else {
      setLoginError("Неверный пароль.");
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem(SESSION_AUTH_KEY);
    setIsAuthorized(false);
    setRides([]);
  };

  const exitAdmin = useCallback(() => {
    if (onBackToMap) {
      onBackToMap();
      return;
    }
    router.push("/");
  }, [onBackToMap, router]);

  const handleDeleteOne = async (id: number) => {
    setDeletingId(id);
    const { error } = await supabase.from("rides").delete().eq("id", id);
    setDeletingId(null);
    if (!error) {
      setRides((prev) => prev.filter((r) => r.id !== id));
      notifyRidesChanged();
    }
  };

  const handleClearOldRides = async () => {
    if (
      !window.confirm(
        "Удалить все заявки за прошлые дни? (постоянные точки Static / AdminPoint не удаляются)",
      )
    )
      return;
    setClearingOld(true);
    const boundary = startOfTodayLocal().toISOString();
    const { error } = await supabase
      .from("rides")
      .delete()
      .eq("city", adminCity)
      .lt("created_at", boundary)
      .not("type", "eq", "Static")
      .not("type", "eq", "AdminPoint");
    setClearingOld(false);
    if (!error) {
      void fetchRides();
      notifyRidesChanged();
    }
  };

  const handleClearExpiredIntercity = async () => {
    if (
      !window.confirm(
        "Удалить старый межгород (старше 3 часов)? Постоянные точки не затрагиваются.",
      )
    )
      return;
    setClearingIntercity(true);
    const { error } = await purgeExpiredRides(supabase, { city: adminCity });
    setClearingIntercity(false);
    if (!error) {
      void fetchRides();
      notifyRidesChanged();
    }
  };

  const openEdit = (ride: RideRow) => {
    setEditingRide(ride);
    setEditFrom(ride.from_location || "");
    setEditTo(ride.to_location || "");
    setEditPrice(ride.price ? ride.price.toString() : "");
    setEditType(ride.type || "Passenger");
    const c = ride.city?.trim();
    setEditCity(c && isAppCity(c) ? c : adminCity);
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editingRide) return;
    setSavingEdit(true);
    const { error } = await supabase
      .from("rides")
      .update({
        from_location: editFrom,
        to_location: editTo,
        price: editPrice ? Number(editPrice) : null,
        type: editType,
        city: editCity,
      })
      .eq("id", editingRide.id);
    setSavingEdit(false);
    if (!error) {
      setEditOpen(false);
      void fetchRides();
      notifyRidesChanged();
    }
  };

  const openBan = (ride: RideRow) => {
    setBanVkId(ride.vk_id || "");
    setBanName(ride.name || "");
    setBanReason("");
    setBanOpen(true);
  };

  const confirmBan = async () => {
    if (!banVkId.trim()) return;
    setSavingBan(true);
    const { error } = await supabase.from("banned_users").insert({
      vk_id: banVkId,
      display_name: banName,
      reason: banReason,
    });
    setSavingBan(false);
    if (!error || error.code === "23505") {
      setBanOpen(false);
      void fetchBanned();
    }
  };

  const unban = async (vk_id: string) => {
    const { error } = await supabase
      .from("banned_users")
      .delete()
      .eq("vk_id", vk_id);
    if (!error) void fetchBanned();
  };

  const shellClass = embedded
    ? "h-full min-h-0 flex flex-col overflow-hidden bg-gray-100 text-gray-900"
    : "min-h-screen bg-gray-100 text-gray-900";

  const loginShellClass = embedded
    ? "h-full min-h-0 flex flex-col justify-center px-4 bg-gray-100"
    : "flex min-h-screen flex-col justify-center px-4 bg-gray-100";

  if (!mounted) {
    return (
      <div
        className={
          embedded
            ? "flex h-full items-center justify-center bg-gray-100 text-gray-500"
            : "flex min-h-screen items-center justify-center bg-gray-100 text-gray-500"
        }
      >
        Загрузка…
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className={loginShellClass}>
        <div className="mx-auto w-full max-w-sm">
          <button
            type="button"
            onClick={exitAdmin}
            className="poputi-focus-ring mb-3 inline-flex items-center gap-1.5 rounded-lg px-1 py-1.5 text-sm font-semibold text-gray-500 transition-colors hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            На главную
          </button>

          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-lg">
            <div className="bg-gradient-to-b from-[#2787F5] to-[#1F6AD8] px-5 pb-5 pt-5 text-white">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/30 bg-white/15">
                  <Shield className="h-6 w-6" aria-hidden />
                </span>
                <div>
                  <h1 className="text-lg font-bold tracking-tight">Попути — Админ</h1>
                  <p className="text-xs text-white/80">Центр управления заявками</p>
                </div>
              </div>
            </div>
            <form onSubmit={handleLogin} className="space-y-3 p-4">
              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                  Пароль
                </span>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 border-gray-100 bg-gray-50 text-gray-900 focus-visible:ring-[#2787F5]"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </label>
              {loginError ? (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">
                  {loginError}
                </p>
              ) : null}
              <Button
                type="submit"
                className="w-full rounded-xl bg-[#2787F5] py-2.5 font-bold text-white hover:bg-[#1F6AD8]"
              >
                Войти
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={exitAdmin}
                className="w-full rounded-xl text-gray-500 hover:bg-gray-50 hover:text-gray-900"
              >
                Отмена
              </Button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={shellClass}>
      <header className="shrink-0 border-b border-gray-100 bg-white px-3 py-2.5 shadow-sm">
        <div
          className={
            embedded ? "flex items-center justify-between gap-2" : "mx-auto flex max-w-lg items-center justify-between"
          }
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {onBackToMap ? (
              <button
                type="button"
                onClick={onBackToMap}
                className="poputi-focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gray-100 bg-gray-50 text-gray-700 active:bg-gray-100"
                aria-label={embedded ? "Назад на карту" : "На главную"}
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            ) : null}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <Shield className="h-4 w-4 shrink-0 text-[#2787F5]" aria-hidden />
                <h1 className="truncate text-base font-bold text-gray-900">Админ</h1>
              </div>
              <p className="truncate text-[10px] text-gray-500">{adminCity}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="poputi-focus-ring flex h-9 items-center gap-1 rounded-xl px-2.5 text-xs font-semibold text-gray-500 active:bg-gray-50"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Выход</span>
          </button>
        </div>
      </header>

      <main
        className={
          embedded
            ? "app-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto p-3"
            : "mx-auto max-w-lg space-y-3 p-4"
        }
      >
        <div className="grid grid-cols-2 gap-2">
          <AdminStatCard
            icon={<Activity className="h-4 w-4" />}
            label="Активные"
            value={activeRidesCount}
            tone="green"
          />
          <AdminStatCard
            icon={<Shield className="h-4 w-4" />}
            label="VK в базе"
            value={registeredUsersCount}
            tone="blue"
          />
        </div>

        <section className="rounded-2xl border border-gray-100 bg-white p-2.5 shadow-sm">
          <p className="mb-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            Город
          </p>
          <div className="flex gap-1 rounded-xl bg-gray-100 p-1" role="tablist" aria-label="Город в админке">
            {APP_CITIES.map((c) => (
              <button
                key={c}
                type="button"
                role="tab"
                aria-selected={adminCity === c}
                onClick={() => setAdminCity(c)}
                className={cn(
                  "poputi-btn-motion poputi-focus-ring flex-1 rounded-lg py-2 text-center text-xs font-semibold",
                  adminCity === c ? "bg-[#2787F5] text-white shadow-sm" : "text-gray-500"
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </section>

        <div className="flex gap-1 rounded-xl bg-gray-100 p-1" role="tablist" aria-label="Раздел админки">
          <button
            type="button"
            role="tab"
            aria-selected={adminTab === "rides"}
            onClick={() => setAdminTab("rides")}
            className={cn(
              "poputi-focus-ring flex-1 rounded-lg py-2 text-xs font-semibold",
              adminTab === "rides" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
            )}
          >
            Заявки ({rides.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={adminTab === "bans"}
            onClick={() => setAdminTab("bans")}
            className={cn(
              "poputi-focus-ring flex-1 rounded-lg py-2 text-xs font-semibold",
              adminTab === "bans" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
            )}
          >
            Бан ({bannedUsers.length})
          </button>
        </div>

        {adminTab === "rides" ? (
          <div className="space-y-2.5">
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => void fetchRides()}
                disabled={loading}
                className="poputi-focus-ring inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-100 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm disabled:opacity-50"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden />
                Обновить
              </button>
              <button
                type="button"
                onClick={handleClearOldRides}
                disabled={clearingOld}
                className="poputi-focus-ring inline-flex items-center gap-1 rounded-xl border border-amber-100 bg-amber-50 px-2.5 py-2 text-[11px] font-semibold text-amber-800 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                Вчера
              </button>
              <button
                type="button"
                onClick={handleClearExpiredIntercity}
                disabled={clearingIntercity}
                className="poputi-focus-ring inline-flex items-center gap-1 rounded-xl border border-red-100 bg-red-50 px-2.5 py-2 text-[11px] font-semibold text-red-700 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                &gt;3ч
              </button>
            </div>

            {loading && rides.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">Загрузка заявок…</p>
            ) : rides.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-gray-200 bg-white py-10 text-center text-sm text-gray-500">
                Заявок нет
              </p>
            ) : (
              <ul className="space-y-2">
                {rides.map((ride) => (
                  <AdminRideCard
                    key={ride.id}
                    ride={ride}
                    deleting={deletingId === ride.id}
                    onEdit={() => openEdit(ride)}
                    onBan={() => openBan(ride)}
                    onDelete={() => void handleDeleteOne(ride.id)}
                  />
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => void fetchBanned()}
              disabled={loadingBanList}
              className="poputi-focus-ring flex w-full items-center justify-center gap-1.5 rounded-xl border border-gray-100 bg-white py-2 text-xs font-semibold text-gray-700 shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loadingBanList && "animate-spin")} aria-hidden />
              Обновить список
            </button>
            {loadingBanList && bannedUsers.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">Загрузка…</p>
            ) : bannedUsers.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-gray-200 bg-white py-10 text-center text-sm text-gray-500">
                Чёрный список пуст
              </p>
            ) : (
              <ul className="space-y-2">
                {bannedUsers.map((b) => (
                  <AdminBanCard key={b.vk_id} user={b} onUnban={() => void unban(b.vk_id)} />
                ))}
              </ul>
            )}
          </div>
        )}
      </main>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-sm rounded-2xl border-gray-100 bg-white text-gray-900">
          <DialogHeader>
            <DialogTitle className="text-base">Редактирование #{editingRide?.id}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <AdminField label="Откуда" value={editFrom} onChange={setEditFrom} />
            <AdminField label="Куда" value={editTo} onChange={setEditTo} />
            <AdminField label="Цена, ₽" value={editPrice} onChange={setEditPrice} inputMode="numeric" />
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Тип</Label>
              <Select value={editType} onValueChange={setEditType}>
                <SelectTrigger className="border-gray-100 bg-gray-50 focus:ring-[#2787F5]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Passenger">Пассажир</SelectItem>
                  <SelectItem value="Driver">Водитель</SelectItem>
                  <SelectItem value="Static">Статичная точка</SelectItem>
                  <SelectItem value="AdminPoint">Точка админа</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Город</Label>
              <Select value={editCity} onValueChange={(v) => setEditCity(v as AppCity)}>
                <SelectTrigger className="border-gray-100 bg-gray-50 focus:ring-[#2787F5]">
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
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setEditOpen(false)}>
              Отмена
            </Button>
            <Button
              onClick={saveEdit}
              disabled={savingEdit}
              className="rounded-xl bg-[#2787F5] text-white hover:bg-[#1F6AD8]"
            >
              {savingEdit ? "Сохранение…" : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={banOpen} onOpenChange={setBanOpen}>
        <DialogContent className="max-w-sm rounded-2xl border-gray-100 bg-white text-gray-900">
          <DialogHeader>
            <DialogTitle className="text-base">Блокировка</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <AdminField label="VK ID" value={banVkId} onChange={() => {}} readOnly />
            {banName ? <p className="text-sm text-gray-600">{banName}</p> : null}
            <AdminField
              label="Причина"
              value={banReason}
              onChange={setBanReason}
              placeholder="Нарушение правил…"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setBanOpen(false)}>
              Отмена
            </Button>
            <Button variant="destructive" className="rounded-xl" onClick={confirmBan} disabled={savingBan}>
              {savingBan ? "…" : "Забанить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const RIDE_TYPE_LABELS: Record<string, string> = {
  Passenger: "Пассажир",
  Driver: "Водитель",
  City: "Город",
  Static: "Статичная",
  AdminPoint: "Админ",
};

function AdminStatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  tone: "green" | "blue";
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-1.5 text-gray-500">
        <span className={tone === "green" ? "text-emerald-500" : "text-[#2787F5]"}>{icon}</span>
        <span className="text-[10px] font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p
        className={cn(
          "mt-1 text-2xl font-bold tabular-nums leading-none",
          tone === "green" ? "text-emerald-600" : "text-[#2787F5]"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function AdminRideCard({
  ride,
  deleting,
  onEdit,
  onBan,
  onDelete,
}: {
  ride: RideRow;
  deleting: boolean;
  onEdit: () => void;
  onBan: () => void;
  onDelete: () => void;
}) {
  const active = isRideWithinActiveWindow(ride.created_at, ride.type);
  const typeLabel = RIDE_TYPE_LABELS[ride.type || ""] || ride.type || "—";

  return (
    <li className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[10px] text-gray-400">#{ride.id}</span>
            <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600">
              {typeLabel}
              {isPersistentRideType(ride.type) ? " · ∞" : ""}
            </span>
            {active ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                live
              </span>
            ) : null}
          </div>
          <p className="mt-1.5 text-sm font-semibold leading-snug text-gray-900">
            {ride.from_location || "—"}
            <span className="font-normal text-gray-400"> → </span>
            {ride.to_location || "—"}
          </p>
          {ride.name ? <p className="mt-0.5 truncate text-xs text-gray-500">{ride.name}</p> : null}
        </div>
        <p className="shrink-0 text-lg font-bold tabular-nums text-[#2787F5]">
          {ride.price ? `${ride.price} ₽` : "—"}
        </p>
      </div>
      <div className="mt-2.5 flex gap-1 border-t border-gray-50 pt-2">
        <button
          type="button"
          onClick={onEdit}
          className="poputi-focus-ring flex flex-1 items-center justify-center gap-1 rounded-lg bg-[#F0F6FF] py-2 text-[11px] font-semibold text-[#2787F5]"
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden />
          Изменить
        </button>
        <button
          type="button"
          onClick={onBan}
          disabled={!ride.vk_id}
          className="poputi-focus-ring flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-700 disabled:opacity-40"
          aria-label="Забанить"
        >
          <Ban className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          className="poputi-focus-ring flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-600 disabled:opacity-40"
          aria-label="Удалить"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}

function AdminBanCard({
  user,
  onUnban,
}: {
  user: { vk_id: string; display_name?: string; reason?: string };
  onUnban: () => void;
}) {
  return (
    <li className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">{user.display_name || "Без имени"}</p>
          <p className="mt-0.5 font-mono text-[10px] text-gray-400">{user.vk_id}</p>
          {user.reason ? <p className="mt-1 text-xs text-gray-600">{user.reason}</p> : null}
        </div>
        <button
          type="button"
          onClick={onUnban}
          className="poputi-focus-ring shrink-0 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-[11px] font-semibold text-gray-700"
        >
          Разбанить
        </button>
      </div>
    </li>
  );
}

function AdminField({
  label,
  value,
  onChange,
  readOnly,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  inputMode?: "numeric" | "text";
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</span>
      <Input
        value={value}
        readOnly={readOnly}
        placeholder={placeholder}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 border-gray-100 bg-gray-50 text-gray-900 focus-visible:ring-[#2787F5]"
      />
    </label>
  );
}
