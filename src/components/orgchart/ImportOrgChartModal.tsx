// components/orgchart/ImportOrgChartModal.tsx
import React, { useState, useRef, useEffect } from 'react';
import { CsvRow } from '../../services/importService';
import { ImportResult, ImportError } from '@/app/types/orgChart.types';

interface ImportOrgChartModalProps {
  onImport: (file: File) => Promise<ImportResult | null>;
  onPreview: (file: File) => Promise<boolean>;
  previewData: CsvRow[];
  validationErrors: ImportError[];
  importing: boolean;
  onClose: () => void;
}

const ImportOrgChartModal: React.FC<ImportOrgChartModalProps> = ({
  onImport,
  onPreview,
  previewData,
  validationErrors,
  importing,
  onClose,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [previewed, setPreviewed] = useState(false);
  const [importComplete, setImportComplete] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Debug effect to log preview data when it changes
  useEffect(() => {
    console.log("Preview data from API:", previewData);
  }, [previewData]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setPreviewed(false);
      setImportComplete(false);
      setImportResult(null);
    }
  };

  const handlePreview = async () => {
    if (file) {
      // Read file for debugging
      const reader = new FileReader();
      reader.onload = async (e) => {
        const content = e.target?.result as string;
        console.log("File content preview:", content.substring(0, 300));
        console.log("File size:", file.size, "bytes");
      };
      reader.readAsText(file);
      
      // Call the provided onPreview function
      const success = await onPreview(file);
      setPreviewed(success);
    }
  };

  const handleImport = async () => {
    if (file) {
      const result = await onImport(file);
      setImportResult(result);
      setImportComplete(true);
    }
  };

  const downloadTemplate = () => {
    const template = 'email,managerEmail,name,title,role\njohn@example.com,,John Doe,CEO,admin\njane@example.com,john@example.com,Jane Smith,HR,admin\njoe@example.com,john@example.com,Joe Smith,Engineer,member\n';
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'candor_org_chart_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-4xl w-full">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-medium">Import Organization Chart</h3>
        </div>
        
        <div className="px-6 py-4">
          {!importComplete ? (
            <>
              <div className="mb-6">
                <p className="mb-2">
                  Upload a CSV file to import your organization chart structure. 
                  The file should contain at minimum employee emails and manager emails.
                </p>
                <button
                  type="button"
                  className="text-blue-600 hover:text-blue-800 text-sm"
                  onClick={downloadTemplate}
                >
                  Download CSV template
                </button>
              </div>
              
              <div className="mb-6">
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <svg className="w-8 h-8 mb-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
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
                {file && (
                  <div className="mt-2 text-sm text-gray-600">
                    Selected file: {file.name}
                  </div>
                )}
              </div>
              
              {file && !previewed && (
                <div className="mb-6">
                  <button
                    type="button"
                    className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-md"
                    onClick={handlePreview}
                  >
                    Preview Data
                  </button>
                </div>
              )}
              
              {previewed && (
                <>
                  <div className="mb-6">
                    <h4 className="font-medium mb-2">Preview (First 5 rows)</h4>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Manager Email</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {previewData && previewData.length > 0 ? (
                            previewData.map((row, index) => (
                              <tr key={index}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{row.email}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{row.managerEmail}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{row.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{row.title}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{row.role}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                                {previewed ? "No data found in CSV file" : "CSV data will appear here"}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  
                  {validationErrors.length > 0 && (
                    <div className="mb-6">
                      <h4 className="font-medium text-red-600 mb-2">Validation Errors</h4>
                      <div className="bg-red-50 p-4 rounded-md">
                        <ul className="list-disc list-inside space-y-1 text-sm text-red-700">
                          {validationErrors.map((error, index) => (
                            <li key={index}>
                              Row {error.row}: {error.message}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            <div className="mb-6">
              <h4 className="font-medium mb-2">Import Result</h4>
              {importResult?.success ? (
                <div className="bg-green-50 p-4 rounded-md">
                  <p className="text-green-700">
                    Import completed successfully!
                  </p>
                  <ul className="list-disc list-inside mt-2 text-sm text-green-700">
                    <li>Users added: {importResult.usersAdded}</li>
                    <li>Relationships created: {importResult.relationshipsCreated}</li>
                  </ul>
                </div>
              ) : (
                <div className="bg-red-50 p-4 rounded-md">
                  <p className="text-red-700">
                    Import failed. Please correct the errors and try again.
                  </p>
                  {importResult?.errors && importResult.errors.length > 0 && (
                    <ul className="list-disc list-inside mt-2 text-sm text-red-700">
                      {importResult.errors.map((error, index) => (
                        <li key={index}>
                          Row {error.row}: {error.message}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="px-6 py-3 bg-gray-50 flex justify-end space-x-3 rounded-b-lg">
          <button
            type="button"
            className="px-4 py-2 text-gray-700 hover:text-gray-900 bg-white border border-gray-300 rounded-md"
            onClick={onClose}
            disabled={importing}
          >
            {importComplete ? 'Close' : 'Cancel'}
          </button>
          
          {!importComplete && previewed && validationErrors.length === 0 && (
            <button
              type="button"
              className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
              onClick={handleImport}
              disabled={importing}
            >
              {importing ? 'Importing...' : 'Import Data'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportOrgChartModal;