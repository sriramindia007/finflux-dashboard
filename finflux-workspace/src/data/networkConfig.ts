/**
 * SINGLE SOURCE OF TRUTH FOR NETWORK CONFIGURATION
 * All scaling and targets defined here
 */

export const NETWORK_CONFIG = {
    // TARGET NETWORK SIZE (Your desired scale)
    targetBranches: 915,
    targetStates: 8,  // Including North India states

    // ACTUAL DATA WE HAVE (Representative sample)
    actualCentresInData: 105,    // Currently defined centres in geoDataComplete (75 old + 30 new)
    actualStatesInData: 5,      // Odisha, Karnataka, AP, MP, TN

    // OPERATIONAL RATIOS (Industry standard for MFIs)
    centresPerBranch: 5,        // Average centres per branch
    groupsPerCentre: 5,         // JLG groups per centre  
    clientsPerGroup: 10,        // Members per JLG group
    staffPerBranch: 4,          // Field officers + branch manager
    clientsPerCentre: 25000,    // Average portfolio size

    // PORTFOLIO RATIOS (Used for consistency)
    avgLoanSize: 0.000375,      // ₹37,500 average loan (in Cr)
    glpToClientsRatio: 1.0,     // GLP / Clients ratio

    // COLLECTION & RISK TARGETS
    collectionEfficiency: 0.957, // 95.7% target
    mtdCollectionRate: 0.12,     // 12% of GLP collected monthly
    writeoffRate: 0.005,         // 0.5% annual write-off

    // GEOGRAPHIC DISTRIBUTION (%)
    stateDistribution: {
        'Andhra Pradesh': 0.25,   // Largest presence
        'Karnataka': 0.18,
        'Odisha': 0.15,
        'Tamil Nadu': 0.12,
        'Madhya Pradesh': 0.10,
        'Uttar Pradesh': 0.10,    // NEW: North India
        'Rajasthan': 0.06,        // NEW: North India  
        'Bihar': 0.04             // NEW: North India
    }
};

// CALCULATE DERIVED METRICS
export const DERIVED_NETWORK = {
    // Total network size
    totalCentres: NETWORK_CONFIG.targetBranches * NETWORK_CONFIG.centresPerBranch,
    totalGroups: NETWORK_CONFIG.targetBranches * NETWORK_CONFIG.centresPerBranch * NETWORK_CONFIG.groupsPerCentre,
    totalStaff: NETWORK_CONFIG.targetBranches * NETWORK_CONFIG.staffPerBranch,

    // Scaling factor (how much to scale our sample data)
    scalingFactor: NETWORK_CONFIG.targetBranches /
        (NETWORK_CONFIG.actualCentresInData / NETWORK_CONFIG.centresPerBranch),

    // Branch distribution by state
    branchesPerState: Object.fromEntries(
        Object.entries(NETWORK_CONFIG.stateDistribution).map(([state, pct]) => [
            state,
            Math.round(NETWORK_CONFIG.targetBranches * pct)
        ])
    )
};

/**
 * APPLY SCALING TO A METRIC
 * Use this function to scale any metric from sample to target network size
 */
export const scaleMetric = (sampleValue: number, metricType: 'sum' | 'average' | 'percentage' = 'sum'): number => {
    switch (metricType) {
        case 'sum':
            // For additive metrics (GLP, clients, disbursement, etc.)
            return sampleValue * DERIVED_NETWORK.scalingFactor;
        case 'average':
            // For averages (don't scale, they're already representative)
            return sampleValue;
        case 'percentage':
            // For percentages/ratios (don't scale)
            return sampleValue;
        default:
            return sampleValue * DERIVED_NETWORK.scalingFactor;
    }
};

/**
 * CONSISTENCY CHECK
 * Validates that all metrics are mathematically consistent
 */
export const validateConsistency = (metrics: {
    glp: number;
    clients: number;
    par30: number;
    overdueAmount: number;
}) => {
    const calculatedOverdue = metrics.glp * (metrics.par30 / 100);
    const overdueDiff = Math.abs(calculatedOverdue - metrics.overdueAmount);

    if (overdueDiff > 0.01) {
        console.warn(`⚠️ Inconsistency detected: Overdue=${metrics.overdueAmount} but GLP*PAR30=${calculatedOverdue}`);
        return false;
    }

    return true;
};

export default NETWORK_CONFIG;
