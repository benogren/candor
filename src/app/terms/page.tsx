'use client';

import Image from 'next/image';
import Link from 'next/link';
import { radley } from '../fonts';

export default function TermsPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="text-xl font-bold text-slate-900 mt-2 mb-2">
            <Link href="/">
              <Image src="/logo/candor_cerulean.png" alt="Candor" width={98} height={24} priority={true} />
            </Link>
          </div>
          <div className="hidden md:flex space-x-6 items-center text-slate-500 text-base font-light">
            {/* <Link href="/#features" className="">Features</Link>
            <Link href="/#use-cases" className="">Use Cases</Link>
            <Link className='bg-cerulean text-primary-foreground hover:bg-cerulean-600 rounded-md text-sm font-normal h-9 px-4 py-2' href='/book-a-demo'>Book a Demo</Link> */}
          </div>
        </div>
      </header>

      <main className="flex-1 bg-slate-50 py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto bg-white p-8 rounded-lg shadow">
            <h1 className={`text-3xl font-light text-cerulean mb-6 ${radley.className}`}>
              Terms of Use
            </h1>
            
            <div className="prose text-slate-700">
              <p className="text-lg font-medium">Last Updated: April 6, 2025</p>
              
              <h2 className="text-xl text-slate-900 mt-8 mb-4">1. Acceptance of Terms</h2>
              <p>
                Welcome to Candor. By accessing or using our website, mobile applications, or any other services provided by Candor (collectively, the &quot;Services&quot;), you agree to be bound by these Terms of Use, our Privacy Policy, and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using or accessing the Services.
              </p>
              
              <h2 className="text-xl text-slate-900 mt-8 mb-4">2. Description of Services</h2>
              <p>
                Candor provides an AI-powered 360-degree feedback platform designed to help organizations collect, analyze, and leverage employee feedback. Our Services include but are not limited to feedback collection, analysis, reporting, and integration with other workplace tools.
              </p>
              
              <h2 className="text-xl text-slate-900 mt-8 mb-4">3. User Accounts</h2>
              <p>
                To use certain features of our Services, you may be required to create an account. You are responsible for maintaining the confidentiality of your account information and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use of your account.
              </p>
              
              <h2 className="text-xl text-slate-900 mt-8 mb-4">4. Data Privacy and Security</h2>
              <p>
                Protection of your data is important to us. Our Privacy Policy explains how we collect, use, and safeguard the information you provide to us. By using our Services, you consent to the data practices described in our Privacy Policy.
              </p>
              
              <h2 className="text-xl text-slate-900 mt-8 mb-4">5. User Content</h2>
              <p>
                Our Services allow users to submit feedback, comments, and other content. You retain ownership of any content you submit, but you grant Candor a worldwide, non-exclusive, royalty-free license to use, reproduce, modify, adapt, publish, and display such content for the purpose of providing and improving our Services.
              </p>
              
              <h2 className="text-xl text-slate-900 mt-8 mb-4">6. Prohibited Uses</h2>
              <p>
                You agree not to use our Services to:
              </p>
              <ul className="list-disc pl-6 mb-4">
                <li>Violate any applicable laws or regulations</li>
                <li>Infringe upon the rights of others</li>
                <li>Submit false or misleading information</li>
                <li>Upload or transmit viruses or malicious code</li>
                <li>Interfere with or disrupt the integrity of our Services</li>
                <li>Harass, abuse, or harm another person</li>
                <li>Collect or track personal information of others without consent</li>
              </ul>
              
              <h2 className="text-xl text-slate-900 mt-8 mb-4">7. Intellectual Property</h2>
              <p>
                The Services and their original content, features, and functionality are owned by Candor and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws. You may not reproduce, distribute, modify, create derivative works of, publicly display, or exploit any part of our Services without our prior written consent.
              </p>
              
              <h2 className="text-xl text-slate-900 mt-8 mb-4">8. Subscription and Billing</h2>
              <p>
                Some of our Services are offered on a subscription basis. By subscribing to our Services, you agree to the pricing and payment terms listed at the time of purchase. Subscription fees are billed in advance and are non-refundable. We may change subscription fees upon reasonable notice.
              </p>
              
              <h2 className="text-xl text-slate-900 mt-8 mb-4">9. Termination</h2>
              <p>
                We may terminate or suspend your account and access to our Services immediately, without prior notice, for conduct that we believe violates these Terms of Use or is harmful to other users, us, or third parties, or for any other reason at our sole discretion.
              </p>
              
              <h2 className="text-xl text-slate-900 mt-8 mb-4">10. Limitation of Liability</h2>
              <p>
                In no event shall Candor, its directors, employees, partners, agents, suppliers, or affiliates be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the Services.
              </p>
              
              <h2 className="text-xl text-slate-900 mt-8 mb-4">11. Governing Law</h2>
              <p>
                These Terms shall be governed by and construed in accordance with the laws of the United States, without regard to its conflict of law provisions.
              </p>
              
              <h2 className="text-xl text-slate-900 mt-8 mb-4">12. Changes to Terms</h2>
              <p>
                We reserve the right to modify these Terms at any time. We will provide notice of any significant changes by updating the &quot;Last Updated&quot; date at the top of these Terms and/or by sending you an email. Your continued use of the Services after such modifications will constitute your acknowledgment and acceptance of the modified Terms.
              </p>
              
              <h2 className="text-xl text-slate-900 mt-8 mb-4">13. Contact Us</h2>
              <p>
                If you have any questions about these Terms, please contact us at support@candor.so
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-white py-8">
        <div className="container mx-auto px-4 text-center text-berkeleyblue text-sm">
          <Image src="/logo/candor_berkeleyblue.png" alt="Candor" width={75} height={18} priority={true} className='mx-auto mb-4' />
          <div className="flex justify-center space-x-4 mb-4">
            <Link href="/terms" className="text-slate-500 hover:text-cerulean">Terms of Use</Link>
            <Link href="/privacy" className="text-slate-500 hover:text-cerulean">Privacy Policy</Link>
          </div>
          &copy; {new Date().getFullYear()} Candor. All rights reserved.
        </div>
      </footer>
    </div>
  );
}