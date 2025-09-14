import React from 'react';
import { loadBootstrap, clearBootstrap, subscribeToBootstrap } from './bootstrap';
import { isUserLoaded } from './auth';

export function useBootstrap() {
    const [state, setState] = React.useState({
        data: null,
        loading: false,
        error: null
    });

    React.useEffect(() => {
        const unsubscribe = subscribeToBootstrap(setState);
        
        // Only start bootstrap if user is loaded
        if (isUserLoaded()) {
            setState(prev => ({ ...prev, loading: true }));
            loadBootstrap().catch(() => {
                // Error is already handled by the bootstrap service
            });
        }

        return unsubscribe;
    }, []);

    const refetch = React.useCallback(() => {
        if (isUserLoaded()) {
            clearBootstrap();
            setState(prev => ({ ...prev, loading: true }));
            loadBootstrap().catch(() => {
                // Error is already handled by the bootstrap service
            });
        }
    }, []);

    return {
        ...state,
        refetch
    };
}