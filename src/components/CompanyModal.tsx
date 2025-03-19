// src/components/CompanyModal.tsx
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import supabase from '@/lib/supabase/client';
import IndustrySearch from '@/components/IndustrySearch';

interface CompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultValues: {
    id: string;
    name: string;
    industry?: string;
  };
}

interface FormValues {
  name: string;
  industry: string;
}

export function CompanyModal({ isOpen, onClose, defaultValues }: CompanyModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(defaultValues.industry || null);
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<FormValues>({
    defaultValues: {
      name: defaultValues.name || '',
      industry: defaultValues.industry || '',
    },
  });

  const onSubmit = async (data: FormValues) => {
    try {
      setIsSubmitting(true);
      
      // Update company in Supabase with direct industry column
      const { error } = await supabase
        .from('companies')
        .update({
          name: data.name,
          industry: selectedIndustry || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', defaultValues.id);

      if (error) throw error;

      toast({
        title: 'Company Updated',
        description: 'Company information has been successfully updated.',
      });
      
      onClose();
    } catch (error) {
      console.error('Error updating company:', error);
      toast({
        title: 'Update Failed',
        description: 'Could not update company information. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleIndustrySelect = (industry: string) => {
    setSelectedIndustry(industry);
    setValue('industry', industry);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Company Information</DialogTitle>
          <DialogDescription>
            Update your company&#39;s basic information.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Company Name
              </Label>
              <Input
                id="name"
                {...register('name', { required: 'Company name is required' })}
                className="col-span-3"
              />
              {errors.name && (
                <p className="text-red-500 text-sm col-span-3 col-start-2">{errors.name.message}</p>
              )}
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="industry" className="text-right">
                Industry
              </Label>
              <div className="col-span-3">
                <IndustrySearch
                  onSelect={handleIndustrySelect}
                  selectedIndustry={selectedIndustry}
                  placeholder="Search for an industry..."
                  autoFocus={false}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}