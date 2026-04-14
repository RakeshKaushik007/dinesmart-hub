import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Download, Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";

type ImportType = "menu_categories" | "menu_items" | "ingredients";

interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

const TEMPLATES: Record<ImportType, { headers: string[]; sample: string[][]; description: string; label: string }> = {
  menu_categories: {
    label: "Menu Categories",
    description: "Categories like Starters, Main Course, Beverages, etc.",
    headers: ["name", "is_active"],
    sample: [
      ["Starters", "true"],
      ["Main Course", "true"],
      ["Beverages", "true"],
      ["Desserts", "true"],
    ],
  },
  menu_items: {
    label: "Menu Items",
    description: "Individual dishes with prices. Category name must match an existing category.",
    headers: ["name", "description", "selling_price", "cost_price", "category_name", "prep_time_minutes", "is_active", "is_available"],
    sample: [
      ["Paneer Tikka", "Grilled cottage cheese with spices", "280", "90", "Starters", "15", "true", "true"],
      ["Butter Chicken", "Creamy tomato-based curry", "350", "120", "Main Course", "20", "true", "true"],
      ["Masala Chai", "Indian spiced tea", "40", "8", "Beverages", "5", "true", "true"],
    ],
  },
  ingredients: {
    label: "Ingredients / Inventory",
    description: "Raw materials with stock levels and thresholds for alerts.",
    headers: ["name", "category", "current_stock", "unit", "min_threshold", "cost_per_unit", "expiry_date"],
    sample: [
      ["Paneer", "Dairy", "10", "kg", "3", "320", "2025-02-15"],
      ["Chicken", "Meat", "15", "kg", "5", "220", "2025-01-20"],
      ["Onion", "Vegetables", "25", "kg", "8", "40", ""],
      ["Basmati Rice", "Grains", "50", "kg", "10", "85", ""],
      ["Cooking Oil", "Oils", "20", "litre", "5", "150", ""],
    ],
  },
};

const downloadCSV = (type: ImportType) => {
  const tmpl = TEMPLATES[type];
  const rows = [tmpl.headers.join(","), ...tmpl.sample.map(r => r.join(","))];
  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${type}_template.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

const parseCSV = (text: string): string[][] => {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  return lines.map(line => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes; continue; }
      if (char === "," && !inQuotes) { result.push(current.trim()); current = ""; continue; }
      current += char;
    }
    result.push(current.trim());
    return result;
  });
};

const DataImportPage = () => {
  const { toast } = useToast();
  const [importing, setImporting] = useState<ImportType | null>(null);
  const [results, setResults] = useState<Record<string, ImportResult>>({});
  const fileRefs: Record<ImportType, React.RefObject<HTMLInputElement>> = {
    menu_categories: useRef<HTMLInputElement>(null),
    menu_items: useRef<HTMLInputElement>(null),
    ingredients: useRef<HTMLInputElement>(null),
  };

  const handleImport = async (type: ImportType, file: File) => {
    setImporting(type);
    const text = await file.text();
    const rows = parseCSV(text);
    if (rows.length < 2) {
      toast({ title: "Empty file", description: "CSV must have a header row and at least one data row", variant: "destructive" });
      setImporting(null);
      return;
    }

    const headers = rows[0].map(h => h.toLowerCase().trim());
    const dataRows = rows.slice(1);
    const result: ImportResult = { success: 0, failed: 0, errors: [] };

    try {
      if (type === "menu_categories") {
        await importCategories(headers, dataRows, result);
      } else if (type === "menu_items") {
        await importMenuItems(headers, dataRows, result);
      } else {
        await importIngredients(headers, dataRows, result);
      }
    } catch (e: any) {
      result.errors.push(`Unexpected error: ${e.message}`);
    }

    setResults(prev => ({ ...prev, [type]: result }));
    setImporting(null);
    toast({
      title: `Import complete`,
      description: `${result.success} imported, ${result.failed} failed`,
      variant: result.failed > 0 ? "destructive" : "default",
    });
  };

  const importCategories = async (headers: string[], rows: string[][], result: ImportResult) => {
    const nameIdx = headers.indexOf("name");
    const activeIdx = headers.indexOf("is_active");
    if (nameIdx === -1) { result.errors.push("Missing 'name' column"); result.failed = rows.length; return; }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const name = row[nameIdx];
      if (!name) { result.errors.push(`Row ${i + 2}: empty name`); result.failed++; continue; }
      const { error } = await supabase.from("menu_categories").insert({
        name,
        is_active: activeIdx >= 0 ? row[activeIdx]?.toLowerCase() !== "false" : true,
        sort_order: i,
      });
      if (error) { result.errors.push(`Row ${i + 2} "${name}": ${error.message}`); result.failed++; }
      else result.success++;
    }
  };

  const importMenuItems = async (headers: string[], rows: string[][], result: ImportResult) => {
    const cols = ["name", "description", "selling_price", "cost_price", "category_name", "prep_time_minutes", "is_active", "is_available"];
    const idx: Record<string, number> = {};
    cols.forEach(c => { idx[c] = headers.indexOf(c); });
    if (idx.name === -1) { result.errors.push("Missing 'name' column"); result.failed = rows.length; return; }

    // Fetch categories for mapping
    const { data: cats } = await supabase.from("menu_categories").select("id, name");
    const catMap = new Map((cats || []).map(c => [c.name.toLowerCase(), c.id]));

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const name = row[idx.name];
      if (!name) { result.errors.push(`Row ${i + 2}: empty name`); result.failed++; continue; }

      const catName = idx.category_name >= 0 ? row[idx.category_name] : "";
      const category_id = catName ? catMap.get(catName.toLowerCase()) || null : null;
      if (catName && !category_id) {
        result.errors.push(`Row ${i + 2} "${name}": category "${catName}" not found — imported without category`);
      }

      const { error } = await supabase.from("menu_items").insert({
        name,
        description: idx.description >= 0 ? row[idx.description] || null : null,
        selling_price: idx.selling_price >= 0 ? Number(row[idx.selling_price]) || 0 : 0,
        cost_price: idx.cost_price >= 0 ? Number(row[idx.cost_price]) || 0 : 0,
        category_id,
        prep_time_minutes: idx.prep_time_minutes >= 0 && row[idx.prep_time_minutes] ? Number(row[idx.prep_time_minutes]) : null,
        is_active: idx.is_active >= 0 ? row[idx.is_active]?.toLowerCase() !== "false" : true,
        is_available: idx.is_available >= 0 ? row[idx.is_available]?.toLowerCase() !== "false" : true,
      });
      if (error) { result.errors.push(`Row ${i + 2} "${name}": ${error.message}`); result.failed++; }
      else result.success++;
    }
  };

  const importIngredients = async (headers: string[], rows: string[][], result: ImportResult) => {
    const cols = ["name", "category", "current_stock", "unit", "min_threshold", "cost_per_unit", "expiry_date"];
    const idx: Record<string, number> = {};
    cols.forEach(c => { idx[c] = headers.indexOf(c); });
    if (idx.name === -1) { result.errors.push("Missing 'name' column"); result.failed = rows.length; return; }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const name = row[idx.name];
      if (!name) { result.errors.push(`Row ${i + 2}: empty name`); result.failed++; continue; }

      const { error } = await supabase.from("ingredients").insert({
        name,
        category: idx.category >= 0 ? row[idx.category] || null : null,
        current_stock: idx.current_stock >= 0 ? Number(row[idx.current_stock]) || 0 : 0,
        unit: idx.unit >= 0 && row[idx.unit] ? row[idx.unit] : "kg",
        min_threshold: idx.min_threshold >= 0 ? Number(row[idx.min_threshold]) || 0 : 0,
        cost_per_unit: idx.cost_per_unit >= 0 ? Number(row[idx.cost_per_unit]) || 0 : 0,
        expiry_date: idx.expiry_date >= 0 && row[idx.expiry_date] ? row[idx.expiry_date] : null,
        status: "good",
      });
      if (error) { result.errors.push(`Row ${i + 2} "${name}": ${error.message}`); result.failed++; }
      else result.success++;
    }
  };

  const renderImportCard = (type: ImportType) => {
    const tmpl = TEMPLATES[type];
    const res = results[type];
    const isImporting = importing === type;

    return (
      <Card key={type}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            {tmpl.label}
          </CardTitle>
          <CardDescription>{tmpl.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" size="sm" onClick={() => downloadCSV(type)}>
              <Download className="h-4 w-4 mr-1.5" /> Download Template
            </Button>
            <Button
              size="sm"
              disabled={isImporting}
              onClick={() => fileRefs[type].current?.click()}
            >
              {isImporting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Upload className="h-4 w-4 mr-1.5" />}
              {isImporting ? "Importing..." : "Upload CSV"}
            </Button>
            <input
              ref={fileRefs[type]}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) handleImport(type, f);
                e.target.value = "";
              }}
            />
          </div>

          {/* Preview columns */}
          <div className="text-xs text-muted-foreground">
            <span className="font-medium">Columns:</span> {tmpl.headers.join(", ")}
          </div>

          {/* Result */}
          {res && (
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-sm">
                {res.success > 0 && (
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle2 className="h-4 w-4" /> {res.success} imported
                  </span>
                )}
                {res.failed > 0 && (
                  <span className="flex items-center gap-1 text-destructive">
                    <AlertCircle className="h-4 w-4" /> {res.failed} failed
                  </span>
                )}
              </div>
              {res.errors.length > 0 && (
                <div className="max-h-32 overflow-y-auto text-xs bg-muted/50 rounded-lg p-2 space-y-0.5">
                  {res.errors.map((e, i) => (
                    <p key={i} className="text-destructive">{e}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Data Import</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Bulk upload your menu, prices, and inventory using CSV files
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>How it works:</strong> Download a CSV template → Fill in your data in Excel/Google Sheets → Upload the file. 
          Import categories first, then menu items (so items can be linked to categories).
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="step_by_step" className="w-full">
        <TabsList>
          <TabsTrigger value="step_by_step">Step-by-Step</TabsTrigger>
          <TabsTrigger value="all">All Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="step_by_step" className="space-y-4 mt-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</div>
            <span className="text-sm font-medium text-foreground">Upload Categories First</span>
          </div>
          {renderImportCard("menu_categories")}

          <div className="flex items-center gap-2 mb-2 mt-6">
            <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</div>
            <span className="text-sm font-medium text-foreground">Then Upload Menu Items</span>
          </div>
          {renderImportCard("menu_items")}

          <div className="flex items-center gap-2 mb-2 mt-6">
            <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">3</div>
            <span className="text-sm font-medium text-foreground">Upload Inventory / Ingredients</span>
          </div>
          {renderImportCard("ingredients")}
        </TabsContent>

        <TabsContent value="all" className="space-y-4 mt-4">
          {(["menu_categories", "menu_items", "ingredients"] as ImportType[]).map(renderImportCard)}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DataImportPage;
