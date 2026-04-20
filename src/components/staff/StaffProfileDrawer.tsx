import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/hooks/useAuth";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { format } from "date-fns";
import { Mail, Phone, KeyRound, Shield, ShoppingBag, AlertTriangle, Gift, Undo2, Ban } from "lucide-react";

interface StaffProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  pos_pin: string | null;
  is_active: boolean;
  created_at: string;
  roles: AppRole[];
}

interface Props {
  staff: StaffProfile | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const roleLabel: Record<AppRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  owner: "Owner",
  branch_manager: "Manager",
  employee: "Employee",
};

const StaffProfileDrawer = ({ staff, open, onOpenChange }: Props) => {
  const userId = staff?.user_id;

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["staff-orders", userId],
    enabled: !!userId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, total, status, order_type, created_at")
        .eq("created_by", userId!)
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: actions = [], isLoading: actionsLoading } = useQuery({
    queryKey: ["staff-actions", userId],
    enabled: !!userId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("id, item_name, quantity, total_price, is_void, is_nc, is_refunded, void_reason, nc_reason, refund_reason, refunded_at, created_at, order_id, voided_by, refunded_by")
        .or(`voided_by.eq.${userId},refunded_by.eq.${userId}`)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  if (!staff) return null;

  const visibleRole = staff.roles.find((r) => r !== "super_admin" && r !== "admin");
  const totalRevenue = orders.reduce((s, o) => s + Number(o.total || 0), 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {staff.full_name || "Unnamed"}
            {!staff.is_active && <Badge variant="secondary">Inactive</Badge>}
          </SheetTitle>
          <SheetDescription>Employee profile & activity history</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 pt-4">
          <Card>
            <CardContent className="pt-4 space-y-2 text-sm">
              <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" />{staff.email || "—"}</div>
              <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />{staff.phone || "—"}</div>
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-muted-foreground" />
                {staff.pos_pin ? <span className="font-mono tracking-widest">{staff.pos_pin}</span> : <span className="text-muted-foreground">No POS PIN</span>}
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                {visibleRole ? <Badge>{roleLabel[visibleRole]}</Badge> : <span className="text-muted-foreground">No role</span>}
              </div>
              <div className="text-xs text-muted-foreground pt-1">
                Joined {format(new Date(staff.created_at), "PP")}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <Card><CardContent className="pt-4 text-center">
              <ShoppingBag className="h-4 w-4 mx-auto text-primary mb-1" />
              <p className="text-xl font-bold">{orders.length}</p>
              <p className="text-xs text-muted-foreground">Orders Handled</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4 text-center">
              <p className="text-xl font-bold font-mono">₹{totalRevenue.toFixed(0)}</p>
              <p className="text-xs text-muted-foreground">Revenue Generated</p>
            </CardContent></Card>
          </div>

          <Tabs defaultValue="orders" className="w-full">
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="orders">Orders ({orders.length})</TabsTrigger>
              <TabsTrigger value="actions">
                <AlertTriangle className="h-3 w-3 mr-1" /> Audit ({actions.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="orders" className="space-y-2 mt-3">
              {ordersLoading ? (
                <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
              ) : orders.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No orders created by this employee yet.</p>
              ) : (
                orders.map((o) => (
                  <div key={o.id} className="flex items-center justify-between p-2 rounded border border-border text-sm">
                    <div>
                      <div className="font-medium">#{o.order_number}</div>
                      <div className="text-xs text-muted-foreground">{format(new Date(o.created_at), "PP p")} · {o.order_type}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono">₹{Number(o.total).toFixed(2)}</div>
                      <Badge variant="outline" className="text-xs">{o.status}</Badge>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="actions" className="space-y-2 mt-3">
              {actionsLoading ? (
                <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
              ) : actions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No void / NC / refund actions performed.</p>
              ) : (
                actions.map((a) => {
                  const type = a.is_void ? "void" : a.is_refunded ? "refund" : a.is_nc ? "nc" : null;
                  const reason = a.void_reason || a.refund_reason || a.nc_reason || "—";
                  const Icon = type === "void" ? Ban : type === "refund" ? Undo2 : Gift;
                  const color = type === "void" ? "text-destructive" : type === "refund" ? "text-blue-500" : "text-amber-500";
                  return (
                    <div key={a.id} className="flex items-start gap-2 p-2 rounded border border-border text-sm">
                      <Icon className={`h-4 w-4 mt-0.5 ${color}`} />
                      <div className="flex-1">
                        <div className="font-medium">{a.item_name} <span className="text-xs text-muted-foreground">×{a.quantity}</span></div>
                        <div className="text-xs text-muted-foreground">{reason}</div>
                        <div className="text-xs text-muted-foreground">{format(new Date(a.refunded_at || a.created_at), "PP p")}</div>
                      </div>
                      <Badge variant="outline" className="text-xs uppercase">{type}</Badge>
                    </div>
                  );
                })
              )}
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default StaffProfileDrawer;
