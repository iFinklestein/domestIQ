import React from 'react';
import { Property } from '@/api/entities';
import { Category } from '@/api/entities';
import { Location } from '@/api/entities';
import { Vendor } from '@/api/entities';
import { Asset } from '@/api/entities';
import { Tenancy } from '@/api/entities';
import { Unit } from '@/api/entities';
import { ManagementAssignment } from '@/api/entities';
import { isAdmin, isLandlord, isPropertyManager, isTenant, isLandlordOrPM } from '@/components/roles';

export class BootstrapService {
    constructor() {
        this.bootstrapPromise = null;
    }

    async bootstrap(user) {
        if (!user) return null;

        if (this.bootstrapPromise) return this.bootstrapPromise;

        this.bootstrapPromise = this._performBootstrap(user);
        
        try {
            const result = await this.bootstrapPromise;
            return result;
        } finally {
            this.bootstrapPromise = null;
        }
    }

    async _performBootstrap(user) {
        const result = {
            user, properties: [], categories: [], locations: [], vendors: [],
            assets: [], tenancies: [], units: [], loadedAt: Date.now()
        };

        try {
            const [categories, locations, vendors, userProperties] = await Promise.all([
                isAdmin(user) ? Category.list('-created_date') : Category.filter({ created_by: user.email }, '-created_date'),
                Location.list('-created_date'),
                Vendor.list('-created_date'),
                this._loadUserProperties(user)
            ]);

            result.categories = categories || [];
            result.locations = locations || [];
            result.vendors = vendors || [];
            result.properties = userProperties || [];
            
            const propertyIds = result.properties.map(p => p.id);
            if (propertyIds.length > 0) {
                result.units = await Unit.filter({ property_id: propertyIds }) || [];

                const unitIds = result.units.map(u => u.id);
                if (unitIds.length > 0) {
                    result.tenancies = await Tenancy.filter({ unit_id: unitIds }) || [];
                }

                result.assets = await this._loadUserAssets(user, result.properties, result.tenancies) || [];
            }
            return result;
        } catch (error) {
            console.error('Bootstrap failed:', error);
            throw error; // Re-throw to be caught by the hook
        }
    }

    async _loadUserProperties(user) {
        if (isPropertyManager(user)) {
            const assignments = await ManagementAssignment.filter({ pm_user_id: user.id, status: 'active' });
            if (!assignments || assignments.length === 0) return [];
            const propertyIds = assignments.map(a => a.property_id);
            return Property.filter({ id: propertyIds, status: 'active' });
        } else if (isAdmin(user) || isLandlord(user)) {
            return Property.filter({ owner_user_id: user.id, status: 'active' });
        } else if (isTenant(user)) {
            const userTenancies = await Tenancy.filter({ tenant_user_id: user.id, status: 'active' });
            if (!userTenancies || userTenancies.length === 0) return [];
            const unitIds = userTenancies.map(t => t.unit_id);
            const units = await Unit.filter({ id: unitIds });
            if (!units || units.length === 0) return [];
            const propertyIds = [...new Set(units.map(u => u.property_id))];
            if (propertyIds.length === 0) return [];
            return Property.filter({ id: propertyIds, status: 'active' });
        }
        return [];
    }

    async _loadUserAssets(user, properties, tenancies) {
        const propertyIds = properties.map(p => p.id);
        
        if (isLandlordOrPM(user)) {
            if (propertyIds.length > 0) {
                return Asset.filter({ propertyId: propertyIds, ownerType: 'rental' });
            }
            return [];
        } else if (isTenant(user)) {
            const tenancyIds = tenancies.filter(t => t.status === 'active').map(t => t.id);
            const tenantAssets = tenancyIds.length > 0 ? Asset.filter({ tenancyId: tenancyIds, ownerType: 'tenant' }) : Promise.resolve([]);
            const rentalAssets = propertyIds.length > 0 ? Asset.filter({ propertyId: propertyIds, ownerType: 'rental' }) : Promise.resolve([]);
            const [tenantResults, rentalResults] = await Promise.all([tenantAssets, rentalAssets]);
            return [...(tenantResults || []), ...(rentalResults || [])];
        } else { // Admin or other roles
            return Asset.list('-created_date');
        }
    }
}

export const bootstrapService = new BootstrapService();

export function useBootstrap(user) {
    const [data, setData] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);

    const fetchBootstrap = React.useCallback(async () => {
        if (!user) {
            setData(null);
            setLoading(false);
            return;
        }
        try {
            setLoading(true);
            setError(null);
            const result = await bootstrapService.bootstrap(user);
            setData(result);
        } catch (err) {
            setError(err);
        } finally {
            setLoading(false);
        }
    }, [user]);

    React.useEffect(() => {
        fetchBootstrap();
    }, [fetchBootstrap]);

    return { data, loading, error, refetch: fetchBootstrap };
}