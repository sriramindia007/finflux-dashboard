import { useState, useMemo, useEffect } from 'react';
import {
    FileText, CheckCircle2, Users, Building2,
    MapPin, TrendingUp, Filter, Clock, XCircle, ArrowRight, Banknote, Smartphone,
    Download, Camera
} from 'lucide-react';
import { saveFile, exportToPDF, exportToPPT } from '../lib/utils';
import { useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, LabelList, ComposedChart } from 'recharts';
import KPICard from '../components/KPICard';
import { ALL_STATES_DATA, Branch, District, Centre, ApplicationPipeline } from '../data/geoDataComplete';
import { getBranchHistory, generateProductMix, MONTHS, Month, COMPANY_METRICS, STATES_DATA, MonthlyMetric } from '../data/mfiData';
import { getBranchFilter, type BranchFilter } from '../data/users';

// --- Types ---
interface FunnelData {
    stage: string;
    count: number;
    value?: number;
    breach: number;
    tat: number; // Days
}

interface OriginationViewData {
    name: string;
    region: string;
    pipeline: ApplicationPipeline;
    targets: { sourcing: number, disbursement: number };
    metrics: {
        approvalRate: number;
        avgTat: number;
        conversionRate: number;
        digitalSourcing: number;
    };
    trends: { month: string, received: number, sanctioned: number, disbursed: number }[];
}


// --- Helper: Indian Number Formatting ---
const fmtCr = (v: number) => `₹${v.toFixed(2)} Cr`;
const fmtL = (v: number) => `₹${v.toFixed(2)} L`;
const fmtCount = (v: number) => {
    if (v >= 10000000) return `${(v / 10000000).toFixed(2)} Cr`;
    if (v >= 100000) return `${(v / 100000).toFixed(2)} L`;
    if (v >= 1000) return `${(v / 1000).toFixed(1)} k`;
    return v.toLocaleString('en-IN');
};


const OriginationDashboard = () => {
    const exportRef = useRef<HTMLDivElement>(null);

    // Branch filter (set via Secure Login for Area Manager role)
    const branchFilter: BranchFilter | null = getBranchFilter();
    const isRestricted = branchFilter !== null;

    // Selection State — pre-populate from branchFilter if present
    const [selectedStateName, setSelectedStateName] = useState<string>(
        isRestricted ? branchFilter!.state : "All"
    );
    const [selectedDistrictName, setSelectedDistrictName] = useState<string>(
        isRestricted ? branchFilter!.district : "All"
    );
    const [selectedBranchName, setSelectedBranchName] = useState<string>("All");
    const [selectedCentreName, setSelectedCentreName] = useState<string>("All");
    const [selectedProduct, setSelectedProduct] = useState<'MFI' | 'MSME'>('MFI');

    // Detailed Workflow Definitions
    const MFI_STEPS = [
        { id: 'kyc', label: 'KYC Verification', sla: 1 },
        { id: 'family', label: 'Family Member Details', sla: 1 },
        { id: 'ccir', label: 'Family CCIR Check', sla: 1 },
        { id: 'income', label: 'Household Income Assessment', sla: 2 },
        { id: 'visit', label: 'House Visit', sla: 1 },
        { id: 'cgt', label: 'Compulsory Group Training (CGT)', sla: 3 },
        { id: 'grt', label: 'Group Recognition Test (GRT)', sla: 1 },
        { id: 'bm_app', label: 'Branch Manager Approval', sla: 1 },
        { id: 'credit', label: 'Credit Approval', sla: 1 },
        { id: 'esign', label: 'E-Sign / Documentation', sla: 1 },
        { id: 'disb', label: 'Disbursement', sla: 1 }
    ];

    const MSME_STEPS = [
        { id: 'kyc', label: 'KYC & Bureau Check', sla: 1 },
        { id: 'biz_visit', label: 'Business Premise Visit', sla: 2 },
        { id: 'collateral', label: 'Collateral Valuation', sla: 3 },
        { id: 'cashflow', label: 'Cash Flow Analysis', sla: 2 },
        { id: 'cm_visit', label: 'Credit Manager Visit', sla: 2 },
        { id: 'sanction', label: 'Sanction & Offer Issuance', sla: 2 },
        { id: 'doc', label: 'Legal Documentation', sla: 2 },
        { id: 'disb', label: 'Disbursement', sla: 1 }
    ];

    // Cascading Resets (only when not restricted)
    useEffect(() => {
        if (!isRestricted) {
            setSelectedDistrictName('All');
            setSelectedBranchName('All');
            setSelectedCentreName('All');
        }
    }, [selectedStateName, isRestricted]);

    useEffect(() => {
        if (!isRestricted) {
            setSelectedBranchName('All');
            setSelectedCentreName('All');
        }
    }, [selectedDistrictName, isRestricted]);

    useEffect(() => {
        setSelectedCentreName('All');
    }, [selectedBranchName]);


    // --- ENRICHMENT & AGGREGATION LOGIC ---
    // Similar to BranchDashboard but focused on Pipeline
    const viewData = useMemo((): OriginationViewData => {
        let pipeline: ApplicationPipeline;
        let name = "All India";
        let region = "National";

        // 1. Resolve Hierarchy & Pipeline Data
        if (selectedStateName === 'All') {
            const national = ALL_STATES_DATA.reduce((acc, s) => {
                if (s.pipeline) {
                    Object.keys(s.pipeline).forEach(k => {
                        const key = k as keyof ApplicationPipeline;
                        acc[key].total += s.pipeline![key].total;
                        acc[key].outsideSLA += s.pipeline![key].outsideSLA;
                    });
                }
                return acc;
            }, {
                sourcing: { total: 0, outsideSLA: 0 },
                kyc: { total: 0, outsideSLA: 0 },
                grt: { total: 0, outsideSLA: 0 },
                sanction: { total: 0, outsideSLA: 0 },
                disbursement: { total: 0, outsideSLA: 0 }
            } as ApplicationPipeline);
            pipeline = national;
        } else {
            const state = ALL_STATES_DATA.find(s => s.name === selectedStateName);
            if (!state) {
                // Stale/invalid state selection - use national view
                pipeline = {
                    sourcing: { total: 0, outsideSLA: 0 }, kyc: { total: 0, outsideSLA: 0 },
                    grt: { total: 0, outsideSLA: 0 }, sanction: { total: 0, outsideSLA: 0 }, disbursement: { total: 0, outsideSLA: 0 }
                };
            } else if (selectedDistrictName === 'All') {
                pipeline = state.pipeline!;
                name = state.name;
                region = "State";
            } else {
                const district = state.districts.find(d => d.name === selectedDistrictName);
                if (!district) {
                    // Stale district - fall back to state view
                    pipeline = state.pipeline!;
                    name = state.name;
                    region = "State";
                } else if (selectedBranchName === 'All') {
                    pipeline = district.pipeline!;
                    name = district.name;
                    region = "District";
                } else {
                    const branch = district.branches.find(b => b.name === selectedBranchName);
                    if (!branch) {
                        // Stale branch - fall back to district view
                        pipeline = district.pipeline!;
                        name = district.name;
                        region = "District";
                    } else if (selectedCentreName === 'All') {
                        pipeline = branch.pipeline!;
                        name = branch.name;
                        region = "Branch";
                    } else {
                        const centre = branch.centres.find(c => c.name === selectedCentreName);
                        if (!centre) {
                            // Stale centre - fall back to branch view
                            pipeline = branch.pipeline!;
                            name = branch.name;
                            region = "Branch";
                        } else {
                            pipeline = centre.pipeline || branch.pipeline!;
                            name = centre.name;
                            region = "Centre";
                        }
                    }
                }
            }
        }

        // 2. Calculate Derived Metrics
        const totalApps = pipeline.sourcing.total || 1;
        const sanctioned = pipeline.sanction.total;
        const disbursed = pipeline.disbursement.total;

        const metrics = {
            approvalRate: Math.round((sanctioned / (pipeline.kyc.total || 1)) * 100),
            conversionRate: Math.round((disbursed / totalApps) * 100),
            avgTat: 4.5, // Simulated Average Days
            ats: 32000 + ((totalApps % 23) * 217),        // Deterministic: 32k-37k range
            rejectionRate: 100 - Math.round((sanctioned / (pipeline.kyc.total || 1)) * 100),
            digitalSourcing: 65 + ((totalApps % 15))       // Deterministic: 65-80%
        };

        // 3. Simulate Trend Data (Derived from Pipeline Scale)
        // Create 6 months of trend data
        const trends = MONTHS.slice(-6).map((m, i) => {
            const factor = 0.8 + (i * 0.05); // Growing trend
            return {
                month: m,
                received: Math.floor(totalApps * 0.2 * factor),
                sanctioned: Math.floor(sanctioned * 0.2 * factor),
                disbursed: Math.floor(disbursed * 0.2 * factor)
            };
        });

        return {
            name,
            region,
            pipeline,
            targets: { sourcing: Math.floor(totalApps * 1.1), disbursement: Math.floor(disbursed * 1.1) },
            metrics,
            trends
        };

    }, [selectedStateName, selectedDistrictName, selectedBranchName, selectedCentreName]);


    // --- DROPDOWNS ---
    const availableDistricts = useMemo(() => {
        if (selectedStateName === 'All') return [];
        return ALL_STATES_DATA.find(s => s.name === selectedStateName)?.districts || [];
    }, [selectedStateName]);

    const availableBranches = useMemo(() => {
        if (selectedStateName === 'All' || selectedDistrictName === 'All') return [];
        const all = ALL_STATES_DATA.find(s => s.name === selectedStateName)
            ?.districts.find(d => d.name === selectedDistrictName)?.branches || [];
        if (isRestricted && branchFilter) return all.filter(b => branchFilter.branches.includes(b.name));
        return all;
    }, [selectedStateName, selectedDistrictName, isRestricted, branchFilter]);

    const availableCentres = useMemo(() => {
        if (selectedBranchName === 'All') return [];
        return ALL_STATES_DATA.find(s => s.name === selectedStateName)
            ?.districts.find(d => d.name === selectedDistrictName)
            ?.branches.find(b => b.name === selectedBranchName)?.centres || [];
    }, [selectedBranchName, selectedStateName, selectedDistrictName]);

    // ── Export Logic ──
    const getFilename = (ext: string) => `FINFLUX_Origination_${selectedStateName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.${ext}`;

    const handleExportExcel = async () => {
        const XLSX = await import('xlsx');

        const summaryRows = [
            ['FINFLUX ANALYTICS - ORIGINATION & FUNNEL REPORT'],
            ['Generated', new Date().toLocaleString('en-IN')],
            ['Region', viewData.name],
            ['Product Type', selectedProduct],
            [],
            ['Funnel Stage', 'Total Volume', 'Outside SLA'],
            ['Sourcing', viewData.pipeline.sourcing.total, viewData.pipeline.sourcing.outsideSLA],
            ['KYC', viewData.pipeline.kyc.total, viewData.pipeline.kyc.outsideSLA],
            ['GRT', viewData.pipeline.grt.total, viewData.pipeline.grt.outsideSLA],
            ['Sanctions', viewData.pipeline.sanction.total, viewData.pipeline.sanction.outsideSLA],
            ['Disbursement', viewData.pipeline.disbursement.total, viewData.pipeline.disbursement.outsideSLA],
            [],
            ['Overall KPI', 'Value'],
            ['Approval Rate (%)', viewData.metrics.approvalRate],
            ['Conversion Rate (%)', viewData.metrics.conversionRate],
            ['Average TAT (Days)', viewData.metrics.avgTat]
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), "Summary");
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



    // --- CHART DATA PREP ---
    const funnelData = [
        { stage: 'Sourcing', count: viewData.pipeline.sourcing.total, breach: viewData.pipeline.sourcing.outsideSLA, fill: '#64748b' },
        { stage: 'KYC', count: viewData.pipeline.kyc.total, breach: viewData.pipeline.kyc.outsideSLA, fill: '#3b82f6' },
        { stage: 'GRT', count: viewData.pipeline.grt.total, breach: viewData.pipeline.grt.outsideSLA, fill: '#8b5cf6' },
        { stage: 'Sanctions', count: viewData.pipeline.sanction.total, breach: viewData.pipeline.sanction.outsideSLA, fill: '#f59e0b' },
        { stage: 'Disbursement', count: viewData.pipeline.disbursement.total, breach: viewData.pipeline.disbursement.outsideSLA, fill: '#10b981' },
    ].map(d => ({
        ...d,
        WithinSLA: d.count - d.breach,
        OutsideSLA: d.breach,
        percent: Math.round((d.count / (viewData.pipeline.sourcing.total || 1)) * 100)
    }));

    // --- WORKFLOW SIMULATION ---
    const workflowData = useMemo(() => {
        const steps = selectedProduct === 'MFI' ? MFI_STEPS : MSME_STEPS;
        const isMSME = selectedProduct === 'MSME';
        const factor = isMSME ? 0.05 : 1.0; // MSME volume is ~5% of MFI

        // Anchor Points (Scaled)
        const kyc = Math.floor(viewData.pipeline.kyc.total * factor);
        const grt = Math.floor(viewData.pipeline.grt.total * factor);
        const sanc = Math.floor(viewData.pipeline.sanction.total * factor);
        const disb = Math.floor(viewData.pipeline.disbursement.total * factor);

        return steps.map((step, idx) => {
            let count = 0;
            // Interpolate counts based on main anchors
            if (!isMSME) {
                if (step.id === 'kyc') count = kyc;
                else if (step.id === 'family') count = Math.floor(kyc * 0.99);
                else if (step.id === 'ccir') count = Math.floor(kyc * 0.97);
                else if (step.id === 'income') count = Math.floor(kyc * 0.95);
                else if (step.id === 'visit') count = Math.floor(kyc * 0.92);
                else if (step.id === 'cgt') count = Math.floor(grt * 1.05);
                else if (step.id === 'grt') count = grt;
                else if (step.id === 'bm_app') count = Math.floor(sanc * 1.1);
                else if (step.id === 'credit') count = sanc;
                else if (step.id === 'esign') count = Math.floor(sanc * 0.98);
                else if (step.id === 'disb') count = disb;
            } else { // MSME
                // More aggressive drop-offs for MSME
                const drop = 1 - (idx * 0.12);
                count = Math.max(Math.floor(kyc * (drop > 0.2 ? drop : 0.2)), disb);

                // Align to anchors
                if (step.id === 'sanction') count = sanc;
                if (step.id === 'disb') count = disb;
            }
            // SLA (Higher breach % for MSME usually due to docs)
            const breachRate = isMSME ? 0.15 : 0.05;
            const breach = Math.floor(count * (Math.random() * breachRate));
            return { ...step, count, breach };
        });
    }, [viewData, selectedProduct]);

    // --- CHART DATA ADAPTER ---
    const chartData = useMemo(() => {
        return workflowData.map(step => ({
            name: step.label, // Full Name for Tooltip
            stage: step.id.toUpperCase(), // Short Code for Axis
            count: step.count,
            OutsideSLA: step.breach,
            WithinSLA: step.count - step.breach
        }));
    }, [workflowData]);

    // --- KPI STATS (Product Specific) ---
    const kpiStats = {
        sourced: workflowData.length > 0 ? workflowData[0].count : 0,
        sanctioned: workflowData.find(s => s.id === 'sanction' || s.id === 'credit')?.count || 0,
        disbursed: workflowData.length > 0 ? workflowData[workflowData.length - 1].count : 0,
        ats: selectedProduct === 'MFI'
            ? 32000 + Math.floor(Math.random() * 5000)
            : 420000 + Math.floor(Math.random() * 80000) // MSME ATS ~4.5L
    };

    const conversionRate = kpiStats.sourced > 0 ? Math.round((kpiStats.disbursed / kpiStats.sourced) * 100) : 0;
    const approvalRate = kpiStats.sourced > 0 ? Math.round((kpiStats.sanctioned / kpiStats.sourced) * 100) : 0;

    return (
        <div ref={exportRef} className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-secondary-900">Loan Origination Analytics</h2>
                    <p className="text-secondary-500">Pipeline Efficiency, TAT, and Conversion Ratios</p>
                </div>

                {/* SELECTORS */}
                <div className="flex items-center gap-2 flex-wrap pb-2 md:pb-0">
                    <select className="bg-white border text-secondary-900 text-sm rounded-lg p-2 font-semibold shadow-sm outline-none disabled:opacity-70 disabled:cursor-not-allowed"
                        value={selectedStateName}
                        onChange={(e) => setSelectedStateName(e.target.value)}
                        disabled={isRestricted}>
                        <option value="All">All States</option>
                        {ALL_STATES_DATA.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                    </select>
                    <select className="bg-white border text-secondary-900 text-sm rounded-lg p-2 font-semibold shadow-sm outline-none disabled:opacity-70 disabled:cursor-not-allowed"
                        disabled={selectedStateName === 'All' || isRestricted}
                        value={selectedDistrictName}
                        onChange={(e) => setSelectedDistrictName(e.target.value)}>
                        <option value="All">All Districts</option>
                        {availableDistricts.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
                    </select>
                    <select className="bg-white border text-secondary-900 text-sm rounded-lg p-2 font-semibold shadow-sm outline-none disabled:opacity-70 disabled:cursor-not-allowed"
                        disabled={selectedDistrictName === 'All'}
                        value={selectedBranchName}
                        onChange={(e) => setSelectedBranchName(e.target.value)}>
                        <option value="All">All Branches</option>
                        {availableBranches.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                    </select>
                    <select className="bg-white border text-secondary-900 text-sm rounded-lg p-2 font-semibold shadow-sm outline-none disabled:opacity-70 disabled:cursor-not-allowed"
                        disabled={selectedBranchName === 'All'}
                        value={selectedCentreName}
                        onChange={(e) => setSelectedCentreName(e.target.value)}>
                        <option value="All">All Centres</option>
                        {availableCentres.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                    </select>

                    <div className="relative group z-50 ml-2">
                        <button className="bg-white border border-secondary-200 rounded-lg px-3 py-[9px] text-sm text-secondary-700 hover:bg-secondary-50 flex items-center gap-2 shadow-sm font-medium transition-colors">
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

            {/* KPI GRID */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <KPICard title="Applications Sourced" value={fmtCount(kpiStats.sourced)}
                    subValue={`Target: ${fmtCount(Math.floor(kpiStats.sourced * 1.1))}`}
                    icon={FileText} className="border-l-4 border-l-blue-500" />
                <KPICard title="Sanctions Issued" value={fmtCount(kpiStats.sanctioned)}
                    subValue={`${approvalRate}% Approval Rate`}
                    icon={CheckCircle2} className="border-l-4 border-l-amber-500" />
                <KPICard title="Disbursements" value={fmtCount(kpiStats.disbursed)}
                    subValue={`${conversionRate}% Conversion (E2E)`}
                    icon={TrendingUp} className="border-l-4 border-l-emerald-500" />
                <KPICard title="Avg Turnaround Time" value={`${viewData.metrics.avgTat} Days`}
                    subValue="Sourcing to Disb."
                    icon={Clock} className="border-l-4 border-l-purple-500" />
            </div>

            {/* QUALITY & EFFICIENCY METRICS */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <KPICard title="Avg Ticket Size" value={selectedProduct === 'MFI' ? fmtL(kpiStats.ats / 100000) : `₹${(kpiStats.ats / 1000).toFixed(0)}k`}
                    subValue="Per Disbursal"
                    icon={Banknote} className="border-l-4 border-l-teal-500" />
                <KPICard title="Rejection Rate" value={`${100 - approvalRate}%`}
                    subValue="Risk Filter Efficiency"
                    icon={XCircle} className="border-l-4 border-l-rose-500" />
                <KPICard title="Digital Sourcing" value={`${viewData.metrics.digitalSourcing}%`}
                    subValue="Paperless Onboarding"
                    icon={Smartphone} className="border-l-4 border-l-indigo-500" />
                <KPICard title="Pipeline Lag" value={fmtCount(kpiStats.sanctioned - kpiStats.disbursed)}
                    subValue="Sanctioned vs Disbursed"
                    icon={Clock} className="border-l-4 border-l-orange-500" />
            </div>

            {/* MAIN VISUALS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* 1. FUNNEL ANALYSIS */}
                <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-secondary-200 shadow-sm">
                    <h3 className="text-lg font-bold text-secondary-900 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <span>Origination Funnel & SLA</span>
                        {/* PRODUCT TOGGLE */}
                        <div className="flex bg-secondary-100 p-1 rounded-lg">
                            <button
                                onClick={() => setSelectedProduct('MFI')}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${selectedProduct === 'MFI' ? 'bg-white text-primary-600 shadow-sm' : 'text-secondary-500 hover:text-secondary-900'}`}
                            >
                                <Users size={14} /> MFI (JLG)
                            </button>
                            <button
                                onClick={() => setSelectedProduct('MSME')}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${selectedProduct === 'MSME' ? 'bg-white text-primary-600 shadow-sm' : 'text-secondary-500 hover:text-secondary-900'}`}
                            >
                                <Building2 size={14} /> Individual
                            </button>
                        </div>
                    </h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={chartData} barSize={selectedProduct === 'MFI' ? 30 : 50}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="stage" axisLine={false} tickLine={false} />
                                <YAxis axisLine={false} tickLine={false} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    cursor={{ fill: 'transparent' }}
                                />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                {/* Context Bar */}
                                <Bar isAnimationActive={false} dataKey="count" fill="#e2e8f0" radius={[4, 4, 4, 4]} name="Total Frequency">
                                    <LabelList dataKey="count" position="top" fill="#64748b" fontSize={10} />
                                </Bar>
                                {/* Metric Lines */}
                                <Line isAnimationActive={false} type="monotone" dataKey="WithinSLA" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} name="Within SLA" />
                                <Line isAnimationActive={false} type="monotone" dataKey="OutsideSLA" stroke="#f43f5e" strokeWidth={3} dot={{ r: 4 }} name="Outside SLA" />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. REJECTION & FALLOUT */}
                {/* 2. DETAILED PRODUCT WORKFLOW */}
                <div className="bg-white p-6 rounded-xl border border-secondary-200 shadow-sm overflow-hidden">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                        <div>
                            <h3 className="text-lg font-bold text-secondary-900">Detailed Process Tracker</h3>
                            <p className="text-xs text-secondary-500">Stage-wise volume and SLA monitoring</p>
                        </div>
                        {/* PRODUCT TOGGLE */}
                        <div className="flex bg-secondary-100 p-1 rounded-lg">
                            <button
                                onClick={() => setSelectedProduct('MFI')}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${selectedProduct === 'MFI' ? 'bg-white text-primary-600 shadow-sm' : 'text-secondary-500 hover:text-secondary-900'}`}
                            >
                                <Users size={14} /> MFI (JLG)
                            </button>
                            <button
                                onClick={() => setSelectedProduct('MSME')}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${selectedProduct === 'MSME' ? 'bg-white text-primary-600 shadow-sm' : 'text-secondary-500 hover:text-secondary-900'}`}
                            >
                                <Building2 size={14} /> Individual
                            </button>
                        </div>
                    </div>

                    <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {workflowData.map((step: any, idx: number) => (
                            <div key={step.id} className="flex items-center gap-4 group">
                                {/* Step Indicator */}
                                <div className="flex flex-col items-center">
                                    <div className={`w-2 h-2 rounded-full ${step.breach > 0 ? 'bg-rose-500' : 'bg-emerald-500'}`}></div>
                                    {idx < workflowData.length - 1 && <div className="w-0.5 h-full bg-secondary-100 my-1 group-last:hidden"></div>}
                                </div>

                                {/* Content */}
                                <div className="flex-1 border-b border-secondary-50 pb-4 group-last:border-0 group-last:pb-0">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="font-semibold text-secondary-800 text-sm">{step.label}</span>
                                        <span className="font-bold text-secondary-900">{fmtCount(step.count)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-secondary-400">Target SLA: {step.sla} Day(s)</span>
                                        {step.breach > 0 ? (
                                            <span className="text-rose-600 font-medium bg-rose-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                <Clock size={10} /> {step.breach} Delayed
                                            </span>
                                        ) : (
                                            <span className="text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                <CheckCircle2 size={10} /> On Track
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* FALLOUT ANALYSIS */}
                <div className="bg-white p-6 rounded-xl border border-secondary-200 shadow-sm">
                    <h3 className="text-lg font-bold text-secondary-900 mb-6">Pipeline Fallout Analysis</h3>
                    <div className="space-y-6">
                        {chartData.slice(0, -1).map((stage, idx) => {
                            const nextStage = chartData[idx + 1];
                            const drop = stage.count - (nextStage?.count || 0);
                            const dropPct = stage.count > 0 ? Math.round((drop / stage.count) * 100) : 0;
                            if (!nextStage || drop <= 0) return null; // Skip if no drop (or growth steps like lead gen)

                            return (
                                <div key={stage.name} className="relative">
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="font-medium text-secondary-700">{stage.name} → {nextStage.name}</span>
                                        <span className="text-rose-600 font-bold">{dropPct}% Drop</span>
                                    </div>
                                    <div className="w-full bg-secondary-100 h-2 rounded-full">
                                        <div className="bg-rose-500 h-2 rounded-full" style={{ width: `${Math.min(dropPct, 100)}%` }}></div>
                                    </div>
                                    <div className="text-xs text-secondary-500 mt-1">
                                        {fmtCount(drop)} applications lost
                                    </div>
                                    {idx < chartData.length - 2 && <div className="absolute left-0 right-0 -bottom-3 border-b border-dashed border-secondary-200"></div>}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* 3. TREND ANALYSIS */}
                <div className="lg:col-span-3 bg-white p-6 rounded-xl border border-secondary-200 shadow-sm">
                    <h3 className="text-lg font-bold text-secondary-900 mb-6">Origination Volume Trend (Last 6 Months)</h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={viewData.trends}>
                                <defs>
                                    <linearGradient id="colorApps" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorDisb" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="month" axisLine={false} tickLine={false} />
                                <YAxis axisLine={false} tickLine={false} />
                                <Tooltip />
                                <Legend />
                                <Area isAnimationActive={false} type="monotone" dataKey="received" name="Applications Received" stroke="#3b82f6" fillOpacity={1} fill="url(#colorApps)" strokeWidth={3} />
                                <Area isAnimationActive={false} type="monotone" dataKey="disbursed" name="Disbursements" stroke="#10b981" fillOpacity={1} fill="url(#colorDisb)" strokeWidth={3} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OriginationDashboard;
