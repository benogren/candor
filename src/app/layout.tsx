// app/layout.tsx


import { AuthProvider } from '@/lib/context/auth-context';
import { Analytics } from "@vercel/analytics/react"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { pt_sans } from './fonts';
import './globals.css';

export const metadata = {
  metadataBase: new URL('https://candor.so'),
  title: {
    template: '%s | Candor',
    default: 'Candor - AI-Powered 360-Degree Feedback',
  },
  description: 'Transform workplace feedback from a dreaded annual event into an ongoing conversation that drives growth with Candor\'s AI-powered platform.',
  keywords: ['360 feedback', 'performance management', 'Performance Reviews', 'Employee Recognition', 'Employee Engagement', 'AI-Powered Feedback', 'Continuous Feedback', 'Feedback Culture', 'Employee Development'],
  authors: [{ name: 'Candor Team', url: 'https://candor.so' }],
  creator: 'Candor',
  publisher: 'Candor',
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://candor.so',
    siteName: 'Candor',
    images: [
      {
        url: '/public/og-default.png',
        width: 1200,
        height: 630,
        alt: 'Candor - AI-Powered 360° Feedback',
      },
    ],
  },
  // twitter: {
  //   card: 'summary_large_image',
  //   site: '@CandorAI',
  //   creator: '@CandorAI',
  // },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={pt_sans.className}>
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