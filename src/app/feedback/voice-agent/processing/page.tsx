// src/app/feedback/voice-agent/processing/page.tsx
'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Star, MessageCircle, Trophy, AlertTriangle, Trash, Pencil, Save } from 'lucide-react';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faStar } from '@fortawesome/free-solid-svg-icons';
import { faMessage } from '@fortawesome/free-regular-svg-icons';
import FeedbackHeader from '@/components/feedbackHeader';
import { Button } from '@/components/ui/button';

interface ProcessedResponse {
  questionId: string;
  questionText: string;
  questionType: 'rating' | 'text' | 'values' | 'ai';
  ratingValue?: number; // 1-10 scale for rating questions
  textResponse?: string;
  hasComment: boolean;
  commentText?: string;
  confidence?: number;
}

interface RecipientResponse {
  recipientId: string;
  recipientName: string;
  responses: ProcessedResponse[];
  hasTranscript: boolean;
  originalTranscript?: string;
  needsManualInput: boolean;
  processingError?: string;
}

type ProcessingStep = 'fetching' | 'processing' | 'reviewing' | 'saving' | 'completed' | 'error';

const getQuestionTypeIcon = (questionType: string): React.ReactElement => {
  switch (questionType) {
    case 'rating':
      return <Star className="h-6 w-6 text-berkeleyblue-200" />;
    case 'text':
      return <MessageCircle className="h-6 w-6 text-berkeleyblue-200" />;
    case 'values':
      return <Trophy className="h-6 w-6 text-pantonered-300" />;
    case 'ai':
      return <MessageCircle className="h-6 w-6 text-berkeleyblue-200" />;
    default:
      return <MessageCircle className="h-6 w-6 text-berkeleyblue-200" />;
  }
};

// Separate component that uses useSearchParams
function VoiceProcessingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // URL params - note we only get 'session' parameter
  const sessionId = searchParams.get('session');
  
  // State
  const [step, setStep] = useState<ProcessingStep>('fetching');
  const [voiceSessionId, setVoiceSessionId] = useState<string | null>(null);
  const [editedResponses, setEditedResponses] = useState<RecipientResponse[]>([]);
  const [editingResponseId, setEditingResponseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({ 
    total: 0, 
    successful: 0, 
    processed: 0,
    fromDatabase: 0,
    fromElevenLabs: 0,
    missingTranscripts: 0,
    extractedQuestions: 0
  });

  const processVoiceSession = useCallback(async (voiceSessionIdToUse?: string) => {
    try {
      const targetVoiceSessionId = voiceSessionIdToUse || voiceSessionId;
      
      if (!targetVoiceSessionId) {
        throw new Error('Voice session ID not available');
      }

      // Step 1: Fetch transcripts
      const transcriptResponse = await fetch('/api/voice-agent/fetch-transcripts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceSessionId: targetVoiceSessionId })
      });

      if (!transcriptResponse.ok) {
        throw new Error('Failed to fetch transcripts');
      }

      const transcriptData = await transcriptResponse.json();
      setStats(prev => ({ 
        ...prev, 
        total: transcriptData.stats.totalRecipients,
        successful: transcriptData.stats.successfulTranscripts,
        fromDatabase: transcriptData.stats.fromDatabase,
        fromElevenLabs: transcriptData.stats.fromElevenLabs,
        missingTranscripts: transcriptData.stats.missingTranscripts
      }));

      setStep('processing');

      // Step 2: Process transcripts with AI
      const processingResponse = await fetch('/api/voice-agent/process-transcripts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          transcripts: transcriptData.transcripts,
          sessionId: sessionId 
        })
      });

      if (!processingResponse.ok) {
        throw new Error('Failed to process transcripts');
      }

      const processingData = await processingResponse.json();
      setEditedResponses(processingData.processedResponses);
      setStats(prev => ({ 
        ...prev, 
        processed: processingData.successfullyProcessed,
        extractedQuestions: processingData.extractedQuestions || 0
      }));
      
      setStep('reviewing');
      
    } catch (error) {
      console.error('Error processing voice session:', error);
      setError(error instanceof Error ? error.message : 'Processing failed');
      setStep('error');
    }
  }, [voiceSessionId, sessionId]);

  const lookupAndProcessVoiceSession = useCallback(async () => {
    try {
      setStep('fetching');
      
      // Step 1: Look up the voice session ID using the regular session ID
      const lookupResponse = await fetch('/api/voice-agent/lookup-voice-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });

      if (!lookupResponse.ok) {
        if (lookupResponse.status === 404) {
          throw new Error('No voice session found for this feedback session. This session may not have used the voice agent.');
        }
        throw new Error('Failed to find voice session');
      }

      const lookupData = await lookupResponse.json();
      const foundVoiceSessionId = lookupData.voiceSessionId;
      setVoiceSessionId(foundVoiceSessionId);

      // Step 2: Proceed with processing using the found voice session ID
      await processVoiceSession(foundVoiceSessionId);
      
    } catch (error) {
      console.error('Error looking up voice session:', error);
      setError(error instanceof Error ? error.message : 'Failed to find voice session');
      setStep('error');
    }
  }, [sessionId, processVoiceSession]);

  // Lookup voice session and process on mount
  useEffect(() => {
    if (!sessionId) {
      setError('Missing session information');
      setStep('error');
      return;
    }
    
    lookupAndProcessVoiceSession();
  }, [sessionId, lookupAndProcessVoiceSession]);

  const handleResponseEdit = (recipientId: string, responseIndex: number, field: string, value: string | number | boolean) => {
    setEditedResponses(prev => prev.map(recipient => {
      if (recipient.recipientId === recipientId) {
        const updatedResponses = [...recipient.responses];
        updatedResponses[responseIndex] = {
          ...updatedResponses[responseIndex],
          [field]: value
        };
        return { ...recipient, responses: updatedResponses };
      }
      return recipient;
    }));
  };

  const handleRemoveResponse = (recipientId: string, responseIndex: number) => {
    setEditedResponses(prev => prev.map(recipient => {
      if (recipient.recipientId === recipientId) {
        const updatedResponses = [...recipient.responses];
        updatedResponses.splice(responseIndex, 1);
        return { ...recipient, responses: updatedResponses };
      }
      return recipient;
    }));
  };

  const handleAddResponse = (recipientId: string) => {
    const newResponse: ProcessedResponse = {
      questionId: `temp-${Date.now()}`, // Temporary ID, will be created when saved
      questionText: '',
      questionType: 'text',
      ratingValue: undefined,
      textResponse: '',
      hasComment: false,
      commentText: '',
      confidence: 1.0
    };

    setEditedResponses(prev => prev.map(recipient => {
      if (recipient.recipientId === recipientId) {
        return {
          ...recipient,
          responses: [...recipient.responses, newResponse]
        };
      }
      return recipient;
    }));
  };

  const saveAndComplete = async () => {
    try {
      setStep('saving');
      
      const response = await fetch('/api/voice-agent/save-responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          voiceSessionId: voiceSessionId,
          responses: editedResponses
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save responses');
      }

      const result = await response.json();

      if (result.success) {
        console.log(`Successfully saved: ${result.responsesCount} responses using ${result.questionsCreated} new questions`);
      }

      setStep('completed');
      
      // Redirect after short delay
      setTimeout(() => {
        router.push(`/feedback/complete?session=${sessionId}`);
      }, 2000);
      
    } catch (error) {
      console.error('Error saving responses:', error);
      setError('Failed to save feedback responses');
      setStep('error');
    }
  };

  // Helper to render stars based on rating
  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center">
        {Array.from({ length: 10 }).map((_, i) => (
          <span key={i} className={`text-xl ${i < rating ? 'text-cerulean-400' : 'text-cerulean-100'}`}>
            <FontAwesomeIcon 
              icon={faStar} 
              className="h-4 w-4"
            />
          </span>
        ))}
        <span className="ml-2 text-sm text-slate-500">{rating}/10</span>
      </div>
    );
  };

  // Loading states
  if (step === 'fetching' || step === 'processing' || step === 'saving') {
    return (
      <>
      <FeedbackHeader />
      <div className="flex items-center justify-center py-8">
        <div className="bg-white p-8 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cerulean-400 mx-auto mb-4"></div>
          <h3 className="text-xl font-light text-berkeleyblue mb-2">
            {step === 'fetching' && 'Fetching Your Conversations...'}
            {step === 'processing' && 'Processing with AI...'}
            {step === 'saving' && 'Saving Your Feedback...'}
          </h3>
          <p className="text-slate-500 text-base font-light">
            {step === 'fetching' && 'Retrieving conversation transcripts'}
            {step === 'processing' && 'Analyzing conversations and extracting feedback'}
            {step === 'saving' && 'Finalizing and storing responses'}
          </p>
          {stats.total > 0 && (
            <div className="mt-4 text-sm text-slate-400 space-y-1">
              <p className='text-slate-500 text-xs font-light pb-4'>
                {stats.total} conversations total &bull; {stats.processed} successfully processed by AI
              
              {/* <div>{stats.successful} with transcripts ({stats.fromDatabase} from database, {stats.fromElevenLabs} from ElevenLabs)</div> */}
              
              {stats.missingTranscripts > 0 && (
                <span className="text-amber-600"> &bull; {stats.missingTranscripts} missing transcripts</span>
              )}
              </p>
            </div>
          )}
        </div>
      </div>
      </>
    );
  }

  // Error state
  if (step === 'error') {
    return (
      <>
      <FeedbackHeader />
      <div className="flex items-center justify-center">
        <div className="bg-white p-8 rounded-md shadow-md max-w-md w-full text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="text-red-600 h-6 w-6" />
          </div>
          <h3 className="text-xl font-light text-berkeleyblue mb-2">Processing Error</h3>
          <p className="text-slate-500 mb-4 text-base font-light">{error}</p>
          <div className="space-y-2">
            <button 
              onClick={lookupAndProcessVoiceSession}
              className="w-full px-4 py-2 bg-cerulean-400 text-white rounded-md hover:bg-cerulean-500 font-light"
            >
              Try Again
            </button>
            <button 
              onClick={() => router.push(`/feedback/traditional?session=${sessionId}`)}
              className="w-full px-4 py-2 border border-berkeleyblue-200 text-berkeleyblue rounded-md hover:bg-berkeleyblue-50 font-light"
            >
              Use Traditional Survey Instead
            </button>
          </div>
        </div>
      </div>
      </>
    );
  }

  // Completed state
  if (step === 'completed') {
    return (
      <>
      <FeedbackHeader />
      <div className="flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cerulean-400 mx-auto mb-4"></div>
      </div>
      </>
    );
  }

  // Review state
  return (
    <>
    <FeedbackHeader />
    <div className="py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className='text-4xl font-light text-berkeleyblue pb-2'>
            Review Your Voice Feedback
          </h1>
          <p className='text-slate-500 text-base font-light pb-4'>
            We&apos;ve analyzed your conversations and extracted the natural questions and topics that were discussed.<br/> 
            Review and edit as needed before saving.
          </p>
        </div>

        {/* Recipients */}
        <div className="space-y-6 mb-8">
          {editedResponses.map(recipient => (
            <div key={recipient.recipientId} className="bg-white rounded-md shadow-md">
              {/* Recipient Header */}
              <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                <h3 className="text-xl font-light text-berkeleyblue">
                  Feedback for {recipient.recipientName}
                </h3>
                <div className="flex gap-2">
                  {!recipient.hasTranscript && (
                    <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-md text-xs font-light">
                      No Transcript
                    </span>
                  )}
                  {recipient.processingError && (
                    <span className="px-3 py-1 bg-red-100 text-red-700 rounded-md text-xs font-light">
                      Processing Error
                    </span>
                  )}
                  {recipient.responses.length === 0 && (
                    <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-md text-xs font-light">
                      No Responses
                    </span>
                  )}
                </div>
              </div>

              <div className="p-6">
                {/* Original Transcript */}
                {recipient.originalTranscript && (
                  <details className="mb-4">
                    <summary className="cursor-pointer font-light text-sm text-slate-500 mb-3 hover:text-cerulean-400">
                      View Transcript
                    </summary>
                    <div className="bg-slate-50 p-4 rounded-md text-sm text-slate-500 max-h-40 overflow-y-auto whitespace-pre-wrap font-light">
                      {recipient.originalTranscript}
                    </div>
                  </details>
                )}

                {/* Processing Error */}
                {recipient.processingError && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
                    <div className="flex items-center text-red-800 text-sm font-light">
                      <AlertTriangle className="mr-2 h-4 w-4" />
                      {recipient.processingError}
                    </div>
                  </div>
                )}

                {/* Responses */}
                {recipient.responses.length > 0 ? (
                  <div className="space-y-4">
                    {recipient.responses.map((response, responseIndex) => {
                      const isEditing = editingResponseId === `${recipient.recipientId}-${responseIndex}`;
                      
                      return (
                        <div key={responseIndex} className="border border-slate-200 rounded-md p-4">
                          {/* Question Header */}
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                              {getQuestionTypeIcon(response.questionType)}
                              <div>
                                <h4 className="font-light text-berkeleyblue text-lg mb-2">
                                  {response.questionText}
                                </h4>
                              </div>
                            </div>
                            <div className="flex">
                              <Button
                                variant="link"
                                className="text-slate-500 hover:bg-slate-50 text-xs font-light px-1"
                                size={'sm'}
                                onClick={() => setEditingResponseId(isEditing ? null : `${recipient.recipientId}-${responseIndex}`)}
                              >
                                {isEditing ? 
                                <Save className="h-4 w-4 inline-block" />
                                : 
                                <Pencil className="h-4 w-4 inline-block" />}
                              </Button>

                              <Button
                                variant="link"
                                className="text-slate-500 hover:bg-slate-50 text-xs font-light px-1"
                                size={'sm'}
                                onClick={() => handleRemoveResponse(recipient.recipientId, responseIndex)}
                                disabled={isEditing}
                              >
                                <Trash className="h-4 w-4 inline-block" />
                              </Button>
                            </div>
                          </div>

                          {/* Rating Input */}
                          {isEditing && response.questionType === 'rating' && (
                            <div className="mb-4">
                              <label className="block text-sm text-slate-500 mb-3 font-light">Rating (1-10):</label>
                              <div className="flex items-center gap-4">
                                <input
                                  type="range"
                                  min="1"
                                  max="10"
                                  value={response.ratingValue || 5}
                                  onChange={(e) => handleResponseEdit(recipient.recipientId, responseIndex, 'ratingValue', parseInt(e.target.value))}
                                  disabled={!isEditing}
                                  className="flex-1 max-w-xs h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                                />
                                <span className="font-medium min-w-[30px] text-lg text-berkeleyblue">
                                  {response.ratingValue || 5}
                                </span>
                              </div>
                              <div className="flex justify-between text-xs text-slate-400 max-w-xs mt-2 font-light">
                                <span>1 - Poor</span>
                                <span>5 - Average</span>
                                <span>10 - Excellent</span>
                              </div>
                            </div>
                          )}

                          {/* Rating Display */}
                          {!isEditing && response.questionType === 'rating' && response.ratingValue && (
                            <div className="mb-4">
                              {renderStars(response.ratingValue)}
                            </div>
                          )}

                          {/* Text Input */}
                          {(response.questionType === 'text' || response.questionType === 'ai' || response.questionType === 'values') && (
                            <div className="mb-4">
                              <label className="block text-sm text-slate-500 mb-2 font-light">Response:</label>
                              <textarea
                                value={response.textResponse || ''}
                                onChange={(e) => handleResponseEdit(recipient.recipientId, responseIndex, 'textResponse', e.target.value)}
                                disabled={!isEditing}
                                rows={3}
                                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cerulean-400 disabled:bg-slate-100 font-light"
                              />
                            </div>
                          )}

                          {/* Comment */}
                          <div>
                            <label className="flex items-center gap-2 mb-3">
                              <input
                                type="checkbox"
                                checked={response.hasComment}
                                onChange={(e) => handleResponseEdit(recipient.recipientId, responseIndex, 'hasComment', e.target.checked)}
                                disabled={!isEditing}
                                className="rounded"
                              />
                              <span className="text-sm text-slate-500 font-light">Add additional comment</span>
                            </label>
                            {response.hasComment && (
                              <div className="flex items-start gap-2">
                                <FontAwesomeIcon 
                                  icon={faMessage} 
                                  className="h-4 w-4 text-berkeleyblue-200 mt-3"
                                />
                                <textarea
                                  value={response.commentText || ''}
                                  onChange={(e) => handleResponseEdit(recipient.recipientId, responseIndex, 'commentText', e.target.value)}
                                  disabled={!isEditing}
                                  rows={2}
                                  placeholder="Additional comments..."
                                  className="flex-1 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cerulean-400 disabled:bg-slate-100 font-light"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    <p className="font-light">
                      No questions were extracted from this conversation.
                      This might happen if the conversation was too brief or didn&apos;t contain structured feedback.
                    </p>
                  </div>
                )}

                {/* Add New Response */}
                <div className="border-t border-slate-200 pt-4 mt-6">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleAddResponse(recipient.recipientId)}
                  >
                    + Add Custom Question & Response
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Save Button */}
        <div className="text-center mb-8">
          <Button
            variant="default"
            onClick={saveAndComplete}
          >
            Save All Feedback & Complete
          </Button>
        </div>
      </div>
    </div>
    </>
  );
}

// Loading fallback component
function LoadingFallback() {
  return (
    <>
      <FeedbackHeader />
      <div className="flex items-center justify-center py-8">
        <div className="bg-white p-8 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cerulean-400 mx-auto mb-4"></div>
          <h3 className="text-xl font-light text-berkeleyblue mb-2">
            Loading...
          </h3>
          <p className="text-slate-500 text-base font-light">
            Preparing voice feedback processing
          </p>
        </div>
      </div>
    </>
  );
}

// Main page component wrapped in Suspense
export default function VoiceProcessingPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <VoiceProcessingContent />
    </Suspense>
  );
}