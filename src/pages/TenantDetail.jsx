import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { User } from '@/api/entities';
import { canManageTenants, migrateUserRole } from '@/components/roles';
import { Tenant } from '@/api/entities';
import { Asset } from '@/api/entities';
import { Category } from '@/api/entities';
import { Location as AssetLocation } from '@/api/entities';
import { Vendor } from '@/api/entities';
import { Warranty } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Edit, Users, Mail, Phone, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import { useToast } from "@/components/ui/use-toast";

export default function TenantDetailPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(location.search);
  const tenantId = urlParams.get('id');
  const { toast } = useToast();

  const [tenant, setTenant] = useState(null);
  const [assets, setAssets] = useState([]);
  const [relatedData, setRelatedData] = useState({ categories: [], locations: [], vendors: [], warranties: [] });
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  const fetchData = useCallback(async () => {
    if (!tenantId) return;
    
    setLoading(true);
    try {
      const [tenantData, tenantAssets, categories, locations, vendors, warranties] = await Promise.all([
        Tenant.get(tenantId),
        Asset.filter({ tenantId }, '-created_date'),
        Category.list(),
        AssetLocation.list(),
        Vendor.list(),
        Warranty.list()
      ]);
      
      setTenant(tenantData);
      setAssets(tenantAssets);
      setRelatedData({ categories, locations, vendors, warranties });
    } catch (error) {
      console.error("Failed to fetch tenant details:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not load tenant details." });
    } finally {
      setLoading(false);
    }
  }, [tenantId, toast]);

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
    fetchData();
  }, [fetchData]);

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  if (!tenant) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Tenant not found.</p>
        <Button onClick={() => navigate(createPageUrl('Tenants'))} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Tenants
        </Button>
      </div>
    );
  }

  // Redirect if user doesn't have permission
  if (currentUser && !canManageTenants(currentUser)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">You do not have permission to view tenant details.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to={createPageUrl('Dashboard')} className="hover:text-foreground">Dashboard</Link>
        <span>/</span>
        <Link to={createPageUrl('Tenants')} className="hover:text-foreground">Tenants</Link>
        <span>/</span>
        <span className="text-foreground font-medium">{tenant.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate(createPageUrl('Tenants'))}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Tenants
          </Button>
          <h1 className="text-3xl font-bold">{tenant.name}</h1>
          <Badge variant={tenant.isActive ? 'default' : 'secondary'}>
            {tenant.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>
        {canManageTenants(currentUser) && (
          <Link to={createPageUrl(`Tenants`)}>
            <Button variant="outline">
              <Edit className="mr-2 h-4 w-4" /> Edit Tenant
            </Button>
          </Link>
        )}
      </div>

      {/* Tenant Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Tenant Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {tenant.email && (
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Email</p>
                  <p className="text-sm text-muted-foreground">{tenant.email}</p>
                </div>
              </div>
            )}
            {tenant.phone && (
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Phone</p>
                  <p className="text-sm text-muted-foreground">{tenant.phone}</p>
                </div>
              </div>
            )}
            {(tenant.leaseStart || tenant.leaseEnd) && (
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Lease Period</p>
                  <p className="text-sm text-muted-foreground">
                    {tenant.leaseStart && tenant.leaseEnd 
                      ? `${tenant.leaseStart} - ${tenant.leaseEnd}`
                      : tenant.leaseStart || tenant.leaseEnd || '—'
                    }
                  </p>
                </div>
              </div>
            )}
          </div>
          {tenant.notes && (
            <div className="mt-6">
              <p className="text-sm font-medium mb-2">Notes</p>
              <p className="text-sm text-muted-foreground">{tenant.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assets Table */}
      <Card>
        <CardHeader>
          <CardTitle>Assets ({assets.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Serial Number</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Purchase Date</TableHead>
                <TableHead>Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.length > 0 ? (
                assets.map(asset => {
                  const category = relatedData.categories.find(c => c.id === asset.categoryId);
                  const assetLocation = relatedData.locations.find(l => l.id === asset.locationId);
                  return (
                    <TableRow key={asset.id}>
                      <TableCell className="font-medium">
                        <Link to={createPageUrl(`AssetDetail?id=${asset.id}`)} className="text-blue-600 hover:underline">
                          {asset.name}
                        </Link>
                      </TableCell>
                      <TableCell>{asset.serialNumber || '—'}</TableCell>
                      <TableCell>{category?.name || '—'}</TableCell>
                      <TableCell>{assetLocation?.name || '—'}</TableCell>
                      <TableCell>{asset.purchaseDate ? format(new Date(asset.purchaseDate), 'MMM d, yyyy') : '—'}</TableCell>
                      <TableCell>${(asset.purchasePrice || 0).toFixed(2)}</TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan="6" className="text-center py-8 text-muted-foreground">
                    No assets assigned to this tenant.
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