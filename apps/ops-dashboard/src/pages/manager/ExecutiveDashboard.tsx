import React, { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  Clock, Bot, Activity, Download
} from 'lucide-react';
import { exportToCsv } from '../../utils/exportCsv';
import { analyticsApi, alertsApi, robotsApi, adminApi } from '../../api/client';
import type { WarehouseKPIs } from '../../types';

// ─── Circular Health Score Gauge ───────────────────────────────────────────────
const HealthGauge: React.FC<{ score: number }> = ({ score }) => {
  const [animated, setAnimated] = useState(0);
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const progress = (animated / 100) * circumference;
  const dashOffset = circumference - progress;

  let color = '#6366f1';
  let glowColor = 'rgba(99,102,241,0.4)';
  let label = 'Excellent';
  if (score >= 90) { color = '#10b981'; glowColor = 'rgba(16,185,129,0.4)'; label = 'Optimal'; }
  else if (score >= 75) { color = '#6366f1'; glowColor = 'rgba(99,102,241,0.4)'; label = 'Good'; }
  else if (score >= 60) { color = '#f59e0b'; glowColor = 'rgba(245,158,11,0.4)'; label = 'Fair'; }
  else { color = '#ef4444'; glowColor = 'rgba(239,68,68,0.4)'; label = 'Critical'; }

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(score), 300);
    return () => clearTimeout(timer);
  }, [score]);

  return (
    <div className="relative flex flex-col items-center justify-center">
      <svg width="200" height="200" viewBox="0 0 200 200">
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Track */}
        <circle cx="100" cy="100" r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
        {/* Progress */}
        <circle
          cx="100" cy="100" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform="rotate(-90 100 100)"
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.32,0.72,0,1), stroke 0.5s ease', filter: `drop-shadow(0 0 8px ${glowColor})` }}
        />
        {/* Center */}
        <text x="100" y="90" textAnchor="middle" fill="white" fontSize="36" fontWeight="700" fontFamily="monospace">
          {Math.round(animated)}
        </text>
        <text x="100" y="112" textAnchor="middle" fill={color} fontSize="11" fontWeight="600" letterSpacing="1">
          {label.toUpperCase()}
        </text>
        <text x="100" y="128" textAnchor="middle" fill="rgba(148,163,184,0.7)" fontSize="9">
          HEALTH SCORE
        </text>
      </svg>
      <div className="flex flex-wrap justify-center gap-1.5 mt-2">
        {['Accuracy 40%', 'Missions 25%', 'Alerts 20%', 'Robots 15%'].map(c => (
          <span key={c} className="rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] text-slate-400 font-medium">
            {c}
          </span>
        ))}
      </div>
    </div>
  );
};

// ─── Sparkline KPI Card ────────────────────────────────────────────────────────
interface KpiCardProps {
  title: string;
  value: string;
  trend: 'up' | 'down';
  change: string;
  data: { day: string; value: number }[];
  color: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}

const KpiCard: React.FC<KpiCardProps> = ({ title, value, trend, change, data, color, icon: Icon }) => (
  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 backdrop-blur-sm hover:border-white/[0.12] transition-all duration-500 group">
    <div className="flex items-start justify-between mb-4">
      <div>
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-1">{title}</p>
        <p className="text-2xl font-bold text-slate-100" style={{ fontFamily: 'monospace' }}>{value}</p>
        <div className="flex items-center gap-1 mt-1">
          {trend === 'up' ? (
            <TrendingUp className="h-3 w-3 text-emerald-400" />
          ) : (
            <TrendingDown className="h-3 w-3 text-red-400" />
          )}
          <span className={`text-xs font-medium ${trend === 'up' ? 'text-emerald-400' : 'text-red-400'}`}>{change}</span>
          <span className="text-xs text-slate-600">vs last week</span>
        </div>
      </div>
      <div className="rounded-xl p-2" style={{ backgroundColor: color + '15' }}>
        <Icon className="h-5 w-5" style={{ color }} />
      </div>
    </div>
    <ResponsiveContainer width="100%" height={48}>
      <AreaChart data={data.length > 0 ? data : Array.from({ length: 7 }, (_, i) => ({ day: `D${i}`, value: 90 + i }))} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`grad-${title.replace(/\s+/g, '-')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} fill={`url(#grad-${title.replace(/\s+/g, '-')})`} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  </div>
);

// ─── Custom Tooltip ────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-[#0d1424] p-3 text-xs shadow-xl">
      <p className="text-slate-400 mb-2 font-semibold">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.fill || p.color }} />
          <span className="text-slate-300">{p.name}: <strong>{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</strong></span>
        </div>
      ))}
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────
export default function ExecutiveDashboard() {
  const [accuracyTrend, setAccuracyTrend] = useState<{ day: string; value: number }[]>([]);
  const [robotUtilization, setRobotUtilization] = useState<{ name: string; value: number; color: string }[]>([]);
  const [criticalEvents, setCriticalEvents] = useState<any[]>([]);
  const [healthScore, setHealthScore] = useState(0);
  const [alertTrendData, setAlertTrendData] = useState<{ date: string; critical: number; high: number; medium: number; low: number }[]>([]);

  // Real KPI values populated from analyticsApi.getWarehouseKPIs
  const [kpis, setKpis] = useState<WarehouseKPIs | null>(null);

  useEffect(() => {
    const loadExecutiveData = async () => {
      try {
        // Default warehouse ID — must match seeded warehouse UUID
        const warehouseId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

        const [trendData, robotsList, alertsList, auditLogs, alertFreq, kpisData] = await Promise.all([
          analyticsApi.getAccuracyTrend(warehouseId).catch(() => []),
          robotsApi.getRobots().catch(() => []),
          alertsApi.getAlerts().catch(() => []),
          adminApi.getAuditLogs().catch(() => []),
          analyticsApi.getAlertFrequency(warehouseId).catch(() => []),
          analyticsApi.getWarehouseKPIs(warehouseId).catch(() => null),
        ]);

        // ── KPIs ───────────────────────────────────────────────────────────────
        if (kpisData && typeof kpisData.health_score === 'number') {
          setKpis(kpisData);
          setHealthScore(Math.round(kpisData.health_score));
        } else {
          // Compute fallback health score from available data
          const latestAcc = trendData.length > 0 ? trendData[trendData.length - 1].accuracy : 99.0;
          const activeCount = robotsList.filter((r: any) => r.status === 'ONLINE' || r.status === 'AUDITING').length;
          const robotHealth = robotsList.length > 0 ? (activeCount / robotsList.length) * 100 : 100;
          const calculated = Math.round(latestAcc * 0.7 + robotHealth * 0.3);
          setHealthScore(Math.min(99, Math.max(0, calculated)));
        }

        // ── Alert frequency trend ──────────────────────────────────────────────
        if (Array.isArray(alertFreq) && alertFreq.length > 0) {
          setAlertTrendData(alertFreq.map((af: any) => ({
            date: af.date,
            critical: af.CRITICAL || 0,
            high: af.HIGH || 0,
            medium: af.MEDIUM || 0,
            low: af.LOW || 0,
          })));
        } else {
          setAlertTrendData([]);
        }

        // ── Accuracy sparkline ─────────────────────────────────────────────────
        if (trendData && trendData.length > 0) {
          setAccuracyTrend(trendData.slice(-14).map((d: any, i: number) => ({
            day: `D${i + 1}`,
            value: d.accuracy,
          })));
        }

        // ── Robot utilization donut ────────────────────────────────────────────
        const activeCount = robotsList.filter((r: any) => r.status === 'ONLINE' || r.status === 'AUDITING').length;
        const chargingCount = robotsList.filter((r: any) => r.status === 'CHARGING').length;
        const offlineCount = robotsList.filter((r: any) => r.status === 'OFFLINE' || r.status === 'FAULTED').length;
        const idleCount = Math.max(0, robotsList.length - activeCount - chargingCount - offlineCount);

        setRobotUtilization([
          { name: 'Active', value: activeCount || 0, color: '#6366f1' },
          { name: 'Idle', value: idleCount || 0, color: '#22d3ee' },
          { name: 'Charging', value: chargingCount || 0, color: '#10b981' },
          { name: 'Offline', value: offlineCount || 0, color: '#374151' },
        ].filter(r => r.value > 0));

        // ── Critical events from audit logs ────────────────────────────────────
        const mappedLogs = (auditLogs as any[]).slice(0, 5).map((log: any, idx: number) => ({
          id: log.id || idx,
          icon: log.outcome === 'SUCCESS' ? CheckCircle2 : AlertTriangle,
          iconColor: log.outcome === 'SUCCESS' ? 'text-emerald-400' : 'text-red-400',
          bgColor: log.outcome === 'SUCCESS' ? 'bg-emerald-500/10' : 'bg-red-500/10',
          title: log.event_type ? log.event_type.replace(/_/g, ' ') : 'SYSTEM EVENT',
          desc: `${log.resource_type || 'resource'} · ${log.actor_role || 'system'}`,
          time: log.created_at ? new Date(log.created_at).toLocaleTimeString() : 'recently',
          severity: log.outcome === 'SUCCESS' ? 'success' : 'critical',
        }));
        if (mappedLogs.length > 0) {
          setCriticalEvents(mappedLogs);
        }
      } catch (err) {
        console.error('Failed to load executive dashboard data:', err);
      }
    };

    loadExecutiveData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-400 mb-1">Manager Dashboard</p>
          <h1 className="text-2xl font-bold text-slate-100">Executive Overview</h1>
          <p className="text-sm text-slate-500 mt-1">Warehouse WH-ALPHA-001 · Last updated just now</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              const headers = ['Metric', 'Current Value', 'Status'];
              const rows = [
                ['Warehouse Health Score', kpis ? `${kpis.health_score.toFixed(1)}%` : `${healthScore}%`, 'Target: >95%'],
                ['Inventory Accuracy', kpis ? `${kpis.inventory_accuracy.toFixed(1)}%` : 'Loading...', 'Target: >99.0%'],
                ['Mission Success Rate', kpis ? `${kpis.mission_success_rate.toFixed(1)}%` : 'Loading...', 'Target: >90%'],
                ['Robot Fleet Uptime', kpis ? `${kpis.robot_uptime.toFixed(1)}%` : 'Loading...', 'Target: >85%'],
                ['Open Alerts', kpis ? `${kpis.open_alerts}` : 'Loading...', 'Target: <5'],
                ['Active Missions', kpis ? `${kpis.active_missions}` : 'Loading...', ''],
              ];
              exportToCsv('executive_dashboard_summary', headers, rows);
            }}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-semibold text-white transition-all shadow-lg shadow-indigo-500/20"
          >
            <Download className="h-4 w-4" /> Export Summary
          </button>
          <div className="flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-4 py-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-xs font-semibold text-emerald-400 font-mono">LIVE FEED ACTIVE</span>
          </div>
        </div>
      </div>

      {/* Health Score + KPIs */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Health Gauge */}
        <div className="lg:col-span-1 rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-sm p-6 flex items-center justify-center">
          <HealthGauge score={healthScore} />
        </div>

        {/* KPI Cards */}
        <div className="lg:col-span-4 grid grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard
            title="Inventory Accuracy"
            value={kpis ? `${kpis.inventory_accuracy.toFixed(1)}%` : '—'}
            trend={kpis && kpis.inventory_accuracy >= 95 ? 'up' : 'down'}
            change={kpis ? `${kpis.inventory_accuracy >= 95 ? '+' : ''}${(kpis.inventory_accuracy - 95).toFixed(1)}%` : '—'}
            data={accuracyTrend}
            color="#10b981"
            icon={CheckCircle2}
          />
          <KpiCard
            title="Mission Success Rate"
            value={kpis ? `${kpis.mission_success_rate.toFixed(1)}%` : '—'}
            trend={kpis && kpis.mission_success_rate >= 90 ? 'up' : 'down'}
            change={kpis ? `${kpis.mission_success_rate >= 90 ? '+' : ''}${(kpis.mission_success_rate - 90).toFixed(1)}%` : '—'}
            data={accuracyTrend}
            color="#6366f1"
            icon={Activity}
          />
          <KpiCard
            title="Open Alerts"
            value={kpis ? `${kpis.open_alerts} open` : '—'}
            trend={kpis && kpis.open_alerts <= 5 ? 'up' : 'down'}
            change={kpis ? (kpis.open_alerts <= 5 ? 'low volume' : 'needs attention') : '—'}
            data={accuracyTrend}
            color="#f59e0b"
            icon={Clock}
          />
          <KpiCard
            title="Robot Fleet Uptime"
            value={kpis ? `${kpis.robot_uptime.toFixed(1)}%` : '—'}
            trend={kpis && kpis.robot_uptime >= 80 ? 'up' : 'down'}
            change={kpis ? `${kpis.robot_uptime >= 80 ? '+' : ''}${(kpis.robot_uptime - 80).toFixed(1)}%` : '—'}
            data={accuracyTrend}
            color="#8b5cf6"
            icon={Bot}
          />
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Alert Trend BarChart */}
        <div className="lg:col-span-2 rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">Alert Volume</p>
              <h2 className="text-base font-semibold text-slate-200 mt-0.5">Last 14 Days by Severity</h2>
            </div>
            <div className="flex gap-3 text-xs">
              {[['#ef4444', 'Critical'], ['#f97316', 'High'], ['#f59e0b', 'Medium'], ['#6b7280', 'Low']].map(([c, l]) => (
                <div key={l} className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: c }} />
                  <span className="text-slate-400">{l}</span>
                </div>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={alertTrendData} barSize={10} barGap={1}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: '#4b5563', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#4b5563', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="critical" stackId="a" fill="#ef4444" radius={[0, 0, 0, 0]} />
              <Bar dataKey="high" stackId="a" fill="#f97316" />
              <Bar dataKey="medium" stackId="a" fill="#f59e0b" />
              <Bar dataKey="low" stackId="a" fill="#374151" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Robot Utilization Donut */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-sm p-6">
          <div className="mb-5">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">Fleet Status</p>
            <h2 className="text-base font-semibold text-slate-200 mt-0.5">Robot Utilization</h2>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={robotUtilization} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={3}>
                {robotUtilization.map((entry, index) => (
                  <Cell key={index} fill={entry.color} stroke="none" />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-2">
            {robotUtilization.map(item => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-xs text-slate-400">{item.name}</span>
                </div>
                <span className="text-xs font-semibold text-slate-200">{item.value} robots</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Critical Events Timeline */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">Event Feed</p>
            <h2 className="text-base font-semibold text-slate-200 mt-0.5">Recent Critical Events</h2>
          </div>
          <span className="text-xs text-slate-500">Last 24 hours</span>
        </div>
        <div className="relative space-y-0">
          {criticalEvents.map((event, idx) => (
            <div key={event.id} className="relative flex gap-4 group">
              {idx < criticalEvents.length - 1 && (
                <div className="absolute left-5 top-10 h-full w-px bg-white/5" />
              )}
              <div className={`relative z-10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${event.bgColor}`}>
                <event.icon className={`h-4 w-4 ${event.iconColor}`} />
              </div>
              <div className="flex-1 pb-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-200 group-hover:text-white transition-colors">{event.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{event.desc}</p>
                  </div>
                  <span className="text-[11px] text-slate-600 whitespace-nowrap ml-4 mt-0.5">{event.time}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
