'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import { ArrowLeft, Bold, Italic, Heading1, Heading2, Heading3, Heading4, List, ListOrdered, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { useAuth } from '@/lib/context/auth-context';
import supabase from '@/lib/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { debounce } from 'lodash';
import '../../../styles/editor-styles.css';
import { overpass } from '../../../fonts';

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
  
  // Create a TipTap editor
  const editor = useEditor({
    extensions: [
        StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4]  // Explicitly enable levels 1-4
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
      const html = editor.getHTML();
      handleContentChange(html);
    },
  });
  
  // Fetch the note when the page loads
  useEffect(() => {
    async function fetchNote() {
      if (!id || !user) return;
      
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('notes')
          .select('*')
          .eq('id', id)
          .single();
          
        if (error) throw error;
        
        setNote(data);
        setLastSaved(new Date(data.updated_at));
        
        // Parse content properly before setting it in the editor
        if (editor && data.content) {
          try {
            // Try to parse it if it's stored as JSON string
            if (typeof data.content === 'string' && data.content.startsWith('{')) {
              const parsedContent = JSON.parse(data.content);
              editor.commands.setContent(parsedContent);
            } else {
              // If it's just plain text or HTML, set it directly
              editor.commands.setContent(data.content);
            }
          } catch (e) {
            // If JSON parsing fails, fall back to treating it as plain text
            console.error("Error parsing content:", e);
            editor.commands.setContent(data.content);
          }
        }
      } catch (error) {
        console.error('Error fetching note:', error);
        setError('Could not load the note. You may not have permission to view it.');
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchNote();
  }, [id, user, editor]);
  
  // Start generation if the note is in generating state
  useEffect(() => {
    async function generateContent() {
      if (!note || !note.is_generating) return;
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        
        const response = await fetch('/api/notes/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            id: note.id
          }),
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to generate content');
        }
        
        const data = await response.json();
        setNote(data.note);
        
        // Update editor with new content
        if (editor && data.note.content) {
          try {
            if (typeof data.note.content === 'string' && data.note.content.startsWith('{')) {
              const parsedContent = JSON.parse(data.note.content);
              editor.commands.setContent(parsedContent);
            } else {
              editor.commands.setContent(data.note.content);
            }
          } catch (e) {
            console.error("Error parsing generated content:", e);
            editor.commands.setContent(data.note.content);
          }
        }
      } catch (error) {
        console.error('Error generating content:', error);
        toast({
          title: 'Error generating content',
          description: 'Could not generate content. Please try again later.',
          variant: 'destructive',
        });
      }
    }
    
    generateContent();
  }, [note, editor]);
  
  // Auto-save with debounce
  const saveNote = useCallback(
    debounce(async (title: string, content: string) => {
      if (!note || !user) return;
      
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
      } catch (error) {
        console.error('Error saving note:', error);
        toast({
          title: 'Error saving changes',
          description: 'Could not save your changes. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsSaving(false);
      }
    }, 500),
    [note, user]
  );
  
  // Handle title change
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!note) return;
    
    const newTitle = e.target.value;
    setNote({ ...note, title: newTitle });
    saveNote(newTitle, note.content);
  };
  
  // Handle content change
  const handleContentChange = (content: string) => {
    if (!note) return;
    
    setNote({ ...note, content });
    saveNote(note.title, content);
  };
  
  // Handle back navigation
  const handleBack = () => {
    // router.push('/dashboard/coach');
    router.back();
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
    <div className="flex flex-col min-h-screen px-12">
      {/* Header */}
      <header className="sticky top-0 border-b border-gray-200 z-10 bg-white pb-4 pt-0">
        <div className="container mx-auto px-4 py-2 flex items-center justify-between">
          <div className='flex items-center'>
            <button
              onClick={handleBack}
              className="flex items-center text-gray-600 hover:text-gray-900 h-8"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Back
            </button>

            {/* Title */}
            <input
                type="text"
                value={note.title}
                onChange={handleTitleChange}
                className={` border-none focus:outline-none min-w-[460px] mt-1 focus:ring-0 m-0 p-0 ml-8 ${overpass.className}`}
                disabled={note.is_generating}
                placeholder="Enter title..."
            />
          </div>
        
          
          <div className="text-sm text-gray-500">
            {isSaving ? (
              'Saving...'
            ) : lastSaved ? (
              `Last saved ${formatDistanceToNow(lastSaved, { addSuffix: true })}`
            ) : (
              ''
            )}
          </div>
        </div>
      </header>
      
      {/* Main content */}
      <main className="flex-1 container mx-auto px-0">
        <div className="bg-white overflow-hidden">
          {/* Editor Top Toolbar */}
          <div className="border-b border-gray-200 py-2 px-4 flex items-center gap-1 bg-gray-50">
            <span className="text-sm text-gray-500 mr-2 hidden sm:inline">Format:</span>
            
            {editor && (
              <>
                <button
                  onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                  className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive('heading', { level: 1 }) ? 'bg-gray-200 text-cerulean-600' : 'text-gray-700'}`}
                  title="Heading 1"
                >
                  <Heading1 className="h-4 w-4" />
                </button>
                
                <button
                  onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                  className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive('heading', { level: 2 }) ? 'bg-gray-200 text-cerulean-600' : 'text-gray-700'}`}
                  title="Heading 2"
                >
                  <Heading2 className="h-4 w-4" />
                </button>

                <button
                  onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                  className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive('heading', { level: 3 }) ? 'bg-gray-200 text-cerulean-600' : 'text-gray-700'}`}
                  title="Heading 3"
                >
                  <Heading3 className="h-4 w-4" />
                </button>

                <button
                  onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
                  className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive('heading', { level: 4 }) ? 'bg-gray-200 text-cerulean-600' : 'text-gray-700'}`}
                  title="Heading 4"
                >
                  <Heading4 className="h-4 w-4" />
                </button>
                
                <div className="h-4 w-px bg-gray-300 mx-1"></div>
                
                <button
                  onClick={() => editor.chain().focus().toggleBold().run()}
                  className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive('bold') ? 'bg-gray-200 text-cerulean-600' : 'text-gray-700'}`}
                  title="Bold"
                >
                  <Bold className="h-4 w-4" />
                </button>
                
                <button
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                  className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive('italic') ? 'bg-gray-200 text-cerulean-600' : 'text-gray-700'}`}
                  title="Italic"
                >
                  <Italic className="h-4 w-4" />
                </button>
                
                <div className="h-4 w-px bg-gray-300 mx-1"></div>
                
                <button
                  onClick={() => editor.chain().focus().toggleBulletList().run()}
                  className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive('bulletList') ? 'bg-gray-200 text-cerulean-600' : 'text-gray-700'}`}
                  title="Bullet List"
                >
                  <List className="h-4 w-4" />
                </button>
                
                <button
                  onClick={() => editor.chain().focus().toggleOrderedList().run()}
                  className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive('orderedList') ? 'bg-gray-200 text-cerulean-600' : 'text-gray-700'}`}
                  title="Numbered List"
                >
                  <ListOrdered className="h-4 w-4" />
                </button>
                
                <div className="h-4 w-px bg-gray-300 mx-1"></div>
                
                <button
                  onClick={() => editor.chain().focus().setTextAlign('left').run()}
                  className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive({ textAlign: 'left' }) ? 'bg-gray-200 text-cerulean-600' : 'text-gray-700'}`}
                  title="Align Left"
                >
                  <AlignLeft className="h-4 w-4" />
                </button>
                
                <button
                  onClick={() => editor.chain().focus().setTextAlign('center').run()}
                  className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive({ textAlign: 'center' }) ? 'bg-gray-200 text-cerulean-600' : 'text-gray-700'}`}
                  title="Align Center"
                >
                  <AlignCenter className="h-4 w-4" />
                </button>
                
                <button
                  onClick={() => editor.chain().focus().setTextAlign('right').run()}
                  className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive({ textAlign: 'right' }) ? 'bg-gray-200 text-cerulean-600' : 'text-gray-700'}`}
                  title="Align Right"
                >
                  <AlignRight className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
          
          <div className="p-4">
            
            {/* Editor */}
            {note.is_generating ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cerulean-600 mb-4"></div>
                <p className="text-gray-700">Generating content, please wait...</p>
              </div>
            ) : (
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
  );
}