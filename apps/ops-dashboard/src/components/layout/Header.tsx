import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, User, LogOut, Settings, Layers, Menu } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useAppStore } from '../../store/appStore';
import { authApi } from '../../api/client';
import { clsx } from 'clsx';

interface HeaderProps {
  onToggleMobileMenu?: () => void;
}

export function Header({ onToggleMobileMenu }: HeaderProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { sidebarCollapsed, notifications } = useAppStore();
  
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleLogout = async () => {
    await authApi.logout().catch(() => {});
    logout();
    navigate('/auth/login');
  };

  return (
    <header 
      className={clsx(
        "fixed top-0 right-0 h-16 z-30 border-b border-white/08 bg-[#070b16]/90 backdrop-blur-xl px-4 sm:px-6 flex items-center justify-between transition-all duration-300 shadow-lg",
        "left-0",
        sidebarCollapsed ? "md:left-16" : "md:left-60"
      )}
    >
      <div className="flex items-center space-x-3">
        {/* Mobile Hamburger Drawer Toggle */}
        <button
          onClick={onToggleMobileMenu}
          className="md:hidden p-2 rounded-xl border border-white/10 bg-white/04 text-slate-300 hover:text-white"
          title="Toggle Navigation Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white font-mono font-black text-sm shadow-lg shadow-indigo-500/20 flex-shrink-0">
          W
        </div>
        <div className="hidden sm:block">
          <span className="text-sm font-bold text-slate-100 tracking-tight font-mono">WAREOps OS</span>
          <span className="text-[10px] text-slate-400 block font-mono">Autonomous Warehouse Intelligence</span>
        </div>
      </div>

      <div className="flex items-center space-x-2 sm:space-x-4">
        {/* Notifications Dropdown Toggle */}
        <div className="relative">
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="btn-icon relative p-2"
          >
            <Bell className="w-4.5 h-4.5 text-slate-300" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-indigo-500 border border-slate-950" />
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-72 sm:w-80 rounded-xl glass-elevated border border-white/10 p-4 space-y-3 z-50">
              <div className="flex justify-between items-center pb-2 border-b border-white/06">
                <span className="text-xs font-semibold text-slate-200">Recent Notifications</span>
                <button 
                  onClick={() => { setShowNotifications(false); navigate('/notifications'); }}
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold"
                >
                  View All
                </button>
              </div>

              <div className="space-y-2.5 max-h-60 overflow-y-auto">
                {notifications.slice(0, 3).map((n) => (
                  <div key={n.id} className="text-left text-xs pb-2 border-b border-white/04 last:border-0">
                    <h5 className="font-semibold text-slate-300">{n.title}</h5>
                    <p className="text-slate-400 mt-0.5 text-[11px] leading-relaxed">{n.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User Menu Dropdown */}
        {user && (
          <div className="relative">
            <button 
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center space-x-2 p-1 px-2 sm:px-2.5 rounded-xl border border-white/06 bg-white/02 hover:bg-white/04 transition-all"
            >
              <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-300 flex items-center justify-center font-bold text-xs flex-shrink-0">
                {user.display_name.split(' ').map(n => n[0]).join('')}
              </div>
              <span className="text-xs font-semibold text-slate-200 hidden sm:inline truncate max-w-[100px]">{user.display_name}</span>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-48 rounded-xl glass-elevated border border-white/10 p-2 space-y-1 z-50">
                <button 
                  onClick={() => { setShowUserMenu(false); navigate('/profile'); }}
                  className="w-full text-left text-xs font-semibold px-3 py-2 rounded-lg text-slate-300 hover:bg-white/05 hover:text-slate-100 flex items-center gap-2"
                >
                  <User className="w-3.5 h-3.5 text-indigo-400" /> My Profile
                </button>
                <button 
                  onClick={handleLogout}
                  className="w-full text-left text-xs font-semibold px-3 py-2 rounded-lg text-red-400 hover:bg-red-500/10 flex items-center gap-2"
                >
                  <LogOut className="w-3.5 h-3.5" /> Sign Out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
