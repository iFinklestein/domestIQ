
import React, { useState, useEffect, useCallback } from 'react';
import { User } from '@/api/entities';
import { MaintenanceRequest } from '@/api/entities';
import { Property } from '@/api/entities';
import { Unit } from '@/api/entities';
import { Asset } from '@/api/entities';
import { Vendor } from '@/api/entities'; // Added Vendor import
import { migrateUserRole, isAdmin, isLandlordOrPM, isTenant } from '@/components/roles';
import { getPropertiesForCurrentUser } from '@/components/propertiesService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, MoreHorizontal, Eye, Edit, AlertCircle, Clock, CheckCircle, XCircle, Wrench } from 'lucide-react'; // Added Wrench import
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import { useToast } from "@/components/ui/use-toast";
import { logAuditEvent, extractPropertyId } from '../components/auditLog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'; // Added Tooltip imports


export default function MaintenanceRequestsPage() {
    const [requests, setRequests] = useState([]);
    const [properties, setProperties] = useState([]);
    const [units, setUnits] = useState([]);
    const [assets, setAssets] = useState([]);
    const [vendors, setVendors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ status: 'all', property: 'all', priority: 'all' });
    const [currentUser, setCurrentUser] = useState(null);
    const { toast } = useToast();

    const fetchData = useCallback(async (user) => {
        setLoading(true);
        try {
            // Get user's properties
            const userProperties = await getPropertiesForCurrentUser(user);
            setProperties(userProperties);
            const propertyIds = userProperties.map(p => p.id);

            if (propertyIds.length === 0) {
                setRequests([]);
                setVendors([]);
                setLoading(false);
                return;
            }

            // Get maintenance requests based on role
            let maintenanceRequests;
            if (isTenant(user)) {
                // Tenants see only their own requests
                maintenanceRequests = await MaintenanceRequest.filter({ 
                    created_by_user_id: user.id,
                    property_id: propertyIds 
                });
            } else {
                // Landlords/PMs see all requests for their properties
                maintenanceRequests = await MaintenanceRequest.filter({ 
                    property_id: propertyIds 
                });
            }

            // Get related data
            const [unitsData, assetsData, vendorsData] = await Promise.all([
                propertyIds.length > 0 ? Unit.filter({ property_id: propertyIds }) : Promise.resolve([]),
                propertyIds.length > 0 ? Asset.filter({ propertyId: propertyIds }) : Promise.resolve([]),
                isAdmin(user) ? Vendor.list() : Vendor.filter({ created_by: user.email })
            ]);

            setRequests(maintenanceRequests.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
            setUnits(unitsData);
            setAssets(assetsData);
            setVendors(vendorsData);

        } catch (error) {
            console.error("Failed to fetch maintenance requests:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not load maintenance requests." });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        async function fetchUserAndData() {
            try {
                const user = await User.me();
                const migratedUser = await migrateUserRole(user);
                setCurrentUser(migratedUser);
                if (migratedUser) {
                    await fetchData(migratedUser);
                }
            } catch (e) {
                console.warn("User not logged in or session expired.");
                setLoading(false);
            }
        }
        fetchUserAndData();
    }, [fetchData]);

    const handleStatusChange = async (requestId, newStatus) => {
        try {
            const request = requests.find(r => r.id === requestId);
            if (!request) return;

            const updateData = { 
                ...request, 
                status: newStatus,
                scheduled_date: newStatus === 'scheduled' ? new Date().toISOString().split('T')[0] : request.scheduled_date
            };
            
            await MaintenanceRequest.update(requestId, updateData);
            
            // Log audit event
            await logAuditEvent({
                entityType: 'MaintenanceRequest',
                entityId: requestId,
                action: 'update',
                user: currentUser,
                propertyId: extractPropertyId('MaintenanceRequest', request),
                details: { title: request.title, statusChange: `${request.status} → ${newStatus}` }
            });
            
            toast({ title: "Success", description: `Request status updated to ${newStatus}.` });
            fetchData(currentUser); // Re-fetch to ensure UI is up-to-date
        } catch (error) {
            console.error("Failed to update status:", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to update request status." });
        }
    };

    const handleVendorChange = async (requestId, newVendorId) => {
        try {
            const request = requests.find(r => r.id === requestId);
            if (!request) return;

            const updatedVendorId = newVendorId === 'null' ? null : newVendorId; // Handle 'No Vendor' option
            const updateData = { 
                ...request, 
                vendor_id: updatedVendorId,
            };
            
            await MaintenanceRequest.update(requestId, updateData);
            
            // Log audit event
            const oldVendorName = vendors.find(v => v.id === request.vendor_id)?.name || 'None';
            const newVendorName = vendors.find(v => v.id === updatedVendorId)?.name || 'None';

            await logAuditEvent({
                entityType: 'MaintenanceRequest',
                entityId: requestId,
                action: 'update',
                user: currentUser,
                propertyId: extractPropertyId('MaintenanceRequest', request),
                details: { title: request.title, vendorChange: `${oldVendorName} → ${newVendorName}` }
            });
            
            toast({ title: "Success", description: `Request vendor updated to ${newVendorName}.` });
            fetchData(currentUser); // Re-fetch to ensure UI is up-to-date
        } catch (error) {
            console.error("Failed to update vendor:", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to update request vendor." });
        }
    };

    const filteredRequests = requests.filter(request => {
        if (filters.status !== 'all' && request.status !== filters.status) return false;
        if (filters.property !== 'all' && request.property_id !== filters.property) return false;
        if (filters.priority !== 'all' && request.priority !== filters.priority) return false;
        return true;
    });

    // These utility functions are still useful to determine display names
    const getPropertyName = (propertyId) => properties.find(p => p.id === propertyId)?.name || 'Unknown';
    const getUnitName = (unitId) => units.find(u => u.id === unitId)?.name || '';
    const getAssetName = (assetId) => assets.find(a => a.id === assetId)?.name || '';
    const getVendorName = (vendorId) => vendors.find(v => v.id === vendorId)?.name || '—'; // Still used for display if select is not shown


    const RequestsTable = ({ data }) => (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Property</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead><span className="sr-only">Actions</span></TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {loading ? (
                    <TableRow>
                        <TableCell colSpan="7" className="text-center py-12">Loading...</TableCell>
                    </TableRow>
                ) : data.length > 0 ? (
                    data.map(request => {
                        const property = properties.find(p => p.id === request.property_id);
                        const vendor = vendors.find(v => v.id === request.vendor_id);
                        
                        // Permissions logic
                        const canEditRequest = isAdmin(currentUser) || 
                                             isLandlordOrPM(currentUser) || 
                                             (isTenant(currentUser) && request.created_by_user_id === currentUser.id);
                        const canManageStatus = isAdmin(currentUser) || isLandlordOrPM(currentUser);
                        const canAssignVendor = isAdmin(currentUser) || isLandlordOrPM(currentUser);
                        
                        return (
                            <TableRow key={request.id}>
                                <TableCell className="font-medium">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            {request.title}
                                            {isTenant(currentUser) && request.created_by_user_id === currentUser.id && (
                                                <Badge variant="outline" className="text-xs">My Request</Badge>
                                            )}
                                        </div>
                                        {request.unit_id && ( // Display unit only if asset is not present or if relevant
                                            <div className="text-xs text-muted-foreground mt-1">
                                                Unit: {getUnitName(request.unit_id) || 'Unknown'}
                                            </div>
                                        )}
                                        {request.asset_id && (
                                            <div className="text-xs text-muted-foreground mt-1">
                                                Asset: {getAssetName(request.asset_id) || 'Unknown'}
                                            </div>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell>{property?.name || 'Unknown'}</TableCell>
                                <TableCell>
                                    <Badge variant={
                                        request.priority === 'urgent' ? 'destructive' :
                                        request.priority === 'high' ? 'default' :
                                        request.priority === 'medium' ? 'secondary' : 'outline'
                                    }>
                                        {request.priority.charAt(0).toUpperCase() + request.priority.slice(1)}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    {canManageStatus ? (
                                        <Select value={request.status} onValueChange={(value) => handleStatusChange(request.id, value)}>
                                            <SelectTrigger className="w-32">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="open">Open</SelectItem>
                                                <SelectItem value="scheduled">Scheduled</SelectItem>
                                                <SelectItem value="done">Done</SelectItem>
                                                <SelectItem value="rejected">Rejected</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <Badge variant={
                                            request.status === 'done' ? 'default' :
                                            request.status === 'scheduled' ? 'secondary' :
                                            request.status === 'rejected' ? 'destructive' : 'outline'
                                        }>
                                            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                                        </Badge>
                                    )}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                    {format(new Date(request.created_date), 'MMM d, yyyy')}
                                </TableCell>
                                <TableCell>
                                    {canAssignVendor ? (
                                        <Select value={request.vendor_id || 'null'} onValueChange={(value) => handleVendorChange(request.id, value)}>
                                            <SelectTrigger className="w-32">
                                                <SelectValue placeholder="Assign..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="null">No Vendor</SelectItem>
                                                {vendors.map(vendor => (
                                                    <SelectItem key={vendor.id} value={vendor.id}>
                                                        {vendor.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <span className="text-sm text-muted-foreground">
                                            {vendor?.name || '—'}
                                        </span>
                                    )}
                                </TableCell>
                                <TableCell className="text-right">
                                    <TooltipProvider>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button size="icon" variant="ghost">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <Link to={createPageUrl(`MaintenanceRequestDetail?id=${request.id}`)}>
                                                    <DropdownMenuItem className="cursor-pointer">
                                                        <Eye className="mr-2 h-4 w-4"/>View Details
                                                    </DropdownMenuItem>
                                                </Link>
                                                
                                                {canEditRequest ? (
                                                    <Link to={createPageUrl(`MaintenanceRequestForm?id=${request.id}`)}>
                                                        <DropdownMenuItem className="cursor-pointer">
                                                            <Edit className="mr-2 h-4 w-4"/>Edit
                                                        </DropdownMenuItem>
                                                    </Link>
                                                ) : (
                                                    <Tooltip delayDuration={300}>
                                                        <TooltipTrigger asChild>
                                                            <DropdownMenuItem disabled>
                                                                <Edit className="mr-2 h-4 w-4 opacity-50"/>Edit
                                                            </DropdownMenuItem>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p>You can only edit your own requests or if you are an admin/PM.</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TooltipProvider>
                                </TableCell>
                            </TableRow>
                        );
                    })
                ) : (
                    <TableRow>
                        <TableCell colSpan="7" className="text-center py-12">
                            <div className="flex flex-col items-center gap-2">
                                <Wrench className="w-12 h-12 text-muted-foreground" />
                                <p className="text-muted-foreground">No maintenance requests found.</p>
                                <Link to={createPageUrl('MaintenanceRequestForm')}>
                                    <Button className="mt-2">
                                        <Plus className="mr-2 h-4 w-4" /> Create Request
                                    </Button>
                                </Link>
                            </div>
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
        </Table>
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-3xl font-bold tracking-tight">Maintenance Requests</h1>
                <Link to={createPageUrl('MaintenanceRequestForm')}>
                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        New Request
                    </Button>
                </Link>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4">
                <Select value={filters.status} onValueChange={v => setFilters({...filters, status: v})}>
                    <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="done">Done</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                </Select>

                {properties.length > 1 && (
                    <Select value={filters.property} onValueChange={v => setFilters({...filters, property: v})}>
                        <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="All Properties" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Properties</SelectItem>
                            {properties.map(p => (
                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}

                <Select value={filters.priority} onValueChange={v => setFilters({...filters, priority: v})}>
                    <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="All Priority" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Priority</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <Card>
                <CardContent className="p-0">
                    <RequestsTable data={filteredRequests} />
                </CardContent>
            </Card>
        </div>
    );
}
