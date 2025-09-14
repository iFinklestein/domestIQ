
import React, { useState, useEffect, useCallback } from 'react';
import { canWrite, isAdmin } from '@/components/roles';
import { Category } from '@/api/entities';
import { Asset } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';
import { Plus, MoreHorizontal, Edit, Trash2, AlertTriangle, Undo2, Loader2, Shapes } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from "@/components/ui/use-toast";
import { SimpleTooltip } from '@/components/ui/tooltip';
import { useApiErrorHandler } from '../components/errorHandling';
import { EmptyState, ErrorState } from '../components/EmptyState';
import { useAuth } from '../components/useAuth';
import { useBootstrap } from '../components/useBootstrap';

export default function CategoriesPage() {
  const [activeItems, setActiveItems] = useState([]);
  const [archivedItems, setArchivedItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [archiveDialog, setArchiveDialog] = useState({ open: false, item: null, dependencies: null });
  const [activeTab, setActiveTab] = useState('active');
  const { toast } = useToast();
  const { handleError } = useApiErrorHandler();

  // Use the gated auth and bootstrap system
  const { user: currentUser } = useAuth();
  const { data: bootstrapData, loading, error, refetch } = useBootstrap();

  // Process bootstrap data when it changes
  useEffect(() => {
    if (bootstrapData && bootstrapData.categories) {
      const allItems = bootstrapData.categories; // This line was modified as per outline
      setActiveItems(allItems.filter(i => i.status !== 'archived'));
      setArchivedItems(allItems.filter(i => i.status === 'archived'));
    } else {
        // If bootstrapData or categories are null, reset states
        setActiveItems([]);
        setArchivedItems([]);
    }
  }, [bootstrapData]);
  
  const handleSave = async () => {
    if (!canWrite(currentUser)) {
        toast({ variant: "destructive", title: "Permission Denied", description: "You do not have permission to perform this action." });
        return;
    }
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
        refetch(); // Refetch bootstrap data instead of calling fetchItems
        setOpen(false);
        setCurrentItem(null);
    } catch (error) {
        console.error("Failed to save category:", error);
        handleError(error, 'save category');
    }
  };
  
  const handleArchiveClick = async (item) => {
    if (!canWrite(currentUser)) {
        toast({ variant: "destructive", title: "Permission Denied" });
        return;
    }
    setArchiveDialog({ open: true, item, dependencies: 'loading' });
    try {
        // Check dependencies using bootstrap data ONLY. Remove unsafe fallback.
        let relatedAssets = [];
        if (bootstrapData && bootstrapData.assets) {
            relatedAssets = bootstrapData.assets.filter(asset => asset.categoryId === item.id && asset.status === 'active');
        }
        // No 'else' block as per the change request. If bootstrap data isn't ready or doesn't have assets,
        // relatedAssets will remain an empty array (default), correctly indicating no dependencies.
        setArchiveDialog({ open: true, item, dependencies: { assets: relatedAssets.length } });
    } catch (error) {
        handleError(error, 'check category dependencies');
        setArchiveDialog({ open: false, item: null, dependencies: null });
    }
  };

  const handleArchiveConfirm = async () => {
    const { item } = archiveDialog;
    if (!item) return;

    try {
        await Category.update(item.id, { ...item, status: 'archived' });
        toast({ title: "Success", description: "Category archived." });
        refetch(); // Refetch bootstrap data
        setArchiveDialog({ open: false, item: null, dependencies: null });
    } catch (error) {
        handleError(error, 'archive category');
    }
  };

  const handleRestore = async (item) => {
      try {
          await Category.update(item.id, { ...item, status: 'active' });
          toast({ title: "Success", description: "Category restored." });
          refetch(); // Refetch bootstrap data
      } catch (error) {
          handleError(error, 'restore category');
      }
  };

  const openDialog = (item = null) => {
    setCurrentItem(item || { name: '', description: '' });
    setOpen(true);
  }

  const ItemsTable = ({ items, isArchived }) => {
    if (loading) {
      return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead><span className="sr-only">Actions</span></TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                <TableRow>
                    <TableCell colSpan="3" className="text-center py-12">
                        <div className="flex items-center justify-center text-muted-foreground">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Loading categories...
                        </div>
                    </TableCell>
                </TableRow>
            </TableBody>
        </Table>
      );
    }

    if (error && !isArchived) { // Show error state only for the 'active' tab in case of a general fetch error
      return (
        <ErrorState 
            title="Failed to load categories"
            description="We couldn't load your categories. This might be due to a network issue or server problem. Please try again."
            onRetry={refetch}
            loading={loading} // Pass loading state to ErrorState for retry button
        />
      );
    }

    if (items.length === 0) {
      if (isArchived) {
        return (
          <EmptyState
            icon={Shapes}
            title="No archived categories"
            description="You haven't archived any categories yet. Archived categories will appear here for future reference."
          />
        );
      }

      return (
        <EmptyState
          icon={Shapes}
          title="No categories yet"
          description={
            canWrite(currentUser)
              ? "Categories help organize your assets. Create your first category to get started with better asset management."
              : "No categories have been created yet. Categories help organize assets by type or function."
          }
          actionLabel={canWrite(currentUser) ? "Create Your First Category" : undefined}
          onAction={canWrite(currentUser) ? () => openDialog() : undefined}
          secondaryActionLabel="Learn More"
          onSecondaryAction={() => window.open('https://docs.example.com/categories', '_blank')} // Placeholder link
        />
      );
    }

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead><span className="sr-only">Actions</span></TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {items.map(item => {
                    const canEditItem = canWrite(currentUser) && 
                                      (isAdmin(currentUser) || item.created_by === currentUser?.email);
                    
                    return (
                        <TableRow key={item.id} className={isArchived ? "bg-gray-50" : ""}>
                            <TableCell className="font-medium">
                                <span className={isArchived ? "text-muted-foreground" : ""}>{item.name}</span>
                                {isArchived && <Badge variant="outline" className="ml-2">Archived</Badge>}
                            </TableCell>
                            <TableCell className={isArchived ? "text-muted-foreground" : ""}>
                                {item.description}
                            </TableCell>
                            <TableCell className="text-right">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button size="icon" variant="ghost">
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        {canEditItem && !isArchived ? (
                                            <DropdownMenuItem onClick={() => openDialog(item)}>
                                                <Edit className="mr-2 h-4 w-4"/>Edit
                                            </DropdownMenuItem>
                                        ) : (
                                            <DropdownMenuItem 
                                                disabled 
                                                className="text-muted-foreground"
                                                title={
                                                    isArchived 
                                                        ? "Cannot edit archived categories"
                                                        : "You can only edit categories you created or if you are an admin."
                                                }
                                            >
                                                <Edit className="mr-2 h-4 w-4 opacity-50"/>
                                                {isArchived ? "Edit (Archived)" : "Edit"}
                                            </DropdownMenuItem>
                                        )}
                                        
                                        {canEditItem && !isArchived ? (
                                            <DropdownMenuItem 
                                                onClick={() => handleArchiveClick(item)} 
                                                className="text-amber-600"
                                            >
                                                <Trash2 className="mr-2 h-4 w-4"/>Archive
                                            </DropdownMenuItem>
                                        ) : !isArchived && ( 
                                            <DropdownMenuItem 
                                                disabled 
                                                className="text-muted-foreground"
                                                title="You can only archive categories you created or if you are an admin."
                                            >
                                                <Trash2 className="mr-2 h-4 w-4 opacity-50"/>Archive
                                            </DropdownMenuItem>
                                        )}
                                        
                                        {canEditItem && isArchived && (
                                            <DropdownMenuItem onClick={() => handleRestore(item)}>
                                                <Undo2 className="mr-2 h-4 w-4"/>Restore
                                            </DropdownMenuItem>
                                        )}
                                        {!canEditItem && isArchived && (
                                            <DropdownMenuItem 
                                                disabled 
                                                className="text-muted-foreground"
                                                title="You can only restore categories you created or if you are an admin."
                                            >
                                                <Undo2 className="mr-2 h-4 w-4 opacity-50"/>Restore
                                            </DropdownMenuItem>
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    );
                })}
            </TableBody>
        </Table>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Categories</h1>
        {canWrite(currentUser) ? (
            <Button onClick={() => openDialog()}>
                <Plus className="mr-2 h-4 w-4" /> Add Category
            </Button>
        ) : (
            <SimpleTooltip content="You do not have permission to add categories.">
                <div> 
                    <Button disabled>
                        <Plus className="mr-2 h-4 w-4" /> Add Category
                    </Button>
                </div>
            </SimpleTooltip>
        )}
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
      
      <Dialog open={archiveDialog.open} onOpenChange={(isOpen) => setArchiveDialog({ ...archiveDialog, open: isOpen })}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" /> Archive Category</DialogTitle>
              </DialogHeader>
              {archiveDialog.dependencies === 'loading' ? (<p>Checking dependencies...</p>) : 
              archiveDialog.dependencies?.assets > 0 ? (
                  <div className="space-y-4">
                      <p>This category cannot be archived because it is linked to {archiveDialog.dependencies.assets} active asset(s). Please reassign them first.</p>
                      <DialogFooter><Button variant="outline" onClick={() => setArchiveDialog({ open: false, item: null, dependencies: null })}>Close</Button></DialogFooter>
                  </div>
              ) : (
                  <div className="space-y-4">
                      <p>Are you sure you want to archive the category "{archiveDialog.item?.name}"?</p>
                      <DialogFooter>
                          <Button variant="outline" onClick={() => setArchiveDialog({ open: false, item: null, dependencies: null })}>Cancel</Button>
                          <Button variant="destructive" onClick={handleArchiveConfirm}>Archive</Button>
                      </DialogFooter>
                  </div>
              )}
          </DialogContent>
      </Dialog>
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
              <TabsTrigger value="active">Active ({activeItems.length})</TabsTrigger>
              <TabsTrigger value="archived">Archived ({archivedItems.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="active">
              <Card><CardContent className="p-0"><ItemsTable items={activeItems} isArchived={false} /></CardContent></Card>
          </TabsContent>
          <TabsContent value="archived">
              <Card><CardContent className="p-0"><ItemsTable items={archivedItems} isArchived={true} /></CardContent></Card>
          </TabsContent>
      </Tabs>
    </div>
  );
}
