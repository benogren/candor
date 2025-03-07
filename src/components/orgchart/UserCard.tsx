// components/orgchart/UserCard.tsx
import React from 'react';
import { User } from '@/app/types/orgChart.types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface UserCardProps {
  user: User;
  onSelect: (user: User) => void;
  cardWidth: number;
}

const UserCard: React.FC<UserCardProps> = ({ user, onSelect, cardWidth }) => {
  // Get the first initial for avatar fallback
  const getInitial = (name: string) => {
    return name && name.length > 0 ? name.charAt(0).toUpperCase() : '?';
  };

  return (
    <div 
      className="bg-white border border-gray-200 rounded-md shadow-sm cursor-pointer hover:bg-gray-50 text-left flex items-center p-4"
      style={{ width: `${cardWidth}px` }}
      onClick={() => onSelect(user)}
    >
      <Avatar className="h-12 w-12 mr-4 border border-gray-100">
        {user.avatarUrl ? (
          <AvatarImage src={user.avatarUrl} alt={user.name} />
        ) : null}
        <AvatarFallback className="bg-slate-200 text-cerulean font-medium">
          {getInitial(user.name)}
        </AvatarFallback>
      </Avatar>
      
      <div className="overflow-hidden">
        <h3 className="text-berkeleyblue font-light text-base truncate">{user.name}</h3>
        <p className="text-slate-500 text-sm truncate">{user.jobTitle || ' '}</p>
        
        <div className="flex flex-wrap mt-1 gap-1">
          {user.role === 'admin' && (
            <span className="inline-block bg-nonphotoblue/20 text-nonphotoblue-900 text-xs px-2 py-0.5 rounded">
              Admin
            </span>
          )}
          {user.isPending && (
            <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">
              Pending
            </span>
          )}
          {user.isInvited && (
            <span className="inline-block bg-honeydew text-honeydew-900 text-xs px-2 py-0.5 rounded">
              Invited
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserCard;