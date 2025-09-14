
import { Property } from '@/api/entities';
import { Category } from '@/api/entities';
import { Location } from '@/api/entities';
import { Vendor } from '@/api/entities';
import { Asset } from '@/api/entities';
import { Tenancy } from '@/api/entities';
import { Unit } from '@/api/entities';
import { ManagementAssignment } from '@/api/entities';
import { isAdmin, isLandlord, isPropertyManager, isTenant, isLandlordOrPM } from '@/components/roles';
import { loadUser, isUserLoaded } from './auth';

// Helper to prevent request bursts
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Single bootstrap cache
let bootstrapCache = null;
let bootstrapInflight = null;
let bootstrapListeners = new Set();

export async function loadBootstrap() {
    // GATE: Do not bootstrap until user is loaded
    if (!isUserLoaded()) {
        throw new Error('Cannot bootstrap: user not loaded. Call loadUser() first.');
    }
    
    // Return cached bootstrap if available
    if (bootstrapCache) return bootstrapCache;
    
    // Return in-flight promise if already loading
    if (bootstrapInflight) return bootstrapInflight;
    
    const user = await loadUser(); // This should be cached at this point
    
    bootstrapInflight = (async () => {
        try {
            const result = {
                user,
                properties: [],
                categories: [],
                locations: [],
                vendors: [],
                assets: [],
                tenancies: [],
                units: [],
                loadedAt: Date.now()
            };

            // Fetch core data sequentially WITH DELAYS to avoid rate-limiting
            result.categories = (await (isAdmin(user) ? Category.list('-created_date') : Category.filter({ created_by: user.email }, '-created_date')));
            await delay(250);
            result.locations = (await Location.list('-created_date'));
            await delay(250);
            result.vendors = (await Vendor.list('-created_date'));
            await delay(250);
            result.properties = (await loadUserProperties(user));
            
            // Load data dependent on the core fetches
            const propertyIds = result.properties.map(p => p.id);
            if (propertyIds.length > 0) {
                result.units = await Unit.filter({ property_id: propertyIds });
                await delay(250);

                const unitIds = result.units.map(u => u.id);
                if (unitIds.length > 0) {
                    result.tenancies = await Tenancy.filter({ unit_id: unitIds });
                    await delay(250);
                }

                result.assets = await loadUserAssets(user, result.properties, result.tenancies) || [];
            }

            bootstrapCache = result;
            notifyBootstrapListeners({ data: result, error: null, loading: false });
            return result;
            
        } catch (error) {
            console.error('Bootstrap failed:', error);
            notifyBootstrapListeners({ data: null, error, loading: false });
            throw error;
        }
    })().finally(() => {
        bootstrapInflight = null;
    });
    
    return bootstrapInflight;
}

async function loadUserProperties(user) {
    if (isPropertyManager(user)) {
        const assignments = await ManagementAssignment.filter({ pm_user_id: user.id, status: 'active' });
        if (!assignments || assignments.length === 0) return [];
        await delay(250);
        const propertyIds = assignments.map(a => a.property_id);
        return Property.filter({ id: propertyIds, status: 'active' });
    } else if (isAdmin(user) || isLandlord(user)) {
        return Property.filter({ owner_user_id: user.id, status: 'active' });
    } else if (isTenant(user)) {
        const userTenancies = await Tenancy.filter({ tenant_user_id: user.id, status: 'active' });
        if (!userTenancies || userTenancies.length === 0) return [];
        await delay(250);
        const unitIds = userTenancies.map(t => t.unit_id);
        const units = await Unit.filter({ id: unitIds });
        if (!units || units.length === 0) return [];
        await delay(250);
        const propertyIds = [...new Set(units.map(u => u.property_id))];
        if (propertyIds.length === 0) return [];
        return Property.filter({ id: propertyIds, status: 'active' });
    }
    return [];
}

async function loadUserAssets(user, properties, tenancies) {
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

export function clearBootstrap() {
    bootstrapCache = null;
    bootstrapInflight = null;
    notifyBootstrapListeners({ data: null, error: null, loading: false });
}

export function getBootstrap() {
    return bootstrapCache;
}

export function isBootstrapLoaded() {
    return bootstrapCache !== null;
}

// Subscribe to bootstrap state changes
export function subscribeToBootstrap(listener) {
    bootstrapListeners.add(listener);
    // Immediately notify with current state
    const loading = bootstrapInflight !== null;
    listener({ data: bootstrapCache, error: null, loading });
    return () => bootstrapListeners.delete(listener);
}

function notifyBootstrapListeners(state) {
    bootstrapListeners.forEach(listener => listener(state));
}
