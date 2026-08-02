import React, { useState, useEffect } from 'react';
import { Bot, ArrowUpRight, Menu, X, ShieldCheck } from 'lucide-react';
import { Button } from '../ui/Button';

interface FluidIslandNavbarProps {
  onLaunchAuth: () => void;
  onNavigateSection: (id: string) => void;
}

export const FluidIslandNavbar: React.FC<FluidIslandNavbarProps> = ({ onLaunchAuth, onNavigateSection }) => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'The Problem', id: 'problem' },
    { name: 'The Solution', id: 'solution' },
    { name: 'Hardware Architecture', id: 'know-the-bot' },
  ];

  return (
    <>
      {/* Floating Island Outer Container */}
      <header className="fixed top-0 left-0 right-0 z-50 flex justify-center px-4 pt-4 md:pt-6 pointer-events-none">
        <nav
          className={`pointer-events-auto flex items-center justify-between gap-6 px-4 md:px-6 py-2.5 rounded-full border transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]
            ${scrolled 
              ? 'bg-slate-950/80 backdrop-blur-2xl border-white/10 shadow-[0_16px_40px_rgba(0,0,0,0.6)] w-full max-w-4xl' 
              : 'bg-white/[0.03] backdrop-blur-xl border-white/08 shadow-2xl w-full max-w-5xl'}`}
        >
          {/* Logo & Status Badge */}
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-indigo-600 to-cyan-500 p-[1px] flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <div className="h-full w-full bg-slate-950 rounded-full flex items-center justify-center">
                <Bot className="h-4 w-4 text-indigo-400" />
              </div>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-sm font-extrabold tracking-tight text-white font-mono">WAREOps</span>
              </div>
            </div>
          </div>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <button
                key={link.id}
                onClick={() => onNavigateSection(link.id)}
                className="px-3.5 py-1.5 rounded-full text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/05 transition-all duration-300"
              >
                {link.name}
              </button>
            ))}
          </div>

          {/* Action CTAs */}
          <div className="flex items-center gap-2">
            <button
              onClick={onLaunchAuth}
              className="group relative inline-flex items-center justify-center rounded-full bg-gradient-to-r from-indigo-600 to-cyan-600 p-[1px] text-xs font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all duration-300 hover:shadow-indigo-500/40 active:scale-[0.98]"
            >
              <span className="flex items-center gap-1.5 rounded-full bg-slate-950/90 px-4 py-2 transition-all duration-300 group-hover:bg-transparent">
                <span>Access Command</span>
                <div className="h-5 w-5 rounded-full bg-white/10 flex items-center justify-center transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                  <ArrowUpRight className="h-3 w-3 text-white" />
                </div>
              </span>
            </button>

            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 rounded-full bg-white/05 border border-white/10 text-slate-300 hover:text-white transition-all"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile Drawer Menu Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-slate-950/95 backdrop-blur-3xl flex flex-col justify-center px-8 py-12 animate-fade-in md:hidden">
          <div className="space-y-6 max-w-sm mx-auto w-full">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-indigo-400 border-b border-white/10 pb-4">
              <ShieldCheck className="h-4 w-4" /> System Navigation Menu
            </div>
            <div className="flex flex-col gap-4">
              {navLinks.map((link) => (
                <button
                  key={link.id}
                  onClick={() => {
                    onNavigateSection(link.id);
                    setMobileOpen(false);
                  }}
                  className="text-left text-2xl font-bold text-slate-200 hover:text-indigo-400 transition-colors py-2"
                >
                  {link.name}
                </button>
              ))}
            </div>
            <div className="pt-6 border-t border-white/10">
              <Button
                variant="primary"
                onClick={() => {
                  onLaunchAuth();
                  setMobileOpen(false);
                }}
                className="w-full py-3.5 text-sm bg-indigo-600 hover:bg-indigo-500 rounded-full"
              >
                Launch Command Center
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
