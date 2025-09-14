import React, { useState, useRef } from 'react';
import { Asset } from '@/api/entities';
import { UploadFile } from '@/api/integrations';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from "@/components/ui/use-toast";
import { Upload, Trash2, Loader2, Image as ImageIcon } from 'lucide-react';

export default function PhotoGallery({ asset, canEdit, onUpdate }) {
    const { toast } = useToast();
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);

    const handleFileChange = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast({ variant: "destructive", title: "Invalid File Type", description: "Please upload an image file." });
            return;
        }

        setUploading(true);
        try {
            const { file_url } = await UploadFile({ file });
            const updatedPhotos = [...(asset.photos || []), file_url];
            const updatedAsset = await Asset.update(asset.id, { photos: updatedPhotos });
            onUpdate(updatedAsset);
            toast({ title: "Success", description: "Photo uploaded." });
        } catch (error) {
            console.error("Failed to upload photo:", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to upload photo." });
        } finally {
            setUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    const handleDelete = async (photoUrl) => {
        if (!window.confirm("Are you sure you want to delete this photo?")) return;

        try {
            const updatedPhotos = asset.photos.filter(p => p !== photoUrl);
            const updatedAsset = await Asset.update(asset.id, { photos: updatedPhotos });
            onUpdate(updatedAsset);
            toast({ title: "Success", description: "Photo deleted." });
        } catch (error) {
            console.error("Failed to delete photo:", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to delete photo." });
        }
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Photo Gallery</CardTitle>
                {canEdit && (
                    <>
                        <Input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            className="hidden"
                            accept="image/*"
                            disabled={uploading}
                        />
                        <Button
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                        >
                            {uploading ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Upload className="mr-2 h-4 w-4" />
                            )}
                            Upload Photo
                        </Button>
                    </>
                )}
            </CardHeader>
            <CardContent>
                {(asset.photos || []).length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {asset.photos.map((photo, index) => (
                            <div key={index} className="relative group aspect-square">
                                <img
                                    src={photo}
                                    alt={`Asset photo ${index + 1}`}
                                    className="w-full h-full object-cover rounded-md"
                                />
                                {canEdit && (
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <Button
                                            variant="destructive"
                                            size="icon"
                                            onClick={() => handleDelete(photo)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-10 border-2 border-dashed rounded-lg">
                        <ImageIcon className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-2 text-sm font-semibold text-gray-900">No photos</h3>
                        <p className="mt-1 text-sm text-gray-500">
                            {canEdit ? "Upload photos to get started." : "This asset has no photos."}
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}