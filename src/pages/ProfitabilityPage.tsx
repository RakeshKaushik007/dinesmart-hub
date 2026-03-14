import { TrendingUp, Target, IndianRupee, ArrowUpRight, ArrowDownRight } from "lucide-react";

const weeklyData = [
  { day: "Mon", revenue: 24500, cost: 9800, profit: 14700 },
  { day: "Tue", revenue: 21200, cost: 8480, profit: 12720 },
  { day: "Wed", revenue: 26800, cost: 10720, profit: 16080 },
  { day: "Thu", revenue: 23100, cost: 9240, profit: 13860 },
  { day: "Fri", revenue: 31500, cost: 12600, profit: 18900 },
  { day: "Sat", revenue: 35200, cost: 14080, profit: 21120 },
  { day: "Sun", revenue: 28450, cost: 11380, profit: 17070 },
];

const fixedCosts = {
  rent: 45000,
  salaries: 120000,
  utilities: 15000,
  misc: 10000,
  total: 190000,
};

const totalRevenue = weeklyData.reduce((s, d) => s + d.revenue, 0);
const totalProfit = weeklyData.reduce((s, d) => s + d.profit, 0);
const dailyFixedCost = fixedCosts.total / 30;
const breakeven = fixedCosts.total;
const monthlyRevenueSoFar = totalRevenue; // simplified
const breakevenProgress = Math.min((monthlyRevenueSoFar / breakeven) * 100, 100);

const ProfitabilityPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Profitability & Breakeven</h1>
        <p className="text-sm text-muted-foreground mt-1">Track daily sales against fixed costs</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Weekly Revenue</p>
          <p className="mt-2 text-2xl font-bold text-card-foreground font-mono">₹{totalRevenue.toLocaleString()}</p>
          <p className="text-xs text-emerald-600 flex items-center gap-0.5 mt-1"><ArrowUpRight className="h-3 w-3" />12% vs last week</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Weekly Profit</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600 font-mono">₹{totalProfit.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Profit Margin</p>
          <p className="mt-2 text-2xl font-bold text-card-foreground font-mono">{((totalProfit / totalRevenue) * 100).toFixed(1)}%</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Daily Fixed Cost</p>
          <p className="mt-2 text-2xl font-bold text-card-foreground font-mono">₹{Math.round(dailyFixedCost).toLocaleString()}</p>
        </div>
      </div>

      {/* Breakeven Tracker */}
      <div className="rounded-xl border border-primary/30 bg-card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <h2 className="text-sm font-semibold text-card-foreground">Monthly Breakeven Progress</h2>
          </div>
          <span className="text-sm font-mono text-muted-foreground">₹{monthlyRevenueSoFar.toLocaleString()} / ₹{breakeven.toLocaleString()}</span>
        </div>
        <div className="w-full h-4 rounded-full bg-secondary overflow-hidden">
          <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${breakevenProgress}%` }} />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {breakevenProgress >= 100 ? "✅ Breakeven reached! You're in profit." : `${breakevenProgress.toFixed(0)}% — ₹${(breakeven - monthlyRevenueSoFar).toLocaleString()} remaining`}
        </p>
      </div>

      {/* Daily breakdown */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-card-foreground">Daily Breakdown (This Week)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wider">
                <th className="text-left px-5 py-3 font-medium">Day</th>
                <th className="text-right px-5 py-3 font-medium">Revenue</th>
                <th className="text-right px-5 py-3 font-medium">Cost</th>
                <th className="text-right px-5 py-3 font-medium">Profit</th>
                <th className="text-right px-5 py-3 font-medium hidden sm:table-cell">Margin</th>
                <th className="text-left px-5 py-3 font-medium hidden sm:table-cell">vs Fixed</th>
              </tr>
            </thead>
            <tbody>
              {weeklyData.map((day) => {
                const netAfterFixed = day.profit - dailyFixedCost;
                return (
                  <tr key={day.day} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-card-foreground">{day.day}</td>
                    <td className="px-5 py-3.5 text-right font-mono">₹{day.revenue.toLocaleString()}</td>
                    <td className="px-5 py-3.5 text-right font-mono text-muted-foreground">₹{day.cost.toLocaleString()}</td>
                    <td className="px-5 py-3.5 text-right font-mono font-semibold text-emerald-600">₹{day.profit.toLocaleString()}</td>
                    <td className="px-5 py-3.5 text-right font-mono hidden sm:table-cell">{((day.profit / day.revenue) * 100).toFixed(0)}%</td>
                    <td className="px-5 py-3.5 hidden sm:table-cell">
                      <span className={`text-xs font-mono font-semibold ${netAfterFixed >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                        {netAfterFixed >= 0 ? "+" : ""}₹{Math.round(netAfterFixed).toLocaleString()}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fixed costs breakdown */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-card-foreground mb-4">Monthly Fixed Costs</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Object.entries(fixedCosts).filter(([k]) => k !== "total").map(([key, val]) => (
            <div key={key}>
              <p className="text-xs text-muted-foreground capitalize">{key}</p>
              <p className="text-sm font-bold font-mono text-card-foreground mt-1">₹{val.toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProfitabilityPage;
