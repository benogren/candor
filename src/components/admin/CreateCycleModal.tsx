'use client';

import { useState } from 'react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import supabase from '@/lib/supabase/client';

interface Cycle {
  id: string;
  company_id: string;
  cycle_name: string;
  frequency: string;
  start_date: string;
  due_date: string;
  status: string;
}

interface CreateCycleModalProps {
  companyId: string;
  onClose: () => void;
  onSuccess: (cycle: Cycle) => void;
}

export default function CreateCycleModal({ companyId, onClose, onSuccess }: CreateCycleModalProps) {
  const [selectedDay, setSelectedDay] = useState<string>('5'); // Default to Friday (5)
  const [submitting, setSubmitting] = useState(false);
  
  const dayOptions = [
    { value: '0', label: 'Sunday' },
    { value: '1', label: 'Monday' },
    { value: '2', label: 'Tuesday' },
    { value: '3', label: 'Wednesday' },
    { value: '4', label: 'Thursday' },
    { value: '5', label: 'Friday' },
    { value: '6', label: 'Saturday' },
  ];
  
  // Calculate the next occurrence of the selected day
  const getNextDayOccurrence = (dayIndex: number) => {
    const today = new Date();
    const currentDayOfWeek = today.getDay();
    let daysToAdd = dayIndex - currentDayOfWeek;
    
    // If the day has already occurred this week, get next week's occurrence
    if (daysToAdd <= 0) {
      daysToAdd += 7;
    }
    
    const nextOccurrence = new Date(today);
    nextOccurrence.setDate(today.getDate() + daysToAdd);
    // Set to beginning of day
    nextOccurrence.setHours(0, 0, 0, 0);
    
    return nextOccurrence;
  };
  
  const handleSubmit = async () => {
    setSubmitting(true);
    
    try {
      const dayIndex = parseInt(selectedDay);
      const dayName = dayOptions.find(d => d.value === selectedDay)?.label || 'Friday';
      const startDate = getNextDayOccurrence(dayIndex);
      
      // Calculate end date (7 days later)
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 7);
      
      // Auto-generate cycle name
      const cycleName = `Weekly ${dayName} Feedback`;
      
      // Create the cycle
      const { data: cycle, error } = await supabase
        .from('feedback_cycles')
        .insert({
          company_id: companyId,
          cycle_name: cycleName,
          frequency: 'weekly',
          start_date: startDate.toISOString(),
          due_date: endDate.toISOString(),
          status: 'active'
        })
        .select()
        .single();
        
      if (error) throw error;
      
      // The trigger will create the first occurrence automatically
      
      toast({
        title: 'Feedback cycle created',
        description: `Your weekly ${dayName} feedback cycle has been created.`,
      });
      
      onSuccess(cycle as Cycle);
    } catch (error) {
      console.error('Error creating feedback cycle:', error);
      toast({
        title: 'Error creating cycle',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };
  
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Feedback Cycle</DialogTitle>
          <DialogDescription>
            Choose which day of the week you want feedback collection to begin.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="day" className="text-right">
              Day of Week
            </Label>
            <Select
              value={selectedDay}
              onValueChange={setSelectedDay}
              disabled={true}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select day" />
              </SelectTrigger>
              <SelectContent>
                {dayOptions.map(day => (
                  <SelectItem key={day.value} value={day.value}>
                    {day.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="col-span-4 text-sm text-muted-foreground">
            {selectedDay && (
              <p>
                The first feedback cycle will start on{' '}
                {getNextDayOccurrence(parseInt(selectedDay)).toLocaleDateString(undefined, {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </p>
            )}
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
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
      </DialogContent>
    </Dialog>
  );
}