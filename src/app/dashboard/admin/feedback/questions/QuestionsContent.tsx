// src/app/feedback/questions/QuestionsContent.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/components/ui/use-toast';
import { Loader2, Plus, MessageSquare, Edit, Trash } from 'lucide-react';
import supabase from '@/lib/supabase/client';
import { useAuth, useIsAdmin } from '@/lib/context/auth-context';
import { FeedbackQuestion } from '@/app/types/feedback';
import CreateQuestionModal from '@/components/admin/CreateQuestionModal';

export default function QuestionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { isAdmin, loading: isAdminLoading } = useIsAdmin();
  
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<FeedbackQuestion[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<FeedbackQuestion | null>(null);
  
  // Check if any filter parameters exist in the URL
  const filterType = searchParams.get('type');
  const filterScope = searchParams.get('scope');
  
  useEffect(() => {
    async function loadCompanyAndQuestions() {
      if (!user) return;
      
      try {
        // Get user's company
        const { data: userData, error: userError } = await supabase
          .from('company_members')
          .select('company_id')
          .eq('id', user.id)
          .single();
          
        if (userError) throw userError;
        
        setCompanyId(userData.company_id);
        
        // Get questions for the company and global questions
        let query = supabase
          .from('feedback_questions')
          .select('*')
          .or(`scope.eq.global,and(scope.eq.company,company_id.eq.${userData.company_id})`);
        
        // Apply filters if they exist
        if (filterType) {
          query = query.eq('question_type', filterType);
        }
        
        if (filterScope) {
          query = query.eq('scope', filterScope);
        }
        
        const { data: questionsData, error: questionsError } = await query.order('scope', { ascending: false });
          
        if (questionsError) throw questionsError;
        
        setQuestions(questionsData || []);
      } catch (error) {
        console.error('Error loading data:', error);
        toast({
          title: 'Error loading feedback questions',
          description: 'Could not load feedback questions. Please try again later.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    }
    
    loadCompanyAndQuestions();
  }, [user, filterType, filterScope]);
  
  const handleToggleActive = async (questionId: string, currentActive: boolean) => {
    try {
      const { error } = await supabase
        .from('feedback_questions')
        .update({ active: !currentActive })
        .eq('id', questionId);
        
      if (error) throw error;
      
      // Update the local state
      setQuestions(prev => 
        prev.map(question => 
          question.id === questionId 
            ? { ...question, active: !currentActive } 
            : question
        )
      );
      
      toast({
        title: 'Question updated',
        description: `Question is now ${!currentActive ? 'active' : 'inactive'}.`,
      });
    } catch (error) {
      console.error('Error updating question:', error);
      toast({
        title: 'Error updating question',
        description: 'Failed to update question status. Please try again.',
        variant: 'destructive',
      });
    }
  };
  
  const handleDeleteQuestion = async (questionId: string) => {
    // Only allow deleting company-specific questions
    const question = questions.find(q => q.id === questionId);
    if (!question || question.scope !== 'company') {
      toast({
        title: 'Cannot delete question',
        description: 'Only company-specific questions can be deleted.',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      const { error } = await supabase
        .from('feedback_questions')
        .delete()
        .eq('id', questionId);
        
      if (error) throw error;
      
      // Update the local state
      setQuestions(prev => prev.filter(question => question.id !== questionId));
      
      toast({
        title: 'Question deleted',
        description: 'The question has been deleted successfully.',
      });
    } catch (error) {
      console.error('Error deleting question:', error);
      toast({
        title: 'Error deleting question',
        description: 'Failed to delete question. Please try again.',
        variant: 'destructive',
      });
    }
  };
  
  // Redirect if not admin
  if (!isAdminLoading && !isAdmin) {
    router.push('/dashboard');
    return null;
  }
  
  if (loading || isAdminLoading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-cerulean" />
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className='text-4xl font-light text-berkeleyblue'>Feedback Questions</h2>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Question
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>All Questions</CardTitle>
          <CardDescription>
            Manage feedback questions used in your cycles.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {questions.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="h-10 w-10 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">No feedback questions found</p>
              <p className="text-gray-400 text-sm mt-1">
                Add questions to start collecting feedback.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Question</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {questions.map((question) => (
                  <TableRow key={question.id}>
                    <TableCell className="font-medium">
                      {question.question_text}
                    </TableCell>
                    <TableCell className="capitalize">
                      {question.question_type}
                    </TableCell>
                    <TableCell className="capitalize">
                      {question.scope}
                    </TableCell>
                    <TableCell>
                      {question.active ? (
                        <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded-full">
                          Inactive
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleActive(question.id, question.active ?? false)}
                        >
                          {question.active ? 'Deactivate' : 'Activate'}
                        </Button>
                        
                        {question.scope === 'company' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingQuestion(question);
                                setShowCreateModal(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-500"
                              onClick={() => handleDeleteQuestion(question.id)}
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      
      {showCreateModal && companyId && (
        <CreateQuestionModal
          companyId={companyId}
          question={editingQuestion}
          onClose={() => {
            setShowCreateModal(false);
            setEditingQuestion(null);
          }}
          onSuccess={(newQuestion) => {
            if (editingQuestion) {
              // Update existing question
              setQuestions(prev => 
                prev.map(q => 
                  q.id === editingQuestion.id ? newQuestion : q
                )
              );
            } else {
              // Add new question
              setQuestions(prev => [...prev, newQuestion]);
            }
            setShowCreateModal(false);
            setEditingQuestion(null);
          }}
        />
      )}
    </div>
  );
}