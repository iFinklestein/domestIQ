import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { User } from '@/api/entities';
import { Property } from '@/api/entities';
import { Unit } from '@/api/entities';
import { Tenancy } from '@/api/entities';
import { ManagementAssignment } from '@/api/entities';
import { canManageProperties, migrateUserRole, isLandlord, isAdmin, isLandlordOrPM } from '@/components/roles';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Edit, Plus, Trash2, Globe, Building, User as UserIcon, Home, Phone, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import { useToast } from "@/components/ui/use-toast";

const UnitManager = ({ property, currentUser }) => {
    const [units, setUnits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [currentUnit, setCurrentUnit] = useState(null);
    const { toast } = useToast();

    const fetchUnits = useCallback(async () => {
        setLoading(true);
        try {
            const unitData = await Unit.filter({ property_id: property.id });
            setUnits(unitData);
        } catch (error) {
            console.error("Failed to fetch units:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not load units." });
        } finally {
            setLoading(false);
        }
    }, [property.id, toast]);

    useEffect(() => {
        fetchUnits();
    }, [fetchUnits]);

    const handleSave = async () => {
        if (!currentUnit?.name) {
            toast({ variant: "destructive", title: "Validation Error", description: "Unit name is required." });
            return;
        }

        try {
            if (currentUnit.id) {
                await Unit.update(currentUnit.id, { name: currentUnit.name });
                toast({ title: "Success", description: "Unit updated." });
            } else {
                await Unit.create({ ...currentUnit, property_id: property.id });
                toast({ title: "Success", description: "Unit created." });
            }
            fetchUnits();
            setOpen(false);
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Failed to save unit." });
        }
    };

    const handleDelete = async (unitId) => {
        if (window.confirm("Are you sure? This may affect existing tenancies.")) {
            try {
                await Unit.delete(unitId);
                toast({ title: "Success", description: "Unit deleted." });
                fetchUnits();
            } catch (error) {
                toast({ variant: "destructive", title: "Error", description: "Failed to delete unit." });
            }
        }
    };

    const openDialog = (unit = null) => {
        setCurrentUnit(unit || { name: '' });
        setOpen(true);
    };

    if (loading) return <p>Loading units...</p>;

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <Button onClick={() => openDialog()}><Plus className="mr-2 h-4 w-4" /> Add Unit</Button>
            </div>
            <Card>
                <Table>
                    <TableHeader><TableRow><TableHead>Unit Name</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {units.length > 0 ? units.map(unit => (
                            <TableRow key={unit.id}>
                                <TableCell>{unit.name}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => openDialog(unit)}><Edit className="h-4 w-4" /></Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(unit.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                                </TableCell>
                            </TableRow>
                        )) : (
                            <TableRow><TableCell colSpan="2" className="text-center">No units found.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </Card>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>{currentUnit?.id ? 'Edit' : 'Add'} Unit</DialogTitle></DialogHeader>
                    <div className="py-4">
                        <Label htmlFor="unit-name">Unit Name*</Label>
                        <Input id="unit-name" value={currentUnit?.name || ''} onChange={e => setCurrentUnit({ ...currentUnit, name: e.target.value })} />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave}>Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

const TenancyManager = ({ property, units }) => {
    const [tenancies, setTenancies] = useState([]);
    const [tenants, setTenants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [currentTenancy, setCurrentTenancy] = useState({});
    const { toast } = useToast();

    const fetchTenancies = useCallback(async () => {
        const unitIds = units.map(u => u.id);
        if (unitIds.length === 0) {
            setTenancies([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const tenancyData = await Tenancy.filter({ unit_id: unitIds });
            const tenantUsers = await User.filter({ app_role: 'Tenant' });
            setTenants(tenantUsers);
            setTenancies(tenancyData);
        } catch (error) {
            console.error("Failed to fetch tenancies:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not load tenancies." });
        } finally {
            setLoading(false);
        }
    }, [units, toast]);

    useEffect(() => {
        fetchTenancies();
    }, [fetchTenancies]);

    const handleSave = async () => {
        if (!currentTenancy.unit_id || !currentTenancy.tenant_user_id || !currentTenancy.start_date) {
            toast({ variant: "destructive", title: "Validation Error", description: "Unit, Tenant, and Start Date are required." });
            return;
        }

        try {
            await Tenancy.create({ ...currentTenancy, status: 'active' });
            toast({ title: "Success", description: "Tenancy created." });
            fetchTenancies();
            setOpen(false);
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Failed to create tenancy." });
        }
    };

    const handleEndTenancy = async (tenancyId) => {
        if (window.confirm("Are you sure you want to end this tenancy?")) {
            try {
                await Tenancy.update(tenancyId, { status: 'ended', end_date: new Date().toISOString().split('T')[0] });
                toast({ title: "Success", description: "Tenancy ended." });
                fetchTenancies();
            } catch (error) {
                toast({ variant: "destructive", title: "Error", description: "Failed to end tenancy." });
            }
        }
    };

    const getTenantName = (userId) => tenants.find(t => t.id === userId)?.full_name || 'Unknown';
    const getUnitName = (unitId) => units.find(u => u.id === unitId)?.name || 'Unknown';
    
    const activeUnitIds = tenancies.filter(t => t.status === 'active').map(t => t.unit_id);
    const availableUnits = units.filter(u => !activeUnitIds.includes(u.id));

    if (loading) return <p>Loading tenants...</p>;
    
    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <Button onClick={() => { setCurrentTenancy({}); setOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Assign Tenant</Button>
            </div>
            <Card>
                <Table>
                    <TableHeader><TableRow><TableHead>Tenant</TableHead><TableHead>Unit</TableHead><TableHead>Lease Start</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {tenancies.length > 0 ? tenancies.map(t => (
                            <TableRow key={t.id}>
                                <TableCell>{getTenantName(t.tenant_user_id)}</TableCell>
                                <TableCell>{getUnitName(t.unit_id)}</TableCell>
                                <TableCell>{format(new Date(t.start_date), 'MMM d, yyyy')}</TableCell>
                                <TableCell><Badge variant={t.status === 'active' ? 'default' : 'secondary'}>{t.status}</Badge></TableCell>
                                <TableCell className="text-right">
                                    {t.status === 'active' && <Button variant="outline" size="sm" onClick={() => handleEndTenancy(t.id)}>End Tenancy</Button>}
                                </TableCell>
                            </TableRow>
                        )) : (
                            <TableRow><TableCell colSpan="5" className="text-center">No tenancies found.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </Card>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Assign Tenant to Unit</DialogTitle></DialogHeader>
                    <div className="grid gap-4 py-4">
                        <Field label="Tenant*">
                            <Select onValueChange={v => setCurrentTenancy({...currentTenancy, tenant_user_id: v})} value={currentTenancy.tenant_user_id || ''}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a tenant" />
                                </SelectTrigger>
                                <SelectContent>{tenants.map(t => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}</SelectContent>
                            </Select>
                        </Field>
                        <Field label="Unit*">
                            <Select onValueChange={v => setCurrentTenancy({...currentTenancy, unit_id: v})} value={currentTenancy.unit_id || ''}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select an available unit" />
                                </SelectTrigger>
                                <SelectContent>{availableUnits.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </Field>
                        <Field label="Start Date*"><Input type="date" value={currentTenancy.start_date || ''} onChange={e => setCurrentTenancy({...currentTenancy, start_date: e.target.value})} /></Field>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave}>Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

const ManagerAssignments = ({ property }) => {
    const [assignments, setAssignments] = useState([]);
    const [allPMs, setAllPMs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedPm, setSelectedPm] = useState('');
    const { toast } = useToast();

    const fetchAssignments = useCallback(async () => {
        setLoading(true);
        try {
            const [assignmentData, pmUsers] = await Promise.all([
                ManagementAssignment.filter({ property_id: property.id }),
                User.filter({ app_role: 'PropertyManager' })
            ]);
            setAssignments(assignmentData.sort((a,b) => (a.status === 'active' ? -1 : 1)));
            setAllPMs(pmUsers);
        } catch (error) {
            console.error("Failed to fetch assignments:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not load manager assignments.' });
        } finally {
            setLoading(false);
        }
    }, [property.id, toast]);

    useEffect(() => {
        fetchAssignments();
    }, [fetchAssignments]);

    const handleAssign = async () => {
        if (!selectedPm) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please select a Property Manager to assign.' });
            return;
        }
        try {
            await ManagementAssignment.create({
                property_id: property.id,
                pm_user_id: selectedPm,
                status: 'active'
            });
            toast({ title: 'Success', description: 'Property Manager assigned.' });
            fetchAssignments();
            setSelectedPm('');
        } catch (error) {
            console.error("Failed to assign manager:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to assign manager.' });
        }
    };
    
    const handleEndAssignment = async (assignmentId) => {
        try {
            await ManagementAssignment.update(assignmentId, { status: 'ended' });
            toast({ title: 'Success', description: 'Assignment ended.' });
            fetchAssignments();
        } catch (error) {
            console.error("Failed to end assignment:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to end assignment.' });
        }
    };
    
    const getPmName = (userId) => allPMs.find(pm => pm.id === userId)?.full_name || 'Unknown User';
    
    const assignedPmIds = assignments.filter(a => a.status === 'active').map(a => a.pm_user_id);
    const availablePms = allPMs.filter(pm => !assignedPmIds.includes(pm.id));
    
    if (loading) return <p>Loading manager assignments...</p>;

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader><CardTitle>Assign New Manager</CardTitle></CardHeader>
                <CardContent className="flex items-center gap-4">
                    <Select onValueChange={setSelectedPm} value={selectedPm}>
                        <SelectTrigger className="w-full sm:w-[300px]">
                            <SelectValue placeholder="Select a Property Manager..." />
                        </SelectTrigger>
                        <SelectContent>
                            {availablePms.length > 0 ? (
                                availablePms.map(pm => <SelectItem key={pm.id} value={pm.id}>{pm.full_name} ({pm.email})</SelectItem>)
                            ) : (
                                <div className="p-4 text-sm text-muted-foreground">No available managers.</div>
                            )}
                        </SelectContent>
                    </Select>
                    <Button onClick={handleAssign} disabled={!selectedPm}>Assign Manager</Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle>Current & Past Assignments</CardTitle></CardHeader>
                <Table>
                    <TableHeader><TableRow><TableHead>Manager</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {assignments.length > 0 ? (
                            assignments.map(a => (
                                <TableRow key={a.id}>
                                    <TableCell>{getPmName(a.pm_user_id)}</TableCell>
                                    <TableCell><Badge variant={a.status === 'active' ? 'default' : 'secondary'}>{a.status}</Badge></TableCell>
                                    <TableCell className="text-right">
                                        {a.status === 'active' && (
                                            <Button variant="outline" size="sm" onClick={() => handleEndAssignment(a.id)}>End Assignment</Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow><TableCell colSpan="3" className="text-center">No managers assigned.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </Card>
        </div>
    );
};


export default function PropertyDetail() {
    const location = useLocation();
    const navigate = useNavigate();
    const urlParams = new URLSearchParams(location.search);
    const propertyId = urlParams.get('id');
    const { toast } = useToast();

    const [property, setProperty] = useState(null);
    const [units, setUnits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState(null);

    useEffect(() => {
        async function fetchCurrentUser() {
            try {
                const user = await User.me();
                const migratedUser = await migrateUserRole(user);
                setCurrentUser(migratedUser);
            } catch (error) {
                console.error("Failed to fetch current user:", error);
                toast({ variant: "destructive", title: "Error", description: "Could not load user session." });
            }
        }
        fetchCurrentUser();
    }, [toast]);

    const fetchData = useCallback(async (currentPropertyId, user) => {
        if (!currentPropertyId || !user) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const propertyData = await Property.get(currentPropertyId);
            const unitData = await Unit.filter({ property_id: currentPropertyId });
            
            // Security check: only Admin or the property owner can view/manage
            if (!(isAdmin(user) || propertyData.owner_user_id === user.id)) {
                toast({ variant: "destructive", title: "Access Denied", description: "You don't have permission to manage this property." });
                navigate(createPageUrl('Properties'));
                return;
            }

            setProperty(propertyData);
            setUnits(unitData);
        } catch (error) {
            console.error("Failed to fetch property details:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not load property details." });
            navigate(createPageUrl('Properties'));
        } finally {
            setLoading(false);
        }
    }, [toast, navigate]);

    useEffect(() => {
        if (propertyId && currentUser) {
            fetchData(propertyId, currentUser);
        }
    }, [propertyId, currentUser, fetchData]);

    const formatAddress = (p) => [p.address1, p.city, p.state, p.postalCode].filter(Boolean).join(', ');
    
    const canManageAssignments = currentUser && (isAdmin(currentUser) || isLandlord(currentUser));

    const canEditProperty = currentUser && canManageProperties(currentUser) && (isAdmin(currentUser) || property?.owner_user_id === currentUser.id);

    if (loading) {
        return <div className="text-center p-8">Loading property details...</div>;
    }

    if (!property) {
        return (
            <div className="text-center p-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Property Not Found</CardTitle>
                        <CardDescription>The requested property could not be found or you do not have permission to view it.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={() => navigate(createPageUrl('Properties'))}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Properties
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <Button variant="outline" size="sm" onClick={() => navigate(createPageUrl('Properties'))}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Properties
                    </Button>
                    <h1 className="text-3xl font-bold mt-2">{property.name}</h1>
                    <p className="text-muted-foreground">{formatAddress(property)}</p>
                </div>
                {canEditProperty && (
                    <Link to={createPageUrl(`PropertyForm?id=${property.id}`)}>
                        <Button>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Property
                        </Button>
                    </Link>
                )}
            </div>
            
            <Tabs defaultValue="units">
                <TabsList>
                    <TabsTrigger value="units">Units ({units.length})</TabsTrigger>
                    <TabsTrigger value="tenants">Tenants</TabsTrigger>
                    {canManageAssignments && <TabsTrigger value="managers">Managers</TabsTrigger>}
                </TabsList>
                <TabsContent value="units">
                    <UnitManager property={property} currentUser={currentUser} />
                </TabsContent>
                <TabsContent value="tenants">
                    <TenancyManager property={property} units={units} />
                </TabsContent>
                {canManageAssignments && (
                    <TabsContent value="managers">
                        <ManagerAssignments property={property} />
                    </TabsContent>
                )}
            </Tabs>
        </div>
    );
}

const Field = ({ label, children }) => (
    <div className="grid w-full items-center gap-1.5">
        <Label>{label}</Label>
        {children}
    </div>
);