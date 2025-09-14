import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tenant } from '@/api/entities';
import { Loader2 } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";

export default function EditTenantDialog({ open, onOpenChange, tenant, onSuccess }) {
    const [formData, setFormData] = useState({
        name: '', email: '', phone: '', status: 'Active', notes: ''
    });
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (tenant && open) {
            setFormData({
                name: tenant.name || '',
                email: tenant.email || '',
                phone: tenant.phone || '',
                status: tenant.status || 'Active',
                notes: tenant.notes || ''
            });
        }
    }, [tenant, open]);

    const handleSubmit = async () => {
        if (!formData.name) {
            toast({ variant: "destructive", title: "Validation Error", description: "Tenant name is required." });
            return;
        }

        setLoading(true);
        try {
            await Tenant.update(tenant.id, formData);
            toast({ title: "Success", description: "Tenant updated successfully." });
            onOpenChange(false);
            onSuccess();
        } catch (error) {
            console.error('Failed to update tenant:', error);
            toast({ variant: "destructive", title: "Error", description: "Failed to update tenant." });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Edit Tenant</DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4">
                    <div>
                        <Label>Name*</Label>
                        <Input 
                            value={formData.name} 
                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="Enter tenant name"
                        />
                    </div>
                    <div>
                        <Label>Email</Label>
                        <Input 
                            type="email"
                            value={formData.email} 
                            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                            placeholder="Enter email address"
                        />
                    </div>
                    <div>
                        <Label>Phone</Label>
                        <Input 
                            value={formData.phone} 
                            onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                            placeholder="Enter phone number"
                        />
                    </div>
                    <div>
                        <Label>Status</Label>
                        <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Active">Active</SelectItem>
                                <SelectItem value="Inactive">Inactive</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label>Notes</Label>
                        <Textarea 
                            value={formData.notes} 
                            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                            placeholder="Additional notes..."
                        />
                    </div>
                </div>
                
                <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={loading}>
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Update Tenant
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}