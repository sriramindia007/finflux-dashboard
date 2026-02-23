/**
 * Executive Dashboard — FINFLUX Analytics
 * Designed for: CEO, CFO, COO, Board Members
 * Single screen. 3 questions answered in <60 seconds:
 *   1. Are we growing?  2. Is portfolio healthy?  3. Are we profitable?
 */
import { useState, useRef } from 'react';
import { Download, ArrowRight, TrendingUp, TrendingDown, Minus, Camera } from 'lucide-react';
import { saveFile, exportToPDF, exportToPPT } from '../lib/utils';
import { Link } from 'react-router-dom';
import {
    AreaChart, Area, BarChart, Bar, ResponsiveContainer, Tooltip,
    XAxis, YAxis, CartesianGrid, ReferenceLine, Legend
} from 'recharts';
import { cn } from '../lib/utils';
import { COMPANY_METRICS, STATES_DATA, COMPANY_HISTORY } from '../data/mfiData';
import { ALL_STATES_DATA, TOTAL_BRANCHES_COUNT, TOTAL_WRITEOFF } from '../data/geoDataComplete';
import { CURRENT_FINANCIALS } from '../data/financeData';  // portfolio yield from contracts

const sn = (v: number | undefined | null, fb = 0) =>
    (v == null || !isFinite(v as number) || isNaN(v as number)) ? fb : (v as number);

// ── Quick helpers ─────────────────────────────────────────────────────────────
const fc = (v: number) => `₹${v.toFixed(0)} Cr`;
const fp = (v: number, d = 1) => `${v.toFixed(d)}%`;
const fL = (v: number) => `${(v / 100000).toFixed(2)} L`;

const HomeDashboard = () => {
    const slide1Ref = useRef<HTMLDivElement>(null);
    const slide2Ref = useRef<HTMLDivElement>(null);
    const [selectedRegion, setSelectedRegion] = useState('All');
    const availableStates = ALL_STATES_DATA.map(s => s.name).sort();

    // ── Data resolution: All vs single state ────────────────────────────────
    const getRegionKey = (r: string) => {
        const l = r.toLowerCase().replace(/\s/g, '');
        if (l === 'andhrapradesh') return 'andhra';
        if (l === 'madhyapradesh') return 'madhyaPradesh';
        if (l === 'tamilnadu') return 'tamilNadu';
        return l;
    };
    const stateMetrics = selectedRegion === 'All'
        ? null
        : STATES_DATA[getRegionKey(selectedRegion) as keyof typeof STATES_DATA];
    const isNational = selectedRegion === 'All' || !stateMetrics;
    const m = isNational
        ? { ...COMPANY_METRICS, totalBranches: TOTAL_BRANCHES_COUNT }
        : stateMetrics!;

    // ── Trend computations from real history ─────────────────────────────────
    const hist = isNational
        ? COMPANY_HISTORY
        : (stateMetrics?.history || COMPANY_HISTORY);
    const last = hist[hist.length - 1];
    const prev = hist[hist.length - 2];
    const first = hist[0];

    // YoY proxy: first month of FY vs current (within-FY growth)
    const glpYoY = first.glp > 0 ? ((last.glp - first.glp) / first.glp * 100) : 0;
    const clientYoY = first.activeClients > 0 ? ((last.activeClients - first.activeClients) / first.activeClients * 100) : 0;
    const parMoM = last.par30 - prev.par30;    // negative = improving
    const collMoM = prev.collection > 0 ? ((last.collection - prev.collection) / prev.collection * 100) : 0;

    // ── Single authoritative source per metric (avoids dual-source inconsistency) ──
    // Rule: COMPANY_HISTORY = source for GLP, PAR, collection, clients, disbursement
    //       CURRENT_FINANCIALS = source for NIM, ROA, OER, CRAR (only place computed)
    const currentGLP = last.glp;                              // ₹ Cr, history model
    const currentPAR = last.par30;                            // %, history model
    const currentPAR90 = last.par90;                            // %, history model
    const currentClientsCount = last.activeClients;             // count, history model

    // YTD totals — all from same hist array
    const ytdDisb = hist.reduce((s: number, x: any) => s + x.disbursement, 0);
    const ytdColl = hist.reduce((s: number, x: any) => s + x.collection, 0);
    const ytdDue = hist.reduce((s: number, x: any) => s + x.collectionDue, 0);
    const nationalDisbTarget = COMPANY_METRICS.ytdDisbursementTarget || 18500;
    const nationalYtdDisb = COMPANY_METRICS.ytdDisbursement;
    const ytdDisbTarget = isNational
        ? nationalDisbTarget
        : (ytdDisb * (nationalDisbTarget / nationalYtdDisb));

    // MTD efficiency — from same hist array (last month)
    const mtdCollected = last.collection;
    const mtdDue = last.collectionDue;
    const mtdEff = mtdDue > 0 ? (mtdCollected / mtdDue * 100) : 98.5;
    const ytdCollEff = ytdDue > 0 ? (ytdColl / ytdDue * 100) : 98.5;

    // Branch count
    const selectedStateGeo = selectedRegion === 'All' ? null : ALL_STATES_DATA.find(s => s.name === selectedRegion);
    const branchCount = isNational
        ? TOTAL_BRANCHES_COUNT
        : (selectedStateGeo ? (selectedStateGeo.branchCount || 0) : 0);

    // ── State league (uses STATES_DATA which is STATE_HISTORY — same model as COMPANY_HISTORY) ──
    const stateLeague = ALL_STATES_DATA.map(s => {
        const key = getRegionKey(s.name);
        const sd = STATES_DATA[key as keyof typeof STATES_DATA];
        // State efficiency: same formula as national (last month collection / due)
        const stHist = sd?.history;
        const stLast = stHist ? stHist[stHist.length - 1] : null;
        const eff = stLast && stLast.collectionDue > 0
            ? (stLast.collection / stLast.collectionDue * 100)
            : (sn(sd?.mtdCollectionDue) > 0 ? (sn(sd?.mtdCollection) / sn(sd?.mtdCollectionDue) * 100) : 98.0);
        const glp = sn(sd?.glp);    // sd.glp = STATE_HISTORY[state][currentIdx].glp
        const par = sn(sd?.par30);  // sd.par30 = STATE_HISTORY[state][currentIdx].par30
        const rag = par < 2 ? 'green' : par < 4 ? 'amber' : 'red';
        const branches = s.branchCount || s.districts.reduce((sum, d) => sum + d.branches.length, 0);
        return { name: s.name, glp, par, eff, branches, rag };
    }).sort((a, b) => b.glp - a.glp);

    // Verify: state league GLP sum should ≈ national GLP (both from same STATE_HISTORY model)
    const stateGLPSum = stateLeague.reduce((s, x) => s + x.glp, 0);

    // ── Chart data ────────────────────────────────────────────────────────────
    const chartData = hist.map((x: any) => ({
        month: x.month,
        GLP: parseFloat(x.glp.toFixed(0)),
        Disbursement: parseFloat(x.disbursement.toFixed(0)),
        PAR30: parseFloat(x.par30.toFixed(2)),
    }));

    // ── MFI Lending Badge Row — ALL computable from FINFLUX LMS (lending side) ──────────────
    const portfolioYield = sn(CURRENT_FINANCIALS.yieldOnPortfolio, 22.5);        // from loan contract rates
    const loanAtRiskCr = parseFloat((currentGLP * currentPAR / 100).toFixed(0)); // PAR% × GLP = ₹ exposure
    const writeoffRate = TOTAL_WRITEOFF > 0 ? ((TOTAL_WRITEOFF / currentGLP) * 100) : 0.18;
    const disbAchievement = (ytdDisb / (COMPANY_METRICS.ytdDisbursementTarget || 18500)) * 100;
    const avgTicketK = currentClientsCount > 0
        ? parseFloat(((currentGLP * 10000) / currentClientsCount).toFixed(1)) : 18.0; // ₹k per borrower
    const badges = [
        { label: 'Portfolio Yield', value: fp(portfolioYield, 1), bench: 'Contract rates', ok: portfolioYield <= 24 },
        { label: 'Loan at Risk', value: `₹${loanAtRiskCr} Cr`, bench: `PAR ${fp(currentPAR, 1)} of GLP`, ok: currentPAR <= 3.6 },
        { label: 'GNPA (PAR 90+)', value: fp(currentPAR90, 2), bench: 'Ind 0.8%', ok: currentPAR90 <= 0.8 },
        { label: 'Write-off Rate', value: fp(writeoffRate, 2), bench: '% of GLP', ok: writeoffRate <= 0.5 },
        { label: 'Disb. Achievement', value: fp(disbAchievement, 1), bench: 'vs FY Target', ok: disbAchievement >= 80 },
        { label: 'Avg Ticket Size', value: `₹${avgTicketK}k`, bench: 'Per borrower', ok: true },
    ];

    const getReportRows = () => [
        ['Metric', 'Value'],
        ['GLP (Cr)', fc(last.glp)],
        ['Active Clients', fL(last.activeClients)],
        ['Branches', branchCount.toString()],
        ['YTD Disbursement (Cr)', ytdDisb.toFixed(0)],
        ['YTD Collection (Cr)', ytdColl.toFixed(0)],
        ['YTD Collection Efficiency (%)', ytdCollEff.toFixed(2)],
        ['PAR 30+ (%)', fp(last.par30, 2)],
        ['GNPA / PAR 90+ (%)', fp(last.par90, 2)],
        ['Portfolio Yield (%)', fp(portfolioYield, 1)],
        ['Loan at Risk (Cr)', `₹${loanAtRiskCr}`],
        ['Write-off Rate (%)', fp(writeoffRate, 2)],
    ];

    const getFilename = (ext: string) => `FINFLUX_Executive_${selectedRegion}_${new Date().toISOString().slice(0, 10)}.${ext}`;

    const handleExportExcel = async () => {
        // Dynamic import to prevent main-thread blocking
        const XLSX = await import('xlsx');

        const summaryRows = [
            ['FINFLUX Executive Report — FY 2025-26'],
            ['Region', selectedRegion],
            ['Generated', new Date().toLocaleString('en-IN')],
            [],
            ...getReportRows()
        ];

        const stateRows = [
            ['State Portfolio Scorecard — FY 2025-26'],
            [],
            ['State', 'GLP (Cr)', 'PAR 30+ (%)', 'Collection Efficiency (%)', 'Branches', 'RAG Status'],
            ...stateLeague.map(s => [
                s.name,
                s.glp,
                s.par,
                s.eff,
                s.branches,
                s.rag.toUpperCase()
            ]),
            ['TOTAL / WTDAVG',
                parseFloat(stateLeague.reduce((s, x) => s + x.glp, 0).toFixed(0)),
                parseFloat((stateLeague.reduce((s, x) => s + x.par * x.glp, 0) / stateLeague.reduce((s, x) => s + x.glp, 0)).toFixed(2)),
                parseFloat((stateLeague.reduce((s, x) => s + x.eff, 0) / stateLeague.length).toFixed(1)),
                stateLeague.reduce((s, x) => s + x.branches, 0),
                ''
            ]
        ];

        const trendRows = [
            ['Monthly Trend Data — FY 2025-26'],
            [],
            ['Month', 'GLP (Cr)', 'Disbursement (Cr)', 'PAR 30+ (%)'],
            ...chartData.map((d: any) => [d.month, d.GLP, d.Disbursement, d.PAR30])
        ];

        const wb = XLSX.utils.book_new();

        // Add worksheets
        const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
        const wsStates = XLSX.utils.aoa_to_sheet(stateRows);
        const wsTrends = XLSX.utils.aoa_to_sheet(trendRows);

        XLSX.utils.book_append_sheet(wb, wsSummary, "Executive Summary");
        XLSX.utils.book_append_sheet(wb, wsStates, "State Scorecard");
        XLSX.utils.book_append_sheet(wb, wsTrends, "Monthly Trends");

        const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        saveFile(new Blob([out], { type: 'application/octet-stream' }), getFilename('xlsx'));
    };

    const handleExportPDF = async () => {
        if (!slide1Ref.current || !slide2Ref.current) return;
        try { await exportToPDF([slide1Ref as React.RefObject<HTMLElement>, slide2Ref as React.RefObject<HTMLElement>], getFilename('pdf')); }
        catch (e) { console.error(e); alert('Error generating PDF. Check console for details.'); }
    };

    const handleExportPPT = async () => {
        if (!slide1Ref.current || !slide2Ref.current) return;
        try { await exportToPPT([slide1Ref as React.RefObject<HTMLElement>, slide2Ref as React.RefObject<HTMLElement>], getFilename('pptx')); }
        catch (e) { console.error(e); alert('Error generating PPT. Check console for details.'); }
    };

    const RagDot = ({ rag }: { rag: string }) => (
        <span className={cn('inline-block w-2 h-2 rounded-full',
            rag === 'green' ? 'bg-emerald-500' : rag === 'amber' ? 'bg-amber-400' : 'bg-rose-500')} />
    );

    const Delta = ({ val, inverse = false }: { val: number; inverse?: boolean }) => {
        const good = inverse ? val <= 0 : val >= 0;
        const Icon = val === 0 ? Minus : good ? TrendingUp : TrendingDown;
        return (
            <span className={cn('inline-flex items-center gap-0.5 text-xs font-semibold',
                good ? 'text-emerald-600' : 'text-rose-600')}>
                <Icon size={12} /> {val >= 0 ? '+' : ''}{val.toFixed(1)}%
            </span>
        );
    };

    return (
        <div className="space-y-5 flex flex-col items-center relative">

            {/* ══════════════ DASHBOARD EXPORT TARGET 1 ══════════════════════════════════════ */}
            <div ref={slide1Ref} className="space-y-5 w-full pb-2">
                {/* ══════════════ HEADER BAR ══════════════════════════════════════ */}
                <div className="bg-gradient-to-r from-slate-900 via-primary-900 to-indigo-900 rounded-xl px-6 py-4 text-white shadow-xl">
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">

                        {/* Left: Title + context */}
                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary-300 mb-0.5">
                                FINFLUX Analytics
                            </div>
                            <h2 className="text-2xl font-bold">Executive Dashboard</h2>
                            <p className="text-white/60 text-xs mt-0.5">
                                FY 2025-26 · As of February 2026 · All values in ₹ Crore
                            </p>
                        </div>

                        {/* Centre: 6 financial health badges */}
                        <div className="flex flex-wrap gap-2">
                            {badges.map((b, i) => (
                                <div key={i} className={cn(
                                    'px-2.5 py-1.5 rounded-lg border text-center min-w-[68px]',
                                    b.ok
                                        ? 'bg-emerald-500/15 border-emerald-400/30'
                                        : 'bg-rose-500/15 border-rose-400/30'
                                )}>
                                    <div className="text-[9px] uppercase tracking-widest text-white/60 font-bold">{b.label}</div>
                                    <div className={cn('text-base font-bold', b.ok ? 'text-emerald-300' : 'text-rose-300')}>
                                        {b.value}
                                    </div>
                                    <div className="text-[8px] text-white/40">{b.bench}</div>
                                </div>
                            ))}
                        </div>

                        {/* Right: Controls */}
                        <div className="flex items-center gap-2">
                            <select
                                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white outline-none"
                                style={{ colorScheme: 'dark' }}
                                value={selectedRegion}
                                onChange={e => setSelectedRegion(e.target.value)}
                            >
                                <option value="All" className="bg-slate-900">All States</option>
                                {availableStates.map(s => <option key={s} value={s} className="bg-slate-900">{s}</option>)}
                            </select>
                            <div className="relative group z-50">
                                <button className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white hover:bg-white/20 flex items-center gap-1.5 transition-colors">
                                    <Download size={14} /> Export
                                </button>
                                <div className="absolute right-0 top-full pt-2 w-48 hidden group-hover:block z-[100]">
                                    <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-xl border border-secondary-200 overflow-hidden">
                                        <button onClick={handleExportExcel} className="w-full text-left px-4 py-3 text-sm font-medium text-slate-800 hover:bg-primary-50 hover:text-primary-600 transition-colors border-b border-secondary-100 flex justify-between items-center">Excel (.xlsx) <Download size={14} /></button>
                                        <button onClick={handleExportPDF} className="w-full text-left px-4 py-3 text-sm font-medium text-slate-800 hover:bg-primary-50 hover:text-primary-600 transition-colors border-b border-secondary-100 flex justify-between items-center">PDF Screenshot <Camera size={14} /></button>
                                        <button onClick={handleExportPPT} className="w-full text-left px-4 py-3 text-sm font-medium text-slate-800 hover:bg-primary-50 hover:text-primary-600 transition-colors flex justify-between items-center">PPT Screenshot <Camera size={14} /></button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ══════════════ ROW 1: 5 HEADLINE NUMBERS ═══════════════════════
                The CEO's first look. One number per strategic pillar.
            ══════════════════════════════════════════════════════════════════ */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">

                    {/* 1. GLP — Scale of the book */}
                    <div className="bg-white rounded-xl border-l-4 border-l-indigo-500 border border-secondary-200 shadow-sm p-4">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-secondary-400 mb-1">Gross Loan Portfolio</div>
                        <div className="text-2xl font-bold text-secondary-900">{fc(currentGLP)}</div>
                        <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-secondary-400">FY growth</span>
                            <Delta val={glpYoY} />
                        </div>
                    </div>

                    {/* 2. Active Clients — Reach */}
                    <div className="bg-white rounded-xl border-l-4 border-l-blue-500 border border-secondary-200 shadow-sm p-4">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-secondary-400 mb-1">Active Clients</div>
                        <div className="text-2xl font-bold text-secondary-900">{fL(currentClientsCount)}</div>
                        <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-secondary-400">FY growth</span>
                            <Delta val={clientYoY} />
                        </div>
                    </div>

                    {/* 3. Collection Efficiency — Heartbeat */}
                    <div className="bg-white rounded-xl border-l-4 border-l-emerald-500 border border-secondary-200 shadow-sm p-4">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-secondary-400 mb-1">Collection Efficiency</div>
                        <div className={cn('text-2xl font-bold', mtdEff >= 99 ? 'text-emerald-700' : mtdEff >= 97 ? 'text-amber-700' : 'text-rose-700')}>
                            {fp(mtdEff)}
                        </div>
                        <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-secondary-400">vs 99% target</span>
                            <span className={cn('text-xs font-bold', mtdEff >= 99 ? 'text-emerald-600' : mtdEff >= 97 ? 'text-amber-600' : 'text-rose-600')}>
                                {mtdEff >= 99 ? '✓ On Track' : mtdEff >= 97 ? '◉ Monitor' : '⚠ Below'}
                            </span>
                        </div>
                    </div>

                    {/* 4. PAR 30+ — Risk pulse */}
                    <div className={cn('bg-white rounded-xl border-l-4 border border-secondary-200 shadow-sm p-4',
                        currentPAR <= 2 ? 'border-l-emerald-500' : currentPAR <= 4 ? 'border-l-amber-500' : 'border-l-rose-500'
                    )}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-secondary-400 mb-1">PAR 30+ (Overdue Risk)</div>
                        <div className={cn('text-2xl font-bold',
                            currentPAR <= 2 ? 'text-emerald-700' : currentPAR <= 4 ? 'text-amber-700' : 'text-rose-700'
                        )}>
                            {fp(currentPAR, 2)}
                        </div>
                        <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-secondary-400">GNPA: {fp(currentPAR90, 2)}</span>
                            <Delta val={parMoM} inverse />
                        </div>
                    </div>

                    {/* 5. Branches / YTD Disb — Operational scale */}
                    <div className="bg-white rounded-xl border-l-4 border-l-violet-500 border border-secondary-200 shadow-sm p-4">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-secondary-400 mb-1">
                            {isNational ? 'Network Scale' : `${selectedRegion} Scale`}
                        </div>
                        <div className="text-2xl font-bold text-secondary-900">{branchCount} <span className="text-sm font-normal text-secondary-400">branches</span></div>
                        <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-secondary-400">YTD Disb.</span>
                            <span className="text-xs font-bold text-violet-700">{fc(ytdDisb)}</span>
                        </div>
                    </div>
                </div>

                {/* ══════════════ ROW 2: TARGET HEALTH + CHARTS ════════════════════ */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                    {/* Target trackers — 3 stacked */}
                    <div className="bg-white rounded-xl border border-secondary-200 shadow-sm p-5 space-y-5">
                        <h3 className="text-xs font-bold text-secondary-400 uppercase tracking-widest">FY 2025-26 Targets</h3>

                        {/* Disbursement */}
                        <div>
                            <div className="flex justify-between mb-1.5">
                                <span className="text-xs font-semibold text-secondary-600">Disbursement</span>
                                <span className="text-xs font-bold text-secondary-800">{fc(ytdDisb)} / ₹{ytdDisbTarget.toLocaleString()} Cr</span>
                            </div>
                            <div className="w-full bg-secondary-100 rounded-full h-2">
                                <div className={cn('h-2 rounded-full', (ytdDisb / ytdDisbTarget * 100) >= 80 ? 'bg-primary-500' : 'bg-amber-500')}
                                    style={{ width: `${Math.min(100, ytdDisb / ytdDisbTarget * 100)} % ` }} />
                            </div>
                            <div className="flex justify-between mt-1">
                                <span className="text-[10px] text-secondary-400">YTD Achievement</span>
                                <span className="text-[10px] font-bold text-primary-700">{(ytdDisb / ytdDisbTarget * 100).toFixed(1)}%</span>
                            </div>
                        </div>

                        {/* Collection Efficiency */}
                        <div>
                            <div className="flex justify-between mb-1.5">
                                <span className="text-xs font-semibold text-secondary-600">Collection Efficiency</span>
                                <span className={cn('text-xs font-bold', ytdCollEff >= 98 ? 'text-emerald-700' : 'text-amber-700')}>{fp(ytdCollEff, 2)}</span>
                            </div>
                            <div className="w-full bg-secondary-100 rounded-full h-2">
                                <div className={cn('h-2 rounded-full', ytdCollEff >= 98 ? 'bg-emerald-500' : ytdCollEff >= 95 ? 'bg-amber-500' : 'bg-rose-500')}
                                    style={{ width: `${Math.min(100, ytdCollEff)} % ` }} />
                            </div>
                            <div className="flex justify-between mt-1">
                                <span className="text-[10px] text-secondary-400">₹{ytdColl.toFixed(0)} Cr collected of ₹{ytdDue.toFixed(0)} Cr due</span>
                                <span className="text-[10px] font-bold text-emerald-700">Target: 99%</span>
                            </div>
                        </div>

                        {/* PAR vs Industry */}
                        <div>
                            <div className="flex justify-between mb-1.5">
                                <span className="text-xs font-semibold text-secondary-600">PAR 30+ vs Industry</span>
                                <span className={cn('text-xs font-bold', currentPAR <= 3.6 ? 'text-emerald-700' : 'text-rose-700')}>{fp(currentPAR, 2)} vs 3.60%</span>
                            </div>
                            <div className="w-full bg-secondary-100 rounded-full h-2">
                                <div className={cn('h-2 rounded-full', currentPAR <= 3.6 ? 'bg-emerald-500' : 'bg-rose-500')}
                                    style={{ width: `${Math.min(100, (currentPAR / 6) * 100)} % ` }} />
                            </div>
                            <div className="flex justify-between mt-1">
                                <span className="text-[10px] text-secondary-400">Industry avg: 3.60%</span>
                                <span className={cn('text-[10px] font-bold', currentPAR <= 3.6 ? 'text-emerald-700' : 'text-rose-700')}>
                                    {currentPAR <= 3.6 ? `${(3.6 - currentPAR).toFixed(2)}% below — ✓ Good` : `${(currentPAR - 3.6).toFixed(2)}% above — ⚠ Watch`}
                                </span>
                            </div>
                        </div>

                        {/* MFI lending quick metrics */}
                        <div className="pt-3 border-t border-secondary-100 grid grid-cols-2 gap-2">
                            {[
                                { label: 'Write-off Rate', value: fp(writeoffRate, 2), ok: writeoffRate <= 0.5, sub: '% of GLP (LMS)' },
                                { label: 'Portfolio Yield', value: fp(portfolioYield, 1), ok: portfolioYield <= 24, sub: 'vs RBI 24% cap' },
                            ].map((item, i) => (
                                <div key={i} className={cn('rounded-lg p-2 text-center', item.ok ? 'bg-emerald-50' : 'bg-rose-50')}>
                                    <div className="text-[9px] uppercase tracking-wider text-secondary-400">{item.label}</div>
                                    <div className={cn('text-sm font-bold', item.ok ? 'text-emerald-700' : 'text-rose-700')}>{item.value}</div>
                                    <div className="text-[9px] text-secondary-400">{item.sub}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* GLP + Disbursement trend */}
                    <div className="lg:col-span-2 bg-white rounded-xl border border-secondary-200 shadow-sm p-5">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-xs font-bold text-secondary-700 uppercase tracking-widest">Portfolio Growth — FY 2025-26</h3>
                                <p className="text-[10px] text-secondary-400 mt-0.5">GLP &amp; Monthly Disbursements · Apr 2025 – Feb 2026 · ₹ Crore</p>
                            </div>
                            <div className="text-right">
                                <div className="text-lg font-bold text-primary-700">{fc(currentGLP)}</div>
                                <div className="text-xs font-semibold text-emerald-600">
                                    {glpYoY >= 0 ? '▲' : '▼'} {Math.abs(glpYoY).toFixed(1)}% FY growth
                                </div>
                            </div>
                        </div>
                        <ResponsiveContainer width="100%" height={185}>
                            <  data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.18} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.12} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v} `} />
                                <Tooltip formatter={(v: number, n: string) => [`₹${v.toFixed(0)} Cr`, n]} />
                                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                                <Area type="monotone" dataKey="GLP" stroke="#6366f1" strokeWidth={2.5} fill="url(#g1)" dot={false} />
                                <Area type="monotone" dataKey="Disbursement" stroke="#10b981" strokeWidth={2} fill="url(#g2)" dot={false} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* ══════════════ DASHBOARD EXPORT TARGET 2 ══════════════════════════════════════ */}
            <div ref={slide2Ref} className="space-y-5 w-full pb-2">

                {/* ══════════════ ROW 3: STATE SCORECARD ══════════════════════════
                C-suite view: "Where are the problems?" One clean table.
                Replace branch-level noise with state-level signal.
            ══════════════════════════════════════════════════════════════════ */}
                <div className="bg-white rounded-xl border border-secondary-200 shadow-sm p-5">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h3 className="text-sm font-bold text-secondary-800">State Portfolio Scorecard</h3>
                            <p className="text-xs text-secondary-400 mt-0.5">
                                {isNational
                                    ? 'All 8 states — click any row to drill in via Branch Dashboard'
                                    : `Showing national context · ${selectedRegion} highlighted`
                                }
                            </p>
                        </div>
                        <Link to="/branch" className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1">
                            Full Drill-down <ArrowRight size={12} />
                        </Link>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-secondary-50 text-secondary-400 text-[10px] uppercase tracking-wider border-b border-secondary-200">
                                    <th className="py-2.5 px-4 text-left">State</th>
                                    <th className="py-2.5 px-3 text-right">GLP (Cr)</th>
                                    <th className="py-2.5 px-3 text-right">PAR 30+</th>
                                    <th className="py-2.5 px-3 text-right">Coll. Eff.</th>
                                    <th className="py-2.5 px-3 text-right">Branches</th>
                                    <th className="py-2.5 px-3 text-center">RAG</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-secondary-100">
                                {stateLeague.map((s, i) => {
                                    const isSelected = s.name === selectedRegion;
                                    return (
                                        <tr key={i} className={cn(
                                            'hover:bg-primary-50/40 transition-colors',
                                            isSelected ? 'bg-primary-50 border-l-2 border-l-primary-500' : ''
                                        )}>
                                            <td className="py-2.5 px-4">
                                                <div className="flex items-center gap-2">
                                                    <RagDot rag={s.rag} />
                                                    <span className={cn('font-semibold', isSelected ? 'text-primary-700' : 'text-secondary-800')}>
                                                        {s.name}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-2.5 px-3 text-right font-bold text-secondary-800">
                                                ₹{s.glp.toFixed(0)}
                                            </td>
                                            <td className="py-2.5 px-3 text-right">
                                                <span className={cn('text-xs font-bold px-2 py-0.5 rounded',
                                                    s.par < 2 ? 'bg-emerald-100 text-emerald-700' :
                                                        s.par < 4 ? 'bg-amber-100 text-amber-700' :
                                                            'bg-rose-100 text-rose-700'
                                                )}>
                                                    {s.par.toFixed(2)}%
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-3 text-right">
                                                <span className={cn('text-xs font-semibold',
                                                    s.eff >= 98 ? 'text-emerald-700' : s.eff >= 96 ? 'text-amber-700' : 'text-rose-700'
                                                )}>
                                                    {s.eff.toFixed(1)}%
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-3 text-right text-secondary-500 text-xs">{s.branches}</td>
                                            <td className="py-2.5 px-3 text-center">
                                                <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full uppercase',
                                                    s.rag === 'green' ? 'bg-emerald-100 text-emerald-700' :
                                                        s.rag === 'amber' ? 'bg-amber-100 text-amber-700' :
                                                            'bg-rose-100 text-rose-700'
                                                )}>
                                                    {s.rag}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            {/* Summary footer */}
                            <tfoot className="bg-secondary-50 border-t-2 border-secondary-200">
                                <tr>
                                    <td className="py-2.5 px-4 text-xs font-bold text-secondary-500 uppercase">TOTAL / WTDAVG</td>
                                    <td className="py-2.5 px-3 text-right text-xs font-bold text-secondary-800">
                                        ₹{stateLeague.reduce((s, x) => s + x.glp, 0).toFixed(0)}
                                    </td>
                                    <td className="py-2.5 px-3 text-right text-xs font-bold text-secondary-700">
                                        {(stateLeague.reduce((s, x) => s + x.par * x.glp, 0) / stateLeague.reduce((s, x) => s + x.glp, 0)).toFixed(2)}%
                                    </td>
                                    <td className="py-2.5 px-3 text-right text-xs font-bold text-emerald-700">
                                        {(stateLeague.reduce((s, x) => s + x.eff, 0) / stateLeague.length).toFixed(1)}%
                                    </td>
                                    <td className="py-2.5 px-3 text-right text-xs font-bold text-secondary-600">
                                        {stateLeague.reduce((s, x) => s + x.branches, 0)}
                                    </td>
                                    <td />
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* ══════════════ ROW 4: PAR TREND + QUICK LINKS ══════════════════ */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                    {/* PAR trend — small but impactful */}
                    <div className="lg:col-span-2 bg-white rounded-xl border border-secondary-200 shadow-sm p-5">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-xs font-bold text-secondary-700 uppercase tracking-widest">Asset Quality Trend (PAR 30+)</h3>
                                <p className="text-[10px] text-secondary-400 mt-0.5">Monthly PAR % — lower is better · Industry benchmark: 3.60%</p>
                            </div>
                            <span className={cn('text-xs font-bold px-2 py-1 rounded-full',
                                last.par30 <= 3.6 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                            )}>
                                {last.par30.toFixed(2)}% current
                            </span>
                        </div>
                        <ResponsiveContainer width="100%" height={140}>
                            <  data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 'auto']} />
                                <ReferenceLine y={3.6} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Ind 3.6%', fontSize: 9, fill: '#ef4444', position: 'insideTopRight' }} />
                                <Tooltip formatter={(v: number) => [`${v.toFixed(2)}% `, 'PAR 30+']} />
                                <Bar dataKey="PAR30"
                                    radius={[3, 3, 0, 0]}
                                    fill="#f59e0b"
                                    name="PAR 30+"
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Quick navigation panel — "where do I go next?" */}
                    <div className="bg-white rounded-xl border border-secondary-200 shadow-sm p-5">
                        <h3 className="text-xs font-bold text-secondary-400 uppercase tracking-widest mb-4">Deep-dive Dashboards</h3>
                        <div className="space-y-2">
                            {[
                                { to: '/trends', label: 'Performance Trends', sub: 'GLP YoY, disbursement, PAR trend', color: 'bg-indigo-50 border-indigo-200 hover:border-indigo-400' },
                                { to: '/collections', label: 'Collections & Recovery', sub: 'Demand, DPD buckets, efficiency', color: 'bg-emerald-50 border-emerald-200 hover:border-emerald-400' },
                                { to: '/portfolio', label: 'Risk & Portfolio', sub: 'PAR, vintage, audit, regulatory', color: 'bg-rose-50 border-rose-200 hover:border-rose-400' },
                                { to: '/products', label: 'Product Analytics', sub: 'JLG, MSME, Housing mix', color: 'bg-amber-50 border-amber-200 hover:border-amber-400' },
                                { to: '/branch', label: 'Branch Operations', sub: 'State → District → Branch drill', color: 'bg-violet-50 border-violet-200 hover:border-violet-400' },
                                { to: '/geo', label: 'Geographic View', sub: 'Map-based portfolio spread', color: 'bg-sky-50 border-sky-200 hover:border-sky-400' },
                            ].map(item => (
                                <Link key={item.to} to={item.to}
                                    className={cn('flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all', item.color)}>
                                    <div>
                                        <div className="text-xs font-semibold text-secondary-800">{item.label}</div>
                                        <div className="text-[10px] text-secondary-400">{item.sub}</div>
                                    </div>
                                    <ArrowRight size={14} className="text-secondary-400 flex-shrink-0" />
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
};

export default HomeDashboard;
