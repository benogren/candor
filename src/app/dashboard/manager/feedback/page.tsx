// src/app/dashboard/manager/feedback/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/context/auth-context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoadingSpinner } from '@/components/loading-spinner';
import FeedbackList from '@/components/FeedbackList';
import supabase from '@/lib/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { redirect } from "next/navigation";

interface DirectReport {
  id: string;
  name?: string;
  email: string;
  is_invited: boolean;
}

export default function ManagerFeedbackPage() {
  const { user } = useAuth();
  const [directReports, setDirectReports] = useState<DirectReport[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [isManager, setIsManager] = useState(false);
  
  // Fetch direct reports
  useEffect(() => {
    const fetchDirectReports = async () => {
      if (!user) return;
      
      setLoading(true);
      
      try {
        // First check if this user is a manager of anyone
        const { data: directReportsData, error: directReportsError } = await supabase
          .from('org_structure')
          .select(`
            id,
            email,
            is_invited
          `)
          .eq('manager_id', user.id);
        
        if (directReportsError) {
          throw directReportsError;
        }
        
        // If we have direct reports, fetch their profile info for those who aren't invited
        if (directReportsData && directReportsData.length > 0) {
          setIsManager(true);
          
          // Create a map to efficiently find and update the direct report info
          const reportsMap = new Map(
            directReportsData.map(report => [report.id, { 
              ...report,
              // For invited users, we'll display the email as name if needed
              name: report.is_invited ? report.email.split('@')[0] : undefined
            }])
          );
          
          // Get the IDs of non-invited users to fetch their profiles
          const nonInvitedUserIds = directReportsData
            .filter(report => !report.is_invited)
            .map(report => report.id);
          
          if (nonInvitedUserIds.length > 0) {
            // Fetch profile data for non-invited users
            const { data: profilesData, error: profilesError } = await supabase
              .from('user_profiles')
              .select('id, name, email')
              .in('id', nonInvitedUserIds);
            
            if (profilesError) {
              console.error('Error fetching profiles:', profilesError);
            } else if (profilesData) {
              // Update the map with profile data
              profilesData.forEach(profile => {
                const report = reportsMap.get(profile.id);
                if (report) {
                  report.name = profile.name || report.name || profile.email.split('@')[0];
                }
              });
            }
          }
          
          // Convert map back to array
          setDirectReports(Array.from(reportsMap.values()));
        } else {
          setIsManager(false);
          setDirectReports([]);
        }
      } catch (error) {
        console.error('Error fetching direct reports:', error);
        toast({
          title: 'Error',
          description: 'Failed to load your team members',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchDirectReports();
  }, [user]);
  
  // Show loading state
  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner />
          <p className="ml-2">Loading team data...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-8 px-4">
        {!isManager ? (
            redirect('/dashboard')
        ) : (
            <>
            <div className="flex justify-between items-center mb-6">
            <h2 className='text-4xl font-light text-berkeleyblue'>My Team&#39;s Feedback</h2>
            <Select
                value={selectedEmployee}
                onValueChange={value => setSelectedEmployee(value)}
            >
                <SelectTrigger className="w-full md:w-[300px]">
                    <SelectValue placeholder="View all team feedback" />
                </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Team Members</SelectItem>
                        {directReports.map(employee => (
                        <SelectItem key={employee.id} value={employee.id}>
                            {employee.name || employee.email.split('@')[0]}
                            {employee.is_invited && " (Invited)"}
                        </SelectItem>
                        ))}
                  </SelectContent>
                </Select>
            </div>
            <div>
                <h3 className='text-2xl font-light text-berkeleyblue mb-4'>
                    Feedback for: <strong className='font-medium'>
                    {selectedEmployee
                    ? `${directReports.find(e => e.id === selectedEmployee)?.name || 'All Team Members'}`
                    : 'All Team Feedback'}
                    </strong>
                </h3>
                <FeedbackList 
                  employeeId={selectedEmployee !== 'all' ? selectedEmployee : undefined} 
                  managerId={selectedEmployee === 'all' ? user?.id : undefined} 
                />
            </div>
            </>
        )}
      
    </div>
  );
}