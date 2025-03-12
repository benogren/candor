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
  const [selectedColleagues, setSelectedColleagues] = useState<Colleague[]>([]);

  useEffect(() => {
    const checkSession = async () => {
      if (!sessionId) {
        setLoading(false);
        return;
      }

      try {
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
          router.push('/feedback');
          return;
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
      if (!session) throw new Error('Not authenticated');

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

        // const identities = selectedColleagues.map(colleague => ({
        //     recipient_id: colleague.id,
        //     identity_type: colleague.status,
        //     company_id: colleague.companyid,
        //     recipoent_email: colleague.email,
        //     recipoent_name: colleague.name
        // }));

        const feedbackEmails = selectedColleagues.map(colleague => colleague.email);

        // Step 1: Check if users exist in `feedback_user_identities`
        const { data: existingIdentities, error: fetchError } = await supabase
        .from('feedback_user_identities')
        .select('id, email')
        .in('email', feedbackEmails);

        if (fetchError) throw fetchError;

        const existingEmails = new Set(existingIdentities.map(identity => identity.email));
        const missingColleagues = selectedColleagues.filter(colleague => !existingEmails.has(colleague.email));

        let newIdentities: { id: string; email: string }[] = [];

        // Step 2: Insert missing users
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
            .select('id, email'); // Get IDs of inserted records

        if (insertError) throw insertError;
        newIdentities = insertedIdentities || [];
        }

        // Step 3: Collect all user IDs
        const allIdentityIds = [
        ...existingIdentities.map(identity => identity.id),
        ...newIdentities.map(identity => identity.id),
        ];

        // Step 4: Insert into `feedback_recipients`
        const recipientRecords = allIdentityIds.map(identityId => ({
        session_id: sessionId,
        recipient_id: identityId,
        status: 'pending',
        }));

        const { error: recipientError } = await supabase
        .from('feedback_recipients')
        .insert(recipientRecords);

        if (recipientError) throw recipientError;

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
        Here are a few colleagues who you have been in contact with a lot lately. Select who you would like to provide feedback to.
      </p>
      
      <p className='text-slate-500 text-sm font-light'>
        Select at least two colleagues ({selectedColleagues.length}/2 selected)
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
        Missing anyone? Search and add them:
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