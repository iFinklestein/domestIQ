import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertTriangle, RefreshCw, Database } from 'lucide-react';
import { performDataIntegrityCheck } from './dataIntegrity';
import { useToast } from '@/components/ui/use-toast';

export default function DataIntegrityPanel() {
    const [checking, setChecking] = useState(false);
    const [lastCheck, setLastCheck] = useState(null);
    const [issues, setIssues] = useState([]);
    const { toast } = useToast();

    const handleIntegrityCheck = async () => {
        setChecking(true);
        try {
            const result = await performDataIntegrityCheck();
            setLastCheck({
                timestamp: new Date(),
                success: result.success,
                issuesFound: result.issuesFound,
                error: result.error
            });
            setIssues(result.issues || []);
            
            if (result.success) {
                toast({
                    title: "Integrity Check Complete",
                    description: `Found ${result.issuesFound} potential issues`,
                });
            } else {
                toast({
                    variant: "destructive",
                    title: "Integrity Check Failed",
                    description: result.error,
                });
            }
        } catch (error) {
            console.error('Integrity check error:', error);
            toast({
                variant: "destructive",
                title: "Check Failed",
                description: "Unable to perform integrity check",
            });
        } finally {
            setChecking(false);
        }
    };

    const getIssueTypeLabel = (type) => {
        const labels = {
            'duplicate_serial': 'Duplicate Serial Numbers',
            'duplicate_category': 'Duplicate Categories',
            'duplicate_vendor': 'Duplicate Vendors',
            'duplicate_location': 'Duplicate Locations'
        };
        return labels[type] || type;
    };

    const getIssueTypeBadge = (type) => {
        const variants = {
            'duplicate_serial': 'destructive',
            'duplicate_category': 'outline',
            'duplicate_vendor': 'outline',
            'duplicate_location': 'outline'
        };
        return variants[type] || 'secondary';
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Database className="w-5 h-5" />
                    Data Integrity
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        {lastCheck ? (
                            <div className="text-sm text-muted-foreground">
                                Last check: {lastCheck.timestamp.toLocaleString()}
                                {lastCheck.success && (
                                    <span className="ml-2">
                                        {lastCheck.issuesFound === 0 ? (
                                            <span className="text-green-600 flex items-center gap-1">
                                                <CheckCircle className="w-4 h-4" />
                                                No issues found
                                            </span>
                                        ) : (
                                            <span className="text-amber-600">
                                                {lastCheck.issuesFound} issues found
                                            </span>
                                        )}
                                    </span>
                                )}
                            </div>
                        ) : (
                            <div className="text-sm text-muted-foreground">
                                Run a check to identify potential data issues
                            </div>
                        )}
                    </div>
                    <Button 
                        onClick={handleIntegrityCheck}
                        disabled={checking}
                        variant="outline"
                        size="sm"
                    >
                        {checking ? (
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Database className="mr-2 h-4 w-4" />
                        )}
                        {checking ? 'Checking...' : 'Run Check'}
                    </Button>
                </div>

                {issues.length > 0 && (
                    <div className="space-y-3">
                        <h4 className="font-medium flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                            Issues Found
                        </h4>
                        {issues.map((issue, index) => (
                            <Alert key={index}>
                                <AlertDescription>
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <Badge 
                                                variant={getIssueTypeBadge(issue.type)}
                                                className="mb-2"
                                            >
                                                {getIssueTypeLabel(issue.type)}
                                            </Badge>
                                            <p className="text-sm">{issue.message}</p>
                                        </div>
                                    </div>
                                </AlertDescription>
                            </Alert>
                        ))}
                    </div>
                )}

                <div className="text-xs text-muted-foreground">
                    <p>This check identifies potential data integrity issues including:</p>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                        <li>Duplicate serial numbers across assets</li>
                        <li>Duplicate category names</li>
                        <li>Duplicate vendor names</li>
                        <li>Duplicate location names under the same parent</li>
                    </ul>
                </div>
            </CardContent>
        </Card>
    );
}