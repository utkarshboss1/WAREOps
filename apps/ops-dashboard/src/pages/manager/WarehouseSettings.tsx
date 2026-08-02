import React, { useState } from 'react';
import {
  Bot, Plus, Trash2, Edit2,
  CheckCircle2, Zap, ToggleLeft, ToggleRight, Layers, Shield
} from 'lucide-react';
import { robotsApi } from '../../api/client';

export interface ZoneConfig {
  id: string;
  code: string;
  name: string;
  area: number;
  aisles: number;
}

export interface RegisteredRobot {
  id: string;
  serial: string;
  model: string;
  firmware: string;
  status: 'ACTIVE' | 'CHARGING' | 'OFFLINE';
  registered: string;
}

export interface AlertRule {
  id: string;
  condition: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  channels: string;
  enabled: boolean;
}

export interface WmsIntegration {
  id: string;
  name: string;
  logo: string;
  connected: boolean;
  lastSync: string | null;
}

const INITIAL_ZONES: ZoneConfig[] = [
  { id: 'zA', code: 'ZONE-A', name: 'Electronics Bay', area: 1200, aisles: 5 },
  { id: 'zB', code: 'ZONE-B', name: 'Furniture Wing', area: 2400, aisles: 8 },
  { id: 'zC', code: 'ZONE-C', name: 'Books & Media', area: 600, aisles: 3 },
  { id: 'zD', code: 'ZONE-D', name: 'Apparel Section', area: 900, aisles: 4 },
  { id: 'zE', code: 'ZONE-E', name: 'Cold Storage', area: 400, aisles: 2 },
];

const INITIAL_ROBOTS: RegisteredRobot[] = [
  { id: 'rb1', serial: 'WH-BOT-001', model: 'Atlas v2', firmware: '2.4.1', status: 'ACTIVE', registered: '2026-01-15' },
  { id: 'rb2', serial: 'WH-BOT-002', model: 'Atlas v2', firmware: '2.4.1', status: 'ACTIVE', registered: '2026-01-15' },
  { id: 'rb3', serial: 'WH-BOT-003', model: 'Nexus v1', firmware: '1.8.3', status: 'ACTIVE', registered: '2026-02-20' },
  { id: 'rb4', serial: 'WH-BOT-004', model: 'Nexus v1', firmware: '1.8.3', status: 'CHARGING', registered: '2026-02-20' },
  { id: 'rb5', serial: 'WH-BOT-005', model: 'Vega Pro', firmware: '3.1.0', status: 'ACTIVE', registered: '2026-03-10' },
  { id: 'rb6', serial: 'WH-BOT-006', model: 'Vega Pro', firmware: '3.1.0', status: 'OFFLINE', registered: '2026-03-10' },
];

const INITIAL_ALERT_RULES: AlertRule[] = [
  { id: 'ar1', condition: 'Mismatch count in zone > 10', severity: 'CRITICAL', channels: 'Email, Slack, SMS', enabled: true },
  { id: 'ar2', condition: 'Robot battery < 15%', severity: 'HIGH', channels: 'Email, Slack', enabled: true },
  { id: 'ar3', condition: 'Mission duration > 120 min', severity: 'MEDIUM', channels: 'Slack', enabled: true },
  { id: 'ar4', condition: 'Scan coverage < 80% after 4h', severity: 'HIGH', channels: 'Email, SMS', enabled: false },
  { id: 'ar5', condition: 'Alert SLA breach > 30 min', severity: 'CRITICAL', channels: 'Email, Slack, SMS', enabled: true },
];

const INITIAL_WMS_INTEGRATIONS: WmsIntegration[] = [
  { id: 'sap', name: 'SAP WM', logo: '🟡', connected: true, lastSync: '2026-07-17 15:42' },
  { id: 'oracle', name: 'Oracle WMS', logo: '🔴', connected: false, lastSync: null },
  { id: 'netsuite', name: 'NetSuite', logo: '🔵', connected: false, lastSync: null },
];

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, string> = {
    ACTIVE: 'bg-emerald-500/10 text-emerald-400',
    CHARGING: 'bg-indigo-500/10 text-indigo-400',
    OFFLINE: 'bg-slate-800 text-slate-500',
  };
  return <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${map[status] || 'bg-slate-800 text-slate-400'}`}>{status}</span>;
};

const SeverityBadge: React.FC<{ severity: string }> = ({ severity }) => {
  const map: Record<string, string> = {
    CRITICAL: 'bg-red-500/10 text-red-400',
    HIGH: 'bg-orange-500/10 text-orange-400',
    MEDIUM: 'bg-amber-500/10 text-amber-400',
    LOW: 'bg-slate-800 text-slate-400',
  };
  return <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${map[severity] || 'bg-slate-800 text-slate-400'}`}>{severity}</span>;
};

// ─── Register Robot Modal ──────────────────────────────────────────────────────
const RegisterRobotModal: React.FC<{ onClose: () => void; onRegister: (robot: RegisteredRobot) => void }> = ({ onClose, onRegister }) => {
  const [serial, setSerial] = useState('');
  const [model, setModel] = useState('Atlas v2');
  const [firmware, setFirmware] = useState('2.4.1');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onRegister({
      id: `rb-${Date.now()}`,
      serial: serial || `WH-BOT-${Math.floor(100 + Math.random() * 900)}`,
      model,
      firmware,
      status: 'ACTIVE',
      registered: new Date().toISOString().split('T')[0],
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#0d1424] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.06] p-6">
          <h2 className="text-base font-semibold text-slate-100">Register New Robot</h2>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Serial Number</label>
            <input
              type="text"
              required
              placeholder="WH-BOT-007"
              value={serial}
              onChange={e => setSerial(e.target.value)}
              className="w-full rounded-xl bg-white/[0.04] border border-white/[0.08] px-3 py-2.5 text-sm text-slate-300 placeholder-slate-600 outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Model</label>
            <input
              type="text"
              required
              placeholder="Titan Alpha / Atlas v2"
              value={model}
              onChange={e => setModel(e.target.value)}
              className="w-full rounded-xl bg-white/[0.04] border border-white/[0.08] px-3 py-2.5 text-sm text-slate-300 placeholder-slate-600 outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Firmware Version</label>
            <input
              type="text"
              required
              placeholder="2.4.1"
              value={firmware}
              onChange={e => setFirmware(e.target.value)}
              className="w-full rounded-xl bg-white/[0.04] border border-white/[0.08] px-3 py-2.5 text-sm text-slate-300 placeholder-slate-600 outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-white/[0.06] p-6">
          <button type="button" onClick={onClose} className="rounded-xl border border-white/[0.08] px-5 py-2.5 text-sm font-semibold text-slate-400 hover:text-slate-200 transition-colors">Cancel</button>
          <button type="submit" className="rounded-xl bg-indigo-600 hover:bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors">Register Robot</button>
        </div>
      </form>
    </div>
  );
};

// ─── Add Zone Modal ────────────────────────────────────────────────────────────
const AddZoneModal: React.FC<{ onClose: () => void; onAdd: (zone: ZoneConfig) => void }> = ({ onClose, onAdd }) => {
  const [code, setCode] = useState('ZONE-F');
  const [name, setName] = useState('');
  const [area, setArea] = useState('1000');
  const [aisles, setAisles] = useState('4');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({
      id: `z-${Date.now()}`,
      code,
      name: name || 'New Storage Zone',
      area: parseInt(area) || 1000,
      aisles: parseInt(aisles) || 4,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#0d1424] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.06] p-6">
          <h2 className="text-base font-semibold text-slate-100">Add New Zone</h2>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Zone Code</label>
            <input
              type="text"
              required
              placeholder="ZONE-F"
              value={code}
              onChange={e => setCode(e.target.value)}
              className="w-full rounded-xl bg-white/[0.04] border border-white/[0.08] px-3 py-2.5 text-sm text-slate-300 placeholder-slate-600 outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Zone Name</label>
            <input
              type="text"
              required
              placeholder="High Density Storage"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full rounded-xl bg-white/[0.04] border border-white/[0.08] px-3 py-2.5 text-sm text-slate-300 placeholder-slate-600 outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Area (m²)</label>
              <input
                type="number"
                required
                value={area}
                onChange={e => setArea(e.target.value)}
                className="w-full rounded-xl bg-white/[0.04] border border-white/[0.08] px-3 py-2.5 text-sm text-slate-300 outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Aisles Count</label>
              <input
                type="number"
                required
                value={aisles}
                onChange={e => setAisles(e.target.value)}
                className="w-full rounded-xl bg-white/[0.04] border border-white/[0.08] px-3 py-2.5 text-sm text-slate-300 outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-white/[0.06] p-6">
          <button type="button" onClick={onClose} className="rounded-xl border border-white/[0.08] px-5 py-2.5 text-sm font-semibold text-slate-400 hover:text-slate-200 transition-colors">Cancel</button>
          <button type="submit" className="rounded-xl bg-indigo-600 hover:bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors">Add Zone</button>
        </div>
      </form>
    </div>
  );
};

// ─── Add Alert Rule Modal ──────────────────────────────────────────────────────
const AddRuleModal: React.FC<{ onClose: () => void; onAdd: (rule: AlertRule) => void }> = ({ onClose, onAdd }) => {
  const [condition, setCondition] = useState('');
  const [severity, setSeverity] = useState<'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'>('HIGH');
  const [channels, setChannels] = useState('Email, Slack');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({
      id: `ar-${Date.now()}`,
      condition: condition || 'Temperature threshold > 35°C',
      severity,
      channels,
      enabled: true,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#0d1424] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.06] p-6">
          <h2 className="text-base font-semibold text-slate-100">Add Alert Rule</h2>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Condition</label>
            <input
              type="text"
              required
              placeholder="Mismatch count in zone > 5"
              value={condition}
              onChange={e => setCondition(e.target.value)}
              className="w-full rounded-xl bg-white/[0.04] border border-white/[0.08] px-3 py-2.5 text-sm text-slate-300 placeholder-slate-600 outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Severity Level</label>
            <select
              value={severity}
              onChange={e => setSeverity(e.target.value as any)}
              className="w-full rounded-xl bg-[#080d1a] border border-white/[0.08] px-3 py-2.5 text-sm text-slate-300 outline-none focus:border-indigo-500 transition-colors"
            >
              <option value="CRITICAL">CRITICAL</option>
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LOW">LOW</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Notification Channels</label>
            <input
              type="text"
              value={channels}
              onChange={e => setChannels(e.target.value)}
              placeholder="Email, Slack, SMS"
              className="w-full rounded-xl bg-white/[0.04] border border-white/[0.08] px-3 py-2.5 text-sm text-slate-300 placeholder-slate-600 outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-white/[0.06] p-6">
          <button type="button" onClick={onClose} className="rounded-xl border border-white/[0.08] px-5 py-2.5 text-sm font-semibold text-slate-400 hover:text-slate-200 transition-colors">Cancel</button>
          <button type="submit" className="rounded-xl bg-indigo-600 hover:bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors">Save Rule</button>
        </div>
      </form>
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────
const TABS = ['Topology', 'Robot Fleet', 'Alert Rules', 'WMS Integration'];

export default function WarehouseSettings() {
  const [activeTab, setActiveTab] = useState(0);
  const [showRobotModal, setShowRobotModal] = useState(false);
  const [showZoneModal, setShowZoneModal] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);

  const [zones, setZones] = useState<ZoneConfig[]>(INITIAL_ZONES);
  const [robots, setRobots] = useState<RegisteredRobot[]>(INITIAL_ROBOTS);
  const [wmsStates, setWmsStates] = useState<WmsIntegration[]>(INITIAL_WMS_INTEGRATIONS);
  const [alertRuleStates, setAlertRuleStates] = useState<AlertRule[]>(INITIAL_ALERT_RULES);
  const [seedConfirm, setSeedConfirm] = useState(false);
  const [seedSuccess, setSeedSuccess] = useState(false);
  const [testConnecting, setTestConnecting] = useState<string | null>(null);

  const toggleWms = (id: string) => {
    setWmsStates(prev => prev.map(w => w.id === id ? { ...w, connected: !w.connected, lastSync: !w.connected ? 'Just now' : null } : w));
  };

  const toggleRule = (id: string) => {
    setAlertRuleStates(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  };

  const handleTestConnect = (id: string) => {
    setTestConnecting(id);
    setTimeout(() => setTestConnecting(null), 2000);
  };

  const handleDecommissionRobot = (id: string) => {
    setRobots(prev => prev.filter(r => r.id !== id));
  };

  const handleConfirmSeed = () => {
    setSeedConfirm(false);
    setSeedSuccess(true);
    setTimeout(() => setSeedSuccess(false), 3000);
  };

  return (
    <div className="space-y-6">
      {showRobotModal && <RegisterRobotModal onClose={() => setShowRobotModal(false)} onRegister={r => setRobots(prev => [r, ...prev])} />}
      {showZoneModal && <AddZoneModal onClose={() => setShowZoneModal(false)} onAdd={z => setZones(prev => [...prev, z])} />}
      {showRuleModal && <AddRuleModal onClose={() => setShowRuleModal(false)} onAdd={r => setAlertRuleStates(prev => [r, ...prev])} />}

      {/* Header */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-400 mb-1">Configuration</p>
        <h1 className="text-2xl font-bold text-slate-100">Warehouse Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Manage topology, fleet, rules and integrations</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 rounded-xl bg-white/[0.03] border border-white/[0.06] p-1 w-fit">
        {TABS.map((tab, idx) => (
          <button
            key={tab}
            onClick={() => setActiveTab(idx)}
            className={`px-5 py-2.5 rounded-lg text-xs font-semibold transition-all duration-300
              ${activeTab === idx ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-500 hover:text-slate-300'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab 1: Topology */}
      {activeTab === 0 && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6">
            <h2 className="text-sm font-semibold text-slate-300 mb-5">Warehouse Info</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Name', value: 'WH-ALPHA-001' },
                { label: 'Code', value: 'ALPHA' },
                { label: 'Region', value: 'Asia Pacific' },
                { label: 'Area', value: '6,500 m²' },
              ].map(f => (
                <div key={f.label} className="rounded-xl bg-white/[0.03] border border-white/[0.05] p-4">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1">{f.label}</p>
                  <p className="text-sm font-semibold text-slate-200">{f.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
              <h2 className="text-sm font-semibold text-slate-200">Zone Configuration</h2>
              <button
                onClick={() => setShowZoneModal(true)}
                className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Add Zone
              </button>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  {['Zone Code', 'Name', 'Area (m²)', 'Aisles', ''].map(h => (
                    <th key={h} className="px-6 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {zones.map(z => (
                  <tr key={z.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-3.5 text-xs font-mono text-indigo-400">{z.code}</td>
                    <td className="px-6 py-3.5 text-sm font-medium text-slate-200">{z.name}</td>
                    <td className="px-6 py-3.5 text-sm font-mono text-slate-400">{z.area.toLocaleString()}</td>
                    <td className="px-6 py-3.5 text-sm font-mono text-slate-400">{z.aisles}</td>
                    <td className="px-6 py-3.5">
                      <button className="rounded-lg bg-white/[0.04] p-1.5 text-slate-500 hover:text-slate-300 transition-colors">
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Seed Demo Data */}
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-semibold text-amber-300">Seed Demo Data</h3>
                <p className="text-xs text-slate-500 mt-1">Populate this warehouse with realistic demo inventory, bins, and mission history</p>
                {seedSuccess && (
                  <p className="text-xs text-emerald-400 font-semibold mt-2 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Demo data seeded successfully into database!
                  </p>
                )}
              </div>
              {seedConfirm ? (
                <div className="flex gap-2">
                  <button onClick={() => setSeedConfirm(false)} className="rounded-xl border border-white/[0.08] px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors">Cancel</button>
                  <button onClick={handleConfirmSeed} className="rounded-xl bg-amber-600 hover:bg-amber-500 px-4 py-2 text-xs font-semibold text-white transition-colors">Confirm Seed</button>
                </div>
              ) : (
                <button onClick={() => setSeedConfirm(true)} className="rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 px-4 py-2 text-xs font-semibold text-amber-400 transition-all">
                  Seed Demo Data
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Robot Fleet */}
      {activeTab === 1 && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-indigo-400" />
              <h2 className="text-sm font-semibold text-slate-200">Registered Robots</h2>
              <span className="text-xs text-slate-500">({robots.length})</span>
            </div>
            <button
              onClick={() => setShowRobotModal(true)}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-semibold text-white transition-all"
            >
              <Plus className="h-3.5 w-3.5" /> Register New Robot
            </button>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.04]">
                {['Serial Number', 'Model', 'Firmware', 'Status', 'Registered', 'Action'].map(h => (
                  <th key={h} className="px-6 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {robots.map(r => (
                <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4 text-xs font-mono text-indigo-400">{r.serial}</td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-200">{r.model}</td>
                  <td className="px-6 py-4 text-xs font-mono text-slate-400">v{r.firmware}</td>
                  <td className="px-6 py-4"><StatusBadge status={r.status} /></td>
                  <td className="px-6 py-4 text-xs text-slate-500">{r.registered}</td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleDecommissionRobot(r.id)}
                      className="flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 transition-all cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" /> Decommission
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: Alert Rules */}
      {activeTab === 2 && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowRuleModal(true)}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-semibold text-white transition-all"
            >
              <Plus className="h-3.5 w-3.5" /> Add Rule
            </button>
          </div>
          {alertRuleStates.map(rule => (
            <div key={rule.id} className={`rounded-2xl border p-5 transition-all ${rule.enabled ? 'border-white/[0.06] bg-white/[0.03]' : 'border-white/[0.03] bg-white/[0.01] opacity-60'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <SeverityBadge severity={rule.severity} />
                    <span className="text-sm font-medium text-slate-200">{rule.condition}</span>
                  </div>
                  <p className="text-xs text-slate-500">Channels: <span className="text-slate-400">{rule.channels}</span></p>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => toggleRule(rule.id)} className="flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer">
                    {rule.enabled
                      ? <ToggleRight className="h-6 w-6 text-emerald-500" />
                      : <ToggleLeft className="h-6 w-6 text-slate-600" />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 4: WMS Integration */}
      {activeTab === 3 && (
        <div className="space-y-4">
          {wmsStates.map(wms => (
            <div key={wms.id} className={`rounded-2xl border p-6 transition-all ${wms.connected ? 'border-emerald-500/20 bg-emerald-500/[0.04]' : 'border-white/[0.06] bg-white/[0.03]'}`}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{wms.logo}</span>
                  <div>
                    <p className="text-sm font-semibold text-slate-200">{wms.name}</p>
                    {wms.connected ? (
                      <p className="text-xs text-emerald-400">Connected · Last sync: {wms.lastSync}</p>
                    ) : (
                      <p className="text-xs text-slate-500">Not connected</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => toggleWms(wms.id)}
                  className={`relative h-6 w-11 rounded-full transition-all duration-300 cursor-pointer ${wms.connected ? 'bg-emerald-600' : 'bg-white/10'}`}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all duration-300 ${wms.connected ? 'left-[22px]' : 'left-0.5'}`} />
                </button>
              </div>

              {wms.connected && (
                <div className="space-y-3 border-t border-white/[0.06] pt-4">
                  {[
                    { label: 'API Endpoint', placeholder: 'https://api.sap.company.com/wm/v1' },
                    { label: 'API Key', placeholder: '••••••••••••••••••••••••••••••••' },
                  ].map(f => (
                    <div key={f.label}>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5">{f.label}</label>
                      <input
                        type={f.label === 'API Key' ? 'password' : 'text'}
                        placeholder={f.placeholder}
                        className="w-full rounded-xl bg-white/[0.04] border border-white/[0.08] px-3 py-2.5 text-sm text-slate-300 placeholder-slate-600 outline-none focus:border-indigo-500 transition-colors max-w-lg"
                      />
                    </div>
                  ))}
                  <button
                    onClick={() => handleTestConnect(wms.id)}
                    className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all cursor-pointer
                      ${testConnecting === wms.id ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/[0.05] border border-white/[0.08] text-slate-400 hover:text-slate-200'}`}
                  >
                    {testConnecting === wms.id ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Zap className="h-3.5 w-3.5" />}
                    {testConnecting === wms.id ? 'Connected & Verified!' : 'Test Connection'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
