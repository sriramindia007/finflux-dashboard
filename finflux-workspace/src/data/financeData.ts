/**
 * FINFLUX Analytics — Financial Performance & Collections Data Engine
 * Extends the existing mfiData model.
 * All monetary values in Crores unless stated.
 * Follows same Month / MonthlyMetric pattern as mfiData.ts
 */

import {
    MONTHS, COMPANY_HISTORY, STATE_HISTORY,
    type Month, type MonthlyMetric
} from './mfiData';
import {
    ALL_STATES_DATA, TOTAL_GLP, TOTAL_CLIENTS,
    TOTAL_BRANCHES_COUNT, TOTAL_WRITEOFF, TOTAL_STAFF
} from './geoDataComplete';

// ──────────────────────────────────────────────────────────────────────────────
// TINY DETERMINISTIC PRNG (same mulberry32 used in mfiData)
// ──────────────────────────────────────────────────────────────────────────────
const seeded = (seed: number): number => {
    let s = (seed + 1) >>> 0;
    s = Math.imul(s ^ (s >>> 15), s | 1);
    s ^= s + Math.imul(s ^ (s >>> 7), s | 61);
    return ((s ^ (s >>> 14)) >>> 0) / 4294967296;
};

// ──────────────────────────────────────────────────────────────────────────────
// 1. FINANCIAL PERFORMANCE TYPES
// ──────────────────────────────────────────────────────────────────────────────

export interface FinancialMetric {
    month: Month;
    // Income
    interestIncome: number;     // Cr — interest earned on portfolio
    feeIncome: number;          // Cr — processing, documentation fees
    totalIncome: number;        // Cr — interestIncome + feeIncome
    // Expenses
    interestExpense: number;    // Cr — cost of borrowings
    opex: number;               // Cr — staff, admin, tech, branch costs
    provisionForNPA: number;    // Cr — provisions made for at-risk loans
    totalExpense: number;       // Cr
    // Derived
    nii: number;                // Net Interest Income = interestIncome - interestExpense
    nim: number;                // Net Interest Margin % = NII / avg GLP * 100
    oer: number;                // Operating Expense Ratio % = opex / avg GLP * 100
    cir: number;                // Cost-to-Income Ratio % = totalExpense / totalIncome * 100
    pbp: number;                // Pre-provision profit = totalIncome - opex - interestExpense
    pat: number;                // Profit After Tax (approx, 25% tax)
    roa: number;                // Return on Assets % = PAT / avg GLP * 100
    roe: number;                // Return on Equity % (equity ~12% of GLP)
    // Funding
    borrowings: number;         // Cr outstanding borrowings
    costOfFunds: number;        // % weighted average cost of borrowings
    yieldOnPortfolio: number;   // % effective yield
    crar: number;               // Capital to Risk-Adjusted Assets %
    // Clients & Scale
    activeClients: number;
    glp: number;
}

export interface DPDBucket {
    bucket: string;             // e.g. "1-30 DPD"
    amount: number;             // Cr overdue
    accounts: number;           // count
    pct: number;                // % of GLP
}

export interface CollectionMetric {
    month: Month;
    scheduled: number;          // Due for the month — Cr
    collected: number;          // Actually collected — Cr
    efficiency: number;         // % = collected/scheduled*100
    overdue: number;            // Cr carried forward
    dpd: DPDBucket[];           // PAR Buckets
    nonStarters: number;        // Accounts never paid after disbursement
    resolutionRate: number;     // % overdue accounts cured this month
    recoveryFromNPA: number;    // Cr recovered from written-off accounts
    cashCollection: number;     // Cr
    digitalCollection: number;  // Cr
    digitalPct: number;         // %
}

export interface VintageRow {
    disbursementMonth: Month;
    loansClosed: number;
    loansActive: number;
    par30AtM3: number;          // PAR 30 at 3-months-old
    par30AtM6: number;          // PAR 30 at 6-months-old
    par30AtM12: number;         // PAR 30 at 12-months-old
    parAtClose: number;         // PAR 30 when cohort closed/measured
    writeOff: number;           // Cr written off in cohort
    loanCycle: 1 | 2 | 3 | 4;  // Loan cycle (repeat customers)
}

export interface StateFinancials {
    name: string;
    glp: number;
    // Regulatory
    qualifyingAssetPct: number;         // % loans ≤ ₹3L (RBI QA norm ≥ 85%)
    householdIncomePct: number;         // % borrowers with HH income ≤ ₹3L pa
    irrPct: number;                     // Effective interest rate % (RBI cap 24%)
    // Borrower protection
    multiLenderPct: number;             // % borrowers with 3+ lenders (overlap risk)
    // Collections
    collectionEfficiency: number;       // %
    dpd30Pct: number;                   // %
    dpd90Pct: number;                   // %
}

// ──────────────────────────────────────────────────────────────────────────────
// 2. FINANCIAL MODEL PARAMETERS (FINFLUX MFI benchmarks)
// ──────────────────────────────────────────────────────────────────────────────

// Funding mix (typical MFI): Bank loans 55%, NCDs 25%, NBFC-MFI refinance 15%, Equity/Grants 5%
const COST_OF_FUNDS_BASE = 11.2;            // % (MFIN industry ~10-12%)
const YIELD_ON_PORTFOLIO_BASE = 22.5;       // % (RBI cap 24% minus margin)
const OPEX_RATIO_BASE = 5.8;               // % on GLP (MFIN: 5-7%)
const CRAR_BASE = 18.5;                     // % (RBI min 15%)
const EQUITY_RATIO = 0.13;                 // ~13% of GLP = equity base
const TAX_RATE = 0.25;                     // Effective corporate tax

// ──────────────────────────────────────────────────────────────────────────────
// 3. GENERATE MONTHLY FINANCIAL HISTORY
// ──────────────────────────────────────────────────────────────────────────────

const generateFinancialHistory = (): FinancialMetric[] => {
    return MONTHS.map((month, idx) => {
        const companyMonth: MonthlyMetric = COMPANY_HISTORY[idx];
        const glp = companyMonth.glp;
        const par30 = companyMonth.par30;

        // Yield rises slightly through year (portfolio mix shift to higher-yield products)
        const yieldAdj = YIELD_ON_PORTFOLIO_BASE + seeded(idx * 7) * 0.8;
        const cofAdj = COST_OF_FUNDS_BASE - seeded(idx * 11) * 0.4; // CoF falling as MFI matures
        const opexAdj = OPEX_RATIO_BASE + seeded(idx * 13) * 0.5;   // opex fluctuates

        const annualFactor = 1 / 12;  // Monthly slice of annual rate
        const interestIncome = parseFloat((glp * (yieldAdj / 100) * annualFactor).toFixed(2));
        const feeIncome = parseFloat((glp * 0.004 * annualFactor).toFixed(2));   // 0.4% fee income (processing + docs)
        const totalIncome = parseFloat((interestIncome + feeIncome).toFixed(2));

        const interestExpense = parseFloat((glp * (cofAdj / 100) * annualFactor).toFixed(2));
        const opex = parseFloat((glp * (opexAdj / 100) * annualFactor).toFixed(2));
        const provisionForNPA = parseFloat((glp * (par30 / 100) * 0.15 * annualFactor).toFixed(2)); // 15% provision on PAR30

        const totalExpense = parseFloat((interestExpense + opex + provisionForNPA).toFixed(2));

        const nii = parseFloat((interestIncome - interestExpense).toFixed(2));
        const nim = parseFloat(((nii / glp) * 100).toFixed(2));
        const oer = parseFloat(((opex / glp) * 100).toFixed(2));
        const cir = parseFloat(((totalExpense / totalIncome) * 100).toFixed(2));
        const pbp = parseFloat((totalIncome - opex - interestExpense).toFixed(2));
        const pbt = parseFloat((pbp - provisionForNPA).toFixed(2));
        const pat = parseFloat((Math.max(0, pbt) * (1 - TAX_RATE)).toFixed(2));
        const roa = parseFloat(((pat / glp) * 100).toFixed(2));
        const equityBase = glp * EQUITY_RATIO;
        const roe = parseFloat(((pat * 12 / equityBase) * 100).toFixed(2)); // Annualised ROE

        // Borrowings: ~85% of GLP funded by debt
        const borrowings = parseFloat((glp * 0.85).toFixed(2));
        // CRAR improves through year as profits add to equity
        const crar = parseFloat((CRAR_BASE + idx * 0.08 + seeded(idx * 17) * 0.3).toFixed(2));

        return {
            month,
            interestIncome,
            feeIncome,
            totalIncome,
            interestExpense,
            opex,
            provisionForNPA,
            totalExpense,
            nii,
            nim,
            oer,
            cir,
            pbp,
            pat,
            roa,
            roe,
            borrowings,
            costOfFunds: parseFloat(cofAdj.toFixed(2)),
            yieldOnPortfolio: parseFloat(yieldAdj.toFixed(2)),
            crar,
            activeClients: companyMonth.activeClients,
            glp
        };
    });
};

export const FINANCIAL_HISTORY: FinancialMetric[] = generateFinancialHistory();
export const CURRENT_FINANCIALS: FinancialMetric = FINANCIAL_HISTORY[FINANCIAL_HISTORY.length - 1];

// ──────────────────────────────────────────────────────────────────────────────
// 4. GENERATE MONTHLY COLLECTIONS HISTORY
// ──────────────────────────────────────────────────────────────────────────────

const generateCollectionsHistory = (): CollectionMetric[] => {
    return MONTHS.map((month, idx) => {
        const companyMonth = COMPANY_HISTORY[idx];
        const glp = companyMonth.glp;
        const par30 = companyMonth.par30;

        const scheduled = companyMonth.collectionDue;
        const collected = companyMonth.collection;
        const efficiency = parseFloat(((collected / scheduled) * 100).toFixed(2));
        const overdue = parseFloat((scheduled - collected).toFixed(2));

        // DPD Buckets: consistent with PAR waterfall  (par30 > par60 > par90 > par180)
        const par60 = companyMonth.par60 ?? par30 * 0.65;
        const par90 = companyMonth.par90;
        const par180 = companyMonth.par180 ?? par90 * 0.55;

        const dpd: DPDBucket[] = [
            {
                bucket: '1–30 DPD',
                amount: parseFloat((glp * (par30 / 100)).toFixed(2)),
                accounts: Math.floor(companyMonth.activeClients * (par30 / 100) * 0.85),
                pct: parseFloat(par30.toFixed(2))
            },
            {
                bucket: '31–60 DPD',
                amount: parseFloat((glp * (par60 / 100)).toFixed(2)),
                accounts: Math.floor(companyMonth.activeClients * (par60 / 100) * 0.85),
                pct: parseFloat(par60.toFixed(2))
            },
            {
                bucket: '61–90 DPD',
                amount: parseFloat((glp * (par90 / 100)).toFixed(2)),
                accounts: Math.floor(companyMonth.activeClients * (par90 / 100) * 0.85),
                pct: parseFloat(par90.toFixed(2))
            },
            {
                bucket: '91–180 DPD',
                amount: parseFloat((glp * ((par90 * 0.55) / 100)).toFixed(2)),
                accounts: Math.floor(companyMonth.activeClients * ((par90 * 0.55) / 100) * 0.85),
                pct: parseFloat((par90 * 0.55).toFixed(2))
            },
            {
                bucket: '180+ DPD (NPA)',
                amount: parseFloat((glp * ((par180) / 100)).toFixed(2)),
                accounts: Math.floor(companyMonth.activeClients * (par180 / 100) * 0.85),
                pct: parseFloat(par180.toFixed(2))
            }
        ];

        // Non-starters: 0.1–0.3% of active borrowers (early fraud/ghosting signal)
        const nonStarters = Math.floor(companyMonth.activeClients * (0.001 + seeded(idx * 19) * 0.002));

        // Resolution rate: improving over year due to collections drive
        const resolutionRate = parseFloat((62 + idx * 0.8 + seeded(idx * 23) * 4).toFixed(1));

        // Recovery from NPAs (written-off recovery): typically 5–10% of written-off pool
        const recoveryFromNPA = parseFloat((glp * 0.0005 + seeded(idx * 31) * glp * 0.0003).toFixed(2));

        // Digital vs Cash split (improving over months)
        const digitalPct = Math.min(70, 45 + idx * 1.8 + seeded(idx * 37) * 3);
        const digitalCollection = parseFloat((collected * (digitalPct / 100)).toFixed(2));
        const cashCollection = parseFloat((collected - digitalCollection).toFixed(2));

        return {
            month,
            scheduled,
            collected,
            efficiency,
            overdue,
            dpd,
            nonStarters,
            resolutionRate,
            recoveryFromNPA,
            cashCollection,
            digitalCollection,
            digitalPct: parseFloat(digitalPct.toFixed(1))
        };
    });
};

export const COLLECTIONS_HISTORY: CollectionMetric[] = generateCollectionsHistory();
export const CURRENT_COLLECTIONS: CollectionMetric = COLLECTIONS_HISTORY[COLLECTIONS_HISTORY.length - 1];

// ──────────────────────────────────────────────────────────────────────────────
// 5. VINTAGE / COHORT ANALYSIS (Loan-cycle quality)
// ──────────────────────────────────────────────────────────────────────────────

export const VINTAGE_DATA: VintageRow[] = MONTHS.slice(0, 10).map((month, idx) => {
    const glp = COMPANY_HISTORY[idx].glp;
    const basePAR = COMPANY_HISTORY[idx].par30;

    // Loan cycle distribution: 40% 1st, 35% 2nd, 20% 3rd, 5% 4th+
    const cycleWeights = [0.4, 0.35, 0.2, 0.05];
    const cycle = ([1, 2, 3, 4] as const)[Math.floor(seeded(idx * 41) * 4)];

    // Repeat borrowers have significantly lower PAR (they are screened)
    const cyclePARAdj = cycle === 1 ? 1.5 : cycle === 2 ? 0.9 : cycle === 3 ? 0.7 : 0.6;

    const p3 = parseFloat((basePAR * cyclePARAdj * (0.5 + seeded(idx * 43) * 0.3)).toFixed(2));
    const p6 = parseFloat((basePAR * cyclePARAdj * (0.8 + seeded(idx * 47) * 0.3)).toFixed(2));
    const p12 = parseFloat((basePAR * cyclePARAdj * (1.0 + seeded(idx * 53) * 0.2)).toFixed(2));

    const loansActive = Math.floor(glp * 50 * (1 - idx * 0.02));   // rough loan-count estimate
    const loansClosed = Math.floor(loansActive * (idx * 0.04));

    return {
        disbursementMonth: month,
        loansClosed,
        loansActive,
        par30AtM3: p3,
        par30AtM6: p6,
        par30AtM12: p12,
        parAtClose: parseFloat((p12 * 0.4).toFixed(2)),
        writeOff: parseFloat((glp * (p12 / 100) * 0.2 * seeded(idx * 59)).toFixed(2)),
        loanCycle: cycle
    };
});

// ──────────────────────────────────────────────────────────────────────────────
// 6. STATE-WISE FINANCIAL SUMMARY (Regulatory & Risk)
// ──────────────────────────────────────────────────────────────────────────────

export const STATE_FINANCIALS: StateFinancials[] = ALL_STATES_DATA.map((state, idx) => {
    const glp = state.glp || 0;
    const par30 = state.par30 || 2.5;

    return {
        name: state.name,
        glp,
        qualifyingAssetPct: parseFloat((87 + seeded(idx * 61) * 8).toFixed(1)),   // RBI norm ≥ 85%
        householdIncomePct: parseFloat((91 + seeded(idx * 67) * 6).toFixed(1)),   // RBI norm ≥ 90%
        irrPct: parseFloat((21 + seeded(idx * 71) * 2.5).toFixed(1)),             // RBI cap 24%
        multiLenderPct: parseFloat((12 + seeded(idx * 73) * 10).toFixed(1)),      // overlap risk
        collectionEfficiency: parseFloat((95.5 + seeded(idx * 79) * 3).toFixed(1)),
        dpd30Pct: par30,
        dpd90Pct: parseFloat((par30 * 0.45).toFixed(2))
    };
});

// ──────────────────────────────────────────────────────────────────────────────
// 7. HIGH-RISK CENTRE LIST (for Collections Dashboard hotspot table)
// ──────────────────────────────────────────────────────────────────────────────

export interface HighRiskCentre {
    centreName: string;
    branchName: string;
    district: string;
    state: string;
    par30: number;
    overdueAmount: number;   // Cr
    consecutiveMisses: number;
    clients: number;
    glp: number;
}

export const HIGH_RISK_CENTRES: HighRiskCentre[] = (() => {
    const result: HighRiskCentre[] = [];
    ALL_STATES_DATA.forEach(state => {
        state.districts.forEach(district => {
            district.branches.forEach(branch => {
                branch.centres.forEach(centre => {
                    if ((centre.par30 || 0) > 4.0) {
                        result.push({
                            centreName: centre.name,
                            branchName: branch.name,
                            district: district.name,
                            state: state.name,
                            par30: centre.par30 || 0,
                            overdueAmount: parseFloat((centre.glp * ((centre.par30 || 0) / 100)).toFixed(3)),
                            consecutiveMisses: Math.floor(1 + seeded(centre.name.length + (centre.par30 || 0) * 10) * 3),
                            clients: centre.clients,
                            glp: centre.glp
                        });
                    }
                });
            });
        });
    });
    return result.sort((a, b) => b.par30 - a.par30).slice(0, 20);
})();

// ──────────────────────────────────────────────────────────────────────────────
// 8. REGULATORY COMPLIANCE SUMMARY
// ──────────────────────────────────────────────────────────────────────────────

export interface RegulatoryCompliance {
    metric: string;
    actual: number;
    norm: string;           // RBI / MFIN reference
    status: 'Compliant' | 'Warning' | 'Breach';
    unit: string;
}

export const REGULATORY_COMPLIANCE: RegulatoryCompliance[] = [
    {
        metric: 'CRAR (Capital Adequacy)',
        actual: CURRENT_FINANCIALS.crar,
        norm: '≥ 15%',
        status: CURRENT_FINANCIALS.crar >= 15 ? 'Compliant' : 'Breach',
        unit: '%'
    },
    {
        metric: 'Qualifying Assets Ratio',
        actual: STATE_FINANCIALS.reduce((s, f) => s + f.qualifyingAssetPct, 0) / STATE_FINANCIALS.length,
        norm: '≥ 85%',
        status: 'Compliant',
        unit: '%'
    },
    {
        metric: 'Max Loan per Borrower',
        actual: 1.8,
        norm: '≤ ₹3 Lakh',
        status: 'Compliant',
        unit: 'L avg'
    },
    {
        metric: 'Borrower Household Income',
        actual: STATE_FINANCIALS.reduce((s, f) => s + f.householdIncomePct, 0) / STATE_FINANCIALS.length,
        norm: '≥ 90% ≤ ₹3L pa HH',
        status: 'Compliant',
        unit: '%'
    },
    {
        metric: 'Effective Interest Rate',
        actual: CURRENT_FINANCIALS.yieldOnPortfolio,
        norm: '≤ 24% (RBI Cap)',
        status: CURRENT_FINANCIALS.yieldOnPortfolio <= 24 ? 'Compliant' : 'Breach',
        unit: '%'
    },
    {
        metric: 'Multi-Lender Exposure (3+)',
        actual: STATE_FINANCIALS.reduce((s, f) => s + f.multiLenderPct, 0) / STATE_FINANCIALS.length,
        norm: '< 20% (MFIN)',
        status: 'Compliant',
        unit: '%'
    },
    {
        metric: 'SRO Membership (MFIN)',
        actual: 100,
        norm: 'Mandatory',
        status: 'Compliant',
        unit: '%'
    },
    {
        metric: 'CERSAI Registration',
        actual: 96.2,
        norm: '≥ 95%',
        status: 'Compliant',
        unit: '%'
    }
];

// ──────────────────────────────────────────────────────────────────────────────
// 9. BENCHMARK COMPARISON  (MFIN industry averages — 2024 annual report)
// ──────────────────────────────────────────────────────────────────────────────

export interface BenchmarkRow {
    metric: string;
    ourValue: number;
    industryAvg: number;
    topQuartile: number;
    unit: string;
    better: 'higher' | 'lower';  // which direction is better?
}

export const INDUSTRY_BENCHMARKS: BenchmarkRow[] = [
    { metric: 'NIM', ourValue: CURRENT_FINANCIALS.nim * 12, industryAvg: 11.2, topQuartile: 13.5, unit: '%', better: 'higher' },
    { metric: 'ROA', ourValue: CURRENT_FINANCIALS.roa * 12, industryAvg: 3.1, topQuartile: 4.8, unit: '%', better: 'higher' },
    { metric: 'OER', ourValue: CURRENT_FINANCIALS.oer * 12, industryAvg: 6.2, topQuartile: 4.9, unit: '%', better: 'lower' },
    { metric: 'Collection Efficiency', ourValue: CURRENT_COLLECTIONS.efficiency, industryAvg: 97.8, topQuartile: 99.1, unit: '%', better: 'higher' },
    { metric: 'PAR 30', ourValue: CURRENT_COLLECTIONS.dpd[0].pct, industryAvg: 3.6, topQuartile: 1.8, unit: '%', better: 'lower' },
    { metric: 'PAR 90', ourValue: CURRENT_COLLECTIONS.dpd[2].pct, industryAvg: 1.9, topQuartile: 0.8, unit: '%', better: 'lower' },
    { metric: 'CRAR', ourValue: CURRENT_FINANCIALS.crar, industryAvg: 22.4, topQuartile: 28.5, unit: '%', better: 'higher' },
    { metric: 'Cost of Funds', ourValue: CURRENT_FINANCIALS.costOfFunds, industryAvg: 11.8, topQuartile: 10.2, unit: '%', better: 'lower' },
];
