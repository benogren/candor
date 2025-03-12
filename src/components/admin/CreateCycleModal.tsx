// src/components/admin/CreateCycleModal.tsx
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { 
  Form, 
  FormControl, 
  FormDescription, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import supabase from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

type FeedbackCycle = {
  id: string;
  cycle_name: string;
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  start_date: string;
  due_date: string;
  status: 'draft' | 'active';
  company_id: string;
  created_at: string;
};

// Define form schema with validation
const formSchema = z.object({
  cycle_name: z.string().min(2, 'Cycle name must be at least 2 characters'),
  frequency: z.enum(['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly']),
  start_date: z.date({
    required_error: 'Start date is required',
  }),
  initial_status: z.enum(['draft', 'active']),
});

// Types for component props and form schema
type FormValues = z.infer<typeof formSchema>;

type CreateCycleModalProps = {
  companyId: string;
  onClose: () => void;
  onSuccess: (newCycle?: FeedbackCycle) => void; // ✅ Replace `any` with `FeedbackCycle`
};

export default function CreateCycleModal({ companyId, onClose, onSuccess }: CreateCycleModalProps) {
  const [submitting, setSubmitting] = useState(false);

  // Initialize form with default values
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      cycle_name: '',
      frequency: 'weekly',
      start_date: new Date(),
      initial_status: 'draft',
    },
  });

  // Calculate due date based on frequency and start date
  const calculateDueDate = (startDate: Date, frequency: string): Date => {
    const dueDate = new Date(startDate);
    
    switch (frequency) {
      case 'weekly':
        dueDate.setDate(dueDate.getDate() + 7);
        break;
      case 'biweekly':
        dueDate.setDate(dueDate.getDate() + 14);
        break;
      case 'monthly':
        dueDate.setMonth(dueDate.getMonth() + 1);
        break;
      case 'quarterly':
        dueDate.setMonth(dueDate.getMonth() + 3);
        break;
      case 'yearly':
        dueDate.setFullYear(dueDate.getFullYear() + 1);
        break;
      default:
        dueDate.setDate(dueDate.getDate() + 7); // Default to weekly
    }
    
    return dueDate;
  };

  const onSubmit = async (data: FormValues) => {
    setSubmitting(true);

    try {
      // Calculate the due date
      const dueDate = calculateDueDate(data.start_date, data.frequency);

      // Create new feedback cycle
      const { data: newCycle, error } = await supabase
        .from('feedback_cycles')
        .insert({
          cycle_name: data.cycle_name,
          frequency: data.frequency,
          start_date: data.start_date.toISOString(),
          due_date: dueDate.toISOString(),
          status: data.initial_status,
          company_id: companyId,
        })
        .select('id, cycle_name, frequency, start_date, due_date, status, company_id, created_at') // Ensure created_at is included
        .single();

      if (error) throw error;

      onSuccess(newCycle as FeedbackCycle); 

      toast({
        title: 'Feedback cycle created',
        description: `Successfully created the ${data.cycle_name} feedback cycle.`,
      });

      onSuccess(newCycle);
    } catch (error) {
      console.error('Error creating feedback cycle:', error);
      toast({
        title: 'Error creating cycle',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Feedback Cycle</DialogTitle>
          <DialogDescription>
            Set up a new feedback cycle for your team.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="cycle_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cycle Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Q1 2025 Feedback" {...field} />
                  </FormControl>
                  <FormDescription>
                    A descriptive name for this feedback cycle.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="frequency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Frequency</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="biweekly">Every 2 Weeks</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    How often feedback requests will be sent.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="start_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Start Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) => date < new Date("1900-01-01")}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormDescription>
                    When this feedback cycle begins.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="initial_status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Initial Status</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Set to Active to start sending feedback requests immediately.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Cycle'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}