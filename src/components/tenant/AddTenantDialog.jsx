import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tenant } from '@/api/entities';
import { Tenancy } from '@/api/entities';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";

export default function AddTenantDialog({ open, onOpenChange, propertyId, onSuccess }) {
    const [activeTab, setActiveTab] = useState('existing');
    const [existingTenants, setExistingTenants] = useState([]);
    const [selectedTenantId, setSelectedTenantId] = useState('');
    const [newTenant, setNewTenant] = useState({
        name: '', email: '', phone: '', status: 'Active', notes: ''
    });
    const [tenancyData, setTenancyData] = useState({
        start_date: '', notes: ''
    });
    const [loading, setLoading] = useState(false);
    const [emailWarning, setEmailWarning] = useState('');
    const { toast } = useToast();

    useEffect(() => {
        if (open) {
            loadExistingTenants();
            // Reset form
            setSelectedTenantId('');
            setNewTenant({ name: '', email: '', phone: '', status: 'Active', notes: '' });
            setTenancyData({ start_date: '', notes: '' });
            setEmailWarning('');
        }
    }, [open]);

    const loadExistingTenants = async () => {
        try {
            const tenants = await Tenant.list();
            setExistingTenants(tenants.filter(t => t.status === 'Active'));
        } catch (error) {
            console.error('Failed to load tenants:', error);
        }
    };

    const handleEmailChange = async (email) => {
        setNewTenant(prev => ({ ...prev, email }));
        setEmailWarning('');
        
        if (email && email.includes('@')) {
            const existing = existingTenants.find(t => 
                t.email?.toLowerCase() === email.toLowerCase()
            );
            if (existing) {
                setEmailWarning(`A tenant with this email already exists: ${existing.name}`);
            }
        }
    };

    const handleSubmit = async () => {
        if (!tenancyData.start_date) {
            toast({ variant: "destructive", title: "Validation Error", description: "Start date is required." });
            return;
        }

        if (activeTab === 'existing' && !selectedTenantId) {
            toast({ variant: "destructive", title: "Validation Error", description: "Please select a tenant." });
            return;
        }

        if (activeTab === 'new' && !newTenant.name) {
            toast({ variant: "destructive", title: "Validation Error", description: "Tenant name is required." });
            return;
        }

        setLoading(true);
        try {
            let tenantId = selectedTenantId;
            
            if (activeTab === 'new') {
                const createdTenant = await Tenant.create(newTenant);
                tenantId = createdTenant.id;
            }

            // Create tenancy with end_date = null (active)
            await Tenancy.create({
                property_id: propertyId,
                tenant_id: tenantId,
                start_date: tenancyData.start_date,
                end_date: null, // Active tenancy
                notes: tenancyData.notes
            });

            toast({ title: "Success", description: "Tenant added successfully." });
            onOpenChange(false);
            onSuccess();
        } catch (error) {
            console.error('Failed to add tenant:', error);
            toast({ variant: "destructive", title: "Error", description: "Failed to add tenant." });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Add Tenant</DialogTitle>
                </DialogHeader>
                
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="existing">Select Existing</TabsTrigger>
                        <TabsTrigger value="new">Create New</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="existing" className="space-y-4">
                        <div>
                            <Label>Select Tenant</Label>
                            <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Choose a tenant..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {existingTenants.map(tenant => (
                                        <SelectItem key={tenant.id} value={tenant.id}>
                                            {tenant.name} {tenant.email ? `(${tenant.email})` : ''}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </TabsContent>
                    
                    <TabsContent value="new" className="space-y-4">
                        <div>
                            <Label>Name*</Label>
                            <Input 
                                value={newTenant.name} 
                                onChange={(e) => setNewTenant(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="Enter tenant name"
                            />
                        </div>
                        <div>
                            <Label>Email</Label>
                            <Input 
                                type="email"
                                value={newTenant.email} 
                                onChange={(e) => handleEmailChange(e.target.value)}
                                placeholder="Enter email address"
                            />
                            {emailWarning && (
                                <Alert className="mt-2">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertDescription>{emailWarning}</AlertDescription>
                                </Alert>
                            )}
                        </div>
                        <div>
                            <Label>Phone</Label>
                            <Input 
                                value={newTenant.phone} 
                                onChange={(e) => setNewTenant(prev => ({ ...prev, phone: e.target.value }))}
                                placeholder="Enter phone number"
                            />
                        </div>
                        <div>
                            <Label>Notes</Label>
                            <Textarea 
                                value={newTenant.notes} 
                                onChange={(e) => setNewTenant(prev => ({ ...prev, notes: e.target.value }))}
                                placeholder="Additional notes..."
                            />
                        </div>
                    </TabsContent>
                </Tabs>
                
                {/* Tenancy Details */}
                <div className="space-y-4 border-t pt-4">
                    <h4 className="font-medium">Tenancy Details</h4>
                    <div>
                        <Label>Start Date*</Label>
                        <Input 
                            type="date"
                            value={tenancyData.start_date} 
                            onChange={(e) => setTenancyData(prev => ({ ...prev, start_date: e.target.value }))}
                        />
                    </div>
                    <div>
                        <Label>Notes</Label>
                        <Textarea 
                            value={tenancyData.notes} 
                            onChange={(e) => setTenancyData(prev => ({ ...prev, notes: e.target.value }))}
                            placeholder="Tenancy-specific notes..."
                        />
                    </div>
                </div>
                
                <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={loading}>
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Add Tenant
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}