// Utility functions for tenant-based filtering and data access

export const buildTenantFilter = (currentUser) => {
    if (!currentUser) return {};
    
    // Admin users can see all data (no filter)
    if (currentUser.app_role === 'Admin') {
        return {};
    }
    
    // Tenant users can only see their own data
    if (currentUser.app_role === 'Tenant' && currentUser.tenantId) {
        return { tenantId: currentUser.tenantId };
    }
    
    // Fallback: return empty filter (might show all data for legacy users)
    return {};
};

export const validateTenantAccess = (currentUser, entityTenantId) => {
    if (!currentUser) return false;
    
    // Admin can access any tenant's data
    if (currentUser.app_role === 'Admin') {
        return true;
    }
    
    // Tenant can only access their own data
    if (currentUser.app_role === 'Tenant') {
        return currentUser.tenantId === entityTenantId;
    }
    
    return false;
};

export const getDefaultTenantId = (currentUser) => {
    if (!currentUser) return null;
    
    // For tenant users, always use their tenantId
    if (currentUser.app_role === 'Tenant') {
        return currentUser.tenantId;
    }
    
    // For admin users, no default (they must select)
    return null;
};