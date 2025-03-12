'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/lib/context/auth-context';


export default function FeedbackHeader() {
    const { user } = useAuth();

  const getInitial = (): string => {
    if (user?.user_metadata?.name) {
      return user.user_metadata.name.charAt(0).toUpperCase();
    }
    if (user?.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return "U";
  };

  return (
    <>
      <header className="bg-white p-8">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center">
            <Link href="/dashboard" className="text-xl font-bold text-slate-900">
              <Image src="/logo/candor_cerulean.png" alt="Candor" width={98} height={25} />
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <div className='font-normal text-sm px-4'>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-cerulean">
                {getInitial()}
            </span>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}