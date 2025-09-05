// /pages/Vendors.js
import React, { useState, useEffect } from 'react';
import { Vendor } from '@/entities/Vendor';
import { Asset } from '@/entities/Asset';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, MoreHorizontal, Edit, Trash2, ExternalLink, Phone, Mail } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import DeleteGuardDialog from '../components/DeleteGuardDialog'; // Adjusted path as per common project structure

export default function VendorsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, item: null, relatedCount: 0 });
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    const data = await Vendor.list('-created_date');
    setItems(data);
    setLoading(false);
  };
  
  const handleSave = async () => {
    if (!currentItem || !currentItem.name) return; // Name is required
    
    // Simple validation for email and phone if they exist
    if (currentItem.email && !/\S+@\S+\.\S+/.test(currentItem.email)) {
      alert("Please enter a valid email address.");
      return;
    }
    if (currentItem.phone && !/^\+?[\d\s\-\(\)]{7,}$/.test(currentItem.phone)) {
        alert("Please enter a valid phone number.");
        return;
    }

    try {
        await (currentItem.id ? Vendor.update(currentItem.id, currentItem) : Vendor.create(currentItem));
        fetchItems();
        setOpen(false);
        setCurrentItem(null);
    } catch (error) {
        console.error("Failed to save vendor:", error);
        alert(`Failed to save vendor: ${error.message || 'Unknown error'}`);
    }
  };
  
  const handleDeleteClick = async (item) => {
    try {
      setDeleting(true); // Indicate that we're fetching related assets
      const relatedAssets = await Asset.filter({ vendorId: item.id });
      setDeleteDialog({ 
        open: true, 
        item, 
        relatedCount: relatedAssets.length 
      });
    } catch (error) {
      console.error("Error fetching related assets:", error);
      alert("Failed to determine related assets. Please try again.");
    } finally {
      setDeleting(false); // Reset deleting state
    }
  };

  const handleDeleteConfirm = async (newVendorId) => {
    setDeleting(true);
    try {
      if (deleteDialog.relatedCount > 0 && newVendorId) {
        // Reassign assets to the new vendor
        const relatedAssets = await Asset.filter({ vendorId: deleteDialog.item.id });
        await Promise.all(
          relatedAssets.map(asset => 
            Asset.update(asset.id, { vendorId: newVendorId }) // Only update vendorId
          )
        );
      }
      
      await Vendor.delete(deleteDialog.item.id);
      fetchItems();
      setDeleteDialog({ open: false, item: null, relatedCount: 0 });
    } catch (error) {
      console.error("Failed to delete vendor:", error);
      alert('Failed to delete vendor. ' + (error.message || ''));
    } finally {
      setDeleting(false);
    }
  };

  const openDialog = (item = null) => {
    setCurrentItem(item || { name: '', website: '', phone: '', email: '' });
    setOpen(true);
  }

  const formatWebsite = (url) => {
    if (!url) return null;
    let formattedUrl = url;
    // Add https:// if missing, unless it's already http://
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
        formattedUrl = `https://${formattedUrl}`;
    }
    return formattedUrl;
  };

  // Filter out the item currently targeted for deletion from alternatives
  const availableVendors = items.filter(i => i.id !== deleteDialog.item?.id);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Vendors</h1>
        <Button onClick={() => openDialog()}><Plus className="mr-2 h-4 w-4" /> Add Vendor</Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{currentItem?.id ? 'Edit' : 'Add'} Vendor</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2"><Label htmlFor="name">Name*</Label><Input id="name" value={currentItem?.name || ''} onChange={(e) => setCurrentItem({...currentItem, name: e.target.value})} required /></div>
            <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" value={currentItem?.email || ''} onChange={(e) => setCurrentItem({...currentItem, email: e.target.value})} /></div>
            <div className="space-y-2"><Label htmlFor="phone">Phone</Label><Input id="phone" value={currentItem?.phone || ''} onChange={(e) => setCurrentItem({...currentItem, phone: e.target.value})} /></div>
            <div className="space-y-2"><Label htmlFor="website">Website</Label><Input id="website" type="url" value={currentItem?.website || ''} onChange={(e) => setCurrentItem({...currentItem, website: e.target.value})} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); setCurrentItem(null); }}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteGuardDialog
        open={deleteDialog.open}
        onOpenChange={(openState) => setDeleteDialog({ ...deleteDialog, open: openState })}
        title="Delete Vendor"
        itemName={deleteDialog.item?.name || 'this vendor'}
        relatedCount={deleteDialog.relatedCount}
        relatedType="asset"
        alternatives={availableVendors}
        onConfirm={handleDeleteConfirm}
        loading={deleting}
      />
      
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Website</TableHead>
                <TableHead className="text-right"><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan="4" className="text-center py-8">Loading...</TableCell></TableRow>
              ) : items.length > 0 ? (
                items.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {item.email && (
                          <a href__={`mailto:${item.email}`} className="flex items-center gap-1 text-sm text-blue-600 hover:underline">
                            <Mail className="w-3 h-3 min-w-3" />
                            {item.email}
                          </a>
                        )}
                        {item.phone && (
                          <a href__={`tel:${item.phone}`} className="flex items-center gap-1 text-sm text-blue-600 hover:underline">
                            <Phone className="w-3 h-3 min-w-3" />
                            {item.phone}
                          </a>
                        )}
                        {!item.email && !item.phone && <span className="text-muted-foreground">—</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.website ? (
                        <a 
                          href__={formatWebsite(item.website)} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-blue-600 hover:underline"
                        >
                          <ExternalLink className="w-3 h-3 min-w-3" />
                          {item.website}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                       <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openDialog(item)}><Edit className="mr-2 h-4 w-4"/>Edit</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDeleteClick(item)} className="text-red-600 focus:text-red-700"><Trash2 className="mr-2 h-4 w-4"/>Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan="4" className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-muted-foreground">No vendors found</p>
                      <Button onClick={() => openDialog()}>
                        <Plus className="mr-2 h-4 w-4" /> Add your first vendor
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
