// src/lib/context/sidebar-context.tsx
'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface SidebarContextProps {
  openSidebar: (content: ReactNode, title?: string) => void;
  closeSidebar: () => void;
  isSidebarOpen: boolean;
  sidebarContent: ReactNode;
  sidebarTitle: string;
}

const SidebarContext = createContext<SidebarContextProps | undefined>(undefined);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarContent, setSidebarContent] = useState<ReactNode>(null);
  const [sidebarTitle, setSidebarTitle] = useState('Details');

  const openSidebar = (content: ReactNode, title: string = 'Details') => {
    setSidebarContent(content);
    setSidebarTitle(title);
    setIsSidebarOpen(true);
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  return (
    <SidebarContext.Provider
      value={{
        openSidebar,
        closeSidebar,
        isSidebarOpen,
        sidebarContent,
        sidebarTitle,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}