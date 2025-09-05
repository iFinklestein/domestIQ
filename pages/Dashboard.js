// /pages/Dashboard.js
import React, { useState, useEffect } from 'react';
import { Asset } from '@/entities/Asset';
import { Warranty } from '@/entities/Warranty';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Box, DollarSign, ShieldAlert, Plus } from 'lucide-react';
import { format, addDays } from 'date-fns';

const StatCard = ({ title, value, icon: Icon, color }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className={`h-4 w-4 text-muted-foreground ${color}`} />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
    </CardContent>
  </Card>
);

export default function Dashboard() {
  const [assetCount, setAssetCount] = useState(0);
  const [totalValue, setTotalValue] = useState(0);
  const [expiringWarranties, setExpiringWarranties] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [assets, warranties] = await Promise.all([
          Asset.list(),
          Warranty.list()
        ]);

        setAssetCount(assets.length);
        const total = assets.reduce((sum, asset) => sum + (asset.purchasePrice || 0), 0);
        setTotalValue(total);

        const ninetyDaysFromNow = addDays(new Date(), 90);
        const expiring = warranties.filter(w => new Date(w.endDate) <= ninetyDaysFromNow);
        setExpiringWarranties(expiring);

      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Welcome to domestIQ - your home asset management system</p>
        </div>
        <Link to={createPageUrl('AssetForm')}>
            <Button>
                <Plus className="mr-2 h-4 w-4" /> Add Asset
            </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Total Assets" value={loading ? '...' : assetCount} icon={Box} color="text-blue-500" />
        <StatCard title="Total Asset Value" value={loading ? '...' : `$${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} icon={DollarSign} color="text-green-500" />
        <StatCard title="Warranties Expiring Soon" value={loading ? '...' : expiringWarranties.length} icon={ShieldAlert} color="text-red-500" />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Warranties Expiring in Next 90 Days</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p>Loading...</p>
            ) : expiringWarranties.length > 0 ? (
              <ul className="space-y-2">
                {expiringWarranties.map(warranty => (
                  <li key={warranty.id} className="flex justify-between items-center p-2 rounded-md hover:bg-gray-50">
                    <div>
                      <p className="font-medium">{warranty.providerName}</p>
                      <p className="text-sm text-muted-foreground">{warranty.policyNumber}</p>
                    </div>
                    <p className="text-sm font-semibold text-red-600">
                      Expires: {format(new Date(warranty.endDate), 'MMM d, yyyy')}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-center py-6">
                <p className="text-muted-foreground mb-2">No warranties are expiring soon.</p>
                <Link to={createPageUrl('Warranties')}>
                  <Button variant="outline" size="sm">Manage Warranties</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link to={createPageUrl('AssetForm')} className="block">
              <Button className="w-full justify-start">
                <Plus className="mr-2 h-4 w-4" />
                Add New Asset
              </Button>
            </Link>
            <Link to={createPageUrl('Categories')} className="block">
              <Button variant="outline" className="w-full justify-start">
                Manage Categories
              </Button>
            </Link>
            <Link to={createPageUrl('ImportExport')} className="block">
              <Button variant="outline" className="w-full justify-start">
                Import/Export Data
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {assetCount === 0 && !loading && (
        <Card>
          <CardContent className="text-center py-12">
            <Box className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Get Started with domestIQ</h3>
            <p className="text-muted-foreground mb-4">
              Start by adding your first asset to track your home inventory
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Link to={createPageUrl('AssetForm')}>
                <Button>Add Your First Asset</Button>
              </Link>
              <Link to={createPageUrl('Categories')}>
                <Button variant="outline">Set Up Categories</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
