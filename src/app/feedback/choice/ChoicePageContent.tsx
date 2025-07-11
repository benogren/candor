// src/app/feedback/choice/ChoicePageContent.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import { Loader2, MessageSquare, Mic, Clock, Users } from 'lucide-react';
import supabase from '@/lib/supabase/client';

interface FeedbackUserIdentity {
  name: string | null;
  email: string;
}

interface FeedbackRecipient {
  recipient_id: string;
  feedback_user_identities: FeedbackUserIdentity | FeedbackUserIdentity[] | null;
}

export default function ChoicePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session');

  const [loading, setLoading] = useState(true);
  const [selectedColleagues, setSelectedColleagues] = useState<Array<{name: string}>>([]);

  useEffect(() => {
    const loadSessionData = async () => {
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
        // Verify session exists and is valid
        const { data: session, error: sessionError } = await supabase
          .from('feedback_sessions')
          .select('id, status')
          .eq('id', sessionId)
          .single();

        if (sessionError || !session) {
          throw new Error('Session not found');
        }

        if (session.status === 'completed') {
          router.push('/feedback/complete');
          return;
        }

        // Get selected recipients for this session
        const { data: recipients, error: recipientsError } = await supabase
          .from('feedback_recipients')
          .select(`
            recipient_id,
            feedback_user_identities(name, email)
          `)
          .eq('session_id', sessionId);

        if (recipientsError) throw recipientsError;

        // Transform recipient data
        const colleagues = (recipients as FeedbackRecipient[] || []).map(recipient => {
          const identity = recipient.feedback_user_identities;
          
          let name = 'Unknown';
          if (Array.isArray(identity) && identity.length > 0) {
            name = identity[0].name || identity[0].email || 'Unknown';
          } else if (identity && !Array.isArray(identity)) {
            name = identity.name || identity.email || 'Unknown';
          }
          
          return { name };
        });

        setSelectedColleagues(colleagues);
        setLoading(false);
      } catch (error) {
        console.error('Error loading session data:', error);
        toast({
          title: 'Error loading session',
          description: 'Could not load your feedback session',
          variant: 'destructive',
        });
        router.push('/dashboard');
      }
    };

    loadSessionData();
  }, [sessionId, router]);

  const handleTraditionalSurvey = () => {
    router.push(`/feedback/questions?session=${sessionId}`);
  };

  const handleVoiceAgent = () => {
    router.push(`/feedback/voice-agent?session=${sessionId}`);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-cerulean" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-light text-berkeleyblue pb-2">
          Choose Your Feedback Method
        </h1>
        <p className="text-slate-500 text-base font-light">
          You&apos;ll be providing feedback for {selectedColleagues.length} colleague{selectedColleagues.length !== 1 ? 's' : ''}
        </p>
        
        {selectedColleagues.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {selectedColleagues.map((colleague, index) => (
              <span 
                key={index}
                className="bg-cerulean-100 text-cerulean-800 px-3 py-1 rounded-full text-sm"
              >
                {colleague.name}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {/* Traditional Survey Option */}
        <Card className="cursor-pointer transition-all hover:shadow-lg border-2 hover:border-cerulean">
          <CardHeader className="text-center p-8">
            <div className="mx-auto mb-4 p-4 bg-slate-100 rounded-full w-16 h-16 flex items-center justify-center">
              <MessageSquare className="h-8 w-8 text-slate-600" />
            </div>
            <CardTitle className="text-xl mb-2">Traditional Survey</CardTitle>
            <CardDescription className="text-base leading-relaxed">
              Answer structured questions about each colleague. Clear, familiar format with ratings and text responses.
            </CardDescription>
            
            <div className="mt-6 space-y-2 text-left">
              <div className="flex items-center text-sm text-slate-600">
                <Clock className="h-4 w-4 mr-2" />
                <span>~{selectedColleagues.length * 2} minutes</span>
              </div>
              <div className="flex items-center text-sm text-slate-600">
                <Users className="h-4 w-4 mr-2" />
                <span>Structured questions for each person</span>
              </div>
            </div>
          </CardHeader>
          
          <div className="px-8 pb-8">
            <Button 
              onClick={handleTraditionalSurvey}
              className="w-full"
              size="lg"
            >
              Start Traditional Survey
            </Button>
          </div>
        </Card>

        {/* AI Voice Agent Option */}
        <Card className="cursor-pointer transition-all hover:shadow-lg border-2 hover:border-cerulean relative">
          <CardHeader className="text-center p-8">
            <div className="mx-auto mb-4 p-4 bg-cerulean-100 rounded-full w-16 h-16 flex items-center justify-center">
              <Mic className="h-8 w-8 text-cerulean" />
            </div>
            <CardTitle className="text-xl mb-2">
              AI Voice Agent
              <span className="ml-2 text-xs bg-cerulean text-white px-2 py-1 rounded-full">BETA</span>
            </CardTitle>
            <CardDescription className="text-base leading-relaxed">
              Have a natural conversation with our AI about each colleague. More conversational and intuitive.
            </CardDescription>
            
            <div className="mt-6 space-y-2 text-left">
              <div className="flex items-center text-sm text-slate-600">
                <Clock className="h-4 w-4 mr-2" />
                <span>~{selectedColleagues.length * 3} minutes</span>
              </div>
              <div className="flex items-center text-sm text-slate-600">
                <Users className="h-4 w-4 mr-2" />
                <span>Natural conversation about each person</span>
              </div>
            </div>
          </CardHeader>
          
          <div className="px-8 pb-8">
            <Button 
              onClick={handleVoiceAgent}
              className="w-full bg-cerulean hover:bg-cerulean/90"
              size="lg"
            >
              Try Voice Agent
            </Button>
          </div>
        </Card>
      </div>

      <div className="text-center mt-8">
        <p className="text-sm text-slate-500">
          Both methods collect the same quality of feedback. Choose what feels most comfortable for you.
        </p>
      </div>
    </div>
  );
}