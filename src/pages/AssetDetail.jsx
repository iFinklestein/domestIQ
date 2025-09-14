
import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { User } from '@/api/entities';
import { Asset } from '@/api/entities';
import { Property } from '@/api/entities';
import { Tenancy } from '@/api/entities';
import { Category } from '@/api/entities';
import { Location as AssetLocation } from '@/api/entities';
import { Vendor } from '@/api/entities';
import { Warranty } from '@/api/entities';
import { migrateUserRole, canReadAsset, canWriteAsset } from '@/components/roles';
import { getPropertiesForCurrentUser } from '@/components/propertiesService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Edit, MapPin, Calendar, DollarSign, Package, Settings, AlertCircle, Clock, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import { useToast } from "@/components/ui/use-toast";
import { getWarrantyStatus, WarrantyBadge } from '../components/warrantyUtils';
import ReminderManager from '../components/reminders/ReminderManager';
import PhotoGallery from '../components/assets/PhotoGallery';
import DocumentManager from '../components/assets/DocumentManager';

export default function AssetDetailPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const urlParams = new URLSearchParams(location.search);
    const assetId = urlParams.get('id');
    const { toast } = useToast();

    const [asset, setAsset] = useState(null);
    const [relatedData, setRelatedData] = useState({
        property: null,
        tenancy: null,
        category: null,
        location: null,
        vendor: null,
        warranty: null
    });
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState(null);
    const [userProperties, setUserProperties] = useState([]);
    const [userTenancies, setUserTenancies] = useState([]);

    const fetchAssetData = useCallback(async (user) => {
        if (!assetId) {
            navigate(createPageUrl('Assets'));
            return;
        }

        setLoading(true);
        try {
            // Get asset data
            const assetData = await Asset.get(assetId);
            
            // Get user context for permission checking
            const properties = await getPropertiesForCurrentUser(user);
            let tenancies = [];
            
            if (user.app_role === 'Tenant') {
                tenancies = await Tenancy.filter({ 
                    tenant_user_id: user.id, 
                    status: 'active' 
                });
            }

            setUserProperties(properties);
            setUserTenancies(tenancies);

            // Check read permission
            if (!canReadAsset(user, assetData, properties, tenancies)) {
                toast({ 
                    variant: "destructive", 
                    title: "Access Denied", 
                    description: "You don't have permission to view this asset." 
                });
                navigate(createPageUrl('Assets'));
                return;
            }

            setAsset(assetData);

            // Get related data
            const [property, category, location, vendor, warranty, tenancy] = await Promise.all([
                assetData.propertyId ? Property.get(assetData.propertyId).catch(() => null) : null,
                assetData.categoryId ? Category.get(assetData.categoryId).catch(() => null) : null,
                assetData.locationId ? AssetLocation.get(assetData.locationId).catch(() => null) : null,
                assetData.vendorId ? Vendor.get(assetData.vendorId).catch(() => null) : null,
                assetData.warrantyId ? Warranty.get(assetData.warrantyId).catch(() => null) : null,
                assetData.tenancyId ? Tenancy.get(assetData.tenancyId).catch(() => null) : null
            ]);

            setRelatedData({ property, category, location, vendor, warranty, tenancy });
        } catch (error) {
            console.error("Failed to fetch asset:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not load asset details." });
            navigate(createPageUrl('Assets'));
        } finally {
            setLoading(false);
        }
    }, [assetId, navigate, toast]);

    useEffect(() => {
        async function fetchUserAndData() {
            try {
                const user = await User.me();
                const migratedUser = await migrateUserRole(user);
                setCurrentUser(migratedUser);
                if (migratedUser) {
                    await fetchAssetData(migratedUser);
                }
            } catch (e) {
                console.warn("User not logged in or session expired.");
                navigate(createPageUrl('Dashboard'));
            }
        }
        fetchUserAndData();
    }, [fetchAssetData, navigate]);

    const handleAssetUpdate = (updatedAsset) => {
        setAsset(updatedAsset);
    };

    const canEdit = currentUser && asset ? canWriteAsset(currentUser, asset, userProperties, userTenancies) : false;
    const warrantyStatus = asset ? getWarrantyStatus(asset) : null;

    const getOwnershipBadge = () => {
        if (!asset) return null;
        if (asset.ownerType === 'rental') {
            return <Badge variant="outline" className="text-blue-600 border-blue-200">Rental-owned</Badge>;
        } else {
            return <Badge variant="secondary" className="text-green-600 border-green-200">My asset</Badge>;
        }
    };

    const DetailItem = ({ icon: Icon, label, value, color = "text-muted-foreground" }) => (
        <div className="flex items-center gap-3">
            <Icon className={`w-4 h-4 ${color}`} />
            <div>
                <p className="text-sm font-medium text-muted-foreground">{label}</p>
                <p className="font-medium">{value || '—'}</p>
            </div>
        </div>
    );

    if (loading) return <div>Loading asset details...</div>;
    if (!asset) return <div>Asset not found.</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <Button variant="outline" onClick={() => navigate(createPageUrl('Assets'))}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Assets
                </Button>
                <div className="flex items-center gap-2">
                    {getOwnershipBadge()}
                    <WarrantyBadge asset={asset} />
                    {canEdit && (
                        <Link to={createPageUrl(`AssetForm?id=${asset.id}`)}>
                            <Button>
                                <Edit className="mr-2 h-4 w-4" /> Edit Asset
                            </Button>
                        </Link>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-2xl">{asset.name}</CardTitle>
                            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                                {asset.model && <span>Model: {asset.model}</span>}
                                {asset.serialNumber && <span>Serial: {asset.serialNumber}</span>}
                                <span>Condition: {asset.condition}</span>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <DetailItem 
                                    icon={MapPin} 
                                    label="Property" 
                                    value={relatedData.property?.name}
                                />
                                <DetailItem 
                                    icon={MapPin} 
                                    label="Location" 
                                    value={relatedData.location?.name}
                                />
                                <DetailItem 
                                    icon={Calendar} 
                                    label="Purchase Date" 
                                    value={asset.purchaseDate ? format(new Date(asset.purchaseDate), 'MMM d, yyyy') : null}
                                />
                                <DetailItem 
                                    icon={DollarSign} 
                                    label="Purchase Price" 
                                    value={asset.purchasePrice ? `$${asset.purchasePrice.toLocaleString()}` : null}
                                    color="text-green-600"
                                />
                                <DetailItem 
                                    icon={Package} 
                                    label="Category" 
                                    value={relatedData.category?.name}
                                />
                                <DetailItem 
                                    icon={Settings} 
                                    label="Vendor" 
                                    value={relatedData.vendor?.name}
                                />
                            </div>

                            {asset.locationDescription && (
                                <>
                                    <Separator />
                                    <div>
                                        <h4 className="font-medium mb-2">Specific Location</h4>
                                        <p className="text-muted-foreground">{asset.locationDescription}</p>
                                    </div>
                                </>
                            )}

                            {asset.notes && (
                                <>
                                    <Separator />
                                    <div>
                                        <h4 className="font-medium mb-2">Notes</h4>
                                        <p className="text-muted-foreground whitespace-pre-wrap">{asset.notes}</p>
                                    </div>
                                </>
                            )}

                            {asset.tags && asset.tags.length > 0 && (
                                <>
                                    <Separator />
                                    <div>
                                        <h4 className="font-medium mb-2">Tags</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {asset.tags.map((tag, index) => (
                                                <Badge key={index} variant="outline">{tag}</Badge>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    <Tabs defaultValue="photos" className="w-full">
                        <TabsList>
                            <TabsTrigger value="photos" className="flex items-center gap-2">
                                <Package className="w-4 h-4" />
                                Photos
                            </TabsTrigger>
                            <TabsTrigger value="documents" className="flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                Documents
                            </TabsTrigger>
                            <TabsTrigger value="reminders" className="flex items-center gap-2">
                                <Clock className="w-4 h-4" />
                                Maintenance Reminders
                            </TabsTrigger>
                            <TabsTrigger value="history" className="flex items-center gap-2">
                                <Calendar className="w-4 h-4" />
                                History
                            </TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="photos" className="mt-4">
                            <PhotoGallery asset={asset} canEdit={canEdit} onUpdate={handleAssetUpdate} />
                        </TabsContent>
                        
                        <TabsContent value="documents" className="mt-4">
                            <DocumentManager asset={asset} canEdit={canEdit} onUpdate={handleAssetUpdate} />
                        </TabsContent>

                        <TabsContent value="reminders" className="mt-4">
                            <ReminderManager asset={asset} canEdit={canEdit} />
                        </TabsContent>
                        
                        <TabsContent value="history" className="mt-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Asset History</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-center py-6">
                                        <Calendar className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
                                        <p className="text-muted-foreground">Asset history tracking will be available in a future update.</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>

                <div className="space-y-6">
                    {(asset.warrantyProvider || asset.warrantyEndDate) && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <AlertCircle className="w-5 h-5" />
                                    Warranty Information
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {asset.warrantyProvider && (
                                    <DetailItem 
                                        icon={Settings} 
                                        label="Provider" 
                                        value={asset.warrantyProvider}
                                    />
                                )}
                                {asset.warrantyStartDate && (
                                    <DetailItem 
                                        icon={Calendar} 
                                        label="Start Date" 
                                        value={format(new Date(asset.warrantyStartDate), 'MMM d, yyyy')}
                                    />
                                )}
                                {asset.warrantyEndDate && (
                                    <DetailItem 
                                        icon={Calendar} 
                                        label="End Date" 
                                        value={asset.warrantyEndDate ? format(new Date(asset.warrantyEndDate), 'MMM d, yyyy') : null}
                                        color={warrantyStatus?.status === 'expired' ? 'text-red-600' : 
                                              warrantyStatus?.isExpiring ? 'text-orange-600' : 'text-muted-foreground'}
                                    />
                                )}
                                {warrantyStatus && warrantyStatus.status !== 'none' && (
                                    <div className="mt-2">
                                        <WarrantyBadge asset={asset} />
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    <Card>
                        <CardHeader>
                            <CardTitle>Quick Actions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <Link 
                                to={createPageUrl(`MaintenanceRequestForm?assetId=${asset.id}&unitId=${relatedData.tenancy?.unit_id || ''}`)} 
                                className="block"
                            >
                                <Button className="w-full justify-start" variant="outline">
                                    <AlertCircle className="mr-2 h-4 w-4" />
                                    Request Maintenance
                                </Button>
                            </Link>
                            {canEdit && (
                                <Link to={createPageUrl(`AssetForm?id=${asset.id}`)} className="block">
                                    <Button className="w-full justify-start" variant="outline">
                                        <Edit className="mr-2 h-4 w-4" />
                                        Edit Details
                                    </Button>
                                </Link>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Asset Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <DetailItem 
                                icon={Calendar} 
                                label="Created" 
                                value={format(new Date(asset.created_date), 'MMM d, yyyy')}
                            />
                            <DetailItem 
                                icon={Calendar} 
                                label="Last Updated" 
                                value={format(new Date(asset.updated_date), 'MMM d, yyyy')}
                            />
                            <DetailItem 
                                icon={Settings} 
                                label="Asset ID" 
                                value={asset.id.slice(0, 8) + '...'}
                            />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
