'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/use-toast';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Pencil, Plus, Loader2 } from 'lucide-react';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { library, IconName } from '@fortawesome/fontawesome-svg-core';
import { fas } from '@fortawesome/free-solid-svg-icons';
import supabase from '@/lib/supabase/client';

// Add all FontAwesome solid icons to the library
library.add(fas);

// Define interface for company value
interface CompanyValue {
  id: string;
  name: string;
  description: string;
  icon: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  company_id: string;
}

// Component for icon picker
const IconPicker = ({ value, onChange }: { value: string | null, onChange: (value: string) => void }) => {
  const [search, setSearch] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  
  // Common FontAwesome icons that would be relevant for company values
  const commonIcons = [
    'star', 'heart', 'thumbs-up', 'handshake', 'users', 'lightbulb', 
    'medal', 'trophy', 'crown', 'rocket', 'shield', 'brain', 
    'hand-holding-heart', 'hands-helping', 'balance-scale', 'globe',
    'bullseye', 'chart-line', 'clipboard-check', 'gem', 'leaf', 'seedling'
  ];
  
  const filteredIcons = search 
    ? commonIcons.filter(icon => icon.includes(search.toLowerCase()))
    : commonIcons;
    
  return (
    <div className="relative">
      <div className="flex items-center space-x-2 mb-2">
        <div className="w-10 h-10 flex items-center justify-center border rounded">
          {value ? (
            <FontAwesomeIcon icon={['fas', value as IconName]} className="h-5 w-5" />
          ) : (
            <span className="text-gray-400">?</span>
          )}
        </div>
        <Button 
          variant="outline" 
          type="button" 
          onClick={() => setShowPicker(!showPicker)}
        >
          {value ? 'Change Icon' : 'Select Icon'}
        </Button>
      </div>
      
      {showPicker && (
        <Card className="absolute z-10 w-full max-w-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Select an Icon</CardTitle>
            <Input 
              placeholder="Search icons..." 
              value={search} 
              onChange={e => setSearch(e.target.value)}
              className="mt-2"
            />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-6 gap-2">
              {filteredIcons.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  className={`p-2 rounded hover:bg-slate-100 flex items-center justify-center ${value === icon ? 'bg-slate-200' : ''}`}
                  onClick={() => {
                    onChange(icon);
                    setShowPicker(false);
                  }}
                >
                  <FontAwesomeIcon icon={['fas', value as IconName]} className="h-5 w-5" />
                </button>
              ))}
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowPicker(false)}
            >
              Close
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
};

// Form for adding/editing company values
const CompanyValueForm = ({ 
  value, 
  onSave, 
  onCancel 
}: { 
  value: Partial<CompanyValue> | null, 
  onSave: (value: Partial<CompanyValue>) => Promise<void>, 
  onCancel: () => void 
}) => {
  const [formData, setFormData] = useState<Partial<CompanyValue>>(value || {
    name: '',
    description: '',
    icon: null,
    active: true
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      await onSave(formData);
      setIsSubmitting(false);
    } catch (error) {
      console.error('Error saving value:', error);
      setIsSubmitting(false);
    }
  };
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleIconChange = (icon: string) => {
    setFormData(prev => ({ ...prev, icon }));
  };
  
  const handleActiveChange = (checked: boolean) => {
    setFormData(prev => ({ ...prev, active: checked }));
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
        <label className="text-sm font-medium">Icon</label>
        <IconPicker 
          value={formData.icon ?? null} 
          onChange={handleIconChange} 
        />
      </div>
      
      {value && value.id && (
        <div className="flex items-center space-x-2">
          <Switch 
            checked={formData.active} 
            onCheckedChange={handleActiveChange} 
            id="active" 
          />
          <label htmlFor="active" className="text-sm font-medium">
            Active
          </label>
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="name" className="text-sm font-medium">
          Value Name
        </label>
        <Input
          id="name"
          name="name"
          value={formData.name || ''}
          onChange={handleChange}
          placeholder="e.g., Integrity, Excellence, Innovation"
          required
        />
      </div>
      
      <div className="space-y-2">
        <label htmlFor="description" className="text-sm font-medium">
          Description
        </label>
        <Textarea
          id="description"
          name="description"
          value={formData.description || ''}
          onChange={handleChange}
          placeholder="Describe what this value means to your company..."
          required
          rows={4}
        />
      </div>
      
      
      <div className="flex justify-end space-x-2 pt-4">
        <Button 
          type="button" 
          variant="outline" 
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button 
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Value'
          )}
        </Button>
      </div>
    </form>
  );
};

// Main component for managing company values
export default function CompanyValuesPage() {
  const router = useRouter();
  const [values, setValues] = useState<CompanyValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editValue, setEditValue] = useState<CompanyValue | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  
  // Fetch the company ID and values on component mount
  useEffect(() => {
    const fetchCompanyData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/login');
          return;
        }
        
        // Get the user's company ID
        const { data: userData, error: userError } = await supabase
          .from('company_members')
          .select('company_id, role')
          .eq('id', session.user.id)
          .single();
        
        if (userError || !userData) {
          toast({
            title: 'Error',
            description: 'Could not retrieve company information',
            variant: 'destructive',
          });
          return;
        }
        
        // Check if user is an admin
        if (userData.role !== 'admin') {
          toast({
            title: 'Access Denied',
            description: 'You do not have permission to manage company values',
            variant: 'destructive',
          });
          router.push('/dashboard');
          return;
        }
        
        setCompanyId(userData.company_id);
        
        // Fetch company values
        const { data: valuesData, error: valuesError } = await supabase
          .from('company_values')
          .select('*')
          .eq('company_id', userData.company_id)
          .order('created_at', { ascending: false });
        
        if (valuesError) {
          throw valuesError;
        }
        
        setValues(valuesData || []);
      } catch (error) {
        console.error('Error fetching company data:', error);
        toast({
          title: 'Error',
          description: 'Failed to load company values',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchCompanyData();
  }, [router]);
  
  // Save a new or updated company value
  const handleSaveValue = async (valueData: Partial<CompanyValue>) => {
    try {
      // Make sure we have a company ID
      if (!companyId) {
        throw new Error('No company ID available');
      }
      
      // Prepare data
      const data = {
        ...valueData,
        company_id: companyId,
      };
      
      // If it's an edit (has an ID), update it
      if (valueData.id) {
        const { data: updatedValue, error } = await supabase
          .from('company_values')
          .update(data)
          .eq('id', valueData.id)
          .select()
          .single();
        
        if (error) throw error;
        
        // Update the values list
        setValues(prev => prev.map(v => v.id === updatedValue.id ? updatedValue : v));
        
        // Update the corresponding feedback question
        await updateFeedbackQuestion(updatedValue);
        
        toast({
          title: 'Value Updated',
          description: `${updatedValue.name} has been updated successfully.`
        });
      } 
      // Otherwise create a new value
      else {
        const { data: newValue, error } = await supabase
          .from('company_values')
          .insert(data)
          .select()
          .single();
        
        if (error) throw error;
        
        // Add to the values list
        setValues(prev => [newValue, ...prev]);
        
        // Create a corresponding feedback question
        await createFeedbackQuestion(newValue);
        
        toast({
          title: 'Value Created',
          description: `${newValue.name} has been created successfully.`
        });
      }
      
      // Close any open dialogs
      setShowAddDialog(false);
      setEditValue(null);
    } catch (error) {
      console.error('Error saving company value:', error);
      toast({
        title: 'Error',
        description: 'Failed to save company value',
        variant: 'destructive',
      });
    }
  };
  
  // Create a feedback question for a company value
  const createFeedbackQuestion = async (value: CompanyValue) => {
    try {
      await supabase
        .from('feedback_questions')
        .insert({
          company_id: value.company_id,
          question_text: value.name,
          question_description: value.description,
          question_type: 'values', // Now using 'values' as a direct question type
          question_subtype: null, // No longer needed
          company_value_id: value.id,
          active: value.active,
          scope: 'company' // Company-specific
        });
    } catch (error) {
      console.error('Error creating feedback question:', error);
      // Continue without failing the whole operation
      toast({
        title: 'Warning',
        description: 'Value created but feedback question creation failed',
        variant: 'destructive',
      });
    }
  };
  
  // Update a feedback question for a company value
  const updateFeedbackQuestion = async (value: CompanyValue) => {
    try {
      await supabase
        .from('feedback_questions')
        .update({
          question_text: value.name,
          question_description: value.description,
          active: value.active,
        })
        .eq('company_value_id', value.id);
    } catch (error) {
      console.error('Error updating feedback question:', error);
      // Continue without failing the whole operation
      toast({
        title: 'Warning',
        description: 'Value updated but feedback question update failed',
        variant: 'destructive',
      });
    }
  };
  
  // Toggle a value's active status
  const handleToggleActive = async (value: CompanyValue) => {
    try {
      const updatedValue = { ...value, active: !value.active };
      
      const { error } = await supabase
        .from('company_values')
        .update({ active: updatedValue.active })
        .eq('id', value.id);
      
      if (error) throw error;
      
      // Update local state
      setValues(prev => prev.map(v => v.id === value.id ? updatedValue : v));
      
      // Update the corresponding feedback question
      await updateFeedbackQuestion(updatedValue);
      
      toast({
        title: updatedValue.active ? 'Value Activated' : 'Value Deactivated',
        description: `${value.name} has been ${updatedValue.active ? 'activated' : 'deactivated'} successfully.`
      });
    } catch (error) {
      console.error('Error toggling value status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update value status',
        variant: 'destructive',
      });
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
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-semibold">Company Values</h1>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add New Value
        </Button>
      </div>
      
      <Tabs defaultValue="active">
        <TabsList className="mb-4">
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="inactive">Inactive</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
        
        {['active', 'inactive', 'all'].map((tab) => (
          <TabsContent key={tab} value={tab}>
            <Card>
              <CardHeader>
                <CardTitle>{tab === 'active' ? 'Active' : tab === 'inactive' ? 'Inactive' : 'All'} Values</CardTitle>
                <CardDescription>
                  {tab === 'active' 
                    ? 'Values currently being used in feedback sessions.' 
                    : tab === 'inactive' 
                      ? 'Deactivated values not currently in use.' 
                      : 'All company values.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {values.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>No company values found. Click &quot;Add New Value&quot; to create one.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Icon</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead className="hidden md:table-cell">Description</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {values
                        .filter(value => 
                          tab === 'all' || 
                          (tab === 'active' && value.active) || 
                          (tab === 'inactive' && !value.active)
                        )
                        .map((value) => (
                          <TableRow key={value.id}>
                            <TableCell>
                              <div className="w-10 h-10 flex items-center justify-center">
                                {value.icon ? (
                                  <FontAwesomeIcon 
                                    icon={['fas', value.icon as IconName]} 
                                    className="h-5 w-5 text-cerulean" 
                                  />
                                ) : (
                                  <span className="text-gray-400">—</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">{value.name}</TableCell>
                            <TableCell className="hidden md:table-cell max-w-xs truncate">
                              {value.description}
                            </TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 rounded-full text-xs ${value.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                {value.active ? 'Active' : 'Inactive'}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end space-x-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setEditValue(value)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant={value.active ? "destructive" : "outline"}
                                  size="sm"
                                  onClick={() => handleToggleActive(value)}
                                >
                                  {value.active ? 'Deactivate' : 'Activate'}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
      
      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Company Value</DialogTitle>
            <DialogDescription>
              Create a new value that represents your company&#39;s culture and principles.
            </DialogDescription>
          </DialogHeader>
          <CompanyValueForm
            value={null}
            onSave={handleSaveValue}
            onCancel={() => setShowAddDialog(false)}
          />
        </DialogContent>
      </Dialog>
      
      {/* Edit Dialog */}
      <Dialog open={!!editValue} onOpenChange={(open) => !open && setEditValue(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Company Value</DialogTitle>
            <DialogDescription>
              Update this company value and its description.
            </DialogDescription>
          </DialogHeader>
          {editValue && (
            <CompanyValueForm
              value={editValue}
              onSave={handleSaveValue}
              onCancel={() => setEditValue(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}