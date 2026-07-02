import { useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Download, Upload, FileSpreadsheet, TrendingUp, IndianRupee, ShoppingCart, Trophy, Info, RotateCcw } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";

interface SalesRow {
  date: string;
  item_name: string;
  category: string;
  quantity: number;
  unit_price: number;
  total: number;
}

const TEMPLATE_HEADERS = ["date", "item_name", "category", "quantity", "unit_price", "total"];
const TEMPLATE_SAMPLE: string[][] = [
  ["2026-06-01", "Paneer Tikka", "Starters", "3", "280", "840"],
  ["2026-06-01", "Butter Chicken", "Main Course", "2", "350", "700"],
  ["2026-06-01", "Masala Chai", "Beverages", "5", "40", "200"],
  ["2026-06-02", "Paneer Tikka", "Starters", "4", "280", "1120"],
  ["2026-06-02", "Gulab Jamun", "Desserts", "6", "80", "480"],
  ["2026-06-03", "Butter Chicken", "Main Course", "3", "350", "1050"],
  ["2026-06-03", "Masala Chai", "Beverages", "8", "40", "320"],
];

const CHART_COLORS = ["hsl(var(--primary))", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"];

const downloadTemplate = () => {
  const rows = [TEMPLATE_HEADERS.join(","), ...TEMPLATE_SAMPLE.map((r) => r.join(","))];
  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "sales_template.csv";
  a.click();
  URL.revokeObjectURL(url);
};

const parseCSV = (text: string): string[][] => {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  return lines.map((line) => {
    const out: string[] = [];
    let cur = "";
    let q = false;
    for (const c of line) {
      if (c === '"') { q = !q; continue; }
      if (c === "," && !q) { out.push(cur.trim()); cur = ""; continue; }
      cur += c;
    }
    out.push(cur.trim());
    return out;
  });
};

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export default function SalesImportPage() {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<SalesRow[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [errors, setErrors] = useState<string[]>([]);

  const handleFile = async (file: File) => {
    const text = await file.text();
    const parsed = parseCSV(text);
    if (parsed.length < 2) {
      toast({ title: "Empty file", description: "No data rows found.", variant: "destructive" });
      return;
    }
    const headers = parsed[0].map((h) => h.toLowerCase());
    const need = TEMPLATE_HEADERS.filter((h) => !headers.includes(h));
    if (need.length) {
      toast({ title: "Invalid template", description: `Missing columns: ${need.join(", ")}`, variant: "destructive" });
      return;
    }
    const idx = Object.fromEntries(TEMPLATE_HEADERS.map((h) => [h, headers.indexOf(h)]));
    const errs: string[] = [];
    const data: SalesRow[] = [];
    for (let i = 1; i < parsed.length; i++) {
      const r = parsed[i];
      const qty = Number(r[idx.quantity]);
      const unit = Number(r[idx.unit_price]);
      const totalRaw = Number(r[idx.total]);
      const total = Number.isFinite(totalRaw) && totalRaw > 0 ? totalRaw : qty * unit;
      if (!r[idx.date] || !r[idx.item_name] || !Number.isFinite(qty) || !Number.isFinite(unit)) {
        errs.push(`Row ${i + 1}: invalid data`);
        continue;
      }
      data.push({
        date: r[idx.date],
        item_name: r[idx.item_name],
        category: r[idx.category] || "Uncategorized",
        quantity: qty,
        unit_price: unit,
        total,
      });
    }
    setRows(data);
    setErrors(errs);
    setFileName(file.name);
    toast({ title: "Import complete", description: `${data.length} rows loaded${errs.length ? `, ${errs.length} skipped` : ""}.` });
  };

  const insights = useMemo(() => {
    if (!rows.length) return null;
    const totalRevenue = rows.reduce((s, r) => s + r.total, 0);
    const totalUnits = rows.reduce((s, r) => s + r.quantity, 0);
    const uniqueDays = new Set(rows.map((r) => r.date)).size;
    const avgDaily = totalRevenue / Math.max(uniqueDays, 1);

    const byItem = new Map<string, { revenue: number; units: number }>();
    rows.forEach((r) => {
      const cur = byItem.get(r.item_name) || { revenue: 0, units: 0 };
      cur.revenue += r.total;
      cur.units += r.quantity;
      byItem.set(r.item_name, cur);
    });
    const topItems = [...byItem.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    const byDay = new Map<string, number>();
    rows.forEach((r) => byDay.set(r.date, (byDay.get(r.date) || 0) + r.total));
    const daily = [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, revenue]) => ({ date, revenue }));

    const byCat = new Map<string, number>();
    rows.forEach((r) => byCat.set(r.category, (byCat.get(r.category) || 0) + r.total));
    const categories = [...byCat.entries()].map(([name, value]) => ({ name, value }));

    return { totalRevenue, totalUnits, uniqueDays, avgDaily, topItems, daily, categories };
  }, [rows]);

  const reset = () => {
    setRows([]);
    setErrors([]);
    setFileName("");
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Sales Data Import</h1>
        <p className="text-muted-foreground mt-1">
          Kickstart insights for a new restaurant by uploading historical sales in our template format.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" /> Step 1 — Download Template
          </CardTitle>
          <CardDescription>
            Use this CSV as-is. Columns: {TEMPLATE_HEADERS.join(", ")}.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button onClick={downloadTemplate} className="gap-2">
            <Download className="h-4 w-4" /> Download sales_template.csv
          </Button>
          <Alert className="flex-1 min-w-[280px]">
            <Info className="h-4 w-4" />
            <AlertDescription>
              Dates in <code>YYYY-MM-DD</code>. If <code>total</code> is blank we'll compute it from <code>quantity × unit_price</code>.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" /> Step 2 — Upload Filled File
          </CardTitle>
          <CardDescription>We'll parse it locally and generate insights instantly.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="block text-sm file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          {fileName && (
            <>
              <span className="text-sm text-muted-foreground">Loaded: <strong>{fileName}</strong></span>
              <Button variant="outline" size="sm" onClick={reset} className="gap-2">
                <RotateCcw className="h-4 w-4" /> Reset
              </Button>
            </>
          )}
          {errors.length > 0 && (
            <Alert variant="destructive" className="w-full">
              <AlertDescription>{errors.length} row(s) were skipped due to invalid data.</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {insights && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <KPI icon={<IndianRupee className="h-4 w-4" />} label="Total Revenue" value={inr(insights.totalRevenue)} />
            <KPI icon={<ShoppingCart className="h-4 w-4" />} label="Units Sold" value={insights.totalUnits.toLocaleString()} />
            <KPI icon={<TrendingUp className="h-4 w-4" />} label="Avg Daily Revenue" value={inr(insights.avgDaily)} />
            <KPI icon={<Trophy className="h-4 w-4" />} label="Days Covered" value={String(insights.uniqueDays)} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Daily Revenue Trend</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={insights.daily}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
                    <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Revenue by Category</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={insights.categories} dataKey="value" nameKey="name" outerRadius={90} label>
                      {insights.categories.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Top 5 Items by Revenue</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={insights.topItems} layout="vertical" margin={{ left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} width={120} />
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Imported Rows Preview</CardTitle>
              <CardDescription>Showing first 20 of {rows.length} rows.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 20).map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>{r.date}</TableCell>
                      <TableCell className="font-medium">{r.item_name}</TableCell>
                      <TableCell>{r.category}</TableCell>
                      <TableCell className="text-right">{r.quantity}</TableCell>
                      <TableCell className="text-right">{inr(r.unit_price)}</TableCell>
                      <TableCell className="text-right font-semibold">{inr(r.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function KPI({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          {icon} {label}
        </div>
        <div className="text-2xl font-bold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}