import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building, Plus, Mail, Phone, MapPin, User } from "lucide-react";
import { toast } from "sonner";

interface Branch {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  is_active: boolean;
  restaurant_id: string | null;
  manager_user_id: string | null;
  restaurant_name?: string | null;
  manager?: { full_name: string | null; email: string | null } | null;
}

const BranchesPage = () => {
  const { user, hasRole } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    restaurant_id: "",
    branch_name: "",
    address: "",
    phone: "",
    manager_full_name: "",
    manager_email: "",
    manager_password: "",
    manager_custom_role_name: "",
  });

  const canManage = hasRole("owner");

  // Restaurants visible to caller (RLS filters: owners see own, admins see all)
  const { data: restaurants = [] } = useQuery({
    queryKey: ["my-restaurants", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name, owner_user_id")
        .eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const myRestaurants = useMemo(() => {
    return restaurants.filter((r) => r.owner_user_id === user?.id);
  }, [restaurants, user]);

  const { data: branches = [], isLoading } = useQuery({
    queryKey: ["branches-with-managers", user?.id],
    queryFn: async () => {
      const restIds = myRestaurants.map((r) => r.id);
      if (restIds.length === 0) return [];
      const { data: bs, error } = await supabase
        .from("branches")
        .select("*")
        .in("restaurant_id", restIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const managerIds = (bs || []).map((b) => b.manager_user_id).filter(Boolean) as string[];
      const { data: profiles } = managerIds.length
        ? await supabase.from("profiles").select("user_id, full_name, email").in("user_id", managerIds)
        : { data: [] as any[] };
      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      const restMap = new Map(myRestaurants.map((r) => [r.id, r.name]));
      return (bs || []).map((b: any): Branch => ({
        ...b,
        restaurant_name: b.restaurant_id ? restMap.get(b.restaurant_id) || null : null,
        manager: b.manager_user_id ? profileMap.get(b.manager_user_id) || null : null,
      }));
    },
    enabled: !!user && myRestaurants.length > 0,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("owner-create-branch", {
        body: form,
      });
      if (error) throw new Error(error.message);
      if (!data?.ok) throw new Error(data?.error || "Failed to create branch");
      return data;
    },
    onSuccess: () => {
      toast.success("Branch and manager created");
      qc.invalidateQueries({ queryKey: ["branches-with-managers"] });
      qc.invalidateQueries({ queryKey: ["hierarchy-tree"] });
      setOpen(false);
      setForm({
        restaurant_id: "",
        branch_name: "",
        address: "",
        phone: "",
        manager_full_name: "",
        manager_email: "",
        manager_password: "",
        manager_custom_role_name: "",
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!canManage) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold">Access denied</h1>
        <p className="text-muted-foreground mt-2">Only Owners can manage branches.</p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Building className="h-7 w-7" />
            Branches
          </h1>
          <p className="text-muted-foreground mt-1">Add branches under your restaurant and assign their managers.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button disabled={myRestaurants.length === 0}>
              <Plus className="h-4 w-4 mr-2" />
              Add Branch
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Branch</DialogTitle>
              <DialogDescription>
                Creates the branch and its Branch Manager account in one step.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Restaurant *</Label>
                <Select
                  value={form.restaurant_id}
                  onValueChange={(v) => setForm({ ...form, restaurant_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose restaurant" />
                  </SelectTrigger>
                  <SelectContent>
                    {myRestaurants.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Branch Name *</Label>
                <Input
                  value={form.branch_name}
                  onChange={(e) => setForm({ ...form, branch_name: e.target.value })}
                  placeholder="Downtown"
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
                <p className="text-sm font-semibold">Branch Manager Account (optional)</p>
                <p className="text-xs text-muted-foreground -mt-2">
                  You can leave these blank and add or assign a manager later from User Management.
                </p>
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input
                    value={form.manager_full_name}
                    onChange={(e) => setForm({ ...form, manager_full_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={form.manager_email}
                    onChange={(e) => setForm({ ...form, manager_email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Temporary Password</Label>
                  <Input
                    type="text"
                    value={form.manager_password}
                    onChange={(e) => setForm({ ...form, manager_password: e.target.value })}
                    placeholder="Min 6 characters (required only if email is set)"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Custom Title (optional)</Label>
                  <Input
                    value={form.manager_custom_role_name}
                    onChange={(e) => setForm({ ...form, manager_custom_role_name: e.target.value })}
                    placeholder='e.g. "Downtown Floor Lead"'
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
                  !form.restaurant_id ||
                  !form.branch_name ||
                  (!!form.manager_email && form.manager_password.length < 6)
                }
              >
                {createMutation.isPending ? "Creating..." : "Create Branch"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {myRestaurants.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            You don't own any restaurants yet. Ask your Admin to add one for you.
          </CardContent>
        </Card>
      ) : isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : branches.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No branches yet. Click "Add Branch" to create the first one.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {branches.map((b) => (
            <Card key={b.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{b.name}</CardTitle>
                    {b.restaurant_name && (
                      <p className="text-xs text-muted-foreground mt-0.5">{b.restaurant_name}</p>
                    )}
                  </div>
                  <Badge variant={b.is_active ? "default" : "secondary"}>
                    {b.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {b.address && (
                  <p className="flex items-start gap-2 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    {b.address}
                  </p>
                )}
                {b.phone && (
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />
                    {b.phone}
                  </p>
                )}
                <div className="border-t pt-2 mt-2 space-y-1">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Branch Manager</p>
                  <p className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5" />
                    {b.manager?.full_name || "—"}
                  </p>
                  {b.manager?.email && (
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Mail className="h-3 w-3" />
                      {b.manager.email}
                    </p>
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

export default BranchesPage;