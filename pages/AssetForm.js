// /pages/AssetForm.js
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Asset } from '@/entities/Asset';
import { Category } from '@/entities/Category';
import { Location as AssetLocation } from '@/entities/Location';
import { Vendor } from '@/entities/Vendor';
import { Warranty } from '@/entities/Warranty';
import { UploadFile } from '@/integrations/Core';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Save, UploadCloud, Trash2, Camera, Loader2 } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { useToast } from "@/components/ui/use-toast";

export default function AssetForm() {
    const navigate = useNavigate();
    const location = useLocation();
    const urlParams = new URLSearchParams(location.search);
    const assetId = urlParams.get('id');
    const { toast } = useToast();

    const [asset, setAsset] = useState({
        name: '', categoryId: '', locationId: '', purchaseDate: '', purchasePrice: '', vendorId: '', serialNumber: '',
        model: '', condition: 'Good', notes: '', photos: [], receipts: [], warrantyId: '', tags: []
    });
    const [relatedData, setRelatedData] = useState({ categories: [], locations: [], vendors: [], warranties: [] });
    const [loading, setLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [categories, locations, vendors, warranties, currentAsset] = await Promise.all([
                    Category.list(),
                    AssetLocation.list(),
                    Vendor.list(),
                    Warranty.list(),
                    assetId ? Asset.get(assetId) : Promise.resolve(null)
                ]);
                setRelatedData({ categories, locations, vendors, warranties });
                if (currentAsset) {
                    // Ensure date is in 'yyyy-MM-dd' format for the input
                    currentAsset.purchaseDate = currentAsset.purchaseDate ? currentAsset.purchaseDate.split('T')[0] : '';
                    setAsset(currentAsset);
                }
            } catch (error) {
                console.error("Error loading data for asset form:", error);
                 toast({
                    variant: "destructive",
                    title: "Error",
                    description: "Failed to load form data.",
                });
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [assetId, toast]);

    const handleInputChange = (field, value) => {
        setAsset(prev => ({ ...prev, [field]: value }));
    };
    
    const handleFileChange = async (e, field) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        // You could add a loading state for file uploads here
        const uploadedUrls = await Promise.all(
            files.map(async file => {
                const { file_url } = await UploadFile({ file });
                return file_url;
            })
        );
        
        handleInputChange(field, [...asset[field], ...uploadedUrls]);
    };

    const removeFile = (field, index) => {
        handleInputChange(field, asset[field].filter((_, i) => i !== index));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!asset.name) {
            toast({
                variant: "destructive",
                title: "Validation Error",
                description: "Asset name is required.",
            });
            return;
        }
        setIsSaving(true);
        try {
            const dataToSave = { ...asset, purchasePrice: asset.purchasePrice ? parseFloat(asset.purchasePrice) : null };
            if (assetId) {
                await Asset.update(assetId, dataToSave);
            } else {
                await Asset.create(dataToSave);
            }
            toast({
                title: "Success",
                description: `Asset "${asset.name}" has been saved.`,
            });
            navigate(createPageUrl('Assets'));
        } catch (error) {
            console.error("Failed to save asset:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to save asset. Please try again.",
            });
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) return <div>Loading form...</div>;

    const renderFilePreview = (field) => (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-2">
            {asset[field]?.map((url, index) => (
                <div key={index} className="relative group">
                    <img src={url} alt={`${field} preview ${index}`} className="w-full h-24 object-cover rounded-md" />
                    <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeFile(field, index)}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            ))}
        </div>
    );

    return (
        <form onSubmit={handleSubmit} className="space-y-8">
            <div className="flex items-center justify-between">
                <Button type="button" variant="outline" onClick={() => navigate(createPageUrl('Assets'))}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Assets
                </Button>
                <h1 className="text-3xl font-bold">{assetId ? 'Edit Asset' : 'Create Asset'}</h1>
                <Button type="submit" disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Asset
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader><CardTitle>Core Information</CardTitle></CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="md:col-span-2"><Label htmlFor="name">Asset Name*</Label><Input id="name" value={asset.name} onChange={e => handleInputChange('name', e.target.value)} required /></div>
                            <div><Label htmlFor="model">Model</Label><Input id="model" value={asset.model} onChange={e => handleInputChange('model', e.target.value)} /></div>
                            <div><Label htmlFor="serialNumber">Serial Number</Label><Input id="serialNumber" value={asset.serialNumber} onChange={e => handleInputChange('serialNumber', e.target.value)} /></div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle>Purchase & Warranty</CardTitle></CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <div><Label htmlFor="purchaseDate">Purchase Date</Label><Input type="date" id="purchaseDate" value={asset.purchaseDate} onChange={e => handleInputChange('purchaseDate', e.target.value)} /></div>
                           <div><Label htmlFor="purchasePrice">Purchase Price</Label><Input type="number" step="0.01" id="purchasePrice" value={asset.purchasePrice} onChange={e => handleInputChange('purchasePrice', e.target.value)} /></div>
                           <div>
                                <Label htmlFor="vendorId">Vendor</Label>
                                <Select onValueChange={value => handleInputChange('vendorId', value)} value={asset.vendorId}>
                                    <SelectTrigger><SelectValue placeholder="Select a vendor" /></SelectTrigger>
                                    <SelectContent>{relatedData.vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
                                </Select>
                           </div>
                           <div>
                                <Label htmlFor="warrantyId">Warranty</Label>
                                <Select onValueChange={value => handleInputChange('warrantyId', value)} value={asset.warrantyId}>
                                    <SelectTrigger><SelectValue placeholder="Select a warranty" /></SelectTrigger>
                                    <SelectContent>{relatedData.warranties.map(w => <SelectItem key={w.id} value={w.id}>{w.providerName} - {w.policyNumber}</SelectItem>)}</SelectContent>
                                </Select>
                           </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle>Photos & Receipts</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label htmlFor="photos">Photos</Label>
                                {renderFilePreview('photos')}
                                <Input id="photos" type="file" multiple accept="image/*" onChange={e => handleFileChange(e, 'photos')} className="mt-2" />
                            </div>
                            <div>
                                <Label htmlFor="receipts">Receipts</Label>
                                {renderFilePreview('receipts')}
                                <Input id="receipts" type="file" multiple accept="image/*,application/pdf" onChange={e => handleFileChange(e, 'receipts')} className="mt-2" />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card>
                        <CardHeader><CardTitle>Classification</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                           <div>
                                <Label htmlFor="categoryId">Category</Label>
                                <Select onValueChange={value => handleInputChange('categoryId', value)} value={asset.categoryId}>
                                    <SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger>
                                    <SelectContent>{relatedData.categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                                </Select>
                           </div>
                           <div>
                                <Label htmlFor="locationId">Location</Label>
                                <Select onValueChange={value => handleInputChange('locationId', value)} value={asset.locationId}>
                                    <SelectTrigger><SelectValue placeholder="Select a location" /></SelectTrigger>
                                    <SelectContent>{relatedData.locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                                </Select>
                           </div>
                           <div>
                                <Label htmlFor="condition">Condition</Label>
                                <Select onValueChange={value => handleInputChange('condition', value)} value={asset.condition}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="New">New</SelectItem>
                                        <SelectItem value="Good">Good</SelectItem>
                                        <SelectItem value="Fair">Fair</SelectItem>
                                        <SelectItem value="Poor">Poor</SelectItem>
                                    </SelectContent>
                                </Select>
                           </div>
                        </CardContent>
                    </Card>

                     <Card>
                        <CardHeader><CardTitle>Additional Details</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                           <div><Label htmlFor="notes">Notes</Label><Textarea id="notes" value={asset.notes} onChange={e => handleInputChange('notes', e.target.value)} /></div>
                            <div>
                                <Label>Barcode Scanner</Label>
                                <Button type="button" variant="outline" className="w-full mt-1">
                                    <Camera className="mr-2 h-4 w-4" /> Scan Barcode/QR
                                </Button>
                                <p className="text-xs text-muted-foreground mt-1">Placeholder for native scanner component.</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </form>
    );
}
