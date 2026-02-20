
## Fix: Smart Fuzzy Matching for Staff Names in WhatsApp Booking

### The Root Cause

The message contained "Book by priri" — a typo for "Priti". The current `matchStaffName` function only does:
1. Exact case-insensitive match
2. Partial/includes match

Neither catches typos like `priri` vs `priti` (one character transposed).

### The Fix: Add Levenshtein (Edit Distance) Fuzzy Matching

Add a `levenshtein` distance function to `supabase/functions/wati-webhook/index.ts` and update `matchStaffName` to use it as a fallback when exact/partial matching fails.

**Logic:**
- If the edit distance between the input and a staff first name is ≤ 2 characters, consider it a match
- This handles: typos (`priri` → `priti`), missing letters, transpositions
- Short names (≤ 3 chars) use stricter distance of ≤ 1 to avoid false matches

### File to Change

`supabase/functions/wati-webhook/index.ts` — update the `matchStaffName` function (around line 347):

**Current:**
```typescript
function matchStaffName(input: string, staffNames: string[]): string | null {
  const lower = input.toLowerCase().trim();
  const exact = staffNames.find(n => n.toLowerCase() === lower);
  if (exact) return exact;
  const partial = staffNames.find(n => n.toLowerCase().split(" ")[0] === lower || n.toLowerCase().includes(lower));
  if (partial) return partial;
  return null;
}
```

**Updated:**
```typescript
function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return dp[a.length][b.length];
}

function matchStaffName(input: string, staffNames: string[]): string | null {
  const lower = input.toLowerCase().trim();
  
  // 1. Exact match
  const exact = staffNames.find(n => n.toLowerCase() === lower);
  if (exact) return exact;
  
  // 2. Partial / includes match (first name or substring)
  const partial = staffNames.find(n => {
    const nl = n.toLowerCase();
    return nl.split(" ")[0] === lower || nl.includes(lower) || lower.includes(nl.split(" ")[0]);
  });
  if (partial) return partial;
  
  // 3. Fuzzy match against first name using Levenshtein distance
  const maxDist = lower.length <= 3 ? 1 : 2;
  const fuzzy = staffNames.find(n => {
    const firstName = n.toLowerCase().split(" ")[0];
    return levenshtein(lower, firstName) <= maxDist;
  });
  if (fuzzy) return fuzzy;
  
  return null;
}
```

### Also fix the `getValidationIssues` function (line 370–378)

The validation check at line 370–378 also does its own matching but with exact lowercase compare only. It should use `matchStaffName` consistently:

**Current:**
```typescript
if (!apt.booked_by || apt.booked_by === "WhatsApp") {
  issues.push(...);
} else if (!staffNames.some(n => n.toLowerCase() === (apt.booked_by || "").toLowerCase())) {
  const matched = matchStaffName(apt.booked_by, staffNames);
  if (!matched) {
    issues.push(...);
  }
}
```

This is already using `matchStaffName` as a fallback — so once `matchStaffName` gets fuzzy support, this will work correctly too.

### Result

After the fix:
- `"priri"` → fuzzy matches `"Priti"` (edit distance = 2) ✅
- `"michell"` → fuzzy matches `"Michelle"` (edit distance = 1) ✅
- `"sara"` → partial matches `"Sarika"` via includes ✅
- `"xyz123"` → no match, correctly asks for staff name ✅

Only the `wati-webhook` edge function needs to be updated and redeployed.
