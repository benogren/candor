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
import { Loader2, Plus, CalendarIcon } from 'lucide-react';
import supabase from '@/lib/supabase/client';
import { useAuth, useIsAdmin } from '@/lib/context/auth-context';
import CreateCycleModal from '@/components/admin/CreateCycleModal';

export default function FeedbackCyclesPage() {
    interface FeedbackCycle {
        id: string;
        cycle_name: string;
        frequency: string;
        start_date: string;
        due_date: string;
        status: 'active' | 'completed' | 'draft';
        company_id: string;
      }
      
  const router = useRouter();
  const { user } = useAuth();
  const { isAdmin, loading: isAdminLoading } = useIsAdmin();
  
  const [loading, setLoading] = useState(true);
  const [cycles, setCycles] = useState<FeedbackCycle[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  
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
        .select('id, cycle_name, frequency, start_date, due_date, status, company_id')
        .eq('company_id', userData.company_id)
        .order('created_at', { ascending: false });

        if (cyclesError) throw cyclesError;
        setCycles(cyclesData || []);

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
    }
  };
  
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">Active</span>;
      case 'completed':
        return <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded-full">Completed</span>;
      case 'draft':
        return <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">Draft</span>;
      default:
        return status;
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
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cycles.map((cycle) => (
                  <TableRow key={cycle.id}>
                    <TableCell className="font-medium">{cycle.cycle_name || 'Unnamed Cycle'}</TableCell>
                    <TableCell className="capitalize">{cycle.frequency}</TableCell>
                    <TableCell>{formatDate(cycle.start_date)}</TableCell>
                    <TableCell>{formatDate(cycle.due_date)}</TableCell>
                    <TableCell>{getStatusBadge(cycle.status)}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        {cycle.status === 'draft' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStatusChange(cycle.id, 'active')}
                          >
                            Activate
                          </Button>
                        )}
                        {cycle.status === 'active' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStatusChange(cycle.id, 'completed')}
                          >
                            Complete
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
          onSuccess={() => {
            setShowCreateModal(false);
            setCycles(prev => [
              ...prev
            ]);
            // Refresh to get the new cycle
            router.refresh();
          }}
        />
      )}
    </div>
  );
}