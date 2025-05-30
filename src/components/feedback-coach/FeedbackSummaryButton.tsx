// components/feedback-coach/FeedbackSummaryButton.tsx
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sparkles, ChevronDown, Plus } from 'lucide-react';
import { FeedbackCoachVariant } from './FeedbackCoachPanel';

interface FeedbackSummaryButtonProps {
  variant?: FeedbackCoachVariant;
  onSummarize: (timeframe: string) => Promise<void>;
  isLoading?: boolean;
  targetName?: string;
}

export function FeedbackSummaryButton({
  variant = 'full',
  onSummarize,
  isLoading = false,
  targetName
}: FeedbackSummaryButtonProps) {
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
        return 'font-medium text-sm text-slate-500';
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

  const getChevronIcon = () => {
    if (variant === 'full') {
      return <Plus className="h-5 w-5 text-cerulean" />;
    }
    return <ChevronDown className="h-4 w-4" />;
  };

  const getDescription = () => {
    if (targetName) {
      return `Analyze feedback for ${targetName}`;
    }
    return 'Analyze your received feedback';
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="secondary" 
          className={getButtonClass()}
          disabled={isLoading}
        >
          <div className="flex items-center">
            <Sparkles className={`${getIconSize()} text-cerulean-400 ${variant === 'full' ? 'mr-4' : 'mr-2'}`} />
            <div>
              <div className={getTextClass()}>
                {variant === 'minimal' ? 'Summary' : 'Generate Summary'}
              </div>
              <div className={getDescriptionClass()}>
                {getDescription()}
              </div>
            </div>
          </div>
          {getChevronIcon()}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem 
          onClick={() => onSummarize('week')}
          className="cursor-pointer"
          disabled={isLoading}
        >
          {isLoading ? 'Checking feedback...' : 'Last Week\'s Feedback'}
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => onSummarize('month')}
          className="cursor-pointer"
          disabled={isLoading}
        >
          {isLoading ? 'Checking feedback...' : 'Last Month\'s Feedback'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}