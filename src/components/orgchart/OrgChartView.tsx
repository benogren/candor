// components/orgchart/OrgChartView.tsx
import React from 'react';
import { OrgChartNode, User } from '@/app/types/orgChart.types';
import ManagerCard from './ManagerCard';

interface OrgChartViewProps {
  data: OrgChartNode[];
  onSelectUser: (user: User) => void;
  onSelectManager: (manager: User) => void;
}

const OrgChartView: React.FC<OrgChartViewProps> = ({ 
  data, 
  onSelectUser, 
  onSelectManager 
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-gray-500">No organization structure defined yet.</p>
      </div>
    );
  }

  return (
    <div className="overflow-auto">
      <div className="flex flex-col items-center min-w-max">
        {data.map((node) => (
          <ManagerCard 
            key={node.user.id} 
            node={node} 
            onSelectUser={onSelectUser} 
            onSelectManager={onSelectManager} 
          />
        ))}
      </div>
    </div>
  );
};

export default OrgChartView;