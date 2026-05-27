import type { Metadata } from 'next'
import Script from 'next/script'
import { Analytics } from '@vercel/analytics/next'
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
      <body className="font-sans antialiased">
        <Script
          src="https://unpkg.com/@vkontakte/vk-bridge/dist/browser.min.js"
          strategy="beforeInteractive"
        />
        <Script id="vk-bridge-init" strategy="beforeInteractive">
          {`(function() {
  try {
    if (typeof vkBridge !== 'undefined') {
      vkBridge.send('VKWebAppInit');
      window.vkBridgeInitialized = true;
    }
  } catch (e) {
    console.error('VK bridge init failed', e);
  }
})();`}
        </Script>
        {process.env.NODE_ENV !== 'production' && (
          <>
            <Script src="https://cdn.jsdelivr.net/npm/eruda" strategy="lazyOnload" />
            <Script id="eruda-init" strategy="lazyOnload">
              {`if (typeof eruda !== 'undefined') eruda.init();`}
            </Script>
          </>
        )}
        <AppBootstrap />
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
