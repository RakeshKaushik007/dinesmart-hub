import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { UserPlus, Pencil, Users, KeyRound } from "lucide-react";

interface StaffProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  pos_pin: string | null;
  is_active: boolean;
  created_at: string;
}

const StaffPage = () => {
  const { hasAnyRole } = useAuth();
  const qc = useQueryClient();
  const canManage = hasAnyRole(["super_admin", "admin", "owner", "branch_manager"]);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<StaffProfile | null>(null);
  const [form, setForm] = useState({ full_name: "", email: "", password: "", phone: "", pos_pin: "" });
  const [editForm, setEditForm] = useState({ full_name: "", phone: "", pos_pin: "" });

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ["staff-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, full_name, email, phone, pos_pin, is_active, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as StaffProfile[];
    },
    enabled: canManage,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.email || !form.password || !form.full_name) throw new Error("Name, email and password are required");
      if (form.pos_pin && !/^\d{4}$/.test(form.pos_pin)) throw new Error("POS PIN must be 4 digits");

      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: { email: form.email, password: form.password, full_name: form.full_name },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const newUserId = data?.user?.id || data?.user_id;
      if (newUserId) {
        await supabase
          .from("profiles")
          .update({ phone: form.phone || null, pos_pin: form.pos_pin || null })
          .eq("user_id", newUserId);
      }
    },
    onSuccess: () => {
      toast.success("Employee added");
      setCreateOpen(false);
      setForm({ full_name: "", email: "", password: "", phone: "", pos_pin: "" });
      qc.invalidateQueries({ queryKey: ["staff-list"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editing) throw new Error("No employee selected");
      if (editForm.pos_pin && !/^\d{4}$/.test(editForm.pos_pin)) throw new Error("POS PIN must be 4 digits");
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: editForm.full_name || null,
          phone: editForm.phone || null,
          pos_pin: editForm.pos_pin || null,
        })
        .eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Employee updated");
      setEditOpen(false);
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["staff-list"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("profiles").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.is_active ? "Marked active" : "Marked inactive");
      qc.invalidateQueries({ queryKey: ["staff-list"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openEdit = (s: StaffProfile) => {
    setEditing(s);
    setEditForm({ full_name: s.full_name || "", phone: s.phone || "", pos_pin: s.pos_pin || "" });
    setEditOpen(true);
  };

  if (!canManage) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Access denied. Manager role required.</p>
      </div>
    );
  }

  const activeCount = staff.filter((s) => s.is_active).length;
  const inactiveCount = staff.length - activeCount;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="h-6 w-6" /> Staff Management
          </h1>
          <p className="text-sm text-muted-foreground">Add employees, update details, and manage active status</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" /> Add Employee
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{staff.length}</p><p className="text-xs text-muted-foreground">Total Staff</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-primary">{activeCount}</p><p className="text-xs text-muted-foreground">Active</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-muted-foreground">{inactiveCount}</p><p className="text-xs text-muted-foreground">Inactive</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>All Employees</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-center py-8">Loading staff...</p>
          ) : staff.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No employees yet. Add the first one.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>PIN</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((s) => (
                  <TableRow key={s.id} className={!s.is_active ? "opacity-60" : ""}>
                    <TableCell>
                      <div className="font-medium">{s.full_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{s.email}</div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{s.phone || "—"}</TableCell>
                    <TableCell>
                      {s.pos_pin ? (
                        <Badge variant="outline" className="font-mono"><KeyRound className="h-3 w-3 mr-1" />{s.pos_pin}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not set</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={s.is_active}
                          onCheckedChange={(v) => toggleActiveMutation.mutate({ id: s.id, is_active: v })}
                        />
                        <Badge variant={s.is_active ? "default" : "secondary"} className="text-xs">
                          {s.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => openEdit(s)}>
                        <Pencil className="h-3 w-3 mr-1" /> Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Employee</DialogTitle>
            <DialogDescription>Create a staff account with login credentials and a 4-digit POS PIN.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="John Doe" />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="staff@example.com" />
            </div>
            <div className="space-y-2">
              <Label>Login Password *</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min 6 characters" />
            </div>
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91..." />
            </div>
            <div className="space-y-2">
              <Label>POS PIN (4 digits)</Label>
              <Input
                inputMode="numeric"
                maxLength={4}
                value={form.pos_pin}
                onChange={(e) => setForm({ ...form, pos_pin: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                placeholder="1234"
                className="font-mono tracking-widest"
              />
            </div>
            <Button className="w-full" disabled={createMutation.isPending} onClick={() => createMutation.mutate()}>
              {createMutation.isPending ? "Creating..." : "Add Employee"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
            <DialogDescription>Update name, phone or POS PIN.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>POS PIN (4 digits)</Label>
              <Input
                inputMode="numeric"
                maxLength={4}
                value={editForm.pos_pin}
                onChange={(e) => setEditForm({ ...editForm, pos_pin: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                className="font-mono tracking-widest"
              />
            </div>
            <Button className="w-full" disabled={updateMutation.isPending} onClick={() => updateMutation.mutate()}>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StaffPage;
