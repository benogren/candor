'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, Upload, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '@/lib/context/auth-context';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';

const userSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address' }),
  name: z.string().min(2, { message: 'Name must be at least 2 characters' }),
  role: z.enum(['admin', 'member']),
});

const bulkSchema = z.object({
  emails: z.string().min(1, { message: 'Please enter at least one email address' }),
  role: z.enum(['admin', 'member']),
});

// Define a type for the CSV data
interface CsvUserData {
  email: string;
  name: string;
  role: 'admin' | 'member';
}

type InviteUsersModalProps = {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  onSuccess: () => void;
};

export default function InviteUsersModal({ isOpen, onClose, companyId, onSuccess }: InviteUsersModalProps) {
  const [activeTab, setActiveTab] = useState<string>('single');
  const [inviting, setInviting] = useState(false);
  const { user } = useAuth();
  
  // For single user invite
  const singleForm = useForm<z.infer<typeof userSchema>>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      email: '',
      name: '',
      role: 'member',
    },
  });
  
  // For bulk invite
  const bulkForm = useForm<z.infer<typeof bulkSchema>>({
    resolver: zodResolver(bulkSchema),
    defaultValues: {
      emails: '',
      role: 'member',
    },
  });
  
  // For CSV upload
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<CsvUserData[]>([]);
  const [csvProcessing, setCsvProcessing] = useState(false);
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setCsvFile(file);
    setCsvProcessing(true);
    setCsvErrors([]);
    
    try {
      // In a real app, you'd parse the CSV here
      // For simplicity, we'll just mock some basic validation
      const reader = new FileReader();
      
      reader.onload = (event) => {
        const csvText = event.target?.result as string;
        const lines = csvText.split('\n').filter(line => line.trim() !== '');
        
        // Check header
        const header = lines[0].toLowerCase();
        if (!header.includes('email') || !header.includes('name')) {
          setCsvErrors(['CSV file must have "email" and "name" columns']);
          setCsvProcessing(false);
          return;
        }
        
        // Process rows
        const data: CsvUserData[] = [];
        const errors: string[] = [];
        
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',');
          if (values.length < 2) {
            errors.push(`Line ${i+1}: Not enough values`);
            continue;
          }
          
          const email = values[0].trim();
          const name = values[1].trim();
          
          // Validate email
          if (!/^\S+@\S+\.\S+$/.test(email)) {
            errors.push(`Line ${i+1}: Invalid email "${email}"`);
            continue;
          }
          
          data.push({ email, name, role: 'member' });
        }
        
        setCsvData(data);
        setCsvErrors(errors);
        setCsvProcessing(false);
      };
      
      reader.readAsText(file);
    } catch (error) {
      console.error('Error processing CSV file:', error);
      setCsvErrors(['Error processing CSV file']);
      setCsvProcessing(false);
    }
  };
  
  const handleSingleInvite = async (data: z.infer<typeof userSchema>) => {
    setInviting(true);
    
    try {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      
      console.log('Sending invite request with data:', {
        email: data.email,
        name: data.name,
        role: data.role,
        companyId,
        adminId: user.id
      });
      
      // Make sure the URL is correct
      const response = await fetch('/api/team/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: data.email,
          name: data.name,
          role: data.role,
          companyId,
          adminId: user.id
        }),
      });
      
      // Handle errors from response
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      
      // Process successful response
      console.log('Invitation sent successfully');
      
      // Show success message
      toast({
        title: 'User invited',
        description: `An invitation has been sent to ${data.email}`,
      });
      
      // Reset form
      singleForm.reset();
      
      // Trigger refresh of team members list
      onSuccess();
    } catch (error) {
      console.error('Error inviting user:', error);
      toast({
        title: 'Error inviting user',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setInviting(false);
    }
  };
  
  const handleBulkInvite = async (data: z.infer<typeof bulkSchema>) => {
    setInviting(true);
    
    try {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      
      // Parse emails (assuming comma or newline separated)
      const emails = data.emails
        .split(/[,\n]/)
        .map(email => email.trim())
        .filter(email => email !== '');
      
      if (emails.length === 0) {
        throw new Error('No valid emails provided');
      }
      
      // Create users data
      const usersData = emails.map(email => ({
        email,
        name: email.split('@')[0], // Default name from email
        role: data.role
      }));
      
      // Call the bulk invite API
      const response = await fetch('/api/team/bulk-invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          users: usersData,
          companyId: companyId,
          adminId: user.id
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to invite users');
      }
      
      console.log('Bulk invite result:', result);
      
      // Display success/error counts
      const successCount = result.data.success?.length || 0;
      const errorCount = result.data.errors?.length || 0;
      
      if (successCount > 0) {
        toast({
          title: 'Users invited successfully',
          description: `${successCount} users were invited. ${errorCount > 0 ? `${errorCount} had errors.` : ''}`,
        });
        
        // Reset form
        bulkForm.reset();
        
        // Trigger refresh of team members list
        onSuccess();
      } else {
        toast({
          title: 'Error inviting users',
          description: 'No users were successfully invited.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error inviting users:', error);
      toast({
        title: 'Error inviting users',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setInviting(false);
    }
  };
  
  const handleCsvUpload = async () => {
    if (csvErrors.length > 0 || csvData.length === 0) {
      toast({
        title: 'Cannot process CSV',
        description: 'Please fix errors in your CSV file before uploading',
        variant: 'destructive',
      });
      return;
    }
    
    setInviting(true);
    
    try {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      
      // Call the bulk invite API with CSV data
      const response = await fetch('/api/team/bulk-invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          users: csvData,
          companyId: companyId,
          adminId: user.id
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to invite users');
      }
      
      console.log('CSV invite result:', result);
      
      // Display success/error counts
      const successCount = result.data.success?.length || 0;
      const errorCount = result.data.errors?.length || 0;
      
      if (successCount > 0) {
        toast({
          title: 'Users invited successfully',
          description: `${successCount} users were invited. ${errorCount > 0 ? `${errorCount} had errors.` : ''}`,
        });
        
        // Reset CSV state
        setCsvFile(null);
        setCsvData([]);
        setCsvErrors([]);
        
        // Trigger refresh of team members list
        onSuccess();
      } else {
        toast({
          title: 'Error inviting users',
          description: 'No users were successfully invited.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error inviting users from CSV:', error);
      toast({
        title: 'Error inviting users',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setInviting(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md md:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Invite Team Members</DialogTitle>
          <DialogDescription>
            Add members to your team. They&#39;ll receive an invitation to join your organization.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="single" onValueChange={setActiveTab} value={activeTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="single">Single User</TabsTrigger>
            <TabsTrigger value="bulk">Bulk Invite</TabsTrigger>
            <TabsTrigger value="csv">CSV Upload</TabsTrigger>
          </TabsList>
          
          <TabsContent value="single">
            <Form {...singleForm}>
              <form onSubmit={singleForm.handleSubmit(handleSingleInvite)} className="space-y-4 py-4">
                <FormField
                  control={singleForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input placeholder="user@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={singleForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={singleForm.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="member">Team Member</SelectItem>
                          <SelectItem value="admin">Administrator</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Administrators can manage team members and settings.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <Button type="submit" className="w-full" disabled={inviting}>
                  {inviting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Inviting...
                    </>
                  ) : (
                    <>Invite User</>
                  )}
                </Button>
              </form>
            </Form>
          </TabsContent>
          
          <TabsContent value="bulk">
            <Form {...bulkForm}>
              <form onSubmit={bulkForm.handleSubmit(handleBulkInvite)} className="space-y-4 py-4">
                <FormField
                  control={bulkForm.control}
                  name="emails"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Addresses</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Enter email addresses separated by commas or new lines" 
                          className="min-h-[120px]" 
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        Example: john@example.com, sarah@example.com
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={bulkForm.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role for all users</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="member">Team Member</SelectItem>
                          <SelectItem value="admin">Administrator</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <Button type="submit" className="w-full" disabled={inviting}>
                  {inviting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Inviting Users...
                    </>
                  ) : (
                    <>Invite Users</>
                  )}
                </Button>
              </form>
            </Form>
          </TabsContent>
          
          <TabsContent value="csv">
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <FormLabel>Upload CSV File</FormLabel>
                <div className="border-2 border-dashed border-gray-200 rounded-md p-6 flex flex-col items-center">
                  <input
                    type="file"
                    id="csv-upload"
                    accept=".csv"
                    className="hidden"
                    onChange={handleFileChange}
                    disabled={inviting || csvProcessing}
                  />
                  <label
                    htmlFor="csv-upload"
                    className={`flex flex-col items-center space-y-2 cursor-pointer ${
                      inviting || csvProcessing ? 'opacity-50' : ''
                    }`}
                  >
                    <Upload className="h-8 w-8 text-gray-400" />
                    <span className="text-sm font-medium">
                      {csvFile ? csvFile.name : 'Click to upload CSV'}
                    </span>
                    <span className="text-xs text-gray-500">
                      CSV must include email and name columns
                    </span>
                  </label>
                </div>
              </div>
              
              {csvProcessing && (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  <span>Processing CSV file...</span>
                </div>
              )}
              
              {!csvProcessing && csvErrors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-medium mb-1">CSV has errors:</div>
                    <ScrollArea className="h-[100px]">
                      <ul className="list-disc pl-5 text-sm">
                        {csvErrors.map((error, i) => (
                          <li key={i}>{error}</li>
                        ))}
                      </ul>
                    </ScrollArea>
                  </AlertDescription>
                </Alert>
              )}
              
              {!csvProcessing && csvErrors.length === 0 && csvData.length > 0 && (
                <Alert variant="default" className="bg-green-50 border-green-200">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription>
                    <span className="font-medium text-green-800">
                      CSV ready to import: {csvData.length} users
                    </span>
                  </AlertDescription>
                </Alert>
              )}
              
              <Button
                type="button"
                className="w-full"
                disabled={inviting || csvProcessing || csvErrors.length > 0 || csvData.length === 0}
                onClick={handleCsvUpload}
              >
                {inviting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Inviting Users...
                  </>
                ) : (
                  <>Upload and Invite Users</>
                )}
              </Button>
              
              <FormDescription className="text-center">
                CSV should have columns: email, name
              </FormDescription>
            </div>
          </TabsContent>
        </Tabs>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={inviting}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}