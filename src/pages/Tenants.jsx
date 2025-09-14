import React, { useState, useEffect, useCallback } from 'react';
import { User } from '@/api/entities';
import { canManageTenants, migrateUserRole } from '@/components/roles';
import { Tenant } from '@/api/entities';
import { Asset } from '@/api/entities';
import { Property } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, MoreHorizontal, Edit, Trash2, Users, Eye } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useToast } from "@/components/ui/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function TenantsPage() {
  const [tenants, setTenants] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [currentTenant, setCurrentTenant] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tenantToDelete, setTenantToDelete] = useState(null);
  const [relatedAssetsCount, setRelatedAssetsCount] = useState(0);
  const [propertyFilter, setPropertyFilter] = useState('all');
  const [currentUser, setCurrentUser] = useState(null);
  const { toast } = useToast();

  const fetchTenants = useCallback(async () => {
    setLoading(true);
    try {
        const [tenantData, propertyData] = await Promise.all([
            Tenant.list('-created_date'),
            Property.list()
        ]);
        setTenants(tenantData);
        setProperties(propertyData);
    } catch (error) {
        console.error("Failed to fetch tenants:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not load tenants." });
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
        } catch(e) { 
            console.error("Failed to fetch current user:", e);
            setCurrentUser(null);
        }
    }
    fetchAndMigrateUser();
    fetchTenants();
  }, [fetchTenants]);

  const handleSave = async () => {
    if (!canManageTenants(currentUser)) {
        toast({ variant: "destructive", title: "Permission Denied", description: "You do not have permission to manage tenants." });
        return;
    }
    
    if (!currentTenant?.name) {
        toast({ variant: "destructive", title: "Validation Error", description: "Tenant name is required." });
        return;
    }
    
    try {
        if (currentTenant.id) {
            await Tenant.update(currentTenant.id, currentTenant);
            toast({ title: "Success", description: "Tenant updated successfully." });
        } else {
            await Tenant.create(currentTenant);
            toast({ title: "Success", description: "Tenant created successfully." });
        }
        fetchTenants();
        setOpen(false);
        setCurrentTenant(null);
    } catch (error) {
        console.error("Failed to save tenant:", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to save tenant." });
    }
  };

  const handleDeleteClick = async (tenant) => {
    if (!canManageTenants(currentUser)) {
        toast({ variant: "destructive", title: "Permission Denied", description: "You do not have permission to manage tenants." });
        return;
    }
    
    try {
        const relatedAssets = await Asset.filter({ tenantId: tenant.id });
        setRelatedAssetsCount(relatedAssets.length);
        setTenantToDelete(tenant);
        setDeleteDialogOpen(true);
    } catch (error) {
        console.error("Error checking related assets:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not verify related assets." });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!tenantToDelete) return;
    
    if (relatedAssetsCount > 0) {
        toast({ 
            variant: "destructive", 
            title: "Cannot Delete Tenant", 
            description: `This tenant has ${relatedAssetsCount} asset(s). Please reassign or delete their assets first.` 
        });
        setDeleteDialogOpen(false);
        return;
    }
    
    try {
        await Tenant.delete(tenantToDelete.id);
        toast({ title: "Success", description: "Tenant deleted successfully." });
        fetchTenants();
        setDeleteDialogOpen(false);
        setTenantToDelete(null);
        setRelatedAssetsCount(0);
    } catch (error) {
        console.error("Failed to delete tenant:", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to delete tenant." });
    }
  };

  const openDialog = (tenant = null) => {
    setCurrentTenant(tenant || { 
        name: '', 
        email: '', 
        phone: '', 
        propertyId: '',
        leaseStart: '', 
        leaseEnd: '', 
        notes: '', 
        isActive: true 
    });
    setOpen(true);
  };

  // Filter tenants by property
  const filteredTenants = propertyFilter === 'all' 
    ? tenants 
    : tenants.filter(tenant => tenant.propertyId === propertyFilter);

  // Redirect if user doesn't have permission
  if (currentUser && !canManageTenants(currentUser)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">You do not have permission to manage tenants.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Tenants</h1>
        {canManageTenants(currentUser) && (
          <Button onClick={() => openDialog()}>
            <Plus className="mr-2 h-4 w-4" /> Add Tenant
          </Button>
        )}
      </div>

      <div className="flex gap-4">
        <Select value={propertyFilter} onValueChange={setPropertyFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Properties" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Properties</SelectItem>
            {properties.map(property => (
              <SelectItem key={property.id} value={property.id}>
                {property.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{currentTenant?.id ? 'Edit' : 'Add'} Tenant</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name*</Label>
              <Input 
                id="name" 
                value={currentTenant?.name || ''} 
                onChange={(e) => setCurrentTenant({...currentTenant, name: e.target.value})} 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email"
                value={currentTenant?.email || ''} 
                onChange={(e) => setCurrentTenant({...currentTenant, email: e.target.value})} 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input 
                id="phone" 
                value={currentTenant?.phone || ''} 
                onChange={(e) => setCurrentTenant({...currentTenant, phone: e.target.value})} 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="propertyId">Property</Label>
              <Select 
                value={currentTenant?.propertyId || ''} 
                onValueChange={(value) => setCurrentTenant({...currentTenant, propertyId: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a property" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>No Property</SelectItem>
                  {properties.map(property => (
                    <SelectItem key={property.id} value={property.id}>
                      {property.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="leaseStart">Lease Start</Label>
                <Input 
                  id="leaseStart" 
                  type="date"
                  value={currentTenant?.leaseStart || ''} 
                  onChange={(e) => setCurrentTenant({...currentTenant, leaseStart: e.target.value})} 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="leaseEnd">Lease End</Label>
                <Input 
                  id="leaseEnd" 
                  type="date"
                  value={currentTenant?.leaseEnd || ''} 
                  onChange={(e) => setCurrentTenant({...currentTenant, leaseEnd: e.target.value})} 
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea 
                id="notes" 
                value={currentTenant?.notes || ''} 
                onChange={(e) => setCurrentTenant({...currentTenant, notes: e.target.value})} 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Tenant</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Are you sure you want to delete tenant "{tenantToDelete?.name}"?
            </p>
            {relatedAssetsCount > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                <p className="text-sm text-yellow-800">
                  <strong>Warning:</strong> This tenant has {relatedAssetsCount} asset(s). 
                  You must reassign or delete their assets before deleting the tenant.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteConfirm}
              disabled={relatedAssetsCount > 0}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Property</TableHead>
                <TableHead>Lease Period</TableHead>
                <TableHead>Status</TableHead>
                <TableHead><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan="7" className="text-center py-8">Loading...</TableCell></TableRow>
              ) : filteredTenants.length > 0 ? (
                filteredTenants.map(tenant => {
                  const property = properties.find(p => p.id === tenant.propertyId);
                  return (
                    <TableRow key={tenant.id}>
                      <TableCell className="font-medium">{tenant.name}</TableCell>
                      <TableCell>{tenant.email || '—'}</TableCell>
                      <TableCell>{tenant.phone || '—'}</TableCell>
                      <TableCell>{property?.name || '—'}</TableCell>
                      <TableCell>
                        {tenant.leaseStart && tenant.leaseEnd ? 
                          `${tenant.leaseStart} - ${tenant.leaseEnd}` : '—'
                        }
                      </TableCell>
                      <TableCell>
                        <Badge variant={tenant.isActive ? 'default' : 'secondary'}>
                          {tenant.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <Link to={createPageUrl(`TenantDetail?id=${tenant.id}`)}>
                              <DropdownMenuItem className="cursor-pointer">
                                <Eye className="mr-2 h-4 w-4"/>View Details
                              </DropdownMenuItem>
                            </Link>
                            {canManageTenants(currentUser) && (
                              <>
                                <DropdownMenuItem onClick={() => openDialog(tenant)}>
                                  <Edit className="mr-2 h-4 w-4"/>Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleDeleteClick(tenant)} 
                                  className="text-red-600"
                                >
                                  <Trash2 className="mr-2 h-4 w-4"/>Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan="7" className="text-center py-12">
                    <div className="flex flex-col items-center gap-2">
                      <Users className="w-10 h-10 text-muted-foreground" />
                      <p className="text-muted-foreground">No tenants found</p>
                      {canManageTenants(currentUser) && (
                        <Button onClick={() => openDialog()}>
                          <Plus className="mr-2 h-4 w-4" /> Add your first tenant
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}