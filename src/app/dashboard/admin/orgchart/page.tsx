'use client';

import React from 'react';
import { useIsAdmin } from '@/lib/context/auth-context';
import OrgChartContainer from './OrgChartContainer';
import { LoadingSpinner } from '@/components/loading-spinner';

export default function OrgChartPage() {
  const { isAdmin, loading } = useIsAdmin();

  // Show loading state
  if (loading) {
    return (
      <>
      <LoadingSpinner />
      </>
    );
  }

  // Show unauthorized message if not admin
  if (!isAdmin) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 p-4 rounded-md">
          <p className="text-red-700">
            You do not have permission to access this page. This feature is only available to administrators.
          </p>
        </div>
      </div>
    );
  }

  // Show org chart if admin
  return <OrgChartContainer />;
}