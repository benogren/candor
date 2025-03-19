// src/components/ProfileModal.tsx
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

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultValues: {
    name: string;
    email: string;
    job_title?: string;
  };
}

interface FormValues {
  name: string;
  email: string;
  job_title: string;
}

export function ProfileModal({ isOpen, onClose, defaultValues }: ProfileModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      name: defaultValues.name || '',
      email: defaultValues.email || '',
      job_title: defaultValues.job_title || '',
    },
  });

  const onSubmit = async (data: FormValues) => {
    try {
      setIsSubmitting(true);
      
      // Update user profile in Supabase
      const { error } = await supabase
        .from('user_profiles')
        .update({
          name: data.name,
          job_title: data.job_title,
        })
        .eq('email', data.email);

      if (error) throw error;

      toast({
        title: 'Profile Updated',
        description: 'Your profile has been successfully updated.',
      });
      
      onClose();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: 'Update Failed',
        description: 'Could not update your profile. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Determine if the form is required (i.e., for initial profile completion)
  const isRequired = !defaultValues.job_title;

  return (
    <Dialog open={isOpen} onOpenChange={isRequired ? undefined : onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isRequired ? 'Complete Your Profile' : 'Edit Profile'}</DialogTitle>
          <DialogDescription>
            {isRequired 
              ? 'Please provide your job title to continue. This information helps your colleagues provide more relevant feedback.'
              : 'Update your profile information below.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                {...register('name', { required: 'Name is required' })}
                className="col-span-3"
              />
              {errors.name && (
                <p className="text-red-500 text-sm col-span-3 col-start-2">{errors.name.message}</p>
              )}
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">
                Email
              </Label>
              <Input
                id="email"
                {...register('email')}
                disabled
                className="col-span-3 bg-gray-100"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="job_title" className="text-right">
                Job Title
              </Label>
              <Input
                id="job_title"
                {...register('job_title', { required: 'Job title is required' })}
                className="col-span-3"
              />
              {errors.job_title && (
                <p className="text-red-500 text-sm col-span-3 col-start-2">{errors.job_title.message}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            {!isRequired && (
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}