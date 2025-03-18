// app/components/UserRelationship.tsx
'use client';

import { useEffect, useState } from 'react';
import supabase from '@/lib/supabase/client';

interface RelationshipResponse {
  relationship: {
    type: string;
    description: string;
    distance: number;
  };
  users: {
    user1: {
      id: string;
      name: string;
      email: string;
      role: string;
    };
    user2: {
      id: string;
      name: string;
      email: string;
      role: string;
    };
  };
}

interface UserRelationshipProps {
  user1Id: string;
  user2Id: string;
}

export default function UserRelationship({ user1Id, user2Id }: UserRelationshipProps) {
  const [relationship, setRelationship] = useState<RelationshipResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRelationship = async () => {
        const { data: { session } } = await supabase.auth.getSession();
      if (!user1Id || !user2Id || !session?.access_token) {
        setError('Missing required data');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `/api/user-relationship?user1=${user1Id}&user2=${user2Id}`,
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`
            }
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch relationship');
        }

        const data = await response.json();
        setRelationship(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchRelationship();
  }, [user1Id, user2Id]);

  if (loading) {
    return <div className="p-4">Loading relationship data...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">Error: {error}</div>;
  }

  if (!relationship) {
    return <div className="p-4">No relationship data available</div>;
  }

// Helper function to get a friendly relationship type label
const getRelationshipLabel = (type: string): string => {
    switch (type) {
      case 'manager-report':
        return 'Direct Manager';
      case 'report-manager':
        return 'Direct Report';
      case 'skip-level-manager':
        return 'Higher-level Manager';
      case 'skip-level-report':
        return 'Higher-level Report';
      case 'peer':
        return 'Peer';
      case 'peer-with-boss':
        return 'Peer with Manager';
      case 'unrelated':
        return 'Unrelated';
      default:
        return type.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    }
  };

  // Helper function to get appropriate icon or style based on relationship type
  const getRelationshipIcon = (type: string): string => {
    switch (type) {
      case 'manager-report':
        return '↑';
      case 'report-manager':
        return '↓';
      case 'skip-level-manager':
        return '↑↑';
      case 'skip-level-report':
        return '↓↓';
      case 'peer':
        return '↔';
      case 'peer-with-boss':
        return '↗↔';
      case 'unrelated':
        return '⊘';
      default:
        return '•';
    }
  };

  const prettyRelationship = JSON.stringify(relationship, null, 2);
  
  // Render relationship details
  return (
    <div className="p-4 border rounded-lg bg-white shadow-sm">
      <h3 className="font-medium text-lg mb-2">User Relationship</h3>
      <pre className="text-xs text-gray-500 whitespace-pre-wrap">{prettyRelationship}</pre>
      <div className="flex items-center mb-3">
        <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-sm font-medium flex items-center">
          <span className="mr-1">{getRelationshipIcon(relationship.relationship.type)}</span>
          {getRelationshipLabel(relationship.relationship.type)}
        </span>
      </div>
      
      <p className="text-gray-800">{relationship.relationship.description}</p>
      
      <div className="mt-4 space-y-2">
        {relationship.relationship.distance > 0 && (
          <div className="flex text-sm text-gray-600">
            <div className="font-medium w-24">Distance:</div>
            <div>{relationship.relationship.distance} {relationship.relationship.distance === 1 ? 'level' : 'levels'}</div>
          </div>
        )}
        
        <div className="flex mt-3 pt-3 border-t text-sm">
          <div className="w-1/2">
            <div className="font-medium">{relationship.users.user1.name}</div>
            <div className="text-gray-500">{relationship.users.user1.role}</div>
          </div>
          <div className="w-1/2">
            <div className="font-medium">{relationship.users.user2.name}</div>
            <div className="text-gray-500">{relationship.users.user2.role}</div>
          </div>
        </div>
      </div>
    </div>
  );
}