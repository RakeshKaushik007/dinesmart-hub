import { supabase } from "@/integrations/supabase/client";

/**
 * Log wastage for a cancelled/refunded order item that was already prepared.
 * Looks up the menu item's recipe and inserts a wastage_logs entry per ingredient.
 * Returns the number of ingredient lines logged.
 */
export async function logWastageForPreparedItem(params: {
  menuItemId: string | null | undefined;
  itemQuantity: number;
  itemName: string;
  orderNumber: number;
  reason: "cancelled" | "refunded";
  reasonDetail?: string | null;
  loggedBy?: string | null;
  branchId?: string | null;
}): Promise<number> {
  const { menuItemId, itemQuantity, itemName, orderNumber, reason, reasonDetail, loggedBy, branchId } = params;
  if (!menuItemId || !itemQuantity) return 0;

  const { data: recipe } = await supabase
    .from("recipe_ingredients")
    .select("ingredient_id, quantity, unit")
    .eq("menu_item_id", menuItemId);

  if (!recipe || recipe.length === 0) return 0;

  const ingredientIds = recipe.map((r) => r.ingredient_id);
  const { data: ingredients } = await supabase
    .from("ingredients")
    .select("id, name, unit, cost_per_unit, category, branch_id, current_stock")
    .in("id", ingredientIds);

  if (!ingredients || ingredients.length === 0) return 0;

  const wastageRows = recipe
    .map((line) => {
      const ing = ingredients.find((i) => i.id === line.ingredient_id);
      if (!ing) return null;
      const qty = Number(line.quantity) * Number(itemQuantity);
      if (qty <= 0) return null;
      return {
        ingredient_id: ing.id,
        ingredient_name: ing.name,
        category: ing.category,
        quantity: qty,
        unit: line.unit || ing.unit,
        cost: qty * Number(ing.cost_per_unit || 0),
        reason: reason === "cancelled" ? "spoiled" : "discrepancy",
        notes: `Auto: ${reason === "cancelled" ? "Cancelled" : "Refunded"} prepared item "${itemName}" on order #${orderNumber}${reasonDetail ? ` — ${reasonDetail}` : ""}`,
        branch_id: branchId ?? ing.branch_id,
        logged_by: loggedBy ?? null,
      };
    })
    .filter(Boolean) as any[];

  if (wastageRows.length === 0) return 0;

  await supabase.from("wastage_logs").insert(wastageRows);

  // Also deduct prepared ingredients from current stock (since they were used up)
  await Promise.all(
    wastageRows.map(async (row) => {
      const ing = ingredients.find((i) => i.id === row.ingredient_id);
      if (!ing) return;
      const newStock = Math.max(0, Number(ing.current_stock || 0) - Number(row.quantity));
      await supabase
        .from("ingredients")
        .update({ current_stock: newStock, updated_at: new Date().toISOString() })
        .eq("id", ing.id);
    })
  );

  return wastageRows.length;
}