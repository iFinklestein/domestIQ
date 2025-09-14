import { AuditLog } from '@/api/entities';

/**
 * Log an audit event
 * @param {Object} params - Audit event parameters
 * @param {string} params.entityType - Type of entity (Property, Asset, etc.)
 * @param {string} params.entityId - ID of the entity
 * @param {string} params.action - Action performed (create, update, archive, restore, delete)
 * @param {Object} params.user - Current user object
 * @param {string} params.propertyId - Related property ID (optional)
 * @param {Object} params.details - Additional details (optional)
 */
export async function logAuditEvent({ 
    entityType, 
    entityId, 
    action, 
    user, 
    propertyId = null, 
    details = {} 
}) {
    if (!user || !entityType || !entityId || !action) {
        console.warn('Audit log: Missing required parameters');
        return;
    }

    try {
        await AuditLog.create({
            entity_type: entityType,
            entity_id: entityId,
            action,
            user_id: user.id,
            user_email: user.email,
            property_id: propertyId,
            details
        });
    } catch (error) {
        console.error('Failed to log audit event:', error);
        // Don't throw error to avoid breaking the main operation
    }
}

/**
 * Helper function to extract property ID from different entity types
 * @param {string} entityType 
 * @param {Object} entity 
 * @returns {string|null}
 */
export function extractPropertyId(entityType, entity) {
    switch (entityType) {
        case 'Property':
            return entity.id;
        case 'Asset':
            return entity.propertyId;
        case 'Tenancy':
            return entity.property_id;
        case 'MaintenanceRequest':
            return entity.property_id;
        default:
            return null;
    }
}

/**
 * Helper function to get entity name for display
 * @param {Object} entity 
 * @param {string} entityType 
 * @returns {string}
 */
export function getEntityDisplayName(entity, entityType) {
    if (!entity) return 'Unknown';
    
    switch (entityType) {
        case 'Property':
            return entity.name || 'Unnamed Property';
        case 'Asset':
            return entity.name || 'Unnamed Asset';
        case 'Tenancy':
            return `Tenancy ${entity.id?.slice(0, 8) || 'Unknown'}`;
        case 'MaintenanceRequest':
            return entity.title || 'Unnamed Request';
        default:
            return entity.name || entity.title || 'Unknown';
    }
}