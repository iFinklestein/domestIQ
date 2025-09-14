import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertTriangle } from 'lucide-react';

export default function BulkDeleteDialog({
  open,
  onOpenChange,
  count,
  onConfirm,
  loading = false
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Confirm Bulk Deletion
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to permanently delete <strong>{count}</strong> selected asset(s)? This action cannot be undone.
            </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={onConfirm} 
            disabled={loading}
          >
            {loading ? 'Deleting...' : `Delete ${count} assets`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}