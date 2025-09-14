import React, { useState, useEffect } from 'react';
import { canWrite, isAdmin, isLandlordOrPM, isTenant, canReadAsset, canManageProperties } from '@/components/roles';
import { MaintenanceRequest } from '@/api/entities';
import { Reminder } from '@/api/entities';
import { useBootstrap } from '@/components/useBootstrap';
import { useAuth } from '@/components/useAuth';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Box, DollarSign, ShieldAlert, Plus, Wrench, Clock } from 'lucide-react';
import { format, isBefore, isToday } from 'date-fns';
import { getWarrantyStatus } from '../components/warrantyUtils';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { useApiErrorHandler } from '../components/errorHandling';
import { ErrorState } from '../components/EmptyState';

const StatCard = ({ title, value, icon: Icon, color, pageUrl }) => (
    <Link to={pageUrl} className="block hover:shadow-lg transition-shadow rounded-lg">
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className={`h-4 w-4 text-muted-foreground ${color}`} />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
            </CardContent>
        </Card>
    </Link>
);

export default function Dashboard() {
  const { user: currentUser } = useAuth(); // User is guaranteed to be loaded here
  const { data: bootstrapData, loading, error, refetch } = useBootstrap();
  const [totalValue, setTotalValue] = useState(0);
  const [expiringWarranties, setExpiringWarranties] = useState([]);
  const [openMaintenanceRequests, setOpenMaintenanceRequests] = useState([]);
  const [overdueReminders, setOverdueReminders] = useState([]);
  const [computedDataLoading, setComputedDataLoading] = useState(true);

  const { handleError } = useApiErrorHandler();

  // Compute dashboard statistics from bootstrap data
  useEffect(() => {
    async function computeStats() {
      if (!currentUser || !bootstrapData) {
        setComputedDataLoading(loading); // Reflect bootstrap loading state
        return;
      }
      
      setComputedDataLoading(true);
      
      try {
        const { assets, properties, tenancies } = bootstrapData;

        // Filter assets based on permissions
        const accessibleAssets = assets.filter(asset => 
            canReadAsset(currentUser, asset, properties, tenancies)
        );

        // Calculate total value
        const total = accessibleAssets.reduce((sum, asset) => sum + (asset.purchasePrice || 0), 0);
        setTotalValue(total);

        // Get warranties expiring within 30 days
        const expiring = accessibleAssets.filter(asset => {
            const status = getWarrantyStatus(asset);
            return status.isExpiring;
        }).sort((a, b) => {
            const statusA = getWarrantyStatus(a);
            const statusB = getWarrantyStatus(b);
            return statusA.days - statusB.days;
        });

        setExpiringWarranties(expiring);

        // Get maintenance requests
        const propertyIds = [...new Set(properties.map(p => p.id))];
        const userPropertyIdsFromTenancies = tenancies
            .filter(t => t.tenant_user_id === currentUser.id)
            .map(t => t.property_id);
        propertyIds.push(...userPropertyIdsFromTenancies);
        
        let maintenanceRequests = [];
        if (isTenant(currentUser)) {
            maintenanceRequests = await MaintenanceRequest.filter({ 
                created_by_user_id: currentUser.id,
            });
        } else if (propertyIds.length > 0) {
            maintenanceRequests = await MaintenanceRequest.filter({ 
                property_id: propertyIds,
            });
        }
        setOpenMaintenanceRequests((maintenanceRequests || []).filter(r => ['open', 'scheduled'].includes(r.status)));

        // Get overdue and due-today reminders
        const assetIds = accessibleAssets.map(a => a.id);
        if (assetIds.length > 0) {
            const allReminders = await Reminder.filter({ 
                asset_id: assetIds,
                is_active: true 
            });
            
            const today = new Date();
            const overdueAndDueToday = allReminders.filter(reminder => {
                const dueDate = new Date(reminder.next_due_date);
                return isBefore(dueDate, today) || isToday(dueDate);
            }).sort((a, b) => new Date(a.next_due_date) - new Date(b.next_due_date));

            setOverdueReminders(overdueAndDueToday);
        }

      } catch (e) { 
        console.error("Failed to compute dashboard stats:", e);
        handleError(e, 'compute dashboard statistics');
      } finally {
        setComputedDataLoading(false);
      }
    }
    computeStats();
  }, [currentUser, bootstrapData, handleError, loading]);

  const visibleAssets = bootstrapData?.assets?.filter(asset => 
    canReadAsset(currentUser, asset, bootstrapData?.properties || [], bootstrapData?.tenancies || [])
  ) || [];

  if (error) {
    return (
      <div className="w-full space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Welcome to domestIQ</p>
          </div>
        </div>
        <ErrorState 
          title="Failed to load dashboard"
          description="We couldn't load your dashboard data. This might be due to a network issue or missing permissions."
          onRetry={refetch}
        />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Welcome to domestIQ - your home asset management system</p>
        </div>
        {(isAdmin(currentUser) || isLandlordOrPM(currentUser) || isTenant(currentUser)) ? (
            <Link to={createPageUrl('AssetForm')}>
              <Button className="w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" /> Add Asset
              </Button>
            </Link>
        ) : (
            <SimpleTooltip content="You need an active account to create assets">
                <div className="w-full sm:w-auto">
                    <Button disabled className="w-full sm:w-auto">
                        <Plus className="mr-2 h-4 w-4" /> Add Asset
                    </Button>
                </div>
            </SimpleTooltip>
        )}
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard 
            title="Total Assets" 
            value={loading || computedDataLoading ? '...' : visibleAssets.length} 
            icon={Box} 
            color="text-blue-500"
            pageUrl={createPageUrl('Assets')}
        />
        <StatCard 
            title="Total Asset Value" 
            value={loading || computedDataLoading ? '...' : `$${totalValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`} 
            icon={DollarSign} 
            color="text-green-500"
            pageUrl={createPageUrl('Assets')}
        />
        <StatCard 
            title="Warranties Expiring Soon" 
            value={loading || computedDataLoading ? '...' : expiringWarranties.length} 
            icon={ShieldAlert} 
            color="text-red-500"
            pageUrl={createPageUrl('Assets?warrantyStatus=expiring')}
        />
        <StatCard 
            title="Open Maintenance Requests" 
            value={loading || computedDataLoading ? '...' : openMaintenanceRequests.length} 
            icon={Wrench} 
            color="text-orange-500"
            pageUrl={createPageUrl('MaintenanceRequests?status=open')}
        />
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Warranties Expiring Soon</CardTitle>
          </CardHeader>
          <CardContent>
            {loading || computedDataLoading ? (
              <p>Loading...</p>
            ) : expiringWarranties.length > 0 ? (
              <ul className="space-y-2">
                {expiringWarranties.slice(0, 5).map(asset => {
                  const warrantyStatus = getWarrantyStatus(asset);
                  return (
                    <li key={asset.id} className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-2 rounded-md hover:bg-gray-50 gap-2">
                      <div>
                        <p className="font-medium">{asset.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Warranty expires in {warrantyStatus.days} days
                        </p>
                      </div>
                      <Link to={createPageUrl(`AssetDetail?id=${asset.id}`)}>
                        <Button variant="outline" size="sm">View Asset</Button>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="text-center py-6">
                <p className="text-muted-foreground mb-2">No warranties expiring soon.</p>
                <Link to={createPageUrl('Assets')}>
                  <Button variant="outline" size="sm">View Assets</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Maintenance Reminders Due</CardTitle>
          </CardHeader>
          <CardContent>
            {loading || computedDataLoading ? (
              <p>Loading...</p>
            ) : overdueReminders.length > 0 ? (
              <ul className="space-y-2">
                {overdueReminders.slice(0, 5).map(reminder => {
                  const asset = visibleAssets.find(a => a.id === reminder.asset_id);
                  const isOverdue = isBefore(new Date(reminder.next_due_date), new Date());
                  return (
                    <li key={reminder.id} className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-2 rounded-md hover:bg-gray-50 gap-2">
                      <div>
                        <p className="font-medium">{reminder.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {asset?.name} • {isOverdue ? 'Overdue' : 'Due today'}
                        </p>
                      </div>
                      <Link to={createPageUrl(`AssetDetail?id=${asset?.id}`)}>
                        <Button variant="outline" size="sm">View Asset</Button>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="text-center py-6">
                <p className="text-muted-foreground mb-2">No overdue reminders.</p>
                <Link to={createPageUrl('Assets')}>
                  <Button variant="outline" size="sm">View Assets</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Link to={createPageUrl('MaintenanceRequestForm')} className="block">
            <Button className="w-full justify-start" variant="outline">
              <Wrench className="mr-2 h-4 w-4" />
              Request Maintenance
            </Button>
          </Link>
          
          <Link to={createPageUrl('AssetForm')} className="block">
            <Button className="w-full justify-start" variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Add New Asset
            </Button>
          </Link>
          
          {canManageProperties(currentUser) ? (
              <Link to={createPageUrl('Properties')} className="block">
                <Button variant="outline" className="w-full justify-start">
                  Manage Properties
                </Button>
              </Link>
          ) : (
              <SimpleTooltip content="Only Landlords and Admins can manage properties">
                  <div className="block">
                      <Button disabled variant="outline" className="w-full justify-start">
                          Manage Properties
                      </Button>
                  </div>
              </SimpleTooltip>
          )}
          
          {(isAdmin(currentUser) || isLandlordOrPM(currentUser)) ? (
            <Link to={createPageUrl('ImportExport')} className="block">
              <Button variant="outline" className="w-full justify-start">
                Import/Export Data
              </Button>
            </Link>
          ) : (
            <SimpleTooltip content="Import/Export is available for Landlords and Admins only">
                <div className="block">
                    <Button disabled variant="outline" className="w-full justify-start">
                        Import/Export Data
                    </Button>
                </div>
            </SimpleTooltip>
          )}
        </CardContent>
      </Card>

      {visibleAssets.length === 0 && !loading && !computedDataLoading && (
        <Card>
          <CardContent className="text-center py-8 sm:py-12">
            <Box className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Get Started with domestIQ</h3>
            <p className="text-sm sm:text-base text-muted-foreground mb-4">
              Start by adding your first asset to track your home inventory
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Link to={createPageUrl('AssetForm')}>
                <Button className="w-full sm:w-auto">Add Your First Asset</Button>
              </Link>
              <Link to={createPageUrl('Categories')}>
                <Button variant="outline" className="w-full sm:w-auto">Set Up Categories</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}