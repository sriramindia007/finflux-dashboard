# HOME DASHBOARD - DATA CONSISTENCY FIXES

## ✅ FIXES APPLIED:

### 1. Total Branches ✅ FIXED
**Was**: 1,755 (incorrect scaling: 27 branches × 65)
**Now**: 915 (fixed target)
**Fix**: Set `TOTAL_BRANCHES_COUNT = 915` as constant

### 2. Collection Status vs Efficiency - REDUNDANT
**Current KPIs:**
- Collections (MTD): ₹650.85 Cr / ₹680 Cr Due
- Collection Efficiency: 95.7% (same data, calculated)

**Recommendation**: **REMOVE "Collections (MTD)" - it's redundant**
- Collection Efficiency already shows the performance
- Collections YTD is more meaningful for year-to-date tracking
- MTD collections amount isn't a critical executive metric

**Keep these instead:**
- Collections (YTD): Shows annual total ✅
- Collection Efficiency: Shows performance % ✅

### 3. Digital Collection - INVESTIGATION NEEDED

**Current calculation:**
```typescript
digitalAdoption = (TOTAL_DIGITAL_COLLECTION / mtdCollectionDue) × 100
```

**Issues**:
1. TOTAL_DIGITAL_COLLECTION is scaled by GLP factor (1020x)
2. Should be: Digital Collection as % of Total Collections (not dues)
3. Need to verify the base number

**Expected Logic**:
```typescript
// At centre level: ~8-10% of GLP is digital
digitalCollection = centreGLP × 0.08 × (0.6 to 0.9 variance)

// Rolled up and scaled
TOTAL_DIGITAL_COLLECTION = sum scaled by 1020

// Percentage
digitalAdopt ion% = (TOTAL_DIGITAL_COLLECTION / TOTAL_Collections) × 100
```

**Current value showing**: Likely incorrect due to scaling mismatch

## ✅ ACTIONS TO TAKE:

1. ✅ **Total Branches**: DONE - now shows 915
2. **Remove Collections (MTD)**: Remove redundant KPI
3. **Fix Digital Collection**: Verify scaling and calculation

## RECOMMENDED HOME DASHBOARD KPIs:

**Primary (Financial)**:
- Disbursement (MTD)
- Disbursement (YTD)  
- Collections (YTD) - NOT MTD
- Outstanding GLP
- PAR Total (>30 Days)
- Write-offs (YTD)
- Total Branches ✅
- Active Clients

**Secondary (Performance)**:
- NPA (90+ Days)
- Collection Efficiency % ✅ (not separate MTD amount)
- Digital Adoption %
- Staff Productivity

This reduces redundancy and focuses on executive-level metrics!
