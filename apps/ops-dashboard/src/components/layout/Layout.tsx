import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAppStore } from '../../store/appStore';
import { clsx } from 'clsx';

export function Layout() {
  const { sidebarCollapsed } = useAppStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#040711] text-slate-100 flex flex-col font-sans relative overflow-x-hidden">
      {/* Top Fixed Navigation Header */}
      <Header onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)} />

      {/* Navigation Sidebar (Collapsible Desktop + Slide-over Mobile Drawer) */}
      <Sidebar 
        mobileOpen={mobileMenuOpen} 
        onMobileClose={() => setMobileMenuOpen(false)} 
      />
      
      {/* Main Content Area with Dynamic Padding */}
      <main 
        className={clsx(
          "flex-grow pt-20 pb-8 px-3 sm:px-6 w-full transition-all duration-300 overflow-x-hidden min-w-0",
          sidebarCollapsed ? "md:pl-20" : "md:pl-64"
        )}
      >
        <div className="max-w-[1600px] mx-auto w-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
