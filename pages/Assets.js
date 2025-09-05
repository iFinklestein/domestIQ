// /pages/Assets.js
import React, { useState, useEffect, useCallback } from 'react';
import { Asset } from '@/entities/Asset';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, MoreHorizontal, Edit, Trash2, Search, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from "@/components/ui/use-toast";

export default function AssetsPage() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const assetList = await Asset.list('-created_date');
      setAssets(assetList);
    } catch (error) {
      console.error("Failed to fetch assets:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not load assets. Please try refreshing the page.",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);
  
  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to permanently delete this asset?')) {
        try {
            await Asset.delete(id);
            toast({
                title: "Success",
                description: "Asset has been deleted.",
            });
            fetchAssets(); // Refresh list
        } catch (error) {
            console.error("Failed to delete asset:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to delete asset. Please try again.",
            });
        }
    }
  };

  const filteredAssets = assets.filter(asset => {
    const searchFields = [
      asset.name,
      asset.serialNumber,
      asset.model,
      ...(asset.tags || [])
    ].filter(Boolean).join(' ').toLowerCase();
    
    return searchFields.includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Assets</h1>
        <Link to={createPageUrl('AssetForm')}>
          <Button>
            <Plus className="mr-2 h-4 w-4" /> Add Asset
          </Button>
        </Link>
      </div>

      <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            type="search" 
            placeholder="Search by name, serial number, model, tags..." 
            className="pl-8 sm:w-[400px]"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Serial Number</TableHead>
                <TableHead className="hidden md:table-cell">Model</TableHead>
                <TableHead className="hidden md:table-cell">Purchase Date</TableHead>
                <TableHead>Price</TableHead>
                <TableHead><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan="6" className="text-center">Loading...</TableCell></TableRow>
              ) : filteredAssets.length > 0 ? (
                filteredAssets.map(asset => (
                  <TableRow key={asset.id}>
                    <TableCell className="font-medium">
                      <Link 
                        to={createPageUrl(`AssetDetail?id=${asset.id}`)}
                        className="text-blue-600 hover:underline"
                      >
                        {asset.name}
                      </Link>
                    </TableCell>
                    <TableCell>{asset.serialNumber || '—'}</TableCell>
                    <TableCell className="hidden md:table-cell">{asset.model || '—'}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {asset.purchaseDate ? format(new Date(asset.purchaseDate), 'MMM d, yyyy') : '—'}
                    </TableCell>
                    <TableCell>${(asset.purchasePrice || 0).toFixed(2)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button aria-haspopup="true" size="icon" variant="ghost">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Toggle menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <Link to={createPageUrl(`AssetDetail?id=${asset.id}`)}>
                            <DropdownMenuItem className="cursor-pointer">
                              <Eye className="mr-2 h-4 w-4"/>View
                            </DropdownMenuItem>
                          </Link>
                          <Link to={createPageUrl(`AssetForm?id=${asset.id}`)}>
                            <DropdownMenuItem className="cursor-pointer">
                              <Edit className="mr-2 h-4 w-4"/>Edit
                            </DropdownMenuItem>
                          </Link>
                          <DropdownMenuItem onClick={() => handleDelete(asset.id)} className="text-red-600 cursor-pointer">
                            <Trash2 className="mr-2 h-4 w-4"/>Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan="6" className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-muted-foreground">No assets found</p>
                      {searchTerm ? (
                        <Button variant="outline" onClick={() => setSearchTerm('')}>
                          Clear search
                        </Button>
                      ) : (
                        <Link to={createPageUrl('AssetForm')}>
                          <Button>
                            <Plus className="mr-2 h-4 w-4" /> Add your first asset
                          </Button>
                        </Link>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
