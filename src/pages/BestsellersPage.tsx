import { Trophy, Clock, Star, TrendingUp } from "lucide-react";

interface DishPerformance {
  rank: number;
  name: string;
  category: string;
  unitsSold: number;
  revenue: number;
  avgPrepTime: number; // minutes
  rating: number;
  trend: "up" | "down" | "stable";
}

const mockBestsellers: DishPerformance[] = [
  { rank: 1, name: "Chicken Biryani", category: "Main Course", unitsSold: 142, revenue: 53960, avgPrepTime: 18, rating: 4.7, trend: "up" },
  { rank: 2, name: "Paneer Butter Masala", category: "Main Course", unitsSold: 118, revenue: 37760, avgPrepTime: 14, rating: 4.5, trend: "up" },
  { rank: 3, name: "Dal Tadka", category: "Main Course", unitsSold: 95, revenue: 20900, avgPrepTime: 10, rating: 4.3, trend: "stable" },
  { rank: 4, name: "Jeera Rice", category: "Sides", unitsSold: 89, revenue: 13350, avgPrepTime: 8, rating: 4.1, trend: "down" },
];

const deliveryPerformance = {
  avgPrepTime: 14,
  avgDeliveryTime: 28,
  onTimeRate: 87,
  zomatoAvg: 32,
  swiggyAvg: 30,
  dineInAvg: 12,
};

const BestsellersPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Bestsellers & Performance</h1>
        <p className="text-sm text-muted-foreground mt-1">Top dishes and delivery time analytics</p>
      </div>

      {/* Top dishes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {mockBestsellers.map((dish) => (
          <div key={dish.rank} className={`rounded-xl border bg-card p-5 ${dish.rank === 1 ? "border-primary/40" : "border-border"}`}>
            <div className="flex items-center justify-between mb-3">
              <span className={`text-xs font-bold uppercase tracking-wider ${dish.rank === 1 ? "text-primary" : "text-muted-foreground"}`}>
                #{dish.rank}
              </span>
              {dish.rank === 1 && <Trophy className="h-4 w-4 text-primary" />}
              {dish.trend === "up" && <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />}
            </div>
            <h3 className="text-sm font-semibold text-card-foreground">{dish.name}</h3>
            <p className="text-xs text-muted-foreground">{dish.category}</p>
            <div className="mt-3 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Units Sold</span>
                <span className="font-mono font-semibold text-card-foreground">{dish.unitsSold}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Revenue</span>
                <span className="font-mono font-semibold text-card-foreground">₹{dish.revenue.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Avg Prep</span>
                <span className="font-mono text-card-foreground">{dish.avgPrepTime} min</span>
              </div>
              <div className="flex justify-between text-xs items-center">
                <span className="text-muted-foreground">Rating</span>
                <span className="flex items-center gap-0.5 font-mono text-card-foreground">
                  <Star className="h-3 w-3 text-amber-500 fill-amber-500" />{dish.rating}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Delivery Performance */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-5 w-5 text-primary" />
          <h2 className="text-sm font-semibold text-card-foreground">Delivery Time Performance</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Avg Prep Time</p>
            <p className="text-xl font-bold font-mono text-card-foreground mt-1">{deliveryPerformance.avgPrepTime} min</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Avg Delivery</p>
            <p className="text-xl font-bold font-mono text-card-foreground mt-1">{deliveryPerformance.avgDeliveryTime} min</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">On-Time Rate</p>
            <p className="text-xl font-bold font-mono text-emerald-600 mt-1">{deliveryPerformance.onTimeRate}%</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Zomato Avg</p>
            <p className="text-xl font-bold font-mono text-card-foreground mt-1">{deliveryPerformance.zomatoAvg} min</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Swiggy Avg</p>
            <p className="text-xl font-bold font-mono text-card-foreground mt-1">{deliveryPerformance.swiggyAvg} min</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Dine-in Avg</p>
            <p className="text-xl font-bold font-mono text-card-foreground mt-1">{deliveryPerformance.dineInAvg} min</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BestsellersPage;
