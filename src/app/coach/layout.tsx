// app/coach/layout.tsx
// Create this file if it doesn't exist

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Candor Coach - AI-powered Career Coaching',
  description: '24/7 AI-powered career coaching via text message. No apps to download, just text us anytime for personalized guidance.',
  openGraph: {
    title: 'Candor Coach - AI-powered Career Coaching',
    description: '24/7 AI-powered career coaching via text message. No apps to download, just text us anytime for personalized guidance.',
    images: [
      {
        url: '/og-coach-image.jpg', // Create this image in your public folder
        width: 1200,
        height: 630,
        alt: 'Candor Coach',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Candor Coach - AI-powered Career Coaching',
    description: '24/7 AI-powered career coaching via text message. No apps to download, just text us anytime for personalized guidance.',
    images: ['/og-coach-image.jpg'],
  },
}

export default function CoachLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>{children}</>
  )
}