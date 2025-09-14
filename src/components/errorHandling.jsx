import React from 'react';
import { useToast } from "@/components/ui/use-toast";

// A simple, non-looping error handler.
export class ApiErrorHandler {
    static toast = null;

    static setToast(toastFunction) {
        this.toast = toastFunction;
    }

    static handleError(error, operation = 'operation') {
        console.error(`API Error during ${operation}:`, error);

        if (this.toast) {
            this.toast({
                variant: "destructive",
                title: `Error during ${operation}`,
                description: error.message || "An unknown error occurred.",
                duration: 5000,
            });
        }
    }
}

export const useApiErrorHandler = () => {
    const { toast } = useToast();
    
    React.useEffect(() => {
        ApiErrorHandler.setToast(toast);
    }, [toast]);

    return {
        handleError: (error, operation) => 
            ApiErrorHandler.handleError(error, operation),
    };
};

// A basic data fetching hook with NO automatic retries.
export const useDataFetching = (fetchFunction, dependencies = [], options = {}) => {
    const [data, setData] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const { handleError } = useApiErrorHandler();
    
    const { operation = 'load data' } = options;

    const fetchData = React.useCallback(async (showLoading = true) => {
        if (showLoading) setLoading(true);
        setError(null);

        try {
            const result = await fetchFunction();
            setData(result);
        } catch (err) {
            setError(err);
            handleError(err, operation);
        } finally {
            setLoading(false);
        }
    }, [fetchFunction, operation, handleError]);

    const retry = () => fetchData(true);

    React.useEffect(() => {
        fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fetchData, ...dependencies]);

    return { data, loading, error, retry, refetch: fetchData };
};