import React from 'react';
import { useAuth } from './useAuth';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { LayoutDashboard } from 'lucide-react'; // Placeholder icon

const LoadingScreen = () => (
    <div className="flex items-center justify-center h-screen w-screen bg-gray-100">
        <div className="flex flex-col items-center">
            <LayoutDashboard className="h-10 w-10 text-gray-400 animate-pulse" />
            <p className="text-lg text-gray-600 mt-4">Loading domestIQ...</p>
        </div>
    </div>
);

const ErrorScreen = ({ error, onRetry }) => (
    <div className="flex items-center justify-center h-screen w-screen bg-gray-100 p-4">
        <div className="max-w-md text-center bg-white p-8 rounded-lg shadow-md">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Authentication Error</h1>
            <p className="text-gray-600 mb-6">
                We couldn't log you in. This might be a temporary network issue.
            </p>
            {error?.message && (
                <pre className="text-xs text-left bg-gray-50 p-2 rounded border border-gray-200 mb-6 overflow-auto">
                    {error.message}
                </pre>
            )}
            <Button onClick={onRetry}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
            </Button>
        </div>
    </div>
);

export function AuthGate({ children }) {
    const { user, loading, error, retry } = useAuth();

    if (loading) {
        return <LoadingScreen />;
    }

    if (error) {
        return <ErrorScreen error={error} onRetry={retry} />;
    }
    
    // If user is null after loading and no error, it means not logged in
    // Handled by redirect in useAuth hook or specific page logic if public
    if (!user) {
         return <LoadingScreen />; // or a dedicated "Not Logged In" screen
    }
    
    return <>{children}</>;
}