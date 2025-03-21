'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/components/ui/use-toast';
import { Loader2, Plus, CalendarIcon, ChevronDown, ChevronUp } from 'lucide-react';
import supabase from '@/lib/supabase/client';
import { useAuth, useIsAdmin } from '@/lib/context/auth-context';
import CreateCycleModal from '@/components/admin/CreateCycleModal';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

export default function FeedbackCyclesPage() {
  interface PastOccurrence {
    id: string;
    start_date: string;
    end_date: string;
    occurrence_number: number;
    emails_sent_count: number;
    responses_count: number;
    total_sessions: number;
    completed_sessions: number;
    unique_recipients: number;
    totalResponses: number;
    skippedResponses: number;
    skippedRate: number;
  }

  interface FeedbackCycle {
    id: string;
    cycle_name: string;
    frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
    start_date: string;
    due_date: string;
    status: 'active' | 'completed' | 'draft';
    company_id: string;
    created_at: string;
    stats?: {
      total_sessions: number;
      completed_sessions: number;
      completion_rate: number;
    };
    past_occurrences?: PastOccurrence[];
    current_occurrence?: {
      id: string;
      start_date: string;
      end_date: string;
      status: string;
      occurrence_number: number;
    } | null;
    expanded?: boolean;
  }
      
  const router = useRouter();
  const { user } = useAuth();
  const { isAdmin, loading: isAdminLoading } = useIsAdmin();
  
  const [loading, setLoading] = useState(true);
  const [cycles, setCycles] = useState<FeedbackCycle[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [processingCycle, setProcessingCycle] = useState<string | null>(null);
  
  useEffect(() => {
    async function loadCompanyAndCycles() {
      if (!user) return;
      
      try {
        // Get user's company
        const { data: userData, error: userError } = await supabase
          .from('company_members')
          .select('company_id')
          .eq('id', user.id)
          .single();
          
        if (userError) throw userError;
        
        setCompanyId(userData.company_id);
        
        // Get feedback cycles for the company
        const { data: cyclesData, error: cyclesError } = await supabase
          .from('feedback_cycles')
          .select('id, cycle_name, frequency, start_date, due_date, status, company_id, created_at')
          .eq('company_id', userData.company_id)
          .order('created_at', { ascending: false });

        if (cyclesError) throw cyclesError;

        // Fetch occurrences for each cycle
        const cyclesWithOccurrences = await Promise.all((cyclesData || []).map(async (cycle) => {
          // Get current active occurrence
          const { data: activeOccurrence, error: activeOccError } = await supabase
            .from('feedback_cycle_occurrences')
            .select('*')
            .eq('cycle_id', cycle.id)
            .eq('status', 'active')
            .order('occurrence_number', { ascending: false })
            .limit(1)
            .single();
            
          if (activeOccError) {
            console.log('Error fetching active occurrence:', activeOccError);
          }
          
          // Get latest completed occurrence
          const { data: completedOccurrences, error: compOccError } = await supabase
            .from('feedback_cycle_occurrences')
            .select('*')
            .eq('cycle_id', cycle.id)
            .eq('status', 'completed')
            .order('occurrence_number', { ascending: false })
            .limit(5); // Increased to get more history

          if (compOccError) {
            console.log('Error fetching completed occurrences:', compOccError);
          }
          
          // Get session stats for current occurrence
          let stats = { total_sessions: 0, completed_sessions: 0, completion_rate: 0 };
          
          if (activeOccurrence) {
            const { data: sessions, error: sessionsError } = await supabase
              .from('feedback_sessions')
              .select('id, status')
              .eq('occurrence_id', activeOccurrence.id);
              
            if (!sessionsError && sessions) {
              const totalSessions = sessions.length;
              const completedSessions = sessions.filter(s => s.status === 'completed').length;
              const completionRate = totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0;
              
              stats = {
                total_sessions: totalSessions,
                completed_sessions: completedSessions,
                completion_rate: completionRate
              };
            }
          }
          
          // Enhanced data for past occurrences
          const enhancedPastOccurrences = await Promise.all((completedOccurrences || []).map(async (occurrence) => {
            // Get detailed stats for this occurrence
            const { data: sessions, error: sessionsError } = await supabase
              .from('feedback_sessions')
              .select('id, status')
              .eq('occurrence_id', occurrence.id);
              
            if (sessionsError) {
              console.log('Error fetching sessions for occurrence:', sessionsError);
              return occurrence;
            }
              
            // Get unique recipients count - we need to fetch all recipients from all sessions for this occurrence
            const recipientIds = new Set();
            let totalResponses = 0;
            let skippedResponses = 0;
            
            if (sessions && sessions.length > 0) {
              // Get all session IDs for this occurrence
              const sessionIds = sessions.map(s => s.id);
              
              // Fetch all recipients across all sessions for this occurrence
              const { data: recipients, error: recipientsError } = await supabase
                .from('feedback_recipients')
                .select('recipient_id')
                .in('session_id', sessionIds);
                
              if (!recipientsError && recipients) {
                // Add all unique recipient IDs to our Set
                recipients.forEach(r => recipientIds.add(r.recipient_id));
              } else {
                console.log('Error fetching recipients:', recipientsError);
              }
              
              // Fetch response data to calculate skipped question rate
              const { data: responses, error: responsesError } = await supabase
                .from('feedback_responses')
                .select('id, skipped')
                .in('session_id', sessionIds);
                
              if (!responsesError && responses) {
                totalResponses = responses.length;
                skippedResponses = responses.filter(r => r.skipped).length;
              } else {
                console.log('Error fetching responses:', responsesError);
              }
            }
            
            return {
              ...occurrence,
              total_sessions: sessions?.length || 0,
              completed_sessions: sessions?.filter(s => s.status === 'completed').length || 0,
              unique_recipients: recipientIds.size,
              totalResponses,
              skippedResponses,
              skippedRate: totalResponses > 0 ? (skippedResponses / totalResponses) * 100 : 0
            };
          }));
          
          return {
            ...cycle,
            current_occurrence: activeOccurrence || null,
            past_occurrences: enhancedPastOccurrences || [],
            stats,
            expanded: false // Add expanded state for UI toggling
          };
        }));

        setCycles(cyclesWithOccurrences);

      } catch (error) {
        console.error('Error loading data:', error);
        toast({
          title: 'Error loading feedback cycles',
          description: 'Could not load feedback cycles. Please try again later.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    }
    
    loadCompanyAndCycles();
  }, [user]);
  
  const handleStatusChange = async (cycleId: string, newStatus: 'active' | 'completed' | 'draft') => {
    setProcessingCycle(cycleId);
    
    try {
      const { error } = await supabase
        .from('feedback_cycles')
        .update({ status: newStatus })
        .eq('id', cycleId);
        
      if (error) throw error;
      
      // Update the local state
      setCycles((prev) =>
        prev.map((cycle) =>
          cycle.id === cycleId ? { ...cycle, status: newStatus } : cycle
        )
      );
      
      toast({
        title: 'Status updated',
        description: `Cycle status changed to ${newStatus}.`,
      });
      
      // Refresh to update occurrences if needed
      router.refresh();
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: 'Error updating status',
        description: 'Failed to update cycle status. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setProcessingCycle(null);
    }
  };
  
  const toggleExpanded = (cycleId: string) => {
    setCycles(prev => 
      prev.map(cycle => 
        cycle.id === cycleId 
          ? { ...cycle, expanded: !cycle.expanded } 
          : cycle
      )
    );
  };
  
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-200">Active</Badge>;
      case 'completed':
        return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-200">Completed</Badge>;
      case 'draft':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">Paused</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };
  
  const getFrequencyDisplay = (frequency: string) => {
    switch (frequency?.toLowerCase()) {
      case 'weekly':
        return 'Weekly';
      case 'biweekly':
        return 'Every 2 Weeks';
      case 'monthly':
        return 'Monthly';
      case 'quarterly':
        return 'Quarterly';
      case 'yearly':
        return 'Yearly';
      default:
        return frequency || 'Custom';
    }
  };
  
  // Check if there are any active or draft cycles
  const hasActiveOrDraftCycle = cycles.some(cycle => 
    cycle.status === 'active' || cycle.status === 'draft'
  );
  
  // Calculate response rate percentage
  const calculateResponseRate = (completed: number, total: number) => {
    if (total === 0) return '0%';
    return `${Math.round((completed / total) * 100)}%`;
  };
  
  // Redirect if not admin
  if (!isAdminLoading && !isAdmin) {
    router.push('/dashboard');
    return null;
  }
  
  if (loading || isAdminLoading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-cerulean" />
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className='text-4xl font-light text-berkeleyblue'>Feedback Cycles</h2>
        {!hasActiveOrDraftCycle && (
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create New Cycle
          </Button>
        )}
      </div>
      
      {cycles.some(c => c.status === 'active') && (
        <Alert className="mb-6 bg-blue-50 border-blue-200">
          <AlertDescription className="text-blue-700">
            <strong>Active Cycles:</strong> Each active cycle will automatically send feedback requests according to its frequency. 
            The next emails will be sent on the upcoming Friday.
          </AlertDescription>
        </Alert>
      )}
      
      <Card>
        <CardHeader>
          <CardTitle>All Feedback Cycles</CardTitle>
          <CardDescription>
            Manage your company&apos;s feedback cycles and their status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {cycles.length === 0 ? (
            <div className="text-center py-8">
              <CalendarIcon className="h-10 w-10 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">No feedback cycles found</p>
              <p className="text-gray-400 text-sm mt-1">
                Create your first feedback cycle to start collecting feedback.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cycle Name</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>Next Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Completion</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cycles.flatMap((cycle) => {
                  // Create an array of rows for each cycle
                  const rows = [
                    // Main cycle row
                    <TableRow key={cycle.id} className="border-b">
                      <TableCell className="font-medium">
                        <div className="flex items-center">
                          {cycle.past_occurrences && cycle.past_occurrences.length > 0 && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => toggleExpanded(cycle.id)} 
                              className="p-0 mr-2">
                              {cycle.expanded ? 
                                <ChevronUp className="h-4 w-4" /> : 
                                <ChevronDown className="h-4 w-4" />
                              }
                            </Button>
                          )}
                          {cycle.cycle_name || 'Unnamed Cycle'}
                        </div>
                      </TableCell>
                      <TableCell>{getFrequencyDisplay(cycle.frequency)}</TableCell>
                      <TableCell>
                        {cycle.current_occurrence 
                          ? formatDate(cycle.current_occurrence.start_date) 
                          : 'Not started'}
                      </TableCell>
                      <TableCell>
                        {cycle.current_occurrence 
                          ? formatDate(cycle.current_occurrence.end_date) 
                          : 'N/A'}
                      </TableCell>
                      <TableCell>{getStatusBadge(cycle.status)}</TableCell>
                      <TableCell>
                        {cycle.stats ? (
                          <div className="flex items-center">
                            <span className="text-sm mr-2">
                              {Math.round(cycle.stats.completion_rate)}%
                            </span>
                            <span className="text-xs text-gray-500">
                              ({cycle.stats.completed_sessions}/{cycle.stats.total_sessions})
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-500">No data</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          {cycle.status === 'active' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleStatusChange(cycle.id, 'completed')}
                                disabled={processingCycle === cycle.id}
                              >
                                {processingCycle === cycle.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Complete'}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleStatusChange(cycle.id, 'draft')}
                                disabled={processingCycle === cycle.id}
                              >
                                {processingCycle === cycle.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Pause'}
                              </Button>
                            </>
                          )}
                          
                          {cycle.status === 'draft' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStatusChange(cycle.id, 'active')}
                              disabled={processingCycle === cycle.id}
                            >
                              {processingCycle === cycle.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Activate'}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ];
                  
                  // Add occurrences row if expanded
                  if (cycle.expanded && cycle.past_occurrences && cycle.past_occurrences.length > 0) {
                    rows.push(
                      <TableRow key={`${cycle.id}-occurrences`} className="bg-gray-50">
                        <TableCell colSpan={7} className="p-0">
                          <Card className="border-0 shadow-none bg-transparent">
                            <CardHeader className="py-3 px-6">
                              <CardTitle className="text-lg">Past Occurrences</CardTitle>
                              <CardDescription>
                                Historical feedback data for {cycle.cycle_name || 'this cycle'}
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="py-0 px-6 pb-4">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="w-16">Cycle #</TableHead>
                                    <TableHead>Date Range</TableHead>
                                    <TableHead>Response Rate</TableHead>
                                    {/* <TableHead>Total Feedback</TableHead> */}
                                    <TableHead>Skipped Rate</TableHead>
                                    <TableHead>Recipients</TableHead>
                                    <TableHead>Emails Sent</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {cycle.past_occurrences.map((occurrence) => (
                                    <TableRow key={occurrence.id}>
                                      <TableCell className="font-medium">#{occurrence.occurrence_number}</TableCell>
                                      <TableCell>
                                        <div className="flex flex-col">
                                          <span>{formatDate(occurrence.start_date)}</span>
                                          <span className="text-gray-500">to</span>
                                          <span>{formatDate(occurrence.end_date)}</span>
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <div className="flex flex-col">
                                          <span className="font-medium">
                                            {calculateResponseRate(occurrence.completed_sessions, occurrence.total_sessions)}
                                          </span>
                                          <span className="text-xs text-gray-500">
                                            ({occurrence.completed_sessions}/{occurrence.total_sessions} sessions)
                                          </span>
                                        </div>
                                      </TableCell>
                                      {/* <TableCell>
                                        <span className="font-medium">{occurrence.responses_count}</span>
                                        <span className="text-xs text-gray-500 block">responses</span>
                                      </TableCell> */}
                                      <TableCell>
                                        <div className="flex flex-col">
                                          <span className="font-medium">
                                            {Math.round(occurrence.skippedRate)}%
                                          </span>
                                          <span className="text-xs text-gray-500">
                                            ({occurrence.skippedResponses}/{occurrence.totalResponses} skipped)
                                          </span>
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <span className="font-medium">{occurrence.unique_recipients}</span>
                                        <span className="text-xs text-gray-500 block">unique recipients</span>
                                      </TableCell>
                                      <TableCell>
                                        <span className="font-medium">{occurrence.emails_sent_count}</span>
                                        <span className="text-xs text-gray-500 block">emails</span>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </CardContent>
                          </Card>
                        </TableCell>
                      </TableRow>
                    );
                  }
                  
                  return rows;
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      
      {showCreateModal && companyId && (
        <CreateCycleModal
          companyId={companyId}
          onClose={() => setShowCreateModal(false)}
          onSuccess={(newCycle) => {
            setShowCreateModal(false);
            
            // Add the new cycle to the list
            if (newCycle) {
              setCycles(prev => [
                {
                  ...newCycle,
                  created_at: new Date().toISOString(),
                  stats: {
                    total_sessions: 0,
                    completed_sessions: 0, 
                    completion_rate: 0
                  },
                  past_occurrences: [],
                  current_occurrence: null,
                  expanded: false
                } as FeedbackCycle,
                ...prev
              ]);
            } else {
              // If no new cycle data returned, just refresh
              router.refresh();
            }
          }}
        />
      )}
    </div>
  );
}