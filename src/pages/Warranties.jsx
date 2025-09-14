
import React, { useState, useEffect, useCallback } from 'react';
import { User } from '@/api/entities';
import { canWrite, isAdmin } from '@/components/roles';
import { Warranty } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, MoreHorizontal, Edit, Trash2, RefreshCw } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { getWarrantyStatus } from '../components/warrantyUtils';
import { useToast } from "@/components/ui/use-toast";

export default function WarrantiesPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [isRenewing, setIsRenewing] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const { toast } = useToast();

  const fetchItems = useCallback(async (user) => {
    if (!user) return; // Added null check for user
    setLoading(true);
    try {
        const data = isAdmin(user)
            ? await Warranty.list('-endDate')
            : await Warranty.filter({ created_by: user.email }, '-endDate');
        setItems(data);
    } catch (error) {
        console.error("Error fetching warranties:", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to load warranties." });
    } finally {
        setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    async function fetchUserAndData() {
        try {
            const user = await User.me();
            setCurrentUser(user);
            fetchItems(user);
        } catch(e) {
            console.error("Error fetching current user:", e);
            toast({ variant: "destructive", title: "Error", description: "Failed to load user information." });
        }
    }
    fetchUserAndData();
  }, [fetchItems, toast]);
  
  const handleSave = async () => {
    if (!canWrite(currentUser)) {
        toast({ variant: "destructive", title: "Permission Denied", description: "You do not have permission to save warranties." });
        return;
    }
    if (!currentItem || !currentItem.providerName || !currentItem.endDate) {
        toast({ variant: "destructive", title: "Validation Error", description: "Provider Name and End Date are required." });
        return;
    }
    try {
        await (currentItem.id ? Warranty.update(currentItem.id, currentItem) : Warranty.create(currentItem));
        toast({ title: "Success", description: `Warranty ${currentItem.id ? 'updated' : 'created'}.` });
        fetchItems(currentUser);
        setOpen(false);
        setCurrentItem(null);
    } catch (error) {
        console.error("Error saving warranty:", error);
        toast({ variant: "destructive", title: "Save Error", description: "Could not save the warranty." });
    }
  };
  
  const handleDelete = async (id) => {
    if (!canWrite(currentUser)) {
        toast({ variant: "destructive", title: "Permission Denied", description: "You do not have permission to delete warranties." });
        return;
    }
    if (window.confirm('Are you sure? This could affect existing assets linked to this warranty.')) {
        try {
            await Warranty.delete(id);
            toast({ title: "Deleted", description: "Warranty has been deleted." });
            fetchItems(currentUser);
        } catch(e) {
            console.error("Error deleting warranty:", e);
            toast({ variant: "destructive", title: "Delete Error", description: "Could not delete the warranty. It may be in use." });
        }
    }
  };

  const openDialog = (item = null, isRenewal = false) => {
    setIsRenewing(isRenewal);
    const emptyItem = { providerName: '', policyNumber: '', startDate: '', endDate: '', terms: '', files: [] };
    
    let itemToEdit;
    if (isRenewal && item) {
        // Pre-fill for renewal, clear ID and dates
        itemToEdit = { ...emptyItem, providerName: item.providerName, policyNumber: item.policyNumber };
    } else if (item) {
        // Standard edit
        itemToEdit = {
            ...item,
            startDate: item.startDate ? item.startDate.split('T')[0] : '',
            endDate: item.endDate ? item.endDate.split('T')[0] : '',
        };
    } else {
        // New item
        itemToEdit = emptyItem;
    }

    setCurrentItem(itemToEdit);
    setOpen(true);
  };

  const getDialogTitle = () => {
      if (isRenewing) return "Renew Warranty";
      if (currentItem?.id) return "Edit Warranty";
      return "Add Warranty";
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Warranties</h1>
        {canWrite(currentUser) && <Button onClick={() => openDialog()}><Plus className="mr-2 h-4 w-4" /> Add Warranty</Button>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>{getDialogTitle()}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2"><Label>Provider Name*</Label><Input value={currentItem?.providerName || ''} onChange={(e) => setCurrentItem({...currentItem, providerName: e.target.value})} /></div>
            <div className="space-y-2"><Label>Policy Number</Label><Input value={currentItem?.policyNumber || ''} onChange={(e) => setCurrentItem({...currentItem, policyNumber: e.target.value})} /></div>
            <div className="space-y-2"><Label>Start Date</Label><Input type="date" value={currentItem?.startDate || ''} onChange={(e) => setCurrentItem({...currentItem, startDate: e.target.value})} /></div>
            <div className="space-y-2"><Label>End Date*</Label><Input type="date" value={currentItem?.endDate || ''} onChange={(e) => setCurrentItem({...currentItem, endDate: e.target.value})} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Provider</TableHead><TableHead>Policy #</TableHead><TableHead>End Date</TableHead><TableHead>Status</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan="5" className="text-center">Loading...</TableCell></TableRow>
              ) : items.map(item => {
                  const status = getWarrantyStatus(item.endDate);
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.providerName}</TableCell>
                      <TableCell>{item.policyNumber || '—'}</TableCell>
                      <TableCell>{format(new Date(item.endDate), 'MMM d, yyyy')}</TableCell>
                      <TableCell><Badge variant={status.badgeVariant}>{status.status}</Badge></TableCell>
                      <TableCell className="text-right">
                         {canWrite(currentUser) && (
                           <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openDialog(item, true)}><RefreshCw className="mr-2 h-4 w-4"/>Renew</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openDialog(item)}><Edit className="mr-2 h-4 w-4"/>Edit</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDelete(item.id)} className="text-red-600"><Trash2 className="mr-2 h-4 w-4"/>Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                         )}
                      </TableCell>
                    </TableRow>
                  )
              })}
            </TableBody>
          </Table>
      </CardContent></Card>
    </div>
  );
}
