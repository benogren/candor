// auth/register/invite/page.tsx
'use client';

import { Suspense } from 'react';
import RegisterInviteContent from './RegisterInviteContent';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export default function RegisterInvitePage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center min-h-screen bg-slate-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Loading</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center p-6">
            <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
          </CardContent>
        </Card>
      </div>
    }>
      <RegisterInviteContent />
    </Suspense>
  );
}