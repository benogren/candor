// components/orgchart/BulkAssignmentModal.tsx
import React, { useState } from 'react';
import { User, ManagerAssignment } from '@/app/types/orgChart.types';

interface BulkAssignmentModalProps {
  selectedUsers: User[];
  managers: User[];
  onBulkAssign: (assignments: ManagerAssignment[]) => Promise<boolean>;
  onClose: () => void;
}

const BulkAssignmentModal: React.FC<BulkAssignmentModalProps> = ({
  selectedUsers,
  managers,
  onBulkAssign,
  onClose,
}) => {
  const [selectedManagerId, setSelectedManagerId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (selectedUsers.length === 0) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const assignments: ManagerAssignment[] = selectedUsers.map((user) => ({
      userId: user.id,
      managerId: selectedManagerId,
    }));
    
    setIsSubmitting(true);
    const success = await onBulkAssign(assignments);
    setIsSubmitting(false);
    
    if (success) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-medium">Bulk Update Managers</h3>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4">
            <div className="mb-4">
              <p>
                Assign a manager for {selectedUsers.length} selected user{selectedUsers.length !== 1 ? 's' : ''}
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
                  .filter((manager) => !selectedUsers.some(u => u.id === manager.id)) // Filter out selected users
                  .map((manager) => (
                    <option key={manager.id} value={manager.id}>
                      {manager.name} {manager.isInvited ? '(Invited)' : ''}
                    </option>
                  ))}
              </select>
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
              disabled={isSubmitting || !selectedManagerId}
            >
              {isSubmitting ? 'Applying...' : 'Apply Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BulkAssignmentModal;