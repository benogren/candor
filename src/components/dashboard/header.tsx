'use client';

import { useState, useEffect, ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import supabase from '@/lib/supabase/client';
import { useAuth } from '@/lib/context/auth-context';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [permissionCheckAttempts, setPermissionCheckAttempts] = useState(0);
  
  const ADMIN_ONLY_PATHS = ['/dashboard/team'];
  const requiresAdmin = ADMIN_ONLY_PATHS.some(path => pathname?.startsWith(path));

  // Add initial delay to ensure auth is loaded
  useEffect(() => {
    async function checkPermissions() {
      try {
        console.log("Checking permissions... Attempt:", permissionCheckAttempts + 1);
        
        // Don't proceed if we don't have a user ID
        if (!user?.id) {
          // console.log("Skipping permission check - waiting for user data");
          setPermissionCheckAttempts(prev => prev + 1);
          return;
        }
        
        // First, ensure we have the latest member status
        if (refreshStatus) {
          await refreshStatus();
        } else {
          console.error("refreshStatus is undefined!");
        }
  
        // Handle deactivated users
        if (memberStatus === "deactivated") {
          router.push("/deactivated");
          return;
        }
  
        // Check admin privileges if needed
        if (requiresAdmin || isAdmin === null) {
          const { data, error } = await supabase
            .from("company_members")
            .select("role")
            .eq("id", user.id)
            .single();
            
          if (error) {
            console.error("Error checking admin status:", error);
            
            // If we've already tried a few times and still have an error,
            // redirect to dashboard rather than getting stuck
            if (permissionCheckAttempts >= 2) {
              toast({
                title: "Error checking permissions",
                description: "Redirecting to dashboard for safety",
                variant: "destructive",
              });
              router.push("/dashboard");
              return;
            }
            
            // Increment attempts and try again
            setPermissionCheckAttempts(prev => prev + 1);
            setIsLoading(true);
            return;
          }
  
          const userIsAdmin = data.role === "admin";
          setIsAdmin(userIsAdmin);
  
          if (requiresAdmin && !userIsAdmin) {
            toast({
              title: "Access Denied",
              description: "You need admin privileges to access this page.",
              variant: "destructive",
            });
            router.push("/dashboard");
            return;
          }
        }
  
        // Show pending notification if needed
        if (memberStatus === "pending") {
          toast({
            title: "Account Pending Approval",
            description: "Your account is waiting for admin approval.",
            variant: "default",
          });
        }
  
        setIsLoading(false);
      } catch (error) {
        console.error("Error checking permissions:", error);
        setIsLoading(false);
      }
    }
    
    const initialCheckDelay = setTimeout(() => {
      checkPermissions();
    }, 500);
    
    return () => clearTimeout(initialCheckDelay);
  }, [user, router, memberStatus, refreshStatus, requiresAdmin, isAdmin, permissionCheckAttempts]);

  // Increase the timeout to give more time for admin checks to complete
  useEffect(() => {
    if (!isLoading) return;
    
    const timeout = setTimeout(() => {
      // console.log("Permission check timeout triggered");
      
      if (isLoading) {
        // If still loading after multiple attempts, give up and redirect
        if (permissionCheckAttempts >= 2) {
          setIsLoading(false);
          if (requiresAdmin && isAdmin !== true) {
            // console.log("Redirecting to dashboard after timeout");
            router.push("/dashboard");
          }
        } else {
          // Try one more time before giving up
          setPermissionCheckAttempts(prev => prev + 1);
        }
      }
    }, 5000); // Extended to 5 seconds
    
    return () => clearTimeout(timeout);
  }, [isLoading, requiresAdmin, isAdmin, router, permissionCheckAttempts]);

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

  if (requiresAdmin && isLoading) {
    return (
      <>
        <header className="bg-white shadow-sm">
          <div className="container mx-auto px-4 py-3 flex justify-between items-center">
            <div className="flex items-center">
              <Link href="/dashboard" className="text-xl font-bold text-slate-900">
                <Image src="/logo/candor_cerulean.png" alt="Candor" width={98} height={25} priority />
              </Link>
              <span className="ml-4 text-sm text-slate-500">{company?.name}</span>
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
          <p className="text-gray-500">Checking permissions... {permissionCheckAttempts > 0 ? `(Attempt ${permissionCheckAttempts + 1})` : ''}</p>
        </div>
      </>
    );
  }

  return (
    <>
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <Link href="/dashboard" className="text-xl font-bold text-slate-900">
            <Image src="/logo/candor_cerulean.png" alt="Candor" width={98} height={25} />
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative rounded-full">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200">
                  {getInitial()}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleSignOut}>Sign Out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <main>{children}</main>
    </>
  );
}