import { useEffect, useState } from "react";
import { Bike, Loader2, Download, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Item {
  id: string;
  name: string;
  selling_price: number;
  aggregator_out_of_stock: boolean;
  aggregator_out_of_stock_at: string | null;
}

const AggregatorStockOutPage = () => {
  const { toast } = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("menu_items")
      .select("id, name, selling_price, aggregator_out_of_stock, aggregator_out_of_stock_at")
      .eq("aggregator_out_of_stock", true)
      .order("aggregator_out_of_stock_at", { ascending: false });
    if (error) toast({ title: "Failed to load", description: error.message, variant: "destructive" });
    setItems((data as Item[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const markMirrored = async (id: string) => {
    const { error } = await supabase
      .from("menu_items")
      .update({ aggregator_out_of_stock: false, aggregator_out_of_stock_at: null })
      .eq("id", id);
    if (error) toast({ title: "Update failed", description: error.message, variant: "destructive" });
    else toast({ title: "Cleared", description: "Item removed from sync queue." });
    load();
  };

  const exportCsv = () => {
    const lines = ["Item,Price,Flagged At,Action"];
    for (const i of items) {
      lines.push([
        `"${i.name.replace(/"/g, '""')}"`,
        Number(i.selling_price).toFixed(2),
        i.aggregator_out_of_stock_at ? format(new Date(i.aggregator_out_of_stock_at), "yyyy-MM-dd HH:mm") : "",
        "Mark Out of Stock on Zomato/Swiggy",
      ].join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `aggregator-stockout-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bike className="h-6 w-6 text-primary" /> Aggregator Stock-Out Sync
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Items here have been auto-disabled in Blennix because their ingredients ran out. Mirror them on Zomato/Swiggy, then mark as synced.
          </p>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={items.length === 0}>
          <Download className="h-4 w-4 mr-2" /> Export CSV
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="py-16 text-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" /></div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            All clear — no menu items are currently flagged as out of stock for aggregators.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5">Item</th>
                <th className="text-right px-4 py-2.5">Price</th>
                <th className="text-left px-4 py-2.5">Flagged</th>
                <th className="text-right px-4 py-2.5">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} className="border-t border-border">
                  <td className="px-4 py-2.5 text-card-foreground">{i.name}</td>
                  <td className="px-4 py-2.5 text-right font-mono">₹{Number(i.selling_price).toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {i.aggregator_out_of_stock_at ? format(new Date(i.aggregator_out_of_stock_at), "PPp") : "-"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Button size="sm" variant="outline" onClick={() => markMirrored(i.id)}>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Mark synced
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default AggregatorStockOutPage;