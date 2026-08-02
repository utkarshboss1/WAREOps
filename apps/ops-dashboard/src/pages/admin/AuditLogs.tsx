import React, { useState, useMemo, useEffect } from 'react';
import { Search, Download, ChevronLeft, ChevronRight, X, ShieldCheck } from 'lucide-react';
import { exportToCsv } from '../../utils/exportCsv';
import { adminApi } from '../../api/client';

export interface SystemAuditLog {
  id: string;
  timestamp: string;
  actor: string;
  role: string;
  eventType: string;
  resource: string;
  ip: string;
  outcome: 'SUCCESS' | 'FAILURE';
  beforeState?: any;
  afterState?: any;
}

const DEFAULT_LOGS: SystemAuditLog[] = Array.from({ length: 80 }, (_, i) => {
  const events = [
    'USER_LOGIN', 'USER_LOGOUT', 'ALERT_RESOLVED', 'ROLE_CHANGED', 'USER_INVITED',
    'ACCOUNT_LOCKED', 'SESSION_REVOKED', 'API_KEY_GENERATED', 'DATA_EXPORT', 'WAREHOUSE_UPDATED',
    'MISSION_CREATED', 'ROBOT_COMMISSIONED', 'MFA_ENABLED', 'PASSWORD_RESET'
  ];
  const actors = ['admin@wareops.dev', 'supervisor@wareops.dev', 'manager@wareops.dev', 'operator1@wareops.dev', 'system'];
  const roles = ['ENTERPRISE_ADMIN', 'WAREHOUSE_MANAGER', 'WAREHOUSE_SUPERVISOR', 'WAREHOUSE_OPERATOR', 'SYSTEM'];
  const ips = ['203.0.113.42', '198.51.100.7', '192.0.2.55', '203.0.113.11', '0.0.0.0'];
  const warehouses = ['WH-ALPHA-001', 'WH-BETA-002', 'WH-GAMMA-003', 'WH-DELTA-004'];

  const d = new Date('2026-07-17T16:00:00');
  d.setMinutes(d.getMinutes() - i * 11);
  const eventType = events[i % events.length];
  const actorIdx = i % actors.length;
  const outcome: 'SUCCESS' | 'FAILURE' = i % 9 === 0 ? 'FAILURE' : 'SUCCESS';

  return {
    id: `log-${i + 1}`,
    timestamp: d.toISOString().replace('T', ' ').slice(0, 19),
    actor: actors[actorIdx],
    role: roles[actorIdx],
    eventType,
    resource: eventType === 'ALERT_RESOLVED' ? `alert:A${(i % 3) + 1}-R${(i % 4) + 1}` :
      eventType === 'MISSION_CREATED' ? `mission:MSN-${2800 + i}` :
        eventType === 'ROLE_CHANGED' ? `user:operator${i} → MANAGER` : warehouses[i % warehouses.length],
    ip: ips[actorIdx],
    outcome,
    beforeState: eventType === 'ROLE_CHANGED' ? { role: 'WAREHOUSE_OPERATOR' } : null,
    afterState: eventType === 'ROLE_CHANGED' ? { role: 'WAREHOUSE_MANAGER' } : null,
  };
});

const EVENT_TYPES = ['USER_LOGIN', 'USER_LOGOUT', 'ALERT_RESOLVED', 'ROLE_CHANGED', 'USER_INVITED', 'ACCOUNT_LOCKED', 'MISSION_CREATED'];

// ─── Export Modal ──────────────────────────────────────────────────────────────
const ExportModal: React.FC<{ onClose: () => void; logs: SystemAuditLog[] }> = ({ onClose, logs }) => {
  const [evidence, setEvidence] = useState<string[]>(['audit_logs', 'alerts']);
  const toggleEvidence = (e: string) =>
    setEvidence(prev => prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e]);

  const handleExport = () => {
    const headers = ['Log ID', 'Timestamp', 'Actor', 'Role', 'Event Type', 'Resource', 'IP Address', 'Outcome'];
    const rows = logs.map(l => [l.id, l.timestamp, l.actor, l.role, l.eventType, l.resource, l.ip, l.outcome]);
    exportToCsv(`compliance_audit_package_${Date.now()}`, headers, rows);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#0d1424] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.06] p-6">
          <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" /> Export Compliance Package
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">From Date</label>
              <input type="date" defaultValue={new Date().toISOString().split('T')[0]} className="w-full rounded-xl bg-white/[0.04] border border-white/[0.08] px-3 py-2.5 text-sm text-slate-300 outline-none focus:border-indigo-500 transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">To Date</label>
              <input type="date" defaultValue={new Date().toISOString().split('T')[0]} className="w-full rounded-xl bg-white/[0.04] border border-white/[0.08] px-3 py-2.5 text-sm text-slate-300 outline-none focus:border-indigo-500 transition-colors" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Evidence Artifacts</label>
            <div className="space-y-2">
              {[
                { id: 'audit_logs', label: 'System Audit Logs' },
                { id: 'alerts', label: 'Discrepancy & Resolution Records' },
                { id: 'missions', label: 'AMR Fleet Mission Logs' },
                { id: 'access_logs', label: 'User Authentication Logs' },
              ].map(ev => (
                <label key={ev.id} className="flex items-center gap-3 cursor-pointer rounded-xl p-2.5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors border border-white/05">
                  <input
                    type="checkbox"
                    checked={evidence.includes(ev.id)}
                    onChange={() => toggleEvidence(ev.id)}
                    className="rounded bg-white/10 border-white/20 text-indigo-500 focus:ring-0"
                  />
                  <span className="text-xs text-slate-300">{ev.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-white/[0.06] p-6">
          <button onClick={onClose} className="rounded-xl border border-white/[0.08] px-5 py-2.5 text-sm font-semibold text-slate-400 hover:text-slate-200 transition-colors">Cancel</button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors shadow-lg shadow-indigo-500/20 cursor-pointer"
          >
            <Download className="h-4 w-4" /> Download Package (.CSV)
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────
const PAGE_SIZE = 25;

export default function AuditLogs() {
  const [logsList, setLogsList] = useState<SystemAuditLog[]>(DEFAULT_LOGS);
  const [search, setSearch] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState<string[]>([]);
  const [outcomeFilter, setOutcomeFilter] = useState('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [showExport, setShowExport] = useState(false);

  useEffect(() => {
    const loadAuditLogs = async () => {
      try {
        const fetchedLogs = await adminApi.getAuditLogs();
        if (Array.isArray(fetchedLogs) && fetchedLogs.length > 0) {
          const mapped: SystemAuditLog[] = fetchedLogs.map((l: any, idx) => ({
            id: l.id || `log-${idx}`,
            timestamp: l.time || new Date().toISOString(),
            actor: l.actor || 'admin@wareops.dev',
            role: 'ADMIN',
            eventType: l.action || 'SYSTEM_EVENT',
            resource: l.resource || 'Platform Resource',
            ip: '127.0.0.1',
            outcome: l.outcome === 'success' ? 'SUCCESS' : 'FAILURE',
          }));
          setLogsList(mapped);
        }
      } catch (err) {
        console.error('Failed to load audit logs:', err);
      }
    };

    loadAuditLogs();
  }, []);

  const filtered = useMemo(() => logsList.filter(log =>
    (search === '' || log.actor.toLowerCase().includes(search.toLowerCase()) || log.eventType.toLowerCase().includes(search.toLowerCase()) || log.resource.toLowerCase().includes(search.toLowerCase())) &&
    (eventTypeFilter.length === 0 || eventTypeFilter.includes(log.eventType)) &&
    (outcomeFilter === 'All' || log.outcome === outcomeFilter)
  ), [logsList, search, eventTypeFilter, outcomeFilter]);

  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  return (
    <div className="space-y-5">
      {showExport && <ExportModal onClose={() => setShowExport(false)} logs={filtered} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-purple-400 mb-1">Compliance</p>
          <h1 className="text-2xl font-bold text-slate-100">Audit Logs</h1>
          <p className="text-sm text-slate-500 mt-1">{filtered.length} compliance records indexed</p>
        </div>
        <button
          onClick={() => setShowExport(true)}
          className="flex items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-300 transition-all cursor-pointer w-full sm:w-auto"
        >
          <Download className="h-4 w-4" /> Export Compliance Package
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-3 items-center rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search actor, event or resource..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="rounded-xl bg-white/[0.04] border border-white/[0.08] pl-9 pr-4 py-2 text-sm text-slate-300 placeholder-slate-600 outline-none focus:border-indigo-500 transition-colors w-full"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {EVENT_TYPES.map(et => (
            <button
              key={et}
              onClick={() => setEventTypeFilter(prev => prev.includes(et) ? prev.filter(x => x !== et) : [...prev, et])}
              className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition-all cursor-pointer
                ${eventTypeFilter.includes(et) ? 'bg-indigo-600 text-white' : 'bg-white/[0.05] text-slate-400 hover:text-slate-200'}`}
            >
              {et}
            </button>
          ))}
        </div>
        <select
          value={outcomeFilter}
          onChange={e => setOutcomeFilter(e.target.value)}
          className="rounded-xl bg-[#080d1a] border border-white/[0.08] px-3 py-2 text-sm text-slate-300 outline-none focus:border-indigo-500 transition-colors ml-auto"
        >
          <option value="All">All Outcomes</option>
          <option value="SUCCESS">SUCCESS</option>
          <option value="FAILURE">FAILURE</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-white/[0.04]">
                {['Timestamp', 'Actor', 'Role', 'Event Type', 'Resource', 'IP Address', 'Outcome'].map(h => (
                  <th key={h} className="px-4 py-3.5 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageData.map(log => (
                <React.Fragment key={log.id}>
                  <tr
                    onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                    className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 text-slate-500">{log.timestamp}</td>
                    <td className="px-4 py-3 text-indigo-400 max-w-[160px] truncate">{log.actor}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold
                        ${log.role === 'ENTERPRISE_ADMIN' ? 'bg-purple-500/10 text-purple-400' :
                          log.role === 'WAREHOUSE_MANAGER' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-slate-800 text-slate-400'}`}>
                        {log.role.replace('WAREHOUSE_', '')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300 font-semibold">{log.eventType}</td>
                    <td className="px-4 py-3 text-slate-500 max-w-[180px] truncate">{log.resource}</td>
                    <td className="px-4 py-3 text-slate-600">{log.ip}</td>
                    <td className="px-4 py-3">
                      <span className={log.outcome === 'SUCCESS' ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                        {log.outcome === 'SUCCESS' ? '✓ SUCCESS' : '✕ FAILURE'}
                      </span>
                    </td>
                  </tr>
                  {expandedId === log.id && log.beforeState && (
                    <tr className="border-b border-white/[0.04] bg-white/[0.02]">
                      <td colSpan={7} className="px-6 py-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[10px] font-semibold text-red-400 uppercase tracking-widest mb-2">Before State</p>
                            <pre className="rounded-xl bg-red-500/5 border border-red-500/10 p-3 text-xs text-red-300 overflow-auto font-mono">
                              {JSON.stringify(log.beforeState, null, 2)}
                            </pre>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-widest mb-2">After State</p>
                            <pre className="rounded-xl bg-emerald-500/5 border border-emerald-500/10 p-3 text-xs text-emerald-300 overflow-auto font-mono">
                              {JSON.stringify(log.afterState, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-white/[0.04] px-6 py-4">
          <span className="text-xs text-slate-500 font-mono">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded-lg bg-white/[0.04] p-1.5 text-slate-500 hover:text-slate-300 disabled:opacity-30 transition-colors cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs text-slate-500 font-mono">{page + 1} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="rounded-lg bg-white/[0.04] p-1.5 text-slate-500 hover:text-slate-300 disabled:opacity-30 transition-colors cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
