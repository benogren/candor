// src/app/settings/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/context/auth-context';
import { useIsAdmin } from '@/lib/context/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ProfileModal } from '@/components/ProfileModal';
import { CompanyModal } from '@/components/CompanyModal';
import { LoadingSpinner } from '@/components/loading-spinner';
import supabase from '@/lib/supabase/client';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEdit } from '@fortawesome/free-solid-svg-icons';

export default function SettingsPage() {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<{
    name: string;
    email: string;
    job_title?: string;
    avatar_url?: string;
  } | null>(null);

  const [companyData, setCompanyData] = useState<{
    id: string;
    name: string;
    industry?: string;
    domains?: string[];
  } | null>(null);
  
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;
      
      try {
        setLoading(true);
        
        // Get user profile data
        const { data: profileData, error: profileError } = await supabase
          .from('user_profiles')
          .select('name, email, job_title, avatar_url')
          .eq('id', user.id)
          .single();
          
        if (profileError) throw profileError;
        setProfileData(profileData);
        
        // If user is admin, get company data
        if (isAdmin) {
          // First get the company_id for the user
          const { data: companyMemberData, error: companyMemberError } = await supabase
            .from('company_members')
            .select('company_id')
            .eq('id', user.id)
            .single();
            
          if (companyMemberError) throw companyMemberError;
          
          // Then get the company details with the direct industry column
          const { data: companyDetails, error: companyError } = await supabase
            .from('companies')
            .select('id, name, industry, domains')
            .eq('id', companyMemberData.company_id)
            .single();
            
          if (companyError) throw companyError;
          
          setCompanyData({
            id: companyDetails.id,
            name: companyDetails.name,
            industry: companyDetails.industry || undefined,
            domains: companyDetails.domains
          });
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserData();
  }, [user, isAdmin]);

  const handleProfileUpdate = () => {
    // Refresh profile data after update
    if (user) {
      supabase
        .from('user_profiles')
        .select('name, email, job_title, avatar_url')
        .eq('id', user.id)
        .single()
        .then(({ data, error }) => {
          if (!error && data) {
            setProfileData(data);
          }
        });
    }
  };
  
  const handleCompanyUpdate = () => {
    // Refresh company data after update
    if (user && isAdmin && companyData) {
      // First get the company_id for the user
      supabase
        .from('company_members')
        .select('company_id')
        .eq('id', user.id)
        .single()
        .then(({ data: memberData, error: memberError }) => {
          if (!memberError && memberData) {
            // Then get the updated company details
            supabase
              .from('companies')
              .select('id, name, industry, domains')
              .eq('id', memberData.company_id)
              .single()
              .then(({ data: companyDetails, error: companyError }) => {
                if (!companyError && companyDetails) {
                  setCompanyData({
                    id: companyDetails.id,
                    name: companyDetails.name,
                    industry: companyDetails.industry || undefined,
                    domains: companyDetails.domains
                  });
                }
              });
          }
        });
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner />
          <p className="ml-2">Loading your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-4xl font-light text-berkeleyblue">Account Settings</h1>
      </div>
      
      {/* Profile Card */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Your personal details and job information</CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setIsProfileModalOpen(true)}
            >
              <FontAwesomeIcon icon={faEdit} className="mr-2" />
              Edit Profile
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {profileData ? (
            <div className="grid gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Name</h3>
                  <p className="mt-1">{profileData.name || 'Not provided'}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Email</h3>
                  <p className="mt-1">{profileData.email}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Job Title</h3>
                  <p className="mt-1">{profileData.job_title || 'Not provided'}</p>
                </div>
              </div>
            </div>
          ) : (
            <p>No profile information available.</p>
          )}
        </CardContent>
      </Card>
      
      {/* Company Card - Only for Admins */}
      {isAdmin && companyData && (
        <Card className="mb-8">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Company Information</CardTitle>
                <CardDescription>Organization details and settings</CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setIsCompanyModalOpen(true)}
              >
                <FontAwesomeIcon icon={faEdit} className="mr-2" />
                Edit Company
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Company Name</h3>
                  <p className="mt-1">{companyData.name}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Industry</h3>
                  <p className="mt-1">{companyData.industry || 'Not specified'}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Profile Modal */}
      {profileData && (
        <ProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => {
            setIsProfileModalOpen(false);
            handleProfileUpdate();
          }}
          defaultValues={profileData}
        />
      )}
      
      {/* Company Modal */}
      {companyData && (
        <CompanyModal
          isOpen={isCompanyModalOpen}
          onClose={() => {
            setIsCompanyModalOpen(false);
            handleCompanyUpdate();
          }}
          defaultValues={companyData}
        />
      )}
    </div>
  );
}