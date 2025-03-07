// components/orgchart/UserAssignmentModal.tsx
import React, { useState } from 'react';
import { User } from '@/app/types/orgChart.types';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, UserPlus } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface UserAssignmentModalProps {
  user: User | null;
  managers: User[];
  onAssign: (userId: string, managerId: string | null, isInvited?: boolean) => Promise<boolean>;
  onCreateManager: () => void;
  onClose: () => void;
}

const UserAssignmentModal: React.FC<UserAssignmentModalProps> = ({
  user,
  managers,
  onAssign,
  onCreateManager,
  onClose,
}) => {
  // Define a constant for "no manager" value
  const NO_MANAGER_VALUE = "none";
  
  const [selectedManagerId, setSelectedManagerId] = useState<string | null>(user?.managerId || null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (user.id) {
      setIsSubmitting(true);
      
      // If onAssign only accepts 2 parameters, just pass those
      const success = await onAssign(user.id, selectedManagerId);
      
      setIsSubmitting(false);
      
      if (success) {
        onClose();
      }
    }
  };

  // Handle Select value changes
  const handleManagerChange = (value: string) => {
    setSelectedManagerId(value === NO_MANAGER_VALUE ? null : value);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Manager</DialogTitle>
          <DialogDescription>
            Assign a manager for <span className="font-medium">{user.name}</span>
            {user.isInvited && ' (Invited)'}
          </DialogDescription>
        </DialogHeader>
        
        {user.isPending && (
          <Alert className="bg-blue-50 border-blue-200">
            <AlertDescription className="text-blue-800">
              This user has registered but has not verified their email yet.
            </AlertDescription>
          </Alert>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-4">
            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="manager">Select Manager</Label>
              <Select
                value={selectedManagerId || NO_MANAGER_VALUE}
                onValueChange={handleManagerChange}
              >
                <SelectTrigger id="manager">
                  <SelectValue placeholder="Select a manager" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_MANAGER_VALUE}>No Manager</SelectItem>
                  {managers
                    .filter((manager) => manager.id !== user.id) // Can't be own manager
                    .map((manager) => (
                      <SelectItem key={manager.id} value={manager.id}>
                        {manager.name} {manager.isInvited ? '(Invited)' : ''}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center">
              <Button 
                type="button"
                variant="secondary" 
                onClick={onCreateManager}
                className="flex items-center gap-2"
              >
                <UserPlus className="h-4 w-4" />
                Create and invite new manager
              </Button>
            </div>
          </div>
          
          <DialogFooter className="sm:justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default UserAssignmentModal;