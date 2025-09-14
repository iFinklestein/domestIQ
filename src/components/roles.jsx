
export const ROLES = {
    ADMIN: 'Admin',
    LANDLORD: 'Landlord',
    PROPERTY_MANAGER: 'PropertyManager', 
    TENANT: 'Tenant',
};

export function normalizeRole(role) {
    const r = (role ?? "").toString().trim().toLowerCase();
    if (r === "admin") return "Admin";
    if (r === "landlord") return "Landlord";
    if (r === "propertymanager" || r === "property_manager") return "PropertyManager";
    if (r === "tenant") return "Tenant";
    return "Admin"; // safe default for now
}

export function isAdmin(user) {
    return normalizeRole(user?.app_role) === "Admin";
}

export function isLandlord(user) {
    return normalizeRole(user?.app_role) === "Landlord";
}

export function isPropertyManager(user) {
    return normalizeRole(user?.app_role) === "PropertyManager";
}

export function isTenant(user) {
    return normalizeRole(user?.app_role) === "Tenant";
}

export function isLandlordOrPM(user) {
    return isLandlord(user) || isPropertyManager(user);
}

export function canWrite(user) {
    // Admins, Landlords, and Property Managers can write
    return isAdmin(user) || isLandlord(user) || isPropertyManager(user);
}

export function canWriteGlobal(user) {
    // Only Admins can write global/cross-tenant data
    return isAdmin(user);
}

export function canManageTenants(user) {
    return isAdmin(user) || isLandlord(user) || isPropertyManager(user);
}

export function canManageProperties(user) {
    return isAdmin(user) || isLandlord(user) || isPropertyManager(user);
}

export function getUserTenantId(user) {
    return user?.tenantId || null;
}

// Asset permission helpers
export function canReadAsset(user, asset, userProperties = [], userTenancies = []) {
    if (!user || !asset) return false;
    
    if (isAdmin(user)) return true;
    
    if (isLandlordOrPM(user)) {
        // Can read rental-owned assets for their properties only
        if (asset.ownerType === 'rental') {
            return userProperties.some(p => p.id === asset.propertyId);
        }
        // Cannot read tenant-owned assets
        return false;
    }
    
    if (isTenant(user)) {
        // Can read their own tenant-owned assets
        if (asset.ownerType === 'tenant') {
            return userTenancies.some(t => t.id === asset.tenancyId && t.status === 'Active');
        }
        // Can read rental-owned assets in their property (read-only)
        if (asset.ownerType === 'rental') {
            return userTenancies.some(t => t.property_id === asset.propertyId && t.status === 'Active');
        }
    }
    
    return false;
}

export function canWriteAsset(user, asset, userProperties = [], userTenancies = []) {
    if (!user || !asset) return false;
    
    if (isAdmin(user)) return true;
    
    if (isLandlordOrPM(user)) {
        // Can write rental-owned assets for their properties only
        if (asset.ownerType === 'rental') {
            return userProperties.some(p => p.id === asset.propertyId);
        }
        // Cannot write tenant-owned assets
        return false;
    }
    
    if (isTenant(user)) {
        // Can write their own tenant-owned assets only
        if (asset.ownerType === 'tenant') {
            return userTenancies.some(t => t.id === asset.tenancyId && t.status === 'Active');
        }
        // Cannot write rental-owned assets
        return false;
    }
    
    return false;
}

// Migration utility to normalize user roles
export async function migrateUserRole(user) {
    if (!user) return null;

    // Determine the correct role value from the new 'app_role' or old 'role' field
    const roleValue = user.app_role ?? user.role;
    const normalizedRole = normalizeRole(roleValue);

    // If the new field (`app_role`) is not set to the correct normalized value, update it
    if (user.app_role !== normalizedRole) {
        try {
            const { User } = await import('@/api/entities');
            // Update the user data with the new field name
            await User.updateMyUserData({ app_role: normalizedRole });
            // Return a user object that reflects the change for the current session
            return { ...user, app_role: normalizedRole };
        } catch (error) {
            console.error('Failed to migrate user role:', error);
            // On failure, still return a conceptually correct user for the UI to work this session
            return { ...user, app_role: normalizedRole };
        }
    }

    // No migration needed
    return user;
}
