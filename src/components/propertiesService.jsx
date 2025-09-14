
import { Property } from '@/api/entities';
import { Tenancy } from '@/api/entities';
import { Unit } from '@/api/entities';
import { ManagementAssignment } from '@/api/entities';
import { isAdmin, isLandlord, isPropertyManager, isTenant } from '@/components/roles';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Centralized service to fetch properties for the current user
 * This ensures consistent scoping across all components
 * IMPORTANT: This is the ONLY source of truth for property data in selectors
 */
export async function getPropertiesForCurrentUser(currentUser) {
    if (!currentUser) {
        console.warn('getPropertiesForCurrentUser: No user provided');
        return [];
    }

    try {
        let userProperties = [];

        if (isPropertyManager(currentUser)) {
            // PMs see properties they are actively assigned to
            const assignments = await ManagementAssignment.filter({
                pm_user_id: currentUser.id,
                status: 'active'
            });
            await delay(250); // Throttle
            const propertyIds = assignments.map(a => a.property_id);
            if (propertyIds.length > 0) {
                const allProps = await Property.filter({ id: propertyIds });
                userProperties = allProps.filter(p => p.status !== 'archived');
            }
        } else if (isAdmin(currentUser) || isLandlord(currentUser)) {
            // Admins and Landlords see properties they own
            const allUserProperties = await Property.filter({ owner_user_id: currentUser.id });
            userProperties = allUserProperties.filter(p => p.status !== 'archived');
        } else if (isTenant(currentUser)) {
            // Tenants see properties where they have active tenancies
            const userTenancies = await Tenancy.filter({
                tenant_user_id: currentUser.id,
                status: 'active'
            });
            await delay(250); // Throttle
            
            if (userTenancies.length > 0) {
                const unitIds = userTenancies.map(t => t.unit_id);
                const units = await Unit.filter({ id: unitIds });
                await delay(250); // Throttle
                const propertyIds = [...new Set(units.map(u => u.property_id))];

                if (propertyIds.length > 0) {
                    const propertiesFromTenancy = await Property.filter({ id: propertyIds });
                    userProperties = propertiesFromTenancy.filter(p => p.status !== 'archived');
                }
            }
        }

        // Client-side data hygiene: Filter out invalid data
        const cleanedProperties = userProperties.filter(property => {
            // Ensure property has a valid name and ID
            if (!property.name || !property.id) {
                console.warn('Excluding invalid property:', property.id);
                return false;
            }
            
            return true;
        });

        // Sort by name for consistent ordering everywhere
        const sortedProperties = cleanedProperties.sort((a, b) => a.name.localeCompare(b.name));

        // Log for debugging consistency
        console.log('getPropertiesForCurrentUser result:', {
            userId: currentUser.id,
            userRole: currentUser.app_role,
            rawCount: userProperties.length,
            cleanedCount: cleanedProperties.length,
            resultCount: sortedProperties.length,
            propertyIds: sortedProperties.map(p => p.id)
        });

        return sortedProperties;
    } catch (error) {
        console.error('getPropertiesForCurrentUser error:', error);
        throw error;
    }
}

/**
 * Emergency function to restore archived properties
 */
export async function restoreArchivedProperties(currentUser) {
    if (!currentUser || (!isAdmin(currentUser) && !isLandlord(currentUser) && !isPropertyManager(currentUser))) {
        console.warn('Cannot restore properties: insufficient permissions');
        return { restored: 0, errors: [] };
    }

    try {
        let propertiesToConsider = [];
        if (isAdmin(currentUser) || isLandlord(currentUser)) {
            propertiesToConsider = await Property.filter({ owner_user_id: currentUser.id });
        } else if (isPropertyManager(currentUser)) {
            const assignments = await ManagementAssignment.filter({
                pm_user_id: currentUser.id,
                status: 'active'
            });
            const propertyIds = assignments.map(a => a.property_id);
            if (propertyIds.length > 0) {
                propertiesToConsider = await Property.filter({ id: propertyIds });
            }
        }

        const archivedProperties = propertiesToConsider.filter(p => p.status === 'archived');
        
        let restored = 0;
        const errors = [];

        for (const property of archivedProperties) {
            try {
                await Property.update(property.id, { status: 'active' });
                restored++;
                console.log('Restored property:', property.id, property.name);
            } catch (error) {
                console.error('Failed to restore property:', property.id, error);
                errors.push({ id: property.id, name: property.name, error: error.message });
            }
        }

        return { restored, errors, total: archivedProperties.length };
    } catch (error) {
        console.error('Failed to restore archived properties:', error);
        return { restored: 0, errors: [{ error: error.message }], total: 0 };
    }
}
