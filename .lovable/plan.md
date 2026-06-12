## Plan: Amount Tendered & Change Due Calculator

### Overview
Add an **Amount Tendered** input and **Change Due** display to the `CheckoutModal` settlement screen, active only when **Cash** is selected as the payment method. Also print these values on the cash receipt.

### Files to modify
- `src/components/checkout/CheckoutModal.tsx`

### Changes

1. **State**
   - Add `amountTendered` string state (default `""`).
   - Reset it in `resetState()`.

2. **UI — Settlement panel**
   - When `selectedPayment === "cash"`, render:
     - A numeric `Input` labeled **Amount Tendered (₹)**.
     - A read-only line showing **Change Due: ₹X.XX** (computed as `Math.max(0, amountTendered - grandTotal)`).
     - If tendered < grandTotal, show a subtle warning (e.g., "Insufficient amount").
   - Keep the existing payment method grid untouched.

3. **Print receipt**
   - In `printReceipt`, if `paymentMethodCode === "cash"`, append:
     - `Amount Tendered: ₹X.XX`
     - `Change Due: ₹X.XX`
   - These lines appear above the "Paid via" block.

4. **Behaviour**
   - No change to the settle flow — staff can still click **Print & Settle** even if tendered is blank or less than total (the field is informational, not blocking).
   - Auto-select the grand total value in the input as a placeholder or default so the cashier can overwrite it.

### Acceptance criteria
- Cash button selected → Amount Tendered input appears.
- Typing an amount → Change Due updates live.
- Cash receipt includes Amount Tendered and Change Due lines.
- Switching to non-cash payment → tendered input hides and resets.
