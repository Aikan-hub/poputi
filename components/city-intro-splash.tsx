"use client";

import type { AppCity } from "@/lib/cities";
import { APP_CITIES } from "@/lib/cities";

export function CityIntroSplash({
  isVkReady,
  selectedCity,
  onSelectCity,
}: {
  isVkReady: boolean;
  selectedCity: AppCity;
  onSelectCity: (city: AppCity) => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-gray-100">
      <div className="flex flex-1 flex-col items-center justify-center px-6 pb-8 pt-16">
        <div className="mb-2 flex flex-col items-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#2787F5] text-white shadow-lg shadow-[#2787F5]/30">
            <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="currentColor" opacity="0.2" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2" />
              <line x1="9" y1="9" x2="9.01" y2="9" />
              <line x1="15" y1="9" x2="15.01" y2="9" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Попути
          </h1>
          <p className="mt-2 max-w-xs text-center text-sm leading-relaxed text-gray-500">
            P2P-попутки в вашем городе. Выберите город — и закажите поездку на карте.
          </p>
        </div>

        <div className="mt-10 w-full max-w-sm space-y-3">
          {APP_CITIES.map((city) => {
            const active = selectedCity === city;
            return (
              <button
                key={city}
                type="button"
                onClick={() => onSelectCity(city)}
                className={`flex w-full items-center justify-center rounded-2xl border-2 py-5 text-lg font-bold shadow-sm transition-all active:scale-[0.98] ${
                  active
                    ? "border-[#2787F5] bg-white text-[#2787F5] shadow-lg shadow-[#2787F5]/20"
                    : "border-transparent bg-white text-gray-900 hover:border-gray-200"
                }`}
              >
                {city}
              </button>
            );
          })}
        </div>

        <p className="mt-10 flex items-center gap-2 text-xs text-gray-500">
          {!isVkReady ? (
            <>
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#2787F5] opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-[#2787F5]" />
              </span>
              Подключение к VK…
            </>
          ) : (
            <>
              <span className="h-2 w-2 rounded-full bg-[#2787F5]" />
              Готово к работе
            </>
          )}
        </p>
      </div>
    </div>
  );
}
