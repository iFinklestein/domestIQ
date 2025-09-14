// Vendor deduplication and matching utilities

export const normalizeVendorName = (name) => {
    if (!name) return '';
    return String(name).trim().toLowerCase();
};

export const levenshteinDistance = (str1, str2) => {
    const matrix = [];
    
    // If one string is empty, return the length of the other
    if (str1.length === 0) return str2.length;
    if (str2.length === 0) return str1.length;
    
    // Initialize the matrix
    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }
    
    // Fill in the matrix
    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j] + 1      // deletion
                );
            }
        }
    }
    
    return matrix[str2.length][str1.length];
};

export const findVendorMatches = (inputName, existingVendors, threshold = 0.8) => {
    if (!inputName || !existingVendors.length) return { exact: null, fuzzy: [] };
    
    const normalizedInput = normalizeVendorName(inputName);
    const exact = existingVendors.find(v => normalizeVendorName(v.name) === normalizedInput);
    
    if (exact) return { exact, fuzzy: [] };
    
    // Find fuzzy matches
    const fuzzy = existingVendors
        .map(vendor => {
            const normalizedVendor = normalizeVendorName(vendor.name);
            const distance = levenshteinDistance(normalizedInput, normalizedVendor);
            const maxLength = Math.max(normalizedInput.length, normalizedVendor.length);
            const similarity = maxLength === 0 ? 0 : (maxLength - distance) / maxLength;
            
            return { vendor, similarity, distance };
        })
        .filter(match => match.similarity >= threshold)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 3) // Top 3 matches
        .map(match => match.vendor);
    
    return { exact: null, fuzzy };
};

export const validateVendorUniqueness = (name, existingVendors, currentId = null) => {
    if (!name) return { isValid: false, message: 'Vendor name is required.' };
    
    const normalizedName = normalizeVendorName(name);
    const duplicate = existingVendors.find(v => 
        v.id !== currentId && normalizeVendorName(v.name) === normalizedName
    );
    
    if (duplicate) {
        return { 
            isValid: false, 
            message: `A vendor with this name already exists: "${duplicate.name}"` 
        };
    }
    
    return { isValid: true, message: null };
};