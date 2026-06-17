CREATE OR REPLACE FUNCTION public.disable_menu_items_on_stockout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Auto-disable on stockout intentionally removed: items remain available
  -- even when stock is zero/negative (negative balances are allowed and
  -- backfilled via PO receive).
  RETURN NEW;
END;
$function$;

-- Re-enable any items that were previously auto-marked unavailable due to stockout
UPDATE public.menu_items
SET is_available = true,
    aggregator_out_of_stock = false,
    aggregator_out_of_stock_at = NULL,
    updated_at = now()
WHERE is_available = false;