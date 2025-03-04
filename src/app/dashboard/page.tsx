'use client';

import { useAuth, useIsAdmin } from '@/lib/context/auth-context';

export default function DashboardPage() {
  const { user, memberStatus } = useAuth();
  const { isAdmin } = useIsAdmin();
  
  return (
    <>
    {memberStatus === 'pending' && (
      <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-md text-sm text-center">
        <p className="text-amber-700">
          <strong>Account Pending Approval.</strong> Your account is waiting for admin approval. Some features may be limited until your account is approved.
        </p>
      </div>
    )}
    <div className="container mx-auto py-8 px-4">
      <h3 className='text-2xl font-light text-berkeleyblue'>Dashboard</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="p-6 bg-white rounded-lg shadow-sm border">
          <h2 className="text-xl font-semibold mb-4">Welcome, {user?.user_metadata?.name || 'User'}</h2>
          <p>Your dashboard is ready.</p>
          <p>Account status: {memberStatus}</p>
          {isAdmin && (
            <p className="mt-4 text-amber-700">
              <strong>Admin:</strong> You have access to admin features.
            </p>
          )}
        </div>
      </div>
    </div>
    </>
  );
}