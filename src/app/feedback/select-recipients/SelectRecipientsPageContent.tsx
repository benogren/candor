'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { Loader2, X, Search, User } from 'lucide-react';
import supabase from '@/lib/supabase/client';

type Colleague = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  companyid: string;
};

export default function SelectRecipientsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session');
  const searchRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Colleague[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [sessionInProgress, setSessionInProgress] = useState(false);
  const [selectedColleagues, setSelectedColleagues] = useState<Colleague[]>([]);

  useEffect(() => {
    const checkSession = async () => {
      if (!sessionId) {
        console.error('No session ID provided');
        setLoading(false);
        return;
      }
  
      try {
        console.log('Checking session:', sessionId);
        const { data: session, error } = await supabase
          .from('feedback_sessions')
          .select('*')
          .eq('id', sessionId)
          .single();
  
        if (error || !session) {
          toast({
            title: 'Error loading session',
            description: 'Could not find your feedback session',
            variant: 'destructive',
          });
          router.push('/dashboard');
          return;
        }

        if (session.status === 'in_progress') {
          setSessionInProgress(true);
          console.log('Session in progress:', session);
        }
  
        // Fetch previously selected recipients
        const { data: recipients, error: recipientsError } = await supabase
          .from('feedback_recipients')
          .select('recipient_id')
          .eq('session_id', sessionId);
  
        if (!recipientsError && recipients && recipients.length > 0) {
          // Get the recipient IDs
          const recipientIds = recipients.map(r => r.recipient_id);
          
          console.log('Found previous recipients:', recipientIds.length);
          
          // Fetch the identity information for these recipients
          const { data: identities, error: identitiesError } = await supabase
            .from('feedback_user_identities')
            .select('*')
            .in('id', recipientIds);
          
          if (!identitiesError && identities && identities.length > 0) {
            // Transform the data to match the Colleague type
            const previouslySelectedColleagues = identities.map(identity => ({
              id: identity.id,
              name: identity.name || 'Unknown',
              email: identity.email,
              role: '', // No role in feedback_user_identities
              status: identity.identity_type,
              companyid: identity.company_id
            }));
            
            // Update the selectedColleagues state
            setSelectedColleagues(previouslySelectedColleagues);
            console.log('Loaded previously selected colleagues:', previouslySelectedColleagues);
          }
        }
  
        setLoading(false);
      } catch (error) {
        console.error('Error checking session:', error);
        setLoading(false);
      }
    };
  
    checkSession();
  
    // Add click outside listener to close search results
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };
  
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [sessionId, router]);

  // Function to search for colleagues
  const searchColleagues = useCallback(async (term: string) => {
    if (!term || term.length < 1) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('** Not authenticated');

      const response = await fetch(`/api/colleagues/search?q=${encodeURIComponent(term)}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Search failed');
      }

      const { results } = await response.json();
      console.log('Search results:', results);

      // Filter out already selected colleagues
      const filteredResults = results.filter(
        (colleague: Colleague) => !selectedColleagues.some(selected => selected.id === colleague.id)
      );

      setSearchResults(filteredResults);
    } catch (error) {
      console.error('Error searching colleagues:', error);
      toast({
        title: 'Search failed',
        description: 'Could not search for colleagues',
        variant: 'destructive',
      });
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [selectedColleagues]); // Include `selectedColleagues` as it's used in the function

  useEffect(() => {
    const timer = setTimeout(() => {
      searchColleagues(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, searchColleagues]); // ✅ Include `searchColleagues` in dependencies

  const handleSelectColleague = (colleague: Colleague) => {
    setSelectedColleagues([...selectedColleagues, colleague]);
    setSearchTerm('');
    setSearchResults([]);
  };

  const handleRemoveColleague = (id: string) => {
    setSelectedColleagues(selectedColleagues.filter(c => c.id !== id));
  };

  const handleSubmit = async () => {
    if (selectedColleagues.length < 2) {
      toast({
        title: 'Selection required',
        description: 'Please select at least 2 colleagues',
        variant: 'destructive',
      });
      return;
    }
  
    setSubmitting(true);
    try {
      // Get currently selected colleague IDs
      const selectedIds = new Set(selectedColleagues.map(c => c.id));
      
      // Fetch existing recipients for this session
      const { data: existingRecipients, error: fetchError } = await supabase
        .from('feedback_recipients')
        .select('id, recipient_id')
        .eq('session_id', sessionId);
        
      if (fetchError) throw fetchError;
      
      const existingIds = new Set((existingRecipients || []).map(r => r.recipient_id));
      
      // Find recipients to remove (existing but not selected anymore)
      const recipientsToRemove = (existingRecipients || [])
        .filter(r => !selectedIds.has(r.recipient_id))
        .map(r => r.id);
      
      // Check if any of these recipients have responses that would block deletion
      if (recipientsToRemove.length > 0) {
        const { data: checkResponses, error: checkError } = await supabase
          .from('feedback_responses')
          .select('recipient_id')
          .in('recipient_id', recipientsToRemove);

          if (checkError) throw checkError;
          
        if (checkResponses && checkResponses.length > 0) {
          // We have responses for recipients we're trying to remove
          // Instead of deleting, we'll keep everyone and just add new ones
          console.log('Found existing responses, still deleting...');
          if (recipientsToRemove.length > 0) {
            const { error: deleteResponsesError } = await supabase
              .from('feedback_responses')
              .delete()
              .in('recipient_id', recipientsToRemove)
              .eq('session_id', sessionId);
              
            if (deleteResponsesError) throw deleteResponsesError;

            const { error: deleteRecipientsError } = await supabase
              .from('feedback_recipients')
              .delete()
              .in('id', recipientsToRemove)
              .eq('session_id', sessionId);
              
            if (deleteRecipientsError) throw deleteRecipientsError;
          }
        } else {
          // Safe to delete these recipients
          if (recipientsToRemove.length > 0) {
            const { error: deleteError } = await supabase
              .from('feedback_recipients')
              .delete()
              .in('id', recipientsToRemove)
              .eq('session_id', sessionId);
              
            if (deleteError) throw deleteError;
          }
        }
      }
      
      // Find colleagues to add (selected but not existing)
      const newColleagues = selectedColleagues.filter(c => !existingIds.has(c.id));
      const feedbackEmails = newColleagues.map(colleague => colleague.email);
      
      // Only proceed with insertion if we have new colleagues
      if (newColleagues.length > 0) {
        // Step 2: Check which new users exist in `feedback_user_identities`
        const { data: existingIdentities, error: fetchIdError } = await supabase
          .from('feedback_user_identities')
          .select('id, email, company_id')
          .in('email', feedbackEmails);
  
        if (fetchIdError) throw fetchIdError;
  
        const existingCombos = new Set((existingIdentities || []).map(identity => 
          `${identity.email}|${identity.company_id}`
        ));
        const missingColleagues = newColleagues.filter(colleague => 
          !existingCombos.has(`${colleague.email}|${colleague.companyid}`)
        );
  
        let newIdentities: { id: string; email: string }[] = [];
  
        // Step 3: Insert missing users
        if (missingColleagues.length > 0) {
          const { data: insertedIdentities, error: insertError } = await supabase
            .from('feedback_user_identities')
            .insert(
              missingColleagues.map(colleague => ({
                id: colleague.id,
                email: colleague.email,
                name: colleague.name,
                identity_type: colleague.status,
                company_id: colleague.companyid,
              }))
            )
            .select('id, email');
  
          if (insertError) throw insertError;
          newIdentities = insertedIdentities || [];
        }
  
        // Step 4: Collect IDs of new users to add
        const newIdentityIds = [
          ...existingIdentities?.map(identity => identity.id) || [],
          ...newIdentities.map(identity => identity.id),
        ];
        
        // Step 5: Create records only for new recipients
        if (newIdentityIds.length > 0) {
          const recipientRecords = newIdentityIds.map(identityId => ({
            session_id: sessionId,
            recipient_id: identityId,
            status: 'pending',
          }));
  
          const { error: recipientError } = await supabase
            .from('feedback_recipients')
            .insert(recipientRecords);
  
          if (recipientError) throw recipientError;
        }
      }

      if (!sessionInProgress) {
        //update session to in progress
        const now = new Date().toISOString();
        const { error: sessionError } = await supabase
          .from('feedback_sessions')
          .update({ status: 'in_progress', started_at: now })
          .eq('id', sessionId);

          if (sessionError) {
            console.log('Error updating session:', sessionError);
          }
      }
  
      // Navigate to the next step
      router.push(`/feedback/questions?session=${sessionId}`);
    } catch (error) {
      console.error('Error saving recipients:', error);
      toast({
        title: 'Error',
        description: 'Failed to save your selections',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-cerulean" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-xl">
      <h1 className='text-4xl font-light text-berkeleyblue pb-2'>Give Feedback</h1>
      <p className='text-slate-500 text-base font-light pb-4'>
        {/* Here are a few colleagues who you have been in contact with a lot lately.  */}
        Select colleagues you&#39;ve worked with this week and can provide meaningful insights about. Consider people you&#39;ve collaborated with on projects, attended meetings with, or interacted with regularly.
      </p>
      
      <p className='text-slate-500 text-sm font-light'>
        Select at least two colleagues ({selectedColleagues.length}/2 selected):
      </p>
      
      {/* Selected colleagues tags */}
      <div className="flex flex-wrap gap-2 my-3">
        {selectedColleagues.map(colleague => (
          <div 
            key={colleague.id} 
            className="flex items-center gap-1 bg-cerulean-100 text-cerulean-800 px-3 py-1 rounded-full"
          >
            <span className="text-sm">{colleague.name}</span>
            <button
              onClick={() => handleRemoveColleague(colleague.id)} 
              className="text-cerulean-500 hover:text-cerulean-700 rounded-full"
              aria-label={`Remove ${colleague.name}`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      
      <p className='text-slate-500 text-sm font-light pt-4'>
        {/* Missing anyone? Search and add them: */}
        Search and add your colleagues:
      </p>
      
      {/* Search input with dropdown */}
      <div className="relative mb-4" ref={searchRef}>
        <div className="relative">
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => setShowResults(true)}
            placeholder="Search for a colleague..."
            className='pr-10'
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            {searching ? (
              <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
            ) : (
              <Search className="h-4 w-4 text-slate-400" />
            )}
          </div>
        </div>
        
        {/* Search results dropdown */}
        {showResults && (searchResults.length > 0 || searching) && (
          <div className="absolute z-10 w-full mt-1 bg-white rounded-md shadow-lg border border-slate-200 max-h-60 overflow-auto">
            {searching && searchResults.length === 0 && (
              <div className="p-2 text-center text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                Searching...
              </div>
            )}
            
            {!searching && searchResults.length === 0 && searchTerm.length >= 2 && (
              <div className="p-2 text-center text-slate-500">
                No results found
              </div>
            )}
            
            {searchResults.map(colleague => (
              <div 
                key={colleague.id}
                className="p-2 hover:bg-slate-100 cursor-pointer flex items-center gap-2"
                onClick={() => handleSelectColleague(colleague)}
              >
                <div className="bg-slate-200 rounded-full p-1 flex items-center justify-center">
                  <User className="h-4 w-4 text-slate-600" />
                </div>
                <div className="flex-1">
                  <div className="font-medium">{colleague.name}</div>
                  <div className="text-sm text-slate-500">{colleague.email}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <Button 
        onClick={handleSubmit}
        disabled={submitting || selectedColleagues.length < 2}
      >
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving...
          </>
        ) : (
          'Next'
        )}
      </Button>
    </div>
  );
}