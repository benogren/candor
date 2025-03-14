// app/layout.tsx
'use client';

import { AuthProvider } from '@/lib/context/auth-context';
import { Roboto } from 'next/font/google';
import { Analytics } from "@vercel/analytics/react"
import { SpeedInsights } from "@vercel/speed-insights/next"
import './globals.css';

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['100', '200', '300', '400', '500', '700'], // Customize weights as needed
  variable: '--font-roboto', // Define a CSS variable
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={roboto.variable}>
      <head>
      <meta name="apple-mobile-web-app-title" content="Candor" />
      </head>
      <body>
        <AuthProvider>
          {children}
          <Analytics />
          <SpeedInsights />
        </AuthProvider>
      </body>
    </html>
  );
}