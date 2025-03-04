// hooks/useOrgChartImport.ts
import { useState, useCallback } from 'react';
import { importService, CsvRow } from '../services/importService';
import { ImportResult, ImportError } from '@/app/types/orgChart.types';

export function useOrgChartImport() {
  const [parsedData, setParsedData] = useState<CsvRow[]>([]);
  const [previewData, setPreviewData] = useState<CsvRow[]>([]);
  const [validationErrors, setValidationErrors] = useState<ImportError[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const parseFile = useCallback(async (file: File) => {
    try {
      const rows = await importService.parseCSV(file);
      setParsedData(rows);
      setPreviewData(rows.slice(0, 5)); // Show first 5 rows as preview
      
      const errors = importService.validateCSV(rows);
      setValidationErrors(errors);
      
      return true;
    } catch (error) {
      console.error('Error parsing CSV:', error);
      return false;
    }
  }, []);

  const importOrgChart = useCallback(async (file: File) => {
    try {
      setImporting(true);
      const result = await importService.importOrgChart(file);
      setImportResult(result);
      return result;
    } catch (error) {
      console.error('Error importing org chart:', error);
      return null;
    } finally {
      setImporting(false);
    }
  }, []);

  return {
    parsedData,
    previewData,
    validationErrors,
    importing,
    importResult,
    parseFile,
    importOrgChart,
  };
}