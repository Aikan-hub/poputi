"use client"

import { Check, ChevronRight, MapPinned, Navigation, Sparkles, Radio, Route } from "lucide-react"
import type { AppCity } from "@/lib/cities"
import { APP_CITIES } from "@/lib/cities"
import { cn } from "@/lib/utils"

const VKIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 256 256" className="h-5 w-5">
    <g clipPath="url(#vk-clip)">
      <mask id="vk-mask" width="256" height="256" x="0" y="0" maskUnits="userSpaceOnUse" style={{maskType: "luminance" as const}}>
        <path fill="#fff" d="M256 0H0v256h256V0z"/>
      </mask>
      <g mask="url(#vk-mask)">
        <path fill="#07F" d="M0 122.88C0 64.95 0 35.99 18 18 36 0 64.95 0 122.88 0h10.24C191.05 0 220.01 0 238 18c18 18 18 46.95 18 104.88v10.24c0 57.93 0 86.89-18 104.88-18 18-46.95 18-104.88 18h-10.24c-57.93 0-86.89 0-104.88-18C0 220 0 191.06 0 133.13v-10.24z"/>
        <path fill="#fff" d="M136.21 184.43c-58.34 0-91.62-40-93.01-106.56h29.23c.96 48.85 22.5 69.54 39.57 73.81V77.87h27.52V120c16.85-1.81 34.56-21.01 40.53-42.13h27.52c-4.58 26.02-23.78 45.22-37.44 53.12 13.66 6.4 35.52 23.14 43.84 53.44h-30.29c-6.5-20.27-22.72-35.95-44.16-38.08v38.08h-3.3z"/>
      </g>
    </g>
    <defs>
      <clipPath id="vk-clip">
        <path fill="#fff" d="M0 0h256v256H0z"/>
      </clipPath>
    </defs>
  </svg>
)

const CITY_META: Record<AppCity, { hint: string; pulse: string; gradient: string; glow: string; iconBg: string }> = {
  Шумиха: {
    hint: "Короткие городские поездки",
    pulse: "район, вокзал, дом",
    gradient: "from-[#2787F5] to-[#1453B8]",
    glow: "shadow-[0_14px_28px_-10px_rgba(39,135,245,0.55)]",
    iconBg: "bg-gradient-to-br from-[#2787F5] to-[#1453B8]",
  },
  Тюмень: {
    hint: "Больше маршрутов и межгород",
    pulse: "центр, районы, трасса",
    gradient: "from-[#00A876] to-[#00744F]",
    glow: "shadow-[0_14px_28px_-10px_rgba(0,168,118,0.55)]",
    iconBg: "bg-gradient-to-br from-[#00A876] to-[#00744F]",
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
      {/* Aurora blobs — стиль Animated Card из 21st.dev */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-[#2787F5]/20 blur-[80px]" />
        <div className="absolute -right-10 top-1/4 h-48 w-48 rounded-full bg-[#6C5CE7]/15 blur-[60px]" />
        <div className="absolute bottom-20 left-1/3 h-40 w-40 rounded-full bg-[#00A876]/12 blur-[60px]" />
      </div>

      <div className="relative flex min-h-full flex-col">
        {/* Header — стиль glassmorphism card из 21st.dev */}
        <header className="shrink-0 px-5 pb-3 pt-6">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/60 bg-white/70 px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#2787F5] to-[#1453B8] text-white shadow-[0_8px_20px_-6px_rgba(39,135,245,0.6)]">
                <Route className="h-5 w-5" aria-hidden />
                <span className="pointer-events-none absolute -inset-px rounded-xl ring-1 ring-white/30" aria-hidden />
              </div>
              <div>
                <div className="text-lg font-black tracking-tight text-gray-950">Попути</div>
                <div className="text-[10px] font-semibold text-gray-500">городские попутки</div>
              </div>
            </div>
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold transition-colors",
                isVkReady
                  ? "border-[#16823A]/15 bg-[#EAF7EE] text-[#16823A]"
                  : "border-[#2787F5]/15 bg-[#F0F6FF] text-[#2787F5]"
              )}
            >
              {isVkReady ? <VKIcon /> : <span className="h-2 w-2 animate-pulse rounded-full bg-[#2787F5]" />}
              {isVkReady ? "VK" : "VK…"}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex flex-1 flex-col px-5 pb-2 pt-5">
          <section className="mb-5">
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-white/60 bg-white/70 px-2.5 py-1 text-[10px] font-bold text-gray-600 shadow-sm backdrop-blur">
              <Sparkles className="h-3 w-3 text-[#2787F5]" aria-hidden />
              Выберите город
            </div>
            <h1 className="max-w-xs text-[2rem] font-black leading-[1] tracking-tight text-gray-950">
              Где сегодня{" "}
              <span className="bg-gradient-to-r from-[#2787F5] to-[#6C5CE7] bg-clip-text text-transparent">
                ловим попутку?
              </span>
            </h1>
          </section>

          {/* City cards — стиль Animated Card hover из 21st.dev */}
          <div className="space-y-2.5">
            {APP_CITIES.map((city) => {
              const active = selectedCity === city
              const meta = CITY_META[city]

              return (
                <button
                  key={city}
                  type="button"
                  onClick={() => onSelectCity(city)}
                  className={cn(
                    "group relative flex w-full items-center gap-3.5 overflow-hidden rounded-[1.25rem] p-3.5 text-left transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98]",
                    active
                      ? "border border-[#2787F5]/30 bg-white/80 shadow-[0_16px_36px_-14px_rgba(39,135,245,0.4)] ring-1 ring-[#2787F5]/20 backdrop-blur-xl"
                      : "border border-white/60 bg-white/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)] backdrop-blur hover:border-gray-200 hover:shadow-[0_12px_28px_-14px_rgba(15,23,42,0.2)]"
                  )}
                >
                  {/* Hover glow — как в Animated Card */}
                  <span
                    className={cn(
                      "pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-500 group-hover:opacity-100",
                      active && "opacity-100"
                    )}
                    aria-hidden
                  >
                    <span className={cn("absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl", meta.iconBg, "opacity-20")} />
                  </span>

                  <div
                    className={cn(
                      "relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white transition-transform duration-300 group-active:scale-95",
                      meta.iconBg,
                      meta.glow
                    )}
                  >
                    <MapPinned className="h-5 w-5" aria-hidden />
                    <span className="pointer-events-none absolute -inset-px rounded-2xl ring-1 ring-white/30" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-lg font-black text-gray-950">{city}</span>
                      {active && (
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#2787F5] text-white shadow-[0_4px_10px_rgba(39,135,245,0.45)]">
                          <Check className="h-2.5 w-2.5" aria-hidden />
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs font-semibold text-gray-500">{meta.hint}</p>
                    <div className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-gray-400">
                      <Navigation className="h-3 w-3" aria-hidden />
                      <span className="truncate">{meta.pulse}</span>
                    </div>
                  </div>
                  <ChevronRight
                    className={cn(
                      "h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5",
                      active ? "text-[#2787F5]" : "text-gray-300"
                    )}
                    aria-hidden
                  />
                </button>
              )
            })}
          </div>
        </main>

        {/* Footer — стиль dark glassmorphism card */}
        <footer className="safe-area-bottom px-5 pb-4 pt-2">
          <div className="relative overflow-hidden rounded-2xl border border-white/8 bg-gray-900/85 px-4 py-3 text-white shadow-[0_18px_36px_-14px_rgba(15,23,42,0.5)] backdrop-blur-xl">
            <span
              className="pointer-events-none absolute -top-10 right-0 h-24 w-24 rounded-full bg-[#2787F5]/30 blur-2xl"
              aria-hidden
            />
            <div className="relative flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                <Radio className="h-4 w-4 text-white" aria-hidden />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold tracking-tight">Карта откроется сразу</div>
                <div className="truncate text-[10px] font-medium text-white/55">
                  {selectedCity}: заявки и водители рядом
                </div>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
