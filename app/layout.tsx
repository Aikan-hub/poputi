import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import Script from 'next/script'
import './globals.css'
import { AppBootstrap } from './vk-bootstrap'

export const metadata: Metadata = {
  title: 'Попути - Поиск попутчиков',
  description: 'VK Mini App для поиска попутчиков',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru">
      <head>
        <script src="https://unpkg.com/@vkontakte/vk-bridge/dist/browser.min.js"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function() {
  try {
    if (typeof vkBridge !== 'undefined') {
      vkBridge.send('VKWebAppInit');
      window.vkBridgeInitialized = true;
      console.log('--- VK BRIDGE INITIALIZED ATOMICALLY ---');
    }
  } catch (e) {
    console.error('Atomic init failed', e);
  }
})();`,
          }}
        />
        <script src="https://cdn.jsdelivr.net/npm/eruda"></script>
        <script dangerouslySetInnerHTML={{ __html: `eruda.init();` }} />
      </head>
      <body className="font-sans antialiased">
        <Script
          src="https://api-maps.yandex.ru/2.1/?lang=ru_RU&apikey=77552578-1483-4cc6-8510-a0a7f7f340aa"
          strategy="lazyOnload"
        />
        <AppBootstrap />
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
