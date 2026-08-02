import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, ReferenceLine, Legend
} from 'recharts';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Target } from 'lucide-react';
import { analyticsApi, alertsApi, robotsApi, missionsApi } from '../../api/client';

const DEFAULT_WAREHOUSE_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

const ALERT_TYPE_COLORS: Record<string, string> = {
  MISPLACED: '#f97316',
  MISSING: '#ef4444',
  EXTRA: '#8b5cf6',
  DAMAGED: '#f59e0b',
  MISMATCH: '#f97316',
  UNKNOWN: '#6b7280',
};

const MISSION_OUTCOME_COLORS: Record<string, string> = {
  COMPLETED: '#10b981',
  FAILED: '#ef4444',
  CANCELLED: '#6b7280',
  IN_PROGRESS: '#6366f1',
  SCHEDULED: '#22d3ee',
};

// ─── Sub-components ────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#0d1424] p-3 text-xs shadow-xl">
      <p className="text-slate-400 mb-2 font-semibold">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: p.color || p.fill }} />
          <span className="text-slate-300">{p.name}: <strong className="text-white">{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</strong></span>
        </div>
      ))}
    </div>
  );
};

const TrendBadge: React.FC<{ trend: string; value: string }> = ({ trend, value }) => (
  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold
    ${trend === 'up' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
    {trend === 'up' ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
    {value}
  </span>
);

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, string> = {
    ACTIVE: 'bg-emerald-500/10 text-emerald-400',
    CHARGING: 'bg-indigo-500/10 text-indigo-400',
    OFFLINE: 'bg-slate-800 text-slate-500',
  };
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${map[status] || 'bg-slate-800 text-slate-400'}`}>{status}</span>;
};

const TABS = ['Inventory Accuracy', 'Alert Analysis', 'Mission Performance', 'Robot Efficiency'];

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);

  const [inventoryAccuracyData, setInventoryAccuracyData] = useState<{ date: string; accuracy: number; scans: number }[]>([]);
  const [zoneAccuracyBreakdown, setZoneAccuracyBreakdown] = useState<{ zone: string; scanned: number; total: number; accuracy: number; trend: string }[]>([]);
  const [alertByTypeData, setAlertByTypeData] = useState<{ type: string; count: number; color: string }[]>([]);
  const [topAlertZones, setTopAlertZones] = useState<{ zone: string; alerts: number }[]>([]);
  const [missionCompletionData, setMissionCompletionData] = useState<{ date: string; rate: number }[]>([]);
  const [missionOutcome, setMissionOutcome] = useState<{ name: string; value: number; color: string }[]>([]);
  const [robotEfficiencyData, setRobotEfficiencyData] = useState<{ robot: string; uptime: number; missions: number; battery: number; status: string }[]>([]);
  const [robotScanCoverage, setRobotScanCoverage] = useState<{ robot: string; scans: number }[]>([]);
  const [slaCompliance, setSlaCompliance] = useState(0);
  const [missionSuccessRate, setMissionSuccessRate] = useState(0);
  const [avgBinsScanned, setAvgBinsScanned] = useState(0);
  const [missionDurationData, setMissionDurationData] = useState<{ range: string; count: number }[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [accuracyTrend, alerts, missionStats, robots, missions, kpis] = await Promise.all([
          analyticsApi.getAccuracyTrend(DEFAULT_WAREHOUSE_ID, 30).catch(() => []),
          alertsApi.getAlerts().catch(() => []),
          analyticsApi.getMissionStats(DEFAULT_WAREHOUSE_ID).catch(() => ({})),
          robotsApi.getRobots().catch(() => []),
          missionsApi.getMissions().catch(() => []),
          analyticsApi.getWarehouseKPIs(DEFAULT_WAREHOUSE_ID).catch(() => null),
        ]);

        // Inventory accuracy trend
        if (accuracyTrend.length > 0) {
          setInventoryAccuracyData(accuracyTrend.map((d) => ({
            date: d.date,
            accuracy: d.accuracy,
            scans: d.alerts || 0,
          })));
        }

        // Alerts by type
        const typeCounts: Record<string, number> = {};
        const zoneCounts: Record<string, number> = {};
        let resolvedWithinSla = 0;
        let resolvedTotal = 0;

        (alerts as any[]).forEach((a) => {
          const t = a.alert_type || a.type || 'UNKNOWN';
          typeCounts[t] = (typeCounts[t] || 0) + 1;
          const zone = a.zone || a.warehouse_id?.slice(0, 8) || 'Warehouse';
          zoneCounts[zone] = (zoneCounts[zone] || 0) + 1;
          if (a.status === 'RESOLVED' && a.resolved_at && a.created_at) {
            resolvedTotal++;
            const mins = (new Date(a.resolved_at).getTime() - new Date(a.created_at).getTime()) / 60000;
            if (mins <= 60) resolvedWithinSla++;
          }
        });

        setAlertByTypeData(
          Object.entries(typeCounts).map(([type, count]) => ({
            type,
            count,
            color: ALERT_TYPE_COLORS[type] || '#6b7280',
          }))
        );

        setTopAlertZones(
          Object.entries(zoneCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([zone, alertsCount]) => ({ zone, alerts: alertsCount }))
        );

        setSlaCompliance(resolvedTotal > 0 ? Math.round((resolvedWithinSla / resolvedTotal) * 1000) / 10 : 0);

        // Mission outcomes from stats
        const outcomes = Object.entries(missionStats as Record<string, number>)
          .filter(([, v]) => v > 0)
          .map(([name, value]) => ({
            name: name.replace(/_/g, ' '),
            value,
            color: MISSION_OUTCOME_COLORS[name] || '#6b7280',
          }));
        setMissionOutcome(outcomes);

        // Mission completion trend from missions list
        const last14 = Array.from({ length: 14 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (13 - i));
          return d.toISOString().slice(0, 10);
        });
        const dailyRates = last14.map((date) => {
          const dayMissions = (missions as any[]).filter((m) =>
            m.completed_at?.startsWith(date) || m.started_at?.startsWith(date)
          );
          const completed = dayMissions.filter((m) => m.status === 'COMPLETED').length;
          const rate = dayMissions.length > 0 ? (completed / dayMissions.length) * 100 : 0;
          return {
            date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            rate: Math.round(rate * 10) / 10,
          };
        });
        setMissionCompletionData(dailyRates);

        if (kpis) {
          setMissionSuccessRate(kpis.mission_success_rate);
        }

        const completedMissions = (missions as any[]).filter((m) => m.status === 'COMPLETED');
        const avgBins = completedMissions.length > 0
          ? Math.round(completedMissions.reduce((s, m) => s + (m.total_bins_scanned || 0), 0) / completedMissions.length)
          : 0;
        setAvgBinsScanned(avgBins);

        // Mission duration buckets from completed missions
        const buckets: Record<string, number> = {
          '0–15m': 0, '15–30m': 0, '30–45m': 0, '45–60m': 0, '60–90m': 0, '90m+': 0,
        };
        completedMissions.forEach((m) => {
          if (!m.started_at || !m.completed_at) return;
          const mins = (new Date(m.completed_at).getTime() - new Date(m.started_at).getTime()) / 60000;
          if (mins <= 15) buckets['0–15m']++;
          else if (mins <= 30) buckets['15–30m']++;
          else if (mins <= 45) buckets['30–45m']++;
          else if (mins <= 60) buckets['45–60m']++;
          else if (mins <= 90) buckets['60–90m']++;
          else buckets['90m+']++;
        });
        setMissionDurationData(Object.entries(buckets).map(([range, count]) => ({ range, count })));

        // Robot efficiency from real robot list
        setRobotEfficiencyData((robots as any[]).map((r) => ({
          robot: r.name || r.serial_number || r.id,
          uptime: r.battery_pct ?? 100,
          missions: r.active_mission_id ? 1 : 0,
          battery: Math.round(r.battery_pct ?? 100),
          status: r.status || 'IDLE',
        })));

        setRobotScanCoverage((robots as any[]).map((r) => ({
          robot: (r.name || r.serial_number || r.id).slice(0, 12),
          scans: r.total_bins_scanned || 0,
        })));

        // Zone breakdown — derive from accuracy trend if available
        if (accuracyTrend.length > 0) {
          setZoneAccuracyBreakdown([{
            zone: 'Main Warehouse',
            scanned: accuracyTrend.reduce((s, d) => s + (d.alerts || 0), 0),
            total: accuracyTrend.reduce((s, d) => s + (d.alerts || 0), 0),
            accuracy: accuracyTrend[accuracyTrend.length - 1]?.accuracy ?? 0,
            trend: 'up',
          }]);
        }
      } catch (err) {
        console.error('Analytics load failed:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080c14] p-6 flex items-center justify-center">
        <div className="text-slate-400 text-sm">Loading analytics from backend...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-400 mb-1">Analytics</p>
        <h1 className="text-2xl font-bold text-slate-100">Performance Analytics</h1>
        <p className="text-sm text-slate-500 mt-1">30-day rolling metrics for Warehouse WH-ALPHA-001</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 rounded-xl bg-white/[0.03] border border-white/[0.06] p-1 w-full overflow-x-auto">
        {TABS.map((tab, idx) => (
          <button
            key={tab}
            onClick={() => setActiveTab(idx)}
            className={`flex-1 whitespace-nowrap rounded-lg px-4 py-2 text-xs font-semibold transition-all duration-300
              ${activeTab === idx
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                : 'text-slate-500 hover:text-slate-300'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab 1: Inventory Accuracy */}
      {activeTab === 0 && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">30-Day Trend</p>
                <h2 className="text-base font-semibold text-slate-200 mt-0.5">Accuracy % vs Daily Scan Count</h2>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5">
                <Target className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-xs text-emerald-400 font-semibold">Target: 99.5%</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={inventoryAccuracyData}>
                <defs>
                  <linearGradient id="accGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: '#4b5563', fontSize: 10 }} axisLine={false} tickLine={false} interval={4} />
                <YAxis yAxisId="left" domain={[95, 101]} tick={{ fill: '#4b5563', fontSize: 10 }} axisLine={false} tickLine={false} unit="%" />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: '#4b5563', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine yAxisId="left" y={99.5} stroke="#6366f1" strokeDasharray="6 3" strokeWidth={1.5} label={{ value: 'Target', fill: '#6366f1', fontSize: 10 }} />
                <Bar yAxisId="right" dataKey="scans" fill="rgba(99,102,241,0.15)" radius={[2, 2, 0, 0]} name="Scans" />
                <Line yAxisId="left" type="monotone" dataKey="accuracy" stroke="#10b981" strokeWidth={2} dot={false} name="Accuracy %" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Zone breakdown table */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6">
            <h2 className="text-base font-semibold text-slate-200 mb-4">Zone Accuracy Breakdown</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    {['Zone', 'Scanned Bins', 'Total Bins', 'Accuracy', 'Trend'].map(h => (
                      <th key={h} className="pb-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-widest">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {zoneAccuracyBreakdown.map(row => (
                    <tr key={row.zone} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3.5 text-sm font-medium text-slate-200">{row.zone}</td>
                      <td className="py-3.5 text-sm font-mono text-slate-400">{row.scanned.toLocaleString()}</td>
                      <td className="py-3.5 text-sm font-mono text-slate-400">{row.total.toLocaleString()}</td>
                      <td className="py-3.5">
                        <span className={`text-sm font-bold ${row.accuracy >= 99 ? 'text-emerald-400' : row.accuracy >= 97 ? 'text-amber-400' : 'text-red-400'}`}>
                          {row.accuracy}%
                        </span>
                      </td>
                      <td className="py-3.5">
                        <TrendBadge trend={row.trend} value={row.trend === 'up' ? '+0.3%' : '-0.8%'} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Alert Analysis */}
      {activeTab === 1 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-1">30-Day Volume</p>
              <h2 className="text-base font-semibold text-slate-200 mb-5">Alerts by Type</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={alertByTypeData} layout="vertical" barSize={16}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#4b5563', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="type" type="category" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={80} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} name="Alert Count">
                    {alertByTypeData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6 flex flex-col items-center justify-center gap-4">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">SLA Compliance</p>
              <div className="text-center">
                <p className="text-6xl font-bold text-emerald-400" style={{ fontFamily: 'monospace' }}>{slaCompliance > 0 ? `${slaCompliance}%` : '—'}</p>
                <p className="text-sm text-slate-500 mt-2">of alerts resolved within 60 min SLA</p>
              </div>
              <div className="w-full bg-white/5 rounded-full h-2">
                <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${Math.min(slaCompliance, 100)}%` }} />
              </div>
              <p className="text-xs text-slate-600">Target: 90% · {slaCompliance > 0 ? `Current: ${slaCompliance}%` : 'No resolved alerts yet'}</p>
            </div>
          </div>

          {/* Top 5 alert zones */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6">
            <h2 className="text-base font-semibold text-slate-200 mb-4">Top 5 Alert Zones</h2>
            <div className="space-y-3">
              {topAlertZones.length === 0 ? (
                <p className="text-sm text-slate-500">No alerts recorded yet.</p>
              ) : topAlertZones.map((z, idx) => (
                <div key={z.zone} className="flex items-center gap-4">
                  <span className="text-xs font-bold text-slate-600 w-5">#{idx + 1}</span>
                  <span className="text-sm text-slate-300 w-48">{z.zone}</span>
                  <div className="flex-1 bg-white/5 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-red-500 to-orange-500 transition-all duration-700"
                      style={{ width: `${(z.alerts / topAlertZones[0].alerts) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold text-slate-200 w-12 text-right">{z.alerts}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Mission Performance */}
      {activeTab === 2 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-1">Trend</p>
              <h2 className="text-base font-semibold text-slate-200 mb-5">Mission Completion Rate (14 Days)</h2>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={missionCompletionData}>
                  <defs>
                    <linearGradient id="missGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: '#4b5563', fontSize: 10 }} axisLine={false} tickLine={false} interval={1} />
                  <YAxis domain={[80, 100]} tick={{ fill: '#4b5563', fontSize: 10 }} axisLine={false} tickLine={false} unit="%" />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="rate" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1', r: 3 }} name="Completion %" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-1">Outcomes</p>
              <h2 className="text-base font-semibold text-slate-200 mb-4">Mission Results</h2>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={missionOutcome} cx="50%" cy="50%" innerRadius={40} outerRadius={60} dataKey="value" paddingAngle={3}>
                    {missionOutcome.map((entry, idx) => <Cell key={idx} fill={entry.color} stroke="none" />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {missionOutcome.map(item => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-xs text-slate-400">{item.name}</span>
                    </div>
                    <span className="text-xs font-semibold text-slate-200">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6">
              <h2 className="text-base font-semibold text-slate-200 mb-5">Mission Duration Distribution</h2>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={missionDurationData} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="range" tick={{ fill: '#4b5563', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#4b5563', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} name="Missions" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6 flex flex-col items-center justify-center gap-2">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">Avg Bins Scanned</p>
              <p className="text-5xl font-bold text-indigo-400" style={{ fontFamily: 'monospace' }}>{avgBinsScanned || '—'}</p>
              <p className="text-sm text-slate-500">per mission</p>
              <div className="mt-4 grid grid-cols-2 gap-4 w-full">
                <div className="text-center">
                  <p className="text-lg font-bold text-slate-200">—</p>
                  <p className="text-[10px] text-slate-500">avg duration</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-slate-200">{missionSuccessRate > 0 ? `${missionSuccessRate.toFixed(1)}%` : '—'}</p>
                  <p className="text-[10px] text-slate-500">success rate</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Robot Efficiency */}
      {activeTab === 3 && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6">
            <h2 className="text-base font-semibold text-slate-200 mb-4">Robot Fleet Performance</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    {['Robot', 'Uptime %', 'Missions', 'Avg Battery', 'Status'].map(h => (
                      <th key={h} className="pb-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-widest">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {robotEfficiencyData.map(row => (
                    <tr key={row.robot} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3.5 text-sm font-medium text-slate-200">{row.robot}</td>
                      <td className="py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-white/5 rounded-full h-1.5">
                            <div className="h-1.5 rounded-full bg-indigo-500" style={{ width: `${row.uptime}%` }} />
                          </div>
                          <span className="text-sm font-mono text-slate-300">{row.uptime}%</span>
                        </div>
                      </td>
                      <td className="py-3.5 text-sm font-mono text-slate-400">{row.missions}</td>
                      <td className="py-3.5">
                        <span className={`text-sm font-mono ${row.battery > 50 ? 'text-emerald-400' : row.battery > 20 ? 'text-amber-400' : 'text-red-400'}`}>
                          {row.battery}%
                        </span>
                      </td>
                      <td className="py-3.5"><StatusBadge status={row.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6">
            <h2 className="text-base font-semibold text-slate-200 mb-5">Total Scan Coverage by Robot</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={robotScanCoverage} layout="vertical" barSize={16}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#4b5563', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="robot" type="category" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={50} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="scans" fill="#8b5cf6" radius={[0, 4, 4, 0]} name="Total Scans" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
