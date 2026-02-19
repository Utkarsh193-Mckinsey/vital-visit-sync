

## Fix: Make Status and Confirmation Dropdowns Match Badge Sizes

### Problem
The "upcoming" and "unconfirmed" select dropdowns on the appointment card action row are visually larger than the neighboring badge buttons (Call, Confirm, Register, Reschedule, No Show). Despite setting `h-5` and `text-[9px]`, the base SelectTrigger component's default styles (`h-10`, `py-2`, `text-sm`) are partially overriding the compact sizing.

### Solution
Override the SelectTrigger styles more aggressively using `!important`-equivalent Tailwind utilities and ensure line-height, padding, and font-size are all consistently applied. The key fix is adding explicit `leading-none` and ensuring the internal span text doesn't expand the trigger height.

### Changes

**File: `src/components/appointments/AppointmentCard.tsx`**

1. Update the **Status SelectTrigger** (line 235) to add `leading-none` and tighter sizing:
   - Change class to: `h-5 min-h-0 w-auto max-w-[80px] text-[9px] leading-none rounded-full border py-0 px-1.5 gap-0.5 [&>svg]:h-2 [&>svg]:w-2 [&>span]:truncate`

2. Update the **Confirmation SelectTrigger** (line 246) similarly:
   - Change class to: `h-5 min-h-0 w-auto max-w-[100px] text-[9px] leading-none rounded-full border py-0 px-1.5 gap-0.5 [&>svg]:h-2 [&>svg]:w-2 [&>span]:truncate`

3. Also add `leading-none` to all Badge action buttons for perfect alignment consistency.

These changes ensure the select triggers render at exactly the same visual height as the badge buttons by eliminating any extra line-height or internal padding.

