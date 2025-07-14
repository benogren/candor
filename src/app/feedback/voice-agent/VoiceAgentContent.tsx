// src/app/feedback/voice-agent/VoiceAgentContent.tsx - Fixed version
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import supabase from '@/lib/supabase/client';
import VoiceInterface from '@/components/VoiceInterface';
import FeedbackHeader from '@/components/feedbackHeader';

interface Teammate {
  id: string;
  name: string;
  relationship?: {
    type: string;
    description: string;
  };
  jobTitle?: string;
  industry?: string;
  discussed: boolean;
  transcript?: string;
}

interface VoiceSession {
  id: string;
  status: string;
  elevenlabs_conversation_id?: string;
}

interface FeedbackUserIdentity {
  name: string | null;
  email: string;
}

interface FeedbackRecipient {
  recipient_id: string;
  feedback_user_identities: FeedbackUserIdentity | FeedbackUserIdentity[] | null;
}

export default function VoiceAgentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session');

  const [loading, setLoading] = useState(true);
  const [voiceSession, setVoiceSession] = useState<VoiceSession | null>(null);
  const [teammates, setTeammates] = useState<Teammate[]>([]);
  const [currentTeammateIndex, setCurrentTeammateIndex] = useState(0);
  const [sessionComplete, setSessionComplete] = useState(false);

  useEffect(() => {
    const loadSession = async () => {
      if (!sessionId) {
        toast({ 
          title: 'Missing session', 
          description: 'No session ID provided', 
          variant: 'destructive' 
        });
        router.push('/dashboard');
        return;
      }

      try {
        // Check if voice session already exists
        const { data: existingVoiceSession, error: voiceSessionError } = await supabase
          .from('voice_feedback_sessions')
          .select('*')
          .eq('feedback_session_id', sessionId)
          .maybeSingle();

        if (voiceSessionError && voiceSessionError.code !== 'PGRST116') {
          throw voiceSessionError;
        }

        // Get feedback recipients for this session
        const { data: recipients, error: recipientsError } = await supabase
          .from('feedback_recipients')
          .select(`
            id,
            recipient_id,
            feedback_user_identities(id, name, email)
          `)
          .eq('session_id', sessionId);

        if (recipientsError) throw recipientsError;

        // Transform recipients into teammates with relationship data
        const teammateData: Teammate[] = [];
        
        for (const recipient of recipients as FeedbackRecipient[] || []) {
          const identity = recipient.feedback_user_identities;
          let name = 'Unknown';
          
          if (Array.isArray(identity) && identity.length > 0) {
            name = identity[0].name || identity[0].email || 'Unknown';
          } else if (identity && !Array.isArray(identity)) {
            name = identity.name || identity.email || 'Unknown';
          }

          // Get relationship data for this teammate
          let relationship, jobTitle, industry;
          try {

            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            if (session) {
              const relationshipResponse = await fetch(`/api/voice-agent/relationship?providerId=${session.user.id}&recipientId=${recipient.recipient_id}`, {
                  headers: {
                    Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
                  }
                }
              );
              
              if (relationshipResponse.ok) {
                const relationshipData = await relationshipResponse.json();
                relationship = relationshipData.relationship;
                jobTitle = relationshipData.jobTitle;
                industry = relationshipData.industry;
              }
            }
          } catch (error) {
            console.error('Error fetching relationship for', name, ':', error);
          }

          teammateData.push({
            id: recipient.recipient_id,
            name,
            relationship,
            jobTitle,
            industry,
            discussed: false
          });
        }

        setTeammates(teammateData);

        if (existingVoiceSession) {
          setVoiceSession(existingVoiceSession);
          
          // Load progress if session exists
          const { data: progress } = await supabase
            .from('voice_session_recipients')
            .select('recipient_id, discussed, transcript')
            .eq('voice_session_id', existingVoiceSession.id);

          if (progress) {
            const updatedTeammates = teammateData.map(teammate => {
              const progressItem = progress.find(p => p.recipient_id === teammate.id);
              return {
                ...teammate,
                discussed: progressItem?.discussed || false,
                transcript: progressItem?.transcript || undefined
              };
            });
            setTeammates(updatedTeammates);
            
            // Count actually completed teammates
            const completedCount = updatedTeammates.filter(t => t.discussed).length;
            console.log(`Loading session: ${completedCount} of ${updatedTeammates.length} teammates completed`);
            
            // Find current teammate index (first undiscussed)
            const nextIndex = updatedTeammates.findIndex(t => !t.discussed);
            setCurrentTeammateIndex(nextIndex >= 0 ? nextIndex : 0);
            
            // Only mark session complete if ALL teammates are actually discussed
            if (completedCount >= updatedTeammates.length && updatedTeammates.length > 0) {
              console.log('All teammates completed, marking session complete');
              setSessionComplete(true);
            } else {
              console.log(`Session not complete: ${completedCount}/${updatedTeammates.length} teammates done`);
              setSessionComplete(false);
            }
          }
        }

        setLoading(false);
      } catch (error) {
        console.error('Error loading voice session:', error);
        toast({
          title: 'Error loading session',
          description: 'Could not load your feedback session',
          variant: 'destructive',
        });
        router.push('/feedback/choice?session=' + sessionId);
      }
    };

    loadSession();
  }, [sessionId, router]);

  const createVoiceSession = async () => {
    if (!sessionId) return;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/api/voice-agent/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          feedbackSessionId: sessionId,
          teammates: teammates.map(t => ({
            id: t.id,
            name: t.name
          }))
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create voice session');
      }

      const { voiceSession: newVoiceSession } = await response.json();
      setVoiceSession(newVoiceSession);
      
      toast({
        title: 'Voice session ready!',
        description: 'You can now start your conversations',
      });
    } catch (error) {
      console.error('Error creating voice session:', error);
      toast({
        title: 'Error creating voice session',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleTeammateComplete = async (transcript: string) => {
    // Mark current teammate as discussed
    const updatedTeammates = [...teammates];
    updatedTeammates[currentTeammateIndex].discussed = true;
    updatedTeammates[currentTeammateIndex].transcript = transcript;
    setTeammates(updatedTeammates);

    // Count how many are actually complete
    const completedCount = updatedTeammates.filter(t => t.discussed).length;
    
    console.log(`Completed ${completedCount} of ${teammates.length} teammates`);
    console.log('Current teammate index:', currentTeammateIndex);
    console.log('Updated teammates:', updatedTeammates.map(t => ({ name: t.name, discussed: t.discussed })));

    // Check if ALL teammates are now discussed
    if (completedCount >= teammates.length) {
      setSessionComplete(true);
      
      toast({
        title: 'All feedback complete!',
        description: `You've provided feedback for all ${teammates.length} teammates`,
        variant: 'default',
      });
    } else {
      // Find the next undiscussed teammate
      const nextIndex = updatedTeammates.findIndex((t, index) => !t.discussed && index > currentTeammateIndex);
      const finalNextIndex = nextIndex >= 0 ? nextIndex : updatedTeammates.findIndex(t => !t.discussed);
      
      if (finalNextIndex >= 0) {
        setCurrentTeammateIndex(finalNextIndex);
        toast({
          title: 'Moving to next teammate',
          description: `Now ready to discuss ${updatedTeammates[finalNextIndex]?.name}`,
        });
      } else {
        // This shouldn't happen, but just in case
        setSessionComplete(true);
        toast({
          title: 'All feedback complete!',
          description: 'No more teammates to discuss',
          variant: 'default',
        });
      }
    }
  };

  const handleVoiceError = (error: Error) => {
    console.error('Voice interface error:', error);
    toast({
      title: 'Voice Agent Error',
      description: 'There was an issue with the voice agent. Please try the traditional survey instead.',
      variant: 'destructive',
    });
    router.push(`/feedback/choice?session=${sessionId}`);
  };

  // const goBack = () => {
  //   router.push(`/feedback/choice?session=${sessionId}`);
  // };

  const completeSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (session && voiceSession) {
        await fetch('/api/voice-agent/session/complete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            voiceSessionId: voiceSession.id,
            feedbackSessionId: sessionId
          })
        });
      }

      router.push(`/feedback/voice-agent/processing?session=${sessionId}`);
    } catch (error) {
      console.error('Error completing session:', error);
      toast({
        title: 'Error completing session',
        description: 'There was an issue finalizing your feedback',
        variant: 'destructive',
      });
    }
  };

  // Add validation before rendering VoiceInterface
  const currentTeammate = teammates[currentTeammateIndex];
  const isValidForVoiceInterface = voiceSession?.id && currentTeammate?.id && !sessionComplete;

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-cerulean" />
      </div>
    );
  }

  // const completedCount = teammates.filter(t => t.discussed).length;
  // const progressPercentage = teammates.length > 0 ? (completedCount / teammates.length) * 100 : 0;

  return (
    <>
    <FeedbackHeader />
    <div className="container mx-auto py-8 px-4 max-w-xl">

        {sessionComplete ? (
          <>
            <h1 className='text-4xl font-light text-berkeleyblue pb-2'>All Conversations Complete!</h1>
            <p className='text-slate-500 text-base font-light pb-4'>
              You&apos;ve provided feedback for all {teammates.length} teammates. Now let&apos;s process your feedback, we&apos;ll analyze your conversations and generate responses for you. You can always review and edit your responses before sharing with your teammates.
            </p>
            <Button 
              onClick={completeSession} 
              >
                Process Feedback &amp; Continue
            </Button>
          </>
        ) : isValidForVoiceInterface ? (
          <VoiceInterface
            voiceSessionId={voiceSession.id}
            teammate={currentTeammate}
            teammateIndex={currentTeammateIndex}
            totalTeammates={teammates.length}
            teammates={teammates}
            onTeammateComplete={handleTeammateComplete}
            onError={handleVoiceError}
          />
        ) : voiceSession && !currentTeammate ? (
          <>
            <h1 className='text-4xl font-light text-berkeleyblue pb-2'>No More Teammates</h1>
            <p className='text-slate-500 text-base font-light pb-4'>
              All teammates have been processed. 
            </p>
            <Button onClick={completeSession}>
              Complete Session
            </Button>
          </>
        ) : (
          <>
          <h1 className='text-4xl font-light text-berkeleyblue pb-2'>Ready to Start?</h1>
          <ul className='list-disc pl-5 space-y-2 text-slate-500 text-base font-light pb-4'>
            <li>You&apos;ll have a natural conversation about each teammate (3-4 minutes each)</li>
            <li>The AI will ask follow-up questions based on your answers</li>
            <li>After each conversation, you&apos;ll move onto the next person</li>
            <li>Total time: about {teammates.length * 4} minutes</li>
          </ul>

          {/* Debug info in development */}
          {/* {process.env.NODE_ENV === 'development' && (
            <div className="mb-4 p-4 bg-gray-100 rounded">
              <p className="text-sm">Debug:</p>
              <ul className="text-xs">
                <li>voiceSession: {voiceSession ? voiceSession.id : 'null'}</li>
                <li>currentTeammate: {currentTeammate ? currentTeammate.name : 'null'}</li>
                <li>currentTeammateId: {currentTeammate?.id || 'null'}</li>
                <li>teammates.length: {teammates.length}</li>
                <li>sessionComplete: {sessionComplete.toString()}</li>
              </ul>
            </div>
          )} */}

          <Button 
              onClick={createVoiceSession}
              disabled={teammates.length === 0}
            >
              Start Voice Conversations
            </Button>
          </>
        )}


    </div>
    </>
  );
}