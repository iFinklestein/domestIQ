import React, { useState, useEffect, useCallback } from 'react';
import { User } from '@/api/entities';
import { canWrite, isAdmin } from '@/components/roles';
import { Vendor } from '@/api/entities';
import { Asset } from '@/api/entities';
import { MaintenanceRequest } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';
import { Plus, MoreHorizontal, Edit, Trash2, AlertTriangle, Undo2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from "@/components/ui/use-toast";
import { findVendorMatches, validateVendorUniqueness } from '../components/vendorUtils';

export default function VendorsPage() {
    const [activeItems, setActiveItems] = useState([]);
    const [archivedItems, setArchivedItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [currentItem, setCurrentItem] = useState(null);
    const [archiveDialog, setArchiveDialog] = useState({ open: false, item: null, dependencies: null });
    const [currentUser, setCurrentUser] = useState(null);
    const [activeTab, setActiveTab] = useState('active');
    const { toast } = useToast();

    const fetchItems = useCallback(async (user) => {
        if (!user) return;
        setLoading(true);
        try {
            const data = isAdmin(user)
                ? await Vendor.list('-created_date')
                : await Vendor.filter({ created_by: user.email }, '-created_date');
            setActiveItems(data.filter(v => v.status !== 'archived'));
            setArchivedItems(data.filter(v => v.status === 'archived'));
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Could not load vendors." });
        }
        setLoading(false);
    }, [toast]);

    useEffect(() => {
        async function fetchUserAndData() {
            try {
                const user = await User.me();
                setCurrentUser(user);
                fetchItems(user);
            } catch (e) { console.error(e); }
        }
        fetchUserAndData();
    }, [fetchItems]);

    const handleSave = async () => {
        if (!canWrite(currentUser) || !currentItem?.name) {
            toast({ variant: "destructive", title: "Validation Error", description: "Vendor name is required." });
            return;
        }

        const { isValid, message } = validateVendorUniqueness(currentItem.name, activeItems, currentItem.id);
        if (!isValid) {
            toast({ variant: "destructive", title: "Validation Error", description: message });
            return;
        }

        try {
            const data = { name: currentItem.name, category: currentItem.category, phone: currentItem.phone, email: currentItem.email, website: currentItem.website };
            if (currentItem.id) {
                await Vendor.update(currentItem.id, data);
                toast({ title: "Success", description: "Vendor updated." });
            } else {
                await Vendor.create(data);
                toast({ title: "Success", description: "Vendor created." });
            }
            fetchItems(currentUser);
            setOpen(false);
            setCurrentItem(null);
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Failed to save vendor." });
        }
    };

    const handleArchiveClick = async (item) => {
        setArchiveDialog({ open: true, item, dependencies: 'loading' });
        try {
            const [relatedAssets, relatedRequests] = await Promise.all([
                Asset.filter({ vendorId: item.id, status: 'active' }),
                MaintenanceRequest.filter({ vendor_id: item.id }) // check all requests, not just active
            ]);
            const activeRequests = relatedRequests.filter(r => r.status !== 'done' && r.status !== 'rejected');
            setArchiveDialog({ open: true, item, dependencies: { assets: relatedAssets.length, requests: activeRequests.length } });
        } catch (error) {
            toast({ variant: "destructive", title: "Error checking dependencies" });
            setArchiveDialog({ open: false, item: null, dependencies: null });
        }
    };

    const handleArchiveConfirm = async () => {
        const { item } = archiveDialog;
        if (!item) return;
        try {
            await Vendor.update(item.id, { ...item, status: 'archived' });
            toast({ title: "Success", description: "Vendor archived." });
            fetchItems(currentUser);
            setArchiveDialog({ open: false, item: null, dependencies: null });
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Failed to archive vendor." });
        }
    };

    const handleRestore = async (item) => {
        try {
            await Vendor.update(item.id, { ...item, status: 'active' });
            toast({ title: "Success", description: "Vendor restored." });
            fetchItems(currentUser);
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Failed to restore vendor." });
        }
    };
    
    const openDialog = (item = null) => {
        setCurrentItem(item || { name: '', category: '', phone: '', email: '', website: '' });
        setOpen(true);
    };

    const ItemsTable = ({ items, isArchived }) => (
        <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Category</TableHead><TableHead>Contact</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
            <TableBody>
                {loading ? (<TableRow><TableCell colSpan="4" className="text-center">Loading...</TableCell></TableRow>) : items.length > 0 ? (
                    items.map(item => (
                        <TableRow key={item.id} className={isArchived ? "bg-gray-50" : ""}>
                            <TableCell className="font-medium">
                                <span className={isArchived ? "text-muted-foreground" : ""}>{item.name}</span>
                                {isArchived && <Badge variant="outline" className="ml-2">Archived</Badge>}
                            </TableCell>
                            <TableCell className={isArchived ? "text-muted-foreground" : ""}>{item.category}</TableCell>
                            <TableCell className={isArchived ? "text-muted-foreground" : ""}>
                                <div>{item.phone}</div>
                                <div className="text-sm">{item.email}</div>
                            </TableCell>
                            <TableCell className="text-right">
                                {canWrite(currentUser) && (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild><Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            {!isArchived ? (
                                                <>
                                                    <DropdownMenuItem onClick={() => openDialog(item)}><Edit className="mr-2 h-4 w-4"/>Edit</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleArchiveClick(item)} className="text-amber-600"><Trash2 className="mr-2 h-4 w-4"/>Archive</DropdownMenuItem>
                                                </>
                                            ) : (
                                                <DropdownMenuItem onClick={() => handleRestore(item)}><Undo2 className="mr-2 h-4 w-4"/>Restore</DropdownMenuItem>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                )}
                            </TableCell>
                        </TableRow>
                    ))
                ) : (
                    <TableRow><TableCell colSpan="4" className="text-center py-8">No vendors found.</TableCell></TableRow>
                )}
            </TableBody>
        </Table>
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Vendors</h1>
                {canWrite(currentUser) && <Button onClick={() => openDialog()}><Plus className="mr-2 h-4 w-4" /> Add Vendor</Button>}
            </div>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>{currentItem?.id ? 'Edit' : 'Add'} Vendor</DialogTitle></DialogHeader>
                    <div className="grid gap-4 py-4">
                        <Field label="Name*"><Input value={currentItem?.name || ''} onChange={(e) => setCurrentItem({ ...currentItem, name: e.target.value })} /></Field>
                        <Field label="Category"><Input value={currentItem?.category || ''} onChange={(e) => setCurrentItem({ ...currentItem, category: e.target.value })} placeholder="e.g., Plumbing, Electrical" /></Field>
                        <Field label="Phone"><Input type="tel" value={currentItem?.phone || ''} onChange={(e) => setCurrentItem({ ...currentItem, phone: e.target.value })} /></Field>
                        <Field label="Email"><Input type="email" value={currentItem?.email || ''} onChange={(e) => setCurrentItem({ ...currentItem, email: e.target.value })} /></Field>
                        <Field label="Website"><Input type="url" value={currentItem?.website || ''} onChange={(e) => setCurrentItem({ ...currentItem, website: e.target.value })} placeholder="https://example.com" /></Field>
                    </div>
                    <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={handleSave}>Save</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={archiveDialog.open} onOpenChange={(isOpen) => setArchiveDialog({ ...archiveDialog, open: isOpen })}>
                <DialogContent>
                    <DialogHeader><DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" /> Archive Vendor</DialogTitle></DialogHeader>
                    {archiveDialog.dependencies === 'loading' ? (<p>Checking dependencies...</p>) : 
                    (archiveDialog.dependencies?.assets > 0 || archiveDialog.dependencies?.requests > 0) ? (
                        <div className="space-y-4">
                            <p>This vendor cannot be archived. It is linked to:</p>
                            <ul className="list-disc pl-5 text-sm text-muted-foreground">
                                {archiveDialog.dependencies.assets > 0 && <li>{archiveDialog.dependencies.assets} active asset(s)</li>}
                                {archiveDialog.dependencies.requests > 0 && <li>{archiveDialog.dependencies.requests} open maintenance request(s)</li>}
                            </ul>
                            <DialogFooter><Button variant="outline" onClick={() => setArchiveDialog({ open: false, item: null, dependencies: null })}>Close</Button></DialogFooter>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <p>Are you sure you want to archive "{archiveDialog.item?.name}"?</p>
                            <DialogFooter><Button variant="outline" onClick={() => setArchiveDialog({ open: false, item: null, dependencies: null })}>Cancel</Button><Button variant="destructive" onClick={handleArchiveConfirm}>Archive</Button></DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
            
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                    <TabsTrigger value="active">Active ({activeItems.length})</TabsTrigger>
                    <TabsTrigger value="archived">Archived ({archivedItems.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="active"><Card><CardContent className="p-0"><ItemsTable items={activeItems} isArchived={false} /></CardContent></Card></TabsContent>
                <TabsContent value="archived"><Card><CardContent className="p-0"><ItemsTable items={archivedItems} isArchived={true} /></CardContent></Card></TabsContent>
            </Tabs>
        </div>
    );
}

const Field = ({ label, children }) => (
    <div className="grid w-full items-center gap-1.5"><Label>{label}</Label>{children}</div>
);