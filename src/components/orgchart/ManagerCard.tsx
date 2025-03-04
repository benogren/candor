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

  return (
    <div className="flex flex-col items-center mb-8">
      <div 
        className="bg-white border border-gray-300 rounded-md p-4 shadow-sm cursor-pointer hover:bg-gray-50"
        onClick={() => onSelectManager(user)}
      >
        <div className="font-medium">{user.name}</div>
        <div className="text-sm text-gray-500">{user.email}</div>
        <div className="text-xs text-gray-400">{user.role}</div>
        {user.isInvited && (
          <span className="inline-block bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded mt-1">
            Invited
          </span>
        )}
      </div>

      {directReports.length > 0 && (
        <div className="mt-4">
          <div className="w-0.5 h-4 bg-gray-300"></div>
          <div className="flex flex-row">
            {directReports.map((reportNode, index) => (
              <React.Fragment key={reportNode.user.id}>
                {index > 0 && <div className="w-4"></div>}
                <div className="flex flex-col items-center">
                  <div className="w-0.5 h-4 bg-gray-300"></div>
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
                    />
                  )}
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagerCard;