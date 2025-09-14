import React from 'react';
import { loadUser, clearUser, subscribeToUser } from './auth';

export function useAuth() {
    const [state, setState] = React.useState({
        user: null,
        loading: true,
        error: null
    });

    React.useEffect(() => {
        const unsubscribe = subscribeToUser(setState);
        
        // Start loading user immediately
        loadUser().catch(() => {
            // Error is already handled by the auth service
        });

        return unsubscribe;
    }, []);

    const retry = React.useCallback(() => {
        clearUser();
        loadUser().catch(() => {
            // Error is already handled by the auth service
        });
    }, []);

    return {
        ...state,
        retry
    };
}