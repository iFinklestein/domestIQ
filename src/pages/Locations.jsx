import React, { useState, useEffect, useCallback } from 'react';
import { User } from '@/api/entities';
import { canWrite, isAdmin } from '@/components/roles';
import { Location } from '@/api/entities';
import { Asset } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';
import { Plus, MoreHorizontal, Edit, Trash2, AlertTriangle, Undo2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from "@/components/ui/use-toast";

export default function LocationsPage() {
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
            const allItems = isAdmin(user)
                ? await Location.list('-created_date')
                : await Location.filter({ created_by: user.email }, '-created_date');
            
            setActiveItems(allItems.filter(i => i.status !== 'archived'));
            setArchivedItems(allItems.filter(i => i.status === 'archived'));
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Could not load locations." });
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
            toast({ variant: "destructive", title: "Validation Error", description: "Location name is required." });
            return;
        }
        try {
            const data = { name: currentItem.name, description: currentItem.description };
            if (currentItem.id) {
                await Location.update(currentItem.id, data);
                toast({ title: "Success", description: "Location updated." });
            } else {
                await Location.create(data);
                toast({ title: "Success", description: "Location created." });
            }
            fetchItems(currentUser);
            setOpen(false);
            setCurrentItem(null);
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Failed to save location." });
        }
    };

    const handleArchiveClick = async (item) => {
        setArchiveDialog({ open: true, item, dependencies: 'loading' });
        try {
            const relatedAssets = await Asset.filter({ locationId: item.id, status: 'active' });
            setArchiveDialog({ open: true, item, dependencies: { assets: relatedAssets.length } });
        } catch (error) {
            toast({ variant: "destructive", title: "Error checking dependencies" });
            setArchiveDialog({ open: false, item: null, dependencies: null });
        }
    };

    const handleArchiveConfirm = async () => {
        const { item } = archiveDialog;
        if (!item) return;
        try {
            await Location.update(item.id, { ...item, status: 'archived' });
            toast({ title: "Success", description: "Location archived." });
            fetchItems(currentUser);
            setArchiveDialog({ open: false, item: null, dependencies: null });
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Failed to archive location." });
        }
    };

    const handleRestore = async (item) => {
        try {
            await Location.update(item.id, { ...item, status: 'active' });
            toast({ title: "Success", description: "Location restored." });
            fetchItems(currentUser);
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Failed to restore location." });
        }
    };

    const openDialog = (item = null) => {
        setCurrentItem(item || { name: '', description: '' });
        setOpen(true);
    };

    const ItemsTable = ({ items, isArchived }) => (
        <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Description</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
            <TableBody>
                {loading ? (<TableRow><TableCell colSpan="3" className="text-center">Loading...</TableCell></TableRow>) : items.length > 0 ? (
                    items.map(item => (
                        <TableRow key={item.id} className={isArchived ? "bg-gray-50" : ""}>
                            <TableCell className="font-medium">
                                <span className={isArchived ? "text-muted-foreground" : ""}>{item.name}</span>
                                {isArchived && <Badge variant="outline" className="ml-2">Archived</Badge>}
                            </TableCell>
                            <TableCell className={isArchived ? "text-muted-foreground" : ""}>{item.description}</TableCell>
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
                    <TableRow><TableCell colSpan="3" className="text-center py-8">No locations found.</TableCell></TableRow>
                )}
            </TableBody>
        </Table>
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Locations</h1>
                {canWrite(currentUser) && <Button onClick={() => openDialog()}><Plus className="mr-2 h-4 w-4" /> Add Location</Button>}
            </div>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>{currentItem?.id ? 'Edit' : 'Add'} Location</DialogTitle></DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="name" className="text-right">Name*</Label><Input id="name" value={currentItem?.name || ''} onChange={(e) => setCurrentItem({ ...currentItem, name: e.target.value })} className="col-span-3" /></div>
                        <div className="grid grid-cols-4 items-start gap-4"><Label htmlFor="description" className="text-right pt-2">Description</Label><Textarea id="description" value={currentItem?.description || ''} onChange={(e) => setCurrentItem({ ...currentItem, description: e.target.value })} className="col-span-3" rows={3} placeholder="Optional description..." /></div>
                    </div>
                    <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={handleSave}>Save</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={archiveDialog.open} onOpenChange={(isOpen) => setArchiveDialog({ ...archiveDialog, open: isOpen })}>
                <DialogContent>
                    <DialogHeader><DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" /> Archive Location</DialogTitle></DialogHeader>
                    {archiveDialog.dependencies === 'loading' ? (<p>Checking dependencies...</p>) : archiveDialog.dependencies?.assets > 0 ? (
                        <div className="space-y-4"><p>This location cannot be archived as it is used by {archiveDialog.dependencies.assets} active asset(s).</p><DialogFooter><Button variant="outline" onClick={() => setArchiveDialog({ open: false, item: null, dependencies: null })}>Close</Button></DialogFooter></div>
                    ) : (
                        <div className="space-y-4"><p>Are you sure you want to archive "{archiveDialog.item?.name}"?</p><DialogFooter><Button variant="outline" onClick={() => setArchiveDialog({ open: false, item: null, dependencies: null })}>Cancel</Button><Button variant="destructive" onClick={handleArchiveConfirm}>Archive</Button></DialogFooter></div>
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