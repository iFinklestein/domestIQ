import React, { useState, useMemo } from 'react';
import { Asset } from '@/api/entities';
import { Category } from '@/api/entities';
import { Location as AssetLocation } from '@/api/entities';
import { Vendor } from '@/api/entities';
import { UploadFile, ExtractDataFromUploadedFile } from '@/api/integrations';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, AlertTriangle, CheckCircle, XCircle, FileUp, Rocket } from 'lucide-react';
import { findVendorMatches, normalizeVendorName } from './vendorUtils';
import { useToast } from "@/components/ui/use-toast";

const VALID_HEADERS = ['name', 'category', 'location', 'vendor', 'serialNumber', 'model', 'condition', 'purchaseDate', 'purchasePrice', 'notes', 'tags'];
const REQUIRED_HEADERS = ['name'];
const CONDITIONS = ['New', 'Good', 'Fair', 'Poor'];

const capitalize = (s) => s && s[0].toUpperCase() + s.slice(1).toLowerCase();

export default function CsvProcessor({ onImportComplete }) {
  const [file, setFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [isDryRun, setIsDryRun] = useState(true);
  const [autoCreateEntities, setAutoCreateEntities] = useState(true);
  const [processedData, setProcessedData] = useState(null);
  
  const { toast } = useToast();

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === 'text/csv') {
      setFile(selectedFile);
      setProcessedData(null);
    } else {
      setFile(null);
      setProcessedData(null);
      toast({ variant: "destructive", title: "Invalid file type", description: "Please select a valid CSV file." });
    }
  };

  const getEntityResolver = (existingData) => {
    return async (entityType, name, isDryRunMode, autoCreate) => {
      if (!name) return { id: null, outcome: 'ok' };
      
      const trimmedName = String(name).trim();
      if (!trimmedName) return { id: null, outcome: 'ok' };
      
      const map = { 
        category: existingData.categories, 
        location: existingData.locations, 
        vendor: existingData.vendors 
      };
      const EntityClass = { 
        category: Category, 
        location: AssetLocation, 
        vendor: Vendor 
      };
      
      // For vendors, use fuzzy matching
      if (entityType === 'vendor') {
        const matches = findVendorMatches(trimmedName, existingData.vendors);
        if (matches.exact) {
          return { id: matches.exact.id, outcome: 'found' };
        }
        
        // Check fuzzy matches
        if (matches.fuzzy.length > 0) {
          const bestMatch = matches.fuzzy[0];
          if (!isDryRunMode) {
            // In real run, use the best fuzzy match
            return { id: bestMatch.id, outcome: 'fuzzy_matched', matchedName: bestMatch.name };
          } else {
            // In dry run, show what would happen
            return { id: `(match) ${bestMatch.name}`, outcome: 'will_fuzzy_match', matchedName: bestMatch.name };
          }
        }
      } else {
        // For categories and locations, use exact matching (case-insensitive)
        let entity = map[entityType].find(e => e.name.toLowerCase() === trimmedName.toLowerCase());
        if (entity) return { id: entity.id, outcome: 'found' };
      }

      if (isDryRunMode) {
        return autoCreate ? { id: `(new) ${trimmedName}`, outcome: 'will_create' } : { id: null, outcome: 'not_found' };
      }
      
      if (autoCreate) {
        try {
          const newEntity = await EntityClass[entityType].create({ name: trimmedName });
          map[entityType].push(newEntity);
          return { id: newEntity.id, outcome: 'created' };
        } catch (error) {
          console.error(`Failed to auto-create ${entityType} '${trimmedName}':`, error);
          return { id: null, outcome: 'creation_failed' };
        }
      }
      
      return { id: null, outcome: 'not_found' };
    };
  };

  const handleProcess = async () => {
    if (!file) return;

    setProcessing(true);
    setProcessedData(null);

    try {
      const [assets, categories, locations, vendors] = await Promise.all([
        Asset.list(), Category.list(), AssetLocation.list(), Vendor.list(),
      ]);

      const existingData = {
        assets: new Map(assets.map(a => [a.serialNumber?.toLowerCase().trim(), a]).filter(([k,v]) => k)),
        categories, locations, vendors
      };
      
      const { file_url } = await UploadFile({ file });
      const extractResult = await ExtractDataFromUploadedFile({
        file_url,
        json_schema: { type: "array", items: { type: "object", properties: Object.fromEntries(VALID_HEADERS.map(h => [h, { type: "string" }])) } }
      });

      if (extractResult.status !== 'success') throw new Error(extractResult.details || 'Failed to parse CSV.');
      
      const rawData = (extractResult.output || []).filter(row => Object.values(row).some(v => v && String(v).trim()));
      if (rawData.length === 0) throw new Error("CSV contains no data rows.");
      
      const headers = Object.keys(rawData[0]);
      const missingHeaders = REQUIRED_HEADERS.filter(h => !headers.includes(h));
      if (missingHeaders.length > 0) throw new Error(`Missing required headers: ${missingHeaders.join(', ')}`);

      const entityResolver = getEntityResolver(existingData);
      const results = [];

      for (const raw of rawData) {
        const errors = [];
        const warnings = [];
        const data = {};
        
        // Normalize and validate
        data.name = String(raw.name || '').trim();
        if (!data.name) errors.push("Name is required.");

        data.serialNumber = String(raw.serialNumber || '').trim() || null;
        
        const condition = capitalize(String(raw.condition || '').trim());
        if (raw.condition && !CONDITIONS.includes(condition)) {
          errors.push(`Invalid condition: '${raw.condition}'. Must be one of: ${CONDITIONS.join(', ')}.`);
        } else {
          data.condition = condition || 'Good';
        }

        if (raw.purchaseDate) {
          if (/^\d{4}-\d{2}-\d{2}$/.test(raw.purchaseDate)) {
            data.purchaseDate = raw.purchaseDate;
          } else {
            errors.push("Invalid date format. Use YYYY-MM-DD.");
          }
        }
        
        if (raw.purchasePrice) {
          const price = parseFloat(String(raw.purchasePrice).replace(/[$,]/g, ''));
          if (isNaN(price)) {
            errors.push("Invalid purchase price.");
          } else {
            data.purchasePrice = price;
          }
        }
        
        data.model = String(raw.model || '').trim() || null;
        data.notes = String(raw.notes || '').trim() || null;
        data.tags = raw.tags ? String(raw.tags).split(',').map(t => t.trim()).filter(Boolean) : [];

        // Resolve entities
        for (const type of ['category', 'location', 'vendor']) {
          const result = await entityResolver(type, raw[type], true, autoCreateEntities);
          if (result.outcome === 'not_found') {
            errors.push(`${capitalize(type)} '${raw[type]}' not found.`);
          } else if (result.outcome === 'creation_failed') {
            errors.push(`Failed to create ${type} '${raw[type]}'.`);
          } else if (result.outcome === 'will_fuzzy_match') {
            warnings.push(`${capitalize(type)} '${raw[type]}' will match existing '${result.matchedName}'.`);
          }
          data[`${type}Id`] = result.id;
        }

        let outcome = 'Skip';
        let reason = '';
        let existingAsset = null;
        
        if (errors.length > 0) {
          outcome = 'Skip';
          reason = errors.join(', ');
        } else {
          if (data.serialNumber) {
            existingAsset = existingData.assets.get(data.serialNumber.toLowerCase().trim());
            if (existingAsset) {
              outcome = 'Update';
              reason = `Update existing asset: ${existingAsset.name}`;
            } else {
              outcome = 'Create';
              reason = 'New asset';
            }
          } else {
            outcome = 'Create';
            reason = 'New asset (no serial number)';
          }
          
          if (warnings.length > 0) {
            reason += ` (${warnings.join(', ')})`;
          }
        }
        
        results.push({ ...data, raw, errors, warnings, outcome, reason, existingAsset });
      }

      setProcessedData(results);

    } catch (error) {
      console.error("Processing failed:", error);
      toast({ variant: "destructive", title: "Processing Error", description: error.message });
    } finally {
      setProcessing(false);
    }
  };
  
  const handleCommit = async () => {
    if (!processedData) return;

    setImporting(true);
    let created = 0, updated = 0, skipped = 0;
    const assetIds = [];
    
    // Re-fetch data to be safe and get a fresh resolver for commit
    const [assets, categories, locations, vendors] = await Promise.all([
      Asset.list(), Category.list(), AssetLocation.list(), Vendor.list(),
    ]);
    const existingData = {
      assets: new Map(assets.map(a => [a.serialNumber?.toLowerCase().trim(), a]).filter(([k,v]) => k)),
      categories, locations, vendors
    };
    const entityResolver = getEntityResolver(existingData);

    for (const row of processedData) {
      if (row.outcome === 'Skip') {
        skipped++;
        continue;
      }

      try {
        const payload = {
          name: row.name,
          serialNumber: row.serialNumber,
          model: row.model,
          condition: row.condition,
          purchaseDate: row.purchaseDate,
          purchasePrice: row.purchasePrice,
          notes: row.notes,
          tags: row.tags,
        };

        // Resolve entities for real
        let hasError = false;
        for (const type of ['category', 'location', 'vendor']) {
          const result = await entityResolver(type, row.raw[type], false, autoCreateEntities);
          if (result.outcome === 'not_found' || result.outcome === 'creation_failed') {
            hasError = true;
            break;
          }
          payload[`${type}Id`] = result.id;
        }
        
        if (hasError) {
          skipped++;
          continue;
        }

        if (row.outcome === 'Update') {
          const updatedAsset = await Asset.update(row.existingAsset.id, payload);
          assetIds.push(updatedAsset.id);
          updated++;
        } else {
          const newAsset = await Asset.create(payload);
          assetIds.push(newAsset.id);
          created++;
        }
      } catch (error) {
        console.error("Import commit error on row:", row, error);
        skipped++;
      }
    }

    setImporting(false);
    onImportComplete({ created, updated, skipped, assetIds });
    setFile(null);
    setProcessedData(null);
  };
  
  const summary = useMemo(() => {
    if (!processedData) return null;
    return processedData.reduce((acc, row) => {
      if (row.outcome === 'Create') acc.create++;
      else if (row.outcome === 'Update') acc.update++;
      else acc.skip++;
      return acc;
    }, { create: 0, update: 0, skip: 0 });
  }, [processedData]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileUp className="w-5 h-5" />CSV Import</CardTitle>
          <CardDescription>Upload a CSV file to bulk-create or update assets.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox id="dryRun" checked={isDryRun} onCheckedChange={setIsDryRun} />
              <label htmlFor="dryRun" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Dry run (preview only, no changes)</label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="autoCreate" checked={autoCreateEntities} onCheckedChange={setAutoCreateEntities} />
              <label htmlFor="autoCreate" className="text-sm font-medium">Auto-create Categories/Locations/Vendors</label>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <input type="file" accept=".csv" onChange={handleFileChange} id="csv-upload" className="flex-grow" />
            <Button onClick={handleProcess} disabled={!file || processing}>
              {processing ? 'Analyzing...' : 'Analyze CSV'}
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {summary && (
        <Card>
          <CardHeader>
            <CardTitle>Analysis Summary</CardTitle>
            <div className="flex gap-4 text-sm pt-2">
              <span className="font-semibold text-green-600">Create: {summary.create}</span>
              <span className="font-semibold text-blue-600">Update: {summary.update}</span>
              <span className="font-semibold text-red-600">Skip: {summary.skip}</span>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Outcome</TableHead><TableHead>Name</TableHead><TableHead>Serial</TableHead><TableHead>Reason / Info</TableHead></TableRow></TableHeader>
              <TableBody>
                {processedData.map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Badge variant={row.outcome === 'Create' ? 'default' : row.outcome === 'Update' ? 'outline' : 'destructive'}>{row.outcome}</Badge>
                    </TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.serialNumber || '—'}</TableCell>
                    <TableCell>{row.reason}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
          {!isDryRun && (
            <CardFooter>
              <Button onClick={handleCommit} disabled={importing || summary.create + summary.update === 0}>
                <Rocket className="mr-2 h-4 w-4" />
                {importing ? 'Importing...' : `Commit ${summary.create + summary.update} Changes`}
              </Button>
            </CardFooter>
          )}
        </Card>
      )}
    </div>
  );
}