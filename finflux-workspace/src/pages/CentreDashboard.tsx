import { useState, useEffect, useMemo, useRef } from 'react';
import { Building2, Users, Banknote, TrendingUp, MapPin, UserCheck, ClipboardCheck, Target, AlertTriangle, BadgePercent, ShieldAlert, Download, Camera, Lock } from 'lucide-react';
import { saveFile, exportToPDF, exportToPPT } from '../lib/utils';
import KPICard from '../components/KPICard';
import { ALL_STATES_DATA, getGlobalStats } from '../data/geoDataComplete';
import { COMPANY_METRICS } from '../data/mfiData';
import { getBranchFilter, type BranchFilter } from '../data/users';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ScatterChart, Scatter, ZAxis, CartesianGrid } from 'recharts';

interface CentreData {
    name: string;
    region: string;
    state: string;
    branch: string;
    glp: number;
    clients: number;
    par30: number;
    par90: number;
    meetings: {
        total: number;
        compliance: number; // %
        avgAttendance: number; // %
    };
    productivity: {
        fieldOfficers: number;
        caseloadPerOfficer: number;
        disbursementPerOfficer: number; // Lakhs
        collectionPerOfficer: number; // Lakhs
        visitsPerCycle: number;
        attritionRate: number; // %
    };
    collection: {
        withinRange: number; // %
        outsideRange: number; // %
    };
    digitalSplit: {
        digital: number; // %
        cash: number; // %
    };
    operations: {
        lucPending: number;
        insurancePending: number;
        leadsGenerated: number;
    };
    riskScore: number; // 0-10
}

const fmtCr = (v: number) => `₹${v.toFixed(2)} Cr`;
const fmtL = (v: number) => `₹${v.toFixed(2)} L`;

const CentreDashboard = () => {
    const exportRef = useRef<HTMLDivElement>(null);

    // Branch filter (set via Secure Login for BM/Area Manager roles)
    const branchFilter: BranchFilter | null = getBranchFilter();
    const isRestricted = branchFilter !== null;

    const [selectedStateName, setSelectedStateName] = useState<string>(
        isRestricted ? branchFilter!.state : "All"
    );
    const [selectedDistrictName, setSelectedDistrictName] = useState<string>(
        isRestricted ? branchFilter!.district : "All"
    );
    const [selectedBranchName, setSelectedBranchName] = useState<string>(
        isRestricted && branchFilter!.branches.length === 1 ? branchFilter!.branches[0] : "All"
    );
    const [selectedCentreName, setSelectedCentreName] = useState<string>("All");

    // Cascading resets (only when not restricted)
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

    // Available options based on selections
    const availableDistricts = useMemo(() => {
        if (selectedStateName === 'All') return [];
        const state = ALL_STATES_DATA.find(s => s.name === selectedStateName);
        return state?.districts || [];
    }, [selectedStateName]);

    const availableBranches = useMemo(() => {
        if (selectedDistrictName === 'All') return [];
        const state = ALL_STATES_DATA.find(s => s.name === selectedStateName);
        const district = state?.districts.find(d => d.name === selectedDistrictName);
        const all = district?.branches || [];
        // Restrict to allowed branches for BM/Area Manager
        if (isRestricted && branchFilter) return all.filter(b => branchFilter.branches.includes(b.name));
        return all;
    }, [selectedStateName, selectedDistrictName, isRestricted, branchFilter]);

    const availableCentres = useMemo(() => {
        if (selectedBranchName === 'All') return [];
        const state = ALL_STATES_DATA.find(s => s.name === selectedStateName);
        const district = state?.districts.find(d => d.name === selectedDistrictName);
        const branch = district?.branches.find(b => b.name === selectedBranchName);
        return branch?.centres || [];
    }, [selectedStateName, selectedDistrictName, selectedBranchName]);

    // Generate centre data
    const centreData = useMemo((): CentreData => {
        const globalStats = getGlobalStats();

        // National aggregation
        if (selectedStateName === 'All') {
            return {
                name: "All Centers",
                region: "National",
                state: "Pan-India",
                branch: "All Branches",
                glp: COMPANY_METRICS.currentGLP,
                clients: COMPANY_METRICS.activeClients,
                par30: COMPANY_METRICS.parOver30,
                par90: COMPANY_METRICS.par90,
                meetings: {
                    total: 85000,
                    compliance: 92,
                    avgAttendance: 88
                },
                productivity: {
                    fieldOfficers: globalStats.staffCount || 6500,
                    caseloadPerOfficer: 412,
                    disbursementPerOfficer: 18.5,
                    collectionPerOfficer: 12.3,
                    visitsPerCycle: 52,
                    attritionRate: 14.2
                },
                collection: {
                    withinRange: 92,
                    outsideRange: 8
                },
                digitalSplit: {
                    digital: 65,
                    cash: 35
                },
                operations: {
                    lucPending: globalStats.lucPending || 0,
                    insurancePending: globalStats.insurancePending || 0,
                    leadsGenerated: globalStats.leadsGenerated || 0
                },
                riskScore: 3.2
            };
        }

        const state = ALL_STATES_DATA.find(s => s.name === selectedStateName)!;

        // State aggregation
        if (selectedDistrictName === 'All') {
            const totalCentres = state.districts.reduce((sum, d) =>
                sum + d.branches.reduce((bSum, b) => bSum + b.centres.length, 0), 0);

            return {
                name: `All Centers in ${state.name}`,
                region: state.name,
                state: state.name,
                branch: "All Branches",
                glp: state.glp,                  // Scaled GLP from enrichMetrics
                clients: state.clients || 0,      // Scaled clients from enrichMetrics
                par30: state.par30 || 1.5,
                par90: state.par90 || 0.8,
                meetings: {
                    total: totalCentres,
                    compliance: 91,
                    avgAttendance: 87
                },
                productivity: {
                    fieldOfficers: Math.floor((state.staffCount || 1000)),
                    caseloadPerOfficer: 420,
                    disbursementPerOfficer: 19.2,
                    collectionPerOfficer: 13.1,
                    visitsPerCycle: 51,
                    attritionRate: 13.8
                },
                collection: {
                    withinRange: 91,
                    outsideRange: 9
                },
                digitalSplit: {
                    digital: 63,
                    cash: 37
                },
                operations: {
                    lucPending: state.lucPending || 0,
                    insurancePending: state.insurancePending || 0,
                    leadsGenerated: state.leadsGenerated || 0
                },
                riskScore: 3.5
            };
        }

        const district = state.districts.find(d => d.name === selectedDistrictName);
        // Guard: stale selection during state switch - fall back to state view
        if (!district) {
            const totalCentres2 = state.districts.reduce((sum, d) =>
                sum + d.branches.reduce((bSum, b) => bSum + b.centres.length, 0), 0);
            return {
                name: `All Centers in ${state.name}`, region: state.name, state: state.name, branch: "All Branches",
                glp: state.glp, clients: state.clients || 0, par30: state.par30 || 1.5, par90: state.par90 || 0.8,
                meetings: { total: totalCentres2, compliance: 91, avgAttendance: 87 },
                productivity: {
                    fieldOfficers: Math.floor(state.staffCount || 1000), caseloadPerOfficer: 420,
                    disbursementPerOfficer: 19.2, collectionPerOfficer: 13.1, visitsPerCycle: 51, attritionRate: 13.8
                },
                collection: { withinRange: 91, outsideRange: 9 },
                digitalSplit: { digital: 63, cash: 37 },
                operations: { lucPending: state.lucPending || 0, insurancePending: state.insurancePending || 0, leadsGenerated: state.leadsGenerated || 0 },
                riskScore: 3.5
            };
        }

        // District aggregation
        if (selectedBranchName === 'All') {
            const totalCentres = district.branches.reduce((sum, b) => sum + b.centres.length, 0);

            return {
                name: `All Centers in ${district.name}`,
                region: district.name,
                state: state.name,
                branch: "All Branches",
                glp: district.glp,                 // Scaled GLP from enrichMetrics
                clients: district.clients || 0,    // Scaled clients from enrichMetrics
                par30: district.par30 || 1.5,
                par90: district.par90 || 0.8,
                meetings: {
                    total: totalCentres,
                    compliance: 90,
                    avgAttendance: 86
                },
                productivity: {
                    fieldOfficers: Math.floor((district.staffCount || 150) / 1.5),
                    caseloadPerOfficer: 430,
                    disbursementPerOfficer: 18.8,
                    collectionPerOfficer: 12.9,
                    visitsPerCycle: 50,
                    attritionRate: 15.1
                },
                collection: {
                    withinRange: 89,
                    outsideRange: 11
                },
                digitalSplit: {
                    digital: 61,
                    cash: 39
                },
                operations: {
                    lucPending: district.lucPending || 0,
                    insurancePending: district.insurancePending || 0,
                    leadsGenerated: district.leadsGenerated || 0
                },
                riskScore: 3.8
            };
        }

        const branch = district.branches.find(b => b.name === selectedBranchName);
        // Guard: stale selection during state switch - fall back to district view
        if (!branch) {
            const totalCentres3 = district.branches.reduce((sum, b) => sum + b.centres.length, 0);
            return {
                name: `All Centers in ${district.name}`, region: district.name, state: state.name, branch: "All Branches",
                glp: district.glp, clients: district.clients || 0, par30: district.par30 || 1.5, par90: district.par90 || 0.8,
                meetings: { total: totalCentres3, compliance: 90, avgAttendance: 86 },
                productivity: {
                    fieldOfficers: Math.floor((district.staffCount || 150) / 1.5), caseloadPerOfficer: 430,
                    disbursementPerOfficer: 18.8, collectionPerOfficer: 12.9, visitsPerCycle: 50, attritionRate: 15.1
                },
                collection: { withinRange: 89, outsideRange: 11 },
                digitalSplit: { digital: 61, cash: 39 },
                operations: { lucPending: district.lucPending || 0, insurancePending: district.insurancePending || 0, leadsGenerated: district.leadsGenerated || 0 },
                riskScore: 3.8
            };
        }

        // Branch aggregation
        // Scale branch GLP proportionally from district scaled GLP to maintain consistency.
        // Raw branch GLP (from sample data) is ~0.45 Cr, but district shows 800+ Cr.
        if (selectedCentreName === 'All') {
            const rawDistrictGlp = district.branches.reduce((s, b) => s + b.glp, 0);
            const rawDistrictClients = district.branches.reduce((s, b) => s + b.clients, 0);
            const branchGlpScaled = rawDistrictGlp > 0
                ? branch.glp * (district.glp / rawDistrictGlp)
                : branch.glp;
            const branchClientsScaled = rawDistrictClients > 0
                ? Math.floor(branch.clients * ((district.clients || 0) / rawDistrictClients))
                : branch.clients;
            return {
                name: `All Centers in ${branch.name}`,
                region: branch.name,
                state: state.name,
                branch: branch.name,
                glp: branchGlpScaled,
                clients: branchClientsScaled,
                par30: branch.par30 || 1.5,
                par90: branch.par90 || 0.8,
                meetings: {
                    total: branch.centres.length,
                    compliance: 89,
                    avgAttendance: 85
                },
                productivity: {
                    fieldOfficers: 4,
                    caseloadPerOfficer: Math.floor(branchClientsScaled / 4),
                    disbursementPerOfficer: parseFloat((branchGlpScaled * 0.12 * 100 / 4).toFixed(2)),
                    collectionPerOfficer: parseFloat((branchGlpScaled * 0.08 * 100 / 4).toFixed(2)),
                    visitsPerCycle: 48,
                    attritionRate: 16.2
                },
                collection: {
                    withinRange: 88,
                    outsideRange: 12
                },
                digitalSplit: {
                    digital: 60,
                    cash: 40
                },
                operations: {
                    lucPending: branch.lucPending || 0,
                    insurancePending: branch.insurancePending || 0,
                    leadsGenerated: branch.leadsGenerated || 0
                },
                riskScore: (branch.par90 || 0) > 5 ? 8.5 : (branch.par90 || 0) > 2 ? 5.2 : 2.8
            };
        }

        // Individual centre
        const centre = branch.centres.find(c => c.name === selectedCentreName)!;
        const centreGLP = centre.glp / 100; // Convert lakhs to crores
        // Deterministic "variance" from centre data so values don't flicker on re-render
        const seed = (centre.clients % 17) + (Math.round(centreGLP * 100) % 13);

        return {
            name: centre.name,
            region: branch.name,
            state: state.name,
            branch: branch.name,
            glp: centreGLP,
            clients: centre.clients,
            par30: centre.par30 || 1.5,
            par90: centre.par90 ? (centre.par30 || 1.5) * 0.45 : 0.8,
            meetings: {
                total: Math.floor(centre.clients / 25), // ~25 clients per group
                compliance: 85 + (seed % 10),
                avgAttendance: 82 + (seed % 8)
            },
            productivity: {
                fieldOfficers: 1,
                caseloadPerOfficer: centre.clients,
                disbursementPerOfficer: parseFloat((centreGLP * 0.12 * 100).toFixed(2)),
                collectionPerOfficer: parseFloat((centreGLP * 0.08 * 100).toFixed(2)),
                visitsPerCycle: 45 + (seed % 10),
                attritionRate: 12 + (seed % 8)
            },
            collection: {
                withinRange: 85 + (seed % 10),
                outsideRange: 5 + ((seed + 3) % 10)
            },
            digitalSplit: {
                digital: 45 + (seed % 20),
                get cash() { return 100 - this.digital; }
            },
            operations: {
                lucPending: centre.lucPending ?? 0,
                insurancePending: centre.insurancePending ?? 0,
                leadsGenerated: centre.leadsGenerated || (20 + (seed % 15))
            },
            riskScore: centre.par30 > 5 ? 8 : centre.par30 > 2 ? 5 : 3
        };
    }, [selectedStateName, selectedDistrictName, selectedBranchName, selectedCentreName]);

    // ── Export Logic ──
    const getFilename = (ext: string) => `FINFLUX_Centre_${centreData.region.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.${ext}`;

    const handleExportExcel = async () => {
        const XLSX = await import('xlsx');

        const summaryRows = [
            ['FINFLUX ANALYTICS - CENTRE PERFORMANCE REPORT'],
            ['Generated', new Date().toLocaleString('en-IN')],
            ['Region', centreData.region],
            ['Centre/Branch', centreData.name],
            [],
            ['Overall KPI', 'Value'],
            ['Portfolio (GLP) Cr', centreData.glp.toFixed(2)],
            ['Active Clients', centreData.clients.toLocaleString()],
            ['PAR 30 (%)', centreData.par30.toFixed(2)],
            ['PAR 90 (%)', centreData.par90.toFixed(2)],
            ['Meeting Compliance (%)', centreData.meetings.compliance],
            ['Avg Attendance (%)', centreData.meetings.avgAttendance],
            ['Collection Within Range (%)', centreData.collection.withinRange],
            ['Digital Collection (%)', centreData.digitalSplit.digital],
            ['Staff Attrition (%)', centreData.productivity.attritionRate],
            ['Risk Score (/10)', centreData.riskScore.toFixed(1)]
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

    return (
        <div ref={exportRef} className="flex flex-col h-[calc(100vh-100px)] p-6 gap-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-secondary-900">Centre Performance & Field Operations</h1>
                <p className="text-secondary-500">Centre-level metrics and field officer productivity analytics</p>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl border border-secondary-200 shadow-sm">
                <div className="flex flex-wrap items-center gap-4">
                    {/* State */}
                    <div className="relative group">
                        <label className="text-[10px] text-secondary-500 font-bold uppercase tracking-wider mb-1 block">
                            {isRestricted && <Lock size={9} className="inline mr-1 text-amber-500" />}State
                        </label>
                        <select
                            className="bg-secondary-50 border border-secondary-200 text-secondary-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-32 p-2.5 outline-none font-semibold disabled:opacity-70 disabled:cursor-not-allowed"
                            value={selectedStateName}
                            onChange={(e) => setSelectedStateName(e.target.value)}
                            disabled={isRestricted}
                        >
                            <option value="All">All States</option>
                            {ALL_STATES_DATA.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                        </select>
                    </div>

                    {/* District */}
                    <div className={`relative group ${selectedStateName === 'All' ? 'opacity-50 pointer-events-none' : ''}`}>
                        <label className="text-[10px] text-secondary-500 font-bold uppercase tracking-wider mb-1 block">
                            {isRestricted && <Lock size={9} className="inline mr-1 text-amber-500" />}District
                        </label>
                        <select
                            className="bg-secondary-50 border border-secondary-200 text-secondary-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-32 p-2.5 outline-none font-semibold disabled:opacity-70 disabled:cursor-not-allowed"
                            value={selectedDistrictName}
                            onChange={(e) => setSelectedDistrictName(e.target.value)}
                            disabled={selectedStateName === 'All' || isRestricted}
                        >
                            <option value="All">All Districts</option>
                            {availableDistricts.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
                        </select>
                    </div>

                    {/* Branch */}
                    <div className={`relative group ${selectedDistrictName === 'All' ? 'opacity-50 pointer-events-none' : ''}`}>
                        <label className="text-[10px] text-secondary-500 font-bold uppercase tracking-wider mb-1 block">Branch</label>
                        <select
                            className="bg-secondary-50 border border-secondary-200 text-secondary-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-40 p-2.5 outline-none font-semibold disabled:opacity-70 disabled:cursor-not-allowed"
                            value={selectedBranchName}
                            onChange={(e) => setSelectedBranchName(e.target.value)}
                            disabled={selectedDistrictName === 'All'}
                        >
                            {/* For single-branch BM, no "All Branches" option */}
                            {!(isRestricted && branchFilter!.branches.length === 1) && (
                                <option value="All">All Branches</option>
                            )}
                            {availableBranches.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                        </select>
                    </div>

                    {/* Centre */}
                    <div className={`relative group ${selectedBranchName === 'All' ? 'opacity-50 pointer-events-none' : ''}`}>
                        <label className="text-[10px] text-secondary-500 font-bold uppercase tracking-wider mb-1 block">Centre</label>
                        <select
                            className="bg-blue-50 border border-blue-200 text-blue-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-40 p-2.5 outline-none font-bold"
                            value={selectedCentreName}
                            onChange={(e) => setSelectedCentreName(e.target.value)}
                            disabled={selectedBranchName === 'All'}
                        >
                            <option value="All">All Centres</option>
                            {availableCentres.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                        </select>
                    </div>

                    <div className="ml-auto text-right flex items-center gap-4">
                        <div>
                            <p className="text-secondary-500 flex items-center justify-end gap-1 text-xs"><MapPin size={12} /> {centreData.region}</p>
                            <h2 className="text-xl font-bold text-secondary-900">{centreData.name}</h2>
                        </div>
                        <div className="relative group z-50">
                            <button className="bg-white border border-secondary-200 rounded-lg px-3 py-2 text-sm text-secondary-700 hover:bg-secondary-50 flex items-center gap-2 shadow-sm font-medium transition-colors">
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
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto space-y-6 pr-2">

                {/* SECTION 1: EXECUTIVE OVERVIEW */}
                <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-secondary-800 flex items-center gap-2">
                        <div className="h-1 w-1 rounded-full bg-primary-500"></div>
                        Executive Overview
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <KPICard
                            title="Outstanding GLP"
                            value={fmtCr(centreData.glp)}
                            subValue={`${centreData.clients.toLocaleString()} Clients`}
                            trend="up"
                            trendValue="8.2%"
                            icon={Banknote}
                            className="border-l-4 border-l-blue-500"
                        />
                        <KPICard
                            title="Collection Efficiency"
                            value={`${centreData.meetings.compliance}%`}
                            subValue={`${centreData.meetings.avgAttendance}% Attendance`}
                            trend={centreData.meetings.compliance >= 95 ? "up" : "down"}
                            trendValue={centreData.meetings.compliance >= 95 ? "Excellent" : "Monitor"}
                            icon={BadgePercent}
                            className="border-l-4 border-l-emerald-500"
                        />
                        <KPICard
                            title="Digital Adoption"
                            value={`${centreData.digitalSplit.digital}%`}
                            subValue={`Cash: ${centreData.digitalSplit.cash}%`}
                            trend="up"
                            trendValue="12.5%"
                            icon={TrendingUp}
                            className="border-l-4 border-l-purple-500"
                        />
                        <KPICard
                            title="NPA (90+ Days)"
                            value={`${(centreData.par30 * 0.5).toFixed(2)}%`}
                            subValue={`PAR 30: ${centreData.par30.toFixed(2)}%`}
                            trend="down"
                            trendValue={centreData.par30 < 2.0 ? "Optimal" : "Monitor"}
                            icon={ShieldAlert}
                            className="border-l-4 border-l-rose-500"
                        />
                    </div>
                </div>

                {/* Divider */}
                <div className="border-t border-secondary-200"></div>

                {/* SECTION 2: CENTRE OVERVIEW */}
                <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-secondary-800 flex items-center gap-2">
                        <div className="h-1 w-1 rounded-full bg-primary-500"></div>
                        Centre Overview
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <KPICard
                            title="Portfolio (GLP)"
                            value={fmtCr(centreData.glp)}
                            subValue={`${centreData.clients.toLocaleString()} Clients`}
                            trend="up"
                            trendValue="8.2%"
                            icon={Banknote}
                            className="border-l-4 border-l-blue-500"
                        />
                        <KPICard
                            title="PAR 30 Days"
                            value={`${centreData.par30.toFixed(2)}%`}
                            subValue="Portfolio Quality"
                            trend={centreData.par30 < 2 ? "up" : "down"}
                            trendValue={centreData.par30 < 2 ? "Good" : "Monitor"}
                            icon={TrendingUp}
                            className="border-l-4 border-l-emerald-500"
                        />
                        <KPICard
                            title="Field Officers"
                            value={centreData.productivity.fieldOfficers.toString()}
                            subValue={`${centreData.productivity.caseloadPerOfficer} Avg Caseload`}
                            trend="neutral"
                            trendValue="Optimal"
                            icon={Users}
                            className="border-l-4 border-l-purple-500"
                        />
                        <KPICard
                            title="Meeting Compliance"
                            value={`${centreData.meetings.compliance}%`}
                            subValue={`${centreData.meetings.avgAttendance}% Avg Attendance`}
                            trend="up"
                            trendValue="Strong"
                            icon={ClipboardCheck}
                            className="border-l-4 border-l-amber-500"
                        />
                    </div>
                </div>

                {/* Divider */}
                <div className="border-t border-secondary-200"></div>

                {/* SECTION 3: WORKFORCE PRODUCTIVITY */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-secondary-800 flex items-center gap-2">
                        <div className="h-1 w-1 rounded-full bg-primary-500"></div>
                        Workforce Productivity
                    </h3>
                    <div className="bg-white p-6 rounded-xl border border-secondary-200 shadow-sm">
                        <h4 className="text-md font-semibold text-secondary-900 mb-4">Field Officer Performance</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg">
                                <div className="text-xs text-blue-600 font-semibold mb-1">Disbursement / Officer</div>
                                <div className="text-2xl font-bold text-blue-900">{fmtL(centreData.productivity.disbursementPerOfficer)}</div>
                            </div>
                            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-4 rounded-lg">
                                <div className="text-xs text-emerald-600 font-semibold mb-1">Collection / Officer</div>
                                <div className="text-2xl font-bold text-emerald-900">{fmtL(centreData.productivity.collectionPerOfficer)}</div>
                            </div>
                            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg">
                                <div className="text-xs text-purple-600 font-semibold mb-1">Field Visits / Cycle</div>
                                <div className="text-2xl font-bold text-purple-900">{centreData.productivity.visitsPerCycle}</div>
                            </div>
                            <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-4 rounded-lg">
                                <div className="text-xs text-amber-600 font-semibold mb-1">Caseload / Officer</div>
                                <div className="text-2xl font-bold text-amber-900">{centreData.productivity.caseloadPerOfficer}</div>
                            </div>
                            <div className="bg-gradient-to-br from-rose-50 to-rose-100 p-4 rounded-lg">
                                <div className="text-xs text-rose-600 font-semibold mb-1">Risk Score</div>
                                <div className="text-2xl font-bold text-rose-900">{centreData.riskScore.toFixed(1)}/10</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Divider */}
                <div className="border-t border-secondary-200"></div>

                {/* SECTION 4: OPERATIONAL COMPLIANCE */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-secondary-800 flex items-center gap-2">
                        <div className="h-1 w-1 rounded-full bg-primary-500"></div>
                        Operational Compliance
                    </h3>
                    {/* Workforce & Collection Compliance */}
                    <div className="bg-white p-6 rounded-xl border border-secondary-200 shadow-sm">
                        <h4 className="text-md font-semibold text-secondary-900 mb-4">Workforce & Collection Compliance</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="border border-rose-200 bg-rose-50 p-4 rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-semibold text-rose-700">Staff Attrition Risk</span>
                                    <AlertTriangle className="text-rose-600" size={20} />
                                </div>
                                <div className="text-3xl font-bold text-rose-900">{centreData.productivity.attritionRate.toFixed(1)}%</div>
                                <div className="text-xs text-rose-600 mt-1">Annual Turnover Rate</div>
                            </div>
                            <div className="border border-emerald-200 bg-emerald-50 p-4 rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-semibold text-emerald-700">Collections Within Range</span>
                                    <ClipboardCheck className="text-emerald-600" size={20} />
                                </div>
                                <div className="text-3xl font-bold text-emerald-900">{centreData.collection.withinRange}%</div>
                                <div className="text-xs text-emerald-600 mt-1">Meeting Schedule</div>
                            </div>
                            <div className="border border-amber-200 bg-amber-50 p-4 rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-semibold text-amber-700">Collections Outside Range</span>
                                    <AlertTriangle className="text-amber-600" size={20} />
                                </div>
                                <div className="text-3xl font-bold text-amber-900">{centreData.collection.outsideRange}%</div>
                                <div className="text-xs text-amber-600 mt-1">Off Schedule</div>
                            </div>
                        </div>
                    </div>

                    {/* Digital vs Cash Collection */}
                    <div className="bg-white p-6 rounded-xl border border-secondary-200 shadow-sm">
                        <h3 className="text-lg font-bold text-secondary-900 mb-4">Collection Mode Distribution</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="border border-blue-200 bg-blue-50 p-4 rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-semibold text-blue-700">Digital Collection</span>
                                    <ClipboardCheck className="text-blue-600" size={20} />
                                </div>
                                <div className="text-3xl font-bold text-blue-900">{centreData.digitalSplit.digital}%</div>
                                <div className="text-xs text-blue-600 mt-1">UPI, Bank Transfer, Cards</div>
                            </div>
                            <div className="border border-emerald-200 bg-emerald-50 p-4 rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-semibold text-emerald-700">Cash Collection</span>
                                    <Banknote className="text-emerald-600" size={20} />
                                </div>
                                <div className="text-3xl font-bold text-emerald-900">{centreData.digitalSplit.cash}%</div>
                                <div className="text-xs text-emerald-600 mt-1">Physical Cash Handling</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Operational Tasks */}
                <div className="bg-white p-6 rounded-xl border border-secondary-200 shadow-sm">
                    <h3 className="text-lg font-bold text-secondary-900 mb-4">Operational Tasks & Compliance</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="border border-amber-200 bg-amber-50 p-4 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-semibold text-amber-700">LUC Pending</span>
                                <AlertTriangle className="text-amber-600" size={20} />
                            </div>
                            <div className="text-3xl font-bold text-amber-900">{centreData.operations.lucPending}</div>
                            <div className="text-xs text-amber-600 mt-1">Loan Utilisation Checks</div>
                        </div>
                        <div className="border border-blue-200 bg-blue-50 p-4 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-semibold text-blue-700">Insurance Pending</span>
                                <UserCheck className="text-blue-600" size={20} />
                            </div>
                            <div className="text-3xl font-bold text-blue-900">{centreData.operations.insurancePending}</div>
                            <div className="text-xs text-blue-600 mt-1">Claims to Process</div>
                        </div>
                        <div className="border border-emerald-200 bg-emerald-50 p-4 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-semibold text-emerald-700">Leads Generated</span>
                                <Target className="text-emerald-600" size={20} />
                            </div>
                            <div className="text-3xl font-bold text-emerald-900">{centreData.operations.leadsGenerated}</div>
                            <div className="text-xs text-emerald-600 mt-1">New Prospects</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CentreDashboard;
