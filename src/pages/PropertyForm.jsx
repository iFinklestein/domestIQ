import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { User } from '@/api/entities';
import { Property } from '@/api/entities';
import { migrateUserRole, canManageProperties, isAdmin } from '@/components/roles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Save, Loader2, AlertTriangle } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { useToast } from "@/components/ui/use-toast";
import { logAuditEvent } from '../components/auditLog';

export default function PropertyForm() {
    const navigate = useNavigate();
    const location = useLocation();
    const urlParams = new URLSearchParams(location.search);
    const propertyId = urlParams.get('id');
    const { toast } = useToast();

    const [property, setProperty] = useState({
        name: '', address1: '', address2: '', city: '', state: '', postalCode: '', country: '', notes: ''
    });
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        async function fetchData() {
            try {
                const user = await User.me();
                const migratedUser = await migrateUserRole(user);
                setCurrentUser(migratedUser);

                if (!canManageProperties(migratedUser)) {
                    setError("You do not have permission to manage properties.");
                    setLoading(false);
                    return;
                }

                if (propertyId) {
                    const existingProperty = await Property.get(propertyId);
                    if (isAdmin(migratedUser) || existingProperty.owner_user_id === migratedUser.id) {
                        setProperty(existingProperty);
                    } else {
                        setError("You do not have permission to edit this property.");
                    }
                }
            } catch (err) {
                console.error("Error loading data:", err);
                toast({ variant: "destructive", title: "Error", description: "Failed to load property data." });
                setError("Failed to load property data.");
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [propertyId, toast]);

    const handleInputChange = (field, value) => {
        setProperty(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!property.name) {
            toast({ variant: "destructive", title: "Validation Error", description: "Property name is required." });
            return;
        }

        setIsSaving(true);
        const payload = { ...property, owner_user_id: currentUser.id };

        try {
            let savedProperty;
            if (propertyId) {
                savedProperty = await Property.update(propertyId, payload);
                await logAuditEvent({
                    entityType: 'Property', entityId: propertyId, action: 'update',
                    user: currentUser, propertyId: propertyId, details: { name: payload.name }
                });
                toast({ title: "Success", description: "Property updated." });
            } else {
                savedProperty = await Property.create(payload);
                await logAuditEvent({
                    entityType: 'Property', entityId: savedProperty.id, action: 'create',
                    user: currentUser, propertyId: savedProperty.id, details: { name: payload.name }
                });
                toast({ title: "Success", description: "Property created." });
            }
            navigate(createPageUrl(`PropertyDetail?id=${savedProperty.id}`));
        } catch (err) {
            console.error("Failed to save property:", err);
            toast({ variant: "destructive", title: "Error", description: "Failed to save property." });
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) return <div>Loading...</div>;

    if (error) {
        return (
            <Card className="max-w-2xl mx-auto">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><AlertTriangle className="text-red-500" /> Access Denied</CardTitle>
                </CardHeader>
                <CardContent>
                    <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                    <Button variant="outline" className="mt-4" onClick={() => navigate(createPageUrl('Properties'))}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Properties
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl mx-auto">
            <div className="flex items-center justify-between">
                <Button type="button" variant="outline" onClick={() => navigate(propertyId ? createPageUrl(`PropertyDetail?id=${propertyId}`) : createPageUrl('Properties'))}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <h1 className="text-3xl font-bold">{propertyId ? 'Edit Property' : 'Create Property'}</h1>
                <Button type="submit" disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Property Information</CardTitle>
                    <CardDescription>Enter the details for your property.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="grid w-full items-center gap-1.5">
                        <Label htmlFor="name">Property Name*</Label>
                        <Input id="name" value={property.name || ''} onChange={e => handleInputChange('name', e.target.value)} required />
                    </div>
                     <div className="grid w-full items-center gap-1.5">
                        <Label htmlFor="address1">Address 1</Label>
                        <Input id="address1" value={property.address1 || ''} onChange={e => handleInputChange('address1', e.target.value)} />
                    </div>
                     <div className="grid w-full items-center gap-1.5">
                        <Label htmlFor="address2">Address 2</Label>
                        <Input id="address2" value={property.address2 || ''} onChange={e => handleInputChange('address2', e.target.value)} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="grid w-full items-center gap-1.5">
                           <Label htmlFor="city">City</Label>
                           <Input id="city" value={property.city || ''} onChange={e => handleInputChange('city', e.target.value)} />
                        </div>
                        <div className="grid w-full items-center gap-1.5">
                           <Label htmlFor="state">State / Province</Label>
                           <Input id="state" value={property.state || ''} onChange={e => handleInputChange('state', e.target.value)} />
                        </div>
                        <div className="grid w-full items-center gap-1.5">
                           <Label htmlFor="postalCode">Postal / Zip Code</Label>
                           <Input id="postalCode" value={property.postalCode || ''} onChange={e => handleInputChange('postalCode', e.target.value)} />
                        </div>
                    </div>
                     <div className="grid w-full items-center gap-1.5">
                        <Label htmlFor="country">Country</Label>
                        <Input id="country" value={property.country || ''} onChange={e => handleInputChange('country', e.target.value)} />
                    </div>
                     <div className="grid w-full items-center gap-1.5">
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea id="notes" value={property.notes || ''} onChange={e => handleInputChange('notes', e.target.value)} />
                    </div>
                </CardContent>
            </Card>
        </form>
    );
}