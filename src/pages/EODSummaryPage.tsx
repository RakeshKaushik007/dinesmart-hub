import { CalendarDays, TrendingUp, ShoppingBag, IndianRupee, Users } from "lucide-react";

const todaySummary = {
  date: "2026-03-14",
  totalOrders: 47,
  totalRevenue: 28450,
  totalCost: 11380,
  grossProfit: 17070,
  avgOrderValue: 605,
  topDish: "Chicken Biryani",
  topDishCount: 18,
  paymentBreakdown: { cash: 8200, upi: 12500, card: 4250, online: 3500 },
  sourceBreakdown: { "dine-in": 22, zomato: 12, swiggy: 8, qr: 5 },
  peakHour: "1:00 PM – 2:00 PM",
  wastage: 830,
};

const EODSummaryPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">End of Day Summary</h1>
        <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5" />
          {new Date(todaySummary.date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Total Revenue</p>
          <p className="mt-2 text-2xl font-bold text-card-foreground font-mono">₹{todaySummary.totalRevenue.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Gross Profit</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600 font-mono">₹{todaySummary.grossProfit.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Orders</p>
          <p className="mt-2 text-2xl font-bold text-card-foreground font-mono">{todaySummary.totalOrders}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Avg Order Value</p>
          <p className="mt-2 text-2xl font-bold text-card-foreground font-mono">₹{todaySummary.avgOrderValue}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Breakdown */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-card-foreground mb-4">Payment Breakdown</h2>
          <div className="space-y-3">
            {Object.entries(todaySummary.paymentBreakdown).map(([mode, amount]) => (
              <div key={mode} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground capitalize">{mode}</span>
                <div className="flex items-center gap-3">
                  <div className="w-32 h-2 rounded-full bg-secondary overflow-hidden hidden sm:block">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(amount / todaySummary.totalRevenue) * 100}%` }} />
                  </div>
                  <span className="text-sm font-mono font-semibold text-card-foreground w-20 text-right">₹{amount.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Source Breakdown */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-card-foreground mb-4">Order Sources</h2>
          <div className="space-y-3">
            {Object.entries(todaySummary.sourceBreakdown).map(([source, count]) => (
              <div key={source} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground capitalize">{source}</span>
                <div className="flex items-center gap-3">
                  <div className="w-32 h-2 rounded-full bg-secondary overflow-hidden hidden sm:block">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(count / todaySummary.totalOrders) * 100}%` }} />
                  </div>
                  <span className="text-sm font-mono font-semibold text-card-foreground w-16 text-right">{count} orders</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Highlights */}
        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-card-foreground mb-4">Day Highlights</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Bestseller</p>
              <p className="text-sm font-semibold text-card-foreground mt-1">{todaySummary.topDish}</p>
              <p className="text-xs text-muted-foreground">{todaySummary.topDishCount} sold</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Peak Hour</p>
              <p className="text-sm font-semibold text-card-foreground mt-1">{todaySummary.peakHour}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Costs</p>
              <p className="text-sm font-semibold text-card-foreground mt-1 font-mono">₹{todaySummary.totalCost.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Wastage Loss</p>
              <p className="text-sm font-semibold text-destructive mt-1 font-mono">₹{todaySummary.wastage}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EODSummaryPage;
