
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { normalizeRole, isAdmin, canManageProperties } from "@/components/roles";
import {
  LayoutDashboard,
  Box,
  Shapes,
  MapPin,
  Building,
  Building2,
  ShieldCheck,
  Upload,
  Users,
  User as UserIcon,
  Menu,
  X,
  Wrench,
  FileText,
  LifeBuoy // Self-check icon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Toaster } from "@/components/ui/toaster";
import { AuthGate } from "@/components/AuthGate";
import { useAuth } from "@/components/useAuth";

const themeVariables = `
  :root {
    --bg: #0f172a;
    --surface: #111827;
    --surface-2: #1f2937;
    --text: #0b1220;
    --muted: #6b7280;
    --accent: #10b981;
    --warn: #f59e0b;
    --danger: #ef4444;
    --border: #e5e7eb;
    --brand-logo-desktop: 48px;
    --brand-logo-mobile: 28px;
  }

  .sidebar .brand-logo,
  .app-sidebar .brand-logo {
    display: inline-flex;
    align-items: center;
    height: var(--brand-logo-desktop);
    padding: 16px 16px;
    overflow: visible;
    flex-shrink: 0;
  }

  .sidebar .brand-logo img,
  .sidebar .brand-logo svg,
  .app-sidebar .brand-logo img,
  .app-sidebar .brand-logo svg {
    height: 100% !important;
    width: auto !important;
    max-width: none !important;
  }

  .header .brand-logo,
  .topbar .brand-logo {
    display: inline-flex;
    align-items: center;
    height: var(--brand-logo-mobile);
    flex-shrink: 0;
  }
  .header .brand-logo img,
  .header .brand-logo svg,
  .topbar .brand-logo img,
  .topbar .brand-logo svg {
    height: 100% !important;
    width: auto !important;
    max-width: none !important;
  }

  .brand-logo img,
  .brand-logo svg {
    height: 100% !important;
    width: auto !important;
    max-width: none !important;
  }
`;

const navigationItems = [
  { title: "Dashboard", url: "Dashboard", icon: LayoutDashboard },
  { title: "Assets", url: "Assets", icon: Box },
  { title: "Maintenance", url: "MaintenanceRequests", icon: Wrench },
  { title: "Properties", url: "Properties", icon: Building2, requiredRole: "manager" },
  { title: "Categories", url: "Categories", icon: Shapes, requiredRole: "manager" },
  { title: "Locations", url: "Locations", icon: MapPin, requiredRole: "manager" },
  { title: "Vendors", url: "Vendors", icon: Building, requiredRole: "manager" },
  { title: "Warranties", url: "Warranties", icon: ShieldCheck, requiredRole: "manager" },
  { title: "Import/Export", url: "ImportExport", icon: Upload, requiredRole: "manager" },
  { title: "Activity Log", url: "ActivityLog", icon: FileText, requiredRole: "admin" },
  { title: "Self Check", url: "AdminSelfCheck", icon: LifeBuoy, requiredRole: "admin" },
];

function NavItem({ item, pathname, onClick, currentUser }) {
  if (item.requiredRole === "manager" && !canManageProperties(currentUser)) {
    return null;
  }
  if (item.requiredRole === "admin" && !isAdmin(currentUser)) {
    return null;
  }
  const isActive = pathname.startsWith(createPageUrl(item.url));
  return (
    <Link
      to={createPageUrl(item.url)}
      onClick={onClick}
      className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
        isActive
          ? "bg-[var(--surface)] text-white"
          : "text-gray-300 hover:bg-[var(--surface-2)] hover:text-white"
      }`}
    >
      <item.icon className="mr-3 h-5 w-5" />
      {item.title}
    </Link>
  );
}

function LayoutContent({ children }) {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const { user } = useAuth(); // User is guaranteed to be loaded here

  return (
    <div className="min-h-screen flex flex-col sm:flex-row bg-gray-50 font-sans">
      {/* Mobile Header */}
      <div className="sm:hidden w-full bg-[var(--bg)] text-white p-4 flex justify-between items-center shadow-md header">
        <Link to={createPageUrl("Dashboard")} className="brand-logo" aria-label="domestiQ home">
          <img
            src="https://raw.githubusercontent.com/iFinklestein/domestIQ/main/public/domestiq-dark-bg.svg"
            alt="domestiQ"
            loading="eager"
          />
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden sm:flex w-64 bg-[var(--bg)] text-white flex-col sidebar">
        <div className="flex items-center justify-start bg-[var(--surface)]">
          <Link to={createPageUrl("Dashboard")} className="brand-logo" aria-label="domestiQ home">
            <img
              src="https://raw.githubusercontent.com/iFinklestein/domestIQ/main/public/domestiq-dark-bg.svg"
              alt="domestiQ"
              loading="eager"
            />
          </Link>
        </div>
        <div className="flex-1 flex flex-col overflow-y-auto">
          <nav className="flex-1 px-2 py-4 space-y-1">
            {navigationItems.map((item) => (
              <NavItem
                key={item.title}
                item={item}
                pathname={location.pathname}
                currentUser={user}
              />
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 w-full flex flex-col overflow-auto">
        {/* Desktop Header */}
        <div className="hidden sm:flex bg-white shadow-sm justify-end items-center h-16 px-8">
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <UserIcon className="h-5 w-5 text-[var(--muted)]" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <p className="text-sm font-medium">{user?.full_name || 'User'}</p>
                  <p className="text-xs text-muted-foreground">{user?.email || 'No email'}</p>
                  <p className="text-xs text-muted-foreground font-semibold mt-1">
                    {normalizeRole(user?.app_role)}
                  </p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Log out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Page Content */}
        <main className="flex-1 w-full overflow-auto px-6 sm:px-8 py-6 bg-gray-50">
          {children}
        </main>
      </div>

      {/* Mobile Navigation Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <div
            className="fixed inset-0 bg-gray-600 bg-opacity-75"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed top-16 left-0 right-0 bg-[var(--bg)] text-white shadow-lg">
            <nav className="px-2 py-4 space-y-1">
              {navigationItems.map((item) => (
                <NavItem
                  key={item.title}
                  item={item}
                  pathname={location.pathname}
                  currentUser={user}
                  onClick={() => setSidebarOpen(false)}
                />
              ))}
            </nav>
          </div>
        </div>
      )}

      <Toaster />
    </div>
  );
}

export default function Layout({ children }) {
  return (
    <>
      <style>{themeVariables}</style>
      <AuthGate>
        <LayoutContent>{children}</LayoutContent>
      </AuthGate>
    </>
  );
}
