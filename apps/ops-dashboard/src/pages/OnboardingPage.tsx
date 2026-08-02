import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bot,
  AlertTriangle,
  Layers,
  ArrowRight,
  ShieldCheck,
  Activity,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Search,
  Scan,
  Compass,
  Code2,
  Users,
  Linkedin,
  Github,
  Mail,
  Radio,
  FileCheck,
  TrendingDown,
  BarChart3
} from 'lucide-react';
import { FluidIslandNavbar } from '../components/landing/FluidIslandNavbar';
import { EnterpriseFooter } from '../components/landing/EnterpriseFooter';
import { KnowTheBotSection } from '../components/landing/KnowTheBotSection';

// TEAM MEMBERS DATA (5 Core Engineers - Minimal Impeccable Format)
const TEAM_MEMBERS = [
  {
    id: 'anshuman',
    name: 'Anshuman Singh',
    initials: 'AS',
    badge: 'Lead Software Architect'
  },
  {
    id: 'utkarsh',
    name: 'Utkarsh Kumar',
    initials: 'UK',
    badge: 'Frontend & Robotics'
  },
  {
    id: 'abhinav',
    name: 'Abhinav Goel',
    initials: 'AG',
    badge: 'Lead Robotics Architect'
  },
  {
    id: 'alok',
    name: 'Alok Kumar Mishra',
    initials: 'AM',
    badge: 'Deployment & OpenCV'
  },
  {
    id: 'anshu',
    name: 'Anshu Kashyap',
    initials: 'AK',
    badge: 'App Architect'
  }
];

export default function OnboardingPage() {
  const navigate = useNavigate();

  const handleLaunchAuth = () => {
    navigate('/auth/login');
  };

  const scrollToSection = (id: string) => {
    if (id === 'auth' || id === 'login') {
      handleLaunchAuth();
      return;
    }
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#05060a] text-slate-100 font-sans selection:bg-indigo-500 selection:text-white relative overflow-x-hidden">
      {/* Background Lighting Gradients */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-b from-indigo-900/20 via-cyan-900/10 to-transparent blur-[120px] rounded-full" />
        <div className="absolute top-[35%] right-0 w-[500px] h-[500px] bg-blue-900/10 blur-[140px] rounded-full" />
        <div className="absolute top-[70%] left-0 w-[600px] h-[600px] bg-indigo-950/20 blur-[160px] rounded-full" />
      </div>

      {/* Subtle Noise Texture */}
      <div className="fixed inset-0 pointer-events-none z-50 opacity-[0.02] bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:20px_20px]" />

      {/* Floating Island Navbar */}
      <FluidIslandNavbar onLaunchAuth={handleLaunchAuth} onNavigateSection={scrollToSection} />

      {/* HERO SECTION - NARRATIVE ENTRY */}
      <section id="hero" className="relative z-10 pt-28 pb-20 px-4 max-w-6xl mx-auto flex flex-col items-center text-center">
        {/* Narrative H1 */}
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold text-white tracking-tight leading-[1.1] max-w-4xl">
          From Silent Inventory Discrepancy to{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-cyan-300 to-emerald-300">
            Real-Time Autonomous Precision
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mt-6 text-base sm:text-lg md:text-xl text-slate-300 max-w-3xl leading-relaxed font-normal">
          Discover how WAREOps solves the $45 billion physical inventory crisis by replacing slow, error-prone manual audits with continuous mobile robotics and live digital twin reconciliation.
        </p>

        {/* Action Buttons */}
        <div className="mt-10 flex flex-col sm:flex-row items-center gap-4 w-full justify-center">
          <button
            onClick={() => scrollToSection('problem')}
            className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-semibold text-sm tracking-wide shadow-lg shadow-indigo-500/25 transition-all flex items-center justify-center gap-2 group"
          >
            <span>Explore The Problem & Solution</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </button>
          
          <button
            onClick={handleLaunchAuth}
            className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-slate-200 font-semibold text-sm tracking-wide transition-all flex items-center justify-center gap-2"
          >
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>Launch Command Center</span>
          </button>
        </div>

      </section>

      {/* SECTION 1: THE CORE PROBLEM */}
      <section id="problem" className="relative z-10 py-24 px-4 max-w-6xl mx-auto border-t border-white/[0.06]">
        <div className="space-y-16">
          
          {/* Header */}
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono font-semibold uppercase tracking-wider">
              <AlertTriangle className="h-3.5 w-3.5" /> Phase I: The Core Problem
            </div>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
              The Silent Chaos of Physical Warehouse Discrepancy
            </h2>
            <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
              Modern distribution centers handle millions of SKU movements daily. Yet, despite advanced Warehouse Management Systems (WMS), physical inventory continuously drifts out of sync with software records.
            </p>
          </div>

          {/* Problem Deep-Dive Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-red-500/30 transition-all space-y-4">
              <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                <XCircle className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Ghost Inventory & Misplaced SKUs</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                When a worker places an item in Bin A1-R2 instead of A1-R1, the item is effectively "lost". WMS shows stock is present, but pickers find empty shelves, triggering order cancellations and fulfillment delays.
              </p>
              <div className="pt-2 border-t border-white/06 flex items-center justify-between text-xs font-mono text-slate-400">
                <span>Annual Cost per Warehouse</span>
                <span className="text-red-400 font-bold">$1.2M+</span>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-red-500/30 transition-all space-y-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <TrendingDown className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Infrequent & Disruptive Audits</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Traditional stock counting requires walking miles of aisles with manual barcode scanners. Because it is slow and costly, full audits happen only once or twice a year—allowing errors to linger for months.
              </p>
              <div className="pt-2 border-t border-white/06 flex items-center justify-between text-xs font-mono text-slate-400">
                <span>Audit Latency Gap</span>
                <span className="text-amber-400 font-bold">6 Months</span>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-red-500/30 transition-all space-y-4">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <BarChart3 className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Compounding Operational Losses</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Unresolved physical discrepancies cascade into emergency re-orders, inaccurate financial balance sheets, worker frustration, and degraded customer trust due to stockout promises.
              </p>
              <div className="pt-2 border-t border-white/06 flex items-center justify-between text-xs font-mono text-slate-400">
                <span>WMS Inaccuracy Rate</span>
                <span className="text-cyan-400 font-bold">3.8% – 6.5%</span>
              </div>
            </div>

          </div>

          {/* Interactive Comparison Banner */}
          <div className="p-8 rounded-3xl bg-gradient-to-r from-red-950/30 via-slate-900/60 to-indigo-950/30 border border-white/10 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
              <div>
                <h4 className="text-xl font-bold text-white">Manual Auditing vs. Autonomous Intelligence</h4>
                <p className="text-xs text-slate-300">Why legacy manual cycle counts fail at enterprise scale</p>
              </div>
              <span className="text-xs font-mono px-3 py-1 rounded-full bg-white/10 text-slate-200">
                Operational Benchmark
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              <div className="space-y-3 p-4 rounded-xl bg-red-950/20 border border-red-500/20">
                <div className="flex items-center gap-2 text-red-400 font-bold">
                  <XCircle className="h-4 w-4" /> Traditional Manual Audit
                </div>
                <ul className="space-y-2 text-slate-300 text-xs">
                  <li>• Requires 15-30 staff members walking aisles with handheld guns</li>
                  <li>• Operations must halt during active audit windows</li>
                  <li>• High human scanning error rate & missing top-shelf visibility</li>
                  <li>• Static snapshot—out of date the moment auditing ends</li>
                </ul>
              </div>

              <div className="space-y-3 p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/20">
                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                  <CheckCircle2 className="h-4 w-4" /> WAREOps Continuous AMR Platform
                </div>
                <ul className="space-y-2 text-slate-300 text-xs">
                  <li>• Autonomous mobile robots audit 24/7 without human intervention</li>
                  <li>• Zero operational downtime or warehouse aisle closures</li>
                  <li>• LiDAR + Vision AI scanning with 99.98% accurate barcode reading</li>
                  <li>• Continuous real-time WebSocket digital twin state synchronization</li>
                </ul>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* SECTION 2: THE WAREOPS SOLUTION */}
      <section id="solution" className="relative z-10 py-24 px-4 max-w-6xl mx-auto border-t border-white/[0.06]">
        <div className="space-y-16">
          
          {/* Header */}
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-mono font-semibold uppercase tracking-wider">
              <Bot className="h-3.5 w-3.5" /> Phase II: The Autonomous Solution
            </div>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
              Introducing WAREOps: Continuous Physical & Digital Sync
            </h2>
            <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
              WAREOps deploys a fleet of autonomous mobile robots (AMRs) that continuously inspect shelf locations, read barcodes via optical edge vision, and automatically reconcile physical bin states against WMS expectations.
            </p>
          </div>

          {/* Solution 3-Step Process Graphic */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            <div className="relative p-8 rounded-3xl bg-slate-900/60 border border-indigo-500/30 space-y-4 hover:border-indigo-400 transition-all group">
              <div className="absolute top-4 right-4 text-3xl font-extrabold font-mono text-indigo-500/20 group-hover:text-indigo-400/30">
                01
              </div>
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Compass className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-white">Autonomous Fleet Patrol</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                AMRs navigate warehouse aisles using LiDAR SLAM, scanning bin barcodes and computing precise spatial coordinates without human supervision.
              </p>
              <div className="pt-2 text-xs font-mono text-indigo-300 flex items-center gap-1">
                <span>LiDAR Navigation</span> • <span>Path Optimization</span>
              </div>
            </div>

            <div className="relative p-8 rounded-3xl bg-slate-900/60 border border-cyan-500/30 space-y-4 hover:border-cyan-400 transition-all group">
              <div className="absolute top-4 right-4 text-3xl font-extrabold font-mono text-cyan-500/20 group-hover:text-cyan-400/30">
                02
              </div>
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Radio className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-white">Kafka Observation Conduit</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Robot observations stream back to the transactional outbox pipeline via Kafka, guaranteeing zero message loss even during transient network drops.
              </p>
              <div className="pt-2 text-xs font-mono text-cyan-300 flex items-center gap-1">
                <span>Transactional Outbox</span> • <span>Event Bus</span>
              </div>
            </div>

            <div className="relative p-8 rounded-3xl bg-slate-900/60 border border-emerald-500/30 space-y-4 hover:border-emerald-400 transition-all group">
              <div className="absolute top-4 right-4 text-3xl font-extrabold font-mono text-emerald-500/20 group-hover:text-emerald-400/30">
                03
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <RefreshCw className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-white">Instant State Reconciliation</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                The Reconciliation Engine compares observed SKUs against expected WMS records, highlighting mismatches instantly on the interactive 3D digital twin.
              </p>
              <div className="pt-2 text-xs font-mono text-emerald-300 flex items-center gap-1">
                <span>Auto-Reconciliation</span> • <span>99.98% Accuracy</span>
              </div>
            </div>

          </div>

          {/* Interactive Feature Demo Highlight */}
          <div className="p-8 rounded-3xl bg-slate-950/80 border border-white/10 space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-sm font-mono font-bold text-white">Live Discrepancy Resolution Protocol</span>
              </div>
              <span className="text-xs font-mono text-slate-400">Reconciliation Engine v2.4</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-4 rounded-xl bg-slate-900 border border-white/06 space-y-2">
                <span className="text-xs font-mono text-slate-400">Observed State (AMR Scanner)</span>
                <div className="text-sm font-bold text-white font-mono">Bin A1-R2-S1-B2</div>
                <div className="text-xs text-amber-400 font-mono">Found: SKU-ELEC-889</div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900 border border-white/06 space-y-2">
                <span className="text-xs font-mono text-slate-400">Expected State (WMS DB)</span>
                <div className="text-sm font-bold text-white font-mono">Bin A1-R2-S1-B2</div>
                <div className="text-xs text-red-400 font-mono">Expected: SKU-TOOL-102</div>
              </div>

              <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-500/30 space-y-2">
                <span className="text-xs font-mono text-indigo-300">WAREOps System Decision</span>
                <div className="text-sm font-bold text-emerald-400 font-mono">MISMATCH ALERT TRIGGERED</div>
                <div className="text-xs text-slate-300">Operator tasked for 30-sec physical verification</div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* SECTION 3: KNOW THE BOT HARDWARE & SOFTWARE ARCHITECTURE */}

      <KnowTheBotSection />

      {/* SECTION 4: TEAM INTRODUCTION */}
      <section id="team" className="relative z-10 py-24 px-4 max-w-6xl mx-auto border-t border-white/[0.06]">
        <div className="space-y-16">
          
          {/* Header */}
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-mono font-semibold uppercase tracking-wider">
              <Users className="h-3.5 w-3.5 text-cyan-400" /> Engineering Team
            </div>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
              Meet the Architects Behind WAREOps
            </h2>
            <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
              A dedicated team of five engineers combining expertise in distributed microservices, autonomous robotics, spatial computing, computer vision, and enterprise security.
            </p>
          </div>

          {/* Team Members Layout: Row 1 (3 Members), Row 2 Centered (2 Members) with 3D Perspective Depth */}
          <div className="space-y-6">
            {/* Row 1: 3 Core Architects */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {TEAM_MEMBERS.slice(0, 3).map((member) => (
                <div key={member.id} className="perspective-[1000px] group">
                  <div className="relative p-7 rounded-2xl bg-gradient-to-b from-[#0b1328]/90 via-[#080d1a]/95 to-[#060913] border border-white/10 group-hover:border-indigo-500/60 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] [transform-style:preserve-3d] group-hover:[-translate-y-2] group-hover:[rotateX(4deg)] group-hover:[rotateY(-2deg)] group-hover:scale-[1.02] shadow-[0_15px_35px_rgba(0,0,0,0.6)] group-hover:shadow-[0_25px_60px_rgba(99,102,241,0.25)] backdrop-blur-2xl overflow-hidden flex flex-col justify-between min-h-[160px]">
                    
                    {/* Ambient 3D Neon Backlight Aura */}
                    <div className="absolute -top-12 -right-12 w-36 h-36 rounded-full bg-indigo-500/20 blur-2xl group-hover:bg-indigo-500/40 group-hover:scale-150 transition-all duration-700 pointer-events-none" />
                    <div className="absolute -bottom-10 -left-10 w-28 h-28 rounded-full bg-cyan-500/10 blur-2xl group-hover:bg-cyan-500/30 transition-all duration-700 pointer-events-none" />

                    {/* 3D Floating Header Row (Z-Layer 2) */}
                    <div className="flex items-center justify-between w-full [transform:translateZ(20px)] transition-transform duration-300">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600/30 to-purple-600/30 border-2 border-indigo-500/40 flex items-center justify-center text-indigo-200 font-mono font-black text-lg shadow-lg shadow-indigo-500/25 group-hover:border-indigo-400 group-hover:shadow-indigo-500/40 transition-all">
                        {member.initials}
                      </div>
                      <span className="px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full text-[9px] sm:text-[10px] font-mono font-extrabold tracking-wider uppercase bg-indigo-500/15 border border-indigo-500/40 text-indigo-300 shadow-md backdrop-blur-md group-hover:border-indigo-400 transition-colors truncate max-w-[150px] sm:max-w-none">
                        {member.badge}
                      </span>
                    </div>

                    {/* 3D Floating Name Title (Z-Layer 3) */}
                    <div className="[transform:translateZ(30px)] transition-transform duration-300 pt-3">
                      <h3 className="text-xl font-extrabold text-white group-hover:text-indigo-200 transition-colors font-sans tracking-tight drop-shadow-md">
                        {member.name}
                      </h3>
                      <div className="w-8 h-0.5 rounded-full bg-indigo-500/40 group-hover:w-16 group-hover:bg-cyan-400 transition-all duration-500 mt-2" />
                    </div>

                  </div>
                </div>
              ))}
            </div>

            {/* Row 2: 2 Core Engineers (Centered) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
              {TEAM_MEMBERS.slice(3, 5).map((member) => (
                <div key={member.id} className="perspective-[1000px] group">
                  <div className="relative p-7 rounded-2xl bg-gradient-to-b from-[#0b1328]/90 via-[#080d1a]/95 to-[#060913] border border-white/10 group-hover:border-indigo-500/60 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] [transform-style:preserve-3d] group-hover:[-translate-y-2] group-hover:[rotateX(4deg)] group-hover:[rotateY(-2deg)] group-hover:scale-[1.02] shadow-[0_15px_35px_rgba(0,0,0,0.6)] group-hover:shadow-[0_25px_60px_rgba(99,102,241,0.25)] backdrop-blur-2xl overflow-hidden flex flex-col justify-between min-h-[160px]">
                    
                    {/* Ambient 3D Neon Backlight Aura */}
                    <div className="absolute -top-12 -right-12 w-36 h-36 rounded-full bg-indigo-500/20 blur-2xl group-hover:bg-indigo-500/40 group-hover:scale-150 transition-all duration-700 pointer-events-none" />
                    <div className="absolute -bottom-10 -left-10 w-28 h-28 rounded-full bg-cyan-500/10 blur-2xl group-hover:bg-cyan-500/30 transition-all duration-700 pointer-events-none" />

                    {/* 3D Floating Header Row (Z-Layer 2) */}
                    <div className="flex items-center justify-between w-full [transform:translateZ(20px)] transition-transform duration-300">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600/30 to-purple-600/30 border-2 border-indigo-500/40 flex items-center justify-center text-indigo-200 font-mono font-black text-lg shadow-lg shadow-indigo-500/25 group-hover:border-indigo-400 group-hover:shadow-indigo-500/40 transition-all">
                        {member.initials}
                      </div>
                      <span className="px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full text-[9px] sm:text-[10px] font-mono font-extrabold tracking-wider uppercase bg-indigo-500/15 border border-indigo-500/40 text-indigo-300 shadow-md backdrop-blur-md group-hover:border-indigo-400 transition-colors truncate max-w-[150px] sm:max-w-none">
                        {member.badge}
                      </span>
                    </div>

                    {/* 3D Floating Name Title (Z-Layer 3) */}
                    <div className="[transform:translateZ(30px)] transition-transform duration-300 pt-3">
                      <h3 className="text-xl font-extrabold text-white group-hover:text-indigo-200 transition-colors font-sans tracking-tight drop-shadow-md">
                        {member.name}
                      </h3>
                      <div className="w-8 h-0.5 rounded-full bg-indigo-500/40 group-hover:w-16 group-hover:bg-cyan-400 transition-all duration-500 mt-2" />
                    </div>

                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </section>

      {/* CALL TO ACTION SECTION */}
      <section className="relative z-10 py-20 px-4 max-w-4xl mx-auto text-center space-y-8">
        <div className="p-10 rounded-3xl bg-gradient-to-b from-indigo-950/60 to-slate-950 border border-indigo-500/30 space-y-6 backdrop-blur-2xl">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
            Ready to Experience Continuous Autonomous Auditing?
          </h2>
          <p className="text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
            Access the command dashboard to monitor real-time spatial digital twins, trigger AMR mission sequences, or resolve inventory mismatches.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={handleLaunchAuth}
              className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all shadow-xl shadow-indigo-500/25 flex items-center justify-center gap-2"
            >
              <span>Access Operator & Admin Portal</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ENTERPRISE FOOTER */}
      <EnterpriseFooter />
    </div>
  );
}
