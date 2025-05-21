// components/orgchart/ImportOrgChartModal.tsx
import React, { useState, useRef } from 'react';
import { CsvRow } from '../../services/importService';
import { ImportResult, ImportError } from '@/app/types/orgChart.types';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  AlertCircle,
  Upload,
  CheckCircle,
  Loader2,
  FileSpreadsheet
} from 'lucide-react';

interface ImportOrgChartModalProps {
  onImport: (file: File) => Promise<ImportResult | null>;
  onPreview: (file: File) => Promise<boolean>;
  previewData: CsvRow[];
  validationErrors: ImportError[];
  importing: boolean;
  onClose: () => void;
  onDownloadCurrentOrgChart: () => void;
}

const ImportOrgChartModal: React.FC<ImportOrgChartModalProps> = ({
  onImport,
  onPreview,
  previewData,
  validationErrors,
  importing,
  onClose,
  onDownloadCurrentOrgChart,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [previewed, setPreviewed] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [importComplete, setImportComplete] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setPreviewed(false);
      setPreviewError(null);
      setImportComplete(false);
      setImportResult(null);
    }
  };

  const handlePreview = async () => {
    if (file) {
      setPreviewLoading(true);
      setPreviewError(null);
      try {
        const success = await onPreview(file);
        setPreviewed(success);
        
        // Even if preview was successful, we might have validation errors to show
        if (validationErrors.length > 0) {
          // Check specifically for deactivated user errors
          const deactivatedErrors = validationErrors.filter(err => 
            err.errorType === 'DEACTIVATED_USER' || 
            err.errorType === 'DEACTIVATED_MANAGER'
          );
          
          if (deactivatedErrors.length > 0) {
            // Create a specific message for deactivated users
            setPreviewError(`The CSV contains ${deactivatedErrors.length} deactivated user(s). Deactivated users cannot be included in the organization chart.`);
          } else if (!success) {
            // For other validation failures
            setPreviewError(`CSV validation failed with ${validationErrors.length} error(s). Please check the errors below.`);
          }
        } else if (!success) {
          setPreviewError("Failed to parse CSV file. Please check the file format.");
        }
      } catch (error) {
        console.error("Error previewing file:", error);
        setPreviewError(
          error instanceof Error 
            ? `Error: ${error.message}` 
            : "An unexpected error occurred while parsing the CSV file."
        );
        setPreviewed(false);
      } finally {
        setPreviewLoading(false);
      }
    }
  };

  const handleImport = async () => {
    if (file) {
      try {
        const result = await onImport(file);
        setImportResult(result);
        setImportComplete(true);
      } catch (error) {
        console.error("Error importing file:", error);
        // In case of import failure, show error and don't mark as complete
        setImportResult({
          success: false,
          usersAdded: 0,
          relationshipsCreated: 0,
          errors: [{
            row: 0,
            email: '',
            errorType: 'OTHER',
            message: error instanceof Error 
              ? error.message 
              : "An unexpected error occurred during import"
          }]
        });
        setImportComplete(true);
      }
    }
  };

  const downloadTemplate = () => {
    const template = 'email,managerEmail,name,role,title\njohn@example.com,,John Doe,admin,CEO\njane@example.com,john@example.com,Jane Smith,admin,CTO\nsarah@example.com,jane@example.com,Sarah Johnson,member,Engineer\nmark@example.com,jane@example.com,Mark Davis,member,Designer\n';
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'org_chart_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="min-w-[900px]">
        <DialogHeader>
          <DialogTitle>Import Organization Chart</DialogTitle>
          <DialogDescription>
            Upload a CSV file to import your organization chart structure.
            The file should contain employee emails and manager emails.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-2">
          {!importComplete ? (
            <>
            <div className='items-center flex justify-between mb-4'>
              {file && (
                  <div className="mt-2 text-sm text-gray-600">
                    Selected file: {file.name}
                  </div>
              )}
              <div className="flex justify-end">
                <Button 
                  variant="secondary" 
                  onClick={onDownloadCurrentOrgChart} 
                  className="flex items-center gap-2 mr-2"
                >
                  
                  <FileSpreadsheet className="h-4 w-4" />
                  Download Current Org Chart (CSV)
                </Button>
                <Button 
                  variant="secondary" 
                  onClick={downloadTemplate} 
                  className="flex items-center gap-2"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Download Template (CSV)
                </Button>
              </div>
              </div>
              
              <div className="mb-6">
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload
                        className="w-8 h-8 mb-4 text-gray-500"
                      />
                      <p className="mb-2 text-sm text-gray-500">
                        <span className="font-semibold">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-xs text-gray-500">CSV file only</p>
                    </div>
                    <input 
                      ref={fileInputRef}
                      type="file" 
                      className="hidden" 
                      accept=".csv" 
                      onChange={handleFileChange} 
                    />
                  </label>
                </div>
              </div>
              
              {file && !previewed && (
                <div className="mb-6 space-y-3">
                  <Button
                    type="button"
                    className="w-full"
                    onClick={handlePreview}
                    disabled={previewLoading}
                  >
                    {previewLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing CSV...
                      </>
                    ) : (
                      'Preview Data'
                    )}
                  </Button>
                  
                  {previewError && (
                    <Alert variant="destructive">
                      <AlertDescription>
                      <div className='flex items-center gap-2'>
                        <AlertCircle className="h-4 w-4 text-pantonered" />
                        <span className="font-medium">{previewError}</span>
                      </div>
                        
                        {/* Show specific deactivated users if that's the error type */}
                        {validationErrors.some(err => 
                          err.errorType === 'DEACTIVATED_USER' || 
                          err.errorType === 'DEACTIVATED_MANAGER'
                        ) && (
                          <ul className="mt-2 list-disc list-inside text-sm">
                            {validationErrors
                              .filter(err => 
                                err.errorType === 'DEACTIVATED_USER' || 
                                err.errorType === 'DEACTIVATED_MANAGER'
                              )
                              .slice(0, 5) // Show just the first 5 to avoid overwhelming
                              .map((err, idx) => (
                                <li key={idx}>{err.message}</li>
                              ))
                            }
                            {validationErrors.filter(err => 
                              err.errorType === 'DEACTIVATED_USER' || 
                              err.errorType === 'DEACTIVATED_MANAGER'
                            ).length > 5 && (
                              <li>...and {validationErrors.filter(err => 
                                err.errorType === 'DEACTIVATED_USER' || 
                                err.errorType === 'DEACTIVATED_MANAGER'
                              ).length - 5} more</li>
                            )}
                          </ul>
                        )}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
              
              {previewed && (
                <>
                  <div className="mb-6">
                    <h4 className="font-medium mb-2">Preview (First 5 rows)</h4>
                    <div className="overflow-x-auto">
                      <ScrollArea className="h-[180px] rounded border">
                        <div className="p-2">
                          <table className="table-auto divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider truncate">Email</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider truncate">Manager Email</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider truncate">Name</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider truncate">Role</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider truncate">Title</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {previewData.length > 0 ? (
                                previewData.map((row, index) => (
                                  <tr key={index}>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm truncate">{row.email}</td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm truncate">{row.managerEmail}</td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm truncate">{row.name}</td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm truncate">{row.role}</td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm truncate">{row.title}</td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                                    No data available in CSV
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </ScrollArea>
                    </div>
                  </div>
                  
                  {validationErrors.length > 0 && (
                    <div className="mb-6">
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          <div className="font-medium mb-2">CSV has {validationErrors.length} validation errors:</div>
                          <ScrollArea className="h-[120px]">
                            <ul className="list-disc list-inside space-y-1 text-sm">
                              {validationErrors.map((error, index) => (
                                <li key={index}>
                                  Row {error.row}: {error.message}
                                </li>
                              ))}
                            </ul>
                          </ScrollArea>
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}

                  {/* {validationErrors.length === 0 && (
                    <Alert className="mb-6 bg-green-50 border-green-200">
                      <AlertDescription className="text-green-700">
                        <div className='flex items-center gap-2'>
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        CSV file is valid and ready to import.
                        </div>
                      </AlertDescription>
                    </Alert>
                  )} */}
                </>
              )}
            </>
          ) : (
            <div className="mb-6">
              <h4 className="font-medium mb-2">Import Result</h4>
              {importResult?.success ? (
                <Alert className="bg-green-50 border-green-200">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-700">
                    <p>Import completed successfully!</p>
                    <ul className="list-disc list-inside mt-2 text-sm">
                      <li>Users added: {importResult.usersAdded}</li>
                      <li>Relationships created: {importResult.relationshipsCreated}</li>
                    </ul>
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <p>Import failed. Please correct the errors and try again.</p>
                    {importResult?.errors && importResult.errors.length > 0 && (
                      <ScrollArea className="h-[150px] mt-2">
                        <ul className="list-disc list-inside mt-2 text-sm">
                          {importResult.errors.map((error, index) => (
                            <li key={index}>
                              Row {error.row}: {error.message}
                            </li>
                          ))}
                        </ul>
                      </ScrollArea>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={importing || previewLoading}
          >
            {importComplete ? 'Close' : 'Cancel'}
          </Button>
          
          {!importComplete && previewed && validationErrors.length === 0 && (
            <Button
              onClick={handleImport}
              disabled={importing || previewLoading}
            >
              {importing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                'Import Data'
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImportOrgChartModal;