## Goal
Surface pending vendor dues (unpaid Purchase Order balances) directly inside the Profitability & Breakeven page so owners see real cash obligations alongside revenue, COGS, and breakeven progress.

## Changes (frontend-only, `src/pages/ProfitabilityPage.tsx`)

1. **Fetch pending dues** alongside existing data:
   - Query `purchase_orders` for rows where `balance_due > 0` (and `payment_status` in `pending`/`partial`).
   - Aggregate: total outstanding, count of POs, top 3 vendors by balance, oldest unpaid PO date.

2. **New KPI tile** in the top stat grid (expand to 5 cards / responsive):
   - "Pending Vendor Dues" — total ₹ outstanding, with subtext like "X POs • oldest N days".
   - Color: amber/warning when > 0, neutral when 0.

3. **Breakeven adjustment**:
   - Add a secondary line under the breakeven bar: "Cash-Adjusted Breakeven = Fixed Costs + Pending Dues".
   - Show a thin amber overlay on the progress bar marking the extra ground to cover.
   - Update the helper text to mention vendor dues when present.

4. **Vendor Dues panel** (new card below Daily Breakdown):
   - List top vendors with balance, payment status badge, days overdue.
   - "View all" link → navigates to `/purchase-orders` filtered to pending dues (uses existing page).
   - Empty state: "All vendor payments are settled."

## Out of scope
- No DB schema changes (uses existing `purchase_orders.balance_due` / `payment_status`).
- No edits to Purchase Orders page itself.
- No changes to fixed-cost storage.

## Technical notes
- Single Supabase select on `purchase_orders` with the existing RLS scope (branch-isolated).
- Memoize derived totals in the existing `useMemo`.
- Reuse existing Tailwind tokens (`text-amber-600`, `border-amber-500/30`) consistent with current warning styling.
