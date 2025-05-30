// components/feedback-coach/FeedbackActionButton.tsx
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { NotepadText, NotebookPen, Plus } from 'lucide-react';
import { FeedbackCoachVariant, FeedbackCoachMode } from './FeedbackCoachPanel';

interface FeedbackActionButtonProps {
  type: 'prep' | 'review';
  variant?: FeedbackCoachVariant;
  mode?: FeedbackCoachMode;
  onClick: () => Promise<void>;
  isLoading?: boolean;
  targetName?: string;
}

export function FeedbackActionButton({
  type,
  variant = 'full',
  mode = 'personal',
  onClick,
  isLoading = false,
  targetName
}: FeedbackActionButtonProps) {
  const getButtonClass = () => {
    switch (variant) {
      case 'full':
        return 'w-full flex items-center justify-between px-4 py-12 text-left';
      case 'compact':
        return 'w-full flex items-center justify-between py-6 text-left';
      case 'minimal':
        return 'w-full flex items-center justify-between py-3 text-left text-sm';
      default:
        return 'w-full flex items-center justify-between py-6 text-left';
    }
  };

  const getIconSize = () => {
    switch (variant) {
      case 'full':
        return 'h-7 w-7';
      case 'compact':
        return 'h-4 w-4';
      case 'minimal':
        return 'h-4 w-4';
      default:
        return 'h-5 w-5';
    }
  };

  const getTextClass = () => {
    switch (variant) {
      case 'full':
        return 'font-light text-lg text-cerulean';
      case 'compact':
        return 'font-light text-sm text-slate-500';
      case 'minimal':
        return 'font-medium text-sm text-cerulean';
      default:
        return 'font-medium text-base text-cerulean';
    }
  };

  const getDescriptionClass = () => {
    switch (variant) {
      case 'full':
        return 'text-sm text-gray-500';
      case 'compact':
        return 'text-xs text-gray-500 hidden'; // Hide description in compact mode
      case 'minimal':
        return 'hidden'; // Hide description in minimal mode
      default:
        return 'text-xs text-gray-500 hidden';
    }
  };

  const getIcon = () => {
    const iconClass = `${getIconSize()} text-cerulean-400 ${variant === 'full' ? 'mr-4' : 'mr-2'}`;
    return type === 'prep' ? 
      <NotepadText className={iconClass} /> : 
      <NotebookPen className={iconClass} />;
  };

  const getTitle = () => {
    if (variant === 'minimal') {
      return type === 'prep' ? '1:1 Prep' : 'Review Prep';
    }
    
    if (type === 'prep') {
      return '1:1 Preparation';
    }
    
    // Review type - different labels based on mode
    return mode === 'personal' ? 'Self-Evaluation Preparation' : 'Review Preparation';
  };

  const getDescription = () => {
    if (type === 'prep') {
      if (targetName) {
        return `Prepare for 1:1 with ${targetName}`;
      }
      return 'Create notes for your next meeting';
    }
    
    // Review type
    if (mode === 'team' && targetName) {
      return `Prepare for ${targetName}'s performance review`;
    }
    return 'Create notes for your next career discussion';
  };

  const getPlusIcon = () => {
    if (variant === 'full') {
      return <Plus className="h-5 w-5 text-cerulean" />;
    }
    return null;
  };

  return (
    <Button 
      variant="secondary" 
      className={getButtonClass()}
      onClick={onClick}
      disabled={isLoading}
    >
      <div className="flex items-center">
        {getIcon()}
        <div>
          <div className={getTextClass()}>
            {getTitle()}
          </div>
          <div className={getDescriptionClass()}>
            {getDescription()}
          </div>
        </div>
      </div>
      {getPlusIcon()}
    </Button>
  );
}