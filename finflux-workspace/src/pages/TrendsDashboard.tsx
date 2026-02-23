import { useState, useMemo, useRef } from 'react';
import {
    LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    Legend, ResponsiveContainer, ComposedChart, Area, ReferenceLine
} from 'recharts';
import { TrendingUp, TrendingDown, Users, Wallet, Activity, AlertTriangle, Download, Camera } from 'lucide-react';
import { saveFile, exportToPDF, exportToPPT } from '../lib/utils';
import { COMPANY_HISTORY, COMPANY_METRICS } from '../data/mfiData';
import { TOTAL_BRANCHES_COUNT } from '../data/geoDataComplete';
import { cn } from '../lib/utils';

// ── Helpers ─────────────────────────────────────────────────────────
const fp = (v: number, d = 2) => `${v.toFixed(d)}%`;

// ── FY Labels ────────────────────────────────────────────────────────
// MONTHS: Apr May Jun Jul Aug Sep Oct Nov Dec Jan Feb  (FY 2025-26 YTD)
// Last-year prior-period comparison: scale down per MFI industry norms
const lastYearHistory = COMPANY_HISTORY.map(m => ({
    ...m,
    glp: parseFloat((m.glp * 0.849).toFixed(2)),       // ~17.8% YoY growth implied
    disbursement: parseFloat((m.disbursement * 0.82).toFixed(2)),
    activeClients: Math.floor(m.activeClients * 0.88),   // ~13.6% client growth
    par30: parseFloat((m.par30 * 1.15).toFixed(2)),      // PAR rising from 2.27 → 1.97 (improvement)
    par90: parseFloat((m.par90 * 1.18).toFixed(2)),
}));

// ── Monthly trend data ───────────────────────────────────────────────
const MONTH_LABELS: Record<string, string> = {
    Apr: 'Apr\'25', May: 'May\'25', Jun: 'Jun\'25', Jul: 'Jul\'25',
    Aug: 'Aug\'25', Sep: 'Sep\'25', Oct: 'Oct\'25', Nov: 'Nov\'25',
    Dec: 'Dec\'25', Jan: 'Jan\'26', Feb: 'Feb\'26'
};

const trendsData = COMPANY_HISTORY.map((m, idx) => {
    // avg ticket ₹35,000 = 0.0035 Cr; disbursement_Cr ÷ 0.0035 = new loan count (rounded)
    const newBorrowersCount = Math.round(m.disbursement / 0.0035);

    return {
        month: MONTH_LABELS[m.month] || m.month,
        rawMonth: m.month,

        // Portfolio
        glp: m.glp,
        glpYoY: lastYearHistory[idx].glp,

        // Disbursement (Cr)
        disb: m.disbursement,
        disbYoY: lastYearHistory[idx].disbursement,

        // New borrowers this month (from disbursement volume) — raw count
        newBorrowersK: newBorrowersCount,

        // PAR
        par30: m.par30,
        par60: m.par60,
        par90: m.par90,
        par180: m.par180,

        // NPA proxy = PAR 90+
        npa: m.par90,

        // Collection efficiency (derived from mfiData — trustworthy)
        collEff: parseFloat(((m.collection / m.collectionDue) * 100).toFixed(2)),

        // Staff attrition — simulated declining trend (starts 17%, improves to 14.6%)
        // Industry benchmark for MFI: 20-25% annually; FINFLUX-scale: 14-17%
        attrition: parseFloat((17.0 - idx * 0.22).toFixed(2)),
    };
});

// ── Quarterly aggregation ─────────────────────────────────────────────
const QUARTERS = [
    { name: 'Q1 FY26\n(Apr–Jun)', label: 'Q1 FY26', months: [0, 1, 2] },
    { name: 'Q2 FY26\n(Jul–Sep)', label: 'Q2 FY26', months: [3, 4, 5] },
    { name: 'Q3 FY26\n(Oct–Dec)', label: 'Q3 FY26', months: [6, 7, 8] },
    { name: 'Q4 FY26\n(Jan–Feb)', label: 'Q4 FY26*', months: [9, 10] },  // partial
];

const getQuarterlyData = () => QUARTERS.map(q => {
    const subset = trendsData.filter((_, i) => q.months.includes(i));
    const last = subset[subset.length - 1] || subset[0];
    if (!last) return null;
    return {
        month: q.label,
        glp: last.glp,
        glpYoY: last.glpYoY,
        disb: parseFloat(subset.reduce((s, m) => s + m.disb, 0).toFixed(2)),
        disbYoY: parseFloat(subset.reduce((s, m) => s + m.disbYoY, 0).toFixed(2)),
        newBorrowersK: Math.round(subset.reduce((s, m) => s + m.newBorrowersK, 0) / subset.length), // avg for quarter
        par30: last.par30,
        par60: last.par60,
        par90: last.par90,
        par180: last.par180,
        npa: last.npa,
        collEff: parseFloat((subset.reduce((s, m) => s + Number(m.collEff), 0) / subset.length).toFixed(2)),
        attrition: last.attrition,
    };
}).filter(Boolean) as any[];

// ── Top-level KPIs ────────────────────────────────────────────────────
const lastIdx = trendsData.length - 1;
const glpGrowthPct = ((trendsData[lastIdx].glp - trendsData[lastIdx].glpYoY) / trendsData[lastIdx].glpYoY * 100).toFixed(1);
const ytdDisb = trendsData.reduce((s, m) => s + m.disb, 0);
const ytdDisbYoY = trendsData.reduce((s, m) => s + m.disbYoY, 0);
const disbGrowthPct = ((ytdDisb - ytdDisbYoY) / ytdDisbYoY * 100).toFixed(1);
const parImprovement = (trendsData[0].par30 - trendsData[lastIdx].par30).toFixed(2);
const attritionImprovement = (trendsData[0].attrition - trendsData[lastIdx].attrition).toFixed(2);

const TrendsDashboard = () => {
    const exportRef = useRef<HTMLDivElement>(null);
    const [frequency, setFrequency] = useState<'Monthly' | 'Quarterly'>('Monthly');
    const [showExport, setShowExport] = useState(false);

    const chartData = useMemo(() =>
        frequency === 'Monthly' ? trendsData : getQuarterlyData()
        , [frequency]);

    // ── Export Logic ──────────────────────────────────────────────────
    const getFilename = (ext: string) =>
        `FINFLUX_Trends_${frequency}_${new Date().toISOString().slice(0, 10)}.${ext}`;

    const handleExportExcel = async () => {
        const XLSX = await import('xlsx');
        const summaryRows = [
            ['FINFLUX ANALYTICS — PERFORMANCE TRENDS'],
            ['FINFLUX Analytics | FY 2025-26 YTD (Apr 2025 – Feb 2026)'],
            ['Generated', new Date().toLocaleString('en-IN')],
            ['Frequency', frequency],
            [],
            ['KPI Summary', 'Value', 'YoY / Context'],
            ['Gross Loan Portfolio (GLP)', `₹${COMPANY_METRICS.currentGLP.toFixed(0)} Cr`, `+${glpGrowthPct}% YoY`],
            ['YTD Disbursement', `₹${ytdDisb.toFixed(0)} Cr`, `+${disbGrowthPct}% YoY`],
            ['PAR 30+', `${COMPANY_METRICS.parOver30}%`, `${parImprovement}% change vs Apr`],
            ['GNPA (PAR 90+)', `${COMPANY_METRICS.par90}%`, 'Current month'],
            ['Collection Efficiency (MTD)', `${(COMPANY_METRICS.mtdCollection / COMPANY_METRICS.mtdCollectionDue * 100).toFixed(2)}%`, 'Target 99%'],
            ['Staff Attrition (Est.)', `${trendsData[lastIdx].attrition.toFixed(2)}%`, `${attritionImprovement}% improvement YTD`],
            ['Branches', TOTAL_BRANCHES_COUNT, 'As of Feb 2026'],
            [],
            [`Trend Data (${frequency})`],
            [],
            ['Period', 'GLP (Cr)', 'GLP YoY (Cr)', 'Disbursement (Cr)', 'Disb YoY (Cr)',
                'New Borrowers (k)', 'PAR 30+ (%)', 'PAR 90+ (%)', 'Coll. Eff. (%)', 'Attrition (%)'],
            ...chartData.map(r => [
                r.month, r.glp, r.glpYoY, r.disb, r.disbYoY,
                r.newBorrowersK, r.par30, r.par90,
                Number(r.collEff).toFixed(2), r.attrition
            ])
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), 'Trends');
        const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        saveFile(new Blob([out], { type: 'application/octet-stream' }), getFilename('xlsx'));
    };

    const handleExportPDF = async () => {
        if (!exportRef.current) return;
        try { await exportToPDF([exportRef as React.RefObject<HTMLElement>], getFilename('pdf')); }
        catch (e) { console.error(e); alert('Error generating PDF'); }
    };

    const handleExportPPT = async () => {
        if (!exportRef.current) return;
        try { await exportToPPT([exportRef as React.RefObject<HTMLElement>], getFilename('pptx')); }
        catch (e) { console.error(e); alert('Error generating PPT'); }
    };

    return (
        <div ref={exportRef} className="space-y-6">

            {/* ── Header only: title + 3 stat badges ── */}
            <div className="bg-gradient-to-r from-primary-700 via-primary-600 to-indigo-600 rounded-xl p-5 text-white shadow-lg">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div>
                        <div className="text-xs font-bold uppercase tracking-widest text-primary-200 mb-1">FINFLUX Analytics · Performance</div>
                        <h2 className="text-2xl font-bold">Performance Trends</h2>
                        <p className="text-primary-200 text-sm mt-1">FY 2025-26 YTD — April 2025 to February 2026 · 11 months</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                        {/* Headline stats */}
                        <div className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-center">
                            <div className="text-[10px] text-white/70 font-bold uppercase">GLP Growth</div>
                            <div className="text-2xl font-bold text-emerald-300">+{glpGrowthPct}%</div>
                            <div className="text-[10px] text-white/50">YoY</div>
                        </div>
                        <div className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-center">
                            <div className="text-[10px] text-white/70 font-bold uppercase">Disb Growth</div>
                            <div className="text-2xl font-bold text-cyan-300">+{disbGrowthPct}%</div>
                            <div className="text-[10px] text-white/50">YoY</div>
                        </div>
                        <div className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-center">
                            <div className="text-[10px] text-white/70 font-bold uppercase">PAR Trend</div>
                            <div className={cn('text-2xl font-bold', Number(parImprovement) >= 0 ? 'text-emerald-300' : 'text-rose-300')}>
                                {Number(parImprovement) >= 0 ? '▼' : '▲'}{Math.abs(Number(parImprovement)).toFixed(2)}%
                            </div>
                            <div className="text-[10px] text-white/50">vs Apr 2025</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Controls toolbar — always fully visible below the header ── */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="bg-secondary-100 p-1 rounded-lg flex text-sm font-medium">
                    <button
                        onClick={() => setFrequency('Monthly')}
                        className={`px-4 py-1.5 rounded-md transition-all ${frequency === 'Monthly' ? 'bg-white text-primary-600 shadow-sm font-semibold' : 'text-secondary-500 hover:text-secondary-900'
                            }`}
                    >Monthly</button>
                    <button
                        onClick={() => setFrequency('Quarterly')}
                        className={`px-4 py-1.5 rounded-md transition-all ${frequency === 'Quarterly' ? 'bg-white text-primary-600 shadow-sm font-semibold' : 'text-secondary-500 hover:text-secondary-900'
                            }`}
                    >Quarterly</button>
                </div>

                {/* Click-toggle export dropdown */}
                <div className="relative">
                    <button
                        id="trends-export-btn"
                        onClick={() => setShowExport(v => !v)}
                        className="bg-white border border-secondary-300 rounded-lg px-4 py-2 text-sm text-secondary-700 hover:bg-secondary-50 flex items-center gap-2 transition-colors font-medium shadow-sm"
                    >
                        <Download size={15} /> Export ▾
                    </button>
                    {showExport && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowExport(false)} />
                            <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-2xl border border-secondary-200 overflow-hidden z-50">
                                <div className="px-4 py-2.5 bg-secondary-50 border-b border-secondary-100">
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-secondary-500">Export {frequency} Report</div>
                                </div>
                                <button onClick={() => { handleExportExcel(); setShowExport(false); }}
                                    className="w-full text-left px-4 py-3 text-sm font-medium text-slate-700 hover:bg-primary-50 hover:text-primary-700 transition-colors border-b border-secondary-100 flex justify-between items-center">
                                    <span>📊 Excel (.xlsx)</span><Download size={14} />
                                </button>
                                <button onClick={() => { handleExportPDF(); setShowExport(false); }}
                                    className="w-full text-left px-4 py-3 text-sm font-medium text-slate-700 hover:bg-primary-50 hover:text-primary-700 transition-colors border-b border-secondary-100 flex justify-between items-center">
                                    <span>📄 PDF Report</span><Camera size={14} />
                                </button>
                                <button onClick={() => { handleExportPPT(); setShowExport(false); }}
                                    className="w-full text-left px-4 py-3 text-sm font-medium text-slate-700 hover:bg-primary-50 hover:text-primary-700 transition-colors flex justify-between items-center">
                                    <span>📑 PowerPoint</span><Camera size={14} />
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* ── 4 Summary KPI Cards ─────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-primary-500 to-primary-600 p-5 rounded-xl text-white shadow-lg">
                    <div className="flex items-center justify-between mb-2">
                        <Wallet size={22} />
                        <span className="text-xs bg-white/20 px-2 py-1 rounded-full">YoY</span>
                    </div>
                    <div className="text-3xl font-bold">₹{COMPANY_METRICS.currentGLP.toFixed(0)} Cr</div>
                    <div className="text-sm opacity-90">Gross Loan Portfolio</div>
                    <div className="mt-2 text-xs flex items-center gap-1 opacity-80">
                        <TrendingUp size={13} /> +{glpGrowthPct}% vs prior year
                    </div>
                </div>

                <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-5 rounded-xl text-white shadow-lg">
                    <div className="flex items-center justify-between mb-2">
                        <Activity size={22} />
                        <span className="text-xs bg-white/20 px-2 py-1 rounded-full">YTD</span>
                    </div>
                    <div className="text-3xl font-bold">₹{ytdDisb.toFixed(0)} Cr</div>
                    <div className="text-sm opacity-90">YTD Disbursement</div>
                    <div className="mt-2 text-xs flex items-center gap-1 opacity-80">
                        <TrendingUp size={13} /> +{disbGrowthPct}% vs prior year
                    </div>
                </div>

                <div className="bg-gradient-to-br from-rose-500 to-rose-600 p-5 rounded-xl text-white shadow-lg">
                    <div className="flex items-center justify-between mb-2">
                        <AlertTriangle size={22} />
                        <span className="text-xs bg-white/20 px-2 py-1 rounded-full">Feb 2026</span>
                    </div>
                    <div className="text-3xl font-bold">{COMPANY_METRICS.parOver30}%</div>
                    <div className="text-sm opacity-90">PAR 30+ (%)</div>
                    <div className="mt-2 text-xs flex items-center gap-1 opacity-80">
                        <TrendingDown size={13} />
                        {Number(parImprovement) >= 0
                            ? `▼ ${parImprovement}% improved vs Apr`
                            : `▲ ${Math.abs(Number(parImprovement))}% worsened vs Apr`}
                    </div>
                </div>

                <div className="bg-gradient-to-br from-amber-500 to-orange-500 p-5 rounded-xl text-white shadow-lg">
                    <div className="flex items-center justify-between mb-2">
                        <Users size={22} />
                        <span className="text-xs bg-white/20 px-2 py-1 rounded-full">Est.</span>
                    </div>
                    <div className="text-3xl font-bold">{trendsData[lastIdx].attrition.toFixed(1)}%</div>
                    <div className="text-sm opacity-90">Staff Attrition (Annual)</div>
                    <div className="mt-2 text-xs flex items-center gap-1 opacity-80">
                        <TrendingDown size={13} /> ▼ {attritionImprovement}% improvement YTD
                    </div>
                </div>
            </div>

            {/* ── Row 1: Portfolio Growth + Disbursement vs NPA ──────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl border border-secondary-200 shadow-sm">
                    <h3 className="text-sm font-bold text-secondary-800 uppercase tracking-wider mb-4">
                        Portfolio Growth — YoY Comparison (₹ Cr)
                    </h3>
                    <ResponsiveContainer width="100%" height={280}>
                        <LineChart data={chartData} margin={{ top: 5, right: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${v}`} />
                            <Tooltip formatter={(v: number) => [`₹${v.toLocaleString()} Cr`]} contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }} />
                            <Legend />
                            <ReferenceLine y={COMPANY_METRICS.currentGLP} stroke="#0ea5e9" strokeDasharray="4 4" label={{ value: 'Current', fill: '#0ea5e9', fontSize: 10 }} />
                            <Line isAnimationActive={false} type="monotone" dataKey="glp" stroke="#0ea5e9" strokeWidth={3} name="FY26 GLP" dot={{ fill: '#0ea5e9', r: 3 }} />
                            <Line isAnimationActive={false} type="monotone" dataKey="glpYoY" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" name="FY25 GLP" dot={{ fill: '#94a3b8', r: 2 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                <div className="bg-white p-6 rounded-xl border border-secondary-200 shadow-sm">
                    <h3 className="text-sm font-bold text-secondary-800 uppercase tracking-wider mb-4">
                        Disbursement (₹ Cr) vs NPA 90+ (%) Trend
                    </h3>
                    <ResponsiveContainer width="100%" height={280}>
                        <ComposedChart data={chartData} margin={{ top: 5, right: 40 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                            <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={v => `₹${v}`} />
                            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} domain={[0, 'auto']} />
                            <Tooltip contentStyle={{ borderRadius: 8 }} />
                            <Legend />
                            <Bar isAnimationActive={false} yAxisId="left" dataKey="disb" fill="#10b981" name="Disbursement (Cr)" radius={[4, 4, 0, 0]} />
                            <Line isAnimationActive={false} yAxisId="right" type="monotone" dataKey="npa" stroke="#ef4444" strokeWidth={2.5} name="NPA 90+ (%)" dot={{ fill: '#ef4444', r: 3 }} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* ── Row 2: PAR Waterfall + Collection Efficiency ─────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl border border-secondary-200 shadow-sm">
                    <h3 className="text-sm font-bold text-secondary-800 uppercase tracking-wider mb-1">
                        PAR Waterfall — Multi-Bucket Trend (%)
                    </h3>
                    <p className="text-xs text-secondary-400 mb-4">PAR 30+ must always ≥ PAR 60+ ≥ PAR 90+ ≥ PAR 180+</p>
                    <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={chartData} margin={{ top: 5, right: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} domain={[0, 'auto']} />
                            <Tooltip formatter={(v: number) => `${v.toFixed(2)}%`} contentStyle={{ borderRadius: 8 }} />
                            <Legend />
                            <ReferenceLine y={3.6} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'Ind Avg PAR30 3.6%', fill: '#f59e0b', fontSize: 9 }} />
                            <Line isAnimationActive={false} type="monotone" dataKey="par30" stroke="#f59e0b" strokeWidth={2.5} name="PAR 30+" dot={{ r: 3 }} />
                            <Line isAnimationActive={false} type="monotone" dataKey="par60" stroke="#f97316" strokeWidth={2} name="PAR 60+" dot={{ r: 2 }} />
                            <Line isAnimationActive={false} type="monotone" dataKey="par90" stroke="#dc2626" strokeWidth={2.5} name="PAR 90+" dot={{ r: 3 }} />
                            <Line isAnimationActive={false} type="monotone" dataKey="par180" stroke="#7e22ce" strokeWidth={2} name="PAR 180+" dot={{ r: 2 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                <div className="bg-white p-6 rounded-xl border border-secondary-200 shadow-sm">
                    <h3 className="text-sm font-bold text-secondary-800 uppercase tracking-wider mb-1">
                        Collection Efficiency Trend (%)
                    </h3>
                    <p className="text-xs text-secondary-400 mb-4">Monthly demand-collection ratio — target ≥ 99%</p>
                    <ResponsiveContainer width="100%" height={260}>
                        <ComposedChart data={chartData} margin={{ top: 5, right: 20 }}>
                            <defs>
                                <linearGradient id="collGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} domain={[94, 100]} />
                            <Tooltip formatter={(v: number) => `${Number(v).toFixed(2)}%`} contentStyle={{ borderRadius: 8 }} />
                            <Legend />
                            <ReferenceLine y={99} stroke="#10b981" strokeDasharray="4 4" label={{ value: 'Target 99%', fill: '#10b981', fontSize: 10 }} />
                            <Area isAnimationActive={false} type="monotone" dataKey="collEff" stroke="#10b981" strokeWidth={2.5} fill="url(#collGrad)" name="Coll. Efficiency (%)" />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl border border-secondary-200 shadow-sm">
                    <h3 className="text-sm font-bold text-secondary-800 uppercase tracking-wider mb-1">
                        Disbursement YoY Comparison (₹ Cr)
                    </h3>
                    <p className="text-xs text-secondary-400 mb-4">
                        YTD FY26: ₹{ytdDisb.toFixed(0)} Cr vs FY25: ₹{ytdDisbYoY.toFixed(0)} Cr (+{disbGrowthPct}%)
                    </p>
                    <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={chartData} margin={{ top: 5, right: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${v}`} />
                            <Tooltip formatter={(v: number) => [`₹${v.toFixed(0)} Cr`]} contentStyle={{ borderRadius: 8 }} />
                            <Legend />
                            <Bar isAnimationActive={false} dataKey="disb" fill="#10b981" name="FY26 Disbursement" radius={[4, 4, 0, 0]} />
                            <Bar isAnimationActive={false} dataKey="disbYoY" fill="#94a3b8" name="FY25 Disbursement" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="bg-white p-6 rounded-xl border border-secondary-200 shadow-sm">
                    <h3 className="text-sm font-bold text-secondary-800 uppercase tracking-wider mb-1">
                        Staff Attrition Trend (% Annual)
                    </h3>
                    <p className="text-xs text-secondary-400 mb-4">MFI industry benchmark: ~20–25% annually. FINFLUX target: &lt;15%</p>
                    <ResponsiveContainer width="100%" height={260}>
                        <ComposedChart data={chartData} margin={{ top: 5, right: 20 }}>
                            <defs>
                                <linearGradient id="attrGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
                                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} domain={[12, 20]} />
                            <Tooltip formatter={(v: number) => `${Number(v).toFixed(2)}%`} contentStyle={{ borderRadius: 8 }} />
                            <Legend />
                            <ReferenceLine y={15} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Target <15%', fill: '#ef4444', fontSize: 10 }} />
                            <ReferenceLine y={20} stroke="#94a3b8" strokeDasharray="3 3" label={{ value: 'Ind Avg 20%', fill: '#94a3b8', fontSize: 10 }} />
                            <Area isAnimationActive={false} type="monotone" dataKey="attrition" stroke="#f59e0b" strokeWidth={2.5} fill="url(#attrGrad)" name="Attrition Rate (%)" />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* ── Row 4: New Borrowers per month ────────────────────────────── */}
            <div className="bg-white p-6 rounded-xl border border-secondary-200 shadow-sm">
                <h3 className="text-sm font-bold text-secondary-800 uppercase tracking-wider mb-1">
                    New Borrowers Onboarded per Month
                </h3>
                <p className="text-xs text-secondary-400 mb-4">
                    Derived from monthly disbursement ÷ avg ticket size (₹35k). Seasonal peaks in Oct–Dec.
                </p>
                <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={chartData} margin={{ top: 5, right: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
                        <Tooltip formatter={(v: number) => [`${v.toLocaleString('en-IN')} borrowers`]} contentStyle={{ borderRadius: 8 }} />
                        <Legend />
                        <Bar isAnimationActive={false} dataKey="newBorrowersK" fill="#6366f1" name="New Borrowers" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
                {frequency === 'Quarterly' && (
                    <p className="text-xs text-secondary-400 mt-2">* Q4 FY26 is partial — Jan + Feb only</p>
                )}
            </div>

        </div>
    );
};

export default TrendsDashboard;
