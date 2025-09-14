import React, { useState, useRef } from 'react';
import { Asset } from '@/api/entities';
import { UploadFile } from '@/api/integrations';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from "@/components/ui/use-toast";
import { Upload, Trash2, Loader2, FileText, ExternalLink, FileQuestion } from 'lucide-react';
import { format } from 'date-fns';

const getFileIcon = (fileName) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    if (extension === 'pdf') return <FileText className="h-5 w-5 text-red-500" />;
    return <FileQuestion className="h-5 w-5 text-gray-500" />;
};

export default function DocumentManager({ asset, canEdit, onUpdate }) {
    const { toast } = useToast();
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);

    const handleFileChange = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setUploading(true);
        try {
            const { file_url } = await UploadFile({ file });
            const newDocument = { name: file.name, url: file_url };
            const updatedDocuments = [...(asset.documents || []), newDocument];
            const updatedAsset = await Asset.update(asset.id, { documents: updatedDocuments });
            onUpdate(updatedAsset);
            toast({ title: "Success", description: "Document uploaded." });
        } catch (error) {
            console.error("Failed to upload document:", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to upload document." });
        } finally {
            setUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    const handleDelete = async (docUrl) => {
        if (!window.confirm("Are you sure you want to delete this document?")) return;
        try {
            const updatedDocuments = asset.documents.filter(d => d.url !== docUrl);
            const updatedAsset = await Asset.update(asset.id, { documents: updatedDocuments });
            onUpdate(updatedAsset);
            toast({ title: "Success", description: "Document deleted." });
        } catch (error) {
            console.error("Failed to delete document:", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to delete document." });
        }
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Documents (Receipts, Manuals, etc.)</CardTitle>
                {canEdit && (
                    <>
                        <Input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            className="hidden"
                            accept=".pdf,image/*"
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
                            Upload Document
                        </Button>
                    </>
                )}
            </CardHeader>
            <CardContent>
                {(asset.documents || []).length > 0 ? (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[50px]"></TableHead>
                                <TableHead>File Name</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {asset.documents.map((doc, index) => (
                                <TableRow key={index}>
                                    <TableCell>{getFileIcon(doc.name)}</TableCell>
                                    <TableCell className="font-medium">{doc.name}</TableCell>
                                    <TableCell className="text-right">
                                        <a href={doc.url} target="_blank" rel="noopener noreferrer">
                                            <Button variant="outline" size="sm" className="mr-2">
                                                <ExternalLink className="h-4 w-4 mr-2" />
                                                View
                                            </Button>
                                        </a>
                                        {canEdit && (
                                            <Button
                                                variant="destructive"
                                                size="icon"
                                                onClick={() => handleDelete(doc.url)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                ) : (
                    <div className="text-center py-10 border-2 border-dashed rounded-lg">
                        <FileText className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-2 text-sm font-semibold text-gray-900">No documents</h3>
                        <p className="mt-1 text-sm text-gray-500">
                           {canEdit ? "Upload receipts, manuals, or other documents." : "This asset has no documents."}
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}