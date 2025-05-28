'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import { ArrowLeft, Bold, Italic, Heading1, Heading2, Heading3, Heading4, List, ListOrdered, AlignLeft, AlignCenter, AlignRight, NotebookPen, NotepadText, Sparkles, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '@/lib/context/auth-context';
import supabase from '@/lib/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { debounce } from 'lodash';
import '../../../styles/editor-styles.css';
import { overpass } from '../../../fonts';
import { radley } from '../../../fonts';
import Link from 'next/link';

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
  startTime?: Date;
  progress: number;
  message: string;
  hasError: boolean;
  errorMessage?: string;
}

interface ProgressStage {
  progress: number;
  message: string;
  duration: number;
}

interface NoteUpdateData {
  content: string;
  is_generating: boolean;
  updated_at: string;
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
  
  // Generation progress tracking
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress>({
    isGenerating: false,
    progress: 0,
    message: '',
    hasError: false
  });
  
  // References for timers and generation control
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const debouncedSaveRef = useRef<ReturnType<typeof debounce> | null>(null);

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

  // Fetch updated note after generation
  const fetchUpdatedNote = useCallback(async () => {
    if (!id) return;

    try {
      const { data, error: fetchError } = await supabase
        .from('notes')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      setNote(data);
      setLastSaved(new Date(data.updated_at));
      
      // Update editor with new content
      if (editor && data.content) {
        try {
          editor.commands.setContent(data.content);
        } catch (editorError) {
          console.error("Error setting editor content:", editorError);
        }
      }

    } catch (fetchError) {
      console.error('Error fetching updated note:', fetchError);
    }
  }, [id, editor]);

  // Simulate progress for better UX during generation
  const startProgressSimulation = useCallback(() => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
    }

    const stages: ProgressStage[] = [
      { progress: 25, message: 'Gathering feedback data...', duration: 3000 },
      { progress: 45, message: 'Analyzing responses...', duration: 5000 },
      { progress: 65, message: 'Processing with AI...', duration: 10000 },
      { progress: 85, message: 'Finalizing content...', duration: 8000 },
    ];

    let stageIndex = 0;
    let currentProgress = 15;

    const updateProgress = () => {
      if (stageIndex < stages.length) {
        const stage = stages[stageIndex];
        const increment = (stage.progress - currentProgress) / (stage.duration / 2000);
        
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
            if (stageIndex < stages.length) {
              setTimeout(updateProgress, 1000);
            }
          }
        }, 2000);

        progressTimerRef.current = timer;
      }
    };

    setTimeout(updateProgress, 2000);
  }, []);

  // Poll for note updates during generation
  const startPollingForUpdates = useCallback(() => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
    }

    pollingTimerRef.current = setInterval(async () => {
      try {
        const { data, error: pollError } = await supabase
          .from('notes')
          .select('content, is_generating, updated_at')
          .eq('id', id)
          .single();

        if (pollError) throw pollError;

        const noteData = data as NoteUpdateData;

        // If generation is complete (is_generating is false and we have content)
        if (!noteData.is_generating && noteData.content && noteData.content !== note?.content) {
          // Stop polling
          if (pollingTimerRef.current) {
            clearInterval(pollingTimerRef.current);
            pollingTimerRef.current = null;
          }

          // Update note and editor
          setNote(prev => prev ? { ...prev, ...noteData } : null);
          setLastSaved(new Date(noteData.updated_at));
          
          if (editor && noteData.content) {
            editor.commands.setContent(noteData.content);
          }

          // Update progress to completed
          setGenerationProgress({
            isGenerating: false,
            progress: 100,
            message: 'Content generation completed!',
            hasError: false
          });

          toast({
            title: 'Generation Complete',
            description: 'Your content has been generated and is now available for editing!',
          });
        }
      } catch (pollError) {
        console.error('Error polling for updates:', pollError);
      }
    }, 3000); // Poll every 3 seconds
  }, [id, note?.content, editor]);

  // Enhanced generation with progress tracking
  const startGenerationWithProgress = useCallback(async () => {
    if (!note?.id || generationProgress.isGenerating) return;

    // Create abort controller for this request
    abortControllerRef.current = new AbortController();

    setGenerationProgress({
      isGenerating: true,
      startTime: new Date(),
      progress: 5,
      message: 'Starting content generation...',
      hasError: false
    });

    // Start progress simulation
    startProgressSimulation();
    
    // Start polling for note updates immediately
    startPollingForUpdates();

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('Authentication required');
      }

      // Update progress
      setGenerationProgress(prev => ({
        ...prev,
        progress: 15,
        message: 'Connecting to generation service...'
      }));

      // Set a shorter timeout for the request to handle Vercel timeouts gracefully
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout - continuing in background')), 25000)
      );

      const fetchPromise = fetch('/api/notes/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ id: note.id }),
        signal: abortControllerRef.current.signal
      });

      try {
        const response = await Promise.race([fetchPromise, timeoutPromise]);
        
        if (response instanceof Response) {
          if (!response.ok) {
            // If it's a 504 timeout, don't treat it as an error - continue polling
            if (response.status === 504) {
              console.log('Gateway timeout detected - continuing with background polling');
              setGenerationProgress(prev => ({
                ...prev,
                progress: 30,
                message: 'Request timed out, but generation continues in background...'
              }));
              return; // Let polling handle the rest
            }
            
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Request failed: ${response.statusText}`);
          }

          // Generation completed successfully via direct response
          setGenerationProgress(prev => ({
            ...prev,
            progress: 100,
            message: 'Content generation completed!',
            isGenerating: false
          }));

          await fetchUpdatedNote();

          toast({
            title: 'Generation Complete',
            description: 'Your content has been generated successfully!',
          });
        }
      } catch (timeoutError) {
        // Handle timeout gracefully - let polling continue
        console.log('Request timed out, continuing with background polling', timeoutError);
        setGenerationProgress(prev => ({
          ...prev,
          progress: 25,
          message: 'Generation continues in background - polling for updates...'
        }));
        
        toast({
          title: 'Generation In Progress',
          description: 'Generation is taking longer than usual but continues in the background. You\'ll see updates automatically.',
        });
        
        // Don't throw - let polling handle completion
        return;
      }

    } catch (generationError: unknown) {
      if (generationError instanceof Error && generationError.name === 'AbortError') {
        console.log('Generation was cancelled');
        return;
      }

      console.error('Error generating content:', generationError);
      
      const errorMessage = generationError instanceof Error 
        ? generationError.message 
        : 'Generation failed';
      
      // If it's a timeout error, don't show as failed - continue polling
      if (errorMessage.includes('timeout') || errorMessage.includes('Request timeout')) {
        setGenerationProgress(prev => ({
          ...prev,
          progress: 30,
          message: 'Generation continues in background...'
        }));
        return;
      }
      
      setGenerationProgress({
        isGenerating: false,
        progress: 0,
        message: '',
        hasError: true,
        errorMessage: errorMessage
      });
      
      toast({
        title: 'Generation Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  }, [note?.id, generationProgress.isGenerating, startProgressSimulation, startPollingForUpdates, fetchUpdatedNote]);
  
  // Fetch the note when the page loads
  useEffect(() => {
    let isMounted = true;
    
    async function fetchNote() {
      if (!id || !user) return;
      
      try {
        setIsLoading(true);
        const { data, error: fetchError } = await supabase
          .from('notes')
          .select('*')
          .eq('id', id)
          .single();
          
        if (fetchError) throw fetchError;
        
        if (isMounted) {
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
            } catch (parseError) {
              console.error("Error parsing content:", parseError);
              editor.commands.setContent(data.content);
            }
          }

          // If note is generating, start the generation process
          if (data.is_generating) {
            startGenerationWithProgress();
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
        }
      }
    }
    
    fetchNote();
    
    return () => {
      isMounted = false;
    };
  }, [id, user, editor, startGenerationWithProgress]);

  // Handle retry generation
  const handleRetryGeneration = useCallback(async () => {
    if (!note?.id) return;
    
    // Reset error state
    setGenerationProgress({
      isGenerating: false,
      progress: 0,
      message: '',
      hasError: false
    });
    
    // Mark note as generating if it isn't already
    if (!note.is_generating) {
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
    await startGenerationWithProgress();
  }, [note, startGenerationWithProgress]);

  // Cancel generation
  const handleCancelGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Clean up timers
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }

    setGenerationProgress({
      isGenerating: false,
      progress: 0,
      message: '',
      hasError: false
    });

    toast({
      title: 'Generation Cancelled',
      description: 'Content generation has been cancelled.',
    });
  }, []);

  // Handle back navigation
  const handleBack = useCallback(() => {
    // Clean up before leaving
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    router.back();
  }, [router]);

  // Auto-start generation when note is in generating state
  useEffect(() => {
    if (note?.is_generating && !generationProgress.isGenerating && !generationProgress.hasError) {
      startGenerationWithProgress();
    }
  }, [note?.is_generating, generationProgress.isGenerating, generationProgress.hasError, startGenerationWithProgress]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
      }
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (debouncedSaveRef.current) {
        debouncedSaveRef.current.cancel();
      }
    };
  }, []);

  // Render generation status
  const renderGenerationStatus = () => {
    const { isGenerating, hasError, progress, message, errorMessage, startTime } = generationProgress;
    
    if (!isGenerating && !hasError) return null;

    const elapsed = startTime ? Math.round((Date.now() - startTime.getTime()) / 1000) : 0;
    const estimatedTotal = 60; // seconds
    const estimatedRemaining = Math.max(0, estimatedTotal - elapsed);

    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
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
        </div>

        {/* Status Content */}
        <div className="flex flex-col items-center max-w-md text-center">
          <div className="flex items-center justify-center h-16 w-16 rounded-full bg-gray-50 mb-4">
            {hasError ? (
              <XCircle className="h-6 w-6 text-red-600" />
            ) : isGenerating ? (
              <RefreshCw className="h-6 w-6 text-blue-600 animate-spin" />
            ) : (
              <CheckCircle className="h-6 w-6 text-green-600" />
            )}
          </div>

          {hasError ? (
            <>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Generation Failed</h3>
              <p className="text-gray-600 mb-4">{errorMessage}</p>
              <div className="flex space-x-3">
                <button
                  onClick={handleRetryGeneration}
                  className="px-4 py-2 bg-cerulean-600 text-white rounded-md hover:bg-cerulean-700 transition-colors flex items-center"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry Generation
                </button>
                <button
                  onClick={handleBack}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Go Back
                </button>
              </div>
            </>
          ) : (
            <>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Generating Content</h3>
              <p className="text-gray-600 mb-2">{message}</p>
              {elapsed > 30 && (
                <p className="text-sm text-yellow-600 mb-4">
                  This is taking longer than usual. Please wait...
                </p>
              )}
              <button
                onClick={handleCancelGeneration}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel Generation
              </button>
            </>
          )}
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
                {note.content_type === 'summary' && (
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
                  <button
                    onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                    className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive('heading', { level: 1 }) ? 'bg-gray-200 text-cerulean-600' : 'text-gray-700'}`}
                    title="Heading 1"
                    disabled={generationProgress.isGenerating}
                  >
                    <Heading1 className="h-4 w-4" />
                  </button>
                  
                  <button
                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive('heading', { level: 2 }) ? 'bg-gray-200 text-cerulean-600' : 'text-gray-700'}`}
                    title="Heading 2"
                    disabled={generationProgress.isGenerating}
                  >
                    <Heading2 className="h-4 w-4" />
                  </button>

                  <button
                    onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                    className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive('heading', { level: 3 }) ? 'bg-gray-200 text-cerulean-600' : 'text-gray-700'}`}
                    title="Heading 3"
                    disabled={generationProgress.isGenerating}
                  >
                    <Heading3 className="h-4 w-4" />
                  </button>

                  <button
                    onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
                    className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive('heading', { level: 4 }) ? 'bg-gray-200 text-cerulean-600' : 'text-gray-700'}`}
                    title="Heading 4"
                    disabled={generationProgress.isGenerating}
                  >
                    <Heading4 className="h-4 w-4" />
                  </button>
                  
                  <div className="h-4 w-px bg-gray-300 mx-1"></div>
                  
                  <button
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive('bold') ? 'bg-gray-200 text-cerulean-600' : 'text-gray-700'}`}
                    title="Bold"
                    disabled={generationProgress.isGenerating}
                  >
                    <Bold className="h-4 w-4" />
                  </button>
                  
                  <button
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive('italic') ? 'bg-gray-200 text-cerulean-600' : 'text-gray-700'}`}
                    title="Italic"
                    disabled={generationProgress.isGenerating}
                  >
                    <Italic className="h-4 w-4" />
                  </button>
                  
                  <div className="h-4 w-px bg-gray-300 mx-1"></div>
                  
                  <button
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive('bulletList') ? 'bg-gray-200 text-cerulean-600' : 'text-gray-700'}`}
                    title="Bullet List"
                    disabled={generationProgress.isGenerating}
                  >
                    <List className="h-4 w-4" />
                  </button>
                  
                  <button
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive('orderedList') ? 'bg-gray-200 text-cerulean-600' : 'text-gray-700'}`}
                    title="Numbered List"
                    disabled={generationProgress.isGenerating}
                  >
                    <ListOrdered className="h-4 w-4" />
                  </button>
                  
                  <div className="h-4 w-px bg-gray-300 mx-1"></div>
                  
                  <button
                    onClick={() => editor.chain().focus().setTextAlign('left').run()}
                    className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive({ textAlign: 'left' }) ? 'bg-gray-200 text-cerulean-600' : 'text-gray-700'}`}
                    title="Align Left"
                    disabled={generationProgress.isGenerating}
                  >
                    <AlignLeft className="h-4 w-4" />
                  </button>
                  
                  <button
                    onClick={() => editor.chain().focus().setTextAlign('center').run()}
                    className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive({ textAlign: 'center' }) ? 'bg-gray-200 text-cerulean-600' : 'text-gray-700'}`}
                    title="Align Center"
                    disabled={generationProgress.isGenerating}
                  >
                    <AlignCenter className="h-4 w-4" />
                  </button>
                  
                  <button
                    onClick={() => editor.chain().focus().setTextAlign('right').run()}
                    className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive({ textAlign: 'right' }) ? 'bg-gray-200 text-cerulean-600' : 'text-gray-700'}`}
                    title="Align Right"
                    disabled={generationProgress.isGenerating}
                  >
                    <AlignRight className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
            
            <div className="p-4">
              {/* Show generation status or editor */}
              {(generationProgress.isGenerating || generationProgress.hasError) ? 
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