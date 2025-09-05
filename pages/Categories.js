// /pages/Categories.js
import React, { useState, useEffect, useCallback } from 'react';
import { Category } from '@/entities/Category';
import { Asset } from '@/entities/Asset';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import DeleteGuardDialog from '../components/DeleteGuardDialog';
import { useToast } from "@/components/ui/use-toast";

export default function CategoriesPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, item: null, relatedCount: 0 });
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
        const data = await Category.list('-created_date');
        setItems(data);
    } catch (error) {
        toast({ variant: "destructive", title: "Error", description: "Could not load categories." });
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);
  
  const handleSave = async () => {
    if (!currentItem || !currentItem.name) {
        toast({ variant: "destructive", title: "Validation Error", description: "Category name is required." });
        return;
    }
    try {
        if (currentItem.id) {
            await Category.update(currentItem.id, { name: currentItem.name, description: currentItem.description });
            toast({ title: "Success", description: "Category updated successfully." });
        } else {
            await Category.create({ name: currentItem.name, description: currentItem.description });
            toast({ title: "Success", description: "Category created successfully." });
        }
        fetchItems();
        setOpen(false);
        setCurrentItem(null);
    } catch (error) {
        console.error("Failed to save category:", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to save category." });
    }
  };
  
  const handleDeleteClick = async (item) => {
    // Check for related assets
    const relatedAssets = await Asset.filter({ categoryId: item.id });
    setDeleteDialog({ 
      open: true, 
      item, 
      relatedCount: relatedAssets.length 
    });
  };

  const handleDeleteConfirm = async (newCategoryId) => {
    setDeleting(true);
    try {
      if (deleteDialog.relatedCount > 0 && newCategoryId) {
        // Move all assets to new category
        const relatedAssets = await Asset.filter({ categoryId: deleteDialog.item.id });
        await Promise.all(
          relatedAssets.map(asset => 
            Asset.update(asset.id, { ...asset, categoryId: newCategoryId })
          )
        );
      }
      
      await Category.delete(deleteDialog.item.id);
      toast({ title: "Success", description: "Category deleted successfully." });
      fetchItems();
      setDeleteDialog({ open: false, item: null, relatedCount: 0 });
    } catch (error) {
      console.error("Failed to delete category:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to delete category." });
    } finally {
      setDeleting(false);
    }
  };

  const openDialog = (item = null) => {
    setCurrentItem(item || { name: '', description: '' });
    setOpen(true);
  }

  const availableCategories = items.filter(i => i.id !== deleteDialog.item?.id);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Categories</h1>
        <Button onClick={() => openDialog()}><Plus className="mr-2 h-4 w-4" /> Add Category</Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{currentItem?.id ? 'Edit' : 'Add'} Category</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">Name*</Label>
              <Input id="name" value={currentItem?.name || ''} onChange={(e) => setCurrentItem({...currentItem, name: e.target.value})} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description" className="text-right">Description</Label>
              <Input id="description" value={currentItem?.description || ''} onChange={(e) => setCurrentItem({...currentItem, description: e.target.value})} className="col-span-3" />
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
        title="Delete Category"
        itemName="Category"
        relatedCount={deleteDialog.relatedCount}
        relatedType="asset"
        alternatives={availableCategories}
        onConfirm={handleDeleteConfirm}
        loading={deleting}
      />
      
      <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Description</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan="3" className="text-center">Loading...</TableCell></TableRow>
              ) : items.length > 0 ? (
                items.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.description}</TableCell>
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
                      <p className="text-muted-foreground">No categories found</p>
                      <Button onClick={() => openDialog()}>
                        <Plus className="mr-2 h-4 w-4" /> Add your first category
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
