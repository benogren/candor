'use client';

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { Loader2, Search, User, X } from 'lucide-react';
import supabase from '@/lib/supabase/client';

type Colleague = {
  id: string;
  name: string;
  email: string;
  role?: string;
  status?: string;
  companyid?: string;
};

interface UserSearchProps {
  onSelect: (user: Colleague) => void;
  selectedUser: Colleague | null;
  placeholder?: string;
  excludeIds?: string[];
  autoFocus?: boolean;
}

export default function UserSearch({
  onSelect,
  selectedUser,
  placeholder = "Search for a colleague...",
  excludeIds = [],
  autoFocus = false
}: UserSearchProps) {
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Colleague[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [showInput, setShowInput] = useState(true);
  
  // Focus the input if autoFocus is true
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);
  
  // Add click outside listener to close search results
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Search for colleagues
  useEffect(() => {
    const searchColleagues = async () => {
      if (!searchTerm || searchTerm.length < 1) {
        setSearchResults([]);
        return;
      }
      
      setSearching(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Not authenticated');
        
        const response = await fetch(`/api/colleagues/search?q=${encodeURIComponent(searchTerm)}`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Search failed');
        }
        
        const { results } = await response.json();
        
        // Filter out excluded IDs and already selected user
        const filteredResults = results.filter(
          (colleague: Colleague) => 
            !excludeIds.includes(colleague.id) && 
            (!selectedUser || selectedUser.id !== colleague.id)
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
    };
    
    const timer = setTimeout(() => {
      searchColleagues();
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchTerm, excludeIds, selectedUser]);
  
  const handleSelectColleague = (colleague: Colleague) => {
    onSelect(colleague);
    setSearchTerm('');
    setSearchResults([]);
    setShowResults(false);
    setShowInput(false);
  };
  
  const handleRemoveSelection = () => {
    onSelect({
      id: '',
      name: '',
      email: ''
    });
    setShowInput(true);
  };
  
  return (
    <div className="space-y-3 relative" ref={searchRef}>
      {/* Selected user tag */}
      {selectedUser && selectedUser.id && (
        <div className="flex flex-wrap gap-2 my-3">
          <div className="flex items-center gap-1 bg-cerulean-100 text-cerulean-800 px-3 py-1 rounded-full">
            <span className="text-sm">{selectedUser.name}</span>
            <button
              onClick={handleRemoveSelection}
              className="text-cerulean-500 hover:text-cerulean-700 rounded-full"
              aria-label={`Remove ${selectedUser.name}`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      
      {showInput && (
      <>      
      {/* Search input */}
      <div className="relative">
        <Input
          ref={inputRef}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => setShowResults(true)}
          placeholder={placeholder}
          className="pr-10"
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
      </>
    )}
    </div>
  );
}