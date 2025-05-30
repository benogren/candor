// components/feedback-coach/FeedbackCoachPanel.tsx
'use client';

import React from 'react';
import { FeedbackSummaryButton } from './FeedbackSummaryButton';
import { FeedbackActionButton } from './FeedbackActionButton';

// Types
export interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
  is_invited_user: boolean;
}

export type FeedbackCoachVariant = 'full' | 'compact' | 'minimal';
export type FeedbackCoachMode = 'personal' | 'team';

interface FeedbackCoachPanelProps {
  mode: FeedbackCoachMode;
  variant?: FeedbackCoachVariant;
  selectedMemberId?: string | null;
  teamMembers?: TeamMember[];
  isLoading?: boolean;
  onSummarize: (timeframe: string, memberId?: string) => Promise<void>;
  onPrep: (memberId?: string) => Promise<void>;
  onReview: (memberId?: string) => Promise<void>;
  className?: string;
  showTitle?: boolean;
}

export function FeedbackCoachPanel({
  mode,
  variant = 'full',
  selectedMemberId,
  teamMembers = [],
  isLoading = false,
  onSummarize,
  onPrep,
  onReview,
  className = '',
//   showTitle = true
}: FeedbackCoachPanelProps) {
  // Get selected team member if in team mode
  const selectedMember = mode === 'team' && selectedMemberId 
    ? teamMembers.find(m => m.id === selectedMemberId)
    : null;

  // Determine if we should show buttons
  const shouldShowButtons = mode === 'personal' || 
    (mode === 'team' && selectedMemberId && selectedMemberId !== 'all');

  // Get container styling based on variant
  const getContainerClass = () => {
    switch (variant) {
      case 'full':
        return '';
      case 'compact':
        return 'mb-8';
      case 'minimal':
        return '';
      default:
        return '';
    }
  };

  // Get title styling based on variant
//   const getTitleClass = () => {
//     switch (variant) {
//       case 'full':
//         return 'text-2xl font-light text-berkeleyblue mb-4';
//       case 'compact':
//         return 'text-xl font-light text-berkeleyblue mb-4';
//       case 'minimal':
//         return 'text-lg font-light text-berkeleyblue mb-3';
//       default:
//         return 'text-xl font-light text-berkeleyblue mb-4';
//     }
//   };

  const handleSummarize = async (timeframe: string) => {
    await onSummarize(timeframe, selectedMemberId || undefined);
  };

  const handlePrep = async () => {
    await onPrep(selectedMemberId || undefined);
  };

  const handleReview = async () => {
    await onReview(selectedMemberId || undefined);
  };

  return (
    <div className={`${getContainerClass()} ${className}`}>
      {/* {showTitle && (
        <h2 className={getTitleClass()}>
          <BotMessageSquareIcon className={`inline-block mr-2 text-cerulean-400 ${
            variant === 'full' ? 'h-6 w-6' : variant === 'compact' ? 'h-6 w-6' : 'h-5 w-5'
          }`} />
          Feedback Coach
        </h2>
      )} */}
      
      {shouldShowButtons ? (
        <div className={variant === 'full' ? 'space-y-4' : 'space-y-2'}>
          <FeedbackSummaryButton
            variant={variant}
            onSummarize={handleSummarize}
            isLoading={isLoading}
            targetName={selectedMember?.full_name}
          />
          
          <FeedbackActionButton
            type="prep"
            variant={variant}
            mode={mode}
            onClick={handlePrep}
            isLoading={isLoading}
            targetName={selectedMember?.full_name}
          />
          
          <FeedbackActionButton
            type="review"
            variant={variant}
            mode={mode}
            onClick={handleReview}
            isLoading={isLoading}
            targetName={selectedMember?.full_name}
          />
        </div>
      ) : (
        <></>
        /* Show message when on team mode but no employee selected */
        // <div className="text-center py-8">
        //   <Users className="h-10 w-10 text-gray-300 mx-auto mb-4" />
        //   <p className="text-gray-500 text-sm mb-2">
        //     Select a team member to generate notes
        //   </p>
        //   <p className="text-gray-400 text-xs">
        //     Use the dropdown above to choose a specific team member.
        //   </p>
        // </div>
      )}
    </div>
  );
}