// src/components/VoiceInterface.tsx - Simplified conversation ID handling
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Mic, CheckCircle, BotMessageSquare, Circle, CircleCheck } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import supabase from '@/lib/supabase/client';
import { useConversation } from '@elevenlabs/react';
import { VoiceVisualization } from './VoiceVisualization';

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
}

interface ContextualData {
  companyName: string;
  companyIndustry: string;
  recentQuestionsContext: string;
  relationshipType: string;
}

interface VoiceInterfaceProps {
  voiceSessionId: string;
  teammate: Teammate;
  teammateIndex: number;
  totalTeammates: number;
  teammates: Teammate[];
  onTeammateComplete: (transcript: string) => void;
  onError: (error: Error) => void;
}

type ConversationState = 'ready' | 'connecting' | 'active' | 'completing' | 'completed';
type AnimationVariant = 'pulse' | 'waveform' | 'ripple';

export default function VoiceInterface({
  voiceSessionId,
  teammate,
  teammateIndex,
  totalTeammates,
  teammates,
  onTeammateComplete,
  onError
}: VoiceInterfaceProps) {
  const [conversationState, setConversationState] = useState<ConversationState>('ready');
  const [agentId, setAgentId] = useState<string | null>(null);
  const [conversationTranscript, setConversationTranscript] = useState('');
  const [conversationStartTime, setConversationStartTime] = useState<number | null>(null);
  const [conversationDuration, setConversationDuration] = useState(0);
  const [contextualData, setContextualData] = useState<ContextualData | null>(null);
  const [loadingContext, setLoadingContext] = useState(false);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [animationVariant] = useState<AnimationVariant>('ripple');
  // Commented out unused state variables - remove comments if needed later
  // const [showVariantSelector, setShowVariantSelector] = useState(false);
  
  // New state for better AI animation
  const [aiIntensity, setAiIntensity] = useState(0);
  const [messageCount, setMessageCount] = useState(0);
  const [lastMessageTime, setLastMessageTime] = useState<number>(0);
  
  // Use ref to store audio stream for cleanup without causing re-renders
  const audioStreamRef = useRef<MediaStream | null>(null);
  
  const maxDurationMinutes = 4;

  // Initialize microphone access
  useEffect(() => {
    const initMicrophone = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } 
        });
        setAudioStream(stream);
        audioStreamRef.current = stream;
      } catch (error) {
        console.warn('Microphone access not available:', error);
      }
    };

    initMicrophone();

    // Cleanup function using ref to avoid dependency issues
    return () => {
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;
      }
    };
  }, []); // Empty dependency array is correct here - we only want to initialize once

  // Update ref when audioStream state changes
  useEffect(() => {
    audioStreamRef.current = audioStream;
  }, [audioStream]);

  // Timer effect for conversation duration
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (conversationState === 'active' && conversationStartTime) {
      interval = setInterval(() => {
        setConversationDuration(Math.floor((Date.now() - conversationStartTime) / 1000));
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [conversationState, conversationStartTime]);

  // Reset conversation state when teammate changes
  useEffect(() => {
    console.log('👤 Teammate changed to:', teammate.name);
    setConversationState('ready');
    setConversationTranscript('');
    setConversationDuration(0);
    setConversationStartTime(null);
    setConversationId(null);
    setMessageCount(0);
    setAiIntensity(0);
  }, [teammate.id, teammate.name]);

  // Load contextual data when component mounts or teammate changes
  useEffect(() => {
    const loadContextualData = async () => {
      setLoadingContext(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const response = await fetch('/api/voice-agent/contextual-data', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            providerId: session.user.id,
            recipientId: teammate.id,
            relationship: teammate.relationship
          })
        });

        if (response.ok) {
          const data = await response.json();
          setContextualData(data);
        } else {
          setContextualData({
            companyName: '',
            companyIndustry: '',
            recentQuestionsContext: 'No recent questions to avoid.',
            relationshipType: teammate.relationship?.type || 'peer'
          });
        }
      } catch (error) {
        console.error('Error loading contextual data:', error);
        setContextualData({
          companyName: '',
          companyIndustry: '',
          recentQuestionsContext: 'No recent questions to avoid.',
          relationshipType: teammate.relationship?.type || 'peer'
        });
      } finally {
        setLoadingContext(false);
      }
    };

    loadContextualData();
  }, [teammate.id, teammate.relationship]);

  // Use the official ElevenLabs React hook with simplified event handling
  const conversation = useConversation({
    onConnect: () => {
      console.log('✅ Connected to ElevenLabs for', teammate.name);
      
      setConversationState('active');
      setConversationStartTime(Date.now());
      setConversationTranscript('');
      setMessageCount(0);
      setAiIntensity(50); // Start with medium intensity
      
      toast({
        title: 'Connected!',
        description: `Now discussing ${teammate.name}`,
      });
    },
    onDisconnect: () => {
      console.log('🔌 Disconnected from ElevenLabs');
      setAiIntensity(0);
      if (conversationState === 'completing') {
        setConversationState('completed');
      }
    },
    onMessage: (message) => {
      console.log('📨 ElevenLabs Message:', message.message);
      
      const messageContent = message.message;
      
      if (messageContent && typeof messageContent === 'string' && messageContent.trim().length > 0) {
        setConversationTranscript(prev => {
          const newTranscript = prev + (prev ? '\n' : '') + messageContent;
          return newTranscript;
        });
        
        // Update AI intensity based on message characteristics
        const messageLength = messageContent.length;
        const newMessageCount = messageCount + 1;
        setMessageCount(newMessageCount);
        setLastMessageTime(Date.now());
        
        // Calculate intensity based on message length and conversation flow
        let intensity = 40; // Base intensity
        
        if (messageLength > 100) intensity += 20; // Longer messages = more intensity
        if (messageLength > 200) intensity += 20;
        if (messageContent.includes('?')) intensity += 15; // Questions are more intense
        if (messageContent.includes('!')) intensity += 10; // Excitement
        if (newMessageCount > 5) intensity += 10; // More active conversation
        
        setAiIntensity(Math.min(100, intensity));
      }

      // Auto-complete conversation when AI gives completion message
      if (messageContent && (
          messageContent.toLowerCase().includes('this has been really helpful feedback') ||
          messageContent.toLowerCase().includes('thank you for taking the time to share') ||
          messageContent.toLowerCase().includes('thank you for sharing these insights') ||
          messageContent.toLowerCase().includes('thank you for the detailed input')
        )) {
        setTimeout(() => {
          handleConversationComplete();
        }, 2000);
      }
    },
    onStatusChange: (status: string) => {
      console.log('🔄 ElevenLabs status changed:', status);
      
      // Adjust AI intensity based on status
      if (status === 'speaking' || status === 'playing') {
        setAiIntensity(prev => Math.max(prev, 60));
      } else if (status === 'listening' || status === 'idle') {
        setAiIntensity(prev => Math.max(20, prev - 10));
      }
    },
    onError: (error) => {
      console.error('❌ ElevenLabs error:', error);
      setAiIntensity(0);
      toast({
        title: 'Connection error',
        description: 'There was an issue with the voice connection',
        variant: 'destructive',
      });
      setConversationState('ready');
      onError(new Error('ElevenLabs connection error'));
    },
  });

  // Decay AI intensity over time when no new messages
  useEffect(() => {
    if (conversationState === 'active' && lastMessageTime > 0) {
      const decayInterval = setInterval(() => {
        const timeSinceLastMessage = Date.now() - lastMessageTime;
        if (timeSinceLastMessage > 3000) { // 3 seconds since last message
          setAiIntensity(prev => Math.max(20, prev - 5));
        }
      }, 1000);
      
      return () => clearInterval(decayInterval);
    }
  }, [conversationState, lastMessageTime]);

  // Load agent configuration
  useEffect(() => {
    const loadAgentConfig = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const response = await fetch('/api/voice-agent/elevenlabs/config', {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        });

        if (response.ok) {
          const config = await response.json();
          setAgentId(config.agentId);
        }
      } catch (error) {
        console.error('Error loading agent config:', error);
      }
    };

    loadAgentConfig();
  }, []);

  // Get signed URL for private agents
  const getSignedUrl = useCallback(async (): Promise<string> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const response = await fetch('/api/voice-agent/elevenlabs/signed-url', {
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
      method: 'POST',
      body: JSON.stringify({
        currentTeammate: teammate.name,
        currentIndex: teammateIndex + 1,
        totalTeammates,
        contextualData
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to get signed URL: ${response.statusText}`);
    }

    const { signedUrl } = await response.json();
    return signedUrl;
  }, [teammate.name, teammateIndex, totalTeammates, contextualData]);

  // Start conversation
  const startConversation = useCallback(async () => {
    if (!contextualData) {
      toast({
        title: 'Loading context...',
        description: 'Please wait while we gather context for the conversation',
        variant: 'destructive',
      });
      return;
    }

    setConversationState('connecting');
    setConversationDuration(0);
    setConversationStartTime(null);
    setConversationTranscript('');
    setConversationId(null);
    setMessageCount(0);
    setAiIntensity(30); // Start with low intensity
    
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const dynamicVariables = {
        current_teammate: teammate.name,
        current_relationship: teammate.relationship?.description || 'Colleague',
        current_job_title: teammate.jobTitle || 'Not specified',
        relationship_type: contextualData.relationshipType,
        company_industry: contextualData.companyIndustry,
        company_name: contextualData.companyName,
        recent_questions_context: contextualData.recentQuestionsContext,
        session_purpose: `Feedback on ${teammate.name}`,
        max_duration_minutes: maxDurationMinutes.toString(),
        conversation_type: 'Weekly 360-Degree Feedback',
        teammate_number: (teammateIndex + 1).toString(),
        total_teammates: totalTeammates.toString()
      };

      let newConversationId: string | null = null;
      if (agentId) {
        newConversationId = await conversation.startSession({ agentId: agentId, dynamicVariables });
      } else {
        const signedUrl = await getSignedUrl();
        newConversationId = await conversation.startSession({ signedUrl, dynamicVariables });
      }

      console.log('🗣️ Conversation started with ID:', newConversationId);
      setConversationId(newConversationId);

    } catch (error) {
      console.error('Failed to start conversation:', error);
      toast({
        title: 'Failed to start',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
      setConversationState('ready');
      setAiIntensity(0);
      onError(error instanceof Error ? error : new Error('Failed to start conversation'));
    }
  }, [conversation, agentId, teammate, teammateIndex, totalTeammates, maxDurationMinutes, contextualData, getSignedUrl, onError]);

  // Complete conversation
  const handleConversationComplete = useCallback(async () => {
    if (conversationState === 'completing' || conversationState === 'completed') return;
    
    setConversationState('completing');
    setAiIntensity(0);
    
    try {
      await conversation.endSession();
      
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const requestBody = {
          voiceSessionId,
          recipientId: teammate.id,
          conversationId: conversationId,
          transcript: conversationTranscript,
          duration: conversationDuration,
          contextualData
        };

        if (!conversationTranscript || conversationTranscript.trim().length === 0) {
          requestBody.transcript = 'Empty transcript - possible ElevenLabs message capture issue';
        }

        const response = await fetch('/api/voice-agent/session/teammate-complete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          const errorText = await response.text();
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { error: 'Invalid JSON response', details: errorText };
          }
          throw new Error(`API Error (${response.status}): ${errorData.details || errorData.error || 'Unknown error'}`);
        }
      }

      setConversationState('completed');
      
      setTimeout(() => {
        onTeammateComplete(conversationTranscript);
      }, 1500);

    } catch (error) {
      console.error('Error completing conversation:', error);
      setConversationState('active');
      setAiIntensity(50); // Restore intensity if we go back to active
      toast({
        title: 'Error saving feedback',
        description: error instanceof Error ? error.message : 'There was an issue saving your feedback. Please try again.',
        variant: 'destructive',
      });
    }
  }, [conversation, conversationTranscript, voiceSessionId, teammate, conversationDuration, contextualData, onTeammateComplete, conversationState, conversationId]);

  // Determine voice visualization states
  const getVoiceStates = () => {
    switch (conversationState) {
      case 'active':
        return {
          isListening: !conversation.isSpeaking,
          isSpeaking: conversation.isSpeaking,
          isIdle: false
        };
      case 'connecting':
        return {
          isListening: false,
          isSpeaking: false,
          isIdle: true
        };
      default:
        return {
          isListening: false,
          isSpeaking: false,
          isIdle: true
        };
    }
  };

  const voiceStates = getVoiceStates();

  // Main action button logic
  const getMainButton = () => {
    if (loadingContext) {
      return (
        <Button disabled variant="secondary">
          <Loader2 className="mr-3 h-5 w-5 animate-spin" />
          Loading Context...
        </Button>
      );
    }

    switch (conversationState) {
      case 'ready':
        return (
          <Button onClick={startConversation} disabled={!contextualData}>
            Start Feedback for {teammate.name}
          </Button>
        );

      case 'connecting':
        return (
          <Button disabled variant="secondary">
            <Loader2 className="mr-3 h-5 w-5 animate-spin" />
            Connecting...
          </Button>
        );

      case 'active':
        return (
          <Button onClick={handleConversationComplete} variant="outline">
            Finish feedback for {teammate.name}
          </Button>
        );

      case 'completing':
        return (
          <Button disabled variant="secondary">
            <Loader2 className="mr-3 h-5 w-5 animate-spin" />
            Saving &amp; Moving to Next...
          </Button>
        );

      case 'completed':
        const remainingTeammates = teammates.filter(t => !t.discussed);
        const hasMoreTeammates = remainingTeammates.length > 0;
        
        return (
          <Button disabled>
            <CheckCircle className="mr-3 h-5 w-5" />
            {hasMoreTeammates ? 
              `Moving to Next Teammate...` : 
              'All Feedback Complete!'
            }
          </Button>
        );
    }
  };

  // Calculate progress
  const completedCount = teammates.filter(t => t.discussed).length;
  const progressPercentage = teammates.length > 0 ? (completedCount / teammates.length) * 100 : 0;

  return (
    <>
      <div className='mb-12 flex items-center justify-between'>
        <div className="w-full h-2 bg-slate-100 rounded-full">
          <div className="h-2 bg-cerulean rounded-full transition-all duration-300 ease-in-out" style={{ width: `${progressPercentage}%` }}></div>
        </div>
        <span className='text-xs text-slate-500 w-40 text-right'>{teammateIndex + 1} of {totalTeammates} teammates</span>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-2 mb-8">
        <Badge variant="secondary" className="text-slate-500 font-light uppercase items-center">
          <BotMessageSquare className="h-3 w-3 text-slate-400" />    
        </Badge>
        {teammates.map((teammate, index) => (
          <Badge 
            variant="secondary"
            key={teammate.id} 
            className={`font-light uppercase items-center 
              ${teammate.discussed ? 'text-slate-500' : 
                index === teammateIndex ? 'text-slate-700 bg-slate-200' : 
                'text-slate-500'}
            `}
          >
            {teammate.discussed ? (
              <CircleCheck className="h-3 w-3 text-green-600 mr-2" />
            ) : index === teammateIndex ? (
              <Mic className="h-3 w-3 text-slate-700 mr-2 animate-pulse" />
            ) : index > teammateIndex ? (
              <Circle className="h-3 w-3 text-slate-400 mr-2" />
            ) : null}
            {teammate.name}
          </Badge>
        ))}
      </div>

      {/* Animation Variant Selector */}
      {/* <div className="flex justify-center mb-4">
        <VariantSelector />
      </div> */}

      {/* Voice Visualization with Event-Driven Animation */}
      <div className='mt-8'>
        <div className="flex justify-center mb-8">
          <VoiceVisualization
            isListening={voiceStates.isListening}
            isSpeaking={voiceStates.isSpeaking}
            isIdle={voiceStates.isIdle}
            audioStream={audioStream || undefined}
            size="md"
            variant={animationVariant}
            sensitivity={7}
            aiIntensity={aiIntensity}
            conversationActive={conversationState === 'active'}
            recipientName={teammate.name}
          />
        </div>

        <div className='items-center text-center'>
          {/* Duration and tips */}
          {conversationState === 'active' && (
            <div className="mb-6">
              <span className="text-sm text-slate-400 block mb-4">
                {Math.floor(conversationDuration / 60)}:{(conversationDuration % 60).toString().padStart(2, '0')} / {maxDurationMinutes}:00
              </span>
            </div>
          )}

          {getMainButton()}
        </div> 
      </div>
    </>
  );
}