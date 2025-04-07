'use client';

import Image from 'next/image';
import Link from 'next/link';
import { radley } from '../fonts';

export default function PrivacyPage() {
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
              Privacy Policy
            </h1>
            
            <div className="prose text-slate-700">
              <p className="text-lg font-medium">Last Updated: April 6, 2025</p>
              
              <h2 className="text-xl text-slate-900 mt-8 mb-4">1. Introduction</h2>
              <p>
                At Candor, we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our website, mobile application, and other services (collectively, the &quot;Services&quot;). Please read this Privacy Policy carefully. By using our Services, you consent to the data practices described in this policy.
              </p>
              
              <h2 className="text-xl text-slate-900 mt-8 mb-4">2. Information We Collect</h2>
              
              <h3 className="text-lg text-slate-900 mt-6 mb-2">2.1 Personal Information</h3>
              <p>
                We may collect personal information that you provide directly to us, including:
              </p>
              <ul className="list-disc pl-6 mb-4">
                <li>Name, email address, and contact details</li>
                <li>Job title and company information</li>
                <li>Account credentials</li>
                <li>Profile information</li>
                <li>Feedback and survey responses</li>
                <li>Communications and correspondence with us</li>
              </ul>
              
              <h3 className="text-lg text-slate-900 mt-6 mb-2">2.2 Usage and Technical Data</h3>
              <p>
                When you use our Services, we may automatically collect:
              </p>
              <ul className="list-disc pl-6 mb-4">
                <li>IP address and device information</li>
                <li>Browser type and settings</li>
                <li>Usage patterns and statistics</li>
                <li>Log information and analytics data</li>
                <li>Cookies and similar tracking technologies</li>
              </ul>
              
              <h2 className="text-xl text-slate-900 mt-8 mb-4">3. How We Use Your Information</h2>
              <p>
                We may use the information we collect for various purposes, including:
              </p>
              <ul className="list-disc pl-6 mb-4">
                <li>Providing, maintaining, and improving our Services</li>
                <li>Processing transactions and managing accounts</li>
                <li>Communicating with you about our Services</li>
                <li>Personalizing your experience</li>
                <li>Analyzing usage patterns and trends</li>
                <li>Protecting our Services and users</li>
                <li>Complying with legal obligations</li>
              </ul>
              
              <h2 className="text-xl text-slate-900 mt-8 mb-4">4. How We Share Your Information</h2>
              <p>
                We may share your information in the following circumstances:
              </p>
              <ul className="list-disc pl-6 mb-4">
                <li>With your organization if you use our Services through an employer-provided account</li>
                <li>With service providers who perform services on our behalf</li>
                <li>With third-party integrations you choose to enable</li>
                <li>In connection with a business transfer or transaction</li>
                <li>When required by law or to protect rights and safety</li>
              </ul>
              
              <h2 className="text-xl text-slate-900 mt-8 mb-4">5. Data Security</h2>
              <p>
                We implement appropriate technical and organizational security measures to protect your information from unauthorized access, disclosure, alteration, and destruction. However, no method of transmission over the Internet or electronic storage is 100% secure, and we cannot guarantee absolute security.
              </p>
              
              <h2 className="text-xl text-slate-900 mt-8 mb-4">6. Data Retention</h2>
              <p>
                We retain your information for as long as necessary to fulfill the purposes outlined in this Privacy Policy, unless a longer retention period is required or permitted by law. When determining how long to retain information, we consider the amount, nature, and sensitivity of the information, the potential risk of harm from unauthorized use or disclosure, and applicable legal requirements.
              </p>
              
              <h2 className="text-xl text-slate-900 mt-8 mb-4">7. Your Rights and Choices</h2>
              <p>
                Depending on your location, you may have certain rights regarding your personal information, including:
              </p>
              <ul className="list-disc pl-6 mb-4">
                <li>Accessing and updating your information</li>
                <li>Requesting deletion of your information</li>
                <li>Opting out of certain data collection or uses</li>
                <li>Withdrawing consent (where applicable)</li>
                <li>Data portability</li>
              </ul>
              <p>
                To exercise these rights, please contact us using the information provided in the &quot;Contact Us&quot; section below.
              </p>
              
              <h2 className="text-xl text-slate-900 mt-8 mb-4">8. Children&apos;s Privacy</h2>
              <p>
                Our Services are not intended for individuals under the age of 18. We do not knowingly collect personal information from children under 18. If we learn that we have collected personal information from a child under 18, we will take steps to delete such information as soon as possible.
              </p>
              
              <h2 className="text-xl text-slate-900 mt-8 mb-4">9. International Data Transfers</h2>
              <p>
                Your information may be transferred to, and maintained on, computers located outside of your state, province, country, or other governmental jurisdiction where the data protection laws may differ from those in your jurisdiction. We will take appropriate measures to protect your information in accordance with this Privacy Policy.
              </p>
              
              <h2 className="text-xl text-slate-900 mt-8 mb-4">10. Changes to This Privacy Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the &quot;Last Updated&quot; date. You are advised to review this Privacy Policy periodically for any changes.
              </p>
              
              <h2 className="text-xl text-slate-900 mt-8 mb-4">11. Contact Us</h2>
              <p>
                If you have any questions or concerns about this Privacy Policy or our data practices, please contact us at:
              </p>
              <p className="mt-2">
                <strong>Email:</strong> privacy@candor.ai<br />
                <strong>Address:</strong> 123 Feedback Avenue, Suite 360, San Francisco, CA 94103
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