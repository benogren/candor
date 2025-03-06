// components/orgchart/ManagerCard.tsx
import React from 'react';
import { OrgChartNode, User } from '@/app/types/orgChart.types';
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

  const CARD_WIDTH = 180;

  return (
    <div className="flex flex-col items-center">
      {/* Manager node */}
      <div 
        className="bg-white border border-gray-300 rounded-md p-4 shadow-sm cursor-pointer hover:bg-gray-50 w-48"
        style={{ width: `${CARD_WIDTH}px` }}
        onClick={() => onSelectManager(user)}
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

      {/* Only render tree structure if there are direct reports */}
      {directReports.length > 0 && (
        <div className="flex flex-col items-center w-full">
          {/* Vertical line from manager to horizontal line */}
          <div className="w-px h-8 bg-gray-300 mt-1"></div>
          
          {/* Container for horizontal line and children */}
          <div className="relative">
            {/* Horizontal line that always spans the width of all direct reports */}
            {directReports.length > 1 && (
              <div className="absolute left-0 right-0 h-px bg-gray-300" style={{
                width: '100%',
                top: '0px'
              }}></div>
            )}
            
            {/* Children row */}
            <div className="flex justify-between pt-8" style={{ 
              minWidth: `${directReports.length * 240}px`
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
                      cardWidth={CARD_WIDTH} // or any appropriate value
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