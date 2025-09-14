import Layout from "./Layout.jsx";

import Dashboard from "./Dashboard";

import Assets from "./Assets";

import AssetForm from "./AssetForm";

import Categories from "./Categories";

import Locations from "./Locations";

import Vendors from "./Vendors";

import Warranties from "./Warranties";

import ImportExport from "./ImportExport";

import AssetDetail from "./AssetDetail";

import Tenants from "./Tenants";

import TenantDetail from "./TenantDetail";

import Properties from "./Properties";

import PropertyDetail from "./PropertyDetail";

import MaintenanceRequests from "./MaintenanceRequests";

import MaintenanceRequestForm from "./MaintenanceRequestForm";

import ActivityLog from "./ActivityLog";

import PropertyForm from "./PropertyForm";

import AdminSelfCheck from "./AdminSelfCheck";

import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';

const PAGES = {
    
    Dashboard: Dashboard,
    
    Assets: Assets,
    
    AssetForm: AssetForm,
    
    Categories: Categories,
    
    Locations: Locations,
    
    Vendors: Vendors,
    
    Warranties: Warranties,
    
    ImportExport: ImportExport,
    
    AssetDetail: AssetDetail,
    
    Tenants: Tenants,
    
    TenantDetail: TenantDetail,
    
    Properties: Properties,
    
    PropertyDetail: PropertyDetail,
    
    MaintenanceRequests: MaintenanceRequests,
    
    MaintenanceRequestForm: MaintenanceRequestForm,
    
    ActivityLog: ActivityLog,
    
    PropertyForm: PropertyForm,
    
    AdminSelfCheck: AdminSelfCheck,
    
}

function _getCurrentPage(url) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }

    const pageName = Object.keys(PAGES).find(page => page.toLowerCase() === urlLastPart.toLowerCase());
    return pageName || Object.keys(PAGES)[0];
}

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);
    
    return (
        <Layout currentPageName={currentPage}>
            <Routes>            
                
                    <Route path="/" element={<Dashboard />} />
                
                
                <Route path="/Dashboard" element={<Dashboard />} />
                
                <Route path="/Assets" element={<Assets />} />
                
                <Route path="/AssetForm" element={<AssetForm />} />
                
                <Route path="/Categories" element={<Categories />} />
                
                <Route path="/Locations" element={<Locations />} />
                
                <Route path="/Vendors" element={<Vendors />} />
                
                <Route path="/Warranties" element={<Warranties />} />
                
                <Route path="/ImportExport" element={<ImportExport />} />
                
                <Route path="/AssetDetail" element={<AssetDetail />} />
                
                <Route path="/Tenants" element={<Tenants />} />
                
                <Route path="/TenantDetail" element={<TenantDetail />} />
                
                <Route path="/Properties" element={<Properties />} />
                
                <Route path="/PropertyDetail" element={<PropertyDetail />} />
                
                <Route path="/MaintenanceRequests" element={<MaintenanceRequests />} />
                
                <Route path="/MaintenanceRequestForm" element={<MaintenanceRequestForm />} />
                
                <Route path="/ActivityLog" element={<ActivityLog />} />
                
                <Route path="/PropertyForm" element={<PropertyForm />} />
                
                <Route path="/AdminSelfCheck" element={<AdminSelfCheck />} />
                
            </Routes>
        </Layout>
    );
}

export default function Pages() {
    return (
        <Router>
            <PagesContent />
        </Router>
    );
}