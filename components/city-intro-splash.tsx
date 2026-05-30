"use client"

import { Check, ChevronRight, MapPinned, Navigation, Sparkles, Radio, Route } from "lucide-react"
import type { AppCity } from "@/lib/cities"
import { APP_CITIES } from "@/lib/cities"
import { cn } from "@/lib/utils"

const CITY_META: Record<AppCity, { hint: string; pulse: string; accent: string; glow: string }> = {
  Шумиха: {
    hint: "Короткие городские поездки",
    pulse: "район, вокзал, дом",
    accent: "bg-gradient-to-br from-[#2787F5] to-[#1453B8]",
    glow: "shadow-[0_18px_40px_-12px_rgba(39,135,245,0.55)]",
  },
  Тюмень: {
    hint: "Больше маршрутов и межгород",
    pulse: "центр, районы, трасса",
    accent: "bg-gradient-to-br from-[#00A876] to-[#00744F]",
    glow: "shadow-[0_18px_40px_-12px_rgba(0,168,118,0.55)]",
  },
}

export function CityIntroSplash({
  isVkReady,
  selectedCity,
  onSelectCity,
}: {
  isVkReady: boolean
  selectedCity: AppCity
  onSelectCity: (city: AppCity) => void
}) {
  return (
    <div className="absolute inset-0 z-[100] flex flex-col overflow-hidden bg-gradient-to-b from-[#F2F6FC] via-[#F5F7FB] to-[#ECF1F8]">
      {/* Aurora background blobs */}
      <div className="poputi-aurora" aria-hidden />

      <div className="relative flex min-h-full flex-col">
        <header className="shrink-0 px-5 pb-4 pt-7">
          <div className="poputi-glass flex items-center justify-between gap-3 rounded-2xl px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl poputi-grad-primary text-white shadow-[0_10px_25px_-8px_rgba(39,135,245,0.6)]">
                <Route className="h-5 w-5" aria-hidden />
                <span className="pointer-events-none absolute -inset-px rounded-2xl ring-1 ring-white/30" aria-hidden />
              </div>
              <div>
                <div className="text-xl font-black tracking-tight">
                  <span className="poputi-grad-text">Попути</span>
                </div>
                <div className="text-[11px] font-semibold text-gray-500">городские попутки</div>
              </div>
            </div>
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors",
                isVkReady
                  ? "border-[#16823A]/15 bg-[#EAF7EE] text-[#16823A]"
                  : "border-[#2787F5]/15 bg-[#F0F6FF] text-[#2787F5]"
              )}
            >
              <span className={cn("h-2 w-2 rounded-full", isVkReady ? "bg-[#4BB34B]" : "animate-pulse bg-[#2787F5]")} />
              {isVkReady ? "VK готов" : "VK…"}
            </div>
          </div>
        </header>

        <main className="flex flex-1 flex-col px-5 pb-2 pt-6">
          <section className="mb-6">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/70 px-3 py-1.5 text-[11px] font-bold text-gray-600 shadow-sm backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-[#2787F5]" aria-hidden />
              Выберите город поездки
            </div>
            <h1 className="max-w-xs text-[2.4rem] font-black leading-[0.95] tracking-tight text-gray-950">
              Где сегодня <span className="poputi-grad-text">ловим попутку?</span>
            </h1>
            <p className="mt-2 max-w-xs text-sm font-medium text-gray-500">
              Выберите город — и карта с заявками откроется мгновенно.
            </p>
          </section>

          <div className="space-y-3">
            {APP_CITIES.map((city) => {
              const active = selectedCity === city
              const meta = CITY_META[city]

              return (
                <button
                  key={city}
                  type="button"
                  onClick={() => onSelectCity(city)}
                  className={cn(
                    "poputi-btn-motion poputi-focus-ring poputi-card-hover group relative flex w-full items-center gap-4 overflow-hidden rounded-[1.5rem] p-4 text-left",
                    active
                      ? "poputi-glass ring-2 ring-[#2787F5]/40 shadow-[0_20px_45px_-18px_rgba(39,135,245,0.4)]"
                      : "poputi-card hover:border-gray-300"
                  )}
                >
                  {/* hover sheen */}
                  <span
                    className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent opacity-60"
                    aria-hidden
                  />

                  <div
                    className={cn(
                      "relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white transition-transform group-active:scale-95",
                      meta.accent,
                      meta.glow
                    )}
                  >
                    <MapPinned className="h-6 w-6" aria-hidden />
                    <span className="pointer-events-none absolute -inset-px rounded-2xl ring-1 ring-white/30" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-xl font-black text-gray-950">{city}</span>
                      {active && (
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#2787F5] text-white shadow-[0_4px_10px_rgba(39,135,245,0.45)]">
                          <Check className="h-3.5 w-3.5" aria-hidden />
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-[13px] font-semibold text-gray-500">{meta.hint}</p>
                    <div className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-gray-400">
                      <Navigation className="h-3.5 w-3.5" aria-hidden />
                      <span className="truncate">{meta.pulse}</span>
                    </div>
                  </div>
                  <ChevronRight
                    className={cn(
                      "h-5 w-5 shrink-0 transition-transform group-hover:translate-x-0.5 group-active:translate-x-1",
                      active ? "text-[#2787F5]" : "text-gray-300"
                    )}
                    aria-hidden
                  />
                </button>
              )
            })}
          </div>
        </main>

        <footer className="safe-area-bottom px-5 pb-5 pt-2">
          <div className="poputi-glass-dark relative overflow-hidden rounded-[1.5rem] px-4 py-3.5 text-white">
            <span
              className="pointer-events-none absolute -top-12 right-0 h-28 w-28 rounded-full bg-[#2787F5]/40 blur-2xl"
              aria-hidden
            />
            <div className="relative flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
                <Radio className="h-4 w-4 text-white" aria-hidden />
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-bold tracking-tight">Карта откроется сразу после выбора</div>
                <div className="truncate text-[11px] font-medium text-white/60">
                  {selectedCity}: заявки, водители и межгород рядом
                </div>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
