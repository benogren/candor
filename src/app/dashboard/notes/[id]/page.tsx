'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import { ArrowLeft, Bold, Italic, Heading1, Heading2, Heading3, Heading4, List, ListOrdered, AlignLeft, AlignCenter, AlignRight, NotebookPen, NotepadText, Sparkles, RefreshCw, CheckCircle } from 'lucide-react';
import { useAuth } from '@/lib/context/auth-context';
import supabase from '@/lib/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { debounce } from 'lodash';
import '../../../styles/editor-styles.css';
import { overpass } from '../../../fonts';
import { radley } from '../../../fonts';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

// Type definitions
type Note = {
  id: string;
  title: string;
  content: string;
  content_type: string;
  creator_id: string;
  subject_member_id?: string;
  subject_invited_id?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  is_generating: boolean;
};

interface GenerationProgress {
  isGenerating: boolean;
  currentStage: 1 | 2;
  stage1Complete: boolean;
  stage2Complete: boolean;
  startTime?: Date;
  progress: number;
  message: string;
  hasError: boolean;
  errorMessage?: string;
}

interface Stage1Response {
  success: boolean;
  summary: string;
  userContext: {
    userName: string;
    jobTitle: string;
    company: string;
    industry: string;
  };
  feedbackCount: number;
  usedFallback?: boolean;
}

interface ProgressStage {
  progress: number;
  message: string;
  duration: number;
}

export default function NotesPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const { user } = useAuth();
  
  const [note, setNote] = useState<Note | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Generation progress tracking with two stages
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress>({
    isGenerating: false,
    currentStage: 1,
    stage1Complete: false,
    stage2Complete: false,
    progress: 0,
    message: '',
    hasError: false
  });
  
  // Store stage 1 response for stage 2
  const [stage1Response, setStage1Response] = useState<Stage1Response | null>(null);
  
  // References for timers and generation control
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const debouncedSaveRef = useRef<ReturnType<typeof debounce> | null>(null);
  
  // Prevent multiple simultaneous generations
  const generationInProgressRef = useRef(false);

  // Create a TipTap editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4]
        }
      }),
      Placeholder.configure({
        placeholder: 'Start writing...',
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
        alignments: ['left', 'center', 'right'],
        defaultAlignment: 'left',
      }),
    ],
    editorProps: {
      attributes: {
        class: 'focus:outline-none max-w-full prose prose-lg prose-stone dark:prose-invert prose-headings:font-title font-default focus:outline-none',
      },
    },
    content: '',
    onUpdate: ({ editor }) => {
      if (!generationProgress.isGenerating) {
        const html = editor.getHTML();
        handleContentChange(html);
      }
    },
  });

  // Auto-save with debounce
  const saveNote = useCallback((title: string, content: string) => {
    if (!note?.id || !user || generationProgress.isGenerating) return;
    
    if (debouncedSaveRef.current) {
      debouncedSaveRef.current.cancel();
    }
    
    const saveToDB = async () => {
      try {
        setIsSaving(true);
        
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        
        const response = await fetch('/api/notes/update', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            id: note.id,
            title,
            content,
          }),
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to save note');
        }
        
        const data = await response.json();
        setNote(data.note);
        setLastSaved(new Date());
      } catch (saveError) {
        console.error('Error saving note:', saveError);
        toast({
          title: 'Error saving changes',
          description: 'Could not save your changes. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsSaving(false);
      }
    };

    debouncedSaveRef.current = debounce(saveToDB, 500);
    debouncedSaveRef.current();
  }, [note?.id, user, generationProgress.isGenerating]);

  // Handle title change
  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!note || generationProgress.isGenerating) return;
    
    const newTitle = e.target.value;
    setNote(prevNote => prevNote ? { ...prevNote, title: newTitle } : null);
    saveNote(newTitle, note.content);
  }, [note, saveNote, generationProgress.isGenerating]);
  
  // Handle content change
  const handleContentChange = useCallback((content: string) => {
    if (!note || generationProgress.isGenerating) return;
    
    setNote(prevNote => prevNote ? { ...prevNote, content } : null);
    saveNote(note.title, content);
  }, [note, saveNote, generationProgress.isGenerating]);

  // Helper function to determine which API endpoint to call (updated for themes)
  const getGenerationEndpoint = useCallback((contentType: string, isManagerContent: boolean): string => {
    const baseUrl = '/api/notes/generate';
    
    switch (contentType) {
      case 'prep':
        return isManagerContent ? `${baseUrl}/managerprep` : `${baseUrl}/prep`;
      case 'review':
        return isManagerContent ? `${baseUrl}/managerreview` : `${baseUrl}/review`;
      case 'summary': // Handle both old and new naming
      case 'themes':
        return isManagerContent ? `${baseUrl}/managerthemes` : `${baseUrl}/themes`;
      default:
        // Fallback to themes if content type is unknown
        return isManagerContent ? `${baseUrl}/managerthemes` : `${baseUrl}/themes`;
    }
  }, []);

  // Function to update the note after generation
  const updateNoteAfterGeneration = useCallback(async (content: string, usedFallback = false) => {
    if (!note?.id) throw new Error('Note ID not available');

    console.log('Updating note after generation...', note.id);

    try {
      const { data: updatedNote, error: updateError } = await supabase
        .from('notes')
        .update({
          content: content,
          is_generating: false,
          updated_at: new Date().toISOString(),
          metadata: {
            ...note.metadata,
            generated_at: new Date().toISOString(),
            stage2_completed: true,
            used_fallback: usedFallback
          }
        })
        .eq('id', note.id)
        .select()
        .single();

      if (updateError) {
        console.error('Database update error:', updateError);
        throw updateError;
      }

      console.log('Note updated successfully:', updatedNote);

      // Update local state immediately
      setNote(updatedNote);
      setLastSaved(new Date(updatedNote.updated_at));
      
      // Update editor with new content
      if (editor && content) {
        try {
          editor.commands.setContent(content);
          console.log('Editor content updated');
        } catch (editorError) {
          console.error("Error setting editor content:", editorError);
        }
      }

    } catch (error) {
      console.error('Error updating note after generation:', error);
      
      // Even if database update fails, try to update local state to prevent stuck loading
      setNote(prev => prev ? { ...prev, is_generating: false, content } : null);
      if (editor && content) {
        editor.commands.setContent(content);
      }
      
      throw new Error('Failed to save generated content');
    }
  }, [note, editor]);

  // Two-stage progress simulation
  const startProgressSimulation = useCallback(() => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
    }

    const stage1Stages: ProgressStage[] = [
      { progress: 15, message: 'Identifying feedback sources...', duration: 2000 },
      { progress: 35, message: 'Gathering feedback data...', duration: 3000 },
      { progress: 50, message: 'Analyzing feedback patterns...', duration: 4000 },
    ];

    const stage2Stages: ProgressStage[] = [
      { progress: 60, message: 'Processing feedback analysis...', duration: 2000 },
      { progress: 75, message: 'Generating personalized content...', duration: 5000 },
      { progress: 90, message: 'Finalizing document...', duration: 3000 },
    ];

    let currentStages = stage1Stages;
    let stageIndex = 0;
    let currentProgress = 5;

    const updateProgress = () => {
      if (stageIndex < currentStages.length) {
        const stage = currentStages[stageIndex];
        const increment = (stage.progress - currentProgress) / (stage.duration / 1000);
        
        const timer = setInterval(() => {
          currentProgress = Math.min(currentProgress + increment, stage.progress);
          
          setGenerationProgress(prev => {
            if (!prev.isGenerating) return prev;
            return {
              ...prev,
              progress: Math.round(currentProgress),
              message: stage.message
            };
          });

          if (currentProgress >= stage.progress) {
            clearInterval(timer);
            stageIndex++;
            if (stageIndex < currentStages.length) {
              setTimeout(updateProgress, 500);
            } else if (currentStages === stage1Stages) {
              // Stage 1 complete, wait for actual stage transition
              setGenerationProgress(prev => ({
                ...prev,
                progress: 55,
                message: 'Stage 1 complete - starting content generation...'
              }));
            }
          }
        }, 1000);

        progressTimerRef.current = timer;
      }
    };

    // Start stage 1 simulation
    setTimeout(updateProgress, 1000);

    // Function to switch to stage 2 simulation
    const switchToStage2 = () => {
      currentStages = stage2Stages;
      stageIndex = 0;
      currentProgress = 55;
      setTimeout(updateProgress, 1000);
    };

    return switchToStage2;
  }, []);

  // Stage 1: Analyze feedback
  const executeStage1 = useCallback(async (): Promise<Stage1Response> => {
    if (!note) throw new Error('Note not available');

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    if (!token) {
      throw new Error('Authentication required');
    }

    // Determine the user to analyze (subject of the note)
    const targetUserId = note.subject_member_id || note.subject_invited_id || user?.id;
    const isInvitedUser = !!note.subject_invited_id;

    const requestBody = {
      userId: user?.id,
      employeeId: targetUserId,
      timeframe: note.metadata?.timeframe || 'week',
      isInvited: isInvitedUser
    };

    const response = await fetch('/api/notes/generate/summary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(requestBody),
      signal: abortControllerRef.current?.signal
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Stage 1 failed: ${response.statusText}`);
    }

    return await response.json();
  }, [note?.id, note?.subject_member_id, note?.subject_invited_id, note?.metadata?.timeframe, user?.id]);

  // Stage 2: Generate content (updated for themes endpoints)
  const executeStage2 = useCallback(async (stage1Data: Stage1Response) => {
    if (!note) throw new Error('Note not available');

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    if (!token) {
      throw new Error('Authentication required');
    }

    // Determine if this is manager content
    const isManagerContent = !!(note.subject_member_id || note.subject_invited_id);
    
    // Get previous context if it's a prep note
    const previousContext = note.content_type === 'prep' && note.metadata?.previousContext 
      ? String(note.metadata.previousContext) 
      : '';

    // Create simplified request body - each endpoint only gets what it needs
    const requestBody = {
      summary: stage1Data.summary,
      userContext: stage1Data.userContext,
      feedbackCount: stage1Data.feedbackCount,
      ...(note.content_type === 'prep' && { previousContext })
      // Note: themes endpoints handle manager vs individual logic through routing
    };

    // Route to the appropriate API endpoint
    const apiEndpoint = getGenerationEndpoint(note.content_type, isManagerContent);
    
    console.log(`Calling ${apiEndpoint} with simplified request`);
    
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(requestBody),
      signal: abortControllerRef.current?.signal
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Stage 2 failed: ${response.statusText}`);
    }

    const result = await response.json();
    
    // Now update the note in the frontend
    await updateNoteAfterGeneration(result.content, result.usedFallback);
    
    return result;
  }, [note, getGenerationEndpoint, updateNoteAfterGeneration]);

  // Main two-stage generation orchestration
  const startTwoStageGeneration = useCallback(async () => {
    if (!note?.id || generationInProgressRef.current) {
      console.log('Generation already in progress or no note ID');
      return;
    }

    console.log('Starting two-stage generation for note:', note.id);
    generationInProgressRef.current = true;

    // Create abort controller for this request
    abortControllerRef.current = new AbortController();

    setGenerationProgress({
      isGenerating: true,
      currentStage: 1,
      stage1Complete: false,
      stage2Complete: false,
      startTime: new Date(),
      progress: 5,
      message: 'Starting feedback analysis...',
      hasError: false
    });

    // Start progress simulation
    const switchToStage2Simulation = startProgressSimulation();

    try {
      // Stage 1: Analyze feedback
      console.log('Starting Stage 1: Feedback analysis');
      setGenerationProgress(prev => ({
        ...prev,
        currentStage: 1,
        message: 'Analyzing feedback data...'
      }));

      const stage1Result = await executeStage1();
      setStage1Response(stage1Result);
      console.log('Stage 1 completed:', stage1Result);

      // Stage 1 complete
      setGenerationProgress(prev => ({
        ...prev,
        stage1Complete: true,
        progress: 55,
        message: `Analysis complete! Found ${stage1Result.feedbackCount} feedback items. Starting content generation...`
      }));

      // Brief pause to show stage 1 completion
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Start stage 2 progress simulation
      switchToStage2Simulation();

      // Stage 2: Generate content
      console.log('Starting Stage 2: Content generation');
      setGenerationProgress(prev => ({
        ...prev,
        currentStage: 2,
        message: 'Generating personalized content...'
      }));

      const stage2Result = await executeStage2(stage1Result);
      console.log('Stage 2 completed:', stage2Result);

      // Both stages complete - reset generation state immediately
      console.log('Both stages complete, resetting generation state');
      setGenerationProgress({
        isGenerating: false,
        currentStage: 2,
        stage1Complete: true,
        stage2Complete: true,
        progress: 100,
        message: 'Content generation completed!',
        hasError: false
      });

      // Clear timers
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }

      toast({
        title: 'Generation Complete',
        description: `Your ${note.content_type} has been generated based on ${stage1Result.feedbackCount} feedback responses!`,
      });

      // After a brief delay, fully reset the generation UI
      setTimeout(() => {
        console.log('Final reset of generation progress');
        setGenerationProgress({
          isGenerating: false,
          currentStage: 1,
          stage1Complete: false,
          stage2Complete: false,
          progress: 0,
          message: '',
          hasError: false
        });
        setStage1Response(null);
      }, 3000);

    } catch (generationError: unknown) {
      if (generationError instanceof Error && generationError.name === 'AbortError') {
        console.log('Generation aborted');
        return;
      }

      console.error('Error in two-stage generation:', generationError);
      
      // Clear timers on error
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
      
      const errorMessage = generationError instanceof Error 
        ? generationError.message 
        : 'Generation failed';
      
      setGenerationProgress(prev => ({
        ...prev,
        isGenerating: false,
        hasError: true,
        errorMessage: errorMessage
      }));
      
      // Also ensure the note is marked as not generating in case of error
      if (note?.id) {
        await supabase
          .from('notes')
          .update({ is_generating: false })
          .eq('id', note.id);
        
        setNote(prev => prev ? { ...prev, is_generating: false } : null);
      }
      
      toast({
        title: 'Generation Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      console.log('Generation cleanup');
      generationInProgressRef.current = false;
    }
  }, [note?.id, note?.content_type, executeStage1, executeStage2, startProgressSimulation]);
  
  // Fetch the note when the page loads
  useEffect(() => {
    let isMounted = true;
    
    async function fetchNote() {
      if (!id || !user) return;
      
      try {
        setIsLoading(true);
        console.log('Fetching note:', id);
        
        const { data, error: fetchError } = await supabase
          .from('notes')
          .select('*')
          .eq('id', id)
          .single();
          
        if (fetchError) throw fetchError;
        
        if (isMounted) {
          console.log('Note fetched:', data);
          setNote(data);
          setLastSaved(new Date(data.updated_at));
          
          // Set editor content if available
          if (editor && data.content) {
            try {
              if (typeof data.content === 'string' && data.content.startsWith('{')) {
                const parsedContent = JSON.parse(data.content);
                editor.commands.setContent(parsedContent);
              } else {
                editor.commands.setContent(data.content);
              }
              console.log('Editor content set');
            } catch (parseError) {
              console.error("Error parsing content:", parseError);
              editor.commands.setContent(data.content);
            }
          }

          // If note is generating, log this but don't auto-start here
          // Let the separate useEffect handle the auto-start logic
          if (data.is_generating) {
            console.log('Note is in generating state, auto-start logic will handle this');
          }
        }
      } catch (fetchError) {
        console.error('Error fetching note:', fetchError);
        if (isMounted) {
          setError('Could not load the note. You may not have permission to view it.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
          console.log('Note loading complete');
        }
      }
    }
    
    fetchNote();
    
    return () => {
      isMounted = false;
    };
  }, [id, user, editor]);

  // Handle retry generation
  const handleRetryGeneration = useCallback(async () => {
    if (!note?.id) return;
    
    console.log('Retrying generation for note:', note.id);
    
    // Reset error state
    generationInProgressRef.current = false;
    setGenerationProgress({
      isGenerating: false,
      currentStage: 1,
      stage1Complete: false,
      stage2Complete: false,
      progress: 0,
      message: '',
      hasError: false
    });
    setStage1Response(null);
    
    // Clear any existing timers
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    
    // Mark note as generating if it isn't already
    if (!note.is_generating) {
      console.log('Marking note as generating');
      const { error: updateError } = await supabase
        .from('notes')
        .update({ is_generating: true })
        .eq('id', note.id);
      
      if (updateError) {
        console.error('Error updating note status:', updateError);
        return;
      }
      
      setNote(prev => prev ? { ...prev, is_generating: true } : null);
    }
    
    // Start generation
    await startTwoStageGeneration();
  }, [note, startTwoStageGeneration]);

  // Handle back navigation
  const handleBack = useCallback(() => {
    // Clean up before leaving
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    router.back();
  }, [router]);

  // Auto-start generation when note is in generating state - with better conditions
  useEffect(() => {
    // Only auto-start if:
    // 1. Note exists and is marked as generating
    // 2. No generation is currently in progress
    // 3. No generation error has occurred
    // 4. Generation hasn't been completed yet
    if (note?.is_generating && 
        !generationProgress.isGenerating && 
        !generationProgress.hasError && 
        !generationInProgressRef.current &&
        !generationProgress.stage2Complete) {
      console.log('Auto-starting generation for note in generating state');
      startTwoStageGeneration();
    }
  }, [note?.is_generating, generationProgress.isGenerating, generationProgress.hasError, generationProgress.stage2Complete, startTwoStageGeneration]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('Cleaning up notes page');
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (debouncedSaveRef.current) {
        debouncedSaveRef.current.cancel();
      }
      generationInProgressRef.current = false;
    };
  }, []);

  // Render generation status with two-stage support
  const renderGenerationStatus = () => {
    const { isGenerating, hasError, progress, message, errorMessage, startTime, currentStage, stage1Complete, stage2Complete } = generationProgress;
    
    // Debug logging
    console.log('Render generation status:', {
      isGenerating,
      hasError,
      stage1Complete,
      stage2Complete,
      progress,
      noteIsGenerating: note?.is_generating
    });
    
    if (!isGenerating && !hasError && !stage1Complete) return null;

    const elapsed = startTime ? Math.round((Date.now() - startTime.getTime()) / 1000) : 0;
    const estimatedTotal = 90; // seconds for both stages
    const estimatedRemaining = Math.max(0, estimatedTotal - elapsed);

    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        {/* Status Content */}
        <div className="flex flex-col items-center max-w-md text-center">
          {hasError ? (
            <>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Generation Failed</h3>
              <p className="text-gray-600 mb-2">Failed during Stage {currentStage}</p>
              <p className="text-gray-600 mb-4">{errorMessage}</p>
              <div className="flex space-x-3">
                <Button
                  variant={"outline"}
                  onClick={handleRetryGeneration}
                  >
                    Retry Generation
                  </Button>
              </div>
            </>
          ) : stage1Complete && !stage2Complete && !isGenerating ? (
            <>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Analysis Complete!</h3>
              <p className="text-gray-600 mb-2">
                {stage1Response ? `Found ${stage1Response.feedbackCount} feedback responses` : 'Feedback analysis completed'}
              </p>
              <p className="text-gray-600 mb-4">Starting content generation...</p>
            </>
          ) : (
            <>
              <h3 className="text-lg font-medium text-gray-900 mb-8">
                {currentStage === 1 ? 'Analyzing Feedback' : 'Generating Content'}
              </h3>
              <p className="text-gray-600 mb-2">{message}</p>
              {elapsed > 60 && (
                <p className="text-sm text-yellow-600 mb-4">
                  This is taking longer than usual. Please wait...
                </p>
              )}
            </>
          )}
        </div>

        {/* Progress Bar */}
        <div className="w-full max-w-md mb-6">
          <div className="flex justify-between items-center text-sm text-gray-600 mb-2">
            <span className="font-medium">{message || (hasError ? 'Generation failed' : 'Processing...')}</span>
            <div className="flex items-center space-x-2">
              {elapsed > 0 && !hasError && <span>{elapsed}s</span>}
              {isGenerating && estimatedRemaining > 0 && (
                <span className="text-gray-500">
                  (~{estimatedRemaining}s remaining)
                </span>
              )}
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div 
              className={`h-3 rounded-full transition-all duration-500 ease-out ${
                hasError ? 'bg-red-500' : 'bg-cerulean-600'
              }`}
              style={{ width: `${Math.max(5, progress)}%` }}
            ></div>
          </div>
          <div className="text-xs text-gray-500 mt-1 text-right">
            {hasError ? 'Failed' : `${progress}% complete`}
          </div>
          
          {/* Stage indicators */}
          <div className="flex justify-between items-center mt-3 text-xs">
            <div className={`flex items-center ${stage1Complete ? 'text-nonphotoblue-600' : currentStage === 1 ? 'text-cerulean' : 'text-gray-400'}`}>
              {stage1Complete ? <CheckCircle className="h-3 w-3 mr-1" /> : currentStage === 1 ? <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> : <div className="h-3 w-3 mr-1 rounded-full border border-gray-300" />}
              Stage 1: Analysis
            </div>
            <div className={`flex items-center ${stage2Complete ? 'text-nonphotoblue-600' : currentStage === 2 ? 'text-cerulean' : 'text-gray-400'}`}>
              {stage2Complete ? <CheckCircle className="h-3 w-3 mr-1" /> : currentStage === 2 ? <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> : <div className="h-3 w-3 mr-1 rounded-full border border-gray-300" />}
              Stage 2: Content
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
        <p className="text-gray-700 mb-6">{error}</p>
        <button
          onClick={handleBack}
          className="flex items-center px-4 py-2 bg-gray-100 rounded-md hover:bg-gray-200"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </button>
      </div>
    );
  }
  
  if (!note) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p>Note not found.</p>
      </div>
    );
  }
  
  return (
    <div className='container mx-auto'>
      {/* Header */}
      <div className='bg-white rounded-lg shadow-md p-6 mb-2 border border-gray-100'>
        <div className='flex items-center'>
          <div className='flex-none'>
            <div className='bg-gray-100 rounded-md p-2 items-center'>
              <Link 
                onClick={handleBack}
                href={``}
                aria-label='Back to notes'
              >
                {note.content_type === 'prep' && (
                  <NotepadText className="h-12 w-12 text-cerulean-400" />
                )}
                {note.content_type === 'review' && (
                  <NotebookPen className="h-12 w-12 text-cerulean-400" />
                )}
                {(note.content_type === 'summary' || note.content_type === 'themes') && (
                  <Sparkles className="h-12 w-12 text-cerulean-400" />
                )}
              </Link>
            </div>
          </div>
          <div className='grow mr-4 ml-4'>
            <div className={`text-3xl font-light text-cerulean ${radley.className} w-full`}>
              <input
                type="text"
                value={note.title}
                onChange={handleTitleChange}
                className={`border-none rounded-md focus:outline hover:outline w-full focus:ring-0 m-0 p-0`}
                disabled={generationProgress.isGenerating}
                placeholder="Enter title..."
              />
              <p className='text-cerulean-300 text-sm font-light'>
                {isSaving ? (
                  'Saving...'
                ) : lastSaved ? (
                  `Last saved ${formatDistanceToNow(lastSaved, { addSuffix: true })}`
                ) : (
                  ''
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex flex-col min-h-screen">
        <main className="flex-1 container mx-auto px-0">
          <div className="bg-white overflow-hidden">
            {/* Editor Toolbar */}
            <div className="border-b border-gray-200 py-2 px-4 flex items-center gap-1 bg-gray-50">
              <span className="text-sm text-gray-500 mr-2 hidden sm:inline">Format:</span>
              
              {editor && (
                <>
                <Button
                  variant="link"
                    onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                    className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive('heading', { level: 1 }) ? 'bg-gray-200 text-cerulean-600' : 'text-gray-700'}`}
                    title="Heading 1"
                    disabled={generationProgress.isGenerating}
                >
                  <Heading1 className="h-4 w-4" />
                </Button>
                <Button
                  variant="link"
                  onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                  className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive('heading', { level: 2 }) ? 'bg-gray-200 text-cerulean-600' : 'text-gray-700'}`}
                  title="Heading 2"
                  disabled={generationProgress.isGenerating}
                  >
                    <Heading2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="link"
                  onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                  className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive('heading', { level: 3 }) ? 'bg-gray-200 text-cerulean-600' : 'text-gray-700'}`}
                  title="Heading 3"
                  disabled={generationProgress.isGenerating}
                >
                  <Heading3 className="h-4 w-4" />
                </Button>
                <Button
                  variant="link"
                  onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
                  className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive('heading', { level: 4 }) ? 'bg-gray-200 text-cerulean-600' : 'text-gray-700'}`}
                  title="Heading 4"
                  disabled={generationProgress.isGenerating}
                >
                  <Heading4 className="h-4 w-4" />
                </Button>
                  
                  <div className="h-4 w-px bg-gray-300 mx-1"></div>
                <Button
                  variant="link"
                  onClick={() => editor.chain().focus().toggleBold().run()}
                  className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive('bold') ? 'bg-gray-200 text-cerulean-600' : 'text-gray-700'}`}
                  title="Bold"
                  disabled={generationProgress.isGenerating}
                >
                  <Bold className="h-4 w-4" />
                </Button>

                <Button
                  variant="link"
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                  className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive('italic') ? 'bg-gray-200 text-cerulean-600' : 'text-gray-700'}`}
                  title="Italic"
                  disabled={generationProgress.isGenerating}
                >
                  <Italic className="h-4 w-4" />
                </Button>
                  
                  <div className="h-4 w-px bg-gray-300 mx-1"></div>

                  <Button
                    variant="link"
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive('bulletList') ? 'bg-gray-200 text-cerulean-600' : 'text-gray-700'}`}
                    title="Bullet List"
                    disabled={generationProgress.isGenerating}
                  >
                    <List className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="link"
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive('orderedList') ? 'bg-gray-200 text-cerulean-600' : 'text-gray-700'}`}
                    title="Numbered List"
                    disabled={generationProgress.isGenerating}
                  >
                    <ListOrdered className="h-4 w-4" />
                  </Button>
                  
                  <div className="h-4 w-px bg-gray-300 mx-1"></div>

                  <Button
                    variant="link"
                    onClick={() => editor.chain().focus().setTextAlign('left').run()}
                    className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive({ textAlign: 'left' }) ? 'bg-gray-200 text-cerulean-600' : 'text-gray-700'}`}
                    title="Align Left"
                    disabled={generationProgress.isGenerating}
                  >
                    <AlignLeft className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="link"
                    onClick={() => editor.chain().focus().setTextAlign('center').run()}
                    className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive({ textAlign: 'center' }) ? 'bg-gray-200 text-cerulean-600' : 'text-gray-700'}`}
                    title="Align Center"
                    disabled={generationProgress.isGenerating}
                  >
                    <AlignCenter className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="link"
                    onClick={() => editor.chain().focus().setTextAlign('right').run()}
                    className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive({ textAlign: 'right' }) ? 'bg-gray-200 text-cerulean-600' : 'text-gray-700'}`}
                    title="Align Right"
                    disabled={generationProgress.isGenerating}
                  >
                    <AlignRight className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
            
            <div className="p-4">
              {/* Show generation status or editor */}
              {(generationProgress.isGenerating || generationProgress.hasError || generationProgress.stage1Complete) ? 
                renderGenerationStatus() : (
                <div className={`w-full mx-auto overflow-hidden ${overpass.className}`}>
                  {editor && (
                    <BubbleMenu editor={editor} tippyOptions={{ duration: 100 }}>
                      <div className="flex items-center bg-white shadow-lg rounded-md border border-gray-200 p-1">
                        <button
                          onClick={() => editor.chain().focus().toggleBold().run()}
                          className={`p-1.5 rounded ${editor.isActive('bold') ? 'bg-gray-100' : ''}`}
                        >
                          <Bold className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => editor.chain().focus().toggleItalic().run()}
                          className={`p-1.5 rounded ${editor.isActive('italic') ? 'bg-gray-100' : ''}`}
                        >
                          <Italic className="h-4 w-4" />
                        </button>
                      </div>
                    </BubbleMenu>
                  )}
                  <EditorContent 
                    editor={editor} 
                    className={`min-h-[600px] focus:outline-none ${overpass.className}`} 
                  />
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}