// /pages/AssetDetail.js
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Asset } from '@/entities/Asset';
import { Category } from '@/entities/Category';
import { Location as AssetLocation } from '@/entities/Location';
import { Vendor } from '@/entities/Vendor';
import { Warranty } from '@/entities/Warranty';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Edit, Download, ExternalLink, Phone, Mail, Calendar, DollarSign } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const InfoField = ({ label, value, icon: Icon }) => (
  <div className="flex items-center gap-3">
    {Icon && <Icon className="w-4 h-4 text-muted-foreground" />}
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-medium">{value || '—'}</p>
    </div>
  </div>
);

const VendorCard = ({ vendor }) => {
  if (!vendor) return null;
  
  const formatWebsite = (url) => {
    if (!url) return null;
    return url.startsWith('http') ? url : `https://${url}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Vendor Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="font-medium">{vendor.name}</p>
        </div>
        {vendor.website && (
          <div className="flex items-center gap-2">
            <ExternalLink className="w-4 h-4 text-muted-foreground" />
            <a 
              href__={formatWebsite(vendor.website)} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              {vendor.website}
            </a>
          </div>
        )}
        {vendor.email && (
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-muted-foreground" />
            <a href__={`mailto:${vendor.email}`} className="text-blue-600 hover:underline">
              {vendor.email}
            </a>
          </div>
        )}
        {vendor.phone && (
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-muted-foreground" />
            <a href__={`tel:${vendor.phone}`} className="text-blue-600 hover:underline">
              {vendor.phone}
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const WarrantyCard = ({ warranty }) => {
  if (!warranty) return null;

  const isExpired = new Date(warranty.endDate) < new Date();
  const isExpiringSoon = new Date(warranty.endDate) < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between">
          Warranty Information
          <Badge variant={isExpired ? "destructive" : isExpiringSoon ? "outline" : "default"}>
            {isExpired ? "Expired" : isExpiringSoon ? "Expiring Soon" : "Active"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <InfoField label="Provider" value={warranty.providerName} />
        <InfoField label="Policy Number" value={warranty.policyNumber} />
        <InfoField 
          label="Valid Until" 
          value={warranty.endDate ? format(new Date(warranty.endDate), 'MMM d, yyyy') : null} 
          icon={Calendar}
        />
        {warranty.terms && (
          <div>
            <p className="text-sm text-muted-foreground">Terms</p>
            <p className="text-sm">{warranty.terms}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default function AssetDetail() {
  const location = useLocation();
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(location.search);
  const assetId = urlParams.get('id');

  const [asset, setAsset] = useState(null);
  const [relatedData, setRelatedData] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!assetId) {
        navigate(createPageUrl('Assets'));
        return;
      }

      try {
        const assetData = await Asset.get(assetId);
        setAsset(assetData);

        // Fetch related data
        const [categories, locations, vendors, warranties] = await Promise.all([
          Category.list(),
          AssetLocation.list(),
          Vendor.list(),
          Warranty.list()
        ]);

        const category = categories.find(c => c.id === assetData.categoryId);
        const location = locations.find(l => l.id === assetData.locationId);
        const vendor = vendors.find(v => v.id === assetData.vendorId);
        const warranty = warranties.find(w => w.id === assetData.warrantyId);

        setRelatedData({ category, location, vendor, warranty });
      } catch (error) {
        console.error("Failed to load asset details:", error);
        navigate(createPageUrl('Assets'));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [assetId, navigate]);

  if (loading) return <div>Loading asset details...</div>;
  if (!asset) return <div>Asset not found</div>;

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <nav className="flex" aria-label="Breadcrumb">
        <ol className="flex items-center space-x-2">
          <li><Link to={createPageUrl('Dashboard')} className="text-blue-600 hover:underline">Dashboard</Link></li>
          <li><span className="text-muted-foreground">/</span></li>
          <li><Link to={createPageUrl('Assets')} className="text-blue-600 hover:underline">Assets</Link></li>
          <li><span className="text-muted-foreground">/</span></li>
          <li><span className="font-medium">{asset.name}</span></li>
        </ol>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate(createPageUrl('Assets'))}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Assets
          </Button>
          <h1 className="text-3xl font-bold">{asset.name}</h1>
        </div>
        <Link to={createPageUrl(`AssetForm?id=${asset.id}`)}>
          <Button>
            <Edit className="mr-2 h-4 w-4" /> Edit Asset
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Asset Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <InfoField label="Name" value={asset.name} />
              <InfoField label="Model" value={asset.model} />
              <InfoField label="Serial Number" value={asset.serialNumber} />
              <InfoField label="Category" value={relatedData.category?.name} />
              <InfoField label="Location" value={relatedData.location?.name} />
              <InfoField label="Condition" value={asset.condition} />
              <InfoField 
                label="Purchase Date" 
                value={asset.purchaseDate ? format(new Date(asset.purchaseDate), 'MMM d, yyyy') : null}
                icon={Calendar}
              />
              <InfoField 
                label="Purchase Price" 
                value={asset.purchasePrice ? `$${asset.purchasePrice.toFixed(2)}` : null}
                icon={DollarSign}
              />
            </CardContent>
          </Card>

          {/* Notes */}
          {asset.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p>{asset.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Photos */}
          {asset.photos && asset.photos.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Photos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {asset.photos.map((photo, index) => (
                    <img
                      key={index}
                      src={photo}
                      alt={`Asset photo ${index + 1}`}
                      className="w-full h-24 object-cover rounded-md cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => setSelectedPhoto(photo)}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Receipts */}
          {asset.receipts && asset.receipts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Receipts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {asset.receipts.map((receipt, index) => (
                    <div key={index} className="flex items-center justify-between p-2 border rounded-md">
                      <span>Receipt {index + 1}</span>
                      <a
                        href__={receipt}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-600 hover:underline"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </a>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <VendorCard vendor={relatedData.vendor} />
          <WarrantyCard warranty={relatedData.warranty} />
        </div>
      </div>

      {/* Photo Preview Dialog */}
      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Photo Preview</DialogTitle>
          </DialogHeader>
          {selectedPhoto && (
            <img
              src={selectedPhoto}
              alt="Asset photo preview"
              className="w-full h-auto max-h-[70vh] object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
