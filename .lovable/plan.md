

## Simplify Purchase Order Workflow

Streamline the PO creation form, remove status/notes fields, add expiry date per item, and ensure expiry flows into the ingredients table on receipt.

### Changes to Purchase Order Form (`PurchaseOrdersPage.tsx`)

**Fields kept (simplified):**
- Vendor Name (required)
- Vendor Phone (optional)
- Line items: Ingredient, Quantity, Unit, Unit Cost, **Expiry Date** (new, per item)

**Fields removed from the create form:**
- Status dropdown (auto-set, see below)
- Notes textarea
- Expected delivery date (already removed)

**New PO behavior:**
- On save, status is automatically set to `received` (since we no longer ask).
- `received_date` is set to today.
- Inventory is updated immediately via the existing `applyStockIn` helper.
- The per-item `expiry_date` is written to `ingredients.expiry_date` so the ingredient's expiry reflects the latest received batch.
- Ingredient `status` recompute will pick up the new expiry (already handled — sets to `expiring` if within 7 days).

### Database change

Add a nullable `expiry_date date` column to `purchase_order_items` so we can store per-line expiry without affecting existing rows.

```text
ALTER TABLE purchase_order_items
  ADD COLUMN expiry_date date;
```

No changes to `purchase_orders` table itself. The existing `status`, `notes`, `expected_date` columns stay in the schema (for backward compatibility with old POs) but are no longer surfaced in the create form.

### Inventory update logic (`applyStockIn`)

Update the helper so that when stocking in:
1. `current_stock` is incremented (existing).
2. `cost_per_unit` is updated to the latest PO unit cost (existing).
3. `last_restocked` set to now (existing).
4. **New:** `expiry_date` on the ingredient is updated to the line's expiry date (if provided).
5. `status` recomputed: `out` / `low` / `expiring` (≤7 days) / `good`.
6. Stock transaction logged with `type='in'` (existing).

### Existing POs

The "Mark as Received & Add to Stock" button on existing pending POs stays, but since old line items won't have an expiry, those items will just skip the expiry update (only stock + cost get updated).

### UI summary

PO list cards will no longer show notes or status badges prominently — just vendor, total, received date, and line items with their expiry dates. A small "Received" indicator stays so users know the inventory is already updated.

