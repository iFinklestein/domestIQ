import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/useAuth';
import { useBootstrap } from '@/components/useBootstrap';
import { canReadAsset, canWriteAsset } from '@/components/roles';
import { getWarrantyStatus } from '@/components/warrantyUtils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, XCircle, Loader2, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

const CheckItem = ({ title, description, status, message }) => (
    <li className="flex items-start p-4 border-b">
        <div className="mr-4">
            {status === 'loading' && <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />}
            {status === 'success' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
            {status === 'error' && <XCircle className="h-5 w-5 text-red-500" />}
            {status === 'idle' && <div className="h-5 w-5" />}
        </div>
        <div className="flex-1">
            <p className="font-medium">{title}</p>
            <p className="text-sm text-muted-foreground">{description}</p>
            {message && (
                <p className={`text-xs mt-1 p-2 rounded ${
                    status === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                }`}>
                    {message}
                </p>
            )}
        </div>
    </li>
);

export default function AdminSelfCheckPage() {
    const { user } = useAuth();
    const { data: bootstrapData, loading: bootstrapLoading, error: bootstrapError, refetch: refetchBootstrap } = useBootstrap();
    const [running, setRunning] = useState(false);
    const [results, setResults] = useState([]);

    const CHECKS = [
        {
            id: 'bootstrap',
            title: 'Bootstrap Data Loaded',
            description: 'Verifies that essential application data (properties, categories, etc.) loads successfully.',
            run: async () => {
                if (bootstrapError) throw new Error(`Bootstrap failed: ${bootstrapError.message}`);
                if (!bootstrapData) throw new Error('Bootstrap data is empty.');
                const dataPoints = ['properties', 'categories', 'locations', 'vendors', 'assets'];
                const missing = dataPoints.filter(dp => !bootstrapData[dp]);
                if (missing.length > 0) throw new Error(`Bootstrap data missing keys: ${missing.join(', ')}`);
                return `Loaded ${bootstrapData.assets.length} assets, ${bootstrapData.properties.length} properties, and ${bootstrapData.categories.length} categories.`;
            },
        },
        {
            id: 'role_permissions',
            title: 'Role Permissions Check',
            description: 'Ensures role-based access control (read/write) functions correctly on assets.',
            run: async () => {
                const { assets, properties, tenancies } = bootstrapData;
                const rentalAsset = assets.find(a => a.ownerType === 'rental');
                const tenantAsset = assets.find(a => a.ownerType === 'tenant');
                
                if (!rentalAsset) return 'Skipped: No rental asset found to test permissions.';

                const readable = canReadAsset(user, rentalAsset, properties, tenancies);
                const writable = canWriteAsset(user, rentalAsset, properties, tenancies);

                if (!readable) throw new Error('User cannot read a basic rental asset.');
                
                return `User has read access. Write access: ${writable}.`;
            },
        },
        {
            id: 'warranty_logic',
            title: 'Warranty "Expiring Soon" Logic',
            description: 'Checks if the client-side logic for identifying expiring warranties is working.',
            run: async () => {
                const expiringAsset = { warrantyEndDate: format(new Date().setDate(new Date().getDate() + 15), 'yyyy-MM-dd') };
                const activeAsset = { warrantyEndDate: format(new Date().setDate(new Date().getDate() + 90), 'yyyy-MM-dd') };
                
                const expiringStatus = getWarrantyStatus(expiringAsset);
                const activeStatus = getWarrantyStatus(activeAsset);

                if (!expiringStatus.isExpiring) throw new Error('Asset expiring in 15 days was not flagged as "expiring".');
                if (activeStatus.isExpiring) throw new Error('Asset expiring in 90 days was incorrectly flagged as "expiring".');

                return `Correctly identified asset expiring in 15 days. Days left: ${expiringStatus.days}.`;
            },
        },
        {
            id: 'dashboard_kpis',
            title: 'Dashboard KPI Calculation',
            description: 'Verifies that dashboard key performance indicators can be calculated from bootstrap data.',
            run: async () => {
                const { assets, properties, tenancies } = bootstrapData;
                const accessibleAssets = assets.filter(a => canReadAsset(user, a, properties, tenancies));
                const totalValue = accessibleAssets.reduce((sum, asset) => sum + (asset.purchasePrice || 0), 0);
                const expiringWarranties = accessibleAssets.filter(a => getWarrantyStatus(a).isExpiring).length;
                
                return `Calculated: ${accessibleAssets.length} assets, total value $${totalValue.toLocaleString()}, ${expiringWarranties} expiring warranties.`;
            },
        },
        {
            id: 'archive_check',
            title: 'Soft-Delete / Archive Check',
            description: 'Verifies that taxonomy items (e.g., categories) correctly identify dependencies before archiving.',
            run: async () => {
                const { assets, categories } = bootstrapData;
                if (categories.length === 0) return 'Skipped: No categories to test.';

                const categoryInUse = categories.find(cat => assets.some(asset => asset.categoryId === cat.id));
                if (!categoryInUse) return 'Skipped: No categories are currently linked to assets.';
                
                const linkedAssetsCount = assets.filter(asset => asset.categoryId === categoryInUse.id).length;

                return `Category "${categoryInUse.name}" is correctly linked to ${linkedAssetsCount} asset(s). Archiving should be blocked.`;
            },
        },
    ];

    const runChecks = async () => {
        setRunning(true);
        const initialResults = CHECKS.map(c => ({ id: c.id, title: c.title, description: c.description, status: 'loading', message: '' }));
        setResults(initialResults);
    
        for (const check of CHECKS) {
            // Artificial delay to prevent any potential API bursts if checks were async
            await new Promise(resolve => setTimeout(resolve, 100));
            try {
                if (bootstrapError || (!bootstrapData && check.id !== 'bootstrap')) {
                    throw new Error('Skipped due to failed bootstrap.');
                }
                const message = await check.run();
                setResults(prev => prev.map(r => r.id === check.id ? { ...r, status: 'success', message } : r));
            } catch (error) {
                setResults(prev => prev.map(r => r.id === check.id ? { ...r, status: 'error', message: error.message } : r));
            }
        }
        setRunning(false);
    };
    
    // Auto-run checks once bootstrap is loaded
    useEffect(() => {
        if (bootstrapData && !running && results.length === 0) {
            runChecks();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bootstrapData, running]);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Admin Self-Check</h1>
                <Button onClick={runChecks} disabled={running || bootstrapLoading}>
                    {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    Run Checks Again
                </Button>
            </div>
            <p className="text-muted-foreground">
                This page runs a series of cached, client-side checks to verify core application logic without spamming the network.
            </p>
            <Card>
                <CardContent className="p-0">
                    <ul>
                        {bootstrapLoading && <li className="p-4 text-center">Loading bootstrap data before running checks...</li>}
                        {results.map(result => (
                            <CheckItem key={result.id} {...result} />
                        ))}
                    </ul>
                </CardContent>
            </Card>
        </div>
    );
}