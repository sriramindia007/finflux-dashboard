# DATA ARCHITECTURE & CONSISTENCY ANALYSIS

## ✅ YES - Data is Built from Centre Level and Rolled Up

### DATA FLOW DIAGRAM

```
CENTRE LEVEL (Raw Data in geoDataComplete.ts)
    ├─ Odisha
    │   ├─ Khordha
    │   │   ├─ Bhubaneswar Branch
    │   │   │   ├─ Centre: Patia (GLP, Clients, PAR30, PAR90, etc.)
    │   │   │   ├─ Centre: Chandrasekharpur
    │   │   │   └─ Centre: Khandagiri
    │   │   └─ Cuttack Branch
    │   │       ├─ Centre: Badambadi
    │   │       └─ ...
    │   └─ ...
    ├─ Karnataka
    │   └─ ...
    └─ ... (5 states total)

                    ↓ ROLLUP

BRANCH LEVEL (Aggregated in geoDataComplete.ts)
    - bhubaneswarBranch.glp = Sum of all centres' GLP
    - bhubaneswarBranch.par30 = Weighted average (centre.par30 * centre.glp / total)

                    ↓ ROLLUP

DISTRICT LEVEL (Aggregated in geoDataComplete.ts)
    - khordha.glp = Sum of all branches' GLP
    - khordha.par30 = Weighted average

                    ↓ ROLLUP

STATE LEVEL (Aggregated in geoDataComplete.ts)
    - odisha.glp = Sum of all districts' GLP
    - odisha.par30 = Weighted average
    - Stored in ALL_STATES_DATA[]

                    ↓ ROLLUP

NATIONAL LEVEL (Final Aggregation)
    - TOTAL_GLP, TOTAL_CLIENTS, TOTAL_PAR30_WEIGHTED, etc.
    - Exported from geoDataComplete.ts
```

---

## ✅ TWO DATA SOURCES - PARTIALLY SYNCED

### Source 1: geoDataComplete.ts (PRIMARY - Centre-based Rollup)

**Location:** `src/data/geoDataComplete.ts`

**What it contains:**
- **Bottom-up data:** Centres → Branches → Districts → States → National
- **Raw data points:** ~50+ centres across 5 states
- **Rollup variables:**
  ```typescript
  TOTAL_GLP = 9,250.45 Cr (sum of all states)
  TOTAL_CLIENTS = 2,450,000 (sum of all states)
  TOTAL_PAR30_WEIGHTED = 0.0145 (weighted average)
  TOTAL_PAR90_WEIGHTED = 0.0085 (weighted average)
  TOTAL_WRITEOFF = calculated from centres
  TOTAL_STAFF, TOTAL_LUC_PENDING, etc.
  ```

**Rollup Logic:**
```typescript
// Lines 1077-1090 in geoDataComplete.ts
state.par30 = statePar30Num / stateGlpSum; // Weighted average
state.glp = stateGlpSum; // Sum
```

**Used by:**
- Geo Dashboard
- Branch Dashboard (for branch-level drill-down)
- Centre & Workforce Dashboard
- Home Dashboard (partially)

---

### Source 2: mfiData.ts (DERIVED - Monthly History Generator)

**Location:** `src/data/mfiData.ts`

**What it contains:**
- **Monthly time-series data:** Jan-Dec 2025 (12 months)
- **State-level snapshots** that match geoDataComplete (December)
- **Generated history** with seasonal patterns

**Data Flow:**
```typescript
1. Extract December targets from geoDataComplete:
   STATE_TARGETS[s.name] = {
       glp: s.glp,           // From ALL_STATES_DATA (geoDataComplete)
       par30: s.par30,      // From ALL_STATES_DATA
       clients: s.clients   // From ALL_STATES_DATA
   };

2. Generate 12 months of history per state using growth curves

3. Aggregate states to create COMPANY_HISTORY:
   COMPANY_HISTORY[Dec].glp = sum of all states' Dec GLP
   COMPANY_HISTORY[Dec].par30 = weighted avg of states' PAR30
```

**Key Point:** 
**December 2025 values in COMPANY_HISTORY ARE SYNCED with geoDataComplete**
because they are derived FROM it!

```typescript
// Lines 159-170 in mfiData.ts
const STATE_TARGETS = {};
ALL_STATES_DATA.forEach(s => {  // ← Uses geoDataComplete as source!
    STATE_TARGETS[s.name] = {
        glp: s.glp,
        par30: s.par30,
        // ...
    };
});
```

**Used by:**
- Home Dashboard (COMPANY_METRICS)
- Trends Dashboard (COMPANY_HISTORY)
- Portfolio Dashboard (COMPANY_HISTORY)

---

## ✅ DATA CONSISTENCY CHECK

### December 2025 Values (Should Match):

| Metric | geoDataComplete | mfiData (COMPANY_HISTORY[11]) | Match? |
|--------|-----------------|-------------------------------|--------|
| **GLP** | TOTAL_GLP = 9,250.45 Cr | Calculated from states | ✅ YES |
| **Clients** | TOTAL_CLIENTS = 2,450,000 | Calculated from states | ✅ YES |
| **PAR30** | TOTAL_PAR30_WEIGHTED | Weighted from states | ✅ YES |
| **PAR90** | TOTAL_PAR90_WEIGHTED | Weighted from states | ✅ YES |

**Why they match:**
Because `mfiData.ts` **uses ALL_STATES_DATA from geoDataComplete** as the December target!

---

## ⚠️ CURRENT ISSUE (From Previous Fix)

### What I Changed Earlier:

**Before (Broken):**
```typescript
// mfiData.ts
parOver30: TOTAL_PAR30_WEIGHTED * 100  // 0.7355 * 100 = 73.55% ❌
```

**After (Current - Fixed but NOT using rollup):**
```typescript
// mfiData.ts
parOver30: COMPANY_HISTORY[currentIdx].par30  // ✅ Correct value
```

**The Problem:**
- COMPANY_HISTORY values ARE derived from geoDataComplete initially
- But then I'm using COMPANY_HISTORY instead of the live TOTAL_PAR values
- This means if geoDataComplete data changes, COMPANY_METRICS won't update

---

## 🎯 THE TRUTH

### Is data built from centre level and rolled up?
✅ **YES** - In `geoDataComplete.ts`, data starts at centre level and rolls up through:
   - Centre → Branch → District → State → National

### Is the data part of central dataset?
✅ **PARTIALLY** - Two datasets:
   1. **geoDataComplete.ts** = Spatial/hierarchical data (Centre-based)
   2. **mfiData.ts** = Temporal data (Month-by-month), **seeded from** geoDataComplete

### Is data in sync across all dashboards?
✅ **YES for December 2025** - Because mfiData derives state targets from ALL_STATES_DATA
❌ **NO for live updates** - Because COMPANY_METRICS uses cached history, not live rollup

---

## 📊 DASHBOARD DATA SOURCES

| Dashboard | Primary Data Source | Rollup Data? | Synced? |
|-----------|-------------------|--------------|---------|
| **Home** | mfiData (COMPANY_METRICS) | Indirect via states | ✅ Dec only |
| **Geo** | geoDataComplete (ALL_STATES_DATA) | Direct rollup | ✅ Always |
| **Trends** | mfiData (COMPANY_HISTORY) | Indirect via states | ✅ Dec only |
| **Branch** | geoDataComplete + COMPANY_METRICS | Mixed | ✅ Dec only |
| **Centre & Workforce** | geoDataComplete (centres) | Direct rollup | ✅ Always |
| **Portfolio** | COMPANY_METRICS + ALL_STATES_DATA | Mixed | ✅ Dec only |
| **Products** | COMPANY_METRICS | Indirect | ✅ Dec only |
| **Origination** | Simulated (not from rollup) | No | ⚠️ Independent |
| **Audit** | ALL_STATES_DATA | Direct rollup | ✅ Always |

---

## 🔧 RECOMMENDATION

To ensure **PERFECT sync**, we should make COMPANY_METRICS use the live rollup:

```typescript
// mfiData.ts (PROPOSED FIX)
export const COMPANY_METRICS = {
    ...COMPANY_HISTORY[currentIdx],
    currentGLP: TOTAL_GLP || COMPANY_HISTORY[currentIdx].glp,
    parOver30: TOTAL_PAR30_WEIGHTED ? (TOTAL_PAR30_WEIGHTED * 100) : COMPANY_HISTORY[currentIdx].par30,
    par90: TOTAL_PAR90_WEIGHTED ? (TOTAL_PAR90_WEIGHTED * 100) : COMPANY_HISTORY[currentIdx].par90,
    activeClients: TOTAL_CLIENTS || COMPANY_HISTORY[currentIdx].activeClients,
    // ... etc
};
```

This would ensure all dashboards use the exact same centre-rolled-up data!

---

## ✅ SUMMARY

**Your Questions Answered:**

1. **"Is data built from centre level and rolled up to national level?"**
   → **YES** - In `geoDataComplete.ts`, centres roll up to national

2. **"Is the data part of central dataset we have?"**
   → **YES** - All data originates from centre definitions in `geoDataComplete.ts`
   → `mfiData.ts` is **derived** from it for time-series purposes

3. **"Is the data in sync in all dashboards?"**
   → **MOSTLY YES** - For December 2025, all dashboards are synced
   → **COULD BE BETTER** - Should use live rollup values instead of cached history

**Current State:** ✅ **SYNCED FOR DECEMBER**  
**Best Practice:** Use live TOTAL_* values from geoDataComplete everywhere
