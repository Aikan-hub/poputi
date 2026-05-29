"use client"

import { Check, ChevronRight, MapPinned, Navigation, Radio, Route } from "lucide-react"
import type { AppCity } from "@/lib/cities"
import { APP_CITIES } from "@/lib/cities"
import { cn } from "@/lib/utils"

const CITY_META: Record<AppCity, { hint: string; pulse: string; accent: string }> = {
  Шумиха: {
    hint: "Короткие городские поездки",
    pulse: "район, вокзал, дом",
    accent: "bg-[#2787F5]",
  },
  Тюмень: {
    hint: "Больше маршрутов и межгород",
    pulse: "центр, районы, трасса",
    accent: "bg-[#00A876]",
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
    <div className="absolute inset-0 z-[100] flex flex-col overflow-hidden bg-[#F4F6F8]">
      <div className="flex min-h-full flex-col">
        <header className="shrink-0 bg-white px-5 pb-5 pt-7 shadow-sm ring-1 ring-gray-200/70">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gray-900 text-white shadow-lg shadow-gray-900/15">
                <Route className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <div className="text-2xl font-black tracking-tight text-gray-950">Попути</div>
                <div className="text-xs font-semibold text-gray-500">городские попутки</div>
              </div>
            </div>
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold",
                isVkReady ? "bg-[#EAF7EE] text-[#16823A]" : "bg-[#F0F6FF] text-[#2787F5]"
              )}
            >
              <span className={cn("h-2 w-2 rounded-full", isVkReady ? "bg-[#4BB34B]" : "animate-pulse bg-[#2787F5]")} />
              {isVkReady ? "VK готов" : "VK…"}
            </div>
          </div>
        </header>

        <main className="flex flex-1 flex-col px-5 pb-2 pt-8">
          <section className="mb-7">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-bold text-gray-600 shadow-sm ring-1 ring-gray-200">
              <Radio className="h-4 w-4 text-[#2787F5]" aria-hidden />
              Выберите город поездки
            </div>
            <h1 className="max-w-xs text-4xl font-black leading-[0.95] tracking-tight text-gray-950">
              Где сегодня ловим попутку?
            </h1>
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
                    "poputi-btn-motion poputi-focus-ring group relative flex w-full items-center gap-4 overflow-hidden rounded-[1.5rem] border bg-white p-4 text-left shadow-sm transition-all active:scale-[0.98]",
                    active
                      ? "border-[#2787F5] shadow-xl shadow-[#2787F5]/15"
                      : "border-gray-200 hover:border-gray-300 hover:shadow-md"
                  )}
                >
                  <div className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white", meta.accent)}>
                    <MapPinned className="h-6 w-6" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-xl font-black text-gray-950">{city}</span>
                      {active && (
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#2787F5] text-white">
                          <Check className="h-3.5 w-3.5" aria-hidden />
                        </span>
                      )}
                    </div>
                    <p className="mt-1 truncate text-sm font-semibold text-gray-500">{meta.hint}</p>
                    <div className="mt-3 flex items-center gap-2 text-xs font-bold text-gray-400">
                      <Navigation className="h-3.5 w-3.5" aria-hidden />
                      <span className="truncate">{meta.pulse}</span>
                    </div>
                  </div>
                  <ChevronRight
                    className={cn(
                      "h-5 w-5 shrink-0 transition-transform group-active:translate-x-0.5",
                      active ? "text-[#2787F5]" : "text-gray-300"
                    )}
                    aria-hidden
                  />
                </button>
              )
            })}
          </div>
        </main>

        <footer className="safe-area-bottom px-5 pb-5">
          <div className="rounded-[1.35rem] bg-gray-900 px-4 py-3 text-white shadow-xl shadow-gray-900/15">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10">
                <Route className="h-4 w-4" aria-hidden />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold">Карта откроется сразу после выбора</div>
                <div className="truncate text-xs font-medium text-white/55">
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
