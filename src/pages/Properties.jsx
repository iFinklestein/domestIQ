
import React, { useState, useEffect, useCallback } from 'react';
import { User } from '@/api/entities';
import { Property } from '@/api/entities';
import { Tenancy } from '@/api/entities';
import { Asset } from '@/api/entities';
import { Unit } from '@/api/entities';
import { canManageProperties, migrateUserRole, isAdmin, isLandlord, isPropertyManager } from '@/components/roles';
import { getPropertiesForCurrentUser, restoreArchivedProperties } from '@/components/propertiesService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Plus, MoreHorizontal, Edit, Eye, Building2, Trash2, AlertTriangle, RefreshCw, Undo2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useToast } from "@/components/ui/use-toast";
import { logAuditEvent, extractPropertyId } from '../components/auditLog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function PropertiesPage() {
    const [activeProperties, setActiveProperties] = useState([]);
    const [archivedProperties, setArchivedProperties] = useState([]);
    const [propertyUnits, setPropertyUnits] = useState({});
    const [propertyTenancies, setPropertyTenancies] = useState({});
    const [loading, setLoading] = useState(true);
    // Removed: const [open, setOpen] = useState(false);
    // Removed: const [currentProperty, setCurrentProperty] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [archiveDialog, setArchiveDialog] = useState({ open: false, property: null, dependencies: null });
    const [confirmationText, setConfirmationText] = useState('');
    const [activeTab, setActiveTab] = useState('active');
    const { toast } = useToast();

    const fetchProperties = useCallback(async (user) => {
        if (!user || !canManageProperties(user)) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const allUserProperties = await Property.filter({ owner_user_id: user.id });
            const propertyIds = allUserProperties.map(p => p.id);

            let allUnits = [];
            let allTenancies = [];
            if (propertyIds.length > 0) {
                allUnits = await Unit.filter({ property_id: propertyIds });
                const unitIds = allUnits.map(u => u.id);
                if (unitIds.length > 0) {
                    allTenancies = await Tenancy.filter({ unit_id: unitIds });
                }
            }

            const active = allUserProperties.filter(p => p.status !== 'archived');
            const archived = allUserProperties.filter(p => p.status === 'archived');
            
            setActiveProperties(active);
            setArchivedProperties(archived);

            const unitsByPropertyMap = {};
            allUnits.forEach(unit => {
                if (!unitsByPropertyMap[unit.property_id]) {
                    unitsByPropertyMap[unit.property_id] = [];
                }
                unitsByPropertyMap[unit.property_id].push(unit);
            });
            setPropertyUnits(unitsByPropertyMap);

            const activeTenanciesByPropertyMap = {};
            // Initialize for all properties to ensure they appear in the map even if no tenancies/units
            allUserProperties.forEach(prop => {
                activeTenanciesByPropertyMap[prop.id] = [];
            });

            allTenancies.filter(t => t.status === 'active').forEach(tenancy => {
                const unit = allUnits.find(u => u.id === tenancy.unit_id);
                if (unit) {
                    if (activeTenanciesByPropertyMap[unit.property_id]) {
                        activeTenanciesByPropertyMap[unit.property_id].push(tenancy);
                    }
                }
            });
            setPropertyTenancies(activeTenanciesByPropertyMap);

        } catch (error) {
            console.error("Failed to fetch properties:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not load properties." });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        async function fetchAndMigrateUser() {
            try {
                const user = await User.me();
                const migratedUser = await migrateUserRole(user);
                setCurrentUser(migratedUser);
                fetchProperties(migratedUser);
            } catch (e) {
                console.warn("User not logged in or session expired.");
                setLoading(false);
            }
        }
        fetchAndMigrateUser();
    }, [fetchProperties]);

    const handleRestore = async () => {
        if (!currentUser) return;
        
        try {
            const result = await restoreArchivedProperties(currentUser);
            if (result.restored > 0) {
                toast({ 
                    title: "Properties Restored", 
                    description: `${result.restored} archived properties have been restored.` 
                });
                fetchProperties(currentUser);
            } else if (result.total === 0) {
                toast({ 
                    title: "No Archived Properties", 
                    description: "No archived properties found to restore." 
                });
            } else {
                toast({ 
                    variant: "destructive", 
                    title: "Restore Failed", 
                    description: `Could not restore ${result.errors.length} properties.` 
                });
            }
        } catch (error) {
            console.error("Failed to restore properties:", error);
            toast({ 
                variant: "destructive", 
                title: "Error", 
                description: "Failed to restore archived properties." 
            });
        }
    };

    // Removed: handleSave function

    const handleArchiveClick = async (property) => {
        setConfirmationText(''); // Reset confirmation text
        setArchiveDialog({ open: true, property, dependencies: 'loading' });
        try {
            const units = await Unit.filter({ property_id: property.id });
            const unitIds = units.map(u => u.id);
            let tenancies = [];
            if (unitIds.length > 0) {
                tenancies = await Tenancy.filter({ unit_id: unitIds, status: 'active' });
            }

            const [assets] = await Promise.all([
                Asset.filter({ property_id: property.id }),
            ]);
            setArchiveDialog({ open: true, property, dependencies: { assets: assets.length, tenancies: tenancies.length, units: units.length } });
        } catch (error) {
            console.error("Error checking dependencies:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not check for dependencies." });
            setArchiveDialog({ open: false, property: null, dependencies: null });
        }
    };

    const handleArchiveConfirm = async () => {
        if (!archiveDialog.property) return;

        console.log({
            action: 'archive-attempt',
            userId: currentUser?.id,
            propertyId: archiveDialog.property.id,
            dependencyCounts: archiveDialog.dependencies
        });

        try {
            const originalProperty = { ...archiveDialog.property };
            await Property.update(archiveDialog.property.id, { status: 'archived' });
            
            // Log audit event
            await logAuditEvent({
                entityType: 'Property',
                entityId: originalProperty.id,
                action: 'archive',
                user: currentUser,
                propertyId: originalProperty.id,
                details: { name: originalProperty.name }
            });
            
            setArchiveDialog({ open: false, property: null, dependencies: null });
            setConfirmationText('');
            fetchProperties(currentUser);
            toast({
                title: "Property Archived",
                description: `"${originalProperty.name}" has been archived.`,
                action: (
                    <Button variant="secondary" size="sm" onClick={() => handleUndoArchive(originalProperty.id)}>
                        Undo
                    </Button>
                ),
            });
        } catch (error) {
            console.error("Failed to archive property:", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to archive property." });
        }
    };

    const handleUndoArchive = async (propertyId) => {
        try {
            await Property.update(propertyId, { status: 'active' });
            
            // Log audit event
            await logAuditEvent({
                entityType: 'Property',
                entityId: propertyId,
                action: 'restore',
                user: currentUser,
                propertyId: propertyId,
                details: { source: 'undo_archive' }
            });
            
            fetchProperties(currentUser);
            toast({ title: "Success", description: "Property has been restored." });
        } catch (error) {
            console.error("Failed to restore property:", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to restore property." });
        }
    };

    const handleRestoreFromArchived = async (property) => {
        try {
            await Property.update(property.id, { status: 'active' });
            
            // Log audit event
            await logAuditEvent({
                entityType: 'Property',
                entityId: property.id,
                action: 'restore',
                user: currentUser,
                propertyId: property.id,
                details: { name: property.name }
            });
            
            fetchProperties(currentUser);
            toast({ title: "Success", description: `"${property.name}" has been restored.` });
        } catch (error) {
            console.error("Failed to restore property:", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to restore property." });
        }
    };

    // Removed: openEditDialog function

    const formatPropertyAddress = (p) => {
        return [p.address1, p.city, p.state, p.postalCode].filter(Boolean).join(', ');
    };

    const PropertiesTable = ({ data, isArchived }) => (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Units</TableHead>
                    <TableHead>Active Tenancies</TableHead>
                    <TableHead><span className="sr-only">Actions</span></TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {loading ? (
                    <TableRow>
                        <TableCell colSpan="5" className="text-center py-12">Loading...</TableCell>
                    </TableRow>
                ) : data.length > 0 ? (
                    data.map(property => {
                        const units = propertyUnits[property.id] || [];
                        const activeTenancies = propertyTenancies[property.id] || [];
                        
                        // Role-based logic for actions
                        const canEditProperty = canManageProperties(currentUser) && 
                                              (isAdmin(currentUser) || property.owner_user_id === currentUser.id);
                        const canDeleteProperty = isAdmin(currentUser) || 
                                                (isLandlord(currentUser) && property.owner_user_id === currentUser.id);
                        
                        return (
                            <TableRow key={property.id} className={isArchived ? "bg-gray-50" : ""}>
                                <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                        <span className={isArchived ? "text-muted-foreground" : ""}>{property.name}</span>
                                        {isArchived && <Badge variant="outline">Archived</Badge>}
                                    </div>
                                </TableCell>
                                <TableCell className={isArchived ? "text-muted-foreground" : ""}>
                                    {formatPropertyAddress(property) || '—'}
                                </TableCell>
                                <TableCell className={isArchived ? "text-muted-foreground" : ""}>
                                    {units.length}
                                </TableCell>
                                <TableCell className={isArchived ? "text-muted-foreground" : ""}>
                                    {activeTenancies.length}
                                </TableCell>
                                <TableCell className="text-right">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button size="icon" variant="ghost">
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <Link to={createPageUrl(`PropertyDetail?id=${property.id}`)}>
                                                <DropdownMenuItem className="cursor-pointer">
                                                    <Eye className="mr-2 h-4 w-4"/>View Details
                                                </DropdownMenuItem>
                                            </Link>
                                            
                                            {canEditProperty && !isArchived ? (
                                                <Link to={createPageUrl(`PropertyForm?id=${property.id}`)}>
                                                    <DropdownMenuItem className="cursor-pointer">
                                                        <Edit className="mr-2 h-4 w-4"/>Edit
                                                    </DropdownMenuItem>
                                                </Link>
                                            ) : (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <DropdownMenuItem disabled>
                                                            <Edit className="mr-2 h-4 w-4 opacity-50"/>
                                                            {isArchived ? "Edit (Archived)" : "Edit"}
                                                        </DropdownMenuItem>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>
                                                            {isArchived 
                                                                ? "Cannot edit archived properties."
                                                                : isPropertyManager(currentUser)
                                                                ? "Property Managers cannot edit properties."
                                                                : "You can only edit properties you own."
                                                            }
                                                        </p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            )}
                                            
                                            {canDeleteProperty && !isArchived ? (
                                                <DropdownMenuItem 
                                                    onClick={() => handleArchiveClick(property)} 
                                                    className="text-amber-600 cursor-pointer"
                                                >
                                                    <Trash2 className="mr-2 h-4 w-4"/>Archive
                                                </DropdownMenuItem>
                                            ) : !isArchived && (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <DropdownMenuItem disabled>
                                                            <Trash2 className="mr-2 h-4 w-4 opacity-50"/>Archive
                                                        </DropdownMenuItem>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>
                                                            {isPropertyManager(currentUser)
                                                                ? "Property Managers cannot archive properties."
                                                                : "You can only archive properties you own."
                                                            }
                                                        </p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            )}
                                            
                                            {canDeleteProperty && isArchived && (
                                                <DropdownMenuItem 
                                                    onClick={() => handleRestoreFromArchived(property)} 
                                                    className="cursor-pointer"
                                                >
                                                    <Undo2 className="mr-2 h-4 w-4"/>Restore
                                                </DropdownMenuItem>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        );
                    })
                ) : (
                    <TableRow>
                        <TableCell colSpan="5" className="text-center py-12">
                            <div className="flex flex-col items-center gap-2">
                                <Building2 className="w-12 h-12 text-muted-foreground" />
                                <p className="text-muted-foreground">
                                    {isArchived ? "No archived properties found." : "No properties found."}
                                </p>
                                {!isArchived && canManageProperties(currentUser) && (
                                    <Link to={createPageUrl('PropertyForm')}>
                                        <Button className="mt-2">
                                            <Plus className="mr-2 h-4 w-4" /> Add Your First Property
                                        </Button>
                                    </Link>
                                )}
                            </div>
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
        </Table>
    );
    
    if (loading) {
        // Render a basic loading state for the initial page load before full table render
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h1 className="text-3xl font-bold">Properties</h1>
                </div>
                <div className="text-center py-12">Loading properties...</div>
            </div>
        );
    }
    
    if (!canManageProperties(currentUser)) {
        return (
            <div className="text-center py-12">
                <Building2 className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">Access Denied</h3>
                <p className="mt-1 text-sm text-gray-500">You do not have permission to manage properties.</p>
            </div>
        );
    }

    return (
        <TooltipProvider>
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h1 className="text-3xl font-bold">Properties</h1>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handleRestore}>
                            <RefreshCw className="mr-2 h-4 w-4" /> 
                            Restore Archived
                        </Button>
                        {canManageProperties(currentUser) ? (
                            <Link to={createPageUrl('PropertyForm')}>
                                <Button>
                                    <Plus className="mr-2 h-4 w-4" /> Add Property
                                </Button>
                            </Link>
                        ) : (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div>
                                        <Button disabled>
                                            <Plus className="mr-2 h-4 w-4" /> Add Property
                                        </Button>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Only Landlords and Admins can manage properties.</p>
                                </TooltipContent>
                            </Tooltip>
                        )}
                    </div>
                </div>
                
                {/* Removed: Add/Edit Property Dialog */}

                {/* Archive Confirmation Dialog */}
                <Dialog open={archiveDialog.open} onOpenChange={(isOpen) => {
                    if (!isOpen) {
                        setArchiveDialog({ open: false, property: null, dependencies: null });
                        setConfirmationText('');
                    }
                }}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-red-500" />
                                Archive Property
                            </DialogTitle>
                        </DialogHeader>
                        {archiveDialog.dependencies === 'loading' ? (
                            <p>Checking for dependencies...</p>
                        ) : archiveDialog.dependencies && (archiveDialog.dependencies.assets > 0 || archiveDialog.dependencies.tenancies > 0 || archiveDialog.dependencies.units > 0) ? (
                            <div className="space-y-4">
                                <p className="font-semibold">This property cannot be archived.</p>
                                <p className="text-sm">It has the following active items linked to it:</p>
                                <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                                    {archiveDialog.dependencies.units > 0 && <li>{archiveDialog.dependencies.units} unit(s)</li>}
                                    {archiveDialog.dependencies.assets > 0 && <li>{archiveDialog.dependencies.assets} active asset(s)</li>}
                                    {archiveDialog.dependencies.tenancies > 0 && <li>{archiveDialog.dependencies.tenancies} active tenanc(y/ies)</li>}
                                </ul>
                                <p className="text-sm">Please re-assign or remove these items before archiving.</p>
                                <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
                                    <Button type="button" variant="outline" onClick={() => setArchiveDialog({ open: false, property: null, dependencies: null })}>Close</Button>
                                    <Link to={createPageUrl(`PropertyDetail?id=${archiveDialog.property?.id}`)}>
                                        <Button type="button" className="w-full sm:w-auto">View Linked Items</Button>
                                    </Link>
                                </DialogFooter>
                            </div>
                        ) : (
                            <form onSubmit={(e) => { e.preventDefault(); if (confirmationText === archiveDialog.property?.name) handleArchiveConfirm(); }}>
                                <div className="space-y-4">
                                    <p>This action will archive the property <span className="font-bold">"{archiveDialog.property?.name}"</span>.</p>
                                    <p className="text-sm text-muted-foreground">To confirm, please type the property's name below.</p>
                                    <div>
                                        <Label htmlFor="confirmation" className="sr-only">Property Name</Label>
                                        <Input
                                            id="confirmation"
                                            value={confirmationText}
                                            onChange={(e) => setConfirmationText(e.target.value)}
                                            placeholder="Type property name to confirm"
                                            autoComplete="off"
                                        />
                                    </div>
                                    <DialogFooter>
                                        <Button type="button" variant="outline" onClick={() => setArchiveDialog({ open: false, property: null, dependencies: null })}>Cancel</Button>
                                        <Button 
                                            type="submit"
                                            variant="destructive" 
                                            disabled={confirmationText !== archiveDialog.property?.name}
                                        >
                                            Archive
                                        </Button>
                                    </DialogFooter>
                                </div>
                            </form>
                        )}
                    </DialogContent>
                </Dialog>

                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList>
                        <TabsTrigger value="active">
                            Active Properties ({activeProperties.length})
                        </TabsTrigger>
                        <TabsTrigger value="archived">
                            Archived ({archivedProperties.length})
                        </TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="active">
                        <Card>
                            <CardContent className="p-0">
                                <PropertiesTable data={activeProperties} isArchived={false} />
                            </CardContent>
                        </Card>
                    </TabsContent>
                    
                    <TabsContent value="archived">
                        <Card>
                            <CardContent className="p-0">
                                <PropertiesTable data={archivedProperties} isArchived={true} />
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </TooltipProvider>
    );
}

const Field = ({ label, children }) => (
    <div className="grid w-full items-center gap-1.5">
        <Label>{label}</Label>
        {children}
    </div>
);
