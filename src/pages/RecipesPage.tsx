import { ChefHat, AlertCircle, TrendingUp, Plus, UtensilsCrossed } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { recipes, ingredients } from "@/data/mockInventory";

const getIngredientName = (id: string) => ingredients.find((i) => i.id === id)?.name ?? "Unknown";
const getIngredientStatus = (id: string) => ingredients.find((i) => i.id === id)?.status ?? "good";

const RecipesPage = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Recipes</h1>
          <p className="text-sm text-muted-foreground mt-1">Micro-level ingredient breakdown per dish</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/menu-management")}>
            <UtensilsCrossed className="mr-2 h-4 w-4" /> Menu
          </Button>
          <Button onClick={() => navigate("/menu-management")}>
            <Plus className="mr-2 h-4 w-4" /> Add Recipe
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {recipes.map((recipe) => {
          const margin = ((recipe.sellingPrice - recipe.costPrice) / recipe.sellingPrice * 100).toFixed(1);
          const hasUnavailableIngredient = recipe.ingredients.some(
            (ri) => getIngredientStatus(ri.ingredientId) === "out"
          );

          return (
            <div key={recipe.id} className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-secondary flex items-center justify-center">
                    <ChefHat className="h-4 w-4 text-secondary-foreground" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-card-foreground">{recipe.dishName}</h3>
                    <p className="text-xs text-muted-foreground">{recipe.category}</p>
                  </div>
                </div>
                {hasUnavailableIngredient && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-stock-out bg-stock-out/10 rounded-full px-2.5 py-1">
                    <AlertCircle className="h-3 w-3" />
                    Unavailable
                  </span>
                )}
              </div>

              <div className="px-5 py-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex gap-6">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Selling</p>
                      <p className="text-lg font-bold font-mono text-card-foreground">₹{recipe.sellingPrice}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Cost</p>
                      <p className="text-lg font-bold font-mono text-muted-foreground">₹{recipe.costPrice}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-stock-good">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-sm font-bold font-mono">{margin}%</span>
                    <span className="text-[10px] text-muted-foreground ml-1">margin</span>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Ingredients</p>
                  <div className="space-y-1.5">
                    {recipe.ingredients.map((ri) => {
                      const status = getIngredientStatus(ri.ingredientId);
                      const isOut = status === "out";
                      return (
                        <div
                          key={ri.ingredientId}
                          className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${
                            isOut ? "bg-stock-out/5 border border-stock-out/20" : "bg-muted/30"
                          }`}
                        >
                          <span className={isOut ? "text-stock-out font-medium" : "text-card-foreground"}>
                            {getIngredientName(ri.ingredientId)}
                          </span>
                          <span className="font-mono text-muted-foreground">
                            {ri.quantity} {ri.unit}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RecipesPage;
