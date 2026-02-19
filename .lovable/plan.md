
## Fix: SelectTrigger Dropdowns Still Larger Than Badge Buttons

### Root Cause

The core issue is in `src/components/ui/select.tsx`. The base `SelectTrigger` component has hardcoded styles AND a hardcoded chevron icon inside it:

1. **Base styles**: `h-10 w-full px-3 py-2 text-sm` -- these ARE being merged by `tailwind-merge`, so height/padding overrides work
2. **The real culprit**: The `ChevronDown` icon inside SelectTrigger is hardcoded at `h-4 w-4` (16x16px). Even though we set `[&>svg]:h-2 [&>svg]:w-2` on the trigger, the icon is nested inside a `SelectPrimitive.Icon` wrapper, so the CSS selector doesn't reach it properly
3. **`w-full`** from the base makes the trigger stretch wider than needed, fighting with `w-auto`

### Solution

Two changes needed:

**1. `src/components/ui/select.tsx`** -- Make the internal chevron icon size controllable via CSS:
- Change the hardcoded `className="h-4 w-4 opacity-50"` on the ChevronDown to use a class that can be overridden from parent
- Specifically, remove the fixed `h-4 w-4` and instead use `shrink-0` so it inherits size from parent styling

**2. `src/components/appointments/AppointmentCard.tsx`** -- Simplify the override classes:
- Remove `!` important prefixes (not needed with tailwind-merge)
- Target the icon properly with `[&_svg]:h-2 [&_svg]:w-2` (descendant selector, not child selector) to reach the nested chevron

### Detailed Changes

**File: `src/components/ui/select.tsx` (line 27)**
Change the ChevronDown from:
```tsx
<ChevronDown className="h-4 w-4 opacity-50" />
```
To:
```tsx
<ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
```

**File: `src/components/appointments/AppointmentCard.tsx`**

Status SelectTrigger (line 235) -- change to:
```
h-5 min-h-0 w-auto max-w-[80px] text-[9px] leading-none rounded-full border py-0 px-1.5 gap-0.5 [&_svg]:h-2 [&_svg]:w-2 [&>span]:truncate
```

Confirmation SelectTrigger (line 246) -- change to:
```
h-5 min-h-0 w-auto max-w-[100px] text-[9px] leading-none rounded-full border py-0 px-1.5 gap-0.5 [&_svg]:h-2 [&_svg]:w-2 [&>span]:truncate
```

Key differences:
- Removed `!` prefixes -- `tailwind-merge` handles `h-10` vs `h-5` correctly (keeps last)
- Changed `[&>svg]` (direct child) to `[&_svg]` (any descendant) so it reaches the chevron nested inside `SelectPrimitive.Icon`
- This ensures the chevron icon shrinks to 8x8px instead of staying at 16x16px, which was forcing the trigger to be taller

This will make both dropdowns render at exactly 20px height (`h-5`) matching the badge buttons.
