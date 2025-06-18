import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { Loader2, X, Search, User, Calendar, Users, MessageSquare } from 'lucide-react';
import supabase from '@/lib/supabase/client';

// Types
interface FeedbackCycleOccurrence {
  id: string;
  occurrence_number: number;
  start_date: string;
  end_date: string;
  status: string;
  emails_sent_count: number;
  responses_count: number;
  cycle_id: string;
}

interface CompanyMember {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
}

interface ProviderWithResponses {
  id: string;
  name: string;
  email: string;
  response_count: number;
}

// interface SeedRequest {
//   occurrenceId: string;
//   providerId: string;
//   recipientIds: string[];
// }

interface SeedProgress {
  total: number;
  completed: number;
  current: string;
  status: 'idle' | 'seeding' | 'completed' | 'error';
}

export default function FeedbackSeederPage() {
  // State management
  const [loading, setLoading] = useState(false);
  const [occurrences, setOccurrences] = useState<FeedbackCycleOccurrence[]>([]);
  const [selectedOccurrence, setSelectedOccurrence] = useState<FeedbackCycleOccurrence | null>(null);
  const [providersWithResponses, setProvidersWithResponses] = useState<ProviderWithResponses[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<CompanyMember | null>(null);
  const [companyMembers, setCompanyMembers] = useState<CompanyMember[]>([]);
  const [selectedRecipients, setSelectedRecipients] = useState<CompanyMember[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredMembers, setFilteredMembers] = useState<CompanyMember[]>([]);
  const [seedProgress, setSeedProgress] = useState<SeedProgress>({ 
    total: 0, 
    completed: 0, 
    current: '', 
    status: 'idle' 
  });

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        if (!token) {
        throw new Error('Authentication required');
        }

        // Load feedback cycle occurrences
        const occurrencesResponse = await fetch('/api/seed/feedback-occurrences', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
        });

        if (occurrencesResponse.ok) {
          const { occurrences } = await occurrencesResponse.json();
          setOccurrences(occurrences || []);
        } else {
          throw new Error('Failed to load occurrences');
        }

        // Load company members
        const membersResponse = await fetch('/api/seed/company-members', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
        });

        if (membersResponse.ok) {
          const { members } = await membersResponse.json();
          setCompanyMembers(members || []);
          setFilteredMembers(members || []);
        } else {
          throw new Error('Failed to load company members');
        }
      } catch (error) {
        console.error('Error loading initial data:', error);
        toast({
          title: 'Error',
          description: 'Failed to load initial data. Please refresh the page.',
          variant: 'destructive'
        });
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, []);

  // Handle occurrence selection
  const handleOccurrenceSelect = async (occurrenceId: string) => {
    const occurrence = occurrences.find(o => o.id === occurrenceId);
    if (!occurrence) return;

    setSelectedOccurrence(occurrence);
    setSelectedProvider(null);
    setSelectedRecipients([]);

    try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        if (!token) {
        throw new Error('Authentication required');
        }

      // Load providers with responses for this occurrence
      const providersResponse = await fetch(`/api/seed/providers-with-responses?occurrenceId=${occurrenceId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
        });

      if (providersResponse.ok) {
        const { providers } = await providersResponse.json();
        setProvidersWithResponses(providers || []);
      } else {
        console.error('Failed to load providers with responses');
        setProvidersWithResponses([]);
      }
    } catch (error) {
      console.error('Error loading providers:', error);
      setProvidersWithResponses([]);
    }
  };

  // Handle provider selection
  const handleProviderSelect = (providerId: string) => {
    const provider = companyMembers.find(m => m.id === providerId);
    if (provider) {
      setSelectedProvider(provider);
      setSelectedRecipients([]);
    }
  };

  // Filter members based on search
  useEffect(() => {
    if (!searchTerm) {
      setFilteredMembers(companyMembers);
    } else {
      const filtered = companyMembers.filter(member =>
        member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredMembers(filtered);
    }
  }, [searchTerm, companyMembers]);

  // Handle recipient selection
  const handleRecipientSelect = (member: CompanyMember) => {
    if (selectedRecipients.find(r => r.id === member.id)) return;
    if (selectedProvider && member.id === selectedProvider.id) return; // Can't select self
    
    setSelectedRecipients([...selectedRecipients, member]);
    setSearchTerm('');
  };

  // Remove recipient
  const handleRecipientRemove = (memberId: string) => {
    setSelectedRecipients(selectedRecipients.filter(r => r.id !== memberId));
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!selectedOccurrence || !selectedProvider || selectedRecipients.length === 0) {
      toast({
        title: 'Incomplete Selection',
        description: 'Please select an occurrence, provider, and at least one recipient.',
        variant: 'destructive'
      });
      return;
    }

    try {
      setSeedProgress({
        total: selectedRecipients.length,
        completed: 0,
        current: 'Starting...',
        status: 'seeding'
      });

      const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        if (!token) {
        throw new Error('Authentication required');
        }

      // Call the seeding API
      const response = await fetch('/api/seed/seed-feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          occurrenceId: selectedOccurrence.id,
          providerId: selectedProvider.id,
          recipientIds: selectedRecipients.map(r => r.id)
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to seed feedback');
      }

      const { results, sessionId } = await response.json();

      // Update progress as results come in
      let completed = 0;
      for (const result of results) {
        completed++;
        setSeedProgress(prev => ({
          ...prev,
          completed,
          current: result.error ? `Error processing ${result.recipientId}` : `Completed ${result.recipientName || result.recipientId}`
        }));
        
        // Small delay to show progress
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      setSeedProgress(prev => ({
        ...prev,
        completed: selectedRecipients.length,
        current: 'All responses generated successfully!',
        status: 'completed'
      }));

      toast({
        title: 'Seeding Completed',
        description: `Successfully generated feedback responses for ${results.filter((r: any) => !r.error).length} recipients. Session ID: ${sessionId}`,
      });

      // Reset form after a delay
      setTimeout(() => {
        setSelectedOccurrence(null);
        setSelectedProvider(null);
        setSelectedRecipients([]);
        setSeedProgress({ total: 0, completed: 0, current: '', status: 'idle' });
      }, 3000);

    } catch (error) {
      console.error('Error seeding feedback:', error);
      const errorMessage = (error instanceof Error && error.message) ? error.message : String(error);
      setSeedProgress(prev => ({ 
        ...prev, 
        status: 'error',
        current: `Error: ${errorMessage}`
      }));
      toast({
        title: 'Seeding Failed',
        description: errorMessage || 'An error occurred while generating feedback responses.',
        variant: 'destructive'
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Show loading state while initial data is loading
  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading feedback data seeder...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Feedback Data Seeder</h1>
        <p className="text-gray-600">Generate AI-powered feedback responses for testing and staging environments.</p>
      </div>

      {/* Step 1: Select Feedback Cycle Occurrence */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="h-5 w-5 mr-2" />
            Step 1: Select Feedback Cycle Occurrence
          </CardTitle>
          <CardDescription>
            Choose a feedback cycle occurrence to seed with responses.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Select onValueChange={handleOccurrenceSelect}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a feedback cycle occurrence..." />
            </SelectTrigger>
            <SelectContent>
              {occurrences.map((occurrence) => (
                <SelectItem key={occurrence.id} value={occurrence.id}>
                  <div className="flex items-center justify-between w-full">
                    <span>
                      Occurrence #{occurrence.occurrence_number} - {formatDate(occurrence.start_date)} to {formatDate(occurrence.end_date)}
                    </span>
                    <Badge variant={occurrence.status === 'active' ? 'default' : 'secondary'} className="ml-2">
                      {occurrence.status}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardFooter>
      </Card>

      {/* Step 2: Show existing providers and select one */}
      {selectedOccurrence && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="h-5 w-5 mr-2" />
              Step 2: Select Provider
            </CardTitle>
            <CardDescription>
              Current providers with responses in this occurrence, or select any company member.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex-col items-start">
            {providersWithResponses.length > 0 && (
              <div className="mb-4 w-full">
                <h4 className="text-sm font-medium mb-2">Existing Providers:</h4>
                <div className="flex flex-wrap gap-2">
                  {providersWithResponses.map((provider) => (
                    <Badge 
                      key={provider.id} 
                      variant="outline" 
                      className="cursor-pointer hover:bg-blue-50"
                      onClick={() => handleProviderSelect(provider.id)}
                    >
                      {provider.name} ({provider.response_count} responses)
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            <div className="w-full">
              <Select onValueChange={handleProviderSelect}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Or select any company member..." />
                </SelectTrigger>
                <SelectContent>
                  {companyMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      <div className="flex items-center">
                        <User className="h-4 w-4 mr-2" />
                        {member.name} ({member.email})
                        {member.status === 'active' ? (
                          <Badge variant="default" className="ml-2">
                            {member.role}
                            </Badge>
                        ) : (
                          <Badge variant="secondary" className="ml-2">
                            {member.role} (Invited)
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {selectedProvider && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg w-full">
                <p className="text-sm">
                  <strong>Selected Provider:</strong> {selectedProvider.name} ({selectedProvider.email})
                </p>
              </div>
            )}
          </CardFooter>
        </Card>
      )}

      {/* Step 3: Select Recipients */}
      {selectedProvider && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <MessageSquare className="h-5 w-5 mr-2" />
              Step 3: Select Recipients ({selectedRecipients.length} selected)
            </CardTitle>
            <CardDescription>
              Choose who the selected provider will give feedback about.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex-col items-start">
            {/* Selected recipients */}
            {selectedRecipients.length > 0 && (
              <div className="mb-4 w-full">
                <h4 className="text-sm font-medium mb-2">Selected Recipients:</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedRecipients.map((recipient) => (
                    <div 
                      key={recipient.id} 
                      className="flex items-center gap-1 bg-blue-100 text-blue-800 px-3 py-1 rounded-full"
                    >
                      <span className="text-sm">{recipient.name}</span>
                      <button
                        onClick={() => handleRecipientRemove(recipient.id)}
                        className="text-blue-500 hover:text-blue-700 rounded-full"
                        aria-label={`Remove ${recipient.name}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Search and add recipients */}
            <div className="w-full">
              <div className="relative">
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search for recipients to add..."
                  className="pr-10"
                />
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              </div>
              
              {searchTerm && (
                <div className="mt-2 max-h-60 overflow-auto border rounded-md bg-white">
                  {filteredMembers
                    .filter(member => 
                      !selectedRecipients.find(r => r.id === member.id) && 
                      member.id !== selectedProvider.id
                    )
                    .map((member) => (
                      <div
                        key={member.id}
                        onClick={() => handleRecipientSelect(member)}
                        className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{member.name}</p>
                            <p className="text-sm text-gray-500">{member.email}</p>
                          </div>
                          <div className="flex gap-2">
                            <Badge variant="secondary">{member.role}</Badge>
                            <Badge variant={member.status === 'active' ? 'default' : 'outline'}>
                              {member.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </CardFooter>
        </Card>
      )}

      {/* Progress indicator */}
      {seedProgress.status === 'seeding' && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Generating Responses...
            </CardTitle>
          </CardHeader>
          <CardFooter className="flex-col items-start">
            <div className="w-full mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span>Progress: {seedProgress.completed} of {seedProgress.total}</span>
                <span>{Math.round((seedProgress.completed / seedProgress.total) * 100)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(seedProgress.completed / seedProgress.total) * 100}%` }}
                />
              </div>
            </div>
            <p className="text-sm text-gray-600">
              Currently processing: <strong>{seedProgress.current}</strong>
            </p>
          </CardFooter>
        </Card>
      )}

      {/* Submit button */}
      <div className="flex justify-end">
        <Button 
          onClick={handleSubmit}
          disabled={
            !selectedOccurrence || 
            !selectedProvider || 
            selectedRecipients.length === 0 || 
            seedProgress.status === 'seeding'
          }
          size="lg"
        >
          {seedProgress.status === 'seeding' ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            `Generate Feedback Responses (${selectedRecipients.length} recipients)`
          )}
        </Button>
      </div>
    </div>
  );
}