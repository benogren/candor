'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  HomeIcon,
  ChevronUp,
  Building2,
  BotMessageSquare,
  Medal,
  Network,
  LucideMessageCircleQuestion,
  Shell
} from 'lucide-react';
import supabase from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/ui/use-toast';
import Image from 'next/image';
import { useIsAdmin } from '@/lib/context/auth-context';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar
} from "@/components/ui/sidebar"
import { 
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuContent
} from '../ui/dropdown-menu';
import { Avatar, AvatarFallback } from '../ui/avatar';

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
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
}

export function DashSidebar({ user, company }: SidebarProps) {
  // const pathname = usePathname();
  const router = useRouter();
  const { isAdmin } = useIsAdmin();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';

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

  const navItems = [
    {
      title: 'Dashboard',
      href: '/dashboard',
      icon: <HomeIcon className="w-5 h-5" />,
    },
    {
      title: 'Feedback Coach',
      href: '/dashboard/coach',
      icon: <BotMessageSquare className="w-5 h-5" />,
    },
  ];

  const adminNavItems = [
    {
      title: 'Admin Dashboard',
      href: '/dashboard/admin',
      icon: <Building2 className="w-5 h-5" />,
    },
    {
      title: 'Org Chart',
      href: '/dashboard/admin/orgchart',
      icon: <Network className="w-5 h-5" />,
    },
    {
      title: 'Feedback Cycles',
      href: '/dashboard/admin/feedback/cycles',
      icon: <Shell className="w-5 h-5" />,
    },
    {
      title: 'Feedback Questions',
      href: '/dashboard/admin/feedback/questions',
      icon: <LucideMessageCircleQuestion className="w-5 h-5" />,
    },
    {
      title: 'Company Values',
      href: '/dashboard/admin/company-values',
      icon: <Medal className="w-5 h-5" />,
    },
  ];

  return (
    <Sidebar 
      className={cn(
        'border-r border-slate-200 bg-white transition-all duration-300 text-slate-500',
        isCollapsed ? 'w-16' : 'w-64'
      )}
    >
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className='flex items-center mt-2 mb-4'>
            {!isCollapsed ? (
              <Link href="/dashboard" className="text-xl font-bold text-slate-900">
                <Image src="/logo/candor_cerulean.png" alt="Candor" width={98} height={25} priority />
              </Link>
            ) : (
              <Link href="/dashboard" className="flex justify-center w-full">
                <Image src="/logo/candor-icon.png" alt="C" width={24} height={24} priority />
              </Link>
            )}
          </SidebarGroupLabel>
          <SidebarSeparator className='mb-4' />
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <a href={item.href} className="flex items-center">
                      {isCollapsed
                          ? <span className="flex justify-center w-full">{item.icon}</span>
                          : item.icon
                        }
                      {!isCollapsed && <span className="ml-3">{item.title}</span>}
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
          {isAdmin && (
            <>
              {!isCollapsed && <SidebarGroupLabel className='mt-4'>{company?.name}</SidebarGroupLabel>}
              <SidebarGroupContent>
                <SidebarMenu>
                  {adminNavItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <a href={item.href} className="flex items-center">
                        {isCollapsed
                          ? <span className="flex justify-center w-full">{item.icon}</span>
                          : item.icon
                        }
                        {!isCollapsed && <span className="ml-3">{item.title}</span>}
                        </a>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </>
          )}
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className='w-full'>
        <SidebarMenu className='w-full'>
          <SidebarMenuItem className='w-full'>
            <DropdownMenu>
              <DropdownMenuTrigger asChild className='h-18'>
                <SidebarMenuButton className="flex items-center p-2">
                {isCollapsed
                  ? 
                  <Avatar className='justify-center w-full h-[30px]'>
                    <AvatarFallback className='bg-slate-200'>
                    {getInitial()}
                    </AvatarFallback>
                  </Avatar>
                  : 
                  <Avatar>
                    <AvatarFallback className='bg-slate-200'>
                    {getInitial()}
                    </AvatarFallback>
                </Avatar>
                }
                  {!isCollapsed && (
                    <>
                      <span className="max-w-24 truncate">
                        {user?.user_metadata?.name || user?.email}
                      </span>
                      <ChevronUp className="ml-auto" />
                    </>
                  )}
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                className="w-48"
              >
                <DropdownMenuItem>
                  <Link href={`/dashboard/settings`} className="w-full">
                    <span>Settings</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSignOut}>
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}