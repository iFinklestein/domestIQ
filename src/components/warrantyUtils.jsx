import { differenceInDays, isBefore, startOfDay } from 'date-fns';

/**
 * Calculates the warranty status of an asset.
 * @param {object} asset The asset entity object with warrantyEndDate.
 * @returns {{status: string, label: string, days: number|null, badgeVariant: string, isExpiring: boolean}}
 */
export const getWarrantyStatus = (asset) => {
    if (!asset?.warrantyEndDate) {
        return { 
            status: 'none', 
            label: 'No Warranty', 
            days: null, 
            badgeVariant: 'secondary',
            isExpiring: false 
        };
    }

    const now = startOfDay(new Date());
    const endDate = startOfDay(new Date(asset.warrantyEndDate));
    const days = differenceInDays(endDate, now);

    if (isBefore(endDate, now)) {
        return { 
            status: 'expired', 
            label: 'Expired', 
            days, 
            badgeVariant: 'destructive',
            isExpiring: false 
        };
    }
    
    // "Expiring Soon" is defined as 30 days or less.
    if (days <= 30) {
        return { 
            status: 'expiring', 
            label: `${days} days left`, 
            days, 
            badgeVariant: 'destructive',
            isExpiring: true 
        };
    }
    
    // To distinguish from very long-term warranties, flag those expiring within 90 days.
    if (days <= 90) {
        return { 
            status: 'active_soon', 
            label: 'Active', 
            days, 
            badgeVariant: 'outline',
            isExpiring: false 
        };
    }
    
    return { 
        status: 'active', 
        label: 'Active', 
        days, 
        badgeVariant: 'default',
        isExpiring: false 
    };
};

/**
 * Filters a list of assets by a given warranty status.
 * @param {Array<object>} assets The list of assets to filter.
 * @param {string} status The status to filter by ('all', 'active', 'expiring', 'expired', 'none').
 * @returns {Array<object>} The filtered list of assets.
 */
export const filterAssetsByWarrantyStatus = (assets, status) => {
    if (!status || status === 'all') return assets;
    
    return assets.filter(asset => {
        const warrantyInfo = getWarrantyStatus(asset);
        
        switch (status) {
            case 'active':
                return warrantyInfo.status === 'active' || warrantyInfo.status === 'active_soon';
            case 'expiring':
                return warrantyInfo.isExpiring;
            case 'expired':
                return warrantyInfo.status === 'expired';
            case 'none':
                return warrantyInfo.status === 'none';
            default:
                return true;
        }
    });
};

/**
 * A React component to display a warranty badge for an asset.
 * @param {{asset: object, showDays?: boolean}} props
 */
export const WarrantyBadge = ({ asset, showDays = true }) => {
    const status = getWarrantyStatus(asset);
    
    if (status.status === 'none') {
        return null; // Don't show a badge if there's no warranty
    }
    
    const displayText = showDays && status.days !== null && status.days >= 0 && status.days <= 90
        ? `Warranty: ${status.label}`
        : `Warranty: ${status.status === 'expired' ? 'Expired' : 'Active'}`;
    
    return (
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
            status.badgeVariant === 'destructive' 
                ? 'bg-red-100 text-red-800 border border-red-200' 
                : status.badgeVariant === 'outline'
                ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                : 'bg-green-100 text-green-800 border border-green-200'
        }`}>
            {displayText}
        </span>
    );
};