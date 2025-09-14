import React, { useState } from 'react';
import { Asset } from '@/api/entities';
import { Category } from '@/api/entities';
import { Location } from '@/api/entities';
import { Vendor } from '@/api/entities';
import { Warranty } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Package, FileText, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

// Simple ZIP implementation using browser APIs
const createZip = async (files) => {
    // For browsers that support the newer File API
    if (window.CompressionStream) {
        try {
            const { default: JSZip } = await import('https://cdn.skypack.dev/jszip');
            const zip = new JSZip();
            
            files.forEach(({ name, content }) => {
                zip.file(name, content);
            });
            
            const blob = await zip.generateAsync({ type: 'blob' });
            return blob;
        } catch (error) {
            console.warn('JSZip not available, falling back to individual downloads');
            return null;
        }
    }
    return null;
};

// Fallback: download individual files
const downloadIndividualFiles = (files) => {
    files.forEach(({ name, content }, index) => {
        setTimeout(() => {
            const blob = new Blob([content], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, index * 100); // Stagger downloads to avoid browser blocking
    });
};

export default function ExportSystem() {
    const [exporting, setExporting] = useState(false);
    const { toast } = useToast();

    const exportAllEntities = async () => {
        setExporting(true);
        try {
            // Fetch all entity data
            const [assets, categories, locations, vendors, warranties] = await Promise.all([
                Asset.list(),
                Category.list(),
                Location.list(),
                Vendor.list(),
                Warranty.list()
            ]);

            // Create manifest with schema version and export metadata
            const manifest = {
                exportDate: new Date().toISOString(),
                schemaVersion: "1.0.0",
                exportedBy: "domestIQ Asset Management System",
                entities: {
                    assets: {
                        count: assets.length,
                        fields: ["id", "name", "categoryId", "locationId", "purchaseDate", "purchasePrice", "vendorId", "serialNumber", "model", "condition", "notes", "photos", "receipts", "warrantyId", "tags", "created_date", "updated_date", "created_by"]
                    },
                    categories: {
                        count: categories.length,
                        fields: ["id", "name", "description", "created_date", "updated_date", "created_by"]
                    },
                    locations: {
                        count: locations.length,
                        fields: ["id", "name", "parentId", "created_date", "updated_date", "created_by"]
                    },
                    vendors: {
                        count: vendors.length,
                        fields: ["id", "name", "website", "phone", "email", "created_date", "updated_date", "created_by"]
                    },
                    warranties: {
                        count: warranties.length,
                        fields: ["id", "providerName", "policyNumber", "startDate", "endDate", "terms", "files", "created_date", "updated_date", "created_by"]
                    }
                },
                totalRecords: assets.length + categories.length + locations.length + vendors.length + warranties.length
            };

            // Prepare files for export
            const files = [
                {
                    name: 'manifest.json',
                    content: JSON.stringify(manifest, null, 2)
                },
                {
                    name: 'assets.json',
                    content: JSON.stringify({
                        entity: 'Asset',
                        exportDate: manifest.exportDate,
                        count: assets.length,
                        data: assets
                    }, null, 2)
                },
                {
                    name: 'categories.json',
                    content: JSON.stringify({
                        entity: 'Category',
                        exportDate: manifest.exportDate,
                        count: categories.length,
                        data: categories
                    }, null, 2)
                },
                {
                    name: 'locations.json',
                    content: JSON.stringify({
                        entity: 'Location',
                        exportDate: manifest.exportDate,
                        count: locations.length,
                        data: locations
                    }, null, 2)
                },
                {
                    name: 'vendors.json',
                    content: JSON.stringify({
                        entity: 'Vendor',
                        exportDate: manifest.exportDate,
                        count: vendors.length,
                        data: vendors
                    }, null, 2)
                },
                {
                    name: 'warranties.json',
                    content: JSON.stringify({
                        entity: 'Warranty',
                        exportDate: manifest.exportDate,
                        count: warranties.length,
                        data: warranties
                    }, null, 2)
                }
            ];

            // Try to create ZIP, fallback to individual downloads
            const zipBlob = await createZip(files);
            
            if (zipBlob) {
                // Download as ZIP
                const url = URL.createObjectURL(zipBlob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `domestiq_full_export_${new Date().toISOString().split('T')[0]}.zip`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                toast({
                    title: "Export Complete",
                    description: `Successfully exported ${manifest.totalRecords} records in ZIP format.`
                });
            } else {
                // Fallback: individual file downloads
                downloadIndividualFiles(files);
                
                toast({
                    title: "Export Complete",
                    description: `Successfully exported ${manifest.totalRecords} records as individual JSON files.`
                });
            }

        } catch (error) {
            console.error('Export failed:', error);
            toast({
                variant: "destructive",
                title: "Export Failed",
                description: "Could not export data. Please try again."
            });
        } finally {
            setExporting(false);
        }
    };

    const exportSingleEntity = async (entityName, EntityClass) => {
        try {
            const data = await EntityClass.list();
            const exportData = {
                entity: entityName,
                exportDate: new Date().toISOString(),
                count: data.length,
                data: data
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${entityName.toLowerCase()}_export_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            toast({
                title: "Export Complete",
                description: `Exported ${data.length} ${entityName.toLowerCase()} records.`
            });
        } catch (error) {
            console.error(`Export failed for ${entityName}:`, error);
            toast({
                variant: "destructive",
                title: "Export Failed",
                description: `Could not export ${entityName} data.`
            });
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    Data Export
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-3">
                    <div>
                        <h4 className="font-medium mb-2">Complete System Export</h4>
                        <p className="text-sm text-muted-foreground mb-3">
                            Export all entities (Assets, Categories, Locations, Vendors, Warranties) 
                            as JSON files with manifest. Downloads as ZIP when supported.
                        </p>
                        <Button 
                            onClick={exportAllEntities}
                            disabled={exporting}
                            className="w-full"
                        >
                            {exporting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Exporting...
                                </>
                            ) : (
                                <>
                                    <Download className="mr-2 h-4 w-4" />
                                    Export All Data
                                </>
                            )}
                        </Button>
                    </div>

                    <div className="border-t pt-3">
                        <h4 className="font-medium mb-2">Individual Entity Exports</h4>
                        <div className="grid grid-cols-2 gap-2">
                            <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => exportSingleEntity('Assets', Asset)}
                            >
                                <FileText className="mr-1 h-3 w-3" />
                                Assets
                            </Button>
                            <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => exportSingleEntity('Categories', Category)}
                            >
                                <FileText className="mr-1 h-3 w-3" />
                                Categories
                            </Button>
                            <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => exportSingleEntity('Locations', Location)}
                            >
                                <FileText className="mr-1 h-3 w-3" />
                                Locations
                            </Button>
                            <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => exportSingleEntity('Vendors', Vendor)}
                            >
                                <FileText className="mr-1 h-3 w-3" />
                                Vendors
                            </Button>
                            <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => exportSingleEntity('Warranties', Warranty)}
                            >
                                <FileText className="mr-1 h-3 w-3" />
                                Warranties
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="text-xs text-muted-foreground bg-muted p-3 rounded">
                    <p className="font-medium mb-1">Export Format:</p>
                    <ul className="list-disc list-inside space-y-1">
                        <li>Each entity exported as separate JSON file</li>
                        <li>manifest.json contains schema version and metadata</li>
                        <li>Includes all fields including system fields (id, created_date, etc.)</li>
                        <li>ZIP download when browser supports it, otherwise individual files</li>
                    </ul>
                </div>
            </CardContent>
        </Card>
    );
}