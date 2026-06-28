import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Plus, Mail, Phone, MapPin, LogIn, Search, X } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Restaurant {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  is_active: boolean;
  owner_user_id: string | null;
  created_at: string;
  subscription_status: string;
  subscription_tier: string;
  owner?: { full_name: string | null; email: string | null } | null;
  branch_count?: number;
}

const RestaurantsPage = () => {
  const { isAtLeast } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    restaurant_name: "",
    address: "",
    phone: "",
    owner_full_name: "",
    owner_email: "",
    owner_password: "",
    owner_custom_role_name: "",
  });
  const [search, setSearch] = useState("");

  const canManage = isAtLeast("admin");

  const { data: restaurants = [], isLoading } = useQuery({
    queryKey: ["restaurants-with-owners"],
    queryFn: async () => {
      const { data: rs, error } = await supabase
        .from("restaurants")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ownerIds = (rs || []).map((r) => r.owner_user_id).filter(Boolean) as string[];
      const { data: profiles } = ownerIds.length
        ? await supabase.from("profiles").select("user_id, full_name, email").in("user_id", ownerIds)
        : { data: [] as any[] };
      const { data: branches } = await supabase.from("branches").select("id, restaurant_id");
      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      const branchCount = new Map<string, number>();
      (branches || []).forEach((b: any) => {
        if (b.restaurant_id) branchCount.set(b.restaurant_id, (branchCount.get(b.restaurant_id) || 0) + 1);
      });
      return (rs || []).map((r: any): Restaurant => ({
        ...r,
        owner: r.owner_user_id ? profileMap.get(r.owner_user_id) || null : null,
        branch_count: branchCount.get(r.id) || 0,
      }));
    },
  });

  const updateSubscription = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, any> }) => {
      const { error } = await supabase
        .from("restaurants")
        .update({ ...patch, subscription_updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Subscription updated");
      qc.invalidateQueries({ queryKey: ["restaurants-with-owners"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const impersonate = useMutation({
    mutationFn: async (ownerUserId: string) => {
      const { data, error } = await supabase.functions.invoke("admin-impersonate", {
        body: { target_user_id: ownerUserId, redirect_to: window.location.origin },
      });
      if (error) throw new Error(error.message);
      if (!data?.ok) throw new Error(data?.error || "Failed to impersonate");
      return data.action_link as string;
    },
    onSuccess: (link) => {
      window.open(link, "_blank", "noopener,noreferrer");
      toast.success("Opened owner session in a new tab");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusVariant = (s: string) =>
    s === "active" ? "default" : s === "suspended" ? "destructive" : "secondary";

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-create-restaurant", {
        body: form,
      });
      if (error) throw new Error(error.message);
      if (!data?.ok) throw new Error(data?.error || "Failed to create restaurant");
      return data;
    },
    onSuccess: () => {
      toast.success("Restaurant and owner created");
      qc.invalidateQueries({ queryKey: ["restaurants-with-owners"] });
      qc.invalidateQueries({ queryKey: ["hierarchy-tree"] });
      setOpen(false);
      setForm({
        restaurant_name: "",
        address: "",
        phone: "",
        owner_full_name: "",
        owner_email: "",
        owner_password: "",
        owner_custom_role_name: "",
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const term = search.trim().toLowerCase();
  const filteredRestaurants = term
    ? restaurants.filter(
        (r) =>
          r.name.toLowerCase().includes(term) ||
          r.owner?.full_name?.toLowerCase().includes(term) ||
          r.owner?.email?.toLowerCase().includes(term)
      )
    : restaurants;

  if (!canManage) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold">Access denied</h1>
        <p className="text-muted-foreground mt-2">Only Super Admins or Admins can manage restaurants.</p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Building2 className="h-7 w-7" />
            Restaurants
          </h1>
          <p className="text-muted-foreground mt-1">Create restaurants and assign their owners.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Restaurant
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Restaurant</DialogTitle>
              <DialogDescription>
                Creates the restaurant and its Owner account in one step.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Restaurant Name *</Label>
                <Input
                  value={form.restaurant_name}
                  onChange={(e) => setForm({ ...form, restaurant_name: e.target.value })}
                  placeholder="Blennix HQ"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>
              <div className="border-t pt-4 space-y-4">
                <p className="text-sm font-semibold">Owner Account</p>
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input
                    value={form.owner_full_name}
                    onChange={(e) => setForm({ ...form, owner_full_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    value={form.owner_email}
                    onChange={(e) => setForm({ ...form, owner_email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Temporary Password *</Label>
                  <Input
                    type="text"
                    value={form.owner_password}
                    onChange={(e) => setForm({ ...form, owner_password: e.target.value })}
                    placeholder="Min 6 characters"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Custom Title (optional)</Label>
                  <Input
                    value={form.owner_custom_role_name}
                    onChange={(e) => setForm({ ...form, owner_custom_role_name: e.target.value })}
                    placeholder='e.g. "North Zone Head"'
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={
                  createMutation.isPending ||
                  !form.restaurant_name ||
                  !form.owner_email ||
                  !form.owner_password
                }
              >
                {createMutation.isPending ? "Creating..." : "Create Restaurant"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tenants, owners, or emails..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : restaurants.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No restaurants yet. Click "Add Restaurant" to create the first one.
          </CardContent>
        </Card>
      ) : filteredRestaurants.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No tenants match your search.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredRestaurants.map((r) => (
            <Card key={r.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{r.name}</CardTitle>
                  <Badge variant={statusVariant(r.subscription_status) as any}>
                    {r.subscription_status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {r.address && (
                  <p className="flex items-start gap-2 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    {r.address}
                  </p>
                )}
                {r.phone && (
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />
                    {r.phone}
                  </p>
                )}
                <div className="border-t pt-2 mt-2 space-y-1">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Owner</p>
                  <p>{r.owner?.full_name || "—"}</p>
                  {r.owner?.email && (
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Mail className="h-3 w-3" />
                      {r.owner.email}
                    </p>
                  )}
                </div>
                <div className="pt-2">
                  <Badge variant="outline">{r.branch_count} branch{r.branch_count === 1 ? "" : "es"}</Badge>
                </div>
                <div className="border-t pt-3 mt-2 space-y-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Subscription</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground">Status</p>
                      <Select
                        value={r.subscription_status}
                        onValueChange={(v) =>
                          updateSubscription.mutate({ id: r.id, patch: { subscription_status: v } })
                        }
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="trial">Trial</SelectItem>
                          <SelectItem value="suspended">Suspended</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground">Plan tier</p>
                      <Select
                        value={r.subscription_tier}
                        onValueChange={(v) =>
                          updateSubscription.mutate({ id: r.id, patch: { subscription_tier: v } })
                        }
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="starter">Starter</SelectItem>
                          <SelectItem value="pro">Pro</SelectItem>
                          <SelectItem value="enterprise">Enterprise</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {r.owner_user_id && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full mt-1"
                      onClick={() => impersonate.mutate(r.owner_user_id!)}
                      disabled={impersonate.isPending}
                    >
                      <LogIn className="h-3.5 w-3.5 mr-2" />
                      {impersonate.isPending ? "Generating..." : "Login as Owner"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default RestaurantsPage;