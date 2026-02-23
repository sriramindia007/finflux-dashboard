# CRITICAL BUG: CENTRES AND GROUPS COUNT

## ❌ CURRENT STATUS - COMPLETELY WRONG

### What the Dashboard Shows:
- **Total Centres**: 67.3k (67,300)
- **Total Groups**: 2.02L (202,000)

### What the ACTUAL Data Contains:
- **Actual Centres Defined**: ~98 centres in geoDataComplete.ts
- **Expected Groups**: ~400-500 (estimated 4-5 groups per centre)

### The Problem:

**Line 80-81 in BranchDashboard.tsx:**
```typescript
let centreCount = Math.floor(activeClients / 30);  
// = 2,450,000 / 30 = 81,666 centres ❌

let groupCount = Math.floor(activeClients / 10);   
// = 2,450,000 / 10 = 245,000 groups ❌
```

**This is a TERRIBLE estimation!** It assumes:
- 1 centre per 30 clients (should be ~25,000 clients per centre!)
- 1 group per 10 clients (should be ~50 clients per group!)

---

## ✅ THE TRUTH

### Actual Data Structure:
```
98 Centres across 5 states:
- Odisha: ~30 centres
- Karnataka: ~20 centres
- Andhra Pradesh: ~20 centres
- Madhya Pradesh: ~15 centres
- Tamil Nadu: ~13 centres

Each centre has:
- ~25,000 clients on average (2,450,000 / 98)
- ~5 groups per centre
- ~50 clients per group
```

### Correct Calculations:
```
Total Centres: 98 (defined in data)
Total Groups: ~490 (98 centres × 5 groups/centre)
```

---

## 🔧 THE FIX

The issue is that `geoDataComplete.ts` **DOESN'T track centre/group counts at the rolled-up levels**!

We need to COUNT how many centres exist in each hierarchy level:

```typescript
// NEW APPROACH - Count actual centres
const countCentres = (data: StateData | DistrictData | BranchData) => {
    if ('branches' in data) {
        // State level
        return data.districts.reduce((sum, d) => sum + countCentres(d), 0);
    } else if ('branches' in data) {
        // District level
        return data.branches.reduce((sum, b) => sum + countCentres(b), 0);
    } else if ('centres' in data) {
        // Branch level
        return data.centres.length;
    }
    return 0;
};
```

---

## 📊 COMPARISON

| Metric | Current (WRONG) | Should Be (CORRECT) | Error |
|--------|----------------|---------------------|-------|
| Centres | 67,300 | 98 | 686x too many |
| Groups | 202,000 | ~490 | 412x too many |
| Staff | 6,712 | ~6,500 | ~3% okay |

The staff count is actually reasonable because it uses:
```typescript
staffCount = Math.floor(activeClients / 365) + branches
         = Math.floor(2,450,000 / 365) + 185
         = 6,712 ✓
```

This matches the ~6,500 staff we expect (1 FO per 365-400 clients is industry standard).

---

## ⚠️ WHY THIS HAPPENED

The `enrichEntityData` function was designed for **convenience** when detailed centre/group data wasn't available. It **estimates** based on client count.

But now we have REAL centre data in `geoDataComplete.ts`, so we should use **actual counts** not estimates!

---

## 🔧 RECOMMENDED FIX

Add centre/group counts to the rollup in `geoDataComplete.ts`:

```typescript
// After rolling up GLP, clients, PAR, etc., also count:
state.centreCount = state.districts.reduce((sum, d) => sum + d.centreCount, 0);
state.groupCount = state.districts.reduce((sum, d) => sum + d.groupCount, 0);

// And at district level:
district.centreCount = district.branches.reduce((sum, b) => sum + b.centres.length, 0);
district.groupCount = district.centres * 5; // Estimate 5 groups per centre
```

Then use these real counts instead of the estimation formula!

---

## ✅ IMMEDIATE ACTION NEEDED

1. Stop using `activeClients / 30` for centre count
2. Count actual centres from the data structure
3. Update the rollup to include these counts
4. Use real data everywhere!
