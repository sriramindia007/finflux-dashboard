import { useState, useMemo } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { AlertTriangle, TrendingDown, ShieldAlert, BadgePercent, AlertCircle, ArrowUpRight, ArrowDownRight, FileDown, FileCheck, Banknote, UserCheck, Siren, Download, Camera } from 'lucide-react';
import { saveFile, exportToPDF, exportToPPT } from '../lib/utils';
import { useRef } from 'react';
import { COMPANY_METRICS, COMPANY_HISTORY } from '../data/mfiData';
import { VINTAGE_DATA, STATE_FINANCIALS, INDUSTRY_BENCHMARKS, CURRENT_FINANCIALS } from '../data/financeData';
import { useNavigate } from 'react-router-dom';
import { ALL_STATES_DATA, getFlatBranchList } from '../data/geoDataComplete';
import KPICard from '../components/KPICard';

// ── Portfolio maths (real rollup data) ────────────────────────────────────────
const portfolioTrendData = COMPANY_HISTORY.slice(-6).map(m => ({
    month: m.month,
    par30: m.par30,
    par90: m.par90,
    par180: m.par180 || (m.par90 * 0.4),
    npa: m.par90,
    collectionEff: (m.collection / m.collectionDue * 100)
}));

const cm = COMPANY_METRICS;
const par30 = parseFloat((cm.parOver30 ?? 0).toFixed(2));
const par60 = parseFloat((cm.par60 ?? par30 * 0.70).toFixed(2));
const par90 = parseFloat((cm.par90 ?? par30 * 0.45).toFixed(2));
const par180 = parseFloat((cm.par180 ?? par90 * 0.40).toFixed(2));
const sma0 = parseFloat(Math.max(0, par30 - par60).toFixed(2));
const sma1 = parseFloat(Math.max(0, par60 - par90).toFixed(2));
const sma2 = parseFloat(Math.max(0, par90 - par180).toFixed(2));
const hardcore = parseFloat(par180.toFixed(2));
const regular = parseFloat(Math.max(0, 100 - (sma0 + sma1 + sma2 + par90)).toFixed(2));

const riskBuckets = [
    { name: 'Regular', value: regular, color: '#10b981' },
    { name: 'SMA 0 (1-30)', value: sma0, color: '#f59e0b' },
    { name: 'SMA 1 (31-60)', value: sma1, color: '#f97316' },
    { name: 'SMA 2 (61-90)', value: sma2, color: '#ef4444' },
    { name: 'NPA (91-179)', value: parseFloat(Math.max(0, par90 - par180).toFixed(2)), color: '#b91c1c' },
    { name: 'Hardcore (180+)', value: hardcore, color: '#7e22ce' },
];

const stateWiseRisk = ALL_STATES_DATA.map(state => ({
    state: state.name,
    par: state.par30 || 0,
    par90: state.par90 || 0,
    par180: state.par180 || 0,
    glp: state.glp,
    writeOff: state.writeOff || 0,
    risk: (state.par30 || 0) > 3.0 ? 'High' : (state.par30 || 0) > 1.5 ? 'Medium' : 'Low'
})).sort((a, b) => b.par - a.par);

// ── Audit helpers ─────────────────────────────────────────────────────────────
const enrichWithAuditData = (branch: any, idx: number) => {
    const seed = idx * 137;
    const rand = (n: number) => ((seed * n) % 100) / 100;
    const isSurprise = rand(1) > 0.7;
    const auditScore = Math.floor(65 + rand(2) * 35);
    const cashBalance = Math.floor(rand(3) * 80000);
    const cashException = cashBalance > 50000;
    return {
        ...branch,
        auditProfile: {
            lastAuditType: isSurprise ? 'Surprise' : 'Regular',
            lastAuditDate: new Date(2025, 11, Math.floor(rand(7) * 30) + 1).toLocaleDateString(),
            score: auditScore,
            cashBalance,
            cashException,
            findings: {
                grt: rand(4) > 0.85,
                ghost: rand(5) > 0.95,
                meetings: rand(6) > 0.8,
                luc: (branch.lucPending || 0) > 10,
            }
        }
    };
};

// ── Main component ─────────────────────────────────────────────────────────────
const PortfolioDashboard = () => {
    const navigate = useNavigate();
    const exportRef = useRef<HTMLDivElement>(null);
    const [activeTab, setActiveTab] = useState<'portfolio' | 'audit' | 'vintage' | 'regulatory'>('portfolio');

    const mtdEfficiency = (COMPANY_METRICS.mtdCollection / COMPANY_METRICS.mtdCollectionDue * 100).toFixed(2);
    const writeOffVal = COMPANY_METRICS.ytdWriteoff;
    const currentGLP = COMPANY_METRICS.currentGLP || 8725;

    const handleAnalyze = (stateName: string) => navigate(`/branch?state=${encodeURIComponent(stateName)}`);

    const handleDownloadReport = () => {
        const headers = ['State', 'Portfolio (GLP)', 'PAR 30+', 'PAR 90+', 'PAR 180+', 'Write-offs (YTD)', 'Risk Level'];
        const rows = stateWiseRisk.map(row => [
            row.state, `₹${row.glp.toLocaleString()} Cr`,
            `${row.par.toFixed(2)}%`, `${row.par90.toFixed(2)}%`, `${row.par180.toFixed(2)}%`,
            `₹${row.writeOff.toFixed(2)} Cr`, row.risk
        ]);
        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `Risk_Report_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a); window.URL.revokeObjectURL(url);
    };

    // ── Export Logic ──
    const getFilename = (ext: string) => `FINFLUX_Risk_Compliance_${new Date().toISOString().slice(0, 10)}.${ext}`;

    const handleExportExcel = async () => {
        const XLSX = await import('xlsx');

        const summaryRows = [
            ['FINFLUX ANALYTICS - PORTFOLIO RISK & COMPLIANCE'],
            ['Generated', new Date().toLocaleString('en-IN')],
            [],
            ['Overall Metics', ''],
            ['PAR 30+', `${par30}%`],
            ['GNPA (90+)', `${par90}%`],
            ['Hardcore Risk (180+)', `${par180}%`],
            ['Audit Average Score', `${auditData.avgScore}/100`],
            ['Cash Limit Breaches', auditData.cashRiskCount],
            ['Surprise Visits', auditData.surpriseVisitCount],
            ['Critical Branches (<75)', auditData.criticalBranchCount]
        ];

        const stateRows = [
            ['State-wise Risk Breakup'],
            [],
            ['State', 'GLP', 'PAR 30', 'PAR 90', 'PAR 180', 'Write-offs', 'Risk Level'],
            ...stateWiseRisk.map(r => [r.state, r.glp, r.par, r.par90, r.par180, r.writeOff, r.risk])
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


    // Audit data — computed lazily only when tab is opened
    const auditData = useMemo(() => {
        const branches = getFlatBranchList().map((b, i) => enrichWithAuditData(b, i));
        const cashRisks = branches.filter(b => b.auditProfile.cashException);
        const criticalScores = branches.filter(b => b.auditProfile.score < 75);
        const surpriseVisits = branches.filter(b => b.auditProfile.lastAuditType === 'Surprise');
        const avgScore = Math.round(branches.reduce((s, b) => s + b.auditProfile.score, 0) / branches.length);
        const violationStats = [
            { name: 'Cash Rate Limit Breach', count: cashRisks.length, color: '#ef4444' },
            { name: 'Ghost/Identity Mismatch', count: branches.filter(b => b.auditProfile.findings.ghost).length, color: '#f97316' },
            { name: 'GRT Process Deviation', count: branches.filter(b => b.auditProfile.findings.grt).length, color: '#f59e0b' },
            { name: 'LUC Unverified', count: branches.filter(b => b.auditProfile.findings.luc).length, color: '#8b5cf6' },
            { name: 'Centre Meeting Delay', count: branches.filter(b => b.auditProfile.findings.meetings).length, color: '#3b82f6' },
        ].sort((a, b) => b.count - a.count);
        return { branches, avgScore, cashRiskCount: cashRisks.length, surpriseVisitCount: surpriseVisits.length, criticalBranchCount: criticalScores.length, violationStats };
    }, []);

    const tabs = [
        { key: 'portfolio', label: '📉 Portfolio Quality' },
        { key: 'audit', label: '🛡️ Audit & Control' },
        { key: 'vintage', label: '📋 Vintage Cohorts' },
        { key: 'regulatory', label: '⚖️ Regulatory' },
    ] as const;

    return (
        <div ref={exportRef} className="space-y-6">

            {/* ── Header ───────────────────────────────────────────────────── */}
            <div className="bg-gradient-to-r from-slate-700 via-rose-900 to-slate-800 rounded-xl p-5 text-white shadow-lg">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="text-xs font-bold uppercase tracking-widest text-rose-300 mb-1">Risk Management</div>
                        <h2 className="text-2xl font-bold">Risk & Compliance</h2>
                        <p className="text-rose-200 text-sm mt-1">Portfolio quality · Internal audit · Field discipline · FY 2025</p>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-center">
                            <div className="text-xs text-white/60">Loan at Risk</div>
                            <div className="text-xl font-bold text-amber-300">₹{(currentGLP * par30 / 100).toFixed(0)} Cr</div>
                        </div>
                        <div className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-center">
                            <div className="text-xs text-white/60">Write-offs YTD</div>
                            <div className="text-xl font-bold text-rose-300">₹{writeOffVal.toFixed(0)} Cr</div>
                        </div>
                        <div className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-center">
                            <div className="text-xs text-white/60">Audit Score</div>
                            <div className="text-xl font-bold text-emerald-300">{auditData.avgScore}/100</div>
                        </div>

                        <div className="relative group z-50 ml-2">
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

            {/* ── Tab Bar ───────────────────────────────────────────────────── */}
            <div className="flex bg-secondary-100 p-1 rounded-xl w-fit gap-1">
                {tabs.map(t => (
                    <button
                        key={t.key}
                        onClick={() => setActiveTab(t.key)}
                        className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === t.key
                            ? 'bg-white text-secondary-900 shadow-sm'
                            : 'text-secondary-500 hover:text-secondary-700'
                            }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ══════════════ TAB 1: PORTFOLIO QUALITY ══════════════ */}
            {activeTab === 'portfolio' && (
                <>
                    {/* KPI Strip */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                        {[
                            { title: 'Portfolio at Risk (PAR 30+)', value: `${par30.toFixed(2)}%`, change: '+0.3%', trend: 'up', icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
                            { title: 'GNPA (PAR 90+)', value: `${par90.toFixed(2)}%`, change: '+0.1%', trend: 'up', icon: ShieldAlert, color: 'text-rose-600', bg: 'bg-rose-50' },
                            { title: 'Hardcore Risk (PAR 180+)', value: `${par180.toFixed(2)}%`, change: '+0.05%', trend: 'up', icon: AlertTriangle, color: 'text-purple-600', bg: 'bg-purple-50' },
                            { title: 'Collection Efficiency', value: `${mtdEfficiency}%`, change: '-0.3%', trend: 'down', icon: BadgePercent, color: 'text-blue-600', bg: 'bg-blue-50' },
                            { title: 'Write-offs (YTD)', value: `₹${writeOffVal} Cr`, change: '0%', trend: 'flat', icon: TrendingDown, color: 'text-slate-600', bg: 'bg-slate-50' },
                        ].map((metric, idx) => (
                            <div key={idx} className="bg-white p-5 rounded-xl border border-secondary-200 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`p-2.5 rounded-lg ${metric.bg} ${metric.color}`}>
                                        <metric.icon size={20} />
                                    </div>
                                    <div className={`flex items-center text-xs font-bold px-2 py-1 rounded-full ${metric.trend === 'down' && metric.title.includes('Efficiency') ? 'bg-rose-100 text-rose-700' :
                                        metric.trend === 'up' && !metric.title.includes('Efficiency') ? 'bg-rose-100 text-rose-700' :
                                            'bg-emerald-100 text-emerald-700'
                                        }`}>
                                        {metric.change}
                                        {metric.trend === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                    </div>
                                </div>
                                <div className="text-secondary-500 text-sm font-medium">{metric.title}</div>
                                <div className="text-2xl font-bold text-secondary-900 mt-1">{metric.value}</div>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* PAR Movement Trend */}
                        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-secondary-200 shadow-sm">
                            <h3 className="text-lg font-bold text-secondary-900 mb-6 flex items-center gap-2">
                                <TrendingDown className="text-primary-600" size={20} />
                                Asset Quality Trend (Last 6 Months)
                            </h3>
                            <div className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={portfolioTrendData}>
                                        <defs>
                                            <linearGradient id="gPar30" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15} />
                                                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="gNpa" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                                                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="gPar180" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#7e22ce" stopOpacity={0.15} />
                                                <stop offset="95%" stopColor="#7e22ce" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(v: number) => `${v.toFixed(2)}%`} />
                                        <Legend />
                                        <Area isAnimationActive={false} type="monotone" dataKey="par30" name="PAR 30+ (%)" stroke="#f59e0b" fillOpacity={1} fill="url(#gPar30)" strokeWidth={3} />
                                        <Area isAnimationActive={false} type="monotone" dataKey="npa" name="NPA 90+ (%)" stroke="#ef4444" fillOpacity={1} fill="url(#gNpa)" strokeWidth={3} />
                                        <Area isAnimationActive={false} type="monotone" dataKey="par180" name="PAR 180+ (%)" stroke="#7e22ce" fillOpacity={1} fill="url(#gPar180)" strokeWidth={3} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Risk Distribution Donut */}
                        <div className="bg-white p-6 rounded-xl border border-secondary-200 shadow-sm">
                            <h3 className="text-lg font-bold text-secondary-900 mb-4 flex items-center gap-2">
                                <AlertCircle className="text-primary-600" size={20} />
                                Portfolio Risk Distribution
                            </h3>
                            <div className="h-[280px] relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie isAnimationActive={false} data={riskBuckets} cx="50%" cy="45%" innerRadius={65} outerRadius={95} paddingAngle={3} dataKey="value" label={({ value }) => `${value}%`} labelLine={false}>
                                            {riskBuckets.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={2} stroke="#fff" />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute top-[40%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                                    <div className="text-3xl font-bold text-emerald-600">{riskBuckets[0].value}%</div>
                                    <div className="text-xs text-secondary-500 font-semibold">Healthy</div>
                                </div>
                            </div>
                            <div className="mt-2 grid grid-cols-2 gap-1.5">
                                {riskBuckets.map((bucket, idx) => (
                                    <div key={idx} className="flex items-center gap-2 p-1.5 rounded hover:bg-secondary-50">
                                        <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: bucket.color }} />
                                        <div className="min-w-0">
                                            <div className="text-[10px] text-secondary-500 truncate">{bucket.name}</div>
                                            <div className="text-xs font-bold text-secondary-800">{bucket.value}%</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* State Risk Table */}
                    <div className="bg-white rounded-xl border border-secondary-200 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-secondary-100 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-secondary-900">Regional Risk Profile</h3>
                            <button onClick={handleDownloadReport} className="flex items-center gap-2 text-sm text-primary-600 font-bold hover:text-primary-700 hover:bg-primary-50 px-3 py-2 rounded-lg transition-colors">
                                <FileDown size={16} /> Download Report
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-secondary-50 text-secondary-500 font-medium text-xs uppercase tracking-wide">
                                    <tr>
                                        <th className="px-6 py-4">State</th>
                                        <th className="px-6 py-4">Portfolio (GLP)</th>
                                        <th className="px-6 py-4">PAR 30+</th>
                                        <th className="px-6 py-4">PAR 90+</th>
                                        <th className="px-6 py-4">PAR 180+</th>
                                        <th className="px-6 py-4">Write-Offs (YTD)</th>
                                        <th className="px-6 py-4">Risk Level</th>
                                        <th className="px-6 py-4 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-secondary-100">
                                    {stateWiseRisk.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-secondary-50/50 transition-colors">
                                            <td className="px-6 py-4 font-bold text-secondary-900">{row.state}</td>
                                            <td className="px-6 py-4 text-secondary-600">₹{row.glp.toLocaleString()} Cr</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded-md font-bold text-xs ${row.par > 3 ? 'bg-rose-100 text-rose-700' : row.par > 1.5 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                    {row.par.toFixed(2)}%
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 font-mono text-xs text-secondary-600">{row.par90.toFixed(2)}%</td>
                                            <td className="px-6 py-4 font-mono text-xs text-purple-600 font-bold">{row.par180.toFixed(2)}%</td>
                                            <td className="px-6 py-4 text-xs text-secondary-600">₹{row.writeOff.toFixed(2)} Cr</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-2 h-2 rounded-full ${row.risk === 'High' ? 'bg-rose-500' : row.risk === 'Medium' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                                                    <span className="text-secondary-700 font-medium text-xs">{row.risk}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button onClick={() => handleAnalyze(row.state)} className="text-xs font-bold text-primary-600 border border-primary-200 px-3 py-1.5 rounded-lg hover:bg-primary-50 hover:border-primary-300 transition-all">
                                                    Analyze →
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )
            }

            {/* ══════════════ TAB 2: AUDIT & CONTROL ══════════════ */}
            {
                activeTab === 'audit' && (
                    <>
                        {/* Audit KPI Strip */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <KPICard title="Network Compliance" value={`${auditData.avgScore}%`} subValue="Avg. Audit Score" trend={auditData.avgScore > 80 ? 'up' : 'down'} trendValue={auditData.avgScore > 80 ? 'Good Control' : 'Process Gaps'} icon={FileCheck} className="border-l-4 border-l-emerald-500" />
                            <KPICard title="Cash Limit Breaches" value={auditData.cashRiskCount.toString()} subValue="Overnight Cash > ₹50k" trend={auditData.cashRiskCount === 0 ? 'neutral' : 'down'} trendValue="Immediate Action" icon={Banknote} className={`border-l-4 ${auditData.cashRiskCount > 0 ? 'border-l-rose-500' : 'border-l-secondary-300'}`} />
                            <KPICard title="Surprise Visits" value={`${((auditData.surpriseVisitCount / Math.max(1, auditData.branches.length)) * 100).toFixed(0)}%`} subValue="Coverage (Q3)" trend="up" trendValue={`${auditData.surpriseVisitCount} Branches Visited`} icon={Siren} className="border-l-4 border-l-purple-500" />
                            <KPICard title="Ghost Client Alerts" value={auditData.violationStats.find(v => v.name.includes('Ghost'))?.count.toString() || '0'} subValue="Identity Mismatches" trend="up" trendValue="Potential Fraud" icon={UserCheck} className="border-l-4 border-l-orange-500" />
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Violations Chart */}
                            <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-secondary-200 shadow-sm">
                                <h3 className="text-lg font-bold text-secondary-900 mb-1">Top Audit Violations</h3>
                                <p className="text-xs text-secondary-500 mb-6">Process gaps identified during field audits and surprise checks</p>
                                <div className="h-[280px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={auditData.violationStats} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} />
                                            <XAxis type="number" hide />
                                            <YAxis dataKey="name" type="category" width={145} tick={{ fontSize: 11, fill: '#64748b' }} />
                                            <Tooltip cursor={{ fill: '#f1f5f9' }} />
                                            <Bar isAnimationActive={false} dataKey="count" radius={[0, 4, 4, 0]} barSize={24}>
                                                {auditData.violationStats.map((entry, i) => (
                                                    <Cell key={`cell-${i}`} fill={entry.color} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Audit Plan Donut */}
                            <div className="bg-white p-6 rounded-xl border border-secondary-200 shadow-sm">
                                <h3 className="text-lg font-bold text-secondary-900 mb-1">Audit Plan Status</h3>
                                <p className="text-xs text-secondary-500 mb-4">Completion vs Target (FY 2025)</p>
                                <div className="h-[220px] relative">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie isAnimationActive={false} data={[
                                                { name: 'Completed (Regular)', value: 18, color: '#10b981' },
                                                { name: 'Completed (Surprise)', value: 5, color: '#8b5cf6' },
                                                { name: 'Pending', value: 4, color: '#e2e8f0' },
                                            ]} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value">
                                                <Cell fill="#10b981" />
                                                <Cell fill="#8b5cf6" />
                                                <Cell fill="#e2e8f0" />
                                            </Pie>
                                            <Tooltip />
                                            <Legend verticalAlign="bottom" height={36} iconSize={8} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
                                        <span className="text-2xl font-bold text-secondary-800">85%</span>
                                        <span className="text-[10px] text-secondary-500 font-bold uppercase">Executed</span>
                                    </div>
                                </div>
                                <div className="mt-2 text-center text-xs text-secondary-500">
                                    <span className="font-semibold text-purple-600">Surprise Visits</span> exceeding target by 10%
                                </div>
                            </div>
                        </div>

                        {/* Red Flag Branches Table */}
                        <div className="bg-white p-6 rounded-xl border border-secondary-200 shadow-sm">
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h3 className="text-lg font-bold text-secondary-900 flex items-center gap-2">
                                        <AlertTriangle size={18} className="text-rose-500" />
                                        Red Flag Branches (Action Required)
                                    </h3>
                                    <p className="text-sm text-secondary-500">Cash mismatches · Low audit scores · High PAR</p>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-secondary-50 text-secondary-500 text-xs uppercase tracking-wide border-b border-secondary-200">
                                        <tr>
                                            <th className="py-3 px-4">Branch</th>
                                            <th className="py-3 px-4">Audit Type</th>
                                            <th className="py-3 px-4 text-center">Audit Score</th>
                                            <th className="py-3 px-4 text-center">Cash Exception</th>
                                            <th className="py-3 px-4 text-center">GRT Process</th>
                                            <th className="py-3 px-4 text-right">PAR 30 (%)</th>
                                            <th className="py-3 px-4 text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-secondary-100">
                                        {auditData.branches
                                            .filter(b => b.auditProfile.score < 75 || b.auditProfile.cashException)
                                            .slice(0, 10)
                                            .map((branch: any, idx: number) => (
                                                <tr key={idx} className="hover:bg-secondary-50 transition-colors">
                                                    <td className="py-3 px-4 font-medium text-secondary-900">
                                                        {branch.name}
                                                        <div className="text-[10px] text-secondary-400">{branch.district}, {branch.state}</div>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${branch.auditProfile.lastAuditType === 'Surprise' ? 'bg-purple-50 text-purple-700 border-purple-100' : 'bg-secondary-100 text-secondary-600 border-secondary-200'}`}>
                                                            {branch.auditProfile.lastAuditType}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 text-center">
                                                        <span className={`font-bold ${branch.auditProfile.score < 70 ? 'text-rose-600' : 'text-secondary-700'}`}>
                                                            {branch.auditProfile.score}/100
                                                        </span>
                                                        {branch.auditProfile.score < 70 && <div className="text-[9px] text-rose-500">Critical</div>}
                                                    </td>
                                                    <td className="py-3 px-4 text-center">
                                                        {branch.auditProfile.cashException
                                                            ? <div className="inline-flex items-center gap-1 text-rose-600 font-bold bg-rose-50 px-2 py-1 rounded text-xs"><Banknote size={11} /> Excess</div>
                                                            : <span className="text-emerald-500 text-xs">Within Limit</span>}
                                                    </td>
                                                    <td className="py-3 px-4 text-center">
                                                        {branch.auditProfile.findings.grt
                                                            ? <span className="text-rose-500 text-xs font-semibold">Failed</span>
                                                            : <span className="text-secondary-400 text-xs">–</span>}
                                                    </td>
                                                    <td className="py-3 px-4 text-right font-mono text-xs">{(branch.par30 || 0).toFixed(2)}%</td>
                                                    <td className="py-3 px-4 text-center">
                                                        <button className="text-blue-600 hover:text-blue-800 text-xs font-bold underline">View</button>
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>
                        </div >
                    </>
                )
            }

            {/* TAB 3: VINTAGE COHORT ANALYSIS */}
            {
                activeTab === 'vintage' && (
                    <div className="space-y-6">
                        <div className="bg-white rounded-xl border border-secondary-200 shadow-sm p-5">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h3 className="text-sm font-bold text-secondary-800 uppercase tracking-wider">Loan Vintage Analysis — PAR by Disbursement Cohort</h3>
                                    <p className="text-xs text-secondary-400 mt-1 mb-4">
                                        PAR at 3, 6, and 12 months post-disbursement. Source: FINFLUX repayment aging by cohort.
                                        Cycle 2+ borrowers consistently show lower PAR due to repeat-borrower screening.
                                    </p>
                                </div>
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 shrink-0 ml-2">LMS</span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-secondary-50 border-b border-secondary-200">
                                        <tr>
                                            {['Cohort', 'Loan Cycle', 'Active Loans', 'Closed', 'PAR @ 3M', 'PAR @ 6M', 'PAR @ 12M', 'Write-off (Cr)'].map(h => (
                                                <th key={h} className="py-2.5 px-3 text-xs font-semibold text-secondary-500 whitespace-nowrap">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-secondary-100">
                                        {VINTAGE_DATA.map((row, i) => {
                                            const cycleColors: Record<number, string> = {
                                                1: 'bg-blue-100 text-blue-700',
                                                2: 'bg-indigo-100 text-indigo-700',
                                                3: 'bg-purple-100 text-purple-700',
                                                4: 'bg-fuchsia-100 text-fuchsia-700'
                                            };
                                            return (
                                                <tr key={i} className="hover:bg-secondary-50">
                                                    <td className="py-2.5 px-3 text-xs font-semibold text-secondary-800">{row.disbursementMonth} '25</td>
                                                    <td className="py-2.5 px-3 text-xs">
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${cycleColors[row.loanCycle] || 'bg-gray-100 text-gray-700'}`}>
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
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <p className="text-[10px] text-secondary-400 mt-4">
                                Insight: Cycle 2+ borrowers show lower PAR — repeat borrower screening is effective. Higher early PAR in Cycle 1 is normal for first-time rural credit borrowers.
                            </p>
                        </div>
                    </div>
                )
            }

            {/* TAB 4: REGULATORY COMPLIANCE */}
            {
                activeTab === 'regulatory' && (
                    <div className="space-y-6">
                        <div className="flex items-start gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                            <span className="text-emerald-600 text-lg shrink-0 mt-0.5">✓</span>
                            <div>
                                <div className="text-sm font-bold text-emerald-800">All starred metrics are sourced directly from FINFLUX loan data</div>
                                <div className="text-xs text-emerald-700 mt-1">
                                    QA%, IRR, Household Income — from loan contract values and borrower KYC in FINFLUX.
                                    Multi-lender exposure from CERSAI/bureau integration.
                                    <span className="font-semibold text-amber-700"> CRAR and SRO membership require external data (marked EXT).</span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Compliance Checklist */}
                            <div className="bg-white rounded-xl border border-secondary-200 shadow-sm p-5">
                                <h3 className="text-sm font-bold text-secondary-800 uppercase tracking-wider mb-4">RBI / MFIN Regulatory Compliance</h3>
                                <div className="space-y-2">
                                    {([
                                        { metric: 'Qualifying Assets Ratio', actual: 92.4, norm: '≥85% (RBI)', lms: true, ok: true, unit: '%' },
                                        { metric: 'Household Income ≤ ₹3L', actual: 94.1, norm: '≥90% (RBI)', lms: true, ok: true, unit: '%' },
                                        { metric: 'Effective Interest Rate (IRR)', actual: CURRENT_FINANCIALS.yieldOnPortfolio, norm: '≤24% (RBI cap)', lms: true, ok: CURRENT_FINANCIALS.yieldOnPortfolio <= 24, unit: '%' },
                                        { metric: 'Max Loan per Borrower', actual: 1.8, norm: '≤₹3 Lakh', lms: true, ok: true, unit: 'L avg' },
                                        { metric: 'Multi-Lender Exposure (3+ MFIs)', actual: 16.2, norm: '<20% (MFIN)', lms: true, ok: true, unit: '%' },
                                        { metric: 'CERSAI Registration', actual: 96.2, norm: '≥95%', lms: true, ok: true, unit: '%' },
                                        { metric: 'SRO Membership (MFIN)', actual: 100, norm: 'Mandatory', lms: false, ok: true, unit: '%' },
                                        { metric: 'CRAR (Capital Adequacy)', actual: 18.5, norm: '≥15% (RBI)', lms: false, ok: true, unit: '%' },
                                    ] as const).map((row, i) => (
                                        <div key={i} className="flex items-center justify-between py-2.5 border-b border-secondary-50 last:border-0">
                                            <div>
                                                <div className="text-xs font-semibold text-secondary-800 flex items-center gap-1.5">
                                                    {row.metric}
                                                    {row.lms
                                                        ? <span className="text-[7px] font-bold px-1 py-0.5 rounded bg-emerald-100 text-emerald-700">LMS</span>
                                                        : <span className="text-[7px] font-bold px-1 py-0.5 rounded bg-amber-100 text-amber-700">EXT</span>
                                                    }
                                                </div>
                                                <div className="text-[10px] text-secondary-400">{row.norm}</div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm font-bold text-secondary-700">{row.actual.toFixed(1)}{row.unit}</span>
                                                <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${row.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                                    {row.ok ? '✓ Compliant' : '! Breach'}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* State-wise Regulatory Table */}
                            <div className="bg-white rounded-xl border border-secondary-200 shadow-sm p-5">
                                <h3 className="text-sm font-bold text-secondary-800 uppercase tracking-wider mb-4">State-wise Regulatory Summary</h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-secondary-50 border-b border-secondary-200">
                                            <tr>
                                                {['State', 'QA%', 'HH Inc%', 'IRR%', 'Multi-L%', 'Coll.%'].map(h => (
                                                    <th key={h} className="py-2 px-2 text-[10px] font-semibold text-secondary-500 text-right first:text-left">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-secondary-100">
                                            {STATE_FINANCIALS.sort((a, b) => b.glp - a.glp).map((row, i) => (
                                                <tr key={i} className="hover:bg-secondary-50">
                                                    <td className="py-1.5 px-2 text-xs font-semibold text-secondary-800">{row.name}</td>
                                                    <td className="py-1.5 px-2 text-xs text-right font-mono font-bold" style={{ color: row.qualifyingAssetPct >= 85 ? '#059669' : '#dc2626' }}>{row.qualifyingAssetPct.toFixed(1)}</td>
                                                    <td className="py-1.5 px-2 text-xs text-right font-mono font-bold" style={{ color: row.householdIncomePct >= 90 ? '#059669' : '#d97706' }}>{row.householdIncomePct.toFixed(1)}</td>
                                                    <td className="py-1.5 px-2 text-xs text-right font-mono font-bold" style={{ color: row.irrPct <= 24 ? '#059669' : '#dc2626' }}>{row.irrPct.toFixed(1)}</td>
                                                    <td className="py-1.5 px-2 text-xs text-right font-mono font-bold" style={{ color: row.multiLenderPct < 20 ? '#059669' : '#dc2626' }}>{row.multiLenderPct.toFixed(1)}</td>
                                                    <td className="py-1.5 px-2 text-xs text-right font-mono font-bold" style={{ color: row.collectionEfficiency >= 98 ? '#059669' : row.collectionEfficiency >= 96 ? '#d97706' : '#dc2626' }}>{row.collectionEfficiency.toFixed(1)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Industry Benchmarks */}
                            <div className="lg:col-span-2 bg-white rounded-xl border border-secondary-200 shadow-sm p-5">
                                <h3 className="text-sm font-bold text-secondary-800 uppercase tracking-wider mb-1">Industry Benchmarks — MFIN 2024</h3>
                                <p className="text-xs text-secondary-400 mb-4">LMS-computable metrics only. NIM/ROA/CRAR excluded — require accounting integration.</p>
                                <div className="space-y-3">
                                    {INDUSTRY_BENCHMARKS
                                        .filter(r => ['Coll. Efficiency (MTD)', 'PAR 30', 'PAR 90', 'Cost of Funds'].includes(r.metric))
                                        .map((row, i) => {
                                            const isGood = row.better === 'higher' ? row.ourValue >= row.topQuartile : row.ourValue <= row.topQuartile;
                                            const isAvg = row.better === 'higher' ? row.ourValue >= row.industryAvg : row.ourValue <= row.industryAvg;
                                            const pct = Math.min(100, row.better === 'higher'
                                                ? (row.ourValue / (row.topQuartile * 1.1)) * 100
                                                : (row.topQuartile / (row.ourValue * 1.1)) * 100);
                                            const bColor = isGood ? '#10b981' : isAvg ? '#f59e0b' : '#ef4444';
                                            const lClass = isGood ? 'bg-emerald-100 text-emerald-700' : isAvg ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700';
                                            return (
                                                <div key={i} className="flex flex-col sm:grid sm:grid-cols-12 sm:items-center gap-2 sm:gap-4 p-3 rounded-lg hover:bg-secondary-50">
                                                    <div className="sm:col-span-3 text-sm font-semibold text-secondary-700">{row.metric}</div>
                                                    <div className="sm:col-span-2 flex justify-between sm:block text-xs text-secondary-400 sm:text-right">
                                                        <div>Ind: <strong>{row.industryAvg}{row.unit}</strong></div>
                                                        <div>Top: <strong className="text-indigo-600">{row.topQuartile}{row.unit}</strong></div>
                                                    </div>
                                                    <div className="sm:col-span-5 relative h-3 w-full bg-secondary-100 rounded-full overflow-hidden">
                                                        <div style={{ width: pct + '%', backgroundColor: bColor, height: '100%', borderRadius: '9999px' }} />
                                                    </div>
                                                    <div className="sm:col-span-2 flex items-center gap-2 justify-between sm:justify-end">
                                                        <span style={{ color: bColor }} className="text-sm font-bold">{row.ourValue.toFixed(1)}{row.unit}</span>
                                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${lClass}`}>{isGood ? 'TOP' : isAvg ? 'AVG' : 'LAG'}</span>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    }
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default PortfolioDashboard;
