'use client';

import { useAuth } from '@/lib/context/auth-context';

export default function DashboardPage() {
  const { user, memberStatus } = useAuth();
  
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      
      {memberStatus === 'pending' && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-md">
          <h2 className="text-lg font-semibold text-amber-800 mb-2">Account Pending Approval</h2>
          <p className="text-amber-700">
            Your account is waiting for admin approval. Some features may be limited until your account is approved.
          </p>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="p-6 bg-white rounded-lg shadow-sm border">
          <h2 className="text-xl font-semibold mb-4">Welcome, {user?.user_metadata?.name || 'User'}</h2>
          <p>Your dashboard is ready.</p>
        </div>
      </div>
    </div>
  );
}