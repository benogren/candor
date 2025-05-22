'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/context/auth-context';
import { LoadingSpinner } from '@/components/loading-spinner';
import FeedbackList from '@/components/FeedbackList';
import supabase from '@/lib/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { useRouter } from "next/navigation";
import { Button } from '@/components/ui/button';
import { ArrowLeft, UserCircle, Users } from 'lucide-react';
import { useParams } from 'next/navigation';
import { radley } from '../../../../fonts';

interface EmployeeProfile {
  id: string;
  name?: string;
  email: string;
  is_invited: boolean;
}

export default function EmployeeFeedbackPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const employeeId = params.employeeid as string;
  
  const [employeeProfile, setEmployeeProfile] = useState<EmployeeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  
  // Fetch employee profile and verify manager permissions
  useEffect(() => {
    const verifyAccess = async () => {
      if (!user || !employeeId) {
        return;
      }
      
      try {
        setLoading(true);
        
        // Check if this user is authorized to view this employee's feedback
        const { data: orgData, error: orgError } = await supabase
          .from('org_structure')
          .select('*')
          .eq('id', employeeId);
        
        if (orgError) {
          throw orgError;
        }
        
        // Check if the current user is the manager
        if (orgData && orgData.length > 0 && orgData[0].manager_id === user.id) {
          // User is authorized to view this employee's feedback
          setIsAuthorized(true);
          
          // Set employee profile
          const empData = orgData[0];
          const empProfile: EmployeeProfile = {
            id: empData.id,
            email: empData.email,
            is_invited: empData.is_invited,
            name: empData.is_invited ? empData.email.split('@')[0] : undefined
          };

          // console.log('Employee Profile:', empProfile);
          
          // If not invited, fetch profile data
          if (!empData.is_invited) {
            const { data: profileData, error: profileError } = await supabase
              .from('user_profiles')
              .select('name, email')
              .eq('id', employeeId);
            
            if (!profileError && profileData && profileData.length > 0) {
              empProfile.name = profileData[0].name || profileData[0].email.split('@')[0];
            }
          }
          
          setEmployeeProfile(empProfile);
        } else {
          setIsAuthorized(false);
        }
      } catch (error) {
        console.error('Error verifying access:', error);
        toast({
          title: 'Error',
          description: 'Failed to verify your access to this data',
          variant: 'destructive',
        });
        setIsAuthorized(false);
      } finally {
        setLoading(false);
      }
    };
    
    if (user) {
      verifyAccess();
    } else {
      setLoading(false);
    }
  }, [user, employeeId]);
  
  // Fetch summaries and preps when user is authorized
  useEffect(() => {
  }, [isAuthorized, user, employeeId]);

  
  // Redirect if not authorized
  useEffect(() => {
    if (!loading && !isAuthorized && user) {
      router.push('/dashboard/');
    }
  }, [loading, isAuthorized, user, router]);
  
  // Show loading state
  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner />
          <p className="ml-2">Loading employee data...</p>
        </div>
      </div>
    );
  }
  
  // If not authorized, show nothing (will be redirected)
  if (!isAuthorized) {
    return null;
  }
  
  return (
    <>
    <div className="container mx-auto px-4">
    <Button
        variant="ghost"
        className="flex items-center gap-2"
        onClick={() => router.push('/dashboard/manager/feedback/')}
    >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to All Team Feedback
    </Button>
    <div className='bg-white rounded-lg shadow-md p-6 mb-8 border border-gray-100'>
      <div className='flex items-center justify-between'>
          <div className='flex items-center'>
              <div className='bg-berkeleyblue rounded-md p-2 mr-4 items-center'>
                  <Users className="h-12 w-12 text-berkeleyblue-100" />
              </div>
              <div>
                  <h2 className={`text-4xl font-light text-berkeleyblue ${radley.className}`}>
                    {employeeProfile?.name || (employeeProfile?.email ? employeeProfile.email.split('@')[0] : 'Employee')}
                  </h2>
                  <p className='text-berkeleyblue-300'>
                    Feedback
                  </p>
              </div>
          </div>

          <div className="flex items-center gap-4">
              {/* <Button
                    variant="secondary"
                    className="flex items-center gap-2"
                    onClick={() => router.push('/dashboard/coach/manager/')}
                >
                    <BotMessageSquare className="h-5 w-5 text-cerulean-400" />
                    Feedback Coach
                </Button> */}

              <Button
                    variant="secondary"
                    className="flex items-center gap-2"
                    onClick={() => router.push('/dashboard/')}
                >
                    <UserCircle className="h-5 w-5 text-cerulean-400" />
                    Personal View
                </Button>
          </div>
      </div>
    </div>

    <div>
      <h2 className='text-2xl font-light text-berkeleyblue mb-4'>
        {employeeProfile?.name || (employeeProfile?.email ? employeeProfile.email.split('@')[0] : 'Employee')}&apos;s Feedback
      </h2>
      
      <FeedbackList 
        employeeId={employeeId}
        managerId={user?.id}
      />
    </div>
    </div>
    </>
  );
}