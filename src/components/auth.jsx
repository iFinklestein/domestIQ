import { User } from '@/api/entities';
import { migrateUserRole } from '@/components/roles';

// Single source of truth for user state
let userCache = null;
let inflight = null;
let listeners = new Set();

export async function loadUser() {
    // Return cached user if available
    if (userCache) return userCache;
    
    // Return in-flight promise if already loading
    if (inflight) return inflight;
    
    // Start loading user
    inflight = (async () => {
        try {
            const user = await User.me();
            const migratedUser = await migrateUserRole(user);
            userCache = {
                id: migratedUser.id,
                email: migratedUser.email,
                full_name: migratedUser.full_name,
                app_role: migratedUser.app_role,
                role: migratedUser.role // Keep legacy role field for compatibility
            };
            notifyListeners({ user: userCache, error: null, loading: false });
            return userCache;
        } catch (error) {
            console.error('Failed to load user:', error);
            notifyListeners({ user: null, error, loading: false });
            throw error;
        }
    })().finally(() => {
        inflight = null;
    });
    
    return inflight;
}

export function clearUser() {
    userCache = null;
    inflight = null;
    notifyListeners({ user: null, error: null, loading: false });
}

export function getCurrentUser() {
    return userCache;
}

export function isUserLoaded() {
    return userCache !== null;
}

// Subscribe to user state changes
export function subscribeToUser(listener) {
    listeners.add(listener);
    // Immediately notify with current state
    const loading = inflight !== null;
    listener({ user: userCache, error: null, loading });
    return () => listeners.delete(listener);
}

function notifyListeners(state) {
    listeners.forEach(listener => listener(state));
}