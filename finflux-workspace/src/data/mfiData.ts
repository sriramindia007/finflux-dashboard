/**
 * FINFLUX Analytics - Centralized Data Engine
 * FY 2025-26 data: April 2025 → February 2026 (11 months YTD)
 * CURRENT_MONTH = Feb (Feb 2026, latest complete month)
 * Single Source of Truth for all Dashboards.
 */

import { ALL_STATES_DATA, getGeoStats, TOTAL_PRODUCT_STATS, TOTAL_DIGITAL_COLLECTION, TOTAL_STAFF, TOTAL_GLP, TOTAL_CLIENTS, TOTAL_WRITEOFF, TOTAL_PAR30_WEIGHTED, TOTAL_PAR90_WEIGHTED, TOTAL_PENDING_APPROVALS, TOTAL_COLLECTION_LAG, TOTAL_BRANCHES_COUNT } from './geoDataComplete';

export type Month = 'Jan' | 'Feb' | 'Mar' | 'Apr' | 'May' | 'Jun' | 'Jul' | 'Aug' | 'Sep' | 'Oct' | 'Nov' | 'Dec';
// FY 2025-26: April 2025 → February 2026  (11 months YTD, current = Feb)
export const MONTHS: Month[] = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'];

export interface MonthlyMetric {
    month: Month;
    glp: number;            // Portfolio (Cr)
    disbursement: number;   // Cr
    collection: number;     // Cr
    collectionDue: number;  // Cr
    par30: number;          // %
    par60: number;          // %
    par90: number;          // %
    par180: number;         // %
    activeClients: number;  // Count
}

// ------------------------------------------------------------------
// PRODUCT TAXONOMY & MIX DEFINITIONS
// ------------------------------------------------------------------

export type ProductType =
    | 'Group Loans (JLG)'
    | 'MSME Business'
    | 'JIT (Emergency)'
    | 'Samarth (PwD)'
    | 'Swasth (WASH)'
    | 'Housing'
    | 'Green/Climate'
    | 'Consumer Durable'
    | 'Solar/EV';

export const PRODUCTS_CONFIG: Record<ProductType, { label: string, share: number, risk: number }> = {
    'Group Loans (JLG)': { label: 'Group Loans (JLG)', share: 0.55, risk: 1.0 },       // 55% share, Base risk
    'MSME Business': { label: 'MSME Business', share: 0.15, risk: 1.5 },               // 15% share, Higher risk
    'Housing': { label: 'Housing Loan', share: 0.12, risk: 0.6 },                      // 12% share, Low risk
    'JIT (Emergency)': { label: 'JIT (Just In Time)', share: 0.05, risk: 0.8 },
    'Samarth (PwD)': { label: 'Samarth (PwD)', share: 0.03, risk: 0.7 },
    'Swasth (WASH)': { label: 'Swasth (Water/Sanitation)', share: 0.03, risk: 0.5 },
    'Green/Climate': { label: 'Green Box/Climate', share: 0.03, risk: 0.9 },
    'Consumer Durable': { label: 'Consumer Durable', share: 0.02, risk: 1.2 },
    'Solar/EV': { label: 'Rooftop Solar & EV', share: 0.02, risk: 1.1 }
};

export interface ProductMetric {
    name: ProductType;
    glp: number;      // Cr
    clients: number;
    par30: number;    // %
}

// Tiny deterministic PRNG (mulberry32) — same seed → same output every render.
// This prevents numbers from flickering when components re-render.
const seeded = (seed: number) => {
    let s = seed >>> 0;
    s = Math.imul(s ^ (s >>> 15), s | 1);
    s ^= s + Math.imul(s ^ (s >>> 7), s | 61);
    return ((s ^ (s >>> 14)) >>> 0) / 4294967296;
};

// Generate a breakdown for a given Total GLP and Base PAR
// Uses a deterministic seed derived from totalGLP so output is stable across renders
export const generateProductMix = (totalGLP: number, basePAR: number): ProductMetric[] => {
    const seed = Math.round(totalGLP * 100); // Deterministic seed from GLP
    return Object.keys(PRODUCTS_CONFIG).map((key, i) => {
        const type = key as ProductType;
        const config = PRODUCTS_CONFIG[type];

        // Deterministic variance in share (+/- 10% relative)
        const variance = 1 + ((seeded(seed + i) * 0.2) - 0.1);
        const productGLP = totalGLP * config.share * variance;

        // PAR varies by product risk profile (deterministic)
        const productPAR = basePAR * config.risk * (0.9 + seeded(seed + i + 100) * 0.2);

        // Assume varying loan sizes for client count derivation
        const avgLoanSize = type === 'Housing' ? 0.003 : type === 'MSME Business' ? 0.001 : 0.00035; // in Cr

        return {
            name: type,
            glp: parseFloat(productGLP.toFixed(2)),
            clients: Math.floor(productGLP / avgLoanSize),
            par30: parseFloat(productPAR.toFixed(2))
        };
    });
};

// ------------------------------------------------------------------
// 1. DATA GENERATION UTILITIES (Deterministic Simulation)
// ------------------------------------------------------------------

// Base growth factors to simulate realistic MFI trends
const SEASONALITY = {
    Jan: 0.9, Feb: 0.95, Mar: 1.1,  // Q4 Push
    Apr: 0.85, May: 0.9, Jun: 0.95, // New FY Slump
    Jul: 1.0, Aug: 1.05, Sep: 1.1,  // Post-Monsoon pickup
    Oct: 1.15, Nov: 1.2, Dec: 1.25  // Festive High
};

// Generate a year's history based on a target End-of-Year value and a growth curve
const generateHistory = (targetGLP: number, basePAR: number, targetClients?: number): MonthlyMetric[] => {
    const history: MonthlyMetric[] = [];
    let currentGLP = targetGLP * 0.75; // Start year at 75% of target

    MONTHS.forEach((month, idx) => {
        const growthFactor = SEASONALITY[month];

        // GLP grows steadily with seasonal bumps
        currentGLP = currentGLP * (1 + (0.02 * growthFactor));

        // Disbursement is derived from GLP growth + Churn replacement
        const disb = (currentGLP * 0.15 * growthFactor);

        // Collection is ~98% of what's due, which is ~12% of GLP (deterministic per month+state)
        const due = currentGLP * 0.12;
        const coll = due * (0.96 + (seeded(Math.round(targetGLP) + idx) * 0.03)); // 96-99%

        // PAR fluctuates (deterministic: same state+month → same PAR)
        const par30 = basePAR + (Math.sin(idx) * 0.2) + (seeded(Math.round(targetGLP * 10) + idx) * 0.1);
        const par60 = par30 * 0.75;
        const par90 = par30 * 0.5;
        const par180 = par30 * 0.25;

        // Use target clients if available for Dec, else estimate
        const activeClients = targetClients && month === 'Dec'
            ? targetClients
            : Math.floor(currentGLP * 250);

        history.push({
            month,
            glp: parseFloat(currentGLP.toFixed(2)),
            disbursement: parseFloat(disb.toFixed(2)),
            collection: parseFloat(coll.toFixed(2)),
            collectionDue: parseFloat(due.toFixed(2)),
            par30: parseFloat(par30.toFixed(2)),
            par60: parseFloat(par60.toFixed(2)),
            par90: parseFloat(par90.toFixed(2)),
            par180: parseFloat(par180.toFixed(2)),
            activeClients
        });
    });

    // FORCE SNAP: Overwrite December (Current Month) to match the actual Ground Truth from Geodata
    const lastIdx = history.length - 1;
    history[lastIdx].glp = targetGLP;
    history[lastIdx].par30 = basePAR;
    // Assuming basePAR passed here is par30. We need par60/90/180 targets.
    // Since generateHistory signature only takes basePAR (which is par30), we will estimate the others for now
    // or rely on the randomness. Ideally we should pass them.
    // However, for Simplicity, let's keep the ratios consistent for the snap:
    if (history[lastIdx].par60 === undefined) history[lastIdx].par60 = parseFloat((basePAR * 0.7).toFixed(2)); // Fallback
    // If we want exact snap, we need to pass the full target object.

    if (targetClients) history[lastIdx].activeClients = targetClients;

    return history;
};

// ------------------------------------------------------------------
// 2. CENTRAL DATA STORE
// ------------------------------------------------------------------

// Build State Targets from the Hierarchical Rollup (One Source of Truth)
const STATE_TARGETS: Record<string, { glp: number, par30: number, par60: number, par90: number, par180: number, clients?: number }> = {};
ALL_STATES_DATA.forEach(s => {
    STATE_TARGETS[s.name] = {
        glp: s.glp,
        par30: s.par30 || 2.5,
        par60: s.par60 || (s.par30 || 2.5) * 0.7,
        par90: s.par90 || (s.par30 || 2.5) * 0.5,
        par180: s.par180 || (s.par30 || 2.5) * 0.25,
        clients: s.clients
    };
});

// Generate State Histories
export const STATE_HISTORY: Record<string, MonthlyMetric[]> = {};
Object.entries(STATE_TARGETS).forEach(([state, target]) => {
    // We need to update generateHistory to accept full target object if we want exact snap,
    // but for now let's just patch the last entry after generation.
    const hist = generateHistory(target.glp, target.par30, target.clients);
    // Exact Snap
    const last = hist[hist.length - 1];
    last.par30 = target.par30;
    last.par60 = target.par60;
    last.par90 = target.par90;
    last.par180 = target.par180;

    STATE_HISTORY[state] = hist;
});

// Generate Company History (Aggregation of States)
export const COMPANY_HISTORY: MonthlyMetric[] = MONTHS.map((month, idx) => {
    const metric: MonthlyMetric = {
        month,
        glp: 0, disbursement: 0, collection: 0, collectionDue: 0, par30: 0, par60: 0, par90: 0, par180: 0, activeClients: 0
    };

    let totalParWeighted = 0;

    Object.values(STATE_HISTORY).forEach(stateHistory => {
        const stateMonth = stateHistory[idx];
        metric.glp += stateMonth.glp;
        metric.disbursement += stateMonth.disbursement;
        metric.collection += stateMonth.collection;
        metric.collectionDue += stateMonth.collectionDue;
        metric.activeClients += stateMonth.activeClients;
        totalParWeighted += (stateMonth.par30 * stateMonth.glp);
        // We aren't calculating weighted par60/90/180 for company history here yet, but we should:
        // Or simply average them for history (approximation)
        metric.par60 += stateMonth.par60 * stateMonth.glp;
        metric.par90 += stateMonth.par90 * stateMonth.glp;
        metric.par180 += stateMonth.par180 * stateMonth.glp;
    });

    // Averaging Rates
    if (metric.glp > 0) {
        metric.par30 = parseFloat((totalParWeighted / metric.glp).toFixed(2));
        metric.par60 = parseFloat((metric.par60 / metric.glp).toFixed(2));
        metric.par90 = parseFloat((metric.par90 / metric.glp).toFixed(2));
        metric.par180 = parseFloat((metric.par180 / metric.glp).toFixed(2));
    } else {
        metric.par60 = 0; metric.par90 = 0; metric.par180 = 0;
    }
    // Remove temporary accumulators if any were added to the type (Wait, par60 is in type, so we reused it as accumulator)

    // Floating Point Cleanup
    metric.glp = parseFloat(metric.glp.toFixed(2));
    metric.disbursement = parseFloat(metric.disbursement.toFixed(2));
    metric.collection = parseFloat(metric.collection.toFixed(2));
    metric.collectionDue = parseFloat(metric.collectionDue.toFixed(2));

    return metric;
});

// ------------------------------------------------------------------
// 3. EXPORTED CONSTANTS (Legacy Support + Easy Access)
// ------------------------------------------------------------------

export const CURRENT_MONTH: Month = 'Feb';  // February 2026 (latest complete month)
const currentIdx = MONTHS.indexOf(CURRENT_MONTH);

export const COMPANY_METRICS = {
    ...COMPANY_HISTORY[currentIdx],
    currentGLP: COMPANY_HISTORY[currentIdx].glp,
    mtdDisbursement: COMPANY_HISTORY[currentIdx].disbursement,
    mtdCollection: COMPANY_HISTORY[currentIdx].collection,
    mtdCollectionDue: COMPANY_HISTORY[currentIdx].collectionDue,
    parOver30: COMPANY_HISTORY[currentIdx].par30,
    par90: COMPANY_HISTORY[currentIdx].par90,

    // YTD Calculations (Sum of all months up to Dec)
    ytdDisbursement: COMPANY_HISTORY.reduce((sum, m) => sum + m.disbursement, 0),
    ytdDisbursementTarget: 18500,
    ytdCollection: COMPANY_HISTORY.reduce((sum, m) => sum + m.collection, 0),
    ytdCollectionDue: COMPANY_HISTORY.reduce((sum, m) => sum + m.collectionDue, 0),
    ytdWriteoff: parseFloat((TOTAL_WRITEOFF).toFixed(2)),  // Rolled up from geo centres
    activeClients: TOTAL_CLIENTS,                            // Rolled up from geo centres
    totalBranches: TOTAL_BRANCHES_COUNT,                     // Rolled up from geo branches (915)

    // Calculated Overdue (from actual PAR30 weighted rollup)
    overdueAmount: parseFloat((COMPANY_HISTORY[currentIdx].glp * (TOTAL_PAR30_WEIGHTED / 100)).toFixed(2)),

    // Product Breakdown (Synced with Real Aggregation)
    productMix: Object.entries(TOTAL_PRODUCT_STATS).map(([key, stat]) => ({
        name: key as ProductType,
        glp: stat.glp,
        clients: stat.clients,
        par30: stat.par30
    })),

    // OPS Metrics (Rolled up from geo hierarchy)
    pendingApprovals: TOTAL_PENDING_APPROVALS,
    collectionLag: TOTAL_COLLECTION_LAG,
    get digitalAdoption() {
        // Digital collection from geo rollup vs total collection due for current month
        const totalDue = COMPANY_HISTORY[currentIdx].collectionDue;
        return totalDue > 0
            ? parseFloat(((TOTAL_DIGITAL_COLLECTION / totalDue) * 100).toFixed(1))
            : 52.5; // Fallback if totalDue is 0
    },
    get productivity() {
        return TOTAL_STAFF ? (COMPANY_HISTORY[currentIdx].glp / TOTAL_STAFF) : 0;
    }
};

// Dynamic Metadata for States derived from Hierarchy
const STATE_META: Record<string, { branches: number; districts: number; pendingApprovals?: number; collectionLag?: number }> = {};
ALL_STATES_DATA.forEach(s => {
    STATE_META[s.name] = {
        branches: s.districts.reduce((sum, d) => sum + d.branches.length, 0),
        districts: s.districts.length,
        pendingApprovals: s.pendingApprovals,
        collectionLag: s.collectionLag
    };
});

// Helper for State Data Access
export const getStatesData = () => {
    const states: any = {};
    Object.keys(STATE_HISTORY).forEach(key => {
        let id = key.toLowerCase().replace(/\s/g, '');

        // Map to legacy keys for compatibility
        if (id === 'andhrapradesh') id = 'andhra';
        if (id === 'madhyapradesh') id = 'madhyaPradesh';
        if (id === 'tamilnadu') id = 'tamilNadu';

        const hist = STATE_HISTORY[key];
        const curr = hist[currentIdx];
        const meta = STATE_META[key];

        // Find the matched state in ALL_STATES_DATA to get actual product mix
        const actualStateData = ALL_STATES_DATA.find(s => s.name === key);
        const actualProductMix = actualStateData?.products ? Object.entries(actualStateData.products).map(([k, v]) => ({
            name: k as ProductType,
            glp: v.glp,
            clients: v.clients,
            par30: v.par30
        })) : generateProductMix(curr.glp, curr.par30);

        states[id] = {
            name: key,
            glp: curr.glp,
            par30: curr.par30,
            par90: curr.par90,
            activeClients: curr.activeClients,
            mtdDisbursement: curr.disbursement,
            mtdCollection: curr.collection,
            mtdCollectionDue: curr.collectionDue,
            ytdDisbursement: hist.reduce((sum, m) => sum + m.disbursement, 0),
            ytdCollection: hist.reduce((sum, m) => sum + m.collection, 0),
            ytdCollectionDue: hist.reduce((sum, m) => sum + m.collectionDue, 0),
            branches: meta.branches,
            districts: meta.districts,
            pendingApprovals: meta.pendingApprovals || 0,
            collectionLag: meta.collectionLag || 0,
            productMix: actualProductMix,
            history: hist, // Full history access
            digitalAdoption: actualStateData && actualStateData.digitalCollection && curr.collectionDue ? ((actualStateData.digitalCollection / curr.collectionDue) * 100) : 0,
            productivity: actualStateData && actualStateData.staffCount ? (curr.glp / actualStateData.staffCount) : 0
        };
    });
    return states;
};

export const STATES_DATA = getStatesData();

// ------------------------------------------------------------------
// 4. BRANCH & CENTRE GENERATORS (Drill Down Support)
// ------------------------------------------------------------------

// Deterministically generate history for ANY branch ID
export const getBranchHistory = (branchId: string, baseGLP: number, basePAR: number) => {
    return generateHistory(baseGLP, basePAR);
};

// Export formatted helpers
export const formatCurrency = (value: number) => {
    if (value >= 10000) return `₹${(value / 10000).toFixed(1)} L`;
    if (value >= 100) return `₹${value.toFixed(1)} Cr`;
    return `₹${value.toFixed(2)} Cr`;
};
