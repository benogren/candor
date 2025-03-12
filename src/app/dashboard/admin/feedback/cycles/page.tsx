// src/app/dashboard/admin/feedback/cycles/page.tsx
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
import { Loader2, Plus, CalendarIcon, BarChart, RefreshCw } from 'lucide-react';
import supabase from '@/lib/supabase/client';
import { useAuth, useIsAdmin } from '@/lib/context/auth-context';
import CreateCycleModal from '@/components/admin/CreateCycleModal';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

export default function FeedbackCyclesPage() {
  interface FeedbackCycle {
    id: string;
    cycle_name: string;
    frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
    start_date: string;
    due_date: string;
    status: 'active' | 'completed' | 'draft';
    company_id: string;
    created_at: string; // Ensure this is present
    stats?: {
      total_sessions: number;
      completed_sessions: number;
      completion_rate: number;
    };
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
        
        // Fetch stats for each cycle
        const cyclesWithStats = await Promise.all((cyclesData || []).map(async (cycle) => {
          // Get session stats
          const { data: sessions, error: sessionsError } = await supabase
            .from('feedback_sessions')
            .select('id, status')
            .eq('cycle_id', cycle.id);
            
          if (sessionsError) {
            console.error(`Error fetching sessions for cycle ${cycle.id}:`, sessionsError);
            return cycle;
          }
          
          const totalSessions = sessions?.length || 0;
          const completedSessions = sessions?.filter(s => s.status === 'completed')?.length || 0;
          const completionRate = totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0;
          
          return {
            ...cycle,
            stats: {
              total_sessions: totalSessions,
              completed_sessions: completedSessions,
              completion_rate: completionRate
            }
          };
        }));

        setCycles(cyclesWithStats);
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
  
  const handleManualTrigger = async (cycleId: string) => {
    setProcessingCycle(cycleId);
    
    try {
      // First, get the cycle details to ensure it's active
      const { data: cycle, error: cycleError } = await supabase
        .from('feedback_cycles')
        .select('id, cycle_name, status')
        .eq('id', cycleId)
        .single();
        
      if (cycleError) throw cycleError;
      
      if (cycle.status !== 'active') {
        toast({
          title: 'Cycle not active',
          description: 'Only active feedback cycles can be triggered manually.',
          variant: 'destructive',
        });
        return;
      }
      
      // Instead of directly calling the edge function, call through a Next.js API route
      // Create this API route at /app/api/admin/trigger-feedback/route.ts

      const { data: { session } } = await supabase.auth.getSession();
      const bearerToken = session?.access_token;

      const response = await fetch('/api/trigger-feedback', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${bearerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cycleId: cycleId,
          forceFriday: true
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to trigger feedback emails');
      }
      
      const result = await response.json();
      
      toast({
        title: 'Feedback emails triggered',
        description: `Successfully sent ${result.emailsSent || 0} emails for this cycle.`,
      });
      
      // Refresh the cycles list
      router.refresh();
    } catch (error) {
      console.error('Error triggering feedback emails:', error);
      toast({
        title: 'Error triggering emails',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setProcessingCycle(null);
    }
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
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">Draft</Badge>;
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
        <h1 className="text-2xl font-bold">Feedback Cycles</h1>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create New Cycle
        </Button>
      </div>
      
      {cycles.some(c => c.status === 'active') && (
        <Alert className="mb-6 bg-blue-50 border-blue-200">
          {/* <AlertCircle className="h-4 w-4 text-blue-600" /> */}
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
                {cycles.map((cycle) => (
                  <TableRow key={cycle.id}>
                    <TableCell className="font-medium">{cycle.cycle_name || 'Unnamed Cycle'}</TableCell>
                    <TableCell>{getFrequencyDisplay(cycle.frequency)}</TableCell>
                    <TableCell>{formatDate(cycle.start_date)}</TableCell>
                    <TableCell>{formatDate(cycle.due_date)}</TableCell>
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
                        
                        {cycle.status === 'active' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleManualTrigger(cycle.id)}
                              disabled={processingCycle === cycle.id}
                              title="Manually trigger feedback emails for this cycle"
                            >
                              {processingCycle === cycle.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <RefreshCw className="h-4 w-4 mr-1" />
                                  Trigger
                                </>
                              )}
                            </Button>
                            
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStatusChange(cycle.id, 'completed')}
                              disabled={processingCycle === cycle.id}
                            >
                              Complete
                            </Button>
                          </>
                        )}
                        
                        {cycle.status === 'completed' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => router.push(`/dashboard/admin/feedback/results?cycle=${cycle.id}`)}
                          >
                            <BarChart className="h-4 w-4 mr-1" />
                            Results
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
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
                  created_at: newCycle.created_at || new Date().toISOString(),
                  stats: {
                    total_sessions: 0,
                    completed_sessions: 0, 
                    completion_rate: 0
                  }
                },
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