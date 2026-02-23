import { useState, useMemo } from 'react';
import {
    LayoutDashboard, Map, TrendingUp, Filter, ChevronDown,
    PieChart, AlertTriangle, IndianRupee, Users, ArrowUpRight,
    Building2, MapPin, Gauge, Download, Camera
} from 'lucide-react';
import { saveFile, exportToPDF, exportToPPT } from '../lib/utils';
import { useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, ScatterChart, Scatter, ZAxis, ReferenceLine, LabelList } from 'recharts';
import KPICard from '../components/KPICard';
import { ALL_STATES_DATA, TOTAL_PRODUCT_STATS, ProductStats, TOTAL_GLP } from '../data/geoDataComplete';

// Formatters
const fmtCr = (val: number) => `₹${val.toFixed(2)} Cr`;
const fmtCount = (val: number) => val.toLocaleString('en-IN');
const fmtPct = (val: number) => `${val.toFixed(2)}%`;

const ProductDashboard = () => {
    const exportRef = useRef<HTMLDivElement>(null);
    // 1. Get List of Products
    const productList = useMemo(() => Object.keys(TOTAL_PRODUCT_STATS), []);

    // 2. Selection State
    const [selectedProduct, setSelectedProduct] = useState<string>(productList[0] || 'Group Loans (JLG)');

    // 3. Global Stats for Product
    const globalStats = TOTAL_PRODUCT_STATS[selectedProduct] || { glp: 0, par30: 0, clients: 0 };
    const portfolioShare = (globalStats.glp / TOTAL_GLP) * 100;
    const ats = globalStats.clients ? ((globalStats.glp * 10000000) / globalStats.clients) : 0;

    // 4. Regional Breakdown (State Level)
    const stateBreakdown = useMemo(() => {
        return ALL_STATES_DATA.map(state => {
            const pStats = state.products?.[selectedProduct];
            if (!pStats) return null;
            return {
                state: state.name,
                ...pStats
            };
        })
            .filter(s => s !== null)
            .map(s => s!) // TS Force
            .sort((a, b) => b.glp - a.glp);
    }, [selectedProduct]);

    // 5. Branch Outliers (Top 5 & High Risk 5)
    // We scan all branches. This is fast enough (1-2k items).
    const branchOutliers = useMemo(() => {
        const allBranches: Array<{ branch: string, district: string, state: string, stats: ProductStats }> = [];

        ALL_STATES_DATA.forEach(state => {
            state.districts.forEach(district => {
                district.branches.forEach(branch => {
                    const pStats = branch.products?.[selectedProduct];
                    if (pStats && pStats.glp > 0.05) { // Threshold to ignore tiny test data
                        allBranches.push({
                            branch: branch.name,
                            district: district.name,
                            state: state.name,
                            stats: pStats
                        });
                    }
                });
            });
        });

        // Top Performers (Volume)
        const topVolume = [...allBranches].sort((a, b) => b.stats.glp - a.stats.glp).slice(0, 5);

        // High Risk (PAR > 0, sorted descending)
        const highRisk = [...allBranches]
            .filter(b => b.stats.par30 > 0)
            .sort((a, b) => b.stats.par30 - a.stats.par30)
            .slice(0, 5);

        return { topVolume, highRisk };
    }, [selectedProduct]);

    // 6. Landscape Averages (for Quadrants)
    const landscapeMetrics = useMemo(() => {
        if (stateBreakdown.length === 0) return { avgVol: 0, avgRisk: 0 };
        const totalVol = stateBreakdown.reduce((acc, s) => acc + s.glp, 0);
        const totalRisk = stateBreakdown.reduce((acc, s) => acc + s.par30, 0);
        return {
            avgVol: totalVol / stateBreakdown.length,
            avgRisk: totalRisk / stateBreakdown.length
        };
    }, [stateBreakdown]);

    // ── Export Logic ──
    const getFilename = (ext: string) => `FINFLUX_Product_${selectedProduct.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.${ext}`;

    const handleExportExcel = async () => {
        const XLSX = await import('xlsx');

        const summaryRows = [
            ['FINFLUX ANALYTICS - PRODUCT PERFORMANCE REPORT'],
            ['Generated', new Date().toLocaleString('en-IN')],
            ['Product', selectedProduct],
            [],
            ['Overall KPI', 'Value'],
            ['Product GLP (Cr)', globalStats.glp.toFixed(2)],
            ['Active Clients', globalStats.clients.toLocaleString()],
            ['Product Risk (PAR 30)', `${globalStats.par30.toFixed(2)}%`],
            ['NPA (PAR 90+)', `${globalStats.par90.toFixed(2)}%`],
            ['Portfolio Share (%)', portfolioShare.toFixed(2)]
        ];

        const stateRows = [
            ['State-wise Breakdown'],
            [],
            ['State', 'GLP (Cr)', 'Clients', 'PAR 30 (%)', 'PAR 90 (%)'],
            ...stateBreakdown.map(r => [r.state, r.glp, r.clients, r.par30, r.par90])
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
        <div ref={exportRef} className="flex flex-col h-full space-y-6">

            {/* Context Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-secondary-200 shadow-sm">
                <div>
                    <h2 className="text-2xl font-bold text-secondary-900">Product Analytics</h2>
                    <p className="text-secondary-500">Performance & Risk Monitor by Product Line</p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative group">
                        <label className="text-[10px] text-secondary-500 font-bold uppercase tracking-wider mb-1 block">Select Product</label>
                        <select
                            className="bg-secondary-50 border border-secondary-200 text-secondary-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-64 p-2.5 outline-none font-bold shadow-sm cursor-pointer"
                            value={selectedProduct}
                            onChange={(e) => setSelectedProduct(e.target.value)}
                        >
                            {productList.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>

                    <div className="relative group z-50">
                        <button className="bg-white border border-secondary-200 rounded-lg px-3 py-[9px] text-sm text-secondary-700 hover:bg-secondary-50 flex items-center gap-2 transition-colors mt-4 shadow-sm font-medium">
                            <Download size={15} /> Export
                        </button>
                        <div className="absolute right-0 top-full pt-1 w-48 hidden group-hover:block z-[100]">
                            <div className="bg-white backdrop-blur-sm rounded-lg shadow-xl border border-secondary-200 overflow-hidden text-left">
                                <button onClick={handleExportExcel} className="w-full text-left px-4 py-3 text-sm font-medium text-slate-800 hover:bg-primary-50 hover:text-primary-600 transition-colors border-b border-secondary-100 flex justify-between items-center">Excel (.xlsx) <Download size={14} /></button>
                                <button onClick={handleExportPDF} className="w-full text-left px-4 py-3 text-sm font-medium text-slate-800 hover:bg-primary-50 hover:text-primary-600 transition-colors border-b border-secondary-100 flex justify-between items-center">PDF Screenshot <Camera size={14} /></button>
                                <button onClick={handleExportPPT} className="w-full text-left px-4 py-3 text-sm font-medium text-slate-800 hover:bg-primary-50 hover:text-primary-600 transition-colors flex justify-between items-center">PPT Screenshot <Camera size={14} /></button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <KPICard
                    title="Product GLP"
                    value={fmtCr(globalStats.glp)}
                    subValue={`${portfolioShare.toFixed(2)}% of Portfolio`}
                    icon={IndianRupee}
                    className="border-l-4 border-l-blue-500"
                />
                <KPICard
                    title="Active Clients"
                    value={fmtCount(globalStats.clients)}
                    subValue={`Avg Ticket: ₹${(ats / 1000).toFixed(1)}k`}
                    icon={Users}
                />
                <KPICard
                    title="Product Risk (PAR 30)"
                    value={`${globalStats.par30.toFixed(2)}%`}
                    subValue="Weighted Average"
                    icon={AlertTriangle}
                    className={globalStats.par30 < 2 ? "border-l-4 border-l-emerald-500" : "border-l-4 border-l-amber-500"}
                />
                <KPICard
                    title="NPA (PAR 90+)"
                    value={`${globalStats.par90.toFixed(2)}%`}
                    subValue={`₹${((globalStats.glp * globalStats.par90) / 100).toFixed(2)} Cr Risk`}
                    icon={Gauge}
                    className="border-l-4 border-l-rose-500"
                />
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* 1. Regional Performance (Bar Chart) */}
                <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-secondary-200 shadow-sm">
                    <h3 className="text-lg font-bold text-secondary-900 mb-6">State-wise Penetration (GLP)</h3>
                    <div className="h-[320px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stateBreakdown} layout="vertical" margin={{ left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                <XAxis type="number" hide />
                                <YAxis dataKey="state" type="category" width={100} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} />
                                <Tooltip
                                    cursor={{ fill: '#f1f5f9' }}
                                    formatter={(value: number) => [`₹${value.toFixed(2)} Cr`, 'GLP']}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar isAnimationActive={false} dataKey="glp" radius={[0, 4, 4, 0]} barSize={32}>
                                    {stateBreakdown.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.state === 'Karnataka' ? '#3b82f6' : '#94a3b8'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. Top Performing Branches Table */}
                <div className="bg-white p-6 rounded-xl border border-secondary-200 shadow-sm">
                    <h3 className="text-lg font-bold text-secondary-900 mb-4 flex items-center gap-2">
                        <TrendingUp className="text-emerald-500" size={20} />
                        Top Branches (Volume)
                    </h3>
                    <div className="space-y-4">
                        {branchOutliers.topVolume.map((b, idx) => (
                            <div key={idx} className="flex justify-between items-center border-b border-secondary-100 pb-3 last:border-0 last:pb-0">
                                <div>
                                    <div className="font-bold text-secondary-900 text-sm">{b.branch}</div>
                                    <div className="text-xs text-secondary-500">{b.district}, {b.state}</div>
                                    <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">{b.stats.clients} Clients</div>
                                </div>
                                <div className="text-right">
                                    <div className="font-bold text-emerald-700">₹{b.stats.glp.toFixed(2)} Cr</div>
                                    <div className="text-xs text-secondary-500">PAR: {b.stats.par30.toFixed(2)}%</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 3. Risk Hotspots Map (List) */}
                <div className="bg-white p-6 rounded-xl border border-secondary-200 shadow-sm">
                    <h3 className="text-lg font-bold text-secondary-900 mb-4 flex items-center gap-2">
                        <AlertTriangle className="text-rose-500" size={20} />
                        Risk Hotspots (PAR 30+)
                    </h3>
                    <div className="space-y-4">
                        {branchOutliers.highRisk.map((b, idx) => (
                            <div key={idx} className="flex justify-between items-center bg-rose-50 p-3 rounded-lg border border-rose-100">
                                <div>
                                    <div className="font-bold text-rose-900 text-sm">{b.branch}</div>
                                    <div className="text-xs text-rose-700/80">{b.district}, {b.state}</div>
                                </div>
                                <div className="text-right">
                                    <div className="font-bold text-rose-700 text-lg">{b.stats.par30.toFixed(2)}%</div>
                                    <div className="text-[10px] text-rose-800 font-medium">GLP: ₹{b.stats.glp.toFixed(2)} Cr</div>
                                </div>
                            </div>
                        ))}
                        {branchOutliers.highRisk.length === 0 && (
                            <div className="text-center py-8 text-secondary-400 text-sm">No high risk branches found.</div>
                        )}
                    </div>
                </div>

                {/* 4. Strategic Quadrants (Business View) */}
                <div className="lg:col-span-2 space-y-4">
                    <h3 className="text-lg font-bold text-secondary-900 mb-2">Portfolio Strategy Matrix</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 h-auto min-h-[320px]">

                        {/* Q1: Stars / Leaders (High Vol, Low Risk) */}
                        <div className="bg-white p-4 rounded-xl border-l-4 border-l-emerald-500 border border-secondary-200 shadow-sm overflow-auto">
                            <div className="flex justify-between items-center mb-3">
                                <h4 className="font-bold text-emerald-800 text-sm uppercase tracking-wider">Star Performers</h4>
                                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">High Vol • Low Risk</span>
                            </div>
                            <div className="space-y-2">
                                {stateBreakdown.filter(s => s.glp >= landscapeMetrics.avgVol && s.par30 <= landscapeMetrics.avgRisk).map(s => (
                                    <div key={s.state} className="flex justify-between items-center text-sm p-2 bg-secondary-50 rounded-lg">
                                        <div className="font-bold text-secondary-800">{s.state}</div>
                                        <div className="text-right">
                                            <div className="text-xs font-semibold text-emerald-600">₹{s.glp.toFixed(0)} Cr</div>
                                            <div className="text-[10px] text-secondary-500">{s.par30.toFixed(2)}% PAR</div>
                                        </div>
                                    </div>
                                ))}
                                {stateBreakdown.filter(s => s.glp >= landscapeMetrics.avgVol && s.par30 <= landscapeMetrics.avgRisk).length === 0 &&
                                    <div className="text-xs text-secondary-400 italic">No states in this category</div>}
                            </div>
                        </div>

                        {/* Q2: Critical (High Vol, High Risk) */}
                        <div className="bg-white p-4 rounded-xl border-l-4 border-l-rose-500 border border-secondary-200 shadow-sm overflow-auto">
                            <div className="flex justify-between items-center mb-3">
                                <h4 className="font-bold text-rose-800 text-sm uppercase tracking-wider">Critical Watchlist</h4>
                                <span className="text-[10px] bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full font-bold">High Vol • High Risk</span>
                            </div>
                            <div className="space-y-2">
                                {stateBreakdown.filter(s => s.glp >= landscapeMetrics.avgVol && s.par30 > landscapeMetrics.avgRisk).map(s => (
                                    <div key={s.state} className="flex justify-between items-center text-sm p-2 bg-rose-50 rounded-lg border border-rose-100">
                                        <div className="font-bold text-secondary-800">{s.state}</div>
                                        <div className="text-right">
                                            <div className="text-xs font-semibold text-rose-600">₹{s.glp.toFixed(0)} Cr</div>
                                            <div className="text-[10px] text-rose-700 font-bold">{s.par30.toFixed(2)}% PAR</div>
                                        </div>
                                    </div>
                                ))}
                                {stateBreakdown.filter(s => s.glp >= landscapeMetrics.avgVol && s.par30 > landscapeMetrics.avgRisk).length === 0 &&
                                    <div className="text-xs text-secondary-400 italic">No critical states</div>}
                            </div>
                        </div>

                        {/* Q3: Growth Opportunity (Low Vol, Low Risk) */}
                        <div className="bg-white p-4 rounded-xl border-l-4 border-l-blue-500 border border-secondary-200 shadow-sm overflow-auto">
                            <div className="flex justify-between items-center mb-3">
                                <h4 className="font-bold text-blue-800 text-sm uppercase tracking-wider">Growth Potential</h4>
                                <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold">Low Vol • Low Risk</span>
                            </div>
                            <div className="space-y-2">
                                {stateBreakdown.filter(s => s.glp < landscapeMetrics.avgVol && s.par30 <= landscapeMetrics.avgRisk).map(s => (
                                    <div key={s.state} className="flex justify-between items-center text-sm p-2 bg-secondary-50 rounded-lg">
                                        <div className="font-medium text-secondary-700">{s.state}</div>
                                        <div className="text-right">
                                            <div className="text-xs font-semibold text-blue-600">₹{s.glp.toFixed(0)} Cr</div>
                                            <div className="text-[10px] text-emerald-600">{s.par30.toFixed(2)}% PAR</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Q4: Monitor (Low Vol, High Risk) */}
                        <div className="bg-white p-4 rounded-xl border-l-4 border-l-amber-500 border border-secondary-200 shadow-sm overflow-auto">
                            <div className="flex justify-between items-center mb-3">
                                <h4 className="font-bold text-amber-800 text-sm uppercase tracking-wider">Review Needed</h4>
                                <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">Low Vol • High Risk</span>
                            </div>
                            <div className="space-y-2">
                                {stateBreakdown.filter(s => s.glp < landscapeMetrics.avgVol && s.par30 > landscapeMetrics.avgRisk).map(s => (
                                    <div key={s.state} className="flex justify-between items-center text-sm p-2 bg-secondary-50 rounded-lg">
                                        <div className="font-medium text-secondary-700">{s.state}</div>
                                        <div className="text-right">
                                            <div className="text-xs font-semibold text-amber-600">₹{s.glp.toFixed(0)} Cr</div>
                                            <div className="text-[10px] text-rose-600">{s.par30.toFixed(2)}% PAR</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>
                    <div className="text-[10px] text-secondary-400 text-center flex justify-center gap-4">
                        <span>Avg Vol: ₹{landscapeMetrics.avgVol.toFixed(0)} Cr</span>
                        <span>Avg Risk: {landscapeMetrics.avgRisk.toFixed(2)}%</span>
                    </div>
                </div>

            </div>
        </div>
    );
};

// Helper for consistent colors
const getPseudoColor = (idx: number) => {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
    return colors[idx % colors.length];
};

export default ProductDashboard;
