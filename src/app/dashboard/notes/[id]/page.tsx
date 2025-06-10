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
import React from 'react';

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

// Memoized Generation Status Component to prevent unnecessary re-renders
const GenerationStatus = React.memo(({ 
  generationProgress, 
  stage1Response, 
  onRetry 
}: {
  generationProgress: GenerationProgress;
  stage1Response: Stage1Response | null;
  onRetry: () => void;
}) => {
  const { isGenerating, hasError, progress, message, errorMessage, startTime, currentStage, stage1Complete, stage2Complete } = generationProgress;
  
  // Don't render anything if no generation is happening
  if (!isGenerating && !hasError && !stage1Complete) return null;

  const elapsed = startTime ? Math.round((Date.now() - startTime.getTime()) / 1000) : 0;
  const estimatedTotal = 90;
  const estimatedRemaining = Math.max(0, estimatedTotal - elapsed);

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="flex flex-col items-center max-w-md text-center">
        {hasError ? (
          <>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Generation Failed</h3>
            <p className="text-gray-600 mb-2">Failed during Stage {currentStage}</p>
            <p className="text-gray-600 mb-4">{errorMessage}</p>
            <div className="flex space-x-3">
              <Button variant="outline" onClick={onRetry}>
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
});

GenerationStatus.displayName = 'GenerationStatus';

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
  
  // Component mounted flag to prevent operations after unmount
  const isMountedRef = useRef(true);

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

  // Function to fetch previous prep note content
  const fetchPreviousPrepContent = useCallback(async (): Promise<string> => {
    if (!note || note.content_type !== 'prep' || !user) {
      return '';
    }

    try {
      console.log('Fetching previous prep note...');
      
      // Build query to find the most recent prep note for the same subject and creator
      let query = supabase
        .from('notes')
        .select('content, created_at')
        .eq('content_type', 'prep')
        .eq('creator_id', user.id)
        .neq('id', note.id) // Exclude current note
        .order('created_at', { ascending: false })
        .limit(1);

      // Add subject filter
      if (note.subject_member_id) {
        query = query.eq('subject_member_id', note.subject_member_id);
      } else if (note.subject_invited_id) {
        query = query.eq('subject_invited_id', note.subject_invited_id);
      } else {
        // Self-prep note (no subject specified)
        query = query.is('subject_member_id', null).is('subject_invited_id', null);
      }

      const { data: previousNotes, error: fetchError } = await query;

      if (fetchError) {
        console.error('Error fetching previous prep note:', fetchError);
        return '';
      }

      if (previousNotes && previousNotes.length > 0) {
        const previousNote = previousNotes[0];
        console.log('Found previous prep note from:', previousNote.created_at);
        
        // Extract text content from HTML if needed
        let content = previousNote.content;
        if (content) {
          // Simple HTML to text conversion for context
          content = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
          // Limit content length for context (keep it reasonable for API)
          if (content.length > 2000) {
            content = content.substring(0, 2000) + '...';
          }
        }
        
        return content || '';
      }

      console.log('No previous prep note found');
      return '';
    } catch (error) {
      console.error('Error fetching previous prep content:', error);
      return '';
    }
  }, [note, user]);

  // Auto-save with debounce and DOM safety
  const saveNote = useCallback((title: string, content: string) => {
    if (!note?.id || !user || generationProgress.isGenerating || !isMountedRef.current) return;
    
    if (debouncedSaveRef.current) {
      debouncedSaveRef.current.cancel();
    }
    
    const saveToDB = async () => {
      // Double-check component is still mounted before proceeding
      if (!isMountedRef.current) return;
      
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
        
        // Only update state if component is still mounted
        if (isMountedRef.current) {
          setNote(data.note);
          setLastSaved(new Date());
        }
      } catch (saveError) {
        console.error('Error saving note:', saveError);
        if (isMountedRef.current) {
          toast({
            title: 'Error saving changes',
            description: 'Could not save your changes. Please try again.',
            variant: 'destructive',
          });
        }
      } finally {
        if (isMountedRef.current) {
          setIsSaving(false);
        }
      }
    };

    debouncedSaveRef.current = debounce(saveToDB, 500);
    debouncedSaveRef.current();
  }, [note?.id, note, user, generationProgress.isGenerating]);

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

  // Function to update the note after generation with complete DOM safety
  const updateNoteAfterGeneration = useCallback(async (content: string, usedFallback = false) => {
    if (!note?.id || !isMountedRef.current) throw new Error('Note ID not available or component unmounted');

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

      // Only update state if component is still mounted
      if (!isMountedRef.current) return;

      // Update local state immediately
      setNote(updatedNote);
      setLastSaved(new Date(updatedNote.updated_at));
      
      // Update editor with new content (with maximum safety checks)
      if (editor && content && isMountedRef.current) {
        const updateEditor = () => {
          if (!isMountedRef.current || !editor || editor.isDestroyed) return;
          
          try {
            editor.commands.setContent(content);
            console.log('Editor content updated');
          } catch (editorError) {
            console.error("Error setting editor content:", editorError);
            // Don't try fallback methods if component is unmounting
            if (!isMountedRef.current) return;
            
            try {
              editor.commands.clearContent();
              editor.commands.insertContent(content);
            } catch (fallbackError) {
              console.error("Fallback editor update also failed:", fallbackError);
            }
          }
        };

        // Use requestAnimationFrame for safer DOM timing
        requestAnimationFrame(() => {
          if (isMountedRef.current) {
            updateEditor();
          }
        });
      }

    } catch (error) {
      console.error('Error updating note after generation:', error);
      
      // Only try recovery if component is still mounted
      if (!isMountedRef.current) return;
      
      // Even if database update fails, try to update local state to prevent stuck loading
      setNote(prev => prev ? { ...prev, is_generating: false, content } : null);
      
      // Try to update editor content even if database update failed
      if (editor && content && isMountedRef.current) {
        requestAnimationFrame(() => {
          if (isMountedRef.current && editor && !editor.isDestroyed) {
            try {
              editor.commands.setContent(content);
            } catch (editorError) {
              console.error("Error setting editor content in error handler:", editorError);
            }
          }
        });
      }
      
      throw new Error('Failed to save generated content');
    }
  }, [note, editor]);

  // Simplified progress simulation without complex timers
  const startProgressSimulation = useCallback(() => {
    let isActive = true;

    const updateProgress = (targetProgress: number, message: string) => {
      if (!isActive || !isMountedRef.current) return;
      
      try {
        setGenerationProgress(prev => ({
          ...prev,
          progress: targetProgress,
          message: message
        }));
      } catch (error) {
        console.log('Progress update failed:', error);
      }
    };

    // Stage 1 progress points
    const stage1Updates = [
      { progress: 15, message: 'Identifying feedback sources...', delay: 2000 },
      { progress: 35, message: 'Gathering feedback data...', delay: 4000 },
      { progress: 50, message: 'Analyzing feedback patterns...', delay: 6000 },
    ];

    // Stage 2 progress points  
    const stage2Updates = [
      { progress: 60, message: 'Processing feedback analysis...', delay: 1000 },
      { progress: 75, message: 'Generating personalized content...', delay: 3000 },
      { progress: 90, message: 'Finalizing document...', delay: 5000 },
    ];

    let timeoutIds: NodeJS.Timeout[] = [];

    // Schedule stage 1 updates
    stage1Updates.forEach(update => {
      const timeoutId = setTimeout(() => {
        updateProgress(update.progress, update.message);
      }, update.delay);
      timeoutIds.push(timeoutId);
    });

    const switchToStage2 = () => {
      if (!isActive) return;
      
      // Clear any remaining stage 1 timeouts
      timeoutIds.forEach(id => clearTimeout(id));
      timeoutIds = [];
      
      // Schedule stage 2 updates
      stage2Updates.forEach(update => {
        const timeoutId = setTimeout(() => {
          updateProgress(update.progress, update.message);
        }, update.delay);
        timeoutIds.push(timeoutId);
      });
    };

    const cleanup = () => {
      isActive = false;
      timeoutIds.forEach(id => clearTimeout(id));
      timeoutIds = [];
    };

    return { switchToStage2, cleanup };
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

  // Stage 2: Generate content (updated to fetch previous prep content)
  const executeStage2 = useCallback(async (stage1Data: Stage1Response) => {
    if (!note) throw new Error('Note not available');

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    if (!token) {
      throw new Error('Authentication required');
    }

    // Determine if this is manager content
    const isManagerContent = !!(note.subject_member_id || note.subject_invited_id);
    
    // Get previous context - fetch from previous prep note if content type is prep
    let previousContext = '';
    if (note.content_type === 'prep') {
      console.log('Fetching previous prep content for context...');
      try {
        previousContext = await fetchPreviousPrepContent();
        if (previousContext) {
          console.log('Previous prep content found:', previousContext.substring(0, 200) + '...');
        } else {
          console.log('No previous prep content found');
        }
      } catch (error) {
        console.error('Error fetching previous prep content:', error);
        // Continue without previous context if fetch fails
      }
    } else if (note.metadata?.previousContext) {
      // Fallback to metadata if available
      previousContext = String(note.metadata.previousContext);
    }

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
    
    console.log(`Calling ${apiEndpoint} with request including previous context:`, !!previousContext);
    
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
  }, [note, getGenerationEndpoint, updateNoteAfterGeneration, fetchPreviousPrepContent]);

  // Simplified two-stage generation without complex state management
  const startTwoStageGeneration = useCallback(async () => {
    if (!note?.id || generationInProgressRef.current || !isMountedRef.current) {
      console.log('Generation conditions not met');
      return;
    }

    console.log('Starting simplified two-stage generation');
    generationInProgressRef.current = true;

    // Create abort controller
    abortControllerRef.current = new AbortController();

    // Set initial state once
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

    // Start simplified progress
    const progressController = startProgressSimulation();

    try {
      // Stage 1
      console.log('Starting Stage 1');
      const stage1Result = await executeStage1();
      
      if (!isMountedRef.current || !generationInProgressRef.current) {
        progressController.cleanup();
        return;
      }
      
      setStage1Response(stage1Result);
      
      // Update for stage 1 completion
      setGenerationProgress(prev => ({
        ...prev,
        stage1Complete: true,
        progress: 55,
        message: `Analysis complete! Found ${stage1Result.feedbackCount} feedback items.`
      }));

      // Brief pause
      await new Promise(resolve => setTimeout(resolve, 2000));

      if (!isMountedRef.current || !generationInProgressRef.current) {
        progressController.cleanup();
        return;
      }

      // Stage 2
      console.log('Starting Stage 2');
      progressController.switchToStage2();
      
      setGenerationProgress(prev => ({
        ...prev,
        currentStage: 2,
        message: note.content_type === 'prep' ? 'Generating prep with previous context...' : 'Generating personalized content...'
      }));

      await executeStage2(stage1Result);
      console.log('Generation complete');

      if (!isMountedRef.current) {
        progressController.cleanup();
        return;
      }

      // Cleanup and complete
      progressController.cleanup();
      
      setGenerationProgress({
        isGenerating: false,
        currentStage: 2,
        stage1Complete: true,
        stage2Complete: true,
        progress: 100,
        message: 'Content generation completed!',
        hasError: false
      });

      if (isMountedRef.current) {
        toast({
          title: 'Generation Complete',
          description: `Your ${note.content_type} has been generated!`,
        });

        // Reset after delay
        setTimeout(() => {
          if (isMountedRef.current) {
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
          }
        }, 3000);
      }

    } catch (error: unknown) {
      progressController.cleanup();
      
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Generation aborted');
        return;
      }

      console.error('Generation error:', error);
      
      if (!isMountedRef.current) return;
      
      const errorMessage = error instanceof Error ? error.message : 'Generation failed';
      
      setGenerationProgress(prev => ({
        ...prev,
        isGenerating: false,
        hasError: true,
        errorMessage: errorMessage
      }));
      
      // Update note status
      if (note?.id && isMountedRef.current) {
        try {
          await supabase.from('notes').update({ is_generating: false }).eq('id', note.id);
          setNote(prev => prev ? { ...prev, is_generating: false } : null);
        } catch (updateError) {
          console.error('Failed to update note status:', updateError);
        }
      }
      
      if (isMountedRef.current) {
        toast({
          title: 'Generation Failed',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    } finally {
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

  // Handle retry generation with complete DOM safety
  const handleRetryGeneration = useCallback(async () => {
    if (!note?.id || !isMountedRef.current) return;
    
    console.log('Retrying generation for note:', note.id);
    
    try {
      // Reset error state and clean up any existing operations
      generationInProgressRef.current = false;
      
      // Clean up any existing timers
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
      
      // Cancel any existing requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      // Only continue if component is still mounted
      if (!isMountedRef.current) return;
      
      // Reset state completely
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
      
      // Wait a moment for cleanup to complete
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Check again if component is still mounted
      if (!isMountedRef.current) return;
      
      // Mark note as generating if it isn't already
      if (!note.is_generating) {
        console.log('Marking note as generating');
        const { error: updateError } = await supabase
          .from('notes')
          .update({ is_generating: true })
          .eq('id', note.id);
        
        if (updateError) {
          console.error('Error updating note status:', updateError);
          if (isMountedRef.current) {
            toast({
              title: 'Error',
              description: 'Failed to start generation. Please try again.',
              variant: 'destructive',
            });
          }
          return;
        }
        
        if (isMountedRef.current) {
          setNote(prev => prev ? { ...prev, is_generating: true } : null);
        }
      }
      
      // Final check before starting generation
      if (!isMountedRef.current) return;
      
      // Start generation
      await startTwoStageGeneration();
      
    } catch (error) {
      console.error('Error in retry generation:', error);
      if (isMountedRef.current) {
        toast({
          title: 'Retry Failed',
          description: 'Could not restart generation. Please refresh the page and try again.',
          variant: 'destructive',
        });
      }
    }
  }, [note, startTwoStageGeneration]);

  // Handle back navigation
  const handleBack = useCallback(() => {
    // Clean up before leaving
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    router.back();
  }, [router]);

  // Auto-start generation when note is in generating state - with complete safety checks
  useEffect(() => {
    // Only auto-start if all conditions are met and component is mounted
    if (isMountedRef.current &&
        note?.is_generating && 
        !generationProgress.isGenerating && 
        !generationProgress.hasError && 
        !generationInProgressRef.current &&
        !generationProgress.stage2Complete &&
        note.id) {
      
      console.log('Auto-starting generation for note in generating state', note.id);
      
      // Add a small delay to ensure component is fully mounted and stable
      const timeoutId = setTimeout(() => {
        // Double-check conditions before starting and ensure still mounted
        if (isMountedRef.current &&
            note?.is_generating && 
            !generationInProgressRef.current && 
            !generationProgress.isGenerating) {
          startTwoStageGeneration();
        }
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [note?.is_generating, note?.id, generationProgress.isGenerating, generationProgress.hasError, generationProgress.stage2Complete, startTwoStageGeneration]);

  // Cleanup on unmount with complete DOM safety
  useEffect(() => {
    // Set mounted flag to true when component mounts
    isMountedRef.current = true;
    
    return () => {
      console.log('Cleaning up notes page - preventing all DOM operations');
      
      // Set flag to prevent any ongoing operations
      isMountedRef.current = false;
      generationInProgressRef.current = false;
      
      // Clean up progress timer
      if (progressTimerRef.current) {
        try {
          clearInterval(progressTimerRef.current);
          progressTimerRef.current = null;
        } catch (error) {
          console.log('Error clearing progress timer:', error);
        }
      }
      
      // Abort any ongoing requests
      if (abortControllerRef.current) {
        try {
          abortControllerRef.current.abort();
        } catch (abortError) {
          console.log('Error aborting request:', abortError);
        }
      }
      
      // Cancel any pending saves
      if (debouncedSaveRef.current) {
        try {
          debouncedSaveRef.current.cancel();
        } catch (cancelError) {
          console.log('Error canceling debounced save:', cancelError);
        }
      }
    };
  }, []);

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
                <GenerationStatus 
                  generationProgress={generationProgress}
                  stage1Response={stage1Response}
                  onRetry={handleRetryGeneration}
                /> : (
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