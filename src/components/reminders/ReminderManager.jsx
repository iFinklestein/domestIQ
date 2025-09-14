import React, { useState, useEffect, useCallback } from 'react';
import { Reminder } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, MoreHorizontal, CheckCircle2, Clock, AlertTriangle, Edit, Trash2 } from 'lucide-react';
import { format, addDays, addMonths, addYears, isBefore, isToday } from 'date-fns';
import { useToast } from "@/components/ui/use-toast";

const CADENCE_OPTIONS = {
    monthly: { label: 'Monthly', days: 30 },
    quarterly: { label: 'Quarterly', days: 90 },
    yearly: { label: 'Yearly', days: 365 },
    custom: { label: 'Custom', days: null }
};

const calculateNextDueDate = (cadence, customDays = null, fromDate = new Date()) => {
    const baseDate = new Date(fromDate);
    
    switch (cadence) {
        case 'monthly':
            return addMonths(baseDate, 1).toISOString().split('T')[0];
        case 'quarterly':
            return addMonths(baseDate, 3).toISOString().split('T')[0];
        case 'yearly':
            return addYears(baseDate, 1).toISOString().split('T')[0];
        case 'custom':
            return addDays(baseDate, customDays || 30).toISOString().split('T')[0];
        default:
            return addMonths(baseDate, 1).toISOString().split('T')[0];
    }
};

const getReminderStatus = (nextDueDate) => {
    const dueDate = new Date(nextDueDate);
    const today = new Date();
    
    if (isBefore(dueDate, today)) {
        return { status: 'overdue', variant: 'destructive', icon: AlertTriangle };
    } else if (isToday(dueDate)) {
        return { status: 'due today', variant: 'secondary', icon: Clock };
    } else {
        const daysUntil = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
        if (daysUntil <= 7) {
            return { status: 'due soon', variant: 'outline', icon: Clock };
        }
        return { status: 'upcoming', variant: 'default', icon: CheckCircle2 };
    }
};

export default function ReminderManager({ asset, canEdit = true }) {
    const [reminders, setReminders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [currentReminder, setCurrentReminder] = useState(null);
    const { toast } = useToast();

    const fetchReminders = useCallback(async () => {
        if (!asset?.id) return;
        
        setLoading(true);
        try {
            const reminderData = await Reminder.filter({ 
                asset_id: asset.id,
                is_active: true 
            });
            setReminders(reminderData.sort((a, b) => new Date(a.next_due_date) - new Date(b.next_due_date)));
        } catch (error) {
            console.error("Failed to fetch reminders:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not load reminders." });
        } finally {
            setLoading(false);
        }
    }, [asset?.id, toast]);

    useEffect(() => {
        fetchReminders();
    }, [fetchReminders]);

    const handleSave = async () => {
        if (!currentReminder?.title || !currentReminder?.next_due_date) {
            toast({ variant: "destructive", title: "Validation Error", description: "Title and due date are required." });
            return;
        }

        if (currentReminder.cadence === 'custom' && !currentReminder.custom_interval_days) {
            toast({ variant: "destructive", title: "Validation Error", description: "Custom interval is required for custom cadence." });
            return;
        }

        try {
            const dataToSave = {
                ...currentReminder,
                asset_id: asset.id
            };

            if (currentReminder.id) {
                await Reminder.update(currentReminder.id, dataToSave);
                toast({ title: "Success", description: "Reminder updated." });
            } else {
                await Reminder.create(dataToSave);
                toast({ title: "Success", description: "Reminder created." });
            }

            setOpen(false);
            setCurrentReminder(null);
            fetchReminders();
        } catch (error) {
            console.error("Failed to save reminder:", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to save reminder." });
        }
    };

    const handleComplete = async (reminder) => {
        try {
            const completedAt = new Date().toISOString();
            const nextDueDate = calculateNextDueDate(
                reminder.cadence, 
                reminder.custom_interval_days,
                new Date()
            );

            await Reminder.update(reminder.id, {
                ...reminder,
                completed_at: completedAt,
                next_due_date: nextDueDate
            });

            toast({ title: "Success", description: "Reminder marked complete. Next due date updated." });
            fetchReminders();
        } catch (error) {
            console.error("Failed to complete reminder:", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to complete reminder." });
        }
    };

    const handleDelete = async (reminder) => {
        if (window.confirm(`Are you sure you want to delete the reminder "${reminder.title}"?`)) {
            try {
                await Reminder.update(reminder.id, { is_active: false });
                toast({ title: "Success", description: "Reminder deleted." });
                fetchReminders();
            } catch (error) {
                console.error("Failed to delete reminder:", error);
                toast({ variant: "destructive", title: "Error", description: "Failed to delete reminder." });
            }
        }
    };

    const openDialog = (reminder = null) => {
        setCurrentReminder(reminder || {
            title: '',
            description: '',
            cadence: 'monthly',
            custom_interval_days: 30,
            next_due_date: addDays(new Date(), 30).toISOString().split('T')[0]
        });
        setOpen(true);
    };

    const StatusBadge = ({ reminder }) => {
        const status = getReminderStatus(reminder.next_due_date);
        const Icon = status.icon;
        return (
            <Badge variant={status.variant} className="flex items-center gap-1">
                <Icon className="w-3 h-3" />
                {status.status}
            </Badge>
        );
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Maintenance Reminders</CardTitle>
                {canEdit && (
                    <Button onClick={() => openDialog()} size="sm">
                        <Plus className="mr-2 h-4 w-4" />
                        Add Reminder
                    </Button>
                )}
            </CardHeader>
            <CardContent>
                {loading ? (
                    <p>Loading reminders...</p>
                ) : reminders.length > 0 ? (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Task</TableHead>
                                <TableHead>Frequency</TableHead>
                                <TableHead>Next Due</TableHead>
                                <TableHead>Status</TableHead>
                                {canEdit && <TableHead><span className="sr-only">Actions</span></TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {reminders.map(reminder => (
                                <TableRow key={reminder.id}>
                                    <TableCell>
                                        <div>
                                            <p className="font-medium">{reminder.title}</p>
                                            {reminder.description && (
                                                <p className="text-sm text-muted-foreground">{reminder.description}</p>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {reminder.cadence === 'custom' 
                                            ? `Every ${reminder.custom_interval_days} days`
                                            : CADENCE_OPTIONS[reminder.cadence]?.label || reminder.cadence
                                        }
                                    </TableCell>
                                    <TableCell>
                                        {format(new Date(reminder.next_due_date), 'MMM d, yyyy')}
                                    </TableCell>
                                    <TableCell>
                                        <StatusBadge reminder={reminder} />
                                    </TableCell>
                                    {canEdit && (
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button size="icon" variant="ghost">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem 
                                                        onClick={() => handleComplete(reminder)}
                                                        className="cursor-pointer"
                                                    >
                                                        <CheckCircle2 className="mr-2 h-4 w-4"/>
                                                        Mark Complete
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem 
                                                        onClick={() => openDialog(reminder)}
                                                        className="cursor-pointer"
                                                    >
                                                        <Edit className="mr-2 h-4 w-4"/>
                                                        Edit
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem 
                                                        onClick={() => handleDelete(reminder)}
                                                        className="cursor-pointer text-red-600"
                                                    >
                                                        <Trash2 className="mr-2 h-4 w-4"/>
                                                        Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    )}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                ) : (
                    <div className="text-center py-6">
                        <Clock className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-muted-foreground mb-2">No maintenance reminders set</p>
                        {canEdit && (
                            <Button onClick={() => openDialog()} variant="outline">
                                <Plus className="mr-2 h-4 w-4" /> Add First Reminder
                            </Button>
                        )}
                    </div>
                )}
            </CardContent>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>{currentReminder?.id ? 'Edit' : 'Add'} Maintenance Reminder</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div>
                            <Label htmlFor="title">Task Title*</Label>
                            <Input
                                id="title"
                                value={currentReminder?.title || ''}
                                onChange={e => setCurrentReminder({...currentReminder, title: e.target.value})}
                                placeholder="e.g., Change HVAC filter, Service dishwasher"
                            />
                        </div>
                        <div>
                            <Label htmlFor="description">Description (Optional)</Label>
                            <Textarea
                                id="description"
                                value={currentReminder?.description || ''}
                                onChange={e => setCurrentReminder({...currentReminder, description: e.target.value})}
                                placeholder="Additional notes or instructions..."
                                className="h-20"
                            />
                        </div>
                        <div>
                            <Label htmlFor="cadence">Frequency</Label>
                            <Select 
                                value={currentReminder?.cadence || 'monthly'} 
                                onValueChange={value => setCurrentReminder({...currentReminder, cadence: value})}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(CADENCE_OPTIONS).map(([key, option]) => (
                                        <SelectItem key={key} value={key}>{option.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        {currentReminder?.cadence === 'custom' && (
                            <div>
                                <Label htmlFor="custom_days">Repeat Every (Days)</Label>
                                <Input
                                    id="custom_days"
                                    type="number"
                                    min="1"
                                    max="3650"
                                    value={currentReminder?.custom_interval_days || 30}
                                    onChange={e => setCurrentReminder({...currentReminder, custom_interval_days: parseInt(e.target.value)})}
                                />
                            </div>
                        )}
                        <div>
                            <Label htmlFor="next_due_date">Next Due Date*</Label>
                            <Input
                                id="next_due_date"
                                type="date"
                                value={currentReminder?.next_due_date || ''}
                                onChange={e => setCurrentReminder({...currentReminder, next_due_date: e.target.value})}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave}>
                            {currentReminder?.id ? 'Update' : 'Create'} Reminder
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}