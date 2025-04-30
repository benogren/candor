import Link from 'next/link';
import Image from 'next/image';

export default function Header() {
    return (
        <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="text-xl font-bold text-slate-900">
            <Link href="/">
              <Image src="/logo/candor_cerulean.png" alt="Candor" width={98} height={24} priority={true} />
            </Link>
          </div>
          <div className="hidden md:flex space-x-6 items-center text-slate-500 text-base font-light">
            <Link href="/#features" className="">Features</Link>
            <Link href="/pricing" className="">Pricing</Link>
            <Link className='bg-cerulean text-primary-foreground hover:bg-cerulean-600 rounded-md text-sm font-normal h-9 px-4 py-2' href='/auth/register'>Start Free Trial</Link>
          </div>
        </div>
      </header>
    )
}