import type { Metadata } from 'next'
import { I18nProvider } from '@/lib/i18n'
import './globals.css'

export const metadata: Metadata = {
  title: 'AI Cost Optimizer — FCamara',
  description: 'Reduce LLM costs by up to 70% with intelligent model routing, caching, and adaptive prompting.',
  openGraph: {
    title: 'AI Cost Optimizer',
    description: 'Model routing · Cost analysis · Response caching · Adaptive prompting',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">
        <I18nProvider defaultLocale="pt-BR">
          {children}
        </I18nProvider>
      </body>
    </html>
  )
}
