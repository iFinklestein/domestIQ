import React, { useState, useEffect, useCallback } from 'react';
import { User } from '@/api/entities';
import { AuditLog } from '@/api/entities';
import { Property } from '@/api/entities';
import { isAdmin, migrateUserRole } from '@/components/roles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, RefreshCw, FileText, Box, Building2, Wrench } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from "@/components/ui/use-toast";

const ENTITY_ICONS = {
    Property: Building2,
    Asset: Box,
    Tenancy: FileText,
    MaintenanceRequest: Wrench
};

const ACTION_COLORS = {
    create: 'bg-green-100 text-green-800',
    update: 'bg-blue-100 text-blue-800',
    archive: 'bg-yellow-100 text-yellow-800',
    restore: 'bg-purple-100 text-purple-800',
    delete: 'bg-red-100 text-red-800'
};

export default function ActivityLogPage() {
    const [logs, setLogs] = useState([]);
    const [properties, setProperties] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        search: '',
        entityType: 'all',
        action: 'all',
        propertyId: 'all'
    });
    const [currentUser, setCurrentUser] = useState(null);
    const { toast } = useToast();

    const fetchData = useCallback(async (user) => {
        if (!isAdmin(user)) {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            // Fetch recent audit logs (limit to last 1000 for performance)
            const auditLogs = await AuditLog.list('-created_date', 1000);
            setLogs(auditLogs);

            // Fetch properties for filter dropdown
            const allProperties = await Property.list();
            setProperties(allProperties);

        } catch (error) {
            console.error("Failed to fetch activity logs:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not load activity logs." });
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

    const handleRefresh = () => {
        if (currentUser) {
            fetchData(currentUser);
        }
    };

    const filteredLogs = logs.filter(log => {
        if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            const matchesSearch = (
                log.user_email.toLowerCase().includes(searchTerm) ||
                log.entity_id.toLowerCase().includes(searchTerm) ||
                log.action.toLowerCase().includes(searchTerm)
            );
            if (!matchesSearch) return false;
        }
        
        if (filters.entityType !== 'all' && log.entity_type !== filters.entityType) return false;
        if (filters.action !== 'all' && log.action !== filters.action) return false;
        if (filters.propertyId !== 'all' && log.property_id !== filters.propertyId) return false;
        
        return true;
    });

    if (loading) return <div>Loading activity log...</div>;

    if (!isAdmin(currentUser)) {
        return (
            <div className="text-center py-12">
                <FileText className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">Access Denied</h3>
                <p className="mt-1 text-sm text-gray-500">Only administrators can view the activity log.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Activity Log</h1>
                <Button variant="outline" onClick={handleRefresh}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                </Button>
            </div>

            {/* Filters */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Filters</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by user, entity ID, or action..."
                                value={filters.search}
                                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                                className="pl-9"
                            />
                        </div>

                        <Select value={filters.entityType} onValueChange={(value) => setFilters({ ...filters, entityType: value })}>
                            <SelectTrigger>
                                <SelectValue placeholder="All Entity Types" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Entity Types</SelectItem>
                                <SelectItem value="Property">Properties</SelectItem>
                                <SelectItem value="Asset">Assets</SelectItem>
                                <SelectItem value="Tenancy">Tenancies</SelectItem>
                                <SelectItem value="MaintenanceRequest">Maintenance Requests</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={filters.action} onValueChange={(value) => setFilters({ ...filters, action: value })}>
                            <SelectTrigger>
                                <SelectValue placeholder="All Actions" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Actions</SelectItem>
                                <SelectItem value="create">Create</SelectItem>
                                <SelectItem value="update">Update</SelectItem>
                                <SelectItem value="archive">Archive</SelectItem>
                                <SelectItem value="restore">Restore</SelectItem>
                                <SelectItem value="delete">Delete</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={filters.propertyId} onValueChange={(value) => setFilters({ ...filters, propertyId: value })}>
                            <SelectTrigger>
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
                </CardContent>
            </Card>

            {/* Activity Log Table */}
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Timestamp</TableHead>
                                <TableHead>User</TableHead>
                                <TableHead>Entity</TableHead>
                                <TableHead>Action</TableHead>
                                <TableHead>Entity ID</TableHead>
                                <TableHead>Property</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan="6" className="text-center py-12">Loading...</TableCell>
                                </TableRow>
                            ) : filteredLogs.length > 0 ? (
                                filteredLogs.map((log) => {
                                    const EntityIcon = ENTITY_ICONS[log.entity_type] || FileText;
                                    const property = properties.find(p => p.id === log.property_id);
                                    
                                    return (
                                        <TableRow key={log.id}>
                                            <TableCell className="font-mono text-sm">
                                                {format(new Date(log.created_date), 'MMM d, HH:mm:ss')}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{log.user_email}</span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {log.user_id.slice(0, 8)}...
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <EntityIcon className="h-4 w-4 text-muted-foreground" />
                                                    <span>{log.entity_type}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-800'}>
                                                    {log.action}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="font-mono text-sm">
                                                {log.entity_id.slice(0, 8)}...
                                            </TableCell>
                                            <TableCell>
                                                {property ? property.name : '—'}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            ) : (
                                <TableRow>
                                    <TableCell colSpan="6" className="text-center py-12">
                                        <div className="flex flex-col items-center gap-2">
                                            <FileText className="w-12 h-12 text-muted-foreground" />
                                            <p className="text-muted-foreground">No activity found matching your filters.</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <div className="text-sm text-muted-foreground text-center">
                Showing {filteredLogs.length} of {logs.length} recent activities
            </div>
        </div>
    );
}