import { useState, useMemo } from 'react';
import {
    BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Legend, Cell, ReferenceLine, PieChart, Pie
} from 'recharts';
import {
    TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Smartphone,
    Banknote, Target, Activity, AlertCircle, RefreshCw, ShieldAlert,
    Download, Camera, Lock
} from 'lucide-react';
import { saveFile, exportToPDF, exportToPPT } from '../lib/utils';
import { useRef } from 'react';
import {
    COLLECTIONS_HISTORY, CURRENT_COLLECTIONS, HIGH_RISK_CENTRES,
    type CollectionMetric
} from '../data/financeData';
import { COMPANY_HISTORY, MONTHS, type Month } from '../data/mfiData';
import { ALL_STATES_DATA, TOTAL_GLP } from '../data/geoDataComplete';
import { getBranchFilter, type BranchFilter } from '../data/users';
import KPICard from '../components/KPICard';
import { cn } from '../lib/utils';

// ── Formatting Helpers ──────────────────────────────────────────────────────
const fc = (v: number, d = 2) => `₹${v.toFixed(d)} Cr`;
const fp = (v: number, d = 2) => `${v.toFixed(d)}%`;
const sn = (v: number | undefined, fallback = 0) =>
    v === undefined || isNaN(v) || !isFinite(v) ? fallback : v;

const DPD_COLORS = [
    '#f59e0b',  // 1-30  amber — watch
    '#f97316',  // 31-60 orange — concern
    '#ef4444',  // 61-90 red — serious
    '#b91c1c',  // 91-180 dark red — critical
    '#7f1d1d',  // 180+  very dark — NPA
];

const CollectionsDashboard = () => {
    const exportRef = useRef<HTMLDivElement>(null);
    const [selectedMonth, setSelectedMonth] = useState<Month>('Feb'); // Feb 2026 = current

    // ── Branch filter (set via Secure Login) ──────────────────────────────────
    const branchFilter: BranchFilter | null = getBranchFilter();
    const isRestricted = branchFilter !== null;

    const [selectedStateName, setSelectedStateName] = useState<string>(
        isRestricted ? branchFilter!.state : 'All'
    );
    const [selectedDistrictName, setSelectedDistrictName] = useState<string>(
        isRestricted ? branchFilter!.district : 'All'
    );
    const [selectedBranchName, setSelectedBranchName] = useState<string>(
        isRestricted && branchFilter!.branches.length === 1 ? branchFilter!.branches[0] : 'All'
    );

    // Cascading dropdowns
    const availableDistricts = useMemo(() => {
        if (selectedStateName === 'All') return [];
        return ALL_STATES_DATA.find(s => s.name === selectedStateName)?.districts || [];
    }, [selectedStateName]);

    const availableBranches = useMemo(() => {
        if (selectedDistrictName === 'All' || selectedStateName === 'All') return [];
        const state = ALL_STATES_DATA.find(s => s.name === selectedStateName);
        const district = state?.districts.find(d => d.name === selectedDistrictName);
        const all = district?.branches || [];
        if (isRestricted && branchFilter) return all.filter(b => branchFilter.branches.includes(b.name));
        return all;
    }, [selectedStateName, selectedDistrictName, isRestricted, branchFilter]);

    // ── GLP scale factor (consistent with BranchDashboard formula) ────────────
    const entityScale = useMemo(() => {
        if (selectedStateName === 'All') return 1;
        const stateGeo = ALL_STATES_DATA.find(s => s.name === selectedStateName);
        if (!stateGeo) return 1;

        if (selectedDistrictName === 'All') return stateGeo.glp / TOTAL_GLP;

        const districtGeo = stateGeo.districts.find(d => d.name === selectedDistrictName);
        if (!districtGeo) return stateGeo.glp / TOTAL_GLP;

        if (selectedBranchName === 'All') return districtGeo.glp / TOTAL_GLP;

        const branchGeo = districtGeo.branches.find(b => b.name === selectedBranchName);
        if (!branchGeo) return districtGeo.glp / TOTAL_GLP;

        const rawDistrictGlp = districtGeo.branches.reduce((sum, b) => sum + b.glp, 0);
        const branchGlpScaled = rawDistrictGlp > 0
            ? branchGeo.glp * (districtGeo.glp / rawDistrictGlp)
            : branchGeo.glp;
        return branchGlpScaled / TOTAL_GLP;
    }, [selectedStateName, selectedDistrictName, selectedBranchName]);

    // Entity label for breadcrumb
    const entityLabel = useMemo(() => {
        if (selectedBranchName !== 'All') return `${selectedBranchName} Branch · ${selectedDistrictName} · ${selectedStateName}`;
        if (selectedDistrictName !== 'All') return `${selectedDistrictName} District · ${selectedStateName}`;
        if (selectedStateName !== 'All') return `${selectedStateName} (State)`;
        return 'All India';
    }, [selectedStateName, selectedDistrictName, selectedBranchName]);

    const monthData: CollectionMetric = useMemo(() => {
        return COLLECTIONS_HISTORY.find(m => m.month === selectedMonth) || CURRENT_COLLECTIONS;
    }, [selectedMonth]);

    // Scaled version of monthData based on entityScale
    const scaledData = useMemo(() => {
        if (entityScale === 1) return monthData;
        return {
            ...monthData,
            scheduled: monthData.scheduled * entityScale,
            collected: monthData.collected * entityScale,
            overdue: monthData.overdue * entityScale,
            recoveryFromNPA: monthData.recoveryFromNPA * entityScale,
            digitalCollection: monthData.digitalCollection * entityScale,
            cashCollection: monthData.cashCollection * entityScale,
            nonStarters: Math.round(monthData.nonStarters * entityScale),
            dpd: monthData.dpd.map(b => ({
                ...b,
                amount: b.amount * entityScale,
                accounts: Math.round(b.accounts * entityScale),
                // pct is a % of portfolio — unchanged
            })),
        };
    }, [monthData, entityScale]);

    // State-wise collection efficiency from geo data
    const stateCollectionData = useMemo(() => {
        return ALL_STATES_DATA.map(s => {
            const par30 = s.par30 || 2.5;
            const eff = Math.max(92, 99.2 - par30 * 0.8);
            return {
                name: s.name,
                efficiency: parseFloat(eff.toFixed(1)),
                par30,
                glp: s.glp || 0,
                overdue: parseFloat(((s.glp || 0) * (par30 / 100)).toFixed(2))
            };
        }).sort((a, b) => a.efficiency - b.efficiency);
    }, []);

    // 12-month trend: demand vs collected — scaled by entity
    const trendData = useMemo(() => {
        return COLLECTIONS_HISTORY.map(m => ({
            month: m.month,
            Scheduled: parseFloat((m.scheduled * entityScale).toFixed(2)),
            Collected: parseFloat((m.collected * entityScale).toFixed(2)),
            efficiency: m.efficiency,
            overdue: parseFloat((m.overdue * entityScale).toFixed(2))
        }));
    }, [entityScale]);

    // Digital vs Cash trend — scaled by entity
    const paymentTrendData = useMemo(() => COLLECTIONS_HISTORY.map(m => ({
        month: m.month,
        Digital: parseFloat((m.digitalCollection * entityScale).toFixed(2)),
        Cash: parseFloat((m.cashCollection * entityScale).toFixed(2)),
        digitalPct: m.digitalPct
    })), [entityScale]);

    // Resolution rate trend (percentages only — not scaled)
    const resolutionTrend = useMemo(() => COLLECTIONS_HISTORY.map(m => ({
        month: m.month,
        'Resolution Rate': m.resolutionRate,
        'Recovery (NPA)': parseFloat((m.recoveryFromNPA * entityScale).toFixed(2))
    })), [entityScale]);

    // High-risk centres filtered by hierarchy
    const filteredRiskCentres = useMemo(() => {
        let filtered = HIGH_RISK_CENTRES;
        if (selectedStateName !== 'All') filtered = filtered.filter(c => c.state === selectedStateName);
        if (selectedDistrictName !== 'All') filtered = filtered.filter(c => c.district === selectedDistrictName);
        if (selectedBranchName !== 'All') filtered = filtered.filter(c => c.branchName === selectedBranchName);
        return filtered;
    }, [selectedStateName, selectedDistrictName, selectedBranchName]);

    const prevMonth = COLLECTIONS_HISTORY[MONTHS.indexOf(selectedMonth) - 1];
    const scaledPrevMonth = prevMonth ? { ...prevMonth, efficiency: prevMonth.efficiency } : undefined;

    // ── Export Logic ──
    const getFilename = (ext: string) => `FINFLUX_Collections_${selectedMonth}_2025.${ext}`;

    const handleExportExcel = async () => {
        const XLSX = await import('xlsx');

        const summaryRows = [
            ['FINFLUX ANALYTICS - COLLECTIONS & RECOVERY REPORT'],
            ['Month', selectedMonth, ['Jan', 'Feb', 'Mar'].includes(selectedMonth) ? '2026' : '2025'],
            ['Scope', entityLabel],
            [''],
            ['Overall KPI', 'Value'],
            ['Collection Efficiency', `${sn(scaledData.efficiency)}%`],
            ['MTD Scheduled (Cr)', fc(sn(scaledData.scheduled))],
            ['MTD Collected (Cr)', fc(sn(scaledData.collected))],
            ['Current Overdue (Cr)', fc(sn(scaledData.overdue))],
            ['Resolution Rate', `${sn(scaledData.resolutionRate)}%`],
            ['Digital Collection', `${sn(scaledData.digitalPct)}%`],
            ['Non-Starters', sn(scaledData.nonStarters)]
        ];

        const stateRows = [
            ['State-wise Collection Breakup'],
            [],
            ['State', 'Collection Efficiency (%)', 'PAR 30 (%)', 'GLP (Cr)', 'Overdue (Cr)'],
            ...stateCollectionData.map(r => [r.name, r.efficiency, r.par30, r.glp, r.overdue])
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), "Summary");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(stateRows), "State Breakup");
        const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        saveFile(new Blob([out], { type: 'application/octet-stream' }), getFilename('xlsx'));
    };


    const handleExportPDF = async () => {
        if (!exportRef.current) return;
        try { await exportToPDF([exportRef as React.RefObject<HTMLElement>], getFilename('pdf')); }
        catch (e) { console.error(e); alert('Error generating PDF.'); }
    };

    const handleExportPPT = async () => {
        if (!exportRef.current) return;
        try { await exportToPPT([exportRef as React.RefObject<HTMLElement>], getFilename('pptx')); }
        catch (e) { console.error(e); alert('Error generating PPT.'); }
    };


    return (
        <div ref={exportRef} className="space-y-6">
            {/* ── FINFLUX Branded Header ─────────────────────────────────── */}
            <div className="bg-gradient-to-r from-emerald-700 via-teal-600 to-cyan-600 rounded-xl p-5 text-white shadow-lg">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <div className="text-xs font-bold uppercase tracking-widest text-emerald-200 mb-1">FINFLUX Analytics · Collections & Recovery</div>
                        <h2 className="text-2xl font-bold">Demand ↔ Collection · DPD Buckets · Recovery</h2>
                        <p className="text-emerald-200 text-sm mt-1">FY 2025-26 · Data as of <strong>{selectedMonth} {['Jan', 'Feb', 'Mar'].includes(selectedMonth) ? '2026' : '2025'}</strong> · All figures in ₹ Crore · <span className="text-white font-bold">{entityLabel}</span></p>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                        {/* Efficiency Gauge summary */}
                        <div className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-center">
                            <div className="text-[10px] text-white/70 font-bold uppercase">Coll. Efficiency</div>
                            <div className={cn('text-2xl font-bold',
                                sn(scaledData.efficiency) >= 98 ? 'text-emerald-300' :
                                    sn(scaledData.efficiency) >= 96 ? 'text-amber-200' : 'text-rose-300'
                            )}>{fp(sn(scaledData.efficiency), 1)}</div>
                            <div className="text-[10px] text-white/50">Target: 99.0%</div>
                        </div>
                        <div className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-center">
                            <div className="text-[10px] text-white/70 font-bold uppercase">Non-Starters</div>
                            <div className="text-2xl font-bold text-cyan-300">{(scaledData.nonStarters || 0).toLocaleString()}</div>
                            <div className="text-[10px] text-white/50">Early delinquency</div>
                        </div>
                        <div className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-center">
                            <div className="text-[10px] text-white/70 font-bold uppercase">Resolution Rate</div>
                            <div className="text-2xl font-bold text-amber-300">{fp(sn(scaledData.resolutionRate), 1)}</div>
                            <div className="text-[10px] text-white/50">Overdue cured</div>
                        </div>
                        <select
                            className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white outline-none"
                            value={selectedMonth}
                            onChange={e => setSelectedMonth(e.target.value as Month)}
                        >
                            {MONTHS.map(m => <option key={m} value={m} className="text-secondary-900">{m} {['Jan', 'Feb', 'Mar'].includes(m) ? '2026' : '2025'}</option>)}
                        </select>
                        <div className="relative group z-50">
                            <button className="bg-white/15 border border-white/25 rounded-lg px-3 py-2 text-sm text-white hover:bg-white/25 flex items-center gap-2 transition-colors">
                                <Download size={15} /> Export
                            </button>
                            <div className="absolute right-0 top-full pt-2 w-48 hidden group-hover:block z-[100]">
                                <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-xl border border-emerald-700/20 overflow-hidden text-left">
                                    <button onClick={handleExportExcel} className="w-full text-left px-4 py-3 text-sm font-medium text-slate-800 hover:bg-teal-50 hover:text-teal-700 transition-colors border-b border-secondary-100 flex justify-between items-center">Excel (.xlsx) <Download size={14} /></button>
                                    <button onClick={handleExportPDF} className="w-full text-left px-4 py-3 text-sm font-medium text-slate-800 hover:bg-teal-50 hover:text-teal-700 transition-colors border-b border-secondary-100 flex justify-between items-center">PDF Screenshot <Camera size={14} /></button>
                                    <button onClick={handleExportPPT} className="w-full text-left px-4 py-3 text-sm font-medium text-slate-800 hover:bg-teal-50 hover:text-teal-700 transition-colors flex justify-between items-center">PPT Screenshot <Camera size={14} /></button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Hierarchy Filter Bar ──────────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-secondary-200 shadow-sm p-4">
                <div className="flex flex-wrap items-end gap-4">
                    {/* State */}
                    <div>
                        <label className="text-[10px] text-secondary-500 font-bold uppercase tracking-wider mb-1 block">
                            {isRestricted && <Lock size={9} className="inline mr-1 text-amber-500" />}State
                        </label>
                        <select
                            className="bg-secondary-50 border border-secondary-200 text-secondary-900 text-sm rounded-lg block w-36 p-2.5 outline-none font-semibold disabled:opacity-70 disabled:cursor-not-allowed"
                            value={selectedStateName}
                            onChange={e => {
                                setSelectedStateName(e.target.value);
                                setSelectedDistrictName('All');
                                setSelectedBranchName('All');
                            }}
                            disabled={isRestricted}
                        >
                            <option value="All">All States</option>
                            {ALL_STATES_DATA.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                        </select>
                    </div>

                    {/* District */}
                    <div className={selectedStateName === 'All' ? 'opacity-40 pointer-events-none' : ''}>
                        <label className="text-[10px] text-secondary-500 font-bold uppercase tracking-wider mb-1 block">
                            {isRestricted && <Lock size={9} className="inline mr-1 text-amber-500" />}District
                        </label>
                        <select
                            className="bg-secondary-50 border border-secondary-200 text-secondary-900 text-sm rounded-lg block w-36 p-2.5 outline-none font-semibold disabled:opacity-70 disabled:cursor-not-allowed"
                            value={selectedDistrictName}
                            onChange={e => {
                                setSelectedDistrictName(e.target.value);
                                setSelectedBranchName('All');
                            }}
                            disabled={selectedStateName === 'All' || isRestricted}
                        >
                            <option value="All">All Districts</option>
                            {availableDistricts.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
                        </select>
                    </div>

                    {/* Branch */}
                    <div className={selectedDistrictName === 'All' ? 'opacity-40 pointer-events-none' : ''}>
                        <label className="text-[10px] text-secondary-500 font-bold uppercase tracking-wider mb-1 block">Branch</label>
                        <select
                            className="bg-secondary-50 border border-secondary-200 text-secondary-900 text-sm rounded-lg block w-44 p-2.5 outline-none font-semibold disabled:opacity-70 disabled:cursor-not-allowed"
                            value={selectedBranchName}
                            onChange={e => setSelectedBranchName(e.target.value)}
                            disabled={selectedDistrictName === 'All'}
                        >
                            {/* No "All" for BM with single branch */}
                            {!(isRestricted && branchFilter!.branches.length === 1) && (
                                <option value="All">All Branches</option>
                            )}
                            {availableBranches.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                        </select>
                    </div>

                    {/* Scale info */}
                    <div className="ml-auto text-right">
                        <div className="text-[10px] text-secondary-400 font-bold uppercase tracking-wider">Viewing</div>
                        <div className="text-sm font-bold text-secondary-800">{entityLabel}</div>
                        {entityScale < 1 && (
                            <div className="text-[10px] text-teal-600 font-semibold">
                                {(entityScale * 100).toFixed(2)}% of national portfolio
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── KPI Row 1: Core Collection Metrics ──────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard
                    title="Collection Efficiency"
                    value={fp(sn(scaledData.efficiency), 1)}
                    subValue={`Target: 99.0%`}
                    trend={sn(scaledData.efficiency) >= 97 ? 'up' : 'down'}
                    trendValue={scaledPrevMonth ? `${(sn(scaledData.efficiency) - sn(scaledPrevMonth.efficiency)).toFixed(1)}% vs last month` : ''}
                    icon={Target}
                    className={cn('border-l-4', sn(scaledData.efficiency) >= 98 ? 'border-l-emerald-500' : sn(scaledData.efficiency) >= 96 ? 'border-l-amber-500' : 'border-l-rose-500')}
                />
                <KPICard
                    title="MTD Scheduled"
                    value={fc(sn(scaledData.scheduled))}
                    subValue="Due this month"
                    icon={Activity}
                    className="border-l-4 border-l-blue-500"
                />
                <KPICard
                    title="MTD Collected"
                    value={fc(sn(scaledData.collected))}
                    subValue={`Overdue: ${fc(sn(scaledData.overdue))}`}
                    trend="up"
                    icon={CheckCircle2}
                    className="border-l-4 border-l-emerald-500"
                />
                <KPICard
                    title="Current Overdue"
                    value={fc(sn(scaledData.overdue))}
                    subValue={`${fp(sn(scaledData.dpd[0]?.pct), 2)} of Portfolio`}
                    trend="down"
                    trendValue="PAR 30+"
                    icon={AlertTriangle}
                    className="border-l-4 border-l-rose-500"
                />
            </div>

            {/* ── KPI Row 2: Recovery & Channel ───────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard
                    title="Resolution Rate"
                    value={fp(sn(scaledData.resolutionRate), 1)}
                    subValue="Overdue accounts cured"
                    trend="up"
                    icon={RefreshCw}
                    className="border-l-4 border-l-teal-500"
                />
                <KPICard
                    title="NPA Recovery"
                    value={fc(sn(scaledData.recoveryFromNPA), 2)}
                    subValue="Recovered from write-offs"
                    trend="up"
                    icon={TrendingUp}
                    className="border-l-4 border-l-indigo-500"
                />
                <KPICard
                    title="Digital Collection"
                    value={`${fp(sn(scaledData.digitalPct), 1)}`}
                    subValue={fc(sn(scaledData.digitalCollection))}
                    trend="up"
                    trendValue="↑ YTD"
                    icon={Smartphone}
                    className="border-l-4 border-l-purple-500"
                />
                <KPICard
                    title="Non-Starters"
                    value={(scaledData.nonStarters || 0).toLocaleString()}
                    subValue="Accounts never paid"
                    trend="down"
                    trendValue="Early delinquency signal"
                    icon={ShieldAlert}
                    className="border-l-4 border-l-orange-500"
                />
            </div>

            {/* ── DPD Bucket Table + State Heatmap ────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* DPD Waterfall Table */}
                <div className="bg-white rounded-xl border border-secondary-200 shadow-sm p-5">
                    <h3 className="text-sm font-bold text-secondary-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                        Overdue Bucket Analysis (DPD)
                    </h3>
                    <div className="space-y-3">
                        {scaledData.dpd.map((bucket, i) => (
                            <div key={bucket.bucket} className="space-y-1">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="font-semibold text-secondary-700">{bucket.bucket}</span>
                                    <div className="flex gap-4 text-right">
                                        <span className="text-secondary-500">{bucket.accounts.toLocaleString()} accounts</span>
                                        <span className="font-bold text-secondary-800 w-24 text-right">{fc(sn(bucket.amount))}</span>
                                        <span className="font-bold w-14 text-right" style={{ color: DPD_COLORS[i] }}>{fp(sn(bucket.pct))}</span>
                                    </div>
                                </div>
                                <div className="w-full h-2 bg-secondary-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-700"
                                        style={{
                                            width: `${Math.min(100, (sn(bucket.pct) / (scaledData.dpd[0]?.pct || 1)) * 100)}%`,
                                            backgroundColor: DPD_COLORS[i]
                                        }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-4 pt-4 border-t border-secondary-100 flex justify-between text-xs text-secondary-500">
                        <span>Total Overdue Portfolio at Risk</span>
                        <span className="font-bold text-rose-600">
                            {fc(sn(scaledData.dpd.reduce((s, b) => s + sn(b.amount), 0)))}
                        </span>
                    </div>
                </div>

                {/* State-wise Collection Efficiency — hidden for branch/area restricted users */}
                {!isRestricted && <div className="bg-white rounded-xl border border-secondary-200 shadow-sm p-5">
                    <h3 className="text-sm font-bold text-secondary-800 uppercase tracking-wider mb-4">
                        State-wise Collection Efficiency
                    </h3>
                    <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={stateCollectionData} layout="vertical" margin={{ left: 80, right: 40 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                            <XAxis type="number" domain={[90, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} />
                            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                            <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                            <ReferenceLine x={99} stroke="#10b981" strokeDasharray="4 4" label={{ value: 'Target', fill: '#10b981', fontSize: 10 }} />
                            <Bar isAnimationActive={false} dataKey="efficiency" radius={[0, 4, 4, 0]}>
                                {stateCollectionData.map((entry, i) => (
                                    <Cell key={i} fill={entry.efficiency >= 99 ? '#10b981' : entry.efficiency >= 97 ? '#f59e0b' : '#ef4444'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>}
            </div>

            {/* ── 12-Month Demand vs Collected Trend ──────────────────────── */}
            <div className="bg-white rounded-xl border border-secondary-200 shadow-sm p-5">
                <h3 className="text-sm font-bold text-secondary-800 uppercase tracking-wider mb-4">
                    12-Month: Scheduled vs Collected (₹ Cr)
                </h3>
                <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={trendData} margin={{ top: 5, right: 30 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={v => `₹${v}`} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v: number, name: string) => [`₹${v.toFixed(2)} Cr`, name]} />
                        <Legend />
                        <Bar isAnimationActive={false} dataKey="Scheduled" fill="#93c5fd" radius={[3, 3, 0, 0]} />
                        <Bar isAnimationActive={false} dataKey="Collected" fill="#10b981" radius={[3, 3, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* ── Digital vs Cash + Resolution Rate ───────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl border border-secondary-200 shadow-sm p-5">
                    <h3 className="text-sm font-bold text-secondary-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Smartphone size={14} className="text-purple-500" />
                        Digital vs Cash Collection Trend
                    </h3>
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={paymentTrendData} margin={{ top: 5, right: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                            <YAxis tickFormatter={v => `₹${v}`} tick={{ fontSize: 11 }} />
                            <Tooltip formatter={(v: number, name: string) => [`₹${v.toFixed(2)} Cr`, name]} />
                            <Legend />
                            <Bar isAnimationActive={false} dataKey="Digital" stackId="a" fill="#8b5cf6" radius={[0, 0, 0, 0]} />
                            <Bar isAnimationActive={false} dataKey="Cash" stackId="a" fill="#d1d5db" radius={[3, 3, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="bg-white rounded-xl border border-secondary-200 shadow-sm p-5">
                    <h3 className="text-sm font-bold text-secondary-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <RefreshCw size={14} className="text-teal-500" />
                        Overdue Resolution Rate (%)
                    </h3>
                    <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={resolutionTrend} margin={{ top: 5, right: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                            <YAxis domain={[55, 80]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} yAxisId="left" />
                            <YAxis orientation="right" tickFormatter={v => `₹${v}`} tick={{ fontSize: 11 }} yAxisId="right" />
                            <Tooltip />
                            <Legend />
                            <Line isAnimationActive={false} yAxisId="left" dataKey="Resolution Rate" stroke="#14b8a6" strokeWidth={2} dot={{ r: 3 }} />
                            <Line isAnimationActive={false} yAxisId="right" dataKey="Recovery (NPA)" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* ── High-Risk Centres Table ──────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-secondary-200 shadow-sm p-5">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-bold text-secondary-800 uppercase tracking-wider flex items-center gap-2">
                        <AlertCircle size={14} className="text-rose-500" />
                        High-Risk Centres (PAR &gt; 4%) — Requires Immediate Attention
                    </h3>
                    <span className="text-xs text-secondary-500 bg-secondary-50 border border-secondary-200 rounded-lg px-3 py-1.5 font-semibold">
                        {entityLabel}
                    </span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-secondary-50 border-b border-secondary-200">
                            <tr>
                                {['Centre', 'Branch', 'District', 'State', 'PAR 30%', 'Overdue', 'Missed (Consec.)', 'Clients'].map(h => (
                                    <th key={h} className="py-2 px-3 text-xs font-semibold text-secondary-500 whitespace-nowrap">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-secondary-100">
                            {filteredRiskCentres.map((c, i) => (
                                <tr key={i} className="hover:bg-rose-50 transition-colors">
                                    <td className="py-2 px-3 font-medium text-secondary-900 text-xs">{c.centreName}</td>
                                    <td className="py-2 px-3 text-secondary-600 text-xs">{c.branchName}</td>
                                    <td className="py-2 px-3 text-secondary-600 text-xs">{c.district}</td>
                                    <td className="py-2 px-3 text-secondary-600 text-xs">{c.state}</td>
                                    <td className="py-2 px-3 text-xs">
                                        <span className={cn(
                                            'px-2 py-0.5 rounded font-bold',
                                            c.par30 > 7 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                                        )}>
                                            {fp(c.par30)}
                                        </span>
                                    </td>
                                    <td className="py-2 px-3 font-mono text-xs text-rose-600 font-semibold">₹{c.overdueAmount.toFixed(3)} Cr</td>
                                    <td className="py-2 px-3 text-xs text-center">
                                        {Array.from({ length: c.consecutiveMisses }).map((_, j) => (
                                            <span key={j} className="inline-block w-2 h-2 bg-rose-400 rounded-full mr-0.5" />
                                        ))}
                                        <span className="text-secondary-500 ml-1">{c.consecutiveMisses}</span>
                                    </td>
                                    <td className="py-2 px-3 text-xs text-secondary-600">{c.clients.toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredRiskCentres.length === 0 && (
                        <div className="text-center py-8 text-secondary-400 text-sm">No high-risk centres in this state 🎉</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CollectionsDashboard;
