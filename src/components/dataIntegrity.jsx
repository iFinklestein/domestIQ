// Data integrity utilities for ensuring uniqueness and validation

export const validateUniqueSerialNumber = async (serialNumber, currentAssetId = null) => {
    if (!serialNumber || !serialNumber.trim()) {
        return { isValid: true, message: null }; // Serial number is optional
    }
    
    const trimmedSerial = serialNumber.trim();
    const { Asset } = await import('@/api/entities');
    
    try {
        const existingAssets = await Asset.filter({ serialNumber: trimmedSerial });
        const duplicate = existingAssets.find(asset => asset.id !== currentAssetId);
        
        if (duplicate) {
            return {
                isValid: false,
                message: `Serial number "${trimmedSerial}" is already used by asset: ${duplicate.name}`
            };
        }
        
        return { isValid: true, message: null };
    } catch (error) {
        console.error('Error validating serial number uniqueness:', error);
        return { isValid: false, message: 'Unable to validate serial number uniqueness' };
    }
};

export const validateUniqueCategoryName = async (categoryName, currentCategoryId = null) => {
    if (!categoryName || !categoryName.trim()) {
        return { isValid: false, message: 'Category name is required' };
    }
    
    const trimmedName = categoryName.trim();
    const { Category } = await import('@/api/entities');
    
    try {
        const existingCategories = await Category.list();
        const duplicate = existingCategories.find(cat => 
            cat.id !== currentCategoryId && 
            cat.name.toLowerCase() === trimmedName.toLowerCase()
        );
        
        if (duplicate) {
            return {
                isValid: false,
                message: `Category name "${trimmedName}" already exists`
            };
        }
        
        return { isValid: true, message: null };
    } catch (error) {
        console.error('Error validating category name uniqueness:', error);
        return { isValid: false, message: 'Unable to validate category name uniqueness' };
    }
};

export const validateUniqueLocationName = async (locationName, parentId = null, currentLocationId = null) => {
    if (!locationName || !locationName.trim()) {
        return { isValid: false, message: 'Location name is required' };
    }
    
    const trimmedName = locationName.trim();
    const { Location } = await import('@/api/entities');
    
    try {
        const existingLocations = await Location.list();
        
        // Check for duplicate names under the same parent
        const duplicate = existingLocations.find(loc => 
            loc.id !== currentLocationId && 
            loc.name.toLowerCase() === trimmedName.toLowerCase() &&
            loc.parentId === parentId
        );
        
        if (duplicate) {
            const parentName = parentId 
                ? existingLocations.find(l => l.id === parentId)?.name || 'Unknown Parent'
                : 'Root Level';
                
            return {
                isValid: false,
                message: `Location name "${trimmedName}" already exists under ${parentName}`
            };
        }
        
        return { isValid: true, message: null };
    } catch (error) {
        console.error('Error validating location name uniqueness:', error);
        return { isValid: false, message: 'Unable to validate location name uniqueness' };
    }
};

// Search optimization utilities
export const createSearchIndex = (items, searchFields) => {
    const index = new Map();
    
    items.forEach(item => {
        const searchableText = searchFields
            .map(field => {
                const value = item[field];
                if (Array.isArray(value)) {
                    return value.join(' ');
                }
                return String(value || '');
            })
            .join(' ')
            .toLowerCase();
            
        // Create word-based index
        const words = searchableText.split(/\s+/).filter(word => word.length > 0);
        words.forEach(word => {
            if (!index.has(word)) {
                index.set(word, new Set());
            }
            index.get(word).add(item.id);
        });
    });
    
    return index;
};

export const searchItemsWithIndex = (searchTerm, index, items) => {
    if (!searchTerm || !searchTerm.trim()) {
        return items;
    }
    
    const words = searchTerm.toLowerCase().split(/\s+/).filter(word => word.length > 0);
    const itemsMap = new Map(items.map(item => [item.id, item]));
    
    if (words.length === 0) {
        return items;
    }
    
    // Find items that match all search words (AND operation)
    let matchingIds = null;
    
    for (const word of words) {
        const wordMatches = new Set();
        
        // Find all index entries that start with this word (prefix matching)
        for (const [indexWord, itemIds] of index.entries()) {
            if (indexWord.includes(word)) {
                for (const id of itemIds) {
                    wordMatches.add(id);
                }
            }
        }
        
        if (matchingIds === null) {
            matchingIds = wordMatches;
        } else {
            // Intersect with previous matches
            matchingIds = new Set([...matchingIds].filter(id => wordMatches.has(id)));
        }
        
        // If no matches for any word, return empty
        if (matchingIds.size === 0) {
            return [];
        }
    }
    
    return [...matchingIds].map(id => itemsMap.get(id)).filter(Boolean);
};

// Validation for asset tags (prevent duplicates, normalize format)
export const validateAndNormalizeTags = (tags) => {
    if (!Array.isArray(tags)) {
        return [];
    }
    
    const normalizedTags = tags
        .map(tag => String(tag).trim().toLowerCase())
        .filter(tag => tag.length > 0)
        .filter((tag, index, arr) => arr.indexOf(tag) === index); // Remove duplicates
    
    return normalizedTags.map(tag => 
        // Capitalize first letter of each word
        tag.split(' ').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ')
    );
};

// Data migration utility for backfilling/cleaning data
export const performDataIntegrityCheck = async () => {
    const issues = [];
    
    try {
        const { Asset } = await import('@/api/entities');
        const { Category } = await import('@/api/entities');
        const { Location } = await import('@/api/entities');
        const { Vendor } = await import('@/api/entities');
        
        const [assets, categories, locations, vendors] = await Promise.all([
            Asset.list(),
            Category.list(),
            Location.list(),
            Vendor.list()
        ]);
        
        // Check for duplicate serial numbers
        const serialNumbers = new Map();
        assets.forEach(asset => {
            if (asset.serialNumber && asset.serialNumber.trim()) {
                const serial = asset.serialNumber.trim().toLowerCase();
                if (serialNumbers.has(serial)) {
                    issues.push({
                        type: 'duplicate_serial',
                        message: `Duplicate serial number "${asset.serialNumber}" found in assets: ${serialNumbers.get(serial).name} and ${asset.name}`,
                        assets: [serialNumbers.get(serial), asset]
                    });
                } else {
                    serialNumbers.set(serial, asset);
                }
            }
        });
        
        // Check for duplicate category names
        const categoryNames = new Map();
        categories.forEach(category => {
            const name = category.name.toLowerCase();
            if (categoryNames.has(name)) {
                issues.push({
                    type: 'duplicate_category',
                    message: `Duplicate category name "${category.name}"`,
                    categories: [categoryNames.get(name), category]
                });
            } else {
                categoryNames.set(name, category);
            }
        });
        
        // Check for duplicate vendor names
        const vendorNames = new Map();
        vendors.forEach(vendor => {
            const name = vendor.name.toLowerCase().trim();
            if (vendorNames.has(name)) {
                issues.push({
                    type: 'duplicate_vendor',
                    message: `Duplicate vendor name "${vendor.name}"`,
                    vendors: [vendorNames.get(name), vendor]
                });
            } else {
                vendorNames.set(name, vendor);
            }
        });
        
        // Check for duplicate location names under same parent
        const locationsByParent = new Map();
        locations.forEach(location => {
            const parentId = location.parentId || 'root';
            if (!locationsByParent.has(parentId)) {
                locationsByParent.set(parentId, new Map());
            }
            
            const siblingLocations = locationsByParent.get(parentId);
            const name = location.name.toLowerCase();
            
            if (siblingLocations.has(name)) {
                issues.push({
                    type: 'duplicate_location',
                    message: `Duplicate location name "${location.name}" under same parent`,
                    locations: [siblingLocations.get(name), location]
                });
            } else {
                siblingLocations.set(name, location);
            }
        });
        
        return {
            success: true,
            issuesFound: issues.length,
            issues
        };
        
    } catch (error) {
        console.error('Data integrity check failed:', error);
        return {
            success: false,
            error: error.message,
            issues: []
        };
    }
};