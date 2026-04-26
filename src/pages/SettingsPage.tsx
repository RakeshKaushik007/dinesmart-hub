import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/use-theme";
import { toast } from "sonner";
import {
  Settings, Store, Receipt, User, Bell, Palette, Save, Loader2, Building2, Phone, MapPin, Mail, Percent, Globe, Clock,
} from "lucide-react";
import { Bot, ShieldCheck } from "lucide-react";
import { useFloatingAISetting } from "@/hooks/useFloatingAISetting";

const SettingsPage = () => {
  const { profile, user, isAtLeast, hasRole } = useAuth();
  const { theme, toggle } = useTheme();
  const isSuperAdmin = hasRole("super_admin");
  const { enabled: floatingAIEnabled, saving: savingFloatingAI, setEnabled: setFloatingAIEnabled } = useFloatingAISetting();
  const [activeTab, setActiveTab] = useState("profile");
  const [saving, setSaving] = useState(false);

  // Profile
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  // Restaurant (owner+)
  const [restaurantName, setRestaurantName] = useState("Blennix Restaurant");
  const [restaurantPhone, setRestaurantPhone] = useState("");
  const [restaurantAddress, setRestaurantAddress] = useState("");
  const [currency, setCurrency] = useState("₹");
  const [taxRate, setTaxRate] = useState("5");
  const [taxLabel, setTaxLabel] = useState("GST");
  const [timeZone, setTimeZone] = useState("Asia/Kolkata");

  // Notifications
  const [lowStockAlert, setLowStockAlert] = useState(true);
  const [newOrderSound, setNewOrderSound] = useState(true);
  const [dailySummaryEmail, setDailySummaryEmail] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
    }
    loadProfile();
  }, [profile]);

  const loadProfile = async () => {
    if (!user) return;
    const { data } = await supabase.from("profiles").select("full_name, phone").eq("user_id", user.id).single();
    if (data) {
      setFullName(data.full_name || "");
      setPhone(data.phone || "");
    }
  };

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ full_name: fullName, phone }).eq("user_id", user.id);
    setSaving(false);
    if (error) toast.error("Failed to save profile");
    else toast.success("Profile updated!");
  };

  const saveRestaurant = async () => {
    setSaving(true);
    // Save to localStorage for now (could be a settings table)
    localStorage.setItem("blennix_settings", JSON.stringify({
      restaurantName, restaurantPhone, restaurantAddress, currency, taxRate, taxLabel, timeZone,
    }));
    setSaving(false);
    toast.success("Restaurant settings saved!");
  };

  const saveNotifications = () => {
    localStorage.setItem("blennix_notifications", JSON.stringify({
      lowStockAlert, newOrderSound, dailySummaryEmail,
    }));
    toast.success("Notification preferences saved!");
  };

  useEffect(() => {
    const saved = localStorage.getItem("blennix_settings");
    if (saved) {
      const s = JSON.parse(saved);
      setRestaurantName(s.restaurantName || "Blennix Restaurant");
      setRestaurantPhone(s.restaurantPhone || "");
      setRestaurantAddress(s.restaurantAddress || "");
      setCurrency(s.currency || "₹");
      setTaxRate(s.taxRate || "5");
      setTaxLabel(s.taxLabel || "GST");
      setTimeZone(s.timeZone || "Asia/Kolkata");
    }
    const notif = localStorage.getItem("blennix_notifications");
    if (notif) {
      const n = JSON.parse(notif);
      setLowStockAlert(n.lowStockAlert ?? true);
      setNewOrderSound(n.newOrderSound ?? true);
      setDailySummaryEmail(n.dailySummaryEmail ?? false);
    }
  }, []);

  const tabs = [
    { id: "profile", label: "Profile", icon: User },
    ...(isAtLeast("owner") ? [{ id: "restaurant", label: "Restaurant", icon: Store }] : []),
    ...(isAtLeast("branch_manager") ? [{ id: "billing", label: "Tax & Billing", icon: Receipt }] : []),
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "appearance", label: "Appearance", icon: Palette },
    ...(isSuperAdmin ? [{ id: "platform", label: "Platform", icon: ShieldCheck }] : []),
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your account and restaurant preferences</p>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar Tabs */}
        <div className="w-48 shrink-0 space-y-1">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}>
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 bg-card border border-border rounded-xl p-6">
          {activeTab === "profile" && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-card-foreground">Profile Settings</h2>
              <p className="text-sm text-muted-foreground">Update your personal information</p>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-1.5">Email</label>
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-muted text-muted-foreground text-sm">
                    <Mail className="h-4 w-4" />
                    {user?.email || "—"}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-1.5">Full Name</label>
                  <input value={fullName} onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-primary/30 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-1.5">Phone</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210"
                      className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-primary/30 outline-none" />
                  </div>
                </div>
                <button onClick={saveProfile} disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Profile
                </button>
              </div>
            </div>
          )}

          {activeTab === "restaurant" && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-card-foreground">Restaurant Settings</h2>
              <p className="text-sm text-muted-foreground">Configure your restaurant details</p>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-1.5">Restaurant Name</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input value={restaurantName} onChange={(e) => setRestaurantName(e.target.value)}
                      className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-primary/30 outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-1.5">Phone</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input value={restaurantPhone} onChange={(e) => setRestaurantPhone(e.target.value)} placeholder="+91 98765 43210"
                      className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-primary/30 outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-1.5">Address</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <textarea value={restaurantAddress} onChange={(e) => setRestaurantAddress(e.target.value)} rows={2}
                      className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-primary/30 outline-none resize-none" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-card-foreground mb-1.5">Currency</label>
                    <select value={currency} onChange={(e) => setCurrency(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-primary/30 outline-none">
                      <option value="₹">₹ INR</option>
                      <option value="$">$ USD</option>
                      <option value="€">€ EUR</option>
                      <option value="£">£ GBP</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-card-foreground mb-1.5">Timezone</label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <select value={timeZone} onChange={(e) => setTimeZone(e.target.value)}
                        className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-primary/30 outline-none">
                        <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                        <option value="America/New_York">America/New_York (EST)</option>
                        <option value="Europe/London">Europe/London (GMT)</option>
                        <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                      </select>
                    </div>
                  </div>
                </div>
                <button onClick={saveRestaurant} disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Restaurant
                </button>
              </div>
            </div>
          )}

          {activeTab === "billing" && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-card-foreground">Tax & Billing</h2>
              <p className="text-sm text-muted-foreground">Configure tax rates and billing defaults</p>
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-card-foreground mb-1.5">Tax Label</label>
                    <input value={taxLabel} onChange={(e) => setTaxLabel(e.target.value)} placeholder="GST"
                      className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-primary/30 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-card-foreground mb-1.5">Tax Rate (%)</label>
                    <div className="relative">
                      <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input type="number" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} min="0" max="50" step="0.5"
                        className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-primary/30 outline-none" />
                    </div>
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 border border-border">
                  <h3 className="text-sm font-medium text-card-foreground mb-2">Preview</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{currency}1,000.00</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>{taxLabel} ({taxRate}%)</span><span>{currency}{(1000 * Number(taxRate) / 100).toFixed(2)}</span></div>
                    <div className="flex justify-between font-semibold text-card-foreground border-t border-border pt-1 mt-1"><span>Total</span><span>{currency}{(1000 * (1 + Number(taxRate) / 100)).toFixed(2)}</span></div>
                  </div>
                </div>
                <button onClick={saveRestaurant} disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Tax Settings
                </button>
              </div>
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-card-foreground">Notifications</h2>
              <p className="text-sm text-muted-foreground">Configure alert preferences</p>
              <div className="space-y-3 pt-2">
                {[
                  { label: "Low stock alerts", desc: "Get notified when ingredients fall below threshold", value: lowStockAlert, set: setLowStockAlert },
                  { label: "New order sound", desc: "Play a sound when a new order arrives", value: newOrderSound, set: setNewOrderSound },
                  { label: "Daily summary email", desc: "Receive an end-of-day summary via email", value: dailySummaryEmail, set: setDailySummaryEmail },
                ].map((item) => (
                  <label key={item.label} className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-accent/50 transition-colors cursor-pointer">
                    <div>
                      <p className="text-sm font-medium text-card-foreground">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <button onClick={() => item.set(!item.value)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${item.value ? "bg-primary" : "bg-muted-foreground/30"}`}>
                      <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${item.value ? "translate-x-5" : ""}`} />
                    </button>
                  </label>
                ))}
                <button onClick={saveNotifications}
                  className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors mt-2">
                  <Save className="h-4 w-4" />
                  Save Preferences
                </button>
              </div>
            </div>
          )}

          {activeTab === "appearance" && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-card-foreground">Appearance</h2>
              <p className="text-sm text-muted-foreground">Customize how the app looks</p>
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { id: "light", label: "Light", desc: "Clean and bright interface" },
                    { id: "dark", label: "Dark", desc: "Easy on the eyes" },
                  ].map((opt) => (
                    <button key={opt.id} onClick={() => { if (theme !== opt.id) toggle(); }}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        theme === opt.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                      }`}>
                      <div className={`h-20 rounded-lg mb-3 ${opt.id === "dark" ? "bg-zinc-800" : "bg-zinc-100"}`}>
                        <div className="flex gap-1 p-2">
                          <div className={`h-2 w-8 rounded ${opt.id === "dark" ? "bg-zinc-600" : "bg-zinc-300"}`} />
                          <div className={`h-2 w-12 rounded ${opt.id === "dark" ? "bg-zinc-700" : "bg-zinc-200"}`} />
                        </div>
                      </div>
                      <p className="text-sm font-semibold text-card-foreground">{opt.label}</p>
                      <p className="text-xs text-muted-foreground">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "platform" && isSuperAdmin && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-card-foreground">Platform Controls</h2>
              <p className="text-sm text-muted-foreground">Global toggles that affect every workspace.</p>
              <div className="space-y-4 pt-2">
                <label className="flex items-start justify-between gap-4 p-4 rounded-xl border border-border bg-background">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="rounded-md bg-primary/10 p-2 mt-0.5">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-card-foreground">Floating AI Assistant</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        When on, owners and admins see a floating chat bubble on every page. Turning this off hides it for everyone in real time.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      const next = !floatingAIEnabled;
                      const { error } = await setFloatingAIEnabled(next);
                      if (error) toast.error(error.message);
                      else toast.success(`Floating assistant ${next ? "enabled" : "disabled"} for everyone`);
                    }}
                    disabled={savingFloatingAI}
                    aria-pressed={floatingAIEnabled}
                    className={`relative shrink-0 w-11 h-6 rounded-full transition-colors disabled:opacity-60 ${floatingAIEnabled ? "bg-primary" : "bg-muted-foreground/30"}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${floatingAIEnabled ? "translate-x-5" : ""}`} />
                  </button>
                </label>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
