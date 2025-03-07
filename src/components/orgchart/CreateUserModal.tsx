// components/orgchart/CreateUserModal.tsx
import React, { useState } from 'react';
import { User } from '@/app/types/orgChart.types';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

interface CreateUserModalProps {
  managers: User[];
  onCreateUser: (userData: Partial<User>) => Promise<User | null>;
  onClose: () => void;
  isForManager?: boolean;
  assignToManager?: User | null;
}

const CreateUserModal: React.FC<CreateUserModalProps> = ({
  managers,
  onCreateUser,
  onClose,
  isForManager = false,
  assignToManager = null,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [managerId, setManagerId] = useState<string | null>(assignToManager?.id || null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Define a constant for "no manager" value
  const NO_MANAGER_VALUE = "none";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const userData: Partial<User> = {
      name,
      email,
      role,
      managerId,
      isInvited: true,
    };
    
    setIsSubmitting(true);
    const newUser = await onCreateUser(userData);
    setIsSubmitting(false);
    
    if (newUser) {
      onClose();
    }
  };

  // Handle Select value changes
  const handleManagerChange = (value: string) => {
    setManagerId(value === NO_MANAGER_VALUE ? null : value);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isForManager ? 'Create New Manager' : 'Create New Team Member'}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-4">
            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            
            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            
            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="role">Role</Label>
              <Input
                id="role"
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              />
            </div>
            
            {!assignToManager && (
              <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="manager">
                  {isForManager ? 'Manager' : 'Assign to Manager'}
                </Label>
                <Select
                  value={managerId || NO_MANAGER_VALUE}
                  onValueChange={handleManagerChange}
                >
                  <SelectTrigger id="manager">
                    <SelectValue placeholder="Select a manager" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_MANAGER_VALUE}>No Manager</SelectItem>
                    {managers.map((manager) => (
                      <SelectItem key={manager.id} value={manager.id}>
                        {manager.name} {manager.isInvited ? '(Invited)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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
              disabled={isSubmitting || !name || !email}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create & Invite'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateUserModal;