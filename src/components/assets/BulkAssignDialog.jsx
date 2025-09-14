import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

export default function BulkAssignDialog({
  open,
  onOpenChange,
  title,
  label,
  options,
  onConfirm,
  loading = false
}) {
  const [selectedValue, setSelectedValue] = useState('');

  const handleConfirm = () => {
    if (!selectedValue) {
      alert(`Please select a ${label.toLowerCase()}.`);
      return;
    }
    onConfirm(selectedValue);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        
        <div className="py-4 space-y-2">
          <Label htmlFor="bulk-assign-select">{label}</Label>
          <Select value={selectedValue} onValueChange={setSelectedValue}>
            <SelectTrigger id="bulk-assign-select">
              <SelectValue placeholder={`Select a ${label.toLowerCase()}...`} />
            </SelectTrigger>
            <SelectContent>
              {options.map(opt => (
                <SelectItem key={opt.id} value={opt.id}>
                  {opt.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={loading}>
            {loading ? 'Assigning...' : 'Assign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}