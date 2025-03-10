'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import supabase from '@/lib/supabase/client';

type Colleague = {
  id: string;
  name: string;
  email: string;
};

export default function SelectRecipientsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session');

  const [loading, setLoading] = useState(true);
  const [submitting] = useState(false);
//   const [submitting, setSubmitting] = useState(false);
//   const [searchTerm, setSearchTerm] = useState('');
//   const [searchResults, setSearchResults] = useState<Colleague[]>([]);
//   const [searching, setSearching] = useState(false);
// const [selectedColleagues, setSelectedColleagues] = useState<Colleague[]>([]);
const [selectedColleagues] = useState<Colleague[]>([]);

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
  }, [sessionId, router]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-cerulean" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Give Feedback</CardTitle>
          <CardDescription>
            Here are a few colleagues who you have been in contact with a lot lately. Select who you would like to provide feedback to.
          </CardDescription>
        </CardHeader>
        <CardContent>
        <Input
            // value={searchTerm}
            // onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search for a colleague..."
            />
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button disabled={submitting || selectedColleagues.length === 0}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Next'
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}