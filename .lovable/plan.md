## Phase 1: Billing Page Overhaul (Order & KOT) ✅
1. **Billing Page** - Add Order Type selector (Dining/Takeaway), table picker for dining, KOT print on "Place Order"
2. **KOT Print** - Generate printable KOT with table/type, items, quantities (no prices)

## Phase 2: Checkout & Settlement ✅
3. **Active Orders** - Add "Checkout" button on each active order → opens Checkout Modal
4. **Checkout Modal** - Shows bill with 5% GST, payment method selector (Cash/UPI/Card), "Print & Settle" button
5. **Receipt Print** - Generate printable receipt with items, taxes, total, payment method

## Phase 3: Table State Management ✅
6. **Table status logic** - Decouple physical status from payment status
7. **Tables Page** - Update UI to show paid-but-occupied state, add "Clear Table" action

## Phase 4: QR Code Menu ✅
8. **Customer Order Page** - `/order/:tableId` shows full menu, cart, and order placement

## Phase 5: Security ✅
9. RBAC implemented - staff can't see financial analytics

## Phase 6: Advanced Operations ✅
10. **Void & NC Workflow** - Manager can void items (with reason code + PIN) and mark replacements as NC (₹0)
11. **Discount Management** - Flat or percentage discounts applied before GST calculation
12. **Service Charge Toggle** - Optional 5% service charge, toggleable by manager
13. **Aggregator Payments** - Zomato Pay, Swiggy Dineout, EazyDiner as separate partner payment methods
14. **Receipt Updates** - Receipts now show discounts, service charge, NC items, and aggregator payment labels
