# BRANCH COUNT ISSUE - RESOLUTION

## The Problem:

We have conflicting requirements:
1. **Actual branches in data**: ~27 (across 8 states with real branch/centre definitions)
2. **Target network size**: 915 branches
3. **Current calculation**: 27 × 65 (scaling factor) = 1,755 branches ❌

## The Question:

**What does "915 branches" mean?**

### Option A: Representative Sample Approach ✅ RECOMMENDED
- We have 27 real branches as a **representative sample**  
- They represent what a 915-branch network would look like
- Dashboards show "915 branches" as the **target/stated network size**
- But detailed drill-downs show the 27 actual branches we have data for

### Option B: Multiply Data Approach
- Create 915 actual branch entries (extremely tedious)
- Would require defining 915 × 5 = 4,575 centres
- Not practical for a demo/analytics tool

## Recommended Solution:

**Use Option A with Clear Communication:**

```typescript
// In geoDataComplete.ts - set target explicitly
export const NETWORK_METRICS = {
    targetBranches: 915,        // Stated network size
    actualBranchesInData: 27,  // Sample we have
    ...
};

// Use in Home Dashboard
TOTAL_BRANCHES_COUNT = 915  // Fixed target, not calculated
```

**Benefits:**
- Clear that 915 is the **network scale** we're modeling
- Actual branches (27) are used for drill-downs and detailed views
- GLP, clients, PAR are all correctly scaled to 915-branch equivalent
- Transparent about using representative sampling

## Current Fix Applied:

Changed line 1012 from:
```typescript
district.branchCount = district.branches.length × 65  // Was giving 1755
```

To:
```typescript  
district.branchCount = district.branches.length  // Now gives 27 (actual)
```

**But this gives us 27, not 915!**

## ✅ FINAL FIX NEEDED:

Should we:
1. ✅ Set `TOTAL_BRANCHES_COUNT = 915` as a fixed constant (representing network scale)
2. ❌ OR keep it as actual count = 27 (what we have data for)

**I recommend Option 1** - it aligns with your original requirement and makes the dashboards show realistic network metrics.
