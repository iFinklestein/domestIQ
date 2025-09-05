// /pages/Locations.js
import React, { useState, useEffect } from 'react';
import { Location as AssetLocation } from '@/entities/Location';
import { Asset } from '@/entities/Asset';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import DeleteGuardDialog from '../components/DeleteGuardDialog';

export default function LocationsPage() {
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
    const data = await AssetLocation.list('-created_date');
    setItems(data);
    setLoading(false);
  };
  
  const handleSave = async () => {
    if (!currentItem || !currentItem.name) return;
    if (currentItem.id) {
        await AssetLocation.update(currentItem.id, { name: currentItem.name, parentId: currentItem.parentId });
    } else {
        await AssetLocation.create({ name: currentItem.name, parentId: currentItem.parentId });
    }
    fetchItems();
    setOpen(false);
    setCurrentItem(null);
  };

  const handleDeleteClick = async (item) => {
    const relatedAssets = await Asset.filter({ locationId: item.id });
    setDeleteDialog({ 
      open: true, 
      item, 
      relatedCount: relatedAssets.length 
    });
  };

  const handleDeleteConfirm = async (newLocationId) => {
    setDeleting(true);
    try {
      if (deleteDialog.relatedCount > 0 && newLocationId) {
        const relatedAssets = await Asset.filter({ locationId: deleteDialog.item.id });
        await Promise.all(
          relatedAssets.map(async asset => 
            await Asset.update(asset.id, { ...asset, locationId: newLocationId })
          )
        );
      }
      
      await AssetLocation.delete(deleteDialog.item.id);
      fetchItems();
      setDeleteDialog({ open: false, item: null, relatedCount: 0 });
    } catch (error) {
      console.error("Failed to delete location:", error);
      alert('Failed to delete location.');
    } finally {
      setDeleting(false);
    }
  };

  const openDialog = (item = null) => {
    setCurrentItem(item || { name: '', parentId: '' });
    setOpen(true);
  }

  const getLocationName = (id) => items.find(i => i.id === id)?.name || 'N/A';
  const availableLocations = items.filter(i => i.id !== deleteDialog.item?.id);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Locations</h1>
        <Button onClick={() => openDialog()}><Plus className="mr-2 h-4 w-4" /> Add Location</Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{currentItem?.id ? 'Edit' : 'Add'} Location</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">Name*</Label>
              <Input id="name" value={currentItem?.name || ''} onChange={(e) => setCurrentItem({...currentItem, name: e.target.value})} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="parentId" className="text-right">Parent</Label>
              <Select onValueChange={(value) => setCurrentItem({...currentItem, parentId: value})} value={currentItem?.parentId || ''}>
                <SelectTrigger className="col-span-3"><SelectValue placeholder="Select a parent location (optional)" /></SelectTrigger>
                <SelectContent>
                    {items.filter(i => i.id !== currentItem?.id).map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteGuardDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}
        title="Delete Location"
        itemName="Location"
        relatedCount={deleteDialog.relatedCount}
        relatedType="asset"
        alternatives={availableLocations}
        onConfirm={handleDeleteConfirm}
        loading={deleting}
      />
      
      <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Parent Location</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan="3" className="text-center">Loading...</TableCell></TableRow>
              ) : items.length > 0 ? (
                items.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.parentId ? getLocationName(item.parentId) : '—'}</TableCell>
                    <TableCell className="text-right">
                       <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openDialog(item)}><Edit className="mr-2 h-4 w-4"/>Edit</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDeleteClick(item)} className="text-red-600"><Trash2 className="mr-2 h-4 w-4"/>Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan="3" className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-muted-foreground">No locations found</p>
                      <Button onClick={() => openDialog()}>
                        <Plus className="mr-2 h-4 w-4" /> Add your first location
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
      </CardContent></Card>
    </div>
  );
}
