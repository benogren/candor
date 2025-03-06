// components/orgchart/UserCard.tsx
import React from 'react';
import { User } from '@/app/types/orgChart.types';

interface UserCardProps {
  user: User;
  onSelect: (user: User) => void;
  cardWidth: number;
}

const UserCard: React.FC<UserCardProps> = ({ user, onSelect, cardWidth }) => {
  return (
    <div 
      className="bg-white border border-gray-300 rounded-md p-4 shadow-sm cursor-pointer hover:bg-gray-50"
      style={{ width: `${cardWidth}px` }}
      onClick={() => onSelect(user)}
    >
      <div className="font-medium">{user.name}</div>
      <div className="text-sm text-gray-500">{user.email}</div>
      <div className="text-xs text-gray-400">{user.jobTitle}</div>
      {user.role == 'admin' && (
        <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded mt-1 mr-2">
          Admin
        </span>
      )}
      {user.isPending && (
        <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded mt-1">
          Pending Verification
        </span>
      )}
      {user.isInvited && (
        <span className="inline-block bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded mt-1">
          Invited
        </span>
      )}
    </div>
  );
};

export default UserCard;