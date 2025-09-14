import React from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

export default function BulkActionsBar({
  count,
  onAssignCategory,
  onAssignLocation,
  onDelete,
  onClear,
}) {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-background border rounded-lg shadow-lg p-3 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-5">
      <p className="text-sm font-medium">{count} asset(s) selected</p>
      <div className="h-6 border-l"></div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onAssignCategory}>Assign Category</Button>
        <Button variant="outline" size="sm" onClick={onAssignLocation}>Assign Location</Button>
        <Button variant="destructive" size="sm" onClick={onDelete}>Delete</Button>
      </div>
      <div className="h-6 border-l"></div>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClear}>
        <X className="h-4 w-4" />
        <span className="sr-only">Clear selection</span>
      </Button>
    </div>
  );
}