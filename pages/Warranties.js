// /pages/Warranties.js
import React, { useState, useEffect } from 'react';
import { Warranty } from '@/entities/Warranty';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';

export default function WarrantiesPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    const data = await Warranty.list('-created_date');
    setItems(data);
    setLoading(false);
  };
  
  const handleSave = async () => {
    if (!currentItem || !currentItem.providerName || !currentItem.endDate) return;
    await (currentItem.id ? Warranty.update(currentItem.id, currentItem) : Warranty.create(currentItem));
    fetchItems();
    setOpen(false);
    setCurrentItem(null);
  };
  
  const handleDelete = async (id) => {
    if (window.confirm('Are you sure? This could affect existing assets.')) {
        await Warranty.delete(id);
        fetchItems();
    }
  };

  const openDialog = (item = null) => {
    const emptyItem = { providerName: '', policyNumber: '', startDate: '', endDate: '', terms: '', files: [] };
    const itemToEdit = item ? {
        ...item,
        startDate: item.startDate ? item.startDate.split('T')[0] : '',
        endDate: item.endDate ? item.endDate.split('T')[0] : '',
    } : emptyItem;
    setCurrentItem(itemToEdit);
    setOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Warranties</h1>
        <Button onClick={() => openDialog()}><Plus className="mr-2 h-4 w-4" /> Add Warranty</Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>{currentItem?.id ? 'Edit' : 'Add'} Warranty</DialogTitle></DialogHeader>
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
            <TableHeader><TableRow><TableHead>Provider</TableHead><TableHead>Policy #</TableHead><TableHead>End Date</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan="4" className="text-center">Loading...</TableCell></TableRow>
              ) : items.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.providerName}</TableCell>
                    <TableCell>{item.policyNumber}</TableCell>
                    <TableCell>{format(new Date(item.endDate), 'MMM d, yyyy')}</TableCell>
                    <TableCell className="text-right">
                       <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openDialog(item)}><Edit className="mr-2 h-4 w-4"/>Edit</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(item.id)} className="text-red-600"><Trash2 className="mr-2 h-4 w-4"/>Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
      </CardContent></Card>
    </div>
  );
}
