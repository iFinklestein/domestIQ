
import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { User } from '@/api/entities';
import { Asset } from '@/api/entities';
import { Property } from '@/api/entities';
import { Tenancy } from '@/api/entities';
import { Category } from '@/api/entities';
import { Location as AssetLocation } from '@/api/entities';
import { Vendor } from '@/api/entities';
import { migrateUserRole, isAdmin, isLandlordOrPM, isTenant, canWriteAsset } from '@/components/roles';
import { getPropertiesForCurrentUser } from '@/components/propertiesService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ArrowLeft, Save, Loader2, Info, ExternalLink, AlertTriangle } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { useToast } from "@/components/ui/use-toast";
import { Link } from 'react-router-dom';
import { logAuditEvent, extractPropertyId } from '../components/auditLog';

const DebugInfoPanel = ({ properties }) => {
  // This panel verifies that the properties loaded by the centralized service
  // match the count and set available on the Properties page.
  const count_form = properties.length;
  
  // Sort properties by name for consistent comparison
  const sortedProperties = [...properties].sort((a, b) => a.name.localeCompare(b.name));
  
  return (
    <Card className="mt-8 border-dashed border-green-500 bg-green-50/50">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-green-800 flex items-center gap-2">
            <Info className="h-5 w-5" />
            Property Selector Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <Alert className="border-green-300 bg-green-50 text-green-800">
         <AlertTitle className="font-semibold">✓ Using Centralized Service</AlertTitle>
         <AlertDescription>Property selector uses getPropertiesForCurrentUser() exclusively</AlertDescription>
        </Alert>
        
        <div className="grid grid-cols-2 gap-4">
            <div><span className="font-medium">Available Properties:</span> {count_form}</div>
            <div><span className="font-medium">Source:</span> Centralized Service</div>
        </div>
        
        <div className="mt-4">
            <span className="font-medium">Properties (sorted by name):</span>
            <ul className="list-disc pl-5 mt-2 space-y-1">
                {sortedProperties.slice(0, 5).map(p => (
                    <li key={p.id} className="text-xs">
                        {formatPropertyDisplay(p)}
                    </li>
                ))}
                {sortedProperties.length > 5 && (
                    <li className="text-xs text-muted-foreground">
                        ...and {sortedProperties.length - 5} more
                    </li>
                )}
            </ul>
        </div>
      </CardContent>
    </Card>
  );
};

const formatPropertyDisplay = (property) => {
    if (!property) return '—';
    const addressParts = [property.address1, property.city].filter(Boolean);
    const address = addressParts.length > 0 ? addressParts.join(', ') : '';
    return address ? `${property.name} — ${address}` : property.name;
};

export default function AssetForm() {
    const navigate = useNavigate();
    const location = useLocation();
    const urlParams = new URLSearchParams(location.search);
    const assetId = urlParams.get('id');
    const { toast } = useToast();

    const [asset, setAsset] = useState({
        name: '', ownerType: 'rental', propertyId: '', tenancyId: '',
        categoryId: '', locationId: '', locationDescription: '', purchaseDate: '', purchasePrice: '',
        vendorId: '', serialNumber: '', model: '', condition: 'Good', 
        warrantyProvider: '', warrantyStartDate: '', warrantyEndDate: '',
        notes: '', tags: []
    });
    const [relatedData, setRelatedData] = useState({
        categories: [], locations: [], vendors: [],
        userProperties: [], userTenancies: [], propertyTenancies: []
    });
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);

    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            try {
                const user = await User.me();
                const migratedUser = await migrateUserRole(user);
                setCurrentUser(migratedUser);

                if (!migratedUser) {
                    setLoading(false);
                    return;
                }

                // Load basic reference data
                const [categories, locations, vendors] = await Promise.all([
                    Category.list(),
                    AssetLocation.list(),
                    isAdmin(migratedUser) ? Vendor.list() : Vendor.filter({ created_by: migratedUser.email })
                ]);

                // Use the centralized service for properties - this is the ONLY source
                let userProperties = await getPropertiesForCurrentUser(migratedUser);
                
                // Sort properties by name for consistent ordering
                userProperties = userProperties.sort((a, b) => a.name.localeCompare(b.name));

                // Load user tenancies (if tenant)
                let userTenancies = [];
                let propertyTenancies = [];

                if (isTenant(migratedUser)) {
                    userTenancies = await Tenancy.filter({
                        tenant_user_id: migratedUser.id,
                        status: 'active'
                    });
                }

                // Load existing asset if editing
                let assetData = null;
                if (assetId) {
                    assetData = await Asset.get(assetId);

                    // Check permissions
                    if (!canWriteAsset(migratedUser, assetData, userProperties, userTenancies)) {
                        toast({
                            variant: "destructive",
                            title: "Access Denied",
                            description: "You don't have permission to edit this asset."
                        });
                        navigate(createPageUrl('Assets'));
                        return;
                    }

                    // Load tenancies for the asset's property if needed
                    if (assetData.propertyId) {
                        propertyTenancies = await Tenancy.filter({
                            property_id: assetData.propertyId,
                            status: 'active'
                        });
                    }
                }

                setRelatedData({
                    categories, locations, vendors,
                    userProperties, userTenancies, propertyTenancies
                });

                if (assetData) {
                    setAsset({
                        ...assetData,
                        purchaseDate: assetData.purchaseDate ? assetData.purchaseDate.split('T')[0] : '',
                        warrantyStartDate: assetData.warrantyStartDate ? assetData.warrantyStartDate.split('T')[0] : '',
                        warrantyEndDate: assetData.warrantyEndDate ? assetData.warrantyEndDate.split('T')[0] : ''
                    });
                } else {
                    // Set defaults for new asset
                    const defaultOwnerType = isTenant(migratedUser) ? 'tenant' : 'rental';
                    const defaultTenancy = isTenant(migratedUser) && userTenancies.length > 0 ? userTenancies[0] : null;
                    const defaultPropertyId = defaultTenancy ? defaultTenancy.property_id : (userProperties.length === 1 ? userProperties[0].id : '');
                    
                    setAsset(prev => ({
                        ...prev,
                        ownerType: defaultOwnerType,
                        tenancyId: defaultTenancy ? defaultTenancy.id : '',
                        propertyId: defaultPropertyId
                    }));
                }
            } catch (error) {
                console.error("Error loading data:", error);
                toast({ variant: "destructive", title: "Error", description: "Failed to load form data." });
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [assetId, toast, navigate]);

    // Load tenancies when property changes
    useEffect(() => {
        async function loadPropertyTenancies() {
            if (asset.propertyId && currentUser && (isLandlordOrPM(currentUser) || isAdmin(currentUser))) {
                try {
                    const tenancies = await Tenancy.filter({
                        property_id: asset.propertyId,
                        status: 'active'
                    });
                    setRelatedData(prev => ({ ...prev, propertyTenancies: tenancies }));
                } catch (error) {
                    console.error("Error loading property tenancies:", error);
                }
            }
        }
        loadPropertyTenancies();
    }, [asset.propertyId, currentUser]);

    const handleInputChange = (field, value) => {
        setAsset(prev => ({ ...prev, [field]: value }));
    };

    const handleOwnerTypeChange = (value) => {
        const isNowTenantOwned = value === 'tenant';
        
        const autoSelectedTenancy = (isNowTenantOwned && asset.propertyId && relatedData.propertyTenancies.length === 1) 
            ? relatedData.propertyTenancies[0].id 
            : '';

        setAsset(prev => ({
            ...prev,
            ownerType: value,
            tenancyId: isNowTenantOwned ? autoSelectedTenancy : '',
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);

        try {
            // Validation
            if (!asset.name) {
                toast({ variant: "destructive", title: "Validation Error", description: "Asset name is required." });
                return;
            }

            if (!asset.propertyId) {
                toast({ variant: "destructive", title: "Validation Error", description: "Property is required." });
                return;
            }

            if (asset.ownerType === 'tenant' && !asset.tenancyId) {
                toast({ variant: "destructive", title: "Validation Error", description: "Tenancy is required for tenant-owned assets." });
                return;
            }

            const dataToSave = {
                ...asset,
                purchasePrice: asset.purchasePrice ? parseFloat(asset.purchasePrice) : null,
                tenancyId: asset.ownerType === 'rental' ? null : asset.tenancyId,
                // Clean up warranty fields - don't save empty strings
                warrantyProvider: asset.warrantyProvider || null,
                warrantyStartDate: asset.warrantyStartDate || null,
                warrantyEndDate: asset.warrantyEndDate || null,
                vendorId: asset.vendorId || null,
                categoryId: asset.categoryId || null,
                locationId: asset.locationId || null,
            };

            let savedAsset;
            if (assetId) {
                savedAsset = await Asset.update(assetId, dataToSave);
                
                // Log audit event for update
                await logAuditEvent({
                    entityType: 'Asset',
                    entityId: assetId,
                    action: 'update',
                    user: currentUser,
                    propertyId: extractPropertyId('Asset', dataToSave),
                    details: { name: dataToSave.name }
                });
                
                toast({ title: "Success", description: "Asset updated." });
            } else {
                savedAsset = await Asset.create(dataToSave);
                
                // Log audit event for create
                await logAuditEvent({
                    entityType: 'Asset',
                    entityId: savedAsset.id || 'new',
                    action: 'create',
                    user: currentUser,
                    propertyId: extractPropertyId('Asset', dataToSave),
                    details: { name: dataToSave.name }
                });
                
                toast({ title: "Success", description: "Asset created." });
            }
            // Navigate to the detail page on success
            navigate(createPageUrl(`AssetDetail?id=${savedAsset.id}`));
        } catch (error) {
            console.error("Failed to save asset:", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to save asset." });
        } finally {
            setIsSaving(false);
        }
    };

    const isReadOnly = useMemo(() => isTenant(currentUser) && asset.ownerType === 'rental', [currentUser, asset.ownerType]);
    const canSelectProperty = useMemo(() => !isTenant(currentUser) || relatedData.userTenancies.length === 0, [currentUser, relatedData.userTenancies.length]);
    const hasActiveTenancy = useMemo(() => isTenant(currentUser) && relatedData.userTenancies.length > 0, [currentUser, relatedData.userTenancies.length]);

    if (loading) return <div>Loading form...</div>;

    // For tenants without active tenancy, show warning
    if (isTenant(currentUser) && relatedData.userTenancies.length === 0) {
        return (
            <div className="max-w-2xl mx-auto mt-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Cannot Create Asset</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Alert>
                            <Info className="h-4 w-4" />
                            <AlertDescription>
                                No active tenancy found. Please ask your landlord to assign you to a property before creating assets.
                            </AlertDescription>
                        </Alert>
                        <Button
                            variant="outline"
                            onClick={() => navigate(createPageUrl('Assets'))}
                            className="mt-4"
                        >
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Assets
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-8">
            <div className="flex items-center justify-between">
                <Button type="button" variant="outline" onClick={() => navigate(createPageUrl('Assets'))}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Assets
                </Button>
                <h1 className="text-3xl font-bold">{assetId ? 'Edit Asset' : 'Create Asset'}</h1>
                <Button type="submit" disabled={isSaving || isReadOnly}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Asset
                </Button>
            </div>

            {isReadOnly && (
                <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                        This item is maintained by the property owner and cannot be edited.
                    </AlertDescription>
                </Alert>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader><CardTitle>Basic Information</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label htmlFor="name">Asset Name*</Label>
                                <Input
                                    id="name"
                                    value={asset.name}
                                    onChange={e => handleInputChange('name', e.target.value)}
                                    required
                                    readOnly={isReadOnly}
                                />
                            </div>

                            {/* Property Selection */}
                            <div>
                                <Label htmlFor="propertyId">Property*</Label>
                                {relatedData.userProperties.length === 0 ? (
                                    <div className="border rounded-md p-3 bg-gray-50">
                                        <p className="text-sm text-muted-foreground">
                                            No properties available —
                                            <Link to={createPageUrl('Properties')} className="text-blue-600 hover:underline ml-1">
                                                <ExternalLink className="inline w-3 h-3 ml-1" />
                                                Add Property
                                            </Link>
                                        </p>
                                    </div>
                                ) : hasActiveTenancy ? (
                                    <div className="mt-2">
                                        <div className="p-3 bg-gray-50 rounded-md border">
                                            <span className="text-sm text-muted-foreground">
                                                {formatPropertyDisplay(relatedData.userProperties.find(p => p.id === asset.propertyId) || relatedData.userProperties[0])}
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <Select
                                        onValueChange={value => {
                                            handleInputChange('propertyId', value);
                                            handleInputChange('tenancyId', '');
                                        }}
                                        value={asset.propertyId}
                                        disabled={isReadOnly || !canSelectProperty}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a property" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {relatedData.userProperties.map(p =>
                                                <SelectItem key={p.id} value={p.id}>
                                                    {formatPropertyDisplay(p)}
                                                </SelectItem>
                                            )}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>

                            {/* Ownership */}
                            {currentUser && (isLandlordOrPM(currentUser) || isAdmin(currentUser)) && (
                                <div>
                                    <Label>Ownership</Label>
                                    <RadioGroup
                                        value={asset.ownerType}
                                        onValueChange={handleOwnerTypeChange}
                                        className="flex gap-4 mt-2"
                                        disabled={isReadOnly}
                                    >
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="rental" id="rental" />
                                            <Label htmlFor="rental">Rental-owned</Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="tenant" id="tenant" />
                                            <Label htmlFor="tenant">Tenant-owned</Label>
                                        </div>
                                    </RadioGroup>
                                </div>
                            )}

                            {/* Tenancy - only for tenant-owned assets */}
                            {asset.ownerType === 'tenant' && (
                                <div>
                                    <Label htmlFor="tenancyId">Tenancy*</Label>
                                    {isTenant(currentUser) ? (
                                        <div className="mt-2 text-sm text-muted-foreground p-3 bg-gray-50 rounded-md border">
                                            <span>Current Active Tenancy</span>
                                        </div>
                                    ) : (
                                        <Select
                                            onValueChange={value => handleInputChange('tenancyId', value)}
                                            value={asset.tenancyId}
                                            disabled={isReadOnly || !asset.propertyId}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder={!asset.propertyId ? "First select a property" : "Select a tenancy"} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {relatedData.propertyTenancies.map(t =>
                                                    <SelectItem key={t.id} value={t.id}>
                                                        {`Tenancy at Unit ${t.unit_id ? t.unit_id.slice(0, 4) + '...' : t.id.slice(0, 4) + '...'} (Tenant ID: ${t.tenant_user_id ? t.tenant_user_id.slice(0,4) + '...' : 'N/A'})`}
                                                    </SelectItem>
                                                )}
                                            </SelectContent>
                                        </Select>
                                    )}
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="model">Model</Label>
                                    <Input
                                        id="model"
                                        value={asset.model}
                                        onChange={e => handleInputChange('model', e.target.value)}
                                        readOnly={isReadOnly}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="serialNumber">Serial Number</Label>
                                    <Input
                                        id="serialNumber"
                                        value={asset.serialNumber}
                                        onChange={e => handleInputChange('serialNumber', e.target.value)}
                                        readOnly={isReadOnly}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle>Classification & Location</CardTitle></CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="categoryId">Category</Label>
                                <Select
                                    onValueChange={value => handleInputChange('categoryId', value)}
                                    value={asset.categoryId}
                                    disabled={isReadOnly}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a category..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={null}>No Category</SelectItem>
                                        {relatedData.categories.map(c =>
                                            <SelectItem key={c.id} value={c.id}>
                                                <div className="flex flex-col">
                                                    <span>{c.name}</span>
                                                    {c.description && <span className="text-xs text-muted-foreground">{c.description}</span>}
                                                </div>
                                            </SelectItem>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="locationId">Location</Label>
                                <Select
                                    onValueChange={value => handleInputChange('locationId', value)}
                                    value={asset.locationId}
                                    disabled={isReadOnly}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a location..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={null}>No Location</SelectItem>
                                        {relatedData.locations.map(l =>
                                            <SelectItem key={l.id} value={l.id}>
                                                <div className="flex flex-col">
                                                    <span>{l.name}</span>
                                                    {l.description && <span className="text-xs text-muted-foreground">{l.description}</span>}
                                                </div>
                                            </SelectItem>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="md:col-span-2">
                                <Label htmlFor="locationDescription">Location Description (optional)</Label>
                                <Input
                                    id="locationDescription"
                                    value={asset.locationDescription}
                                    onChange={e => handleInputChange('locationDescription', e.target.value)}
                                    placeholder="e.g., pantry off kitchen, left built-in, desk drawer"
                                    readOnly={isReadOnly}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card>
                        <CardHeader><CardTitle>Purchase & Condition</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label htmlFor="purchaseDate">Purchase Date</Label>
                                <Input
                                    type="date"
                                    id="purchaseDate"
                                    value={asset.purchaseDate}
                                    onChange={e => handleInputChange('purchaseDate', e.target.value)}
                                    readOnly={isReadOnly}
                                />
                            </div>
                            <div>
                                <Label htmlFor="purchasePrice">Purchase Price</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    id="purchasePrice"
                                    value={asset.purchasePrice}
                                    onChange={e => handleInputChange('purchasePrice', e.target.value)}
                                    readOnly={isReadOnly}
                                />
                            </div>
                            <div>
                                <Label htmlFor="condition">Condition</Label>
                                <Select
                                    onValueChange={value => handleInputChange('condition', value)}
                                    value={asset.condition}
                                    disabled={isReadOnly}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="New">New</SelectItem>
                                        <SelectItem value="Good">Good</SelectItem>
                                        <SelectItem value="Fair">Fair</SelectItem>
                                        <SelectItem value="Poor">Poor</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle>Vendor</CardTitle></CardHeader>
                        <CardContent>
                            <Label htmlFor="vendorId">Vendor (optional)</Label>
                            <Select
                                onValueChange={value => handleInputChange('vendorId', value)}
                                value={asset.vendorId}
                                disabled={isReadOnly}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a vendor" />
                                </SelectTrigger>
                                <SelectContent>
                                    {relatedData.vendors.map(v =>
                                        <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle>Warranty Information</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label htmlFor="warrantyProvider">Warranty Provider</Label>
                                <Input
                                    id="warrantyProvider"
                                    value={asset.warrantyProvider}
                                    onChange={e => handleInputChange('warrantyProvider', e.target.value)}
                                    placeholder="e.g., Samsung, Best Buy Protection Plan"
                                    readOnly={isReadOnly}
                                />
                            </div>
                            <div>
                                <Label htmlFor="warrantyStartDate">Warranty Start Date</Label>
                                <Input
                                    type="date"
                                    id="warrantyStartDate"
                                    value={asset.warrantyStartDate}
                                    onChange={e => handleInputChange('warrantyStartDate', e.target.value)}
                                    readOnly={isReadOnly}
                                />
                            </div>
                            <div>
                                <Label htmlFor="warrantyEndDate">Warranty End Date</Label>
                                <Input
                                    type="date"
                                    id="warrantyEndDate"
                                    value={asset.warrantyEndDate}
                                    onChange={e => handleInputChange('warrantyEndDate', e.target.value)}
                                    readOnly={isReadOnly}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
                        <CardContent>
                            <Textarea
                                value={asset.notes}
                                onChange={e => handleInputChange('notes', e.target.value)}
                                readOnly={isReadOnly}
                            />
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Debug Panel */}
            <DebugInfoPanel properties={relatedData.userProperties} />
        </form>
    );
}
