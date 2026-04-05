## Phase 1: Billing Page Overhaul (Order & KOT)
1. **Billing Page** - Add Order Type selector (Dining/Takeaway), table picker for dining, KOT print on "Place Order"
2. **KOT Print** - Generate printable KOT with table/type, items, quantities (no prices)

## Phase 2: Checkout & Settlement
3. **Active Orders** - Add "Checkout" button on each active order → opens Checkout Modal
4. **Checkout Modal** - Shows bill with 5% GST, payment method selector (Cash/UPI/Card), "Print & Settle" button
5. **Receipt Print** - Generate printable receipt with items, taxes, total, payment method

## Phase 3: Table State Management
6. **Table status logic** - Decouple physical status from payment status: Occupied (red) → Paid but seated (yellow) → Available (green) only on manual "Clear Table"
7. **Tables Page** - Update UI to show paid-but-occupied state, add "Clear Table" action

## Phase 4: QR Code Menu
8. **Customer Order Page** - Ensure `/order/:tableId` shows full menu, cart, and order placement (already exists, verify it works)

## Phase 5: Security
9. Already implemented via RBAC - verify staff can't see financial analytics
