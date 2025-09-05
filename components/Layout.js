// /components/Layout.js
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  LayoutDashboard,
  Box,
  Shapes,
  MapPin,
  Building,
  ShieldCheck,
  Upload,
  User,
  Menu,
  X
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

const navigationItems = [
  { title: "Dashboard", url: "Dashboard", icon: LayoutDashboard },
  { title: "Assets", url: "Assets", icon: Box },
  { title: "Categories", url: "Categories", icon: Shapes },
  { title: "Locations", url: "Locations", icon: MapPin },
  { title: "Vendors", url: "Vendors", icon: Building },
  { title: "Warranties", url: "Warranties", icon: ShieldCheck },
  { title: "Import/Export", url: "ImportExport", icon: Upload },
];

function NavItem({ item, pathname }) {
  const isActive = pathname.startsWith(createPageUrl(item.url));
  return (
    <Link
      to={createPageUrl(item.url)}
      className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
        isActive
          ? "bg-gray-900 text-white"
          : "text-gray-300 hover:bg-gray-700 hover:text-white"
      }`}
    >
      <item.icon className="mr-3 h-5 w-5" />
      {item.title}
    </Link>
  );
}

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Mobile menu button */}
      <div className="bg-gray-800 text-white p-4 flex justify-between items-center md:hidden">
        <Link to={createPageUrl("Dashboard")} className="flex items-center gap-2">
            <svg width="24" height="24" viewBox="0 0 100 100"><path fill="#4A90E2" d="M50 10 L90 30 L90 70 L50 90 L10 70 L10 30 Z M20 35 L50 20 L80 35 L50 50 Z"></path></svg>
            <span className="font-bold text-xl">domestIQ</span>
        </Link>
        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? <X/> : <Menu />}
        </Button>
      </div>

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-gray-800 text-white transform ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } md:relative md:translate-x-0 md:flex md:flex-col md:w-64 transition-transform duration-300 ease-in-out`}
      >
        <div className="flex items-center justify-between h-16 flex-shrink-0 px-4 bg-gray-900">
            <Link to={createPageUrl("Dashboard")} className="flex items-center gap-2">
              <svg width="28" height="28" viewBox="0 0 100 100"><path fill="#4A90E2" d="M50 10 L90 30 L90 70 L50 90 L10 70 L10 30 Z M20 35 L50 20 L80 35 L50 50 Z"></path></svg>
              <span className="font-bold text-xl">domestIQ</span>
            </Link>
            <button onClick={() => setSidebarOpen(false)} className="md:hidden text-gray-300 hover:text-white">
                <X/>
            </button>
        </div>
        <div className="flex-1 flex flex-col overflow-y-auto">
          <nav className="flex-1 px-2 py-4 space-y-1">
            {navigationItems.map((item) => (
              <NavItem key={item.title} item={item} pathname={location.pathname} />
            ))}
          </nav>
        </div>
      </div>
      
      {/* Main content */}
      <div className="md:ml-64 flex flex-col">
        <header className="bg-white shadow-sm hidden md:flex justify-end items-center h-16 px-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <User className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <p className="text-sm font-medium">Admin</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Log out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="flex-1">
          <div className="p-4 sm:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
      <Toaster />
    </div>
  );
}
