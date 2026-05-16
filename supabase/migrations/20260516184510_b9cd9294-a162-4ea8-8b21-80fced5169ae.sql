DROP TRIGGER IF EXISTS trg_deduct_inventory_on_complete ON public.orders;
DROP TRIGGER IF EXISTS trg_deduct_inventory_on_order_complete ON public.orders;
-- Keep only trg_deduct_inventory (the canonical one defined in the latest migration)