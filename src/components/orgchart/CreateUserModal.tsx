// components/orgchart/CreateUserModal.tsx
import React, { useState } from 'react';
import { User } from '@/app/types/orgChart.types';

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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-medium">
            {isForManager ? 'Create New Manager' : 'Create New Team Member'}
          </h3>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Role</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                />
              </div>
              
              {!assignToManager && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {isForManager ? 'Manager' : 'Assign to Manager'}
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    value={managerId || ''}
                    onChange={(e) => setManagerId(e.target.value || null)}
                  >
                    <option value="">No Manager</option>
                    {managers.map((manager) => (
                      <option key={manager.id} value={manager.id}>
                        {manager.name} {manager.isInvited ? '(Invited)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
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
              disabled={isSubmitting || !name || !email}
            >
              {isSubmitting ? 'Creating...' : 'Create & Invite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateUserModal;