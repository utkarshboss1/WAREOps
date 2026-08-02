import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, AlertTriangle, Bot, Clock, Activity, Shield,
  Terminal as TerminalIcon, Wifi, WifiOff, Play, Map, RefreshCw,
  ChevronRight, Cpu, Server, Layers
} from 'lucide-react';
import { adminApi, robotsApi, alertsApi, missionsApi, warehousesApi } from '../../api/client';
import useWebSocket from '../../hooks/useWebSocket';

// Default warehouse — matches the seeded UUID in init.sql
const DEFAULT_WAREHOUSE_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
// Default Pi SSH target
const DEFAULT_PI_HOST = '10.225.34.209';
const DEFAULT_PI_USER = 'abhinav';

export interface NetworkWarehouse {
  id: string;
  name: string;
  location: string;
  healthScore: number;
  missions: number;
  alerts: number;
  robotsOnline: number;
  robotsTotal: number;
  status: 'ACTIVE' | 'SETUP_MODE' | 'INACTIVE';
  grade: string;
}

const HealthRing: React.FC<{ score: number; size?: number }> = ({ score, size = 40 }) => {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 90 ? '#10b981' : score >= 75 ? '#6366f1' : score >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="4"
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
      <text x={size / 2} y={size / 2 + 4} textAnchor="middle" fill="white" fontSize="10" fontWeight="700">
        {score > 0 ? score : '–'}
      </text>
    </svg>
  );
};

// ── Pi Quick-Command definitions ───────────────────────────────────────────────
interface PiCommand {
  id: string;
  label: string;
  icon: React.ElementType;
  command: string | null;  // null = uses dynamic input
  color: string;
  description: string;
  requiresTarget?: 'rack' | 'bin';
}

const PI_COMMANDS: PiCommand[] = [
  {
    id: 'slam',
    label: 'Launch SLAM Mapping',
    icon: Map,
    command: 'ros2 launch pi_bot slam_map.launch.py',
    color: 'indigo',
    description: 'Build the warehouse area map',
  },
  {
    id: 'nav',
    label: 'Start Autonomous Nav',
    icon: Bot,
    command: 'ros2 launch pi_bot navigation.launch.py',
    color: 'emerald',
    description: 'Connect Pi with bot for autonomous navigation',
  },
  {
    id: 'scan_full',
    label: 'Full Inventory Scan',
    icon: Layers,
    command: 'cd ~/wareops_scanner && python3 -m active_vision_scanner.scan --scope full',
    color: 'blue',
    description: 'Scan all racks in the warehouse',
  },
  {
    id: 'scan_rack',
    label: 'Scan Specific Rack',
    icon: RefreshCw,
    command: null,
    color: 'amber',
    description: 'Scan one rack only',
    requiresTarget: 'rack',
  },
  {
    id: 'scan_bin',
    label: 'Scan Specific Bin',
    icon: Cpu,
    command: null,
    color: 'purple',
    description: 'Scan one bin only',
    requiresTarget: 'bin',
  },
];

const COLOR_MAP: Record<string, string> = {
  indigo: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20',
  emerald: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20',
  blue: 'bg-blue-500/10 border-blue-500/30 text-blue-300 hover:bg-blue-500/20',
  amber: 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20',
  purple: 'bg-purple-500/10 border-purple-500/30 text-purple-300 hover:bg-purple-500/20',
};

export default function AdminOverview() {
  const navigate = useNavigate();
  const terminalRef = useRef<HTMLDivElement>(null);

  // ── Warehouse overview state ────────────────────────────────────────────────
  const [warehouses, setWarehouses] = useState<NetworkWarehouse[]>([]);
  const [auditFeed, setAuditFeed] = useState<any[]>([]);

  // ── SSH + Remote Shell state ────────────────────────────────────────────────
  const [shellWarehouseId, setShellWarehouseId] = useState(DEFAULT_WAREHOUSE_ID);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([
    '$ WAREOps Pi Remote Shell',
    '$ Connect via SSH or use quick-launch buttons below.',
  ]);
  const [shellInput, setShellInput] = useState('');

  // SSH connection form
  const [sshHost, setSshHost] = useState(DEFAULT_PI_HOST);
  const [sshUser, setSshUser] = useState(DEFAULT_PI_USER);
  const [sshPassword, setSshPassword] = useState('');
  const [sshSessionId, setSshSessionId] = useState<string | null>(null);
  const [sshConnecting, setSshConnecting] = useState(false);

  // Rack / bin target inputs for dynamic commands
  const [rackTarget, setRackTarget] = useState('A1-RK1');
  const [binTarget, setBinTarget] = useState('A1-RK1-S1-B1');

  // ── WebSocket connection for remote shell relay ────────────────────────────
  const { isConnected, socket } = useWebSocket({ warehouseId: shellWarehouseId });

  // Scroll terminal to bottom when new output arrives
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalOutput]);

  const appendToTerminal = (...lines: string[]) => {
    setTerminalOutput(prev => [...prev, ...lines].slice(-300));
  };

  // ── Listen for command_output events from Pi remote shell ──────────────────
  useEffect(() => {
    if (!socket) return;

    const handleOutput = (data: any) => {
      if (data.output) appendToTerminal(data.output);
      if (data.error) appendToTerminal(`[stderr] ${data.error}`);
    };

    socket.on('command_output', handleOutput);
    return () => { socket.off('command_output', handleOutput); };
  }, [socket]);

  // ── SSH connect ────────────────────────────────────────────────────────────
  const handleSshConnect = () => {
    if (!socket) {
      appendToTerminal('$ [ERROR] WebSocket not connected. Waiting...');
      return;
    }
    setSshConnecting(true);
    const sessionId = `ssh-${Date.now()}`;
    setSshSessionId(sessionId);
    appendToTerminal(`$ Connecting to ${sshUser}@${sshHost}...`);

    // ssh_proxy.py on Pi listens for __SSH_CONNECT__ prefix commands
    socket.emit('execute_command', {
      warehouse_id: shellWarehouseId,
      id: sessionId,
      command: `__SSH_CONNECT__${sshUser}@${sshHost}:${sshPassword}`,
    });

    // Assume connected after brief delay (actual ack comes via command_output)
    setTimeout(() => setSshConnecting(false), 2000);
  };

  // ── Send arbitrary shell command ────────────────────────────────────────────
  const handleShellSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shellInput.trim() || !socket) return;
    appendToTerminal(`$ ${shellInput}`);
    socket.emit('execute_command', {
      warehouse_id: shellWarehouseId,
      id: sshSessionId || `cmd-${Date.now()}`,
      command: shellInput,
    });
    setShellInput('');
  };

  // ── Send Pi quick command ──────────────────────────────────────────────────
  const handlePiCommand = (cmd: PiCommand) => {
    if (!socket) {
      appendToTerminal('$ [ERROR] WebSocket not connected.');
      return;
    }

    let command = cmd.command;
    if (cmd.requiresTarget === 'rack') {
      command = `cd ~/wareops_scanner && python3 -m active_vision_scanner.scan --scope rack --target ${rackTarget}`;
    } else if (cmd.requiresTarget === 'bin') {
      command = `cd ~/wareops_scanner && python3 -m active_vision_scanner.scan --scope bin --target ${binTarget}`;
    }

    if (!command) return;
    appendToTerminal(`$ ${command}`);
    socket.emit('execute_command', {
      warehouse_id: shellWarehouseId,
      id: `pi-${Date.now()}`,
      command,
    });
  };

  // ── Load overview data ─────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const [logs, robots, alerts, missions, fetchedWarehouses] = await Promise.all([
          adminApi.getAuditLogs().catch(() => []),
          robotsApi.getRobots().catch(() => []),
          alertsApi.getAlerts().catch(() => []),
          missionsApi.getMissions().catch(() => []),
          warehousesApi.getWarehouses().catch(() => []),
        ]);

        if (Array.isArray(logs) && logs.length > 0) {
          setAuditFeed(logs.slice(0, 8));
        }

        const onlineRobots = robots.filter((r: any) => ['ONLINE','AUDITING','IDLE'].includes(r.status)).length;
        const openAlerts   = alerts.filter((a: any) => a.status === 'OPEN').length;
        const activeMissions = missions.filter((m: any) => ['IN_PROGRESS','SCHEDULED'].includes(m.status)).length;

        if (Array.isArray(fetchedWarehouses) && fetchedWarehouses.length > 0) {
          setWarehouses(fetchedWarehouses.map((w: any) => ({
            id: w.id,
            name: w.name || w.code,
            location: w.address || w.city || 'Warehouse',
            healthScore: 92,
            missions: activeMissions,
            alerts: openAlerts,
            robotsOnline: onlineRobots,
            robotsTotal: w.active_robots || Math.max(onlineRobots, 1),
            status: 'ACTIVE' as const,
            grade: 'A',
          })));
        }
      } catch (err) {
        console.error('Admin overview load failed:', err);
      }
    };
    load();
  }, []);

  const activeWhs = warehouses.filter(w => w.status === 'ACTIVE');
  const orgScore  = Math.round(activeWhs.reduce((a, w) => a + w.healthScore, 0) / Math.max(activeWhs.length, 1));

  const statusColor: Record<string, string> = {
    ACTIVE:    'bg-emerald-500/10 text-emerald-400',
    SETUP_MODE:'bg-amber-500/10 text-amber-400',
    INACTIVE:  'bg-slate-800 text-slate-500',
  };

  return (
    <div className="space-y-6">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-purple-400 mb-1">Administrator</p>
          <h1 className="text-2xl font-bold text-slate-100">Organization Overview</h1>
          <p className="text-sm text-slate-500 mt-1">Global view across {warehouses.length} warehouse(s)</p>
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-5 py-3 text-center self-start sm:self-auto">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Org Health</p>
          <p className="text-4xl font-bold mt-1" style={{ color: orgScore >= 80 ? '#10b981' : '#6366f1' }}>{orgScore || '—'}</p>
        </div>
      </div>

      {/* ── Stats row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Active Warehouses', value: activeWhs.length, icon: Building2, color: '#6366f1' },
          { label: 'Active Missions',   value: warehouses.reduce((a, w) => a + w.missions, 0), icon: Activity, color: '#10b981' },
          { label: 'Open Alerts',       value: warehouses.reduce((a, w) => a + w.alerts, 0),   icon: AlertTriangle, color: '#ef4444' },
          { label: 'Robots Online',     value: warehouses.reduce((a, w) => a + w.robotsOnline, 0), icon: Bot, color: '#8b5cf6' },
        ].map(stat => (
          <div key={stat.label} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-1">{stat.label}</p>
                <p className="text-2xl font-bold text-slate-100 font-mono">{stat.value}</p>
              </div>
              <div className="rounded-xl p-2" style={{ backgroundColor: stat.color + '18' }}>
                <stat.icon className="h-5 w-5" style={{ color: stat.color }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Warehouse network grid ────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-slate-300 mb-4">Warehouse Network</h2>
        {warehouses.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-slate-500 text-sm">
            No warehouses found. Run the seed script to populate the database.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {warehouses.map(wh => (
              <div key={wh.id}
                onClick={() => { if (wh.status === 'ACTIVE') navigate('/supervisor/dashboard'); }}
                className={`rounded-2xl border p-5 transition-all duration-300 group
                  ${wh.status === 'ACTIVE'
                    ? 'border-white/[0.06] bg-white/[0.03] cursor-pointer hover:border-indigo-500/30 hover:bg-indigo-500/[0.04]'
                    : 'border-white/[0.03] bg-white/[0.01] opacity-70 cursor-default'}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors">{wh.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{wh.location}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <HealthRing score={wh.healthScore} size={44} />
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusColor[wh.status]}`}>{wh.status}</span>
                  </div>
                </div>
                {wh.status !== 'INACTIVE' && (
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-xl bg-white/[0.03] p-2">
                      <p className="text-xs font-bold text-emerald-400">{wh.missions}</p>
                      <p className="text-[10px] text-slate-600 mt-0.5">Missions</p>
                    </div>
                    <div className="rounded-xl bg-white/[0.03] p-2">
                      <p className={`text-xs font-bold ${wh.alerts > 10 ? 'text-red-400' : wh.alerts > 3 ? 'text-amber-400' : 'text-slate-300'}`}>{wh.alerts}</p>
                      <p className="text-[10px] text-slate-600 mt-0.5">Alerts</p>
                    </div>
                    <div className="rounded-xl bg-white/[0.03] p-2">
                      <p className="text-xs font-bold text-indigo-400">{wh.robotsOnline}/{wh.robotsTotal}</p>
                      <p className="text-[10px] text-slate-600 mt-0.5">Robots</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Audit feed ────────────────────────────────────────────────────── */}
      {auditFeed.length > 0 && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-200">Recent Admin Activity</h2>
          </div>
          <div className="space-y-0">
            {auditFeed.map((event: any, idx: number) => (
              <div key={event.id || idx} className={`flex items-start gap-3 py-2.5 ${idx < auditFeed.length - 1 ? 'border-b border-white/[0.04]' : ''}`}>
                <span className="mt-0.5 text-[10px] text-emerald-400 font-bold flex-shrink-0">✓</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[10px] font-mono font-semibold text-slate-500 flex-shrink-0">{event.actor_user_id ? String(event.actor_user_id).slice(0,8) : 'system'}</span>
                    <span className="text-[10px] font-semibold text-indigo-400">{event.event_type || event.action}</span>
                  </div>
                </div>
                <span className="text-[10px] text-slate-600 whitespace-nowrap">{event.created_at ? new Date(event.created_at).toLocaleTimeString() : 'recently'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Pi Remote Control Panel ───────────────────────────────────────── */}
      <div className="rounded-2xl border border-white/[0.06] bg-[#070b16] p-0 overflow-hidden">

        {/* Panel header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06] bg-white/[0.02]">
          <div className="h-8 w-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Server className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-bold text-slate-200">Raspberry Pi Remote Control</h2>
            <p className="text-[11px] text-slate-500">SSH terminal + autonomous scan commands</p>
          </div>
          {/* WS status */}
          <div className="flex items-center gap-1.5 text-[11px] font-mono">
            {isConnected ? (
              <><Wifi className="h-3.5 w-3.5 text-emerald-400" /><span className="text-emerald-400">RELAY LIVE</span></>
            ) : (
              <><WifiOff className="h-3.5 w-3.5 text-red-400" /><span className="text-red-400">RELAY OFFLINE</span></>
            )}
          </div>
          {/* Warehouse selector */}
          <select
            value={shellWarehouseId}
            onChange={e => setShellWarehouseId(e.target.value)}
            className="bg-white/[0.03] border border-white/[0.06] text-xs text-slate-300 rounded px-2 py-1 outline-none ml-2"
          >
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
            <option value={DEFAULT_WAREHOUSE_ID}>WH-DEFAULT</option>
          </select>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-0 divide-y xl:divide-y-0 xl:divide-x divide-white/[0.06]">

          {/* ── Left: SSH Connection + Terminal ─────────────────────────── */}
          <div className="p-5 space-y-4">

            {/* SSH connection form */}
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <TerminalIcon className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-xs font-semibold text-slate-300">SSH Connection</span>
                {sshSessionId && (
                  <span className="ml-auto text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    SESSION ACTIVE
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">IP Address</label>
                  <input
                    type="text"
                    value={sshHost}
                    onChange={e => setSshHost(e.target.value)}
                    placeholder="10.225.34.209"
                    className="w-full bg-slate-900 border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono outline-none focus:border-emerald-500/50"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">Username</label>
                  <input
                    type="text"
                    value={sshUser}
                    onChange={e => setSshUser(e.target.value)}
                    placeholder="abhinav"
                    className="w-full bg-slate-900 border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono outline-none focus:border-emerald-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-500 block mb-1">Password</label>
                <input
                  type="password"
                  value={sshPassword}
                  onChange={e => setSshPassword(e.target.value)}
                  placeholder="SSH password"
                  className="w-full bg-slate-900 border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono outline-none focus:border-emerald-500/50"
                />
              </div>

              <button
                onClick={handleSshConnect}
                disabled={sshConnecting || !isConnected}
                className="w-full py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold hover:bg-emerald-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {sshConnecting ? (
                  <><span className="animate-spin h-3 w-3 border border-emerald-400 border-t-transparent rounded-full" />Connecting...</>
                ) : (
                  <><ChevronRight className="h-3.5 w-3.5" />Connect SSH to {sshUser}@{sshHost}</>
                )}
              </button>
            </div>

            {/* Terminal output */}
            <div
              ref={terminalRef}
              className="h-56 overflow-y-auto bg-black border border-white/[0.06] rounded-xl p-3 font-mono text-[11px] leading-relaxed"
            >
              {terminalOutput.map((line, i) => {
                const isCmd = line.startsWith('$');
                const isErr = line.includes('[stderr]') || line.includes('[ERROR]');
                return (
                  <div key={i} className={
                    isErr ? 'text-red-400' :
                    isCmd ? 'text-emerald-400' :
                    'text-slate-300 opacity-90'
                  }>
                    {line}
                  </div>
                );
              })}
            </div>

            {/* Shell input */}
            <form onSubmit={handleShellSubmit} className="flex gap-2">
              <span className="text-emerald-500 font-mono text-sm self-center">$&gt;</span>
              <input
                type="text"
                value={shellInput}
                onChange={e => setShellInput(e.target.value)}
                placeholder={isConnected ? 'Enter command...' : 'Waiting for relay connection...'}
                disabled={!isConnected}
                className="flex-1 bg-white/[0.02] border border-white/[0.06] rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono outline-none focus:border-emerald-500/50 focus:bg-emerald-500/5 transition-colors disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!isConnected || !shellInput.trim()}
                className="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold hover:bg-emerald-500/30 disabled:opacity-50 transition-all"
              >
                <Play className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>

          {/* ── Right: Quick Command Buttons ──────────────────────────────── */}
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Cpu className="h-3.5 w-3.5 text-indigo-400" />
              <span className="text-xs font-semibold text-slate-300">Pi Quick Commands</span>
            </div>

            <div className="space-y-2">
              {PI_COMMANDS.map(cmd => (
                <div key={cmd.id}>
                  {/* Commands that need a target input */}
                  {cmd.requiresTarget === 'rack' && (
                    <div className="flex gap-2 mb-1">
                      <span className="text-[10px] text-slate-500 self-center whitespace-nowrap">Rack ID:</span>
                      <input
                        type="text"
                        value={rackTarget}
                        onChange={e => setRackTarget(e.target.value)}
                        placeholder="A1-RK1"
                        className="flex-1 bg-slate-900 border border-white/[0.08] rounded px-2 py-1 text-xs text-slate-200 font-mono outline-none focus:border-amber-500/50"
                      />
                    </div>
                  )}
                  {cmd.requiresTarget === 'bin' && (
                    <div className="flex gap-2 mb-1">
                      <span className="text-[10px] text-slate-500 self-center whitespace-nowrap">Bin Code:</span>
                      <input
                        type="text"
                        value={binTarget}
                        onChange={e => setBinTarget(e.target.value)}
                        placeholder="A1-RK1-S1-B1"
                        className="flex-1 bg-slate-900 border border-white/[0.08] rounded px-2 py-1 text-xs text-slate-200 font-mono outline-none focus:border-purple-500/50"
                      />
                    </div>
                  )}

                  <button
                    onClick={() => handlePiCommand(cmd)}
                    disabled={!isConnected}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${COLOR_MAP[cmd.color]}`}
                  >
                    <cmd.icon className="h-4 w-4 flex-shrink-0" />
                    <div className="flex-1 text-left">
                      <div className="font-semibold">{cmd.label}</div>
                      <div className="text-[10px] opacity-70 font-normal mt-0.5">{cmd.description}</div>
                    </div>
                    <Play className="h-3.5 w-3.5 opacity-60 flex-shrink-0" />
                  </button>
                </div>
              ))}
            </div>

            {/* Note about remote_shell.py */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-[10px] text-slate-500 space-y-1">
              <p className="font-semibold text-slate-400">Pi Setup Required</p>
              <p>Ensure these run on the Pi laptop before using this panel:</p>
              <code className="block text-emerald-400/80 mt-1">python3 -m active_vision_scanner.remote_shell</code>
              <code className="block text-emerald-400/80">python3 -m active_vision_scanner.ssh_proxy</code>
              <p className="mt-1">Set <code className="text-indigo-300">WAREOPS_API_URL</code> and <code className="text-indigo-300">WAREOPS_API_TOKEN</code> on Pi.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
