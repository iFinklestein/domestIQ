// /components/DeleteGuardDialog.js
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { AlertTriangle } from 'lucide-react';

export default function DeleteGuardDialog({
  open,
  onOpenChange,
  title,
  itemName,
  relatedCount,
  relatedType,
  alternatives,
  onConfirm,
  loading = false
}) {
  const [selectedAlternative, setSelectedAlternative] = useState('');

  const handleConfirm = () => {
    if (relatedCount > 0 && !selectedAlternative) {
      alert('Please select a replacement option.');
      return;
    }
    onConfirm(selectedAlternative);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            {title}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {relatedCount > 0 ? (
            <>
              <p className="text-sm text-muted-foreground">
                This {itemName} is currently used by <strong>{relatedCount}</strong> {relatedType}(s). 
                To delete it, please select a replacement:
              </p>
              
              <div className="space-y-2">
                <Label htmlFor="replacement">New {itemName}*</Label>
                <Select 
                  value={selectedAlternative} 
                  onValueChange={setSelectedAlternative}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={`Select a replacement ${itemName.toLowerCase()}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {alternatives.map(alt => (
                      <SelectItem key={alt.id} value={alt.id}>
                        {alt.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <p className="text-xs text-muted-foreground">
                All related {relatedType}(s) will be moved to the selected {itemName.toLowerCase()}, 
                then the original will be deleted.
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete this {itemName.toLowerCase()}? This action cannot be undone.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleConfirm} 
            disabled={loading}
          >
            {loading ? 'Processing...' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
