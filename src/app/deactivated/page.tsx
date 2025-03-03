'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { XCircle } from 'lucide-react';
import { useAuth } from '@/lib/context/auth-context';

export default function DeactivatedAccountPage() {
  const { user, logout } = useAuth();
  
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-red-100 p-3 rounded-full">
              <XCircle className="h-12 w-12 text-red-600" />
            </div>
          </div>
          <CardTitle className="text-2xl">Account Deactivated</CardTitle>
          <CardDescription>
            Your access to Candor has been deactivated.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="mb-6">
            {user?.email ? (
              <>Your account <span className="font-medium">{user.email}</span> has been deactivated by your organization&#39;s administrator.</>
            ) : (
              <>Your account has been deactivated by your organization&#39;s administrator.</>
            )}
          </p>
          <p className="text-sm text-slate-500">
            If you believe this is a mistake, please contact your manager or administrator.
          </p>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button 
            variant="outline" 
            onClick={logout}
          >
            Sign Out
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}