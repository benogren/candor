import Link from 'next/link';
import Image from 'next/image';
import { LinkedInLogoIcon, TwitterLogoIcon } from '@radix-ui/react-icons';

export default function Footer() {
    return (
      //   <footer className="bg-white py-8">
      //   <div className="container mx-auto px-4 text-center text-berkeleyblue text-sm">
      //     <Image src="/logo/candor_berkeleyblue.png" alt="Candor" width={75} height={18} priority={true} className='mx-auto mb-4' />
      //     <div className="flex justify-center space-x-4 mb-4">
      //       <Link href="/terms" className="text-slate-500 hover:text-cerulean">Terms of Use</Link>
      //       <Link href="/privacy" className="text-slate-500 hover:text-cerulean">Privacy Policy</Link>
      //     </div>
      //     &copy; {new Date().getFullYear()} Candor. All rights reserved.
      //   </div>
      // </footer>
      <footer className="bg-white text-slate-500 py-10">
  <div className="container mx-auto px-6">
    <div className="flex flex-col md:flex-row justify-between">
      <div className="mb-6 md:mb-0">
        <Image src="/logo/candor_berkeleyblue.png" alt="Candor" width={98} height={24} priority={true} className='' />
        <p className="text-slate-400 max-w-xs mt-4">
          Transforming performance management with continuous, AI-powered feedback.
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h3 className="text-lg mb-4 text-berkeleyblue">Product</h3>
          <ul className="space-y-2 text-slate-400">
            <li><Link href="/#features" className="hover:text-slate-500 transition duration-200">Features</Link></li>
            <li><Link href="/pricing" className="hover:text-slate-500 transition duration-200">Pricing</Link></li>
            {/* <li><a href="#" className="hover:text-slate-500 transition duration-200">FAQ</a></li> */}
            <li><Link href="/book-a-demo" className="hover:text-slate-500 transition duration-200">Request Demo</Link></li>
          </ul>
        </div>
        
        <div>
          <h3 className="text-lg mb-4 text-berkeleyblue">Use Cases</h3>
          <ul className="space-y-2 text-slate-400">
            <li>Performance Reviews</li>
            <li>Talent Reviews</li>
            <li>Calibration</li>
            <li>1:1 Meeting Prep</li>
            <li>Onboarding</li>
            <li>Self Evaluations</li>
            <li>Employee Recognition</li>
          </ul>
        </div>
        
      </div>
    </div>
    
    <div className="border-t border-slate-300 mt-10 pt-6 flex flex-col md:flex-row justify-between items-center">
      <div className="flex space-x-4">
        <p className="text-gray-400 mb-4 md:mb-0">&copy; {new Date().getFullYear()} Candor 360, Inc. All rights reserved.</p>
        <Link href="/terms" className="text-slate-400 hover:text-slate-500 transition duration-200">Terms of Use</Link>
        <Link href="/privacy" className="text-slate-400 hover:text-slate-500 transition duration-200">Privacy Policy</Link>
      </div>
      <div className="flex space-x-4">
        <a href="https://x.com/candorso" target='_blank' className="text-slate-400 hover:text-slate-500 transition duration-200">
          <TwitterLogoIcon className="w-6 h-6" />
        </a>
        <Link href="https://linkedin.com/company/candorso" target='_blank' className="text-slate-400 hover:text-slate-500 transition duration-200">
          <LinkedInLogoIcon className="w-6 h-6" />
        </Link>
      </div>
    </div>
  </div>
</footer>
    )
}