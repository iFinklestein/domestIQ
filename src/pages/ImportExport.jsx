import React, { useState, useCallback, useEffect } from 'react';
import { User } from '@/api/entities';
import { migrateUserRole, isAdmin, isLandlord, isTenant, isPropertyManager } from '@/components/roles';
import { Asset } from '@/api/entities';
import { Property } from '@/api/entities';
import { Category } from '@/api/entities';
import { Location } from '@/api/entities';
import { Vendor } from '@/api/entities';
import { UploadFile, ExtractDataFromUploadedFile } from '@/api/integrations';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Download, FileText, Upload, Loader2 } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom'; // Import Link for navigation
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Helper function to create page URLs. Adjust this based on your actual routing setup.
const createPageUrl = (pageName) => {
    switch (pageName) {
        case 'Assets':
            return '/assets';
        // Add other page mappings if needed
        default:
            return `/${pageName.toLowerCase().replace(/\s/g, '-')}`;
    }
};

const VALID_HEADERS = ['name', 'ownership', 'propertyName', 'ownedByEmail', 'category', 'location', 'locationDescription', 'vendor', 'serialNumber', 'model', 'condition', 'purchaseDate', 'purchasePrice', 'notes', 'tags'];
const REQUIRED_HEADERS = ['name'];

export default function ImportExportPage() {
    const { toast } = useToast();
    const [currentUser, setCurrentUser] = useState(null);
    const [file, setFile] = useState(null);
    const [processing, setProcessing] = useState(false);
    const [importing, setImporting] = useState(false);
    const [processedData, setProcessedData] = useState(null);
    const [autoCreateEntities, setAutoCreateEntities] = useState(true);

    useEffect(() => {
        async function fetchUser() {
            try {
                const user = await User.me();
                const migratedUser = await migrateUserRole(user);
                setCurrentUser(migratedUser);
            } catch(e) { console.error('Failed to fetch user:', e); }
        }
        fetchUser();
    }, []);

    const handleDownloadTemplate = () => {
        // Removed warranty fields from template headers
        const headers = ['name', 'ownership', 'propertyName', 'ownedByEmail', 'category', 'location', 'locationDescription', 'vendor', 'serialNumber', 'model', 'condition', 'purchaseDate', 'purchasePrice', 'notes', 'tags'];
        const sampleData = [
            // Removed warranty fields from sample data
            { name: 'Refrigerator', ownership: 'rental', propertyName: 'Main St Apt', ownedByEmail: '', category: 'Appliances', location: 'Kitchen', locationDescription: '', vendor: 'Home Depot', serialNumber: 'RF123456', model: 'Samsung RF28R7351SR', condition: 'New', purchaseDate: '2023-01-15', purchasePrice: '1899.99', notes: 'Energy Star certified', tags: 'appliance,kitchen,new' },
            { name: 'Personal Laptop', ownership: 'personal', propertyName: '', ownedByEmail: 'tenant@example.com', category: 'Electronics', location: 'Home Office', locationDescription: 'On the desk', vendor: 'Best Buy', serialNumber: 'LP789012', model: 'MacBook Pro 13"', condition: 'Good', purchaseDate: '2024-01-01', purchasePrice: '1499.00', notes: '', tags: 'personal,electronics' },
        ];
        
        const csvContent = [
            headers.join(','),
            ...sampleData.map(row => headers.map(h => `"${row[h] || ''}"`).join(','))
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.setAttribute('href', URL.createObjectURL(blob));
        link.setAttribute('download', 'domestiq_assets_template.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleProcess = async () => {
        if (!file) return;
        setProcessing(true);
        try {
            // Load reference data
            const [allUsers, allProperties, allCategories, allLocations, allVendors, allAssets] = await Promise.all([
                User.list(), 
                Property.list(), 
                Category.list(), 
                Location.list(), 
                Vendor.list(),
                Asset.list()
            ]);

            const userMap = new Map(allUsers.map(u => [u.email, u.id]));
            const propertyMap = new Map(allProperties.map(p => [p.name, p.id]));
            const categoryMap = new Map(allCategories.map(c => [c.name.toLowerCase(), c]));
            const locationMap = new Map(allLocations.map(l => [l.name.toLowerCase(), l]));
            const vendorMap = new Map(allVendors.map(v => [v.name.toLowerCase(), v]));

            // Upload and extract data
            const { file_url } = await UploadFile({ file });
            const result = await ExtractDataFromUploadedFile({ 
                file_url, 
                json_schema: { 
                    type: "array", 
                    items: { type: "object" } 
                } 
            });

            if (result.status !== 'success') throw new Error(result.details);

            const results = (result.output || []).map(raw => {
                const data = { 
                    raw, 
                    errors: [], 
                    warnings: [], 
                    outcome: 'Create',
                    willCreateEntities: []
                };

                // Validate required fields
                data.name = raw.name?.trim();
                if (!data.name) {
                    data.errors.push("Name is required.");
                    data.outcome = 'Skip';
                    return data;
                }

                // Check for existing asset (by name + property for updates)
                const existingAsset = allAssets.find(a => 
                    a.name.toLowerCase() === data.name.toLowerCase() && 
                    propertyMap.get(raw.propertyName) === a.propertyId
                );
                
                if (existingAsset) {
                    data.outcome = 'Update';
                    data.existingId = existingAsset.id;
                }

                // Validate ownership
                data.ownership = raw.ownership?.toLowerCase() === 'rental' ? 'rental' : 'tenant';

                // Handle property assignment
                if (data.ownership === 'rental') {
                    if (isLandlord(currentUser) || isAdmin(currentUser)) {
                        const propId = propertyMap.get(raw.propertyName);
                        if (propId) {
                            const property = allProperties.find(p => p.id === propId);
                            if (property && property.owner_user_id === currentUser.id) {
                                data.property_id = propId;
                            } else {
                                data.errors.push(`Property '${raw.propertyName}' not owned by you.`);
                            }
                        } else {
                            data.errors.push(`Property '${raw.propertyName}' not found.`);
                        }
                    } else {
                        data.errors.push("Only Landlords/Admins can import rental assets.");
                    }
                } else { // tenant
                    const ownerId = userMap.get(raw.ownedByEmail?.trim());
                    data.owned_by_user_id = ownerId || currentUser.id;
                    if (!ownerId && raw.ownedByEmail) {
                        data.warnings.push(`User ${raw.ownedByEmail} not found, assigning to you.`);
                    }
                }

                // Handle category
                if (raw.category) {
                    const categoryKey = raw.category.toLowerCase();
                    if (categoryMap.has(categoryKey)) {
                        data.categoryId = categoryMap.get(categoryKey).id;
                    } else if (autoCreateEntities) {
                        data.willCreateEntities.push(`Category: ${raw.category}`);
                        data.categoryName = raw.category;
                    } else {
                        data.warnings.push(`Category '${raw.category}' not found and auto-create disabled.`);
                    }
                }

                // Handle location
                if (raw.location) {
                    const locationKey = raw.location.toLowerCase();
                    if (locationMap.has(locationKey)) {
                        data.locationId = locationMap.get(locationKey).id;
                    } else if (autoCreateEntities) {
                        data.willCreateEntities.push(`Location: ${raw.location}`);
                        data.locationName = raw.location;
                    } else {
                        data.warnings.push(`Location '${raw.location}' not found and auto-create disabled.`);
                    }
                }

                // Handle vendor
                if (raw.vendor) {
                    const vendorKey = raw.vendor.toLowerCase();
                    if (vendorMap.has(vendorKey)) {
                        data.vendorId = vendorMap.get(vendorKey).id;
                    } else if (autoCreateEntities) {
                        data.willCreateEntities.push(`Vendor: ${raw.vendor}`);
                        data.vendorName = raw.vendor;
                    } else {
                        data.warnings.push(`Vendor '${raw.vendor}' not found and auto-create disabled.`);
                    }
                }

                // Copy other fields
                data.serialNumber = raw.serialNumber;
                data.model = raw.model;
                data.condition = raw.condition || 'Good';
                data.purchaseDate = raw.purchaseDate;
                data.purchasePrice = raw.purchasePrice ? parseFloat(raw.purchasePrice) : null;
                // Removed warrantyProvider, warrantyStartDate, warrantyEndDate
                data.notes = raw.notes;
                data.tags = raw.tags ? raw.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
                data.locationDescription = raw.locationDescription;

                if (data.errors.length > 0) {
                    data.outcome = 'Skip';
                }

                return data;
            });

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
        const createdEntities = { categories: [], locations: [], vendors: [] };
        
        try {
            for (const row of processedData) {
                if (row.outcome === 'Skip') {
                    skipped++;
                    continue;
                }

                // Auto-create entities if needed
                if (row.categoryName && !row.categoryId) {
                    const newCategory = await Category.create({ name: row.categoryName });
                    row.categoryId = newCategory.id;
                    createdEntities.categories.push(row.categoryName);
                }

                if (row.locationName && !row.locationId) {
                    const newLocation = await Location.create({ name: row.locationName });
                    row.locationId = newLocation.id;
                    createdEntities.locations.push(row.locationName);
                }

                if (row.vendorName && !row.vendorId) {
                    const newVendor = await Vendor.create({ name: row.vendorName });
                    row.vendorId = newVendor.id;
                    createdEntities.vendors.push(row.vendorName);
                }

                // Prepare asset data
                const assetData = {
                    name: row.name,
                    ownerType: row.ownership,
                    propertyId: row.property_id,
                    tenancyId: row.tenancyId, // This field is not processed in the current code but kept here if it's used elsewhere for assets.
                    categoryId: row.categoryId,
                    locationId: row.locationId,
                    locationDescription: row.locationDescription,
                    vendorId: row.vendorId,
                    serialNumber: row.serialNumber,
                    model: row.model,
                    condition: row.condition,
                    purchaseDate: row.purchaseDate,
                    purchasePrice: row.purchasePrice,
                    // Removed warrantyProvider, warrantyStartDate, warrantyEndDate
                    notes: row.notes,
                    tags: row.tags
                };

                // Create or update
                if (row.outcome === 'Update') {
                    await Asset.update(row.existingId, assetData);
                    updated++;
                } else {
                    await Asset.create(assetData);
                    created++;
                }
            }

            let message = `Import completed: ${created} created, ${updated} updated, ${skipped} skipped.`;
            if (createdEntities.categories.length > 0 || createdEntities.locations.length > 0 || createdEntities.vendors.length > 0) {
                message += ` Auto-created: ${createdEntities.categories.length} categories, ${createdEntities.locations.length} locations, ${createdEntities.vendors.length} vendors.` ;
            }

            toast({ title: "Import Completed", description: message });
            setFile(null);
            setProcessedData(null);
        } catch (error) {
            console.error("Import failed:", error);
            toast({ variant: "destructive", title: "Import Failed", description: error.message });
        } finally {
            setImporting(false);
        }
    };

    const summary = processedData ? processedData.reduce((acc, row) => {
        acc[row.outcome.toLowerCase()] = (acc[row.outcome.toLowerCase()] || 0) + 1;
        return acc;
    }, {}) : null;

    if (!isAdmin(currentUser) && !isLandlord(currentUser)) {
        return (
            <div className="space-y-6">
                <h1 className="text-3xl font-bold">Import/Export</h1>
                <Card>
                    <CardContent className="text-center py-12">
                        <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">Access Restricted</h3>
                        <p className="text-muted-foreground mb-4">
                            Import/Export functionality is available for Admins and Landlords only.
                        </p>
                        <p className="text-sm text-muted-foreground">
                            {isTenant(currentUser) 
                                ? "As a tenant, you can manage your personal assets through the regular interface."
                                : isPropertyManager(currentUser)
                                ? "Property Managers can view and manage assets but cannot perform bulk operations."
                                : "Contact your administrator for access to this feature."
                            }
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Import Assets</h1>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div>
                                <Badge variant="outline" className="text-xs">
                                    {isAdmin(currentUser) ? "Admin Access" : "Landlord Access"}
                                </Badge>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Full import/export permissions granted</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader><CardTitle>Import Assets from CSV</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-muted-foreground">Upload a CSV file to bulk import assets. Download our template to get started.</p>
                        
                        <Button variant="outline" onClick={handleDownloadTemplate} className="w-full">
                            <Download className="mr-2 h-4 w-4"/>Download Template
                        </Button>
                        
                        <div className="flex items-center space-x-2">
                            <Checkbox 
                                id="autoCreate"
                                checked={autoCreateEntities}
                                onCheckedChange={setAutoCreateEntities}
                            />
                            <label htmlFor="autoCreate" className="text-sm">
                                Auto-create missing Categories, Locations, and Vendors
                            </label>
                        </div>

                        <div className="flex items-center gap-4 pt-4">
                            <Input 
                                type="file" 
                                accept=".csv" 
                                onChange={e => setFile(e.target.files[0])} 
                                className="flex-1"
                            />
                            <Button onClick={handleProcess} disabled={!file || processing}>
                                {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                {processing ? 'Analyzing...' : 'Analyze CSV'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>Export Assets</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-muted-foreground">Exporting is now available on the Assets page. The export will reflect your currently applied search and filters.</p>
                        
                        <Link to={createPageUrl('Assets')}>
                            <Button className="w-full">Go to Assets Page</Button>
                        </Link>
                        
                        <div className="text-xs text-muted-foreground">
                            Use the filters on the Assets page to select which assets you would like to include in your export.
                        </div>
                    </CardContent>
                </Card>
            </div>
            
            {summary && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            Dry-Run Analysis Results
                            <div className="flex gap-4 text-sm">
                                <span className="font-semibold text-green-600">Create: {summary.create || 0}</span>
                                <span className="font-semibold text-blue-600">Update: {summary.update || 0}</span>
                                <span className="font-semibold text-red-600">Skip: {summary.skip || 0}</span>
                            </div>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="max-h-96 overflow-y-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Asset Name</TableHead>
                                        <TableHead>Property</TableHead>
                                        <TableHead>Details</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {processedData.map((row, idx) => (
                                        <TableRow key={idx}>
                                            <TableCell>
                                                <Badge variant={
                                                    row.outcome === 'Skip' ? 'destructive' : 
                                                    row.outcome === 'Update' ? 'secondary' : 'default'
                                                }>
                                                    {row.outcome}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="font-medium">{row.raw.name}</TableCell>
                                            <TableCell>{row.raw.propertyName}</TableCell>
                                            <TableCell className="text-xs">
                                                {row.errors.length > 0 && (
                                                    <div className="text-red-600 mb-1">
                                                        {row.errors.join('; ')}
                                                    </div>
                                                )}
                                                {row.warnings.length > 0 && (
                                                    <div className="text-yellow-600 mb-1">
                                                        {row.warnings.join('; ')}
                                                    </div>
                                                )}
                                                {row.willCreateEntities.length > 0 && (
                                                    <div className="text-blue-600">
                                                        Will create: {row.willCreateEntities.join('; ')}
                                                    </div>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                        
                        {((summary.create > 0) || (summary.update > 0)) && (
                            <div className="mt-4 flex justify-between items-center">
                                <p className="text-sm text-muted-foreground">
                                    This is a dry-run preview. Click "Import Assets" to commit changes.
                                </p>
                                <Button onClick={handleCommit} disabled={importing}>
                                    {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                    {importing ? 'Importing...' : `Import ${(summary.create || 0) + (summary.update || 0)} Assets`}
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}