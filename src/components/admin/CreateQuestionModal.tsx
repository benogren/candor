// src/components/admin/CreateQuestionModal.tsx
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import supabase from '@/lib/supabase/client';
import { FeedbackQuestion } from '@/app/types/feedback';

// Update the type definition if you don't want to modify the original FeedbackQuestion type
interface ExtendedFeedbackQuestion extends FeedbackQuestion {
  question_description?: string;
}

const formSchema = z.object({
  questionText: z.string().min(1, {
    message: 'Question text is required',
  }),
  questionDescription: z.string().optional(),
  questionType: z.enum(['rating', 'text']),
  active: z.boolean().default(true),
});

interface CreateQuestionModalProps {
  companyId: string;
  question?: ExtendedFeedbackQuestion | null;
  onClose: () => void;
  onSuccess: (question: ExtendedFeedbackQuestion) => void;
}

export default function CreateQuestionModal({
  companyId,
  question,
  onClose,
  onSuccess,
}: CreateQuestionModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = !!question;
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      questionText: question?.question_text || '',
      questionDescription: question?.question_description || '',
      questionType: (question?.question_type as 'rating' | 'text') || 'text',
      active: question?.active ?? true,
    },
  });
  
  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    
    try {
      if (isEditing) {
        // Update existing question
        const { data, error } = await supabase
          .from('feedback_questions')
          .update({
            question_text: values.questionText,
            question_description: values.questionDescription,
            question_type: values.questionType,
            active: values.active,
          })
          .eq('id', question.id)
          .select()
          .single();
          
        if (error) throw error;
        
        if (data) {
          toast({
            title: 'Question Updated',
            description: 'Your feedback question has been updated successfully.',
          });
          
          onSuccess(data);
        }
      } else {
        // Create new question
        const { data, error } = await supabase
          .from('feedback_questions')
          .insert({
            company_id: companyId,
            question_text: values.questionText,
            question_description: values.questionDescription,
            question_type: values.questionType,
            scope: 'company',
            active: values.active,
          })
          .select()
          .single();
          
        if (error) throw error;
        
        if (data) {
          toast({
            title: 'Question Created',
            description: 'Your feedback question has been created successfully.',
          });
          
          onSuccess(data);
        }
      }
    } catch (error) {
      console.error('Error saving question:', error);
      toast({
        title: 'Error',
        description: `Failed to ${isEditing ? 'update' : 'create'} feedback question. Please try again.`,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }
  
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Feedback Question' : 'Create New Feedback Question'}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? 'Edit your company-specific feedback question.' 
              : 'Add a new company-specific feedback question.'}
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
            <FormField
              control={form.control}
              name="questionText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Question Text</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g., What should {name} keep doing?" 
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    Use {'{name}'} to include the recipient&apos;s name in the question
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="questionDescription"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Add additional context or examples for the question..."
                      className="resize-y min-h-[80px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    You can also use {'{name}'} to include the recipient&apos;s name in the description
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center gap-2 space-y-0">
                  <FormControl>
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={field.onChange}
                      className="h-4 w-4 rounded border-gray-300 text-cerulean focus:ring-cerulean"
                    />
                  </FormControl>
                  <FormLabel className="!mt-0">Active</FormLabel>
                </FormItem>
              )}
            />
            
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isEditing ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  isEditing ? 'Update Question' : 'Create Question'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}