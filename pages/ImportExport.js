// /pages/ImportExport.js
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Upload } from 'lucide-react';
import { Asset } from '@/entities/Asset';

export default function ImportExportPage() {
    
    const downloadCSV = (headers, data, filename) => {
        const headerRow = headers.join(',');
        const dataRows = data.map(row => 
            headers.map(header => JSON.stringify(row[header] || '')).join(',')
        );
        const csvContent = [headerRow, ...dataRows].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    const handleExportAssets = async () => {
        const assets = await Asset.list();
        const headers = ['name','categoryId','locationId','purchaseDate','purchasePrice','vendorId','serialNumber','model','condition','notes','tags'];
        downloadCSV(headers, assets, 'domestiq_assets_export.csv');
    };

    const handleDownloadTemplate = () => {
        const headers = ['name','categoryId','locationId','purchaseDate','purchasePrice','vendorId','serialNumber','model','condition','notes','tags'];
        downloadCSV(headers, [], 'domestiq_assets_template.csv');
    };

    // CSV import would require a file parser library and more complex logic
    // For now, we'll just have the UI for it.
    const handleImportAssets = () => {
        alert("CSV import functionality is being developed. Please use the 'Add Asset' form for now.");
    };

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">Import / Export Data</h1>
            
            <div className="grid md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Upload className="w-5 h-5"/> Import Assets</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-muted-foreground">Import a list of assets from a CSV file. Make sure your file matches the template.</p>
                        <div className="flex flex-col sm:flex-row gap-2">
                           <Button variant="outline" onClick={handleDownloadTemplate} className="flex-1">
                               <Download className="mr-2 h-4 w-4"/> Download Template
                           </Button>
                           <Button onClick={handleImportAssets} className="flex-1">
                               <Upload className="mr-2 h-4 w-4"/> Import from CSV
                           </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Download className="w-5 h-5"/> Export Assets</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-muted-foreground">Export your current asset list to a CSV file. This is useful for backups or external analysis.</p>
                        <Button onClick={handleExportAssets} className="w-full">
                           <Download className="mr-2 h-4 w-4"/> Export All Assets
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
