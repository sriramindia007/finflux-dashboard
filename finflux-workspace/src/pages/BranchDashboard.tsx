import { useState, useMemo, useEffect } from 'react';
import { FileText, CheckCircle2, Calendar, Banknote, AlertCircle, TrendingUp, Users, Briefcase, Building2, Users2, PieChart, ArrowDownRight, ArrowUpRight, MapPin, Smartphone, BadgePercent, ShieldAlert, Wallet, Download, Camera } from 'lucide-react';
import { saveFile, exportToPDF, exportToPPT } from '../lib/utils';
import { useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import KPICard from '../components/KPICard';
import { ALL_STATES_DATA, getGlobalStats, TOTAL_CENTRES, TOTAL_GROUPS, ApplicationPipeline } from '../data/geoDataComplete';
import { getBranchHistory, generateProductMix, MONTHS, Month, COMPANY_METRICS, STATES_DATA } from '../data/mfiData';
import { getBranchFilter, BranchFilter } from '../data/users';

// --- Data Types ---
interface EnrichedEntityData {
    name: string;
    region: string; // District/Parent
    state: string;
    type?: string;
    applications: { approved: number, received: number, approvedYtd: number, receivedYtd: number };
    disbursement: { count: number, countYtd: number, amount: number, amountYtd: number }; // amt in Cr
    collections: { due: number, paid: number, dueYtd: number, paidYtd: number, efficiency: number }; // amt in Cr
    overdue: number; // Cr
    glp: number; // Cr
    clients: { active: number, loans: number };
    meetings: { total: number, within: number, outside: number, attendance: number };
    par: { par30: number, par60: number, par90: number, par180: number };
    writeOff: number; // Cr
    coords: [number, number];
    digitalSplit: { digital: number, cash: number };
    // New Metrics
    counts: {
        branches: number;
        centres: number;
        groups: number;
        staff: number;
    };
    operationalTasks: {
        lucPending: number;
        insurancePending: number;
        leadsGenerated: number;
    };
    riskCategory: 'Low' | 'Medium' | 'High';
}

// Helper: Indian Number Formatting
const fmtCr = (v: number) => `₹${v.toFixed(2)} Cr`;
const fmtL = (v: number) => `₹${v.toFixed(2)} L`;
const fmtCount = (v: number) => {
    if (v >= 10000000) return `${(v / 10000000).toFixed(2)} Cr`;
    if (v >= 100000) return `${(v / 100000).toFixed(2)} L`;
    if (v >= 1000) return `${(v / 1000).toFixed(1)} k`;
    return v.toLocaleString('en-IN');
};

// Guard: clamp NaN/Infinity/undefined to 0 so .toFixed() never throws
const safeN = (v: number | undefined | null, fallback = 0): number => {
    if (v === null || v === undefined || !isFinite(v) || isNaN(v)) return fallback;
    return v;
};

// Generic Enrichment Function
const enrichEntityData = (
    base: {
        name: string, glp: number, clients: number, coord: [number, number], writeOff?: number,
        par30?: number, par60?: number, par90?: number, par180?: number,
        lucPending?: number, insurancePending?: number, leadsGenerated?: number,
        pipeline?: ApplicationPipeline
    },
    context: { state: string, region: string, type: 'Country' | 'State' | 'District' | 'Branch' | 'Centre' },
    parOverride?: number,
    countsOverride?: { branches?: number, centres?: number, groups?: number, staff?: number }
): EnrichedEntityData => {

    // Generate a consistent pseudo-random seed from the name string
    const seed = (base.name || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const basePAR = safeN(parOverride !== undefined ? parOverride : (base.par30 || (1.5 + (seed % 3))), 1.5);

    // Waterfall Estimation if explicit data missing
    const p30 = basePAR;
    const p60 = base.par60 !== undefined ? safeN(base.par60) : (p30 * 0.65);
    const p90 = base.par90 !== undefined ? safeN(base.par90) : (p30 * 0.45);
    const p180 = base.par180 !== undefined ? safeN(base.par180) : (p30 * 0.25);

    const efficiency = Math.max(50, 98.5 - (basePAR * 0.5));
    const activeClients = safeN(base.clients, 1);
    const glp = safeN(base.glp, 0);
    const loanCount = Math.floor(activeClients * 1.05);

    // USE ACTUAL COUNTS FROM DATA - NOT ESTIMATION!
    let centreCount = countsOverride?.centres;
    let groupCount = countsOverride?.groups;
    let staffCount = countsOverride?.staff;

    // Only estimate if no actual data provided
    if (!centreCount) {
        centreCount = Math.floor(activeClients / 25000); // Realistic: ~25k clients per centre
    }
    if (!groupCount) {
        groupCount = centreCount * 5; // 5 groups per centre
    }
    if (!staffCount) {
        staffCount = Math.floor(activeClients / 400); // 1 FO per 400 clients
    }

    return {
        name: base.name,
        region: context.region,
        state: context.state,
        applications: {
            received: base.pipeline?.sourcing?.total || Math.floor(activeClients * 0.12),
            approved: base.pipeline?.sanction?.total || Math.floor(activeClients * 0.12 * 0.85),
            receivedYtd: activeClients,
            approvedYtd: Math.floor(activeClients * 0.85)
        },
        disbursement: {
            count: Math.floor(loanCount * 0.08),
            countYtd: Math.floor(loanCount * 0.85),
            amount: parseFloat((glp * 0.12).toFixed(2)),
            amountYtd: parseFloat((glp * 1.1).toFixed(2))
        },
        collections: {
            due: parseFloat((glp * 0.08).toFixed(2)),
            paid: parseFloat((glp * 0.08 * (efficiency / 100)).toFixed(2)),
            dueYtd: parseFloat((glp * 0.8).toFixed(2)),
            paidYtd: parseFloat((glp * 0.8 * (efficiency / 100)).toFixed(2)),
            efficiency: parseFloat(efficiency.toFixed(1))
        },
        overdue: parseFloat((glp * (basePAR / 100)).toFixed(2)),
        glp,
        clients: { active: activeClients, loans: loanCount },
        meetings: {
            total: centreCount,
            within: Math.max(1, Math.floor(centreCount * (0.92 + ((seed % 15) - 7) * 0.01))),
            outside: Math.max(0, Math.floor(centreCount * (0.08 - ((seed % 15) - 7) * 0.01))),
            attendance: 90 + (seed % 8)
        },
        digitalSplit: { digital: 60 + (seed % 25), cash: 40 - (seed % 25) },
        par: {
            par30: parseFloat(p30.toFixed(2)),
            par60: parseFloat(p60.toFixed(2)),
            par90: parseFloat(p90.toFixed(2)),
            par180: parseFloat(p180.toFixed(2))
        },
        writeOff: safeN(base.writeOff, parseFloat((glp * 0.005).toFixed(4))),
        coords: base.coord,
        counts: {
            branches: countsOverride?.branches || 1,
            centres: centreCount,
            groups: groupCount,
            staff: staffCount
        },
        operationalTasks: {
            lucPending: base.lucPending || 0,
            insurancePending: base.insurancePending || 0,
            leadsGenerated: base.leadsGenerated || 0
        },
        riskCategory: p90 > 5.0 ? 'High' : (p90 > 2.0 ? 'Medium' : 'Low')
    };
};

const BranchDashboard = () => {
    const exportRef = useRef<HTMLDivElement>(null);

    // Read branch filter from sessionStorage (set only via Secure Login)
    const branchFilter: BranchFilter | null = getBranchFilter();
    const isRestricted = branchFilter !== null;

    // Selection State — pre-populate from branchFilter if present
    const [selectedStateName, setSelectedStateName] = useState(
        isRestricted ? branchFilter!.state : 'All'
    );
    const [selectedDistrictName, setSelectedDistrictName] = useState<string>(
        isRestricted ? branchFilter!.district : 'All'
    );
    const [selectedBranchName, setSelectedBranchName] = useState<string>(
        // If only one branch allowed, auto-select it; otherwise show "All" of allowed
        isRestricted && branchFilter!.branches.length === 1 ? branchFilter!.branches[0] : 'All'
    );

    // View State
    const [selectedMonth, setSelectedMonth] = useState<Month>('Dec');

    useEffect(() => {
        if (!isRestricted) {
            setSelectedDistrictName('All');
            setSelectedBranchName('All');
        }
    }, [selectedStateName, isRestricted]);

    useEffect(() => {
        if (!isRestricted) {
            setSelectedBranchName('All');
        }
    }, [selectedDistrictName, isRestricted]);


    // --- AGGREGATION LOGIC ---
    const consolidatedData = useMemo((): EnrichedEntityData => {

        // 1. NATIONAL VIEW
        if (selectedStateName === 'All') {
            const virtual = {
                name: "All India",
                coord: [20.5937, 78.9629] as [number, number],
                glp: COMPANY_METRICS.currentGLP,
                clients: COMPANY_METRICS.activeClients,
                writeOff: COMPANY_METRICS.ytdWriteoff,
                par30: COMPANY_METRICS.parOver30,
                lucPending: 1200,
                insurancePending: 850,
                leadsGenerated: 5000
            };
            return enrichEntityData(
                virtual,
                { state: "India", region: "National", type: 'Country' },
                COMPANY_METRICS.parOver30,
                {
                    branches: COMPANY_METRICS.totalBranches,
                    centres: TOTAL_CENTRES,  // USE ACTUAL COUNT FROM ROLLUP
                    groups: TOTAL_GROUPS,    // USE ACTUAL COUNT FROM ROLLUP
                    staff: 6500              // Realistic staff count
                }
            );
        }

        const stateGeo = ALL_STATES_DATA.find(s => s.name === selectedStateName);
        // Guard: if state not found at all, fall back to national view
        if (!stateGeo) {
            return enrichEntityData(
                {
                    name: "All India", coord: [20.5937, 78.9629] as [number, number], glp: COMPANY_METRICS.currentGLP,
                    clients: COMPANY_METRICS.activeClients, writeOff: COMPANY_METRICS.ytdWriteoff, par30: COMPANY_METRICS.parOver30
                },
                { state: "India", region: "National", type: 'Country' },
                COMPANY_METRICS.parOver30,
                { branches: COMPANY_METRICS.totalBranches, centres: TOTAL_CENTRES, groups: TOTAL_GROUPS, staff: 6500 }
            );
        }
        // Lookup State Metrics
        let stateKey = selectedStateName.toLowerCase().replace(/\s/g, '');
        if (stateKey === 'andhrapradesh') stateKey = 'andhra';
        if (stateKey === 'madhyapradesh') stateKey = 'madhyaPradesh';
        if (stateKey === 'tamilnadu') stateKey = 'tamilNadu';
        const stateMetrics = STATES_DATA[stateKey] || STATES_DATA['odisha'];

        // 2. STATE VIEW
        if (selectedDistrictName === 'All') {
            const virtual = {
                name: `Entire ${selectedStateName}`,
                coord: stateGeo.coord,
                glp: stateMetrics.glp,
                clients: stateMetrics.activeClients,
                writeOff: stateGeo.writeOff || 15,
                lucPending: stateGeo.lucPending || 150,
                insurancePending: stateGeo.insurancePending || 100,
                leadsGenerated: stateGeo.leadsGenerated || 600
            };
            // Use Simulated Branch Count from Map Rollup
            const estBranches = stateGeo.branchCount || 1100;
            // Scale centre/group/staff counts based on simulated branch count
            // (raw sample counts are too small relative to scaled GLP)
            const estCentres = estBranches * 5;         // ~5 centres per branch
            const estGroups = estBranches * 25;         // ~25 groups per branch
            const estStaff = stateGeo.staffCount && stateGeo.staffCount > 0
                ? Math.floor(stateGeo.staffCount * (estBranches / (stateGeo.branchCount || estBranches)))
                : estBranches * 3;                      // ~3 FOs per branch
            // Pass full stateGeo to get rolled up par60/90/180
            return enrichEntityData(
                { ...virtual, par30: stateGeo.par30, par60: stateGeo.par60, par90: stateGeo.par90, par180: stateGeo.par180 },
                { state: stateGeo.name, region: "State Level", type: 'State' },
                stateGeo.par30 ?? stateMetrics.par30,
                {
                    branches: estBranches,
                    centres: estCentres,
                    groups: estGroups,
                    staff: estStaff
                }
            );
        }

        const districtGeo = stateGeo.districts.find(d => d.name === selectedDistrictName);
        // Guard: if district not found in new state (stale selection during state switch), show state view
        if (!districtGeo) {
            const estBranches2 = stateGeo.branchCount || 1100;
            return enrichEntityData(
                {
                    name: `Entire ${selectedStateName}`, coord: stateGeo.coord, glp: stateMetrics.glp, clients: stateMetrics.activeClients,
                    writeOff: stateGeo.writeOff || 15, lucPending: stateGeo.lucPending || 150,
                    insurancePending: stateGeo.insurancePending || 100, leadsGenerated: stateGeo.leadsGenerated || 600,
                    par30: stateGeo.par30, par60: stateGeo.par60, par90: stateGeo.par90, par180: stateGeo.par180
                },
                { state: stateGeo.name, region: "State Level", type: 'State' },
                stateGeo.par30 ?? stateMetrics.par30,
                { branches: estBranches2, centres: estBranches2 * 5, groups: estBranches2 * 25, staff: estBranches2 * 3 }
            );
        }

        // 3. DISTRICT VIEW
        if (selectedBranchName === 'All') {
            // Safe GLP-per-client ratio (guard against zero)
            const safeStateClients = stateMetrics.activeClients || 1;
            const avgClientGLP = stateMetrics.glp / safeStateClients;
            const estClients = avgClientGLP > 0
                ? Math.floor(districtGeo.glp / avgClientGLP)
                : Math.floor(districtGeo.clients || 0);
            const virtual = {
                name: `All ${districtGeo.name} Br.`,
                coord: districtGeo.coord,
                glp: districtGeo.glp,
                clients: estClients,
                writeOff: districtGeo.writeOff,
                lucPending: districtGeo.lucPending || 50,
                insurancePending: districtGeo.insurancePending || 30,
                leadsGenerated: districtGeo.leadsGenerated || 200
            };
            // Use Simulated Branch Count
            const dBranches = districtGeo.branchCount || (districtGeo.branches.length * 34);
            // Scale centre/group/staff counts based on simulated branch count
            const dCentres = dBranches * 5;         // ~5 centres per branch
            const dGroups = dBranches * 25;         // ~25 groups per branch
            const dStaff = districtGeo.staffCount && districtGeo.staffCount > 0
                ? Math.floor(districtGeo.staffCount * (dBranches / (districtGeo.branchCount || dBranches)))
                : dBranches * 3;                      // ~3 FOs per branch
            return enrichEntityData(
                { ...virtual, par30: districtGeo.par30, par60: districtGeo.par60, par90: districtGeo.par90, par180: districtGeo.par180 },
                { state: selectedStateName, region: districtGeo.name, type: 'District' },
                districtGeo.par30 ?? stateMetrics.par30,
                {
                    branches: dBranches,
                    centres: dCentres,
                    groups: dGroups,
                    staff: dStaff
                }
            );
        }

        const branchGeo = districtGeo.branches.find(b => b.name === selectedBranchName);
        // Guard: if branch not found (stale selection during state switch), show district view
        if (!branchGeo) {
            const safeDist = districtGeo.branchCount || (districtGeo.branches.length * 34);
            return enrichEntityData(
                {
                    name: `All ${districtGeo.name} Br.`, coord: districtGeo.coord, glp: districtGeo.glp,
                    clients: Math.floor(districtGeo.glp / ((stateMetrics.glp / (stateMetrics.activeClients || 1)) || 1)),
                    writeOff: districtGeo.writeOff, lucPending: districtGeo.lucPending || 50,
                    insurancePending: districtGeo.insurancePending || 30, leadsGenerated: districtGeo.leadsGenerated || 200,
                    par30: districtGeo.par30, par60: districtGeo.par60, par90: districtGeo.par90, par180: districtGeo.par180
                },
                { state: selectedStateName, region: districtGeo.name, type: 'District' },
                districtGeo.par30 ?? stateMetrics.par30,
                { branches: safeDist, centres: safeDist * 5, groups: safeDist * 25, staff: safeDist * 3 }
            );
        }

        // 4. BRANCH VIEW
        // Scale branch GLP proportionally so it's consistent with district-level scaled GLP.
        // Raw branch GLP (branchGeo.glp) is in Crores from sample data (e.g. 0.45 Cr),
        // while district GLP is fully scaled (e.g. 862 Cr). We compute the branch's
        // share of raw district sum, then apply it to the scaled district GLP.
        const rawDistrictGlp = districtGeo.branches.reduce((sum, b) => sum + b.glp, 0);
        const rawDistrictClients = districtGeo.branches.reduce((sum, b) => sum + b.clients, 0);
        const branchGlpScaled = rawDistrictGlp > 0
            ? branchGeo.glp * (districtGeo.glp / rawDistrictGlp)
            : branchGeo.glp;
        const branchClientsScaled = rawDistrictClients > 0
            ? Math.floor(branchGeo.clients * ((districtGeo.clients || 0) / rawDistrictClients))
            : branchGeo.clients;
        // Scale branch counts: each sample branch → ~34 real branches (per networkConfig scaling)
        const branchScaleFactor = districtGeo.branchCount
            ? Math.floor(districtGeo.branchCount / districtGeo.branches.length)
            : 34;
        const bCentres = branchGeo.centres.length * branchScaleFactor;
        const bGroups = bCentres * 5;   // 5 groups per centre
        const bStaff = Math.max(4, Math.floor(bCentres * 1.2)); // ~1.2 FOs per centre
        const scaledBranch = { ...branchGeo, glp: branchGlpScaled, clients: branchClientsScaled };
        return enrichEntityData(scaledBranch, { state: stateGeo.name, region: districtGeo.name, type: 'Branch' }, branchGeo.par30,
            { branches: branchScaleFactor, centres: bCentres, groups: bGroups, staff: bStaff });

    }, [selectedStateName, selectedDistrictName, selectedBranchName]);


    // Time Series
    const productMixData = useMemo(() => {
        const history = getBranchHistory(consolidatedData.name, consolidatedData.glp, consolidatedData.par.par30);
        const monthMetric = history.find(m => m.month === selectedMonth) || history[history.length - 1];
        const mix = generateProductMix(monthMetric.glp, monthMetric.par30);
        return { metric: monthMetric, mix, history };
    }, [consolidatedData, selectedMonth]);

    // ── Export Logic ──
    const getFilename = (ext: string) => `FINFLUX_${consolidatedData.type}_${consolidatedData.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.${ext}`;

    const handleExportExcel = async () => {
        const XLSX = await import('xlsx');

        const summaryRows = [
            [`FINFLUX ${consolidatedData.type} Operations Report`, consolidatedData.name],
            ['State', consolidatedData.state],
            ['Region', consolidatedData.region],
            ['Generated', new Date().toLocaleString('en-IN')],
            [],
            ['Metric', 'Value'],
            ['Portfolio (GLP) Cr', consolidatedData.glp],
            ['Active Clients', consolidatedData.clients.active],
            ['PAR 30+ (%)', consolidatedData.par.par30],
            ['GNPA / PAR 90+ (%)', consolidatedData.par.par90],
            ['Collection Efficiency (%)', consolidatedData.collections.efficiency],
            ['Outstanding Collections (Cr)', consolidatedData.overdue],
            ['Disbursement (Cr)', consolidatedData.disbursement.amount],
            ['Disbursement YTD (Cr)', consolidatedData.disbursement.amountYtd]
        ];

        const historyRows = [
            ['Monthly Historical Data', 'FY 2025-26'],
            [],
            ['Month', 'GLP (Cr)', 'Disbursement (Cr)', 'PAR 30+ (%)', 'Collection (Cr)'],
            ...productMixData.history.map(d => [d.month, d.glp, d.disbursement, d.par30, d.collection])
        ];

        const wb = XLSX.utils.book_new();
        const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
        const wsHistory = XLSX.utils.aoa_to_sheet(historyRows);
        XLSX.utils.book_append_sheet(wb, wsSummary, "Summary Overview");
        XLSX.utils.book_append_sheet(wb, wsHistory, "Monthly Trends");
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


    // Dropdowns
    const availableDistricts = useMemo(() => {
        if (selectedStateName === 'All') return [];
        const state = ALL_STATES_DATA.find(s => s.name === selectedStateName);
        return state ? state.districts : [];
    }, [selectedStateName]);

    const availableBranches = useMemo(() => {
        if (selectedDistrictName === 'All' || selectedStateName === 'All') return [];
        const state = ALL_STATES_DATA.find(s => s.name === selectedStateName);
        const district = state?.districts.find(d => d.name === selectedDistrictName);
        const allBranches = district ? district.branches : [];
        // If a branch filter is active (Secure Login), only show allowed branches
        if (isRestricted && branchFilter) {
            return allBranches.filter(b => branchFilter.branches.includes(b.name));
        }
        return allBranches;
    }, [selectedStateName, selectedDistrictName, isRestricted, branchFilter]);

    const availableCentres = useMemo(() => {
        if (selectedBranchName === 'All' || selectedDistrictName === 'All') return [];
        const state = ALL_STATES_DATA.find(s => s.name === selectedStateName);
        const district = state?.districts.find(d => d.name === selectedDistrictName);
        const branch = district?.branches.find(b => b.name === selectedBranchName);
        return branch ? branch.centres : [];
    }, [selectedBranchName, selectedDistrictName, selectedStateName]);


    return (
        <div className="flex flex-col gap-6 h-[calc(100vh-100px)]">

            {/* Header & Controls */}
            <div className="bg-white p-4 rounded-xl border border-secondary-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-4 w-full md:w-auto overflow-x-auto">
                    {/* State */}
                    <div className="relative group">
                        <label className="text-[10px] text-secondary-500 font-bold uppercase tracking-wider mb-1 block">State</label>
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
                        <label className="text-[10px] text-secondary-500 font-bold uppercase tracking-wider mb-1 block">District</label>
                        <select
                            className="bg-secondary-50 border border-secondary-200 text-secondary-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-32 p-2.5 outline-none font-semibold disabled:opacity-70 disabled:cursor-not-allowed"
                            value={selectedDistrictName}
                            onChange={(e) => setSelectedDistrictName(e.target.value)}
                            disabled={selectedStateName === 'All' || isRestricted}
                        >
                            <option value="All">All Dists</option>
                            {availableDistricts.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
                        </select>
                    </div>

                    {/* Branch */}
                    <div className={`relative group ${(selectedStateName === 'All' || selectedDistrictName === 'All') ? 'opacity-50 pointer-events-none' : ''}`}>
                        <label className="text-[10px] text-secondary-500 font-bold uppercase tracking-wider mb-1 block">Branch</label>
                        <select
                            className="bg-yellow-50 border border-yellow-200 text-yellow-900 text-sm rounded-lg focus:ring-yellow-500 focus:border-yellow-500 block w-40 p-2.5 outline-none font-bold"
                            value={selectedBranchName}
                            onChange={(e) => setSelectedBranchName(e.target.value)}
                            disabled={selectedDistrictName === 'All'}
                        >
                            {/* BM with single branch: no "All" option — locked to their branch */}
                            {!(isRestricted && branchFilter && branchFilter.branches.length === 1) && (
                                <option value="All">All Br.</option>
                            )}
                            {availableBranches.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                        </select>
                    </div>

                    {/* Restriction badge */}
                    {isRestricted && (
                        <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg px-3 py-2 text-xs font-bold shrink-0">
                            <span>🔒</span>
                            {branchFilter!.branches.length === 1
                                ? 'Branch View'
                                : `${branchFilter!.branches.length} Branches`
                            }
                        </div>
                    )}

                </div>

                <div className="flex items-center gap-6 border-l border-secondary-200 pl-6">
                    {(selectedBranchName !== 'All') && (
                        <div className={`px-4 py-2 rounded-lg border flex items-center gap-2 ${consolidatedData.riskCategory === 'High' ? 'bg-rose-50 border-rose-200 text-rose-700' :
                            consolidatedData.riskCategory === 'Medium' ? 'bg-orange-50 border-orange-200 text-orange-700' :
                                'bg-emerald-50 border-emerald-200 text-emerald-700'
                            }`}>
                            <div className={`w-2 h-2 rounded-full ${consolidatedData.riskCategory === 'High' ? 'bg-rose-600' :
                                consolidatedData.riskCategory === 'Medium' ? 'bg-orange-600' :
                                    'bg-emerald-600'
                                }`}></div>
                            <span className="font-bold text-sm uppercase tracking-wider">{consolidatedData.riskCategory} Risk</span>
                        </div>
                    )}
                    <div className='text-right'>
                        <p className="text-secondary-500 flex items-center justify-end gap-1 text-xs"><MapPin size={12} /> {consolidatedData.region}</p>
                        <h2 className="text-xl font-bold text-secondary-900 truncate max-w-[200px]">{consolidatedData.name}</h2>
                    </div>
                    <div className="text-right flex items-center gap-4">
                        <div>
                            <div className="text-xs text-secondary-500">Portfolio (GLP)</div>
                            <div className="text-2xl font-bold text-primary-600">{fmtCr(consolidatedData.glp)}</div>
                        </div>

                        {/* EXPORT DROPDOWN */}
                        <div className="relative group z-50 ml-4 border-l border-secondary-200 pl-4">
                            <button className="bg-white border border-secondary-200 rounded-lg px-3 py-2 text-sm text-secondary-700 hover:bg-secondary-50 flex items-center gap-1.5 transition-colors shadow-sm">
                                <Download size={14} /> Export
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

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto space-y-6 pr-2">
                <div ref={exportRef} className="space-y-6 pb-4">

                    {/* SECTION 1: EXECUTIVE OVERVIEW */}
                    <div className="space-y-3">
                        <h3 className="text-lg font-semibold text-secondary-800 flex items-center gap-2">
                            <div className="h-1 w-1 rounded-full bg-primary-500"></div>
                            Executive Overview
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <KPICard
                                title="Outstanding GLP"
                                value={fmtCr(consolidatedData.glp)}
                                subValue={selectedBranchName === 'All' ? "Total Portfolio" : "Branch Portfolio"}
                                trend="up"
                                trendValue="0.9%"
                                icon={Wallet}
                                className="border-l-4 border-l-blue-500"
                            />
                            <KPICard
                                title="Collection Efficiency"
                                value={`${consolidatedData.collections.efficiency}%`}
                                subValue={`Collected: ${fmtCr(consolidatedData.collections.paid)}`}
                                trend={consolidatedData.collections.efficiency >= 95.5 ? "up" : "down"}
                                trendValue={consolidatedData.collections.efficiency >= 95.5 ? "Excellent" : "Monitor"}
                                icon={BadgePercent}
                                className="border-l-4 border-l-emerald-500"
                            />
                            <KPICard
                                title="Digital Adoption"
                                value={`${consolidatedData.digitalSplit.digital}%`}
                                subValue={`Digital: ${fmtCr(consolidatedData.glp * (consolidatedData.digitalSplit.digital / 100))}`}
                                trend="up"
                                trendValue={`${(consolidatedData.digitalSplit.digital - 45).toFixed(1)}%`}
                                icon={TrendingUp}
                                className="border-l-4 border-l-purple-500"
                            />
                            <KPICard
                                title="NPA (90+ Days)"
                                value={`${consolidatedData.par.par90}%`}
                                subValue={`Amount: ${fmtCr(consolidatedData.glp * (consolidatedData.par.par90 / 100))}`}
                                trend="down"
                                trendValue={consolidatedData.par.par90 < 1.0 ? "Optimal" : "Monitor"}
                                icon={ShieldAlert}
                                className="border-l-4 border-l-rose-500"
                            />
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-secondary-200"></div>

                    {/* SECTION 2: BRANCH NETWORK OVERVIEW */}
                    <div className="space-y-3">
                        <h3 className="text-lg font-semibold text-secondary-800 flex items-center gap-2">
                            <div className="h-1 w-1 rounded-full bg-primary-500"></div>
                            Branch Network Overview
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <KPICard title="Total Centres" value={fmtCount(consolidatedData.counts.centres)}
                                subValue={selectedBranchName === 'All' ? "State-wide" : "Branch-wide"} icon={Building2}
                                className="border-l-4 border-l-blue-500" />
                            <KPICard title="Total Groups" value={fmtCount(consolidatedData.counts.groups)}
                                subValue="JLG Groups" icon={Users2}
                                className="border-l-4 border-l-indigo-500" />
                            <KPICard title="Field Staff" value={fmtCount(consolidatedData.counts.staff)}
                                subValue={selectedBranchName === 'All' ? "FOs + BMs" : "Field Officers"} icon={Briefcase}
                                className="border-l-4 border-l-purple-500" />
                            <KPICard title="Active Clients" value={fmtCount(consolidatedData.clients.active)}
                                subValue={`Loans: ${fmtCount(consolidatedData.clients.loans)}`} icon={Users}
                                className="border-l-4 border-l-emerald-500" />
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-secondary-200"></div>

                    {/* SECTION 3: OPERATIONAL PERFORMANCE */}
                    <div className="space-y-3">
                        <h3 className="text-lg font-semibold text-secondary-800 flex items-center gap-2">
                            <div className="h-1 w-1 rounded-full bg-primary-500"></div>
                            Operational Performance
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <KPICard title="Applications" value={fmtCount(consolidatedData.applications.received)} subValue={`Appr: ${fmtCount(consolidatedData.applications.approved)}`} icon={FileText} />
                            <KPICard title="Disbursed Loans" value={fmtCount(consolidatedData.disbursement.count)} subValue={`Value: ${fmtCr(consolidatedData.disbursement.amount)}`} icon={CheckCircle2} />
                            <KPICard title="Attendance" value={`${consolidatedData.meetings.attendance}%`} subValue={`${fmtCount(consolidatedData.meetings.total)} Mtgs`} icon={Calendar}
                                className={consolidatedData.meetings.attendance < 90 ? "border-l-4 border-l-amber-500" : "border-l-4 border-l-emerald-500"} />
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-secondary-200"></div>

                    {/* SECTION 4: FINANCIAL METRICS */}
                    <div className="space-y-3">
                        <h3 className="text-lg font-semibold text-secondary-800 flex items-center gap-2">
                            <div className="h-1 w-1 rounded-full bg-primary-500"></div>
                            Financial Metrics
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <KPICard title="Collection Eff." value={`${consolidatedData.collections.efficiency}%`}
                                subValue={`Due: ${fmtCr(consolidatedData.collections.due)}`} icon={TrendingUp}
                                className={consolidatedData.collections.efficiency >= 95.5 ? "border-l-4 border-l-emerald-500" : "border-l-4 border-l-amber-500"} />
                            <KPICard title="Collections Paid" value={fmtCr(consolidatedData.collections.paid)} trend="neutral" trendValue="MTD" icon={Banknote} />
                            <KPICard title="Overdue" value={fmtCr(consolidatedData.overdue)} trend="down" trendValue="Critical" icon={AlertCircle} className="border-l-4 border-l-rose-500" />
                            <KPICard title="Write-offs (YTD)" value={fmtCr(consolidatedData.writeOff)} icon={Banknote} />
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-secondary-200"></div>

                    {/* Charts and Details */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Geo-Fencing Stats */}
                        <div className="bg-white p-6 rounded-xl border border-secondary-200 shadow-sm">
                            <h4 className="font-semibold text-secondary-800 mb-4 flex justify-between">
                                <span>Centre Meeting Compliance</span>
                                <span className="text-sm font-normal text-secondary-500">Geo-Fence</span>
                            </h4>
                            <div className="flex items-center gap-6">
                                <div className="relative w-32 h-32 flex items-center justify-center rounded-full border-8 border-emerald-100">
                                    <span className="text-2xl font-bold text-emerald-600">{consolidatedData.meetings.total > 0 ? Math.round((consolidatedData.meetings.within / consolidatedData.meetings.total) * 100) : 0}%</span>
                                </div>
                                <div className="space-y-3 flex-1">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-secondary-600">Within Fence</span>
                                        <span className="font-bold text-emerald-600">{consolidatedData.meetings.within.toLocaleString()}</span>
                                    </div>
                                    <div className="w-full bg-secondary-100 h-2 rounded-full overflow-hidden">
                                        <div className="h-full bg-emerald-500" style={{ width: `${consolidatedData.meetings.total > 0 ? (consolidatedData.meetings.within / consolidatedData.meetings.total) * 100 : 0}%` }}></div>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-secondary-600">Outside Fence</span>
                                        <span className="font-bold text-rose-600">{consolidatedData.meetings.outside.toLocaleString()}</span>
                                    </div>
                                    <div className="w-full bg-secondary-100 h-2 rounded-full overflow-hidden">
                                        <div className="h-full bg-rose-500" style={{ width: `${consolidatedData.meetings.total > 0 ? (consolidatedData.meetings.outside / consolidatedData.meetings.total) * 100 : 0}%` }}></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* PAR & Digital Stats */}
                        <div className="bg-white p-6 rounded-xl border border-secondary-200 shadow-sm space-y-6">
                            <div>
                                <h4 className="font-semibold text-secondary-800 mb-3">Portfolio at Risk (PAR)</h4>
                                <div className="grid grid-cols-4 gap-2">
                                    <div className="p-2 bg-amber-50 rounded-lg border border-amber-100 text-center">
                                        <div className="text-[10px] text-amber-600 uppercase font-bold tracking-wider">PAR 30+</div>
                                        <div className="text-lg font-bold text-amber-700">{consolidatedData.par.par30}%</div>
                                    </div>
                                    <div className="p-2 bg-orange-50 rounded-lg border border-orange-100 text-center">
                                        <div className="text-[10px] text-orange-600 uppercase font-bold tracking-wider">PAR 60+</div>
                                        <div className="text-lg font-bold text-orange-700">{consolidatedData.par.par60}%</div>
                                    </div>
                                    <div className="p-2 bg-rose-50 rounded-lg border border-rose-100 text-center">
                                        <div className="text-[10px] text-rose-600 uppercase font-bold tracking-wider">PAR 90+</div>
                                        <div className="text-lg font-bold text-rose-700">{consolidatedData.par.par90}%</div>
                                    </div>
                                    <div className="p-2 bg-red-50 rounded-lg border border-red-100 text-center">
                                        <div className="text-[10px] text-red-600 uppercase font-bold tracking-wider">PAR 180+</div>
                                        <div className="text-lg font-bold text-red-700">{consolidatedData.par.par180}%</div>
                                    </div>
                                </div>
                            </div>

                            {/* Operational Tasks & Compliance */}
                            <div className="pt-4 border-t border-secondary-100">
                                <h4 className="font-semibold text-secondary-800 mb-3">Operational Tasks</h4>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-sm text-secondary-600">
                                            <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                                            LUC Pending
                                        </div>
                                        <div className="font-bold text-secondary-900">{consolidatedData.operationalTasks.lucPending}</div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-sm text-secondary-600">
                                            <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                                            Insurance Claims Pending
                                        </div>
                                        <div className="font-bold text-secondary-900">{consolidatedData.operationalTasks.insurancePending}</div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-sm text-secondary-600">
                                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                            New Leads Generated
                                        </div>
                                        <div className="font-bold text-secondary-900">{consolidatedData.operationalTasks.leadsGenerated}</div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h4 className="font-semibold text-secondary-800 mb-3">Repayment Mode</h4>
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2">
                                        <Smartphone className="text-primary-500" size={20} />
                                        <div>
                                            <div className="text-xs text-secondary-500">Digital</div>
                                            <div className="font-bold">{consolidatedData.digitalSplit.digital}%</div>
                                        </div>
                                    </div>
                                    <div className="flex-1 h-3 bg-secondary-100 rounded-full overflow-hidden flex">
                                        <div className="bg-primary-500 h-full" style={{ width: `${consolidatedData.digitalSplit.digital}%` }}></div>
                                        <div className="bg-emerald-500 h-full" style={{ width: `${consolidatedData.digitalSplit.cash}%` }}></div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Banknote className="text-emerald-500" size={20} />
                                        <div>
                                            <div className="text-xs text-secondary-500">Cash</div>
                                            <div className="font-bold">{consolidatedData.digitalSplit.cash}%</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Products Table (Unchanged) */}
                    <div className="bg-white p-6 rounded-xl border border-secondary-200 shadow-sm">
                        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                            <div>
                                <h4 className="text-lg font-bold text-secondary-900">Product Portfolio & Risk Composition</h4>
                                <p className="text-sm text-secondary-500">Breakdown of GLP and PAR% by Product Type ({selectedMonth})</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <label className="text-sm font-semibold text-secondary-600">Period:</label>
                                <select
                                    className="bg-white border border-secondary-300 text-secondary-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block p-2 outline-none"
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(e.target.value as Month)}
                                >
                                    {MONTHS.map(m => <option key={m} value={m}>{m} 2025</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="col-span-1 grid grid-cols-2 lg:grid-cols-1 gap-4">
                                <div className="bg-secondary-50 p-4 rounded-lg text-center border border-secondary-100">
                                    <div className="text-secondary-500 text-xs font-bold uppercase mb-1">Total GLP ({selectedMonth})</div>
                                    <div className="text-2xl font-bold text-primary-700">{fmtCr(productMixData.metric.glp)}</div>
                                </div>
                                <div className="bg-secondary-50 p-4 rounded-lg text-center border border-secondary-100">
                                    <div className="text-secondary-500 text-xs font-bold uppercase mb-1">Blended PAR%</div>
                                    <div className={`text-2xl font-bold ${productMixData.metric.par30 > 2.5 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                        {productMixData.metric.par30}%
                                    </div>
                                </div>
                            </div>

                            <div className="col-span-1 lg:col-span-2 overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-secondary-50 text-secondary-500 border-b border-secondary-200">
                                        <tr>
                                            <th className="py-3 px-4 font-semibold">Product Name</th>
                                            <th className="py-3 px-4 font-semibold text-right">GLP Share</th>
                                            <th className="py-3 px-4 font-semibold text-right">Amount (Cr)</th>
                                            <th className="py-3 px-4 font-semibold text-right">PAR (%)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-secondary-100">
                                        {productMixData.mix.sort((a, b) => b.glp - a.glp).map((prod, idx) => {
                                            const share = productMixData.metric.glp > 0 ? ((prod.glp / productMixData.metric.glp) * 100).toFixed(1) : "0.0";
                                            return (
                                                <tr key={idx} className="hover:bg-secondary-50 transition-colors">
                                                    <td className="py-3 px-4 font-medium text-secondary-900">{prod.name}</td>
                                                    <td className="py-3 px-4 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <span className="text-xs text-secondary-500">{share}%</span>
                                                            <div className="w-16 bg-secondary-100 h-1.5 rounded-full overflow-hidden">
                                                                <div className="bg-primary-500 h-full" style={{ width: `${share}%` }}></div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4 text-secondary-900 font-bold text-right">₹{prod.glp.toFixed(2)}</td>
                                                    <td className="py-3 px-4 text-right">
                                                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${prod.par30 < 2 ? 'bg-emerald-100 text-emerald-700' :
                                                            prod.par30 < 4 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                                                            }`}>
                                                            {prod.par30}%
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default BranchDashboard;
