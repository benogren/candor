// components/orgchart/UserAssignmentModal.tsx
import React, { useState } from 'react';
import { User } from '@/app/types/orgChart.types';

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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-medium">Assign Manager</h3>
        </div>
        {user.isPending && (
          <div className="px-6 py-4">
            <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-800">
                This user has registered but has not verified their email yet.
              </p>
            </div>
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4">
            <div className="mb-4">
              <p>
                Assign a manager for{' '}
                <span className="font-medium">{user.name}</span>
                {user.isInvited && ' (Invited)'}
              </p>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">
                Select Manager
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                value={selectedManagerId || ''}
                onChange={(e) => setSelectedManagerId(e.target.value || null)}
              >
                <option value="">No Manager</option>
                {managers
                  .filter((manager) => manager.id !== user.id) // Can't be own manager
                  .map((manager) => (
                    <option key={manager.id} value={manager.id}>
                      {manager.name} {manager.isInvited ? '(Invited)' : ''}
                    </option>
                  ))}
              </select>
            </div>
            
            <div className="flex items-center">
              <button
                type="button"
                className="text-blue-600 hover:text-blue-800 flex items-center"
                onClick={onCreateManager}
              >
                <svg
                  className="w-4 h-4 mr-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
                Create and invite new manager
              </button>
            </div>
          </div>
          
          <div className="px-6 py-3 bg-gray-50 flex justify-end space-x-3 rounded-b-lg">
            <button
              type="button"
              className="px-4 py-2 text-gray-700 hover:text-gray-900 bg-white border border-gray-300 rounded-md"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserAssignmentModal;