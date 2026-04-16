import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  ChefHat,
  ShieldCheck,
  BarChart3,
  Smartphone,
  QrCode,
  Truck,
  ArrowRight,
  Store,
  Users,
  ClipboardList,
  Eye,
  EyeOff,
} from "lucide-react";

const features = [
  { icon: ClipboardList, title: "Smart Billing", desc: "Fast POS with keyboard shortcuts & category filters" },
  { icon: QrCode, title: "QR Table Ordering", desc: "Customers scan & order from their table — no app needed" },
  { icon: Truck, title: "Aggregator Orders", desc: "Swiggy & Zomato orders in one unified dashboard" },
  { icon: BarChart3, title: "Live Analytics", desc: "Real-time sales, profitability & shift performance" },
  { icon: ShieldCheck, title: "Role-Based Access", desc: "5-level RBAC: from employee to super admin" },
  { icon: Smartphone, title: "Self-Service Kiosk", desc: "Counter ordering mode for walk-in customers" },
];

const LoginPage = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) {
        toast({ title: "Signup failed", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Check your email", description: "We sent a confirmation link to verify your account." });
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast({ title: "Login failed", description: error.message, variant: "destructive" });
      } else {
        navigate("/");
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
              <ChefHat className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground tracking-tight">Blennix POS</span>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
            <Store className="h-4 w-4" />
            <span>Restaurant Management System</span>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero + Login */}
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center py-12 lg:py-20">
          {/* Left: Hero */}
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary">
              <Users className="h-3.5 w-3.5" />
              Multi-Branch Restaurant Platform
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-foreground tracking-tight leading-[1.1]">
              Run your restaurant
              <span className="text-primary block mt-1">smarter, not harder</span>
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-lg">
              From billing to kitchen display, QR ordering to aggregator management — everything your restaurant needs in one powerful system.
            </p>

            {/* QR Info Box */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-2 max-w-md">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <QrCode className="h-4 w-4 text-primary" />
                How QR Ordering Works
              </div>
              <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
                <li>Go to <strong>Tables</strong> page → click any table</li>
                <li>A unique QR code is auto-generated for that table</li>
                <li>Download or print the QR and paste it on the physical table</li>
                <li>Customers scan → browse menu → place order from phone</li>
                <li>Order appears in <strong>Kitchen Display</strong> & <strong>Active Orders</strong> instantly</li>
              </ol>
            </div>
          </div>

          {/* Right: Login Form */}
          <div className="w-full max-w-md mx-auto lg:mx-0 lg:ml-auto">
            <div className="rounded-2xl border border-border bg-card p-8 shadow-lg">
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-foreground">
                  {isSignUp ? "Create Account" : "Welcome Back"}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {isSignUp ? "Set up your restaurant account" : "Sign in to your dashboard"}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {isSignUp && (
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="John Doe" required />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Please wait..." : isSignUp ? "Create Account" : "Sign In"}
                  {!loading && <ArrowRight className="h-4 w-4 ml-2" />}
                </Button>
              </form>

              <p className="text-center text-sm text-muted-foreground mt-4">
                {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
                <button onClick={() => setIsSignUp(!isSignUp)} className="text-primary hover:underline font-medium">
                  {isSignUp ? "Sign in" : "Sign up"}
                </button>
              </p>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="border-t border-border py-16">
          <h2 className="text-center text-2xl font-bold text-foreground mb-10">Everything You Need</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div key={f.title} className="rounded-xl border border-border bg-card p-5 hover:border-primary/30 transition-colors">
                <div className="rounded-lg bg-primary/10 p-2.5 w-fit mb-3">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground">{f.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border py-8 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Blennix POS. Built for modern restaurants.
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
