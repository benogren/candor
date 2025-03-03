// app/page.tsx
'use client';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useAuth } from '@/lib/context/auth-context';
import { redirect } from "next/navigation";
import Image from 'next/image';

export default function Home() {
  const { user } = useAuth();

  if (user) {
    console.log('Landing Page: User is logged in, redirecting to dashboard');
    redirect('/dashboard');
  }

  return (
    <div className="flex flex-col min-h-screen">
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="text-xl font-bold text-slate-900">
            <Image src="/logo/candor_cerulean.png" alt="Candor" width={98} height={25} priority={true} />
          </div>
          <div>
            <Button asChild variant="ghost">
              <Link href="/auth/login">Login</Link>
            </Button>
            <Button asChild>
              <Link href="/auth/register">Register</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center bg-slate-50">
        <div className="container mx-auto px-4 py-16 flex flex-col items-center text-center">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">
            Honest Feedback Made Simple
          </h1>
          <p className="text-slate-600 max-w-2xl mb-8">
            An AI-powered 360 feedback app that helps teams collect frequent,
            high-quality, anonymous feedback. Empower employees and enable managers
            to have more effective career conversations.
          </p>
          <Button asChild size="lg">
            <Link href="/auth/register">Get Started</Link>
          </Button>
        </div>
      </main>

      <footer className="bg-white py-6">
        <div className="container mx-auto px-4 text-center text-slate-500 text-sm">
          © {new Date().getFullYear()} Candor. All rights reserved.
        </div>
      </footer>
    </div>
  );
}