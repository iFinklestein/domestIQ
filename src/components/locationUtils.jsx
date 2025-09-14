// Utility functions for location hierarchy management
export const buildLocationBreadcrumb = (locationId, allLocations) => {
    if (!locationId || !allLocations.length) return '';
    
    const breadcrumb = [];
    let currentLocation = allLocations.find(l => l.id === locationId);
    
    // Build breadcrumb path up to root, preventing infinite loops
    const visited = new Set();
    while (currentLocation && !visited.has(currentLocation.id)) {
        visited.add(currentLocation.id);
        breadcrumb.unshift(currentLocation.name);
        
        if (currentLocation.parentId) {
            currentLocation = allLocations.find(l => l.id === currentLocation.parentId);
        } else {
            break;
        }
    }
    
    return breadcrumb.join(' > ');
};

export const wouldCreateCycle = (locationId, proposedParentId, allLocations) => {
    if (!proposedParentId) return false;
    if (locationId === proposedParentId) return true;
    
    // Check if proposedParentId is a descendant of locationId
    const visited = new Set();
    let currentLocation = allLocations.find(l => l.id === proposedParentId);
    
    while (currentLocation && !visited.has(currentLocation.id)) {
        visited.add(currentLocation.id);
        
        if (currentLocation.id === locationId) {
            return true; // Found a cycle
        }
        
        if (currentLocation.parentId) {
            currentLocation = allLocations.find(l => l.id === currentLocation.parentId);
        } else {
            break;
        }
    }
    
    return false;
};

export const buildHierarchicalLocationList = (allLocations) => {
    const hierarchy = [];
    const locationMap = new Map(allLocations.map(l => [l.id, { ...l, children: [] }]));
    
    // Build parent-child relationships
    for (const location of allLocations) {
        const locationWithChildren = locationMap.get(location.id);
        if (location.parentId) {
            const parent = locationMap.get(location.parentId);
            if (parent) {
                parent.children.push(locationWithChildren);
            }
        } else {
            // Root level location
            hierarchy.push(locationWithChildren);
        }
    }
    
    // Flatten for display with indentation
    const flattenWithIndent = (locations, depth = 0) => {
        const result = [];
        for (const location of locations) {
            result.push({
                ...location,
                displayName: '  '.repeat(depth) + location.name,
                depth
            });
            if (location.children.length > 0) {
                result.push(...flattenWithIndent(location.children, depth + 1));
            }
        }
        return result;
    };
    
    return flattenWithIndent(hierarchy);
};