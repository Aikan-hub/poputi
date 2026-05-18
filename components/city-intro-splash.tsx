"use client"

import type { AppCity } from "@/lib/cities"
import { APP_CITIES } from "@/lib/cities"

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
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#EBEDF0]">
      <div className="flex flex-1 flex-col items-center justify-center px-6 pb-8 pt-16">
        <div className="mb-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-[#2C2D2E]">Попутки</h1>
          <p className="mt-2 max-w-xs text-center text-sm text-[#818C99]">Выберите город, чтобы открыть карту и заявки</p>
        </div>

        <div className="mt-10 w-full max-w-sm space-y-4">
          {APP_CITIES.map((city) => {
            const active = selectedCity === city
            return (
              <button
                key={city}
                type="button"
                onClick={() => onSelectCity(city)}
                className={`flex w-full items-center justify-center rounded-2xl border-2 py-5 text-lg font-bold shadow-sm transition-all active:scale-[0.98] ${
                  active
                    ? "border-[#2787F5] bg-white text-[#2787F5] ring-2 ring-[#2787F5]/25"
                    : "border-transparent bg-white text-[#2C2D2E] hover:border-[#D3D9DE]"
                }`}
              >
                {city}
              </button>
            )
          })}
        </div>

        <p className="mt-10 flex items-center gap-2 text-xs text-[#818C99]">
          {!isVkReady ? (
            <>
              <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-[#2787F5]" />
              Подключение к VK…
            </>
          ) : (
            <>
              <span className="h-2 w-2 rounded-full bg-[#4BB34B]" />
              Готово к работе
            </>
          )}
        </p>
      </div>
    </div>
  )
}
