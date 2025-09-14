
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { User } from '@/api/entities';
import { MaintenanceRequest } from '@/api/entities';
import { Property } from '@/api/entities';
import { Unit } from '@/api/entities';
import { Asset } from '@/api/entities';
import { Tenancy } from '@/api/entities';
import { Vendor } from '@/api/entities';
import { migrateUserRole, isTenant, isAdmin, isLandlordOrPM } from '@/components/roles';
import { getPropertiesForCurrentUser } from '@/components/propertiesService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Save, Loader2, Upload } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { useToast } from "@/components/ui/use-toast";
import { logAuditEvent, extractPropertyId } from '../components/auditLog';

export default function MaintenanceRequestForm() {
    const navigate = useNavigate();
    const location = useLocation();
    const urlParams = new URLSearchParams(location.search);
    const requestId = urlParams.get('id');
    const prefilledAssetId = urlParams.get('assetId');
    const prefilledUnitId = urlParams.get('unitId');
    const { toast } = useToast();

    const [request, setRequest] = useState({
        title: '',
        description: '',
        priority: 'medium',
        property_id: '',
        unit_id: '',
        asset_id: '',
        vendor_id: '',
        photos: []
    });
    
    const [relatedData, setRelatedData] = useState({
        properties: [],
        units: [],
        assets: [],
        vendors: []
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

                // Get user's properties
                const userProperties = await getPropertiesForCurrentUser(migratedUser);
                
                if (userProperties.length === 0) {
                    toast({ 
                        variant: "destructive", 
                        title: "No Properties", 
                        description: "You don't have access to any properties." 
                    });
                    navigate(createPageUrl('Dashboard'));
                    return;
                }

                const propertyIds = userProperties.map(p => p.id);
                
                // Get units, assets, and vendors for these properties/user
                const [unitsData, assetsData, vendorsData] = await Promise.all([
                    Unit.filter({ property_id: propertyIds }),
                    Asset.filter({ propertyId: propertyIds }),
                    // Fetch vendors based on user role
                    isAdmin(migratedUser) ? Vendor.list() : Vendor.filter({ created_by: migratedUser.email })
                ]);

                setRelatedData({
                    properties: userProperties,
                    units: unitsData,
                    assets: assetsData,
                    vendors: vendorsData
                });

                // If editing existing request
                if (requestId) {
                    const existingRequest = await MaintenanceRequest.get(requestId);
                    setRequest({
                        ...existingRequest,
                        photos: existingRequest.photos || [],
                        vendor_id: existingRequest.vendor_id || ''
                    });
                } else {
                    // Handle prefilled data from URL params
                    const defaultProperty = userProperties.length === 1 ? userProperties[0].id : '';
                    setRequest(prev => ({
                        ...prev,
                        property_id: defaultProperty,
                        asset_id: prefilledAssetId || '',
                        unit_id: prefilledUnitId || ''
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
    }, [requestId, prefilledAssetId, prefilledUnitId, toast, navigate]);

    const handleInputChange = (field, value) => {
        setRequest(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);

        try {
            // Validation
            if (!request.title.trim()) {
                toast({ variant: "destructive", title: "Validation Error", description: "Title is required." });
                return;
            }

            if (!request.description.trim()) {
                toast({ variant: "destructive", title: "Validation Error", description: "Description is required." });
                return;
            }

            if (!request.property_id) {
                toast({ variant: "destructive", title: "Validation Error", description: "Property is required." });
                return;
            }

            const dataToSave = {
                ...request,
                created_by_user_id: currentUser.id,
                vendor_id: request.vendor_id === '' ? null : request.vendor_id
            };

            let savedRequest;
            if (requestId) {
                savedRequest = await MaintenanceRequest.update(requestId, dataToSave);
                
                // Log audit event for update
                await logAuditEvent({
                    entityType: 'MaintenanceRequest',
                    entityId: requestId,
                    action: 'update',
                    user: currentUser,
                    propertyId: extractPropertyId('MaintenanceRequest', dataToSave),
                    details: { title: dataToSave.title }
                });
                
                toast({ title: "Success", description: "Maintenance request updated." });
            } else {
                savedRequest = await MaintenanceRequest.create(dataToSave);
                
                // Log audit event for create
                await logAuditEvent({
                    entityType: 'MaintenanceRequest',
                    entityId: savedRequest.id || 'new', // Use savedRequest.id after creation
                    action: 'create',
                    user: currentUser,
                    propertyId: extractPropertyId('MaintenanceRequest', dataToSave),
                    details: { title: dataToSave.title }
                });
                
                toast({ title: "Success", description: "Maintenance request submitted." });
            }
            
            navigate(createPageUrl('MaintenanceRequests'));
        } catch (error) {
            console.error("Failed to save request:", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to save maintenance request." });
        } finally {
            setIsSaving(false);
        }
    };

    const filteredUnits = relatedData.units.filter(u => u.property_id === request.property_id);
    const filteredAssets = relatedData.assets.filter(a => a.propertyId === request.property_id);
    const filteredVendors = relatedData.vendors; // All accessible vendors

    if (loading) return <div>Loading form...</div>;

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex items-center justify-between">
                <Button type="button" variant="outline" onClick={() => navigate(createPageUrl('MaintenanceRequests'))}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Requests
                </Button>
                <h1 className="text-3xl font-bold">{requestId ? 'Edit Request' : 'New Maintenance Request'}</h1>
                <Button type="submit" disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {requestId ? 'Update' : 'Submit'} Request
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Request Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label htmlFor="title">Title*</Label>
                                <Input
                                    id="title"
                                    value={request.title}
                                    onChange={e => handleInputChange('title', e.target.value)}
                                    placeholder="Brief description of the issue"
                                    required
                                />
                            </div>

                            <div>
                                <Label htmlFor="description">Description*</Label>
                                <Textarea
                                    id="description"
                                    value={request.description}
                                    onChange={e => handleInputChange('description', e.target.value)}
                                    placeholder="Detailed description of the maintenance issue..."
                                    className="h-32"
                                    required
                                />
                            </div>

                            <div>
                                <Label htmlFor="priority">Priority</Label>
                                <Select value={request.priority} onValueChange={value => handleInputChange('priority', value)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="low">Low</SelectItem>
                                        <SelectItem value="medium">Medium</SelectItem>
                                        <SelectItem value="high">High</SelectItem>
                                        <SelectItem value="urgent">Urgent</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>
                    {(isAdmin(currentUser) || isLandlordOrPM(currentUser)) && (
                        <Card>
                            <CardHeader><CardTitle>Assignment</CardTitle></CardHeader>
                            <CardContent>
                                <div>
                                    <Label htmlFor="vendor_id">Assign Vendor (Optional)</Label>
                                    <Select 
                                        value={request.vendor_id || ''} 
                                        onValueChange={value => handleInputChange('vendor_id', value === '' ? null : value)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a vendor" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={null}>No specific vendor</SelectItem>
                                            {filteredVendors.map(v => (
                                                <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Location</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label htmlFor="property_id">Property*</Label>
                                <Select 
                                    value={request.property_id} 
                                    onValueChange={value => {
                                        handleInputChange('property_id', value);
                                        // Clear unit and asset when property changes
                                        handleInputChange('unit_id', '');
                                        handleInputChange('asset_id', '');
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select property" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {relatedData.properties.map(p => (
                                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {filteredUnits.length > 0 && (
                                <div>
                                    <Label htmlFor="unit_id">Unit (Optional)</Label>
                                    <Select 
                                        value={request.unit_id || ''} 
                                        onValueChange={value => handleInputChange('unit_id', value === '' ? null : value)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select unit" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={null}>No specific unit</SelectItem>
                                            {filteredUnits.map(u => (
                                                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {filteredAssets.length > 0 && (
                                <div>
                                    <Label htmlFor="asset_id">Related Asset (Optional)</Label>
                                    <Select 
                                        value={request.asset_id || ''} 
                                        onValueChange={value => handleInputChange('asset_id', value === '' ? null : value)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select asset" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={null}>No specific asset</SelectItem>
                                            {filteredAssets.map(a => (
                                                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Photos</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
                                <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                                <p className="text-sm text-muted-foreground">
                                    Photo upload will be available in a future update.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </form>
    );
}
