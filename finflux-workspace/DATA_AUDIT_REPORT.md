# FINFLUX ANALYTICS - COMPLETE DATA AUDIT
## Verification Report - 2025-12-18

### PRIMARY DATA SOURCE: COMPANY_HISTORY (December 2025)
```
GLP: 9,250.45 Cr
Active Clients: 2,450,000
PAR30: 1.45%
PAR60: 0.95%
PAR90: 0.85%
PAR180: 0.45%
MTD Disbursement: 780.25 Cr
MTD Collection: 650.85 Cr
MTD Collection Due: 680.30 Cr
```

---

## DASHBOARD-BY-DASHBOARD VERIFICATION

### 1. HOME DASHBOARD (HomeDashboard.tsx)

#### Top KPIs:
- ✅ **DISBURSEMENT (MTD)**: Uses `metrics.mtdDisbursement` → **780.25 Cr** ✓
- ✅ **DISBURSEMENT (YTD)**: Uses `metrics.ytdDisbursement` → **Sum of all months** ✓
- ✅ **COLLECTIONS (MTD)**: Uses `metrics.mtdCollection` → **650.85 Cr** ✓
- ✅ **COLLECTIONS (YTD)**: Uses `metrics.ytdCollection` → **Sum of all months** ✓
- ✅ **OUTSTANDING GLP**: Uses `metrics.currentGLP` → **9,250.45 Cr** ✓
- ✅ **PAR TOTAL (>30 DAYS)**: Uses `metrics.parOver30` → **1.45%** ✓
- ❌ **OVERDUE AMOUNT**: Uses `metrics.overdueAmount` 
  - **Current**: Formula `GLP * (PAR30/100)` = 9,250.45 * 0.0145 = **134.13 Cr** ✓
  - **BUT USER SEES**: 182.03 Cr ❌
  - **ISSUE**: GLP in screenshot shows 8,794.5 Cr (different from code!)

- ✅ **ACTIVE CLIENTS**: Uses `metrics.activeClients` → **2,450,000** ✓

#### Risk & Ops KPIs:
- ✅ **NPA (90+ DAYS)**: Uses `metrics.par90` → **0.85%** ✓ (Screenshot shows 0.74% - need to check)
- ✅ **COLLECTION EFFICIENCY**: Calc `(mtdCollection / mtdCollectionDue * 100)` → **95.67%** ✓
- ❌ **RISK & COMPLIANCE (LUC Pending)**: Uses `globalStats.lucPending` 
  - **Should be**: National rollup from geoDataComplete
  - **Screen shows**: 3,250
- ✅ **DIGITAL ADOPTION**: Calc from `TOTAL_DIGITAL_COLLECTION / mtdCollectionDue * 100`
  - **Screen shows**: 52.5%

#### MISSING KPI:
- ❌ **WRITTEN OFF (YTD)**: NOT displayed anywhere on Home Dashboard
  - Available in `metrics.ytdWriteoff`
  - Should be added!

---

### 2. BRANCH DASHBOARD

**Issue**: Uses `COMPANY_METRICS.parOver30` for National view
- This feeds into `enrichEntityData` which calculates all other metrics
- If base PAR is wrong, EVERYTHING downstream is wrong

---

### 3. CENTRE & WORKFORCE DASHBOARD

**Digital Collection Split**: 
- Uses simulated data (55-65% digital, 30-40% cash)
- **NOT** using actual `TOTAL_DIGITAL_COLLECTION`
- **INCONSISTENT** with Home Dashboard's 52.5%

---

## ROOT CAUSE ANALYSIS

### Issue #1: Overdue Amount Discrepancy
**Problem**: GLP value is different
- **In Code**: `COMPANY_HISTORY[currentIdx].glp = 9,250.45 Cr`
- **In Screenshot**: Shows `8,794.5 Cr`
- **Calculation**: 8,794.5 * 0.0208 = 182.93 Cr ✓ (ACTUALLY CORRECT!)

**Conclusion**: The overdue IS mathematically correct for the GLP shown!

### Issue #2: PAR Values Inconsistent
- **Home Dashboard PAR30**: 2.08% (in screenshot)
- **Code PAR30**: 1.45%
- **MISMATCH**

### Issue #3: Digital Collection Not Synced
- **Home Dashboard**: 52.5% (calculated from real data)
- **Centre Dashboard**: 60% (simulated/random)
- **INCONSISTENT**

### Issue #4: Missing Write-off Display
- Data exists in `metrics.ytdWriteoff`
- Just not displayed on Home Dashboard

---

## CRITICAL FIXES NEEDED

1. ✅ Find why GLP value differs (8,794 vs 9,250)
2. ✅ Find why PAR30 value differs (2.08% vs 1.45%)
3. ✅ Sync digital collection % across all dashboards
4. ✅ Add YTD Write-off to Home Dashboard
5. ✅ Verify ALL calculations use same source

---

## SUSPECTED CAUSE

The `COMPANY_HISTORY` data source I'm using might NOT be what's actually being displayed.
There might be another data transformation happening that I'm not aware of.

Need to trace the ACTUAL runtime values being used.
