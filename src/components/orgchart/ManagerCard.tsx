// components/orgchart/ManagerCard.tsx
import React from 'react';
import { OrgChartNode, User } from '@/app/types/orgChart.types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import UserCard from './UserCard';

interface ManagerCardProps {
  node: OrgChartNode;
  onSelectUser: (user: User) => void;
  onSelectManager: (manager: User) => void;
}

const ManagerCard: React.FC<ManagerCardProps> = ({
  node,
  onSelectUser,
  onSelectManager,
}) => {
  const { user, directReports } = node;
  const CARD_WIDTH = 240; // Wider to accommodate the new layout

  // Get the first initial for avatar fallback
  const getInitial = (name: string) => {
    return name && name.length > 0 ? name.charAt(0).toUpperCase() : '?';
  };

  return (
    <div className="flex flex-col items-center">
      {/* Manager node */}
      <div 
        className="bg-white border border-gray-200 rounded-md shadow-sm cursor-pointer hover:bg-gray-50 text-left flex items-center p-4"
        style={{ width: `${CARD_WIDTH}px` }}
        onClick={() => onSelectManager(user)}
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

      {/* Only render tree structure if there are direct reports */}
      {directReports.length > 0 && (
        <div className="flex flex-col items-center w-full">
          {/* Vertical line from manager to horizontal line */}
          <div className="w-px h-8 bg-gray-300 mt-1"></div>
          
          {/* Container for horizontal line and children */}
          <div className="relative">
            {/* Horizontal line that spans the width of all direct reports */}
            {directReports.length > 1 && (
              <div className="absolute left-0 right-0 h-px bg-gray-300" style={{
                width: '100%',
                top: '0px'
              }}></div>
            )}
            
            {/* Children row */}
            <div className="flex justify-between pt-8" style={{ 
              minWidth: `${directReports.length * (CARD_WIDTH + 20)}px`
            }}>
              {directReports.map((reportNode) => (
                <div key={reportNode.user.id} className="flex flex-col items-center px-2">
                  {/* Vertical line to each child */}
                  <div className="w-px h-8 bg-gray-300 -mt-8"></div>
                  
                  {reportNode.directReports.length > 0 ? (
                    <ManagerCard
                      node={reportNode}
                      onSelectUser={onSelectUser}
                      onSelectManager={onSelectManager}
                    />
                  ) : (
                    <UserCard
                      user={reportNode.user}
                      onSelect={onSelectUser}
                      cardWidth={CARD_WIDTH}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagerCard;