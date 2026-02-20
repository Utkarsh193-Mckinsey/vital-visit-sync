
## Fix: Resubmit the Rejected WhatsApp Template with Approved Wording

### What Happened
The `appointment_reminder_24hr` template was **REJECTED** by WhatsApp/Meta. The rejection is likely because:
1. Templates cannot instruct users to "Reply Yes" — WhatsApp handles replies via buttons, not free-text prompts
2. The phrasing with "Reply Yes to confirm" may violate their messaging policy for UTILITY templates

### What Needs to Be Done

**Step 1 — Update the `manage-wati-templates` edge function to support deleting templates**
We need to add a `delete` action so we can remove the rejected template from WATI before resubmitting with a new name (WATI does not allow re-submitting with the same name after rejection in some cases).

**Step 2 — Resubmit with compliant wording**
WhatsApp-approved reminder templates typically:
- Do NOT include "Reply Yes/No" instructions (use buttons instead, or simply omit)
- Are concise and informational
- Don't include promotional language

New body to submit:
```
Hi {{1}}, this is a reminder for your {{2}} appointment at Cosmique Aesthetics. Time: {{3}}. We look forward to seeing you!
```

This uses the UTILITY category, is purely informational, and avoids response prompts that trigger rejection.

**Step 3 — Also add quick-reply buttons (optional but increases approval chance)**
WATI supports adding call-to-action buttons. Adding a "Confirm" quick reply button is the proper WhatsApp-approved way to get confirmations instead of asking users to reply in the body text.

### Technical Changes

**File: `supabase/functions/manage-wati-templates/index.ts`**
- Add `delete` action that calls `DELETE /api/v1/whatsApp/templates/{elementName}`
- Keep existing `list` and `create` actions unchanged

**File: `src/pages/WhatsAppChats.tsx`**
- Add a "Delete" button next to rejected templates in the list view so staff can remove and resubmit them
- Show a clear "REJECTED" warning badge on rejected templates in the send modal, with a message explaining they cannot be sent
- Auto-skip rejected templates when auto-selecting the first template

### After Implementation
Once deployed:
1. Delete the rejected `appointment_reminder_24hr` template via the Templates list
2. Create a new template with the corrected body (the UI will guide through this)
3. Wait 24–72 hours for WhatsApp Meta approval
4. Once APPROVED, the template will be sendable from both the chat UI and automated 24hr reminders
