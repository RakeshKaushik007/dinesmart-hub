## Remove the "Phone" filter from Active Orders

In `src/pages/ActiveOrdersPage.tsx`, the filter chips row is hard-coded as:

```ts
["all", "pos", "zomato", "swiggy", "qr", "phone"]
```

### Change
Drop `"phone"` from that array so the chip no longer renders. Also remove the now-unused `phone` entry from the `sourceStyles` map for cleanliness.

### Out of scope (not changing)
- The `order_source` column / DB enum — existing phone-tagged orders (if any) will still load under "All Sources"; we're only hiding the filter chip.
- Kitchen Display, Order History, and aggregator pages — they don't expose a phone filter.

### Files touched
- `src/pages/ActiveOrdersPage.tsx` (2 small edits)
