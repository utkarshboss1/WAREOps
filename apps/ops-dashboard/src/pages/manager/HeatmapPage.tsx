import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { RefreshCw, ZoomIn, ZoomOut, Layers } from 'lucide-react';
import { warehousesApi, alertsApi } from '../../api/client';

const DEFAULT_WAREHOUSE_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

// ─── Types ─────────────────────────────────────────────────────────────────────
type HeatmapType = 'risk' | 'coverage' | 'alert' | 'traffic';
type TimeRange = 'today' | '7d' | '30d';

interface Cell {
  zone: string;
  aisle: number;
  rack: number;
  value: number;
  label: string;
}

// ─── Heatmap Config ────────────────────────────────────────────────────────────
const HEATMAP_CONFIG: Record<HeatmapType, { label: string; minColor: string; maxColor: string; minLabel: string; maxLabel: string }> = {
  risk:     { label: 'Inventory Risk',  minColor: '#10b981', maxColor: '#ef4444', minLabel: 'No Risk', maxLabel: 'High Risk' },
  coverage: { label: 'Scan Coverage',   minColor: '#1f2937', maxColor: '#3b82f6', minLabel: 'Unscanned', maxLabel: 'Full Coverage' },
  alert:    { label: 'Alert Density',   minColor: '#111827', maxColor: '#f97316', minLabel: 'No Alerts', maxLabel: 'High Density' },
  traffic:  { label: 'Robot Traffic',   minColor: '#0f172a', maxColor: '#8b5cf6', minLabel: 'No Traffic', maxLabel: 'High Traffic' },
};

// ─── Color interpolation ───────────────────────────────────────────────────────
function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function interpolateColor(t: number, minColor: string, maxColor: string): string {
  const [r1, g1, b1] = hexToRgb(minColor);
  const [r2, g2, b2] = hexToRgb(maxColor);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r},${g},${b})`;
}

// ─── Build heatmap cells from real twin snapshot + alerts ─────────────────────
function buildCellsFromTwin(
  binsDict: Record<string, any>,
  alerts: any[],
  type: HeatmapType,
): Cell[] {
  const rackMap: Record<string, { zone: string; aisle: number; rack: number; bins: any[] }> = {};

  Object.entries(binsDict).forEach(([binId, b]) => {
    const rackCode = b.rack_id || b.rack_code || 'Unknown';
    const aisleMatch = rackCode.match(/A(\d+)/i);
    const rackMatch = rackCode.match(/RK(\d+)/i);
    const aisleNum = aisleMatch ? parseInt(aisleMatch[1], 10) : 1;
    const rackNum = rackMatch ? parseInt(rackMatch[1], 10) : 1;
    const zone = b.zone_id || 'Main Zone';
    const key = `${zone}-${aisleNum}-${rackNum}`;
    if (!rackMap[key]) {
      rackMap[key] = { zone, aisle: aisleNum, rack: rackNum, bins: [] };
    }
    rackMap[key].bins.push({ ...b, bin_id: binId });
  });

  const alertBinIds = new Set(alerts.map((a) => a.bin_id).filter(Boolean));

  return Object.values(rackMap).map(({ zone, aisle, rack, bins }) => {
    const total = bins.length;
    const verified = bins.filter((b) => b.status === 'VERIFIED').length;
    const mismatches = bins.filter((b) => b.status === 'MISMATCH').length;
    const missing = bins.filter((b) => b.status === 'MISSING').length;
    const unscanned = bins.filter((b) => !b.status || b.status === 'UNSCANNED').length;
    const alertCount = bins.filter((b) => alertBinIds.has(b.bin_id)).length;

    let value = 0;
    if (type === 'risk') {
      value = total > 0 ? (mismatches + missing) / total : 0;
    } else if (type === 'coverage') {
      value = total > 0 ? (verified + mismatches) / total : 0;
    } else if (type === 'alert') {
      value = Math.min(1, alertCount / Math.max(total, 1));
    } else {
      value = total > 0 ? verified / total : 0;
    }

    return {
      zone,
      aisle,
      rack,
      value: Math.min(1, Math.max(0, value)),
      label: `${zone} · Aisle ${aisle} · Rack ${rack}`,
    };
  });
}

// ─── SVG Heatmap ───────────────────────────────────────────────────────────────
const CELL_W = 22;
const CELL_H = 14;
const CELL_GAP = 2;
const ZONE_GAP = 30;
const AISLE_GAP = 8;
const MARGIN = { top: 40, left: 50, right: 20, bottom: 20 };
const AISLES = 5;
const RACKS = 8;

function getZoneOrigin(zoneIdx: number): { x: number; y: number } {
  const zoneWidth = AISLES * (CELL_W + CELL_GAP) + (AISLES - 1) * AISLE_GAP;
  return {
    x: MARGIN.left + zoneIdx * (zoneWidth + ZONE_GAP),
    y: MARGIN.top,
  };
}

const SVG_WIDTH = MARGIN.left + 3 * (AISLES * (CELL_W + CELL_GAP) + (AISLES - 1) * AISLE_GAP + ZONE_GAP) + MARGIN.right;
const SVG_HEIGHT = MARGIN.top + RACKS * (CELL_H + CELL_GAP) + MARGIN.bottom + 20;

interface TooltipState {
  x: number;
  y: number;
  cell: Cell & { displayValue: string };
}

export default function HeatmapPage() {
  const [heatmapType, setHeatmapType] = useState<HeatmapType>('risk');
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rawBins, setRawBins] = useState<Record<string, any>>({});
  const [alerts, setAlerts] = useState<any[]>([]);
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, scale: 1 });
  const svgRef = useRef<SVGSVGElement>(null);

  const loadData = useCallback(async () => {
    setRefreshing(true);
    try {
      const [snapshot, alertsList] = await Promise.all([
        warehousesApi.getTwinSnapshot(DEFAULT_WAREHOUSE_ID).catch(() => null),
        alertsApi.getAlerts().catch(() => []),
      ]);
      setRawBins(snapshot?.bins || {});
      setAlerts(alertsList as any[]);
    } catch (err) {
      console.error('Heatmap load failed:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const cells = useMemo(
    () => buildCellsFromTwin(rawBins, alerts, heatmapType),
    [rawBins, alerts, heatmapType],
  );

  const zoneNames = useMemo(() => [...new Set(cells.map((c) => c.zone))], [cells]);
  const maxAisle = useMemo(() => Math.max(1, ...cells.map((c) => c.aisle)), [cells]);
  const maxRack = useMemo(() => Math.max(1, ...cells.map((c) => c.rack)), [cells]);

  const config = HEATMAP_CONFIG[heatmapType];

  const getDisplayValue = (cell: Cell): string => {
    switch (heatmapType) {
      case 'risk': return `${(cell.value * 100).toFixed(0)}% risk`;
      case 'coverage': return `${(cell.value * 100).toFixed(0)}% scanned`;
      case 'alert': return `${Math.round(cell.value * 12)} alerts`;
      case 'traffic': return `${Math.round(cell.value * 40)} passes`;
    }
  };

  const handleRefresh = () => {
    loadData();
  };

  const handleZoom = (dir: 'in' | 'out' | 'reset') => {
    setViewBox(prev => ({
      ...prev,
      scale: dir === 'reset' ? 1 : dir === 'in' ? Math.min(2.5, prev.scale + 0.25) : Math.max(0.5, prev.scale - 0.25),
    }));
  };

  const ZONE_COLORS = ['rgba(99,102,241,0.08)', 'rgba(16,185,129,0.08)', 'rgba(245,158,11,0.08)'];
  const ZONE_BORDER_COLORS = ['rgba(99,102,241,0.3)', 'rgba(16,185,129,0.3)', 'rgba(245,158,11,0.3)'];
  const ZONE_NAMES = zoneNames.length > 0 ? zoneNames : ['Main Zone'];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080c14] p-6 flex items-center justify-center">
        <div className="text-slate-400 text-sm">Loading heatmap from digital twin...</div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-400 mb-1">Visualization</p>
          <h1 className="text-2xl font-bold text-slate-100">Warehouse Heatmap</h1>
          <p className="text-sm text-slate-500 mt-1">Interactive floor plan visualization by selected metric</p>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-2 rounded-xl bg-white/[0.04] border border-white/[0.08] px-4 py-2 text-sm text-slate-400 hover:text-slate-200 hover:border-white/[0.15] transition-all"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-4 items-center">
        {/* Type Selector */}
        <div className="flex gap-1 rounded-xl bg-white/[0.03] border border-white/[0.06] p-1">
          {(Object.entries(HEATMAP_CONFIG) as [HeatmapType, typeof HEATMAP_CONFIG[HeatmapType]][]).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => setHeatmapType(key)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-300
                ${heatmapType === key ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-500 hover:text-slate-300'}`}
            >
              {cfg.label}
            </button>
          ))}
        </div>

        {/* Time Range */}
        <div className="flex gap-1 rounded-xl bg-white/[0.03] border border-white/[0.06] p-1">
          {([['today', 'Today'], ['7d', 'Last 7 Days'], ['30d', 'Last 30 Days']] as [TimeRange, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTimeRange(key)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-300
                ${timeRange === key ? 'bg-white/10 text-slate-200' : 'text-slate-500 hover:text-slate-300'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Zoom Controls */}
        <div className="flex gap-1 ml-auto">
          {[['in', ZoomIn], ['out', ZoomOut], ['reset', Layers]].map(([action, Icon]: any) => (
            <button
              key={action}
              onClick={() => handleZoom(action)}
              className="rounded-lg bg-white/[0.04] border border-white/[0.08] p-2 text-slate-400 hover:text-slate-200 hover:border-white/[0.15] transition-all"
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>

      {/* SVG Heatmap Canvas */}
      <div className="relative rounded-2xl border border-white/[0.06] bg-[#060a12] overflow-hidden">
        <div className="overflow-auto" style={{ maxHeight: '520px' }}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
            style={{
              width: `${SVG_WIDTH * viewBox.scale}px`,
              height: `${SVG_HEIGHT * viewBox.scale}px`,
              minWidth: '100%',
              transition: 'width 0.3s ease, height 0.3s ease',
            }}
            className="select-none"
          >
            {/* Background grid */}
            <defs>
              <pattern id="hm-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width={SVG_WIDTH} height={SVG_HEIGHT} fill="url(#hm-grid)" />

            {/* Zone Backgrounds + Labels */}
            {ZONE_NAMES.map((zoneName, zoneIdx) => {
              const { x, y } = getZoneOrigin(zoneIdx);
              const zoneWidth = AISLES * (CELL_W + CELL_GAP + AISLE_GAP) - AISLE_GAP;
              const zoneHeight = RACKS * (CELL_H + CELL_GAP) - CELL_GAP;
              return (
                <g key={zoneName}>
                  <rect
                    x={x - 6} y={y - 20}
                    width={zoneWidth + 12} height={zoneHeight + 28}
                    rx={6} fill={ZONE_COLORS[zoneIdx]}
                    stroke={ZONE_BORDER_COLORS[zoneIdx]} strokeWidth={1}
                  />
                  <text x={x + zoneWidth / 2 - 6} y={y - 6} textAnchor="middle" fill={`rgba(255,255,255,0.5)`} fontSize="10" fontWeight="600" letterSpacing="1">
                    {zoneName.toUpperCase()}
                  </text>
                  {/* Aisle labels */}
                  {Array.from({ length: AISLES }, (_, a) => (
                    <text
                      key={a}
                      x={x + a * (CELL_W + CELL_GAP + AISLE_GAP) + CELL_W / 2}
                      y={y + zoneHeight + 18}
                      textAnchor="middle"
                      fill="rgba(255,255,255,0.25)"
                      fontSize="8"
                    >
                      A{a + 1}
                    </text>
                  ))}
                </g>
              );
            })}

            {/* Rack number labels */}
            {Array.from({ length: RACKS }, (_, r) => (
              <text
                key={r}
                x={MARGIN.left - 10}
                y={MARGIN.top + r * (CELL_H + CELL_GAP) + CELL_H / 2 + 4}
                textAnchor="end"
                fill="rgba(255,255,255,0.2)"
                fontSize="8"
              >
                R{r + 1}
              </text>
            ))}

            {/* Cells */}
            {cells.map((cell, idx) => {
              const zoneIdx = ZONE_NAMES.indexOf(cell.zone);
              if (zoneIdx < 0) return null;
              const { x: ox, y: oy } = getZoneOrigin(zoneIdx);
              const cx = ox + (cell.aisle - 1) * (CELL_W + CELL_GAP + AISLE_GAP);
              const cy = oy + (cell.rack - 1) * (CELL_H + CELL_GAP);
              const color = interpolateColor(cell.value, config.minColor, config.maxColor);
              return (
                <rect
                  key={idx}
                  x={cx} y={cy}
                  width={CELL_W} height={CELL_H}
                  rx={2}
                  fill={color}
                  opacity={0.85}
                  stroke="rgba(0,0,0,0.3)"
                  strokeWidth={0.5}
                  className="cursor-pointer transition-opacity hover:opacity-100"
                  onMouseEnter={(e) => {
                    const rect = (e.target as SVGRectElement).getBoundingClientRect();
                    const parentRect = svgRef.current?.parentElement?.getBoundingClientRect();
                    setTooltip({
                      x: rect.left - (parentRect?.left || 0) + rect.width / 2,
                      y: rect.top - (parentRect?.top || 0) - 8,
                      cell: { ...cell, displayValue: getDisplayValue(cell) },
                    });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                />
              );
            })}

            {/* Robot dots (traffic mode) */}
            {heatmapType === 'traffic' && [
              { x: getZoneOrigin(0).x + 20, y: getZoneOrigin(0).y + 40 },
              { x: getZoneOrigin(1).x + 50, y: getZoneOrigin(1).y + 60 },
            ].map((dot, idx) => (
              <g key={idx}>
                <circle cx={dot.x} cy={dot.y} r={8} fill="rgba(139,92,246,0.2)" className="animate-ping" />
                <circle cx={dot.x} cy={dot.y} r={4} fill="#8b5cf6" stroke="white" strokeWidth={1} />
              </g>
            ))}
          </svg>
        </div>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="pointer-events-none absolute z-20 rounded-lg border border-white/10 bg-[#0d1424] px-3 py-2 shadow-xl text-xs"
            style={{ left: tooltip.x, top: tooltip.y, transform: 'translate(-50%, -100%)' }}
          >
            <p className="font-semibold text-slate-200">{tooltip.cell.label}</p>
            <p className="text-indigo-400 font-bold mt-0.5">{tooltip.cell.displayValue}</p>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 rounded-xl bg-white/[0.02] border border-white/[0.06] p-4">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Scale</span>
        <span className="text-xs text-slate-500">{config.minLabel}</span>
        <div
          className="flex-1 h-3 rounded-full"
          style={{
            background: `linear-gradient(to right, ${config.minColor}, ${config.maxColor})`,
          }}
        />
        <span className="text-xs text-slate-500">{config.maxLabel}</span>
        <div className="ml-4 flex gap-3">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#8b5cf6] animate-pulse" />
            <span className="text-xs text-slate-500">Active Robot</span>
          </div>
        </div>
      </div>
    </div>
  );
}
