// app/thank-you/page.tsx
import { Suspense } from 'react';
import { radley } from '../fonts';
import Header from '@/components/marketing/Header';
import Footer from '@/components/marketing/Footer';
import ThankYouContent from './ThankYouContent';

export default function ThankYouPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center bg-slate-50">
        <div className="container mx-auto px-16 py-16 flex flex-col items-center">
          <h1 className={`text-6xl font-light text-cerulean max-w-xl text-center ${radley.className}`}>
            Thank You!
          </h1>
          
          <Suspense fallback={<div>Loading...</div>}>
            <ThankYouContent />
          </Suspense>
        </div>
      </main>

      <Footer />
    </div>
  );
}