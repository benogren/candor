// src/components/Sidebar.tsx
'use client';

import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export default function Sidebar({ isOpen, onClose, title = 'Details', children }: SidebarProps) {
  // Prevent scrolling on body when sidebar is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'overflow-y-auto';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <div
      className={`fixed top-0 right-0 z-40 h-screen overflow-y-auto transition-transform duration-300 ease-in-out bg-gray-50 border-l border-gray-200 shadow-lg ${
        isOpen ? 'translate-x-0 w-1/2' : 'translate-x-full w-0'
      }`}
    >
      <div className="p-4 sticky top-0 bg-gray-50 border-b z-10 flex justify-between items-center">
        <h3 className="text-lg font-light text-berkeleyblue">{title}</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}