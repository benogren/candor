// src/app/dashboard/admin/flagged-feedback/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth, useIsAdmin } from '@/lib/context/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingSpinner } from '@/components/loading-spinner';
import supabase from '@/lib/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

// Define types to exactly match the Supabase response structure
interface FeedbackQuestion {
  id: string;
  question_text: string;
  question_type: string;
}

interface FeedbackUserIdentity {
  id: string;
  email: string | null;
  name: string | null;
  user_id: string | null;
}

interface FeedbackRecipient {
  id: string;
  recipient_id: string;
  feedback_user_identities: FeedbackUserIdentity;
}

// Define the exact structure returned by Supabase
interface FeedbackResponse {
  id: string;
  rating_value: number | null;
  text_response: string | null;
  has_comment: boolean | null;
  comment_text: string | null;
  created_at: string;
  updated_at: string | null;
  is_flagged: boolean;
  flagged_at: string | null;
  flagged_by: string | null;
  session_id: string;
  recipient_id: string;
  question_id: string;
  skipped: boolean | null;
  feedback_questions: FeedbackQuestion;
  feedback_recipients: FeedbackRecipient;
  // [key: string]: any; // Allow other fields that might be in the database
}

export default function FlaggedFeedbackPage() {
  const { user } = useAuth();
  const { isAdmin, loading: isAdminLoading } = useIsAdmin();
  
  const [flaggedItems, setFlaggedItems] = useState<FeedbackResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState<Record<string, boolean>>({});
  
  // Fetch flagged feedback
  useEffect(() => {
    const fetchFlaggedFeedback = async () => {
      if (!user) return;
      
      setLoading(true);
      
      try {
        // Get all flagged feedback with related information
        const { data, error } = await supabase
          .from('feedback_responses')
          .select(`
            *,
            feedback_questions!inner(
              id, 
              question_text,
              question_type
            ),
            feedback_recipients!inner(
              id,
              recipient_id,
              feedback_user_identities!inner(
                id,
                email,
                name,
                user_id
              )
            )
          `)
          .eq('is_flagged', true)
          .order('flagged_at', { ascending: false });
        
        if (error) throw error;
        
        // Direct assignment with type assertion
        setFlaggedItems(data as unknown as FeedbackResponse[]);
      } catch (error) {
        console.error('Error fetching flagged feedback:', error);
        toast({
          title: 'Error',
          description: 'Failed to load flagged feedback',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchFlaggedFeedback();
  }, [user]);
  
  // Handle approving feedback (unflag)
  const handleApprove = async (id: string) => {
    setProcessingIds(prev => ({ ...prev, [id]: true }));
    
    try {
      const { error } = await supabase
        .from('feedback_responses')
        .update({
          is_flagged: false,
          flagged_by: null,
          flagged_at: null
        })
        .eq('id', id);
      
      if (error) throw error;
      
      // Remove from list
      setFlaggedItems(prev => prev.filter(item => item.id !== id));
      
      toast({
        title: 'Feedback approved',
        description: 'The feedback has been unmarked as inappropriate.',
      });
    } catch (error) {
      console.error('Error approving feedback:', error);
      toast({
        title: 'Error',
        description: 'Failed to approve feedback',
        variant: 'destructive',
      });
    } finally {
      setProcessingIds(prev => ({ ...prev, [id]: false }));
    }
  };
  
  // Handle removing feedback
  const handleRemove = async (id: string) => {
    setProcessingIds(prev => ({ ...prev, [id]: true }));
    
    try {
      const { error } = await supabase
        .from('feedback_responses')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      // Remove from list
      setFlaggedItems(prev => prev.filter(item => item.id !== id));
      
      toast({
        title: 'Feedback removed',
        description: 'The inappropriate feedback has been removed.',
      });
    } catch (error) {
      console.error('Error removing feedback:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove feedback',
        variant: 'destructive',
      });
    } finally {
      setProcessingIds(prev => ({ ...prev, [id]: false }));
    }
  };
  
  // Helper to safely get the flagged time
  const getFlaggedTime = (item: FeedbackResponse) => {
    if (item.flagged_at) {
      return new Date(item.flagged_at).toLocaleString();
    }
    return new Date(item.created_at).toLocaleString();
  };

  // Helper to render response content
  const renderResponse = (item: FeedbackResponse) => {
    if (item.feedback_questions.question_type === 'rating' && item.rating_value) {
      return (
        <div>
          <span className="font-medium">Rating: </span>
          <span>{item.rating_value}/5</span>
          
          {item.comment_text && (
            <div className="mt-1 text-sm italic">
              &quot;{item.comment_text}&quot;
            </div>
          )}
        </div>
      );
    } else if (item.feedback_questions.question_type === 'text' && item.text_response) {
      return (
        <div>
          <span className="font-medium">Response: </span>
          <span className="italic">&quot;{item.text_response}&quot;</span>
        </div>
      );
    }
    
    return <span className="text-gray-500">No response</span>;
  };
  
  // Show loading state while checking permissions
  if (isAdminLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner />
          <p className="ml-2">Checking permissions...</p>
        </div>
      </div>
    );
  }
  
  // Redirect or show access denied message for non-admins
  if (!isAdmin) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You need admin privileges to access this page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/dashboard">Return to Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <h3 className='text-2xl font-light text-berkeleyblue'>Flagged Feedback</h3>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard">
            Return to Dashboard
          </Link>
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Review Flagged Feedback</CardTitle>
              <CardDescription>
                These feedback items have been flagged as potentially inappropriate or abusive
              </CardDescription>
            </div>
            <AlertTriangle className="h-8 w-8 text-amber-500" />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <LoadingSpinner />
              <span className="ml-2">Loading flagged feedback...</span>
            </div>
          ) : flaggedItems.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Question</TableHead>
                    <TableHead>Response</TableHead>
                    <TableHead>Feedback For</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Flagged On</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {flaggedItems.map(item => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium max-w-xs truncate">
                        {item.feedback_questions.question_text}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        {renderResponse(item)}
                      </TableCell>
                      <TableCell>
                        {item.feedback_recipients.feedback_user_identities.name || 
                         item.feedback_recipients.feedback_user_identities.email || 
                         'Unknown'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {item.feedback_questions.question_type === 'rating' ? 'Rating' : 'Text'}
                        </Badge>
                      </TableCell>
                      <TableCell>{getFlaggedTime(item)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => handleApprove(item.id)}
                            disabled={processingIds[item.id]}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleRemove(item.id)}
                            disabled={processingIds[item.id]}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Remove
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle className="h-12 w-12 text-green-400 mb-4" />
              <h4 className="text-lg font-medium">No Flagged Feedback</h4>
              <p className="text-gray-500 max-w-md mt-2">
                There are currently no feedback items flagged as inappropriate.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}