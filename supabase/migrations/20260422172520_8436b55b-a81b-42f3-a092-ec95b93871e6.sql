-- Recreate the trigger to ensure it's attached to the orders table
DROP TRIGGER IF EXISTS trg_deduct_inventory_on_complete ON public.orders;

CREATE TRIGGER trg_deduct_inventory_on_complete
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.deduct_inventory_on_order_complete();