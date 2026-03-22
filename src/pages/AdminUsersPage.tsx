import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, AppRole } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { UserPlus, Shield, Trash2, Building2, Users } from "lucide-react";

const ROLES: AppRole[] = ["admin", "owner", "branch_manager", "employee"];

const roleBadgeVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  super_admin: "destructive",
  admin: "default",
  owner: "secondary",
  branch_manager: "outline",
  employee: "outline",
};

const AdminUsersPage = () => {
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [newUser, setNewUser] = useState({ email: "", password: "", full_name: "" });
  const [newRole, setNewRole] = useState<AppRole>("employee");
  const [newBranchId, setNewBranchId] = useState<string>("");

  const isSuperAdmin = hasRole("super_admin");

  // Fetch all profiles with roles
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const { data: roles } = await supabase.from("user_roles").select("*");

      return (profiles || []).map((p) => ({
        ...p,
        roles: (roles || []).filter((r) => r.user_id === p.user_id),
      }));
    },
    enabled: isSuperAdmin,
  });

  // Fetch branches
  const { data: branches = [] } = useQuery({
    queryKey: ["admin-branches"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("*").eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
    enabled: isSuperAdmin,
  });

  // Create user via edge function
  const createUserMutation = useMutation({
    mutationFn: async (userData: { email: string; password: string; full_name: string }) => {
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: userData,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("User created successfully");
      setCreateOpen(false);
      setNewUser({ email: "", password: "", full_name: "" });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Assign role
  const assignRoleMutation = useMutation({
    mutationFn: async ({ userId, role, branchId }: { userId: string; role: AppRole; branchId: string | null }) => {
      const { error } = await supabase.from("user_roles").insert({
        user_id: userId,
        role,
        branch_id: branchId || null,
        assigned_by: (await supabase.auth.getUser()).data.user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Role assigned");
      setAssignOpen(false);
      setSelectedUserId(null);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Remove role
  const removeRoleMutation = useMutation({
    mutationFn: async (roleId: string) => {
      const { error } = await supabase.from("user_roles").delete().eq("id", roleId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Role removed");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Access denied. Super admin only.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="h-6 w-6" /> User Management
          </h1>
          <p className="text-sm text-muted-foreground">Create users, assign roles and branches</p>
        </div>

        {/* Create User Dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><UserPlus className="h-4 w-4 mr-2" /> Create User</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
              <DialogDescription>Add a new user to the platform</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={newUser.full_name} onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })} placeholder="John Doe" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} placeholder="user@example.com" />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} placeholder="Min 6 characters" />
              </div>
              <Button
                className="w-full"
                disabled={createUserMutation.isPending || !newUser.email || !newUser.password}
                onClick={() => createUserMutation.mutate(newUser)}
              >
                {createUserMutation.isPending ? "Creating..." : "Create User"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-foreground">{users.length}</p><p className="text-xs text-muted-foreground">Total Users</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-foreground">{users.filter(u => u.roles.length > 0).length}</p><p className="text-xs text-muted-foreground">With Roles</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-foreground">{users.filter(u => u.roles.length === 0).length}</p><p className="text-xs text-muted-foreground">Pending</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-foreground">{branches.length}</p><p className="text-xs text-muted-foreground">Branches</p></CardContent></Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader><CardTitle>All Users</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-center py-8">Loading users...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.full_name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.roles.length === 0 && <Badge variant="outline" className="text-xs">No role</Badge>}
                        {user.roles.map((r: any) => (
                          <div key={r.id} className="flex items-center gap-1">
                            <Badge variant={roleBadgeVariant[r.role] || "outline"} className="text-xs">
                              <Shield className="h-3 w-3 mr-1" />
                              {r.role.replace("_", " ")}
                            </Badge>
                            {r.branch_id && (
                              <span className="text-[10px] text-muted-foreground">
                                ({branches.find(b => b.id === r.branch_id)?.name || "branch"})
                              </span>
                            )}
                            <button
                              onClick={() => removeRoleMutation.mutate(r.id)}
                              className="text-destructive hover:text-destructive/80 ml-1"
                              title="Remove role"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {new Date(user.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setSelectedUserId(user.user_id); setAssignOpen(true); }}
                      >
                        <Shield className="h-3 w-3 mr-1" /> Assign Role
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Assign Role Dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Role</DialogTitle>
            <DialogDescription>Select a role and optionally assign to a branch</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{r.replace("_", " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Branch (optional)</Label>
              <Select value={newBranchId} onValueChange={setNewBranchId}>
                <SelectTrigger><SelectValue placeholder="No branch" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No branch</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      <Building2 className="h-3 w-3 inline mr-1" />{b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              disabled={assignRoleMutation.isPending || !selectedUserId}
              onClick={() => {
                if (!selectedUserId) return;
                assignRoleMutation.mutate({
                  userId: selectedUserId,
                  role: newRole,
                  branchId: newBranchId === "none" ? null : newBranchId || null,
                });
              }}
            >
              {assignRoleMutation.isPending ? "Assigning..." : "Assign Role"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUsersPage;
