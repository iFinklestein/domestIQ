
import React, { useState, useEffect, useMemo } from 'react';
import { User } from '@/api/entities';
import { migrateUserRole, isAdmin, isLandlordOrPM, isTenant, canReadAsset, canWriteAsset, canManageProperties } from '@/components/roles';
import { useBootstrap } from '../components/useBootstrap';
import { useAuth } from '../components/useAuth';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, MoreHorizontal, Edit, Trash2, Search, Eye, Download, Loader2, AlertTriangle, Undo2, Archive, Box } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from "@/components/ui/use-toast";
import { getWarrantyStatus, filterAssetsByWarrantyStatus, WarrantyBadge } from '../components/warrantyUtils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { Label } from '@/components/ui/label';
import { EmptyState, ErrorState } from '../components/EmptyState';
import DebouncedInput from '../components/DebouncedInput';

const warrantyFilterOptions = {
    'all': 'All Warranties',
    'active': 'Active Warranties',
    'expiring': 'Expiring Soon (30 days)',
    'expired': 'Expired',
    'none': 'No Warranty'
};

export default function AssetsPage() {
    const { user: currentUser } = useAuth(); // Replaced direct user fetching with useAuth
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const activeTab = searchParams.get('tab') || 'active';
    const { toast } = useToast();

    // Use bootstrap service for data loading
    const { data: bootstrapData, loading, error, refetch } = useBootstrap();

    const [exporting, setExporting] = useState(false);
    const [searchTerm, setSearchTerm] = useState(() => localStorage.getItem('assetSearchTerm') || '');
    const [filters, setFilters] = useState(() => {
        try {
            const savedFilters = localStorage.getItem('assetFilters');
            const initialFilters = savedFilters ? JSON.parse(savedFilters) : {
                ownerType: 'all', 
                propertyId: 'all',
                categoryId: 'all', 
                locationId: 'all', 
                condition: 'all',
                warrantyStatus: 'all'
            };
            // Apply URL search param for warranty status on initial load
            const urlWarrantyStatus = searchParams.get('warrantyStatus');
            if (urlWarrantyStatus && warrantyFilterOptions[urlWarrantyStatus]) {
                initialFilters.warrantyStatus = urlWarrantyStatus;
            }
            return initialFilters;
        } catch (e) {
            return { ownerType: 'all', propertyId: 'all', categoryId: 'all', locationId: 'all', condition: 'all', warrantyStatus: 'all' };
        }
    });

    const [archiveDialog, setArchiveDialog] = useState({ open: false, item: null, dependencies: null, confirmationText: '' });

    // Save state to localStorage on change
    useEffect(() => {
        localStorage.setItem('assetSearchTerm', searchTerm);
        localStorage.setItem('assetFilters', JSON.stringify(filters));
    }, [searchTerm, filters]);

    // Memoize bootstrap data to prevent dependency array issues
    const memoizedBootstrapData = useMemo(() => ({
        assets: bootstrapData?.assets || [],
        userProperties: bootstrapData?.properties || [],
        userTenancies: bootstrapData?.tenancies || [],
        categories: bootstrapData?.categories || [],
        locations: bootstrapData?.locations || [],
        vendors: bootstrapData?.vendors || []
    }), [bootstrapData]);

    // Set default filter for ownership based on role
    useEffect(() => {
        if (currentUser && bootstrapData) {
            if (isLandlordOrPM(currentUser) && filters.ownerType === 'all') {
                setFilters(prev => ({ ...prev, ownerType: 'rental' }));
            }
        }
    }, [currentUser, bootstrapData, filters.ownerType]);

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const { activeAssets, archivedAssets } = useMemo(() => {
        const { assets, userProperties, userTenancies } = memoizedBootstrapData;
        
        // Filter assets based on permissions first
        const accessibleAssets = assets.filter(asset => 
            canReadAsset(currentUser, asset, userProperties, userTenancies)
        );

        const active = accessibleAssets.filter(a => a.status !== 'archived');
        const archived = accessibleAssets.filter(a => a.status === 'archived');
        
        const applyFilters = (assetList) => {
            let filtered = [...assetList];
            
            // Search with debouncing
            if (searchTerm) {
                const lowercasedTerm = searchTerm.toLowerCase();
                filtered = filtered.filter(asset =>
                    (asset.name?.toLowerCase().includes(lowercasedTerm)) ||
                    (asset.serialNumber?.toLowerCase().includes(lowercasedTerm)) ||
                    (asset.model?.toLowerCase().includes(lowercasedTerm)) ||
                    (asset.locationDescription?.toLowerCase().includes(lowercasedTerm)) ||
                    (asset.tags || []).some(tag => tag.toLowerCase().includes(lowercasedTerm))
                );
            }

            // Apply filters
            if (filters.ownerType !== 'all') {
                if (filters.ownerType === 'my') {
                    filtered = filtered.filter(a => a.ownerType === 'tenant');
                } else {
                    filtered = filtered.filter(a => a.ownerType === filters.ownerType);
                }
            }
            if (filters.propertyId !== 'all') filtered = filtered.filter(a => a.propertyId === filters.propertyId);
            if (filters.categoryId !== 'all') filtered = filtered.filter(a => a.categoryId === filters.categoryId);
            if (filters.locationId !== 'all') filtered = filtered.filter(a => a.locationId === filters.locationId);
            if (filters.condition !== 'all') filtered = filtered.filter(a => a.condition === filters.condition);
            if (filters.warrantyStatus !== 'all') filtered = filterAssetsByWarrantyStatus(filtered, filters.warrantyStatus);
            return filtered;
        }

        return { activeAssets: applyFilters(active), archivedAssets: applyFilters(archived) };
    }, [memoizedBootstrapData, searchTerm, filters, currentUser]);

    // Export functionality uses the already filtered lists
    const handleExport = async () => {
        setExporting(true);
        try {
            const { userProperties, categories, locations, vendors } = memoizedBootstrapData;
            const headers = ['name', 'ownerType', 'propertyName', 'category', 'location', 'purchaseDate', 'purchasePrice', 'model', 'serialNumber', 'warrantyStartDate', 'warrantyEndDate'];
            
            const listToExport = activeTab === 'active' ? activeAssets : archivedAssets;

            const rows = listToExport.map(asset => {
                const property = userProperties.find(p => p.id === asset.propertyId);
                const category = categories.find(c => c.id === asset.categoryId);
                const location = locations.find(l => l.id === asset.locationId);
                
                return {
                    name: asset.name || '',
                    ownerType: asset.ownerType || '',
                    propertyName: property?.name || '',
                    category: category?.name || '',
                    location: location?.name || '',
                    purchaseDate: asset.purchaseDate ? format(new Date(asset.purchaseDate), 'yyyy-MM-dd') : '',
                    purchasePrice: asset.purchasePrice || '',
                    model: asset.model || '',
                    serialNumber: asset.serialNumber || '',
                    warrantyStartDate: asset.warrantyStartDate ? format(new Date(asset.warrantyStartDate), 'yyyy-MM-dd') : '',
                    warrantyEndDate: asset.warrantyEndDate ? format(new Date(asset.warrantyEndDate), 'yyyy-MM-dd') : '',
                };
            });

            const csvContent = [
                headers.join(','),
                ...rows.map(row => headers.map(h => {
                    const value = row[h] ?? '';
                    return `"${value.toString().replace(/"/g, '""')}"`;
                }).join(','))
            ].join('\n');
            
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.setAttribute('href', URL.createObjectURL(blob));
            link.setAttribute('download', `domestiq_assets_export_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            toast({ title: "Success", description: `Exported ${listToExport.length} assets to CSV.` });
        } catch (error) {
            console.error("Export failed:", error);
            toast({ variant: "destructive", title: "Export Failed", description: "Could not export assets." });
        } finally {
            setExporting(false);
        }
    };

    const getOwnershipBadge = (asset) => {
        if (asset.ownerType === 'rental') {
            return <Badge variant="outline" className="text-blue-600 border-blue-200">Rental-owned</Badge>;
        } else {
            return <Badge variant="secondary" className="text-green-600 border-green-200">My asset</Badge>;
        }
    };

    const formatPropertyDisplay = (property) => {
        if (!property) return '—';
        const addressParts = [property.address1, property.city].filter(Boolean);
        const address = addressParts.length > 0 ? addressParts.join(', ') : '';
        return address ? `${property.name} — ${address}` : property.name;
    };

    const canCreate = isAdmin(currentUser) || isLandlordOrPM(currentUser) || (isTenant(currentUser) && memoizedBootstrapData.userTenancies.length > 0);
    
    const AssetsTable = ({ data, isArchived }) => {
        const { userProperties, userTenancies, locations } = memoizedBootstrapData; // Destructure here to make available inside render method

        if (loading) {
            return (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Property</TableHead>
                            <TableHead>Location</TableHead>
                            <TableHead>Condition</TableHead>
                            <TableHead>Warranty</TableHead>
                            <TableHead><span className="sr-only">Actions</span></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow>
                            <TableCell colSpan="6" className="text-center py-12">
                                <div className="flex items-center justify-center text-muted-foreground">
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Loading assets...
                                </div>
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            );
        }

        if (error) {
            return (
                <ErrorState 
                    title="Failed to load assets"
                    description="We couldn't load your assets. This might be due to a network issue or server error."
                    onRetry={refetch}
                    loading={loading}
                />
            );
        }

        if (data.length === 0) {
            const isFiltered = searchTerm || Object.values(filters).some(f => f !== 'all');
            
            if (isFiltered) {
                return (
                    <EmptyState
                        icon={Search}
                        title="No assets found"
                        description="No assets match your current search and filter criteria. Try adjusting your filters or search term."
                        actionLabel="Clear Filters"
                        onAction={() => {
                            setSearchTerm('');
                            setFilters({
                                ownerType: 'all',
                                propertyId: 'all',
                                categoryId: 'all',
                                locationId: 'all',
                                condition: 'all',
                                warrantyStatus: 'all'
                            });
                        }}
                    />
                );
            }

            if (isArchived) {
                return (
                    <EmptyState
                        icon={Archive}
                        title="No archived assets"
                        description="You haven't archived any assets yet. Archived assets will appear here for future reference."
                    />
                );
            }

            return (
                <EmptyState
                    icon={Box}
                    title="No assets yet"
                    description={
                        canCreate
                            ? "Start building your asset inventory by adding your first asset. Track appliances, furniture, electronics, and more."
                            : isTenant(currentUser) && memoizedBootstrapData.userTenancies.length === 0
                            ? "You need an active tenancy to create assets. Please contact your landlord."
                            : "You don't have permission to create assets in this system."
                    }
                    actionLabel={canCreate ? "Add Your First Asset" : undefined}
                    onAction={canCreate ? () => navigate(createPageUrl('AssetForm')) : undefined}
                    secondaryActionLabel={canCreate && canManageProperties(currentUser) ? "Set Up Categories" : undefined}
                    onSecondaryAction={canCreate && canManageProperties(currentUser) ? () => navigate(createPageUrl('Categories')) : undefined}
                />
            );
        }

        return (
            <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Property</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Condition</TableHead>
                    <TableHead>Warranty</TableHead>
                    <TableHead><span className="sr-only">Actions</span></TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {data.map(asset => {
                    const property = userProperties.find(p => p.id === asset.propertyId);
                    const location = locations.find(l => l.id === asset.locationId);
                    const canEdit = canWriteAsset(currentUser, asset, userProperties, userTenancies);
                    const canView = canReadAsset(currentUser, asset, userProperties, userTenancies);
                    const warrantyStatus = getWarrantyStatus(asset);
                    
                    return (
                        <TableRow key={asset.id} className={isArchived ? "bg-gray-50" : ""}>
                            <TableCell className="font-medium">
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                        <span className={isArchived ? "text-muted-foreground" : ""}>{asset.name}</span>
                                        {isArchived ? <Badge variant="outline">Archived</Badge> : getOwnershipBadge(asset)}
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell className={isArchived ? "text-muted-foreground" : ""}>{formatPropertyDisplay(property)}</TableCell>
                            <TableCell className={isArchived ? "text-muted-foreground" : ""}>
                                {location?.name || '—'}
                                {asset.locationDescription && (
                                    <div className="text-xs text-muted-foreground">
                                        {asset.locationDescription}
                                    </div>
                                )}
                            </TableCell>
                            <TableCell className={isArchived ? "text-muted-foreground" : ""}>{asset.condition}</TableCell>
                            <TableCell>
                                <WarrantyBadge asset={asset} showDays={false} />
                                {warrantyStatus.status === 'none' && <span className="text-muted-foreground text-sm">—</span>}
                            </TableCell>
                            <TableCell className="text-right">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button size="icon" variant="ghost">
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        {canView ? (
                                            <Link to={createPageUrl(`AssetDetail?id=${asset.id}`)}>
                                                <DropdownMenuItem className="cursor-pointer">
                                                    <Eye className="mr-2 h-4 w-4"/>View
                                                </DropdownMenuItem>
                                            </Link>
                                        ) : (
                                            <SimpleTooltip content="Insufficient permissions to view this asset">
                                                <DropdownMenuItem disabled onSelect={(e) => e.preventDefault()}>
                                                    <Eye className="mr-2 h-4 w-4 opacity-50"/>View
                                                </DropdownMenuItem>
                                            </SimpleTooltip>
                                        )}
                                        
                                        {canEdit && !isArchived ? (
                                            <Link to={createPageUrl(`AssetForm?id=${asset.id}`)}>
                                                <DropdownMenuItem className="cursor-pointer">
                                                    <Edit className="mr-2 h-4 w-4"/>Edit
                                                </DropdownMenuItem>
                                            </Link>
                                        ) : (
                                            <SimpleTooltip 
                                                content={
                                                    isArchived 
                                                        ? "Cannot edit archived assets"
                                                        : (isTenant(currentUser) && asset.ownerType === 'rental')
                                                        ? "You can only edit your own assets"
                                                        : "Insufficient permissions to edit this asset"
                                                }
                                            >
                                                <DropdownMenuItem disabled onSelect={(e) => e.preventDefault()}>
                                                    <Edit className="mr-2 h-4 w-4 opacity-50"/>
                                                    {isArchived ? "Edit (Archived)" : "Edit"}
                                                </DropdownMenuItem>
                                            </SimpleTooltip>
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    );
                })}
            </TableBody>
        </Table>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-3xl font-bold tracking-tight">Assets</h1>
                <div className="flex gap-2 w-full sm:w-auto">
                    {canCreate ? (
                        <Link to={createPageUrl('AssetForm')} className="w-full sm:w-auto">
                            <Button className="w-full"><Plus className="mr-2 h-4 w-4" /> Add Asset</Button>
                        </Link>
                    ) : (
                        <SimpleTooltip 
                            content={
                                isTenant(currentUser) && memoizedBootstrapData.userTenancies.length === 0
                                    ? "You need an active tenancy to create assets"
                                    : "Insufficient permissions to create assets"
                            }
                        >
                            <div className="w-full sm:w-auto">
                                <Button disabled className="w-full">
                                    <Plus className="mr-2 h-4 w-4" /> Add Asset
                                </Button>
                            </div>
                        </SimpleTooltip>
                    )}
                    <Button variant="outline" onClick={handleExport} disabled={exporting || (activeTab === 'active' ? activeAssets.length === 0 : archivedAssets.length === 0)}>
                        {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                        Export
                    </Button>
                </div>
            </div>

            {!loading && !error && (
                <>
                    <div className="space-y-4">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <DebouncedInput 
                                type="search" 
                                placeholder="Search by name, serial, model, location, tags..." 
                                className="pl-8 sm:w-[400px]"
                                value={searchTerm}
                                onChange={setSearchTerm}
                                delay={300}
                            />
                        </div>
                        
                        <div className="flex flex-wrap gap-4">
                            <Select value={filters.ownerType} onValueChange={v => handleFilterChange('ownerType', v)}>
                                <SelectTrigger className="w-full sm:w-[180px]">
                                    <SelectValue placeholder="All Ownership" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Ownership</SelectItem>
                                    <SelectItem value="rental">Rental-owned</SelectItem>
                                    {isTenant(currentUser) && <SelectItem value="my">My assets</SelectItem>}
                                </SelectContent>
                            </Select>

                            {memoizedBootstrapData.userProperties.length > 0 && (
                                <Select value={filters.propertyId} onValueChange={v => handleFilterChange('propertyId', v)}>
                                    <SelectTrigger className="w-full sm:w-[180px]">
                                        <SelectValue placeholder="All Properties" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Properties</SelectItem>
                                        {memoizedBootstrapData.userProperties.map(p => 
                                            <SelectItem key={p.id} value={p.id}>{formatPropertyDisplay(p)}</SelectItem>
                                        )}
                                    </SelectContent>
                                </Select>
                            )}

                            <Select value={filters.categoryId} onValueChange={v => handleFilterChange('categoryId', v)}>
                                <SelectTrigger className="w-full sm:w-[180px]">
                                    <SelectValue placeholder="All Categories" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Categories</SelectItem>
                                    {memoizedBootstrapData.categories.map(c => 
                                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                    )}
                                </SelectContent>
                            </Select>

                            <Select value={filters.locationId} onValueChange={v => handleFilterChange('locationId', v)}>
                                <SelectTrigger className="w-full sm:w-[180px]">
                                    <SelectValue placeholder="All Locations" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Locations</SelectItem>
                                    {memoizedBootstrapData.locations.map(l => 
                                        <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                                    )}
                                </SelectContent>
                            </Select>

                            <Select value={filters.condition} onValueChange={v => handleFilterChange('condition', v)}>
                                <SelectTrigger className="w-full sm:w-[180px]">
                                    <SelectValue placeholder="All Conditions" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Conditions</SelectItem>
                                    <SelectItem value="New">New</SelectItem>
                                    <SelectItem value="Good">Good</SelectItem>
                                    <SelectItem value="Fair">Fair</SelectItem>
                                    <SelectItem value="Poor">Poor</SelectItem>
                                </SelectContent>
                            </Select>

                            <Select value={filters.warrantyStatus} onValueChange={v => handleFilterChange('warrantyStatus', v)}>
                                <SelectTrigger className="w-full sm:w-[180px]">
                                    <SelectValue placeholder="All Warranties" />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(warrantyFilterOptions).map(([key, label]) => (
                                        <SelectItem key={key} value={key}>{label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    
                    <Tabs value={activeTab} onValueChange={(tab) => setSearchParams({ tab })}>
                        <TabsList>
                            <TabsTrigger value="active">Active ({activeAssets.length})</TabsTrigger>
                            <TabsTrigger value="archived">Archived ({archivedAssets.length})</TabsTrigger>
                        </TabsList>
                        <TabsContent value="active">
                            <Card><CardContent className="p-0"><AssetsTable data={activeAssets} isArchived={false} /></CardContent></Card>
                        </TabsContent>
                        <TabsContent value="archived">
                            <Card><CardContent className="p-0"><AssetsTable data={archivedAssets} isArchived={true} /></CardContent></Card>
                        </TabsContent>
                    </Tabs>
                </>
            )}

            {(loading || error) && (
                <div className="mt-8">
                    <AssetsTable data={[]} isArchived={false} />
                </div>
            )}
        </div>
    );
}
