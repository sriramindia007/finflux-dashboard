import { useState, useMemo } from 'react';
import {
    LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Legend, ReferenceLine, AreaChart, Area, Cell,
    ComposedChart
} from 'recharts';
import {
    TrendingUp, TrendingDown, DollarSign, BarChart2, Percent,
    ArrowUp, ArrowDown, Minus, ShieldCheck, AlertCircle, Wallet,
    Building2, Target, Download, Camera
} from 'lucide-react';
import { saveFile, exportToPDF, exportToPPT } from '../lib/utils';
import { useRef } from 'react';
import {
    FINANCIAL_HISTORY, CURRENT_FINANCIALS, STATE_FINANCIALS,
    REGULATORY_COMPLIANCE, INDUSTRY_BENCHMARKS, VINTAGE_DATA,
    type FinancialMetric
} from '../data/financeData';
import { MONTHS, type Month } from '../data/mfiData';
import KPICard from '../components/KPICard';
import { cn } from '../lib/utils';

// ── Helpers ─────────────────────────────────────────────────────────────────
const fc = (v: number, d = 2) => `₹${v.toFixed(d)} Cr`;
const fp = (v: number, d = 2) => `${v.toFixed(d)}%`;
const sn = (v: number | undefined, fb = 0) =>
    (v == null || isNaN(v) || !isFinite(v)) ? fb : v;

const FinancialDashboard = () => {
    const exportRef = useRef<HTMLDivElement>(null);
    const [selectedMonth, setSelectedMonth] = useState<Month>('Feb'); // Feb 2026 = current
    const [activeSection, setActiveSection] = useState<'pl' | 'ratios' | 'funding' | 'regulatory' | 'benchmarks' | 'vintage'>('pl');

    const monthData: FinancialMetric = useMemo(
        () => FINANCIAL_HISTORY.find(m => m.month === selectedMonth) || CURRENT_FINANCIALS,
        [selectedMonth]
    );

    const prevMonth: FinancialMetric | undefined = FINANCIAL_HISTORY[MONTHS.indexOf(selectedMonth) - 1];
    const monthIdx = MONTHS.indexOf(selectedMonth);

    // YTD aggregates
    const ytdSlice = FINANCIAL_HISTORY.slice(0, monthIdx + 1);
    const ytdIncome = ytdSlice.reduce((s, m) => s + sn(m.totalIncome), 0);
    const ytdPAT = ytdSlice.reduce((s, m) => s + sn(m.pat), 0);
    const ytdNII = ytdSlice.reduce((s, m) => s + sn(m.nii), 0);
    const ytdOpex = ytdSlice.reduce((s, m) => s + sn(m.opex), 0);

    // Month-over-Month delta badges
    const moDelta = (curr: number, key: keyof FinancialMetric, better: 'up' | 'down' = 'up') => {
        if (!prevMonth) return null;
        const prev = sn(prevMonth[key] as number);
        const diff = curr - prev;
        if (Math.abs(diff) < 0.0001) return null;
        const positive = better === 'up' ? diff >= 0 : diff <= 0;
        return (
            <span className={cn('inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                positive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
            )}>
                {diff > 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                {Math.abs(diff).toFixed(2)} MoM
            </span>
        );
    };

    // Annualised ratios
    const nimAnn = sn(monthData.nim) * 12;
    const oerAnn = sn(monthData.oer) * 12;
    const roaAnn = sn(monthData.roa) * 12;
    const roeAnn = sn(monthData.roe);  // already annualised
    const spread = sn(monthData.yieldOnPortfolio) - sn(monthData.costOfFunds);

    // P&L Waterfall
    const waterfallData = [
        { name: 'Interest Income', value: sn(monthData.interestIncome), fill: '#0ea5e9', isPositive: true },
        { name: 'Fee Income', value: sn(monthData.feeIncome), fill: '#38bdf8', isPositive: true },
        { name: '− Int. Expense', value: -sn(monthData.interestExpense), fill: '#f43f5e', isPositive: false },
        { name: '− Opex', value: -sn(monthData.opex), fill: '#f59e0b', isPositive: false },
        { name: '− Provision', value: -sn(monthData.provisionForNPA), fill: '#ef4444', isPositive: false },
        { name: 'Net PAT', value: sn(monthData.pat), fill: '#10b981', isPositive: true },
    ];

    // Ratio Trend (full 12 months)
    const ratioTrend = FINANCIAL_HISTORY.map(m => ({
        month: m.month,
        'NIM (ann.)': parseFloat((sn(m.nim) * 12).toFixed(2)),
        'OER (ann.)': parseFloat((sn(m.oer) * 12).toFixed(2)),
        'ROA (ann.)': parseFloat((sn(m.roa) * 12).toFixed(2)),
        'ROE (ann.)': parseFloat(sn(m.roe).toFixed(2)),
        'CRAR': sn(m.crar),
    }));

    // Income vs Expense vs PAT
    const incomeTrend = FINANCIAL_HISTORY.map(m => ({
        month: m.month,
        'Total Income': parseFloat(sn(m.totalIncome).toFixed(2)),
        'Total Expense': parseFloat(sn(m.totalExpense).toFixed(2)),
        'Net PAT': parseFloat(sn(m.pat).toFixed(2)),
    }));

    // Yield vs CoF spread
    const spreadTrend = FINANCIAL_HISTORY.map(m => ({
        month: m.month,
        'Yield on Portfolio': parseFloat(sn(m.yieldOnPortfolio).toFixed(2)),
        'Cost of Funds': parseFloat(sn(m.costOfFunds).toFixed(2)),
        'Net Spread': parseFloat((sn(m.yieldOnPortfolio) - sn(m.costOfFunds)).toFixed(2)),
    }));

    // Borrowings trend
    const borrowingsTrend = FINANCIAL_HISTORY.map(m => ({
        month: m.month,
        'Borrowings': parseFloat(sn(m.borrowings).toFixed(0)),
        'GLP': parseFloat(sn(m.glp).toFixed(0)),
    }));

    // State financials table
    const stateFinancialRows = STATE_FINANCIALS.sort((a, b) => b.glp - a.glp);

    // ── Export Logic ──
    const getFilename = (ext: string) => `FINFLUX_Financial_${selectedMonth}_2025.${ext}`;

    const handleExportExcel = async () => {
        const XLSX = await import('xlsx');
        const summaryRows = [
            ['FINFLUX ANALYTICS - FINANCIAL PERFORMANCE REPORT'],
            ['Month', selectedMonth, '2025'],
            [''],
            ['KPI', 'Value', 'YTD', 'MoM Change'],
            ['NIM (ann.)', `${nimAnn.toFixed(2)}%`, '-', prevMonth ? `${(nimAnn - sn(prevMonth.nim) * 12).toFixed(2)}%` : '-'],
            ['ROA (ann.)', `${roaAnn.toFixed(2)}%`, '-', '-'],
            ['OER (ann.)', `${oerAnn.toFixed(2)}%`, '-', '-'],
            ['ROE (ann.)', `${roeAnn.toFixed(2)}%`, '-', '-'],
            ['CRAR', `${sn(monthData.crar).toFixed(1)}%`, '-', '-'],
            ['Yield on Portfolio', `${sn(monthData.yieldOnPortfolio).toFixed(1)}%`, '-', '-'],
            ['Cost of Funds', `${sn(monthData.costOfFunds).toFixed(1)}%`, '-', '-'],
            ['Net Spread', `${spread.toFixed(2)}%`, '-', '-'],
            ['Total Income', fc(sn(monthData.totalIncome)), fc(ytdIncome), '-'],
            ['Net PAT', fc(sn(monthData.pat)), fc(ytdPAT), '-'],
            ['NII', fc(sn(monthData.nii)), fc(ytdNII), '-'],
        ];

        const historyRows = [
            ['Monthly Fin Trend', 'FY 2025'],
            [],
            ['Month', 'Total Income', 'Total Expense', 'Net PAT'],
            ...incomeTrend.map(m => [m.month, m['Total Income'], m['Total Expense'], m['Net PAT']])
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), "Summary");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(historyRows), "Trends");
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


    const sections = [
        { id: 'pl', label: 'P&L' },
        { id: 'ratios', label: 'Key Ratios' },
        { id: 'funding', label: 'Funding & Spread' },
        { id: 'regulatory', label: 'Compliance' },
        { id: 'benchmarks', label: 'Benchmarks' },
        { id: 'vintage', label: 'Vintage' },
    ] as const;

    return (
        <div ref={exportRef} className="space-y-6">

            {/* ── HEADER ─────────────────────────────────────────────────────── */}
            <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-violet-600 rounded-xl p-5 text-white shadow-lg">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <div className="text-xs font-bold uppercase tracking-widest text-indigo-200 mb-1">FINFLUX Analytics · Financial Performance</div>
                        <h2 className="text-2xl font-bold">P&L · Ratios · Funding · Compliance</h2>
                        <p className="text-indigo-200 text-sm mt-1">FY 2025-26 · All figures in ₹ Crore unless stated · Data as of <strong>{selectedMonth} {['Jan', 'Feb', 'Mar'].includes(selectedMonth) ? '2026' : '2025'}</strong></p>
                    </div>
                    <div className="flex items-center gap-3">
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
                                <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-xl border border-secondary-200 overflow-hidden text-left">
                                    <button onClick={handleExportExcel} className="w-full text-left px-4 py-3 text-sm font-medium text-slate-800 hover:bg-primary-50 hover:text-primary-600 transition-colors border-b border-secondary-100 flex justify-between items-center">Excel (.xlsx) <Download size={14} /></button>
                                    <button onClick={handleExportPDF} className="w-full text-left px-4 py-3 text-sm font-medium text-slate-800 hover:bg-primary-50 hover:text-primary-600 transition-colors border-b border-secondary-100 flex justify-between items-center">PDF Screenshot <Camera size={14} /></button>
                                    <button onClick={handleExportPPT} className="w-full text-left px-4 py-3 text-sm font-medium text-slate-800 hover:bg-primary-50 hover:text-primary-600 transition-colors flex justify-between items-center">PPT Screenshot <Camera size={14} /></button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── BOARD-LEVEL KPI STRIP ────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
                {[
                    { label: 'NIM (ann.)', value: fp(nimAnn, 1), sub: `NII: ${fc(sn(monthData.nii))}`, color: 'indigo', good: nimAnn >= 11.2 },
                    { label: 'ROA (ann.)', value: fp(roaAnn, 2), sub: `PAT: ${fc(sn(monthData.pat))}`, color: 'emerald', good: roaAnn >= 3.1 },
                    { label: 'ROE (ann.)', value: fp(roeAnn, 1), sub: 'On Equity', color: 'teal', good: roeAnn >= 18 },
                    { label: 'OER (ann.)', value: fp(oerAnn, 1), sub: 'Target <6.2%', color: 'amber', good: oerAnn <= 6.2 },
                    { label: 'CRAR', value: fp(sn(monthData.crar), 1), sub: 'Min 15%', color: 'green', good: sn(monthData.crar) >= 15 },
                    { label: 'Net Spread', value: fp(spread, 2), sub: 'Yield − CoF', color: 'blue', good: spread >= 10 },
                    { label: 'Yield', value: fp(sn(monthData.yieldOnPortfolio), 1), sub: 'Cap 24%', color: 'cyan', good: sn(monthData.yieldOnPortfolio) <= 24 },
                    { label: 'CoF', value: fp(sn(monthData.costOfFunds), 1), sub: 'Lower is better', color: 'rose', good: sn(monthData.costOfFunds) <= 11.5 },
                ].map((k, i) => (
                    <div key={i} className={cn(
                        'bg-white rounded-xl border shadow-sm p-3 text-center',
                        k.good ? 'border-emerald-200' : 'border-rose-200'
                    )}>
                        <div className="text-[10px] font-bold text-secondary-400 uppercase tracking-wider mb-1">{k.label}</div>
                        <div className={cn('text-xl font-bold', k.good ? 'text-emerald-600' : 'text-rose-600')}>{k.value}</div>
                        <div className="text-[10px] text-secondary-400 mt-0.5">{k.sub}</div>
                    </div>
                ))}
            </div>

            {/* ── SECOND-ROW KPIS ──────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard
                    title="Total Income (MTD)"
                    value={fc(sn(monthData.totalIncome))}
                    subValue={`YTD: ${fc(ytdIncome)}`}
                    icon={DollarSign}
                    className="border-l-4 border-l-blue-500"
                />
                <KPICard
                    title="Net PAT (YTD)"
                    value={fc(ytdPAT)}
                    subValue={`MTD: ${fc(sn(monthData.pat))}`}
                    trend="up"
                    icon={TrendingUp}
                    className="border-l-4 border-l-emerald-500"
                />
                <KPICard
                    title="NII (YTD)"
                    value={fc(ytdNII)}
                    subValue={`MTD: ${fc(sn(monthData.nii))}`}
                    icon={Percent}
                    className="border-l-4 border-l-indigo-500"
                />
                <KPICard
                    title="Opex (YTD)"
                    value={fc(ytdOpex)}
                    subValue={`OER: ${fp(oerAnn, 1)} (ann.)`}
                    trend={oerAnn <= 6.2 ? 'up' : 'down'}
                    icon={BarChart2}
                    className="border-l-4 border-l-amber-500"
                />
            </div>

            {/* ── SECTION NAV TABS ──────────────────────────────────────────── */}
            <div className="flex gap-2 flex-wrap border-b border-secondary-200 pb-0">
                {sections.map(s => (
                    <button
                        key={s.id}
                        onClick={() => setActiveSection(s.id)}
                        className={cn(
                            'px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-colors',
                            activeSection === s.id
                                ? 'border-indigo-600 text-indigo-700 bg-indigo-50'
                                : 'border-transparent text-secondary-500 hover:text-secondary-800 hover:bg-secondary-50'
                        )}
                    >
                        {s.label}
                    </button>
                ))}
            </div>

            {/* ── P&L SECTION ──────────────────────────────────────────────── */}
            {activeSection === 'pl' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    {/* Monthly P&L Waterfall */}
                    <div className="bg-white rounded-xl border border-secondary-200 shadow-sm p-5">
                        <h3 className="text-sm font-bold text-secondary-800 uppercase tracking-wider mb-1">
                            P&L Waterfall — {selectedMonth} 2025
                        </h3>
                        <p className="text-xs text-secondary-400 mb-4">Monthly income, expense and profit components (₹ Cr)</p>
                        <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={waterfallData} margin={{ top: 5, right: 20, bottom: 40 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} height={60} />
                                <YAxis tickFormatter={v => `₹${v.toFixed(0)}`} tick={{ fontSize: 10 }} />
                                <Tooltip formatter={(v: number) => [`₹${Math.abs(v).toFixed(2)} Cr`, '']} />
                                <ReferenceLine y={0} stroke="#e2e8f0" />
                                <Bar isAnimationActive={false} dataKey="value" radius={[4, 4, 0, 0]}>
                                    {waterfallData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Income vs Expense vs PAT */}
                    <div className="bg-white rounded-xl border border-secondary-200 shadow-sm p-5">
                        <h3 className="text-sm font-bold text-secondary-800 uppercase tracking-wider mb-1">
                            Income, Expense & Net PAT — FY 2025
                        </h3>
                        <p className="text-xs text-secondary-400 mb-4">Monthly trend (₹ Cr)</p>
                        <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={incomeTrend} margin={{ top: 5, right: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                                <YAxis tickFormatter={v => `₹${v}`} tick={{ fontSize: 11 }} />
                                <Tooltip formatter={(v: number, name: string) => [`₹${v.toFixed(2)} Cr`, name]} />
                                <Legend />
                                <Bar isAnimationActive={false} dataKey="Total Income" fill="#0ea5e9" radius={[3, 3, 0, 0]} />
                                <Bar isAnimationActive={false} dataKey="Total Expense" fill="#f87171" radius={[3, 3, 0, 0]} />
                                <Bar isAnimationActive={false} dataKey="Net PAT" fill="#10b981" radius={[3, 3, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* MTD P&L details table */}
                    <div className="lg:col-span-2 bg-white rounded-xl border border-secondary-200 shadow-sm p-5">
                        <h3 className="text-sm font-bold text-secondary-800 uppercase tracking-wider mb-4">
                            Detailed P&L Statement — {selectedMonth} 2025
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                                <div className="text-xs font-bold text-secondary-500 uppercase mb-2">Income</div>
                                <div className="space-y-2">
                                    {[
                                        { label: 'Interest Income', val: sn(monthData.interestIncome), delta: moDelta(sn(monthData.interestIncome), 'interestIncome') },
                                        { label: 'Fee Income', val: sn(monthData.feeIncome), delta: null },
                                        { label: 'Total Income', val: sn(monthData.totalIncome), bold: true, delta: null },
                                    ].map((r, i) => (
                                        <div key={i} className={cn('flex justify-between items-center py-1.5 border-b border-secondary-50', r.bold && 'border-t-2 border-t-secondary-200 pt-2')}>
                                            <span className={cn('text-sm text-secondary-600', r.bold && 'font-bold text-secondary-800')}>{r.label}</span>
                                            <div className="flex items-center gap-2">
                                                {r.delta}
                                                <span className={cn('text-sm font-bold text-emerald-600', r.bold && 'text-secondary-900')}>{fc(r.val)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <div className="text-xs font-bold text-secondary-500 uppercase mb-2">Expenses & Profit</div>
                                <div className="space-y-2">
                                    {[
                                        { label: 'Interest Expense', val: sn(monthData.interestExpense), color: 'text-rose-600', delta: null },
                                        { label: 'Operating Expenses', val: sn(monthData.opex), color: 'text-amber-600', delta: moDelta(sn(monthData.opex), 'opex', 'down') },
                                        { label: 'Provision for NPA', val: sn(monthData.provisionForNPA), color: 'text-red-600', delta: null },
                                        { label: 'Total Expense', val: sn(monthData.totalExpense), bold: true, color: 'text-rose-700', delta: null },
                                        { label: 'Pre-Provision Profit', val: sn(monthData.pbp), color: 'text-blue-600', delta: null },
                                        { label: 'Net PAT', val: sn(monthData.pat), bold: true, color: 'text-emerald-700', delta: moDelta(sn(monthData.pat), 'pat') },
                                    ].map((r, i) => (
                                        <div key={i} className={cn('flex justify-between items-center py-1.5 border-b border-secondary-50', r.bold && 'border-t-2 border-t-secondary-200 pt-2')}>
                                            <span className={cn('text-sm text-secondary-600', r.bold && 'font-bold text-secondary-800')}>{r.label}</span>
                                            <div className="flex items-center gap-2">
                                                {r.delta}
                                                <span className={cn('text-sm font-bold', r.color)}>{fc(r.val)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div >
            )
            }

            {/* ── RATIOS SECTION ───────────────────────────────────────────── */}
            {
                activeSection === 'ratios' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                        {/* NIM / OER / ROA 12 month */}
                        <div className="bg-white rounded-xl border border-secondary-200 shadow-sm p-5">
                            <h3 className="text-sm font-bold text-secondary-800 uppercase tracking-wider mb-1">NIM · OER · ROA — 12-Month Trend</h3>
                            <p className="text-xs text-secondary-400 mb-4">Annualised (×12) percentages</p>
                            <ResponsiveContainer width="100%" height={260}>
                                <LineChart data={ratioTrend} margin={{ top: 5, right: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                                    <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                                    <Tooltip formatter={(v: number, name: string) => [`${v.toFixed(2)}%`, name]} />
                                    <Legend />
                                    <Line isAnimationActive={false} dataKey="NIM (ann.)" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3 }} />
                                    <Line isAnimationActive={false} dataKey="OER (ann.)" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="5 5" />
                                    <Line isAnimationActive={false} dataKey="ROA (ann.)" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>

                        {/* ROE + CRAR */}
                        <div className="bg-white rounded-xl border border-secondary-200 shadow-sm p-5">
                            <h3 className="text-sm font-bold text-secondary-800 uppercase tracking-wider mb-1">ROE & CRAR — 12-Month Trend</h3>
                            <p className="text-xs text-secondary-400 mb-4">Capital utilisation and adequacy</p>
                            <ResponsiveContainer width="100%" height={260}>
                                <ComposedChart data={ratioTrend} margin={{ top: 5, right: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                                    <YAxis yAxisId="left" tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                                    <YAxis yAxisId="right" orientation="right" tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} domain={[14, 25]} />
                                    <Tooltip formatter={(v: number, name: string) => [`${v.toFixed(2)}%`, name]} />
                                    <Legend />
                                    <Line isAnimationActive={false} yAxisId="left" dataKey="ROE (ann.)" stroke="#8b5cf6" strokeWidth={2.5} dot={{ r: 3 }} />
                                    <Bar isAnimationActive={false} yAxisId="right" dataKey="CRAR" fill="#d1fae5" stroke="#10b981" strokeWidth={1} radius={[3, 3, 0, 0]} name="CRAR %" />
                                    <ReferenceLine yAxisId="right" y={15} stroke="#ef4444" strokeDasharray="4 4"
                                        label={{ value: 'Min 15%', fill: '#ef4444', fontSize: 9, position: 'insideTopRight' }} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Ratio Scorecards */}
                        <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                                { label: 'NIM (ann.)', ourVal: nimAnn, benchmark: 11.2, topQ: 13.5, unit: '%', better: 'higher' as const },
                                { label: 'ROA (ann.)', ourVal: roaAnn, benchmark: 3.1, topQ: 4.8, unit: '%', better: 'higher' as const },
                                { label: 'ROE (ann.)', ourVal: roeAnn, benchmark: 18.0, topQ: 24.0, unit: '%', better: 'higher' as const },
                                { label: 'OER (ann.)', ourVal: oerAnn, benchmark: 6.2, topQ: 4.9, unit: '%', better: 'lower' as const },
                            ].map((item, i) => {
                                const isGood = item.better === 'higher' ? item.ourVal >= item.topQ : item.ourVal <= item.topQ;
                                const isAvg = item.better === 'higher' ? item.ourVal >= item.benchmark : item.ourVal <= item.benchmark;
                                const pct = item.better === 'higher'
                                    ? Math.min(100, (item.ourVal / item.topQ) * 100)
                                    : Math.min(100, (item.topQ / item.ourVal) * 100);
                                return (
                                    <div key={i} className="bg-white rounded-xl border border-secondary-200 shadow-sm p-4">
                                        <div className="text-xs font-bold text-secondary-500 uppercase tracking-wider mb-2">{item.label}</div>
                                        <div className={cn('text-2xl font-bold mb-1',
                                            isGood ? 'text-emerald-600' : isAvg ? 'text-amber-600' : 'text-rose-600'
                                        )}>{item.ourVal.toFixed(1)}{item.unit}</div>
                                        <div className="text-[10px] text-secondary-400 mb-2">
                                            Benchmark: {item.benchmark}{item.unit} · Top Q: {item.topQ}{item.unit}
                                        </div>
                                        <div className="w-full bg-secondary-100 rounded-full h-1.5">
                                            <div className="h-full rounded-full" style={{
                                                width: `${pct}%`,
                                                backgroundColor: isGood ? '#10b981' : isAvg ? '#f59e0b' : '#ef4444'
                                            }} />
                                        </div>
                                        <div className={cn('text-[10px] font-bold mt-1',
                                            isGood ? 'text-emerald-600' : isAvg ? 'text-amber-600' : 'text-rose-600'
                                        )}>{isGood ? '▲ Top Quartile' : isAvg ? '◆ Industry Avg' : '▼ Below Average'}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )
            }

            {/* ── FUNDING & SPREAD SECTION ─────────────────────────────────── */}
            {
                activeSection === 'funding' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                        {/* Yield vs CoF Spread */}
                        <div className="bg-white rounded-xl border border-secondary-200 shadow-sm p-5">
                            <h3 className="text-sm font-bold text-secondary-800 uppercase tracking-wider mb-1">
                                Yield on Portfolio vs Cost of Funds
                            </h3>
                            <p className="text-xs text-secondary-400 mb-4">Net spread = Yield − CoF (%)</p>
                            <ResponsiveContainer width="100%" height={260}>
                                <ComposedChart data={spreadTrend} margin={{ top: 5, right: 20 }}>
                                    <defs>
                                        <linearGradient id="yieldGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.15} />
                                            <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="cofGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.15} />
                                            <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                                    <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} domain={[8, 26]} />
                                    <Tooltip formatter={(v: number, name: string) => [`${v.toFixed(2)}%`, name]} />
                                    <Legend />
                                    <Area isAnimationActive={false} dataKey="Yield on Portfolio" stroke="#0ea5e9" strokeWidth={2.5} fill="url(#yieldGrad)" dot={false} />
                                    <Area isAnimationActive={false} dataKey="Cost of Funds" stroke="#f43f5e" strokeWidth={2} fill="url(#cofGrad)" dot={false} />
                                    <Line isAnimationActive={false} dataKey="Net Spread" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Borrowings vs GLP */}
                        <div className="bg-white rounded-xl border border-secondary-200 shadow-sm p-5">
                            <h3 className="text-sm font-bold text-secondary-800 uppercase tracking-wider mb-1">
                                Borrowings vs GLP — Leverage Ratio
                            </h3>
                            <p className="text-xs text-secondary-400 mb-4">Debt funding vs portfolio size (₹ Cr)</p>
                            <ResponsiveContainer width="100%" height={260}>
                                <ComposedChart data={borrowingsTrend} margin={{ top: 5, right: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                                    <YAxis tickFormatter={v => `₹${v}`} tick={{ fontSize: 11 }} />
                                    <Tooltip formatter={(v: number, name: string) => [`₹${v.toFixed(0)} Cr`, name]} />
                                    <Legend />
                                    <Bar isAnimationActive={false} dataKey="GLP" fill="#e0e7ff" stroke="#6366f1" strokeWidth={1} radius={[3, 3, 0, 0]} name="GLP" />
                                    <Line isAnimationActive={false} dataKey="Borrowings" stroke="#f43f5e" strokeWidth={2.5} dot={{ r: 3 }} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Funding Mix (static) */}
                        <div className="lg:col-span-2 bg-white rounded-xl border border-secondary-200 shadow-sm p-5">
                            <h3 className="text-sm font-bold text-secondary-800 uppercase tracking-wider mb-4">
                                Indicative Funding Mix — {selectedMonth} 2025
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {[
                                    { source: 'Bank Term Loans', pct: 55, amount: (sn(monthData.borrowings) * 0.55), color: '#6366f1', cof: 10.8 },
                                    { source: 'Non-Convertible Debentures', pct: 25, amount: (sn(monthData.borrowings) * 0.25), color: '#0ea5e9', cof: 11.5 },
                                    { source: 'NBFC-MFI Refinance', pct: 15, amount: (sn(monthData.borrowings) * 0.15), color: '#10b981', cof: 12.2 },
                                    { source: 'Equity & Grants', pct: 5, amount: (sn(monthData.borrowings) * 0.05), color: '#f59e0b', cof: 0 },
                                ].map((item, i) => (
                                    <div key={i} className="bg-secondary-50 rounded-xl border border-secondary-100 p-4">
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                                            <span className="text-xs font-semibold text-secondary-700">{item.source}</span>
                                        </div>
                                        <div className="text-2xl font-bold text-secondary-900 mb-1">{item.pct}%</div>
                                        <div className="text-xs text-secondary-500 mb-2">₹{item.amount.toFixed(0)} Cr</div>
                                        <div className="w-full bg-secondary-200 rounded-full h-1.5 mb-2">
                                            <div className="h-full rounded-full" style={{ width: `${item.pct}%`, backgroundColor: item.color }} />
                                        </div>
                                        {item.cof > 0 && (
                                            <div className="text-[10px] text-secondary-400">CoF: {item.cof}%</div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <div className="mt-4 p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                                <div className="flex gap-6 text-sm">
                                    <div><span className="font-bold text-indigo-800">Total Borrowings:</span> <span className="text-indigo-700">{fc(sn(monthData.borrowings), 0)}</span></div>
                                    <div><span className="font-bold text-indigo-800">Wtd. Avg CoF:</span> <span className="text-indigo-700">{fp(sn(monthData.costOfFunds), 1)}</span></div>
                                    <div><span className="font-bold text-indigo-800">Debt-to-GLP:</span> <span className="text-indigo-700">{(sn(monthData.borrowings) / sn(monthData.glp, 1) * 100).toFixed(0)}%</span></div>
                                    <div><span className="font-bold text-indigo-800">CRAR:</span> <span className="text-emerald-700 font-bold">{fp(sn(monthData.crar), 1)}</span></div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* ── REGULATORY COMPLIANCE SECTION ─────────────────────────────── */}
            {
                activeSection === 'regulatory' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                        {/* Compliance Table */}
                        <div className="bg-white rounded-xl border border-secondary-200 shadow-sm p-5">
                            <h3 className="text-sm font-bold text-secondary-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <ShieldCheck size={14} className="text-emerald-500" />
                                RBI / MFIN Regulatory Compliance — {selectedMonth} 2025
                            </h3>
                            <div className="space-y-2">
                                {REGULATORY_COMPLIANCE.map((row, i) => (
                                    <div key={i} className="flex items-center justify-between py-2.5 border-b border-secondary-50 last:border-0">
                                        <div>
                                            <div className="text-xs font-semibold text-secondary-800">{row.metric}</div>
                                            <div className="text-[10px] text-secondary-400">Norm: {row.norm}</div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-sm font-bold text-secondary-700">{row.actual.toFixed(1)}{row.unit}</span>
                                            <span className={cn(
                                                'text-[10px] font-bold px-2 py-1 rounded-full',
                                                row.status === 'Compliant' ? 'bg-emerald-100 text-emerald-700' :
                                                    row.status === 'Warning' ? 'bg-amber-100 text-amber-700' :
                                                        'bg-rose-100 text-rose-700'
                                            )}>
                                                {row.status === 'Compliant' ? '✓' : '!'} {row.status}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-4 p-3 bg-emerald-50 rounded-lg border border-emerald-100 text-xs text-emerald-700 font-medium">
                                ✓ {REGULATORY_COMPLIANCE.filter(r => r.status === 'Compliant').length} of {REGULATORY_COMPLIANCE.length} parameters compliant.
                                {REGULATORY_COMPLIANCE.filter(r => r.status !== 'Compliant').length > 0 &&
                                    ` ${REGULATORY_COMPLIANCE.filter(r => r.status !== 'Compliant').length} require attention.`}
                            </div>
                        </div>

                        {/* State Regulatory Summary */}
                        <div className="bg-white rounded-xl border border-secondary-200 shadow-sm p-5">
                            <h3 className="text-sm font-bold text-secondary-800 uppercase tracking-wider mb-4">State-wise Regulatory Summary</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-secondary-50 border-b border-secondary-200">
                                        <tr>
                                            {['State', 'QA%', 'HH Inc%', 'IRR%', 'Multi-L%', 'CollEff%'].map(h => (
                                                <th key={h} className="py-2 px-2 text-[10px] font-semibold text-secondary-500 text-right first:text-left whitespace-nowrap">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-secondary-100">
                                        {stateFinancialRows.map((row, i) => (
                                            <tr key={i} className="hover:bg-secondary-50">
                                                <td className="py-2 px-2 text-xs font-semibold text-secondary-800">{row.name}</td>
                                                <td className="py-2 px-2 text-xs text-right">
                                                    <span className={row.qualifyingAssetPct >= 85 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                                                        {row.qualifyingAssetPct.toFixed(1)}
                                                    </span>
                                                </td>
                                                <td className="py-2 px-2 text-xs text-right">
                                                    <span className={row.householdIncomePct >= 90 ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>
                                                        {row.householdIncomePct.toFixed(1)}
                                                    </span>
                                                </td>
                                                <td className="py-2 px-2 text-xs text-right">
                                                    <span className={row.irrPct <= 24 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                                                        {row.irrPct.toFixed(1)}
                                                    </span>
                                                </td>
                                                <td className="py-2 px-2 text-xs text-right">
                                                    <span className={row.multiLenderPct < 20 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                                                        {row.multiLenderPct.toFixed(1)}
                                                    </span>
                                                </td>
                                                <td className="py-2 px-2 text-xs text-right">
                                                    <span className={cn('font-bold', row.collectionEfficiency >= 98 ? 'text-emerald-600' : row.collectionEfficiency >= 96 ? 'text-amber-600' : 'text-rose-600')}>
                                                        {row.collectionEfficiency.toFixed(1)}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* ── BENCHMARKS SECTION ─────────────────────────────────────────── */}
            {
                activeSection === 'benchmarks' && (
                    <div className="bg-white rounded-xl border border-secondary-200 shadow-sm p-5">
                        <h3 className="text-sm font-bold text-secondary-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <BarChart2 size={14} className="text-blue-500" />
                            Industry Benchmarks vs Our Performance — MFIN 2024
                        </h3>
                        <div className="space-y-4">
                            {INDUSTRY_BENCHMARKS.map((row, i) => {
                                const isGood = row.better === 'higher' ? row.ourValue >= row.topQuartile : row.ourValue <= row.topQuartile;
                                const isAvg = row.better === 'higher' ? row.ourValue >= row.industryAvg : row.ourValue <= row.industryAvg;
                                const pct = Math.min(100, row.better === 'higher'
                                    ? (row.ourValue / (row.topQuartile * 1.1)) * 100
                                    : (row.topQuartile / row.ourValue * 1.1) * 100
                                );
                                return (
                                    <div key={i} className="flex flex-col sm:grid sm:grid-cols-12 sm:items-center gap-2 sm:gap-4 p-3 rounded-lg hover:bg-secondary-50 transition-colors">
                                        <div className="sm:col-span-3 text-sm font-semibold text-secondary-700">{row.metric}</div>
                                        <div className="sm:col-span-2 flex justify-between sm:block text-xs text-secondary-400 sm:text-right">
                                            <div>Indust: <strong>{row.industryAvg}{row.unit}</strong></div>
                                            <div>Top Q: <strong className="text-indigo-600">{row.topQuartile}{row.unit}</strong></div>
                                        </div>
                                        <div className="sm:col-span-5 relative h-4 w-full bg-secondary-100 rounded-full overflow-hidden">
                                            <div className="absolute inset-y-0 bg-secondary-300 w-0.5"
                                                style={{ left: `${(row.industryAvg / (row.topQuartile * 1.1)) * 100}%` }} />
                                            <div className="absolute inset-y-0 left-0 rounded-full transition-all"
                                                style={{
                                                    width: `${Math.min(100, (row.ourValue / (row.topQuartile * 1.1)) * 100)}%`,
                                                    backgroundColor: isGood ? '#10b981' : isAvg ? '#f59e0b' : '#ef4444'
                                                }} />
                                        </div>
                                        <div className="sm:col-span-2 flex items-center gap-2 justify-between sm:justify-end">
                                            <span className={cn('text-sm font-bold', isGood ? 'text-emerald-600' : isAvg ? 'text-amber-600' : 'text-rose-600')}>
                                                {row.ourValue.toFixed(1)}{row.unit}
                                            </span>
                                            <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0',
                                                isGood ? 'bg-emerald-100 text-emerald-700' : isAvg ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                                            )}>
                                                {isGood ? 'TOP' : isAvg ? 'AVG' : 'LAGGING'}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )
            }

            {/* ── VINTAGE ANALYSIS ──────────────────────────────────────────── */}
            {
                activeSection === 'vintage' && (
                    <div className="bg-white rounded-xl border border-secondary-200 shadow-sm p-5">
                        <h3 className="text-sm font-bold text-secondary-800 uppercase tracking-wider mb-2">
                            Loan Vintage Analysis — PAR 30% by Disbursement Cohort
                        </h3>
                        <p className="text-xs text-secondary-400 mb-4">
                            PAR progression at 3, 6, and 12 months after disbursement. Cycle 2+ shows significantly better credit quality.
                        </p>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-secondary-50 border-b border-secondary-200">
                                    <tr>
                                        {['Cohort', 'Loan Cycle', 'Active Loans', 'Loans Closed', 'PAR @ 3M', 'PAR @ 6M', 'PAR @ 12M', 'Write-off (Cr)'].map(h => (
                                            <th key={h} className="py-2.5 px-3 text-xs font-semibold text-secondary-500 whitespace-nowrap">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-secondary-100">
                                    {VINTAGE_DATA.map((row, i) => (
                                        <tr key={i} className="hover:bg-secondary-50">
                                            <td className="py-2.5 px-3 text-xs font-semibold text-secondary-800">{row.disbursementMonth} '25</td>
                                            <td className="py-2.5 px-3 text-xs">
                                                <span className={cn('px-2 py-0.5 rounded text-[10px] font-bold',
                                                    row.loanCycle === 1 ? 'bg-blue-100 text-blue-700' :
                                                        row.loanCycle === 2 ? 'bg-indigo-100 text-indigo-700' :
                                                            row.loanCycle === 3 ? 'bg-purple-100 text-purple-700' :
                                                                'bg-fuchsia-100 text-fuchsia-700'
                                                )}>
                                                    Cycle {row.loanCycle}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-3 text-xs text-secondary-700">{row.loansActive.toLocaleString()}</td>
                                            <td className="py-2.5 px-3 text-xs text-secondary-500">{row.loansClosed.toLocaleString()}</td>
                                            <td className="py-2.5 px-3 text-xs font-mono">
                                                <span className={row.par30AtM3 > 3 ? 'text-rose-600 font-bold' : 'text-secondary-600'}>{row.par30AtM3.toFixed(2)}%</span>
                                            </td>
                                            <td className="py-2.5 px-3 text-xs font-mono">
                                                <span className={row.par30AtM6 > 3 ? 'text-rose-600 font-bold' : 'text-secondary-600'}>{row.par30AtM6.toFixed(2)}%</span>
                                            </td>
                                            <td className="py-2.5 px-3 text-xs font-mono">
                                                <span className={row.par30AtM12 > 3 ? 'text-rose-600 font-bold' : 'text-secondary-600'}>{row.par30AtM12.toFixed(2)}%</span>
                                            </td>
                                            <td className="py-2.5 px-3 text-xs font-mono text-secondary-600">₹{row.writeOff.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <p className="text-[10px] text-secondary-400 mt-4">
                            Cycle 2+ loans consistently show lower PAR — the value of repeat borrower screening. Higher early PAR in Cycle 1 is expected for first-time credit borrowers.
                        </p>
                    </div>
                )
            }
        </div >
    );
};

export default FinancialDashboard;
