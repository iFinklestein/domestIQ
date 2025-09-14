import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, RefreshCw } from 'lucide-react';

export const EmptyState = ({ 
    icon: Icon, 
    title, 
    description, 
    actionLabel, 
    onAction, 
    secondaryActionLabel, 
    onSecondaryAction,
    showRetry = false,
    onRetry,
    loading = false
}) => {
    return (
        <Card>
            <CardContent className="text-center py-12">
                {Icon && <Icon className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />}
                <h3 className="text-lg font-semibold mb-2">{title}</h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">{description}</p>
                <div className="flex flex-col sm:flex-row gap-2 justify-center">
                    {onAction && (
                        <Button onClick={onAction} disabled={loading}>
                            {loading ? (
                                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <Plus className="w-4 h-4 mr-2" />
                            )}
                            {actionLabel}
                        </Button>
                    )}
                    {onSecondaryAction && (
                        <Button variant="outline" onClick={onSecondaryAction}>
                            {secondaryActionLabel}
                        </Button>
                    )}
                    {showRetry && onRetry && (
                        <Button variant="outline" onClick={onRetry} disabled={loading}>
                            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                            Retry
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

export const ErrorState = ({ 
    title = "Something went wrong", 
    description = "We encountered an error while loading your data.", 
    onRetry, 
    requestId,
    loading = false 
}) => {
    return (
        <Card className="border-red-200 bg-red-50">
            <CardContent className="text-center py-12">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                    <RefreshCw className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-red-900">{title}</h3>
                <p className="text-red-700 mb-2">{description}</p>
                {requestId && (
                    <p className="text-xs text-red-600 mb-6">Request ID: {requestId}</p>
                )}
                {onRetry && (
                    <Button variant="outline" onClick={onRetry} disabled={loading}>
                        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Try Again
                    </Button>
                )}
            </CardContent>
        </Card>
    );
};