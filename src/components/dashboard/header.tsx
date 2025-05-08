'use client';

import { ReactNode, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import supabase from '@/lib/supabase/client';
import { useAuth, useIsAdmin } from '@/lib/context/auth-context';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu';
import { toast } from '@/components/ui/use-toast';
import { RefreshCw } from 'lucide-react';

type HeaderProps = {
  user: {
    id: string;
    email?: string;
    user_metadata?: {
      name?: string;
    };
  };
  company: {
    id: string;
    name: string;
    domains?: string[];
  };
  children: ReactNode;
};

export default function Header({ user, company, children }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { memberStatus, refreshStatus } = useAuth();
  const { isAdmin, loading: isAdminLoading } = useIsAdmin();
  
  const ADMIN_ONLY_PATHS = ['/dashboard/team', '/dashboard/admin/orgchart'];
  const requiresAdmin = ADMIN_ONLY_PATHS.some(path => pathname?.startsWith(path));

  // Check if user has permission to access this page
  useEffect(() => {
    async function checkAccess() {
      // Ensure we have the latest member status
      if (refreshStatus) {
        await refreshStatus();
      }

      // Handle deactivated users
      if (memberStatus === "deactivated") {
        router.push("/deactivated");
        return;
      }

      // Check admin access for restricted pages
      if (requiresAdmin && !isAdmin && !isAdminLoading) {
        toast({
          title: "Access Denied",
          description: "You need admin privileges to access this page.",
          variant: "destructive",
        });
        router.push("/dashboard");
        return;
      }

      // Show pending notification if needed
      if (memberStatus === "pending") {
        toast({
          title: "Account Pending Approval",
          description: "Your account is waiting for admin approval.",
          variant: "default",
        });
      }
    }
    
    checkAccess();
  }, [user, router, memberStatus, refreshStatus, requiresAdmin, isAdmin, isAdminLoading]);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      toast({ title: "Signed out successfully" });
      router.push("/");
      router.refresh();
    } catch (error: unknown) {
      console.error("Error signing out:", error);
      toast({ title: "Error signing out", description: "Please try again", variant: "destructive" });
    }
  };

  const getInitial = (): string => {
    if (user?.user_metadata?.name) {
      return user.user_metadata.name.charAt(0).toUpperCase();
    }
    if (user?.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return "U";
  };

  if (requiresAdmin && isAdminLoading) {
    return (
      <>
        <header className="bg-white shadow-sm">
          <div className="container mx-auto flex justify-between items-center">
            <div className="flex items-center">
              <Link href="/dashboard" className="text-xl font-bold text-slate-900">
                <Image src="/logo/candor_cerulean.png" alt="Candor" width={98} height={25} priority />
              </Link>
              <span className="text-sm text-slate-500">{company?.name}</span>
            </div>
            <Button variant="ghost" className="relative rounded-full" disabled>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200">
                {getInitial()}
              </span>
            </Button>
          </div>
        </header>
        <div className="flex flex-col justify-center items-center min-h-screen">
          <RefreshCw className="h-8 w-8 animate-spin text-gray-400 mb-2" />
          <p className="text-gray-500">Checking permissions...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center ml-2">
            <Link href="/dashboard" className="text-xl font-bold text-slate-900">
              <Image src="/logo/candor_cerulean.png" alt="Candor" width={98} height={24} />
            </Link>
            {company?.name && (
              <span className="ml-4 mt-2 text-sm text-slate-500">{company.name}</span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative rounded-full">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200">
                    {getInitial()}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isAdmin && (
                  <>
                    <DropdownMenuLabel>{company.name}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard/admin">Admin Dashboard</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard/admin/orgchart">&mdash; Org Chart</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard/admin/feedback/cycles">&mdash; Feedback Cycles</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard/admin/feedback/questions">&mdash; Feedback Questions</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard/admin/company-values">&mdash; Company Values</Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem asChild>
                  <Link href="/dashboard">Dashboard</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/settings">Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>Sign Out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </>
  );
}