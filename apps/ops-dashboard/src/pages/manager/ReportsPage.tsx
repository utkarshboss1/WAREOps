import React, { useState } from 'react';
import {
  FileText, Download, Play, Trash2, Edit2, Plus,
  Clock, Calendar, Table, FileJson, CheckCircle2
} from 'lucide-react';
import { exportToCsv } from '../../utils/exportCsv';
import { inventoryApi, alertsApi, missionsApi } from '../../api/client';

export interface ScheduledReport {
  id: string;
  name: string;
  frequency: string;
  nextRun: string;
  recipients: string;
  status: 'active' | 'paused';
}

export interface ReportHistoryItem {
  id: string;
  name: string;
  format: 'PDF' | 'CSV';
  generatedAt: string;
  size: string;
  status: 'completed';
}

const INITIAL_SCHEDULED_REPORTS: ScheduledReport[] = [
  { id: 'r1', name: 'Daily Inventory Summary', frequency: 'Daily', nextRun: 'Tomorrow 06:00', recipients: 'mgmt@warehouse.com, ops@warehouse.com', status: 'active' },
  { id: 'r2', name: 'Weekly Accuracy Report', frequency: 'Weekly (Mon)', nextRun: 'Jul 21, 06:00', recipients: 'manager@warehouse.com', status: 'active' },
  { id: 'r3', name: 'Mission Performance Digest', frequency: 'Weekly (Fri)', nextRun: 'Jul 18, 18:00', recipients: 'ops@warehouse.com, cto@company.com', status: 'paused' },
  { id: 'r4', name: 'Robot Health Report', frequency: 'Daily', nextRun: 'Tomorrow 07:30', recipients: 'robotops@warehouse.com', status: 'active' },
  { id: 'r5', name: 'Monthly Compliance Audit', frequency: 'Monthly (1st)', nextRun: 'Aug 01, 09:00', recipients: 'compliance@company.com, cfo@company.com', status: 'active' },
];

const INITIAL_REPORT_HISTORY: ReportHistoryItem[] = [
  { id: 'h1', name: 'Daily Inventory Summary', format: 'PDF', generatedAt: '2026-07-17 06:00', size: '2.4 MB', status: 'completed' },
  { id: 'h2', name: 'Weekly Accuracy Report', format: 'CSV', generatedAt: '2026-07-14 06:00', size: '840 KB', status: 'completed' },
  { id: 'h3', name: 'Mission Performance Digest', format: 'PDF', generatedAt: '2026-07-11 18:00', size: '3.1 MB', status: 'completed' },
  { id: 'h4', name: 'Robot Health Report', format: 'CSV', generatedAt: '2026-07-17 07:30', size: '512 KB', status: 'completed' },
  { id: 'h5', name: 'Monthly Compliance Audit', format: 'PDF', generatedAt: '2026-07-01 09:00', size: '8.7 MB', status: 'completed' },
];

const REPORT_TYPES = ['Daily Summary', 'Weekly Accuracy', 'Mission Report', 'Custom Audit'];

interface CreateReportModalProps {
  onClose: () => void;
  onCreate: (report: ScheduledReport) => void;
}

const CreateReportModal: React.FC<CreateReportModalProps> = ({ onClose, onCreate }) => {
  const [type, setType] = useState('Daily Summary');
  const [format, setFormat] = useState<'PDF' | 'CSV'>('PDF');
  const [scheduled, setScheduled] = useState(true);
  const [email, setEmail] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newRep: ScheduledReport = {
      id: `r-${Date.now()}`,
      name: type,
      frequency: scheduled ? 'Daily' : 'One-Time',
      nextRun: 'Tomorrow 08:00',
      recipients: email || 'ops@wareops.dev',
      status: 'active',
    };
    onCreate(newRep);
    
    // Download instant preview
    const headers = ['Report Title', 'Format', 'Created Date', 'Status'];
    const rows = [[newRep.name, format, new Date().toISOString(), 'GENERATED']];
    exportToCsv(`${newRep.name.toLowerCase().replace(/\s+/g, '_')}_export`, headers, rows);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="w-full max-w-lg rounded-2xl border border-white/[0.08] bg-[#0d1424] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.06] p-6">
          <h2 className="text-base font-semibold text-slate-100">Create New Report</h2>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Report Type</label>
            <div className="grid grid-cols-2 gap-2">
              {REPORT_TYPES.map(t => (
                <button
                  type="button"
                  key={t}
                  onClick={() => setType(t)}
                  className={`rounded-xl border p-3 text-sm font-medium text-left transition-all
                    ${type === t ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300' : 'border-white/[0.08] bg-white/[0.02] text-slate-400 hover:border-white/[0.15]'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Start Date</label>
              <input type="date" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full rounded-xl bg-white/[0.04] border border-white/[0.08] px-3 py-2.5 text-sm text-slate-300 outline-none focus:border-indigo-500 transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">End Date</label>
              <input type="date" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full rounded-xl bg-white/[0.04] border border-white/[0.08] px-3 py-2.5 text-sm text-slate-300 outline-none focus:border-indigo-500 transition-colors" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Format</label>
            <div className="flex gap-2">
              {(['PDF', 'CSV'] as const).map(f => (
                <button
                  type="button"
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all
                    ${format === f ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300' : 'border-white/[0.08] bg-white/[0.02] text-slate-500 hover:text-slate-300'}`}
                >
                  {f === 'PDF' ? <FileText className="h-4 w-4" /> : <Table className="h-4 w-4" />}
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Recipient Emails</label>
            <input
              type="email"
              placeholder="email1@company.com, email2@company.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full rounded-xl bg-white/[0.04] border border-white/[0.08] px-3 py-2.5 text-sm text-slate-300 placeholder-slate-600 outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <div className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
            <div>
              <p className="text-sm font-medium text-slate-300">Schedule Report</p>
              <p className="text-xs text-slate-500 mt-0.5">Automatically run on a recurring basis</p>
            </div>
            <button
              type="button"
              onClick={() => setScheduled(!scheduled)}
              className={`relative h-6 w-11 rounded-full transition-all duration-300 ${scheduled ? 'bg-indigo-600' : 'bg-white/10'}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all duration-300 ${scheduled ? 'left-5.5 translate-x-0.5' : 'left-0.5'}`} />
            </button>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-white/[0.06] p-6">
          <button type="button" onClick={onClose} className="rounded-xl border border-white/[0.08] px-5 py-2.5 text-sm font-semibold text-slate-400 hover:text-slate-200 transition-colors">Cancel</button>
          <button type="submit" className="rounded-xl bg-indigo-600 hover:bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors shadow-lg shadow-indigo-500/20">
            Generate Report
          </button>
        </div>
      </form>
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const [showModal, setShowModal] = useState(false);
  const [scheduledReports, setScheduledReports] = useState<ScheduledReport[]>(INITIAL_SCHEDULED_REPORTS);
  const [reportHistory, setReportHistory] = useState<ReportHistoryItem[]>(INITIAL_REPORT_HISTORY);
  const [runNowId, setRunNowId] = useState<string | null>(null);

  const handleRunNow = (report: ScheduledReport) => {
    setRunNowId(report.id);
    const headers = ['Report ID', 'Report Name', 'Frequency', 'Recipients', 'Generated At'];
    const rows = [[report.id, report.name, report.frequency, report.recipients, new Date().toISOString()]];
    exportToCsv(`${report.name.toLowerCase().replace(/\s+/g, '_')}_manual_run`, headers, rows);

    setTimeout(() => {
      setRunNowId(null);
      setReportHistory(prev => [
        {
          id: `h-${Date.now()}`,
          name: report.name,
          format: 'CSV',
          generatedAt: new Date().toLocaleString(),
          size: '1.1 MB',
          status: 'completed',
        },
        ...prev,
      ]);
    }, 1200);
  };

  const handleDeleteScheduled = (id: string) => {
    setScheduledReports(prev => prev.filter(r => r.id !== id));
  };

  const handleToggleStatus = (id: string) => {
    setScheduledReports(prev => prev.map(r => r.id === id ? { ...r, status: r.status === 'active' ? 'paused' : 'active' } : r));
  };

  return (
    <div className="space-y-6">
      {showModal && (
        <CreateReportModal
          onClose={() => setShowModal(false)}
          onCreate={(newRep) => setScheduledReports(prev => [newRep, ...prev])}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-400 mb-1">Reports</p>
          <h1 className="text-2xl font-bold text-slate-100">Report Management</h1>
          <p className="text-sm text-slate-500 mt-1">Schedule, manage, and export warehouse reports</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white transition-all shadow-lg shadow-indigo-500/20"
        >
          <Plus className="h-4 w-4" />
          Create Report
        </button>
      </div>

      {/* Quick Export */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6">
        <h2 className="text-sm font-semibold text-slate-300 mb-4">Quick Export</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={async () => {
              try {
                const items = await inventoryApi.searchInventory('');
                const headers = ['Bin Code', 'Zone', 'Aisle', 'Rack', 'State', 'Expected SKU', 'Observed SKU'];
                const rows = (items || []).map(i => [i.code, i.zone_id, i.aisle_id, i.rack_id, i.state, i.expected_sku || '', i.observed_sku || '']);
                exportToCsv('inventory_catalog_report', headers, rows);
              } catch (err) {
                console.error('Inventory export failed:', err);
              }
            }}
            className="flex items-center gap-2.5 rounded-xl border bg-gradient-to-r from-emerald-600/20 to-emerald-500/10 border-emerald-500/20 text-emerald-400 px-5 py-3 text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <span>📊</span> Export Inventory CSV
          </button>

          <button
            onClick={async () => {
              try {
                const alerts = await alertsApi.getAlerts();
                const headers = ['Alert ID', 'Type', 'Severity', 'Status', 'Bin Code', 'Title', 'Created At'];
                const rows = (alerts || []).map(a => [a.id, a.type, a.severity, a.status, a.bin_code, a.title, a.created_at]);
                exportToCsv('alert_logs_report', headers, rows);
              } catch (err) {
                console.error('Alerts export failed:', err);
              }
            }}
            className="flex items-center gap-2.5 rounded-xl border bg-gradient-to-r from-red-600/20 to-red-500/10 border-red-500/20 text-red-400 px-5 py-3 text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <span>📋</span> Export Alert Log
          </button>

          <button
            onClick={async () => {
              try {
                const missions = await missionsApi.getMissions();
                const headers = ['Mission ID', 'Name', 'Status', 'Target Bins', 'Progress %', 'Created At'];
                const rows = (missions || []).map(m => [m.id, m.name, m.status, m.bins_total, m.progress_percent, m.created_at]);
                exportToCsv('mission_logs_report', headers, rows);
              } catch (err) {
                console.error('Missions export failed:', err);
              }
            }}
            className="flex items-center gap-2.5 rounded-xl border bg-gradient-to-r from-indigo-600/20 to-indigo-500/10 border-indigo-500/20 text-indigo-400 px-5 py-3 text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <span>🤖</span> Export Mission Log
          </button>
        </div>
      </div>

      {/* Scheduled Reports */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-indigo-400" />
            <h2 className="text-sm font-semibold text-slate-200">Scheduled Reports</h2>
          </div>
          <span className="text-xs text-slate-500">{scheduledReports.length} reports</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.04]">
                {['Report Name', 'Frequency', 'Next Run', 'Recipients', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-6 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {scheduledReports.map(r => (
                <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-slate-500" />
                      <span className="text-sm font-medium text-slate-200">{r.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-mono text-slate-400">{r.frequency}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs text-slate-400">{r.nextRun}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs text-slate-500 max-w-[200px] truncate block">{r.recipients}</span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleToggleStatus(r.id)}
                      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold cursor-pointer transition-all
                        ${r.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'}`}
                    >
                      {r.status.toUpperCase()}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRunNow(r)}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all
                          ${runNowId === r.id ? 'bg-emerald-500/20 text-emerald-400' : 'bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20'}`}
                      >
                        <Play className="h-3 w-3" />
                        {runNowId === r.id ? 'Running...' : 'Run Now'}
                      </button>
                      <button
                        onClick={() => handleDeleteScheduled(r.id)}
                        className="rounded-lg bg-white/[0.04] p-1.5 text-slate-600 hover:text-red-400 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Report History */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-200">Report History</h2>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.04]">
                {['Report Name', 'Format', 'Generated At', 'Size', 'Status', 'Download'].map(h => (
                  <th key={h} className="px-6 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {reportHistory.map(r => (
                <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-slate-200">{r.name}</td>
                  <td className="px-6 py-4">
                    <span className={`flex items-center gap-1.5 text-xs font-semibold w-fit
                      ${r.format === 'PDF' ? 'text-red-400' : 'text-emerald-400'}`}>
                      {r.format === 'PDF' ? <FileText className="h-3.5 w-3.5" /> : <FileJson className="h-3.5 w-3.5" />}
                      {r.format}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-400 font-mono">{r.generatedAt}</td>
                  <td className="px-6 py-4 text-xs text-slate-500 font-mono">{r.size}</td>
                  <td className="px-6 py-4">
                    <span className="rounded-full bg-emerald-500/10 text-emerald-400 px-2.5 py-1 text-[10px] font-semibold">{r.status.toUpperCase()}</span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => {
                        const headers = ['Report Name', 'Format', 'Generated At', 'Status'];
                        const rows = [[r.name, r.format, r.generatedAt, r.status]];
                        exportToCsv(`${r.name.toLowerCase().replace(/\s+/g, '_')}_history`, headers, rows);
                      }}
                      className="flex items-center gap-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 hover:border-white/[0.15] transition-all"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
