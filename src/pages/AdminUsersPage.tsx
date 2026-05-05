import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, AppRole } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { UserPlus, Shield, Trash2, Building2, Users, ChevronRight, ChevronDown, Search, History, MapPin } from "lucide-react";

type CreatableRole = Exclude<AppRole, "super_admin">;

interface TreeNode {
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: AppRole;
  custom_role_name: string | null;
  permissions: string[];
  branch_id: string | null;
  parent_user_id: string | null;
  is_active: boolean;
  children: TreeNode[];
}

const roleBadgeVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  super_admin: "destructive",
  admin: "default",
  owner: "secondary",
  branch_manager: "outline",
  employee: "outline",
};

const CAN_CREATE: Record<AppRole, CreatableRole[]> = {
  super_admin: ["admin", "owner"],
  admin: ["owner"],
  owner: ["branch_manager", "employee"],
  branch_manager: ["employee"],
  employee: [],
};

const roleLabel = (role: AppRole, custom: string | null) =>
  custom?.trim() ? custom : role.replace("_", " ");

const TreeRow = ({
  node,
  depth,
  branches,
  onDelete,
  canDelete,
  onReassign,
  canReassign,
}: {
  node: TreeNode;
  depth: number;
  branches: { id: string; name: string }[];
  onDelete: (n: TreeNode) => void;
  canDelete: (n: TreeNode) => boolean;
  onReassign: (n: TreeNode) => void;
  canReassign: (n: TreeNode) => boolean;
}) => {
  const [open, setOpen] = useState(true);
  const hasKids = node.children.length > 0;
  const branchName = node.branch_id ? branches.find((b) => b.id === node.branch_id)?.name : null;

  return (
    <div>
      <div
        className="flex items-center gap-2 py-2 px-2 rounded hover:bg-muted/50"
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
      >
        <button
          onClick={() => setOpen((v) => !v)}
          className="text-muted-foreground hover:text-foreground"
          aria-label={open ? "Collapse" : "Expand"}
        >
          {hasKids ? (
            open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
          ) : (
            <span className="inline-block w-4" />
          )}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-foreground truncate">
              {node.full_name || node.email || "—"}
            </span>
            <Badge variant={roleBadgeVariant[node.role] || "outline"} className="text-xs capitalize">
              <Shield className="h-3 w-3 mr-1" />
              {roleLabel(node.role, node.custom_role_name)}
            </Badge>
            {!node.is_active && (
              <Badge variant="destructive" className="text-xs">Inactive</Badge>
            )}
            {branchName && (
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                <Building2 className="h-3 w-3" /> {branchName}
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground truncate">{node.email}</div>
        </div>
        {canReassign(node) && node.is_active && (
          <Button size="sm" variant="ghost" onClick={() => onReassign(node)} title="Assign branch">
            <MapPin className="h-4 w-4" />
          </Button>
        )}
        {canDelete(node) && node.is_active && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDelete(node)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
      {open && hasKids && (
        <div>
          {node.children.map((c) => (
            <TreeRow
              key={c.user_id}
              node={c}
              depth={depth + 1}
              branches={branches}
              onDelete={onDelete}
              canDelete={canDelete}
              onReassign={onReassign}
              canReassign={canReassign}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const flattenTree = (nodes: TreeNode[]): TreeNode[] => {
  const out: TreeNode[] = [];
  const walk = (n: TreeNode) => {
    out.push(n);
    n.children.forEach(walk);
  };
  nodes.forEach(walk);
  return out;
};

const AdminUsersPage = () => {
  const { user, roles, hasAnyRole, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    email: "",
    password: "",
    full_name: "",
    custom_role_name: "",
    role: "" as CreatableRole | "",
    branch_id: "none",
  });
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<TreeNode | null>(null);
  const [deletePreview, setDeletePreview] = useState<{ descendant_count: number; breakdown: Record<string, number> } | null>(null);
  const [reassignTarget, setReassignTarget] = useState<TreeNode | null>(null);
  const [reassignBranchId, setReassignBranchId] = useState<string>("none");

  const canManage = hasAnyRole(["super_admin", "admin", "owner", "branch_manager"]);
  const isSuper = hasRole("super_admin") || hasRole("admin");
  const canAssignBranch = hasRole("super_admin") || hasRole("owner") || hasRole("branch_manager");

  // Determine which roles the current user can create
  const allowedNewRoles = useMemo<CreatableRole[]>(() => {
    if (hasRole("super_admin")) return CAN_CREATE.super_admin;
    if (hasRole("admin")) return CAN_CREATE.admin;
    if (hasRole("owner")) return CAN_CREATE.owner;
    if (hasRole("branch_manager")) return CAN_CREATE.branch_manager;
    return [];
  }, [hasRole]);

  // Hierarchy tree (server-scoped)
  const { data: tree = [], isLoading: treeLoading } = useQuery({
    queryKey: ["hierarchy-tree", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("hierarchy-tree", { body: {} });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return (data?.tree || []) as TreeNode[];
    },
    enabled: canManage && !!user,
  });

  const flatNodes = useMemo(() => flattenTree(tree), [tree]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return flatNodes;
    return flatNodes.filter((n) => {
      const label = roleLabel(n.role, n.custom_role_name).toLowerCase();
      return (
        label.includes(q) ||
        (n.full_name || "").toLowerCase().includes(q) ||
        (n.email || "").toLowerCase().includes(q)
      );
    });
  }, [flatNodes, search]);

  const { data: branches = [] } = useQuery({
    queryKey: ["admin-branches", user?.id],
    queryFn: async () => {
      if (hasRole("admin") && !hasRole("super_admin")) return [];

      // Super admins see every branch. Owners see only branches in restaurants
      // they own. Branch managers see only their assigned branch ids.
      if (hasRole("super_admin")) {
        const { data, error } = await supabase
          .from("branches")
          .select("id, name")
          .eq("is_active", true)
          .order("name");
        if (error) throw error;
        return data || [];
      }

      if (hasRole("branch_manager") && !hasRole("owner")) {
        const branchIds = Array.from(new Set(roles.map((r) => r.branch_id).filter((id): id is string => !!id)));
        if (branchIds.length === 0) return [];
        const { data, error } = await supabase
          .from("branches")
          .select("id, name")
          .in("id", branchIds)
          .eq("is_active", true)
          .order("name");
        if (error) throw error;
        return data || [];
      }

      const { data: owned, error: ownedErr } = await supabase
        .from("restaurants")
        .select("id")
        .eq("owner_user_id", user!.id);
      if (ownedErr) throw ownedErr;
      const restIds = (owned ?? []).map((r: any) => r.id);
      if (restIds.length === 0) return [];
      const { data, error } = await supabase
        .from("branches")
        .select("id, name")
        .in("restaurant_id", restIds)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: canManage && !!user,
  });

  const { data: auditLog = [] } = useQuery({
    queryKey: ["user-audit-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_audit_log" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: isSuper,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!newUser.role) throw new Error("Pick a role");
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: {
          email: newUser.email,
          password: newUser.password,
          full_name: newUser.full_name,
          role: newUser.role,
          custom_role_name: newUser.custom_role_name || null,
          branch_id: newUser.branch_id === "none" ? null : newUser.branch_id,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("User created");
      setCreateOpen(false);
      setNewUser({ email: "", password: "", full_name: "", custom_role_name: "", role: "", branch_id: "none" });
      queryClient.invalidateQueries({ queryKey: ["hierarchy-tree"] });
      queryClient.invalidateQueries({ queryKey: ["user-audit-log"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const previewDelete = async (node: TreeNode) => {
    setDeleteTarget(node);
    setDeletePreview(null);
    const { data, error } = await supabase.functions.invoke("delete-user-cascade", {
      body: { target_user_id: node.user_id, dry_run: true },
    });
    if (error || data?.error) {
      toast.error(data?.error || error?.message || "Preview failed");
      setDeleteTarget(null);
      return;
    }
    setDeletePreview(data.preview);
  };

  const confirmDelete = useMutation({
    mutationFn: async () => {
      if (!deleteTarget) throw new Error("No target");
      const { data, error } = await supabase.functions.invoke("delete-user-cascade", {
        body: { target_user_id: deleteTarget.user_id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (d) => {
      toast.success(`Deactivated ${d.deactivated_count} user(s)`);
      setDeleteTarget(null);
      setDeletePreview(null);
      queryClient.invalidateQueries({ queryKey: ["hierarchy-tree"] });
      queryClient.invalidateQueries({ queryKey: ["user-audit-log"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const canDeleteNode = (node: TreeNode) => {
    if (node.user_id === user?.id) return false;
    if (isSuper) return true;
    return node.parent_user_id === user?.id;
  };

  const canReassignNode = (node: TreeNode) => {
    if (!canAssignBranch) return false;
    if (node.role !== "branch_manager" && node.role !== "employee") return false;
    if (isSuper) return true;
    return node.parent_user_id === user?.id;
  };

  const openReassign = (node: TreeNode) => {
    setReassignTarget(node);
    setReassignBranchId(node.branch_id ?? "none");
  };

  const reassignMutation = useMutation({
    mutationFn: async () => {
      if (!reassignTarget) throw new Error("No target");
      const newBranch = reassignBranchId === "none" ? null : reassignBranchId;
      const { error } = await supabase
        .from("user_roles")
        .update({ branch_id: newBranch })
        .eq("user_id", reassignTarget.user_id)
        .eq("role", reassignTarget.role);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Branch updated");
      setReassignTarget(null);
      queryClient.invalidateQueries({ queryKey: ["hierarchy-tree"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!canManage) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Access denied.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="h-6 w-6" /> User Management
          </h1>
          <p className="text-sm text-muted-foreground">
            {isSuper
              ? "Manage the entire user hierarchy"
              : "Manage users you've created and their teams"}
          </p>
        </div>

        {allowedNewRoles.length > 0 && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button><UserPlus className="h-4 w-4 mr-2" /> Create User</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
                <DialogDescription>This user will be placed under you in the hierarchy.</DialogDescription>
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
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select
                    value={newUser.role}
                    onValueChange={(v) =>
                      setNewUser({
                        ...newUser,
                        role: v as CreatableRole,
                        // Owners don't have a branch — clear any prior selection.
                        branch_id: v === "owner" ? "none" : newUser.branch_id,
                      })
                    }
                  >
                    <SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger>
                    <SelectContent>
                      {allowedNewRoles.map((r) => (
                        <SelectItem key={r} value={r} className="capitalize">{r.replace("_", " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {hasRole("admin") && !hasRole("super_admin") && newUser.role === "owner" && (
                  <p className="text-xs text-muted-foreground">
                    Admins create only Owner accounts here. Branches are created later by that Owner from Branch Management.
                  </p>
                )}
                <div className="space-y-2">
                  <Label>Custom Title (optional)</Label>
                  <Input
                    value={newUser.custom_role_name}
                    onChange={(e) => setNewUser({ ...newUser, custom_role_name: e.target.value })}
                    placeholder='e.g. "North Zone Head" or "Billing Staff"'
                  />
                  <p className="text-xs text-muted-foreground">Must be unique among users you've created.</p>
                </div>
                {/* Owners aren't pinned to a branch — they manage their own
                    restaurants/branches separately. Only show the branch
                    picker for branch managers and employees, and only list
                    branches the caller actually controls. */}
                {canAssignBranch && newUser.role && newUser.role !== "owner" && (
                  <div className="space-y-2">
                    <Label>Branch *</Label>
                    <Select value={newUser.branch_id} onValueChange={(v) => setNewUser({ ...newUser, branch_id: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {branches.map((b) => (
                          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {branches.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        You don't have any branches yet. The owner can add branches from the Branches page.
                      </p>
                    )}
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button
                  className="w-full"
                  disabled={
                    createMutation.isPending ||
                    !newUser.email ||
                    !newUser.password ||
                    !newUser.role ||
                    (canAssignBranch && newUser.role !== "owner" && (newUser.branch_id === "none" || branches.length === 0))
                  }
                  onClick={() => createMutation.mutate()}
                >
                  {createMutation.isPending ? "Creating..." : "Create User"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-foreground">{flatNodes.length}</p><p className="text-xs text-muted-foreground">Users in scope</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-foreground">{flatNodes.filter(n => n.is_active).length}</p><p className="text-xs text-muted-foreground">Active</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-foreground">{flatNodes.filter(n => !n.is_active).length}</p><p className="text-xs text-muted-foreground">Inactive</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-foreground">{branches.length}</p><p className="text-xs text-muted-foreground">Branches</p></CardContent></Card>
      </div>

      <Tabs defaultValue="tree" className="w-full">
        <TabsList>
          <TabsTrigger value="tree">Org Chart</TabsTrigger>
          <TabsTrigger value="search"><Search className="h-3 w-3 mr-1" /> Search</TabsTrigger>
          {isSuper && <TabsTrigger value="audit"><History className="h-3 w-3 mr-1" /> Audit Log</TabsTrigger>}
        </TabsList>

        <TabsContent value="tree">
          <Card>
            <CardHeader><CardTitle>Hierarchy</CardTitle></CardHeader>
            <CardContent>
              {treeLoading ? (
                <p className="text-muted-foreground text-center py-8">Loading…</p>
              ) : tree.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No users in your scope yet.</p>
              ) : (
                <div className="space-y-1">
                  {tree.map((root) => (
                    <TreeRow
                      key={root.user_id}
                      node={root}
                      depth={0}
                      branches={branches}
                      onDelete={previewDelete}
                      canDelete={canDeleteNode}
                      onReassign={openReassign}
                      canReassign={canReassignNode}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="search">
          <Card>
            <CardHeader>
              <CardTitle>Search Users</CardTitle>
              <Input
                placeholder="Search by name, email, or custom title…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="mt-2"
              />
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Title / Role</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((n) => (
                    <TableRow key={n.user_id}>
                      <TableCell className="font-medium">{n.full_name || "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{n.email}</TableCell>
                      <TableCell>
                        <Badge variant={roleBadgeVariant[n.role] || "outline"} className="text-xs capitalize">
                          {roleLabel(n.role, n.custom_role_name)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {branches.find((b) => b.id === n.branch_id)?.name || "—"}
                      </TableCell>
                      <TableCell>
                        {n.is_active ? (
                          <Badge variant="outline" className="text-xs">Active</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canReassignNode(n) && n.is_active && (
                            <Button size="sm" variant="ghost" onClick={() => openReassign(n)} title="Assign branch">
                              <MapPin className="h-4 w-4" />
                            </Button>
                          )}
                          {canDeleteNode(n) && n.is_active && (
                            <Button size="sm" variant="ghost" onClick={() => previewDelete(n)} className="text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No matches</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {isSuper && (
          <TabsContent value="audit">
            <Card>
              <CardHeader><CardTitle>Audit Log (latest 100)</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLog.map((a: any) => (
                      <TableRow key={a.id}>
                        <TableCell className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</TableCell>
                        <TableCell className="text-xs">{a.actor_email || a.actor_id?.slice(0, 8)}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{a.action}</Badge></TableCell>
                        <TableCell className="text-xs">{a.target_email || a.target_user_id?.slice(0, 8) || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                          {JSON.stringify(a.details)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {auditLog.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No log entries</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) { setDeleteTarget(null); setDeletePreview(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate user?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  This will deactivate <strong>{deleteTarget?.full_name || deleteTarget?.email}</strong>
                  {deletePreview && deletePreview.descendant_count > 0 && (
                    <> and <strong>{deletePreview.descendant_count}</strong> user(s) below them:</>
                  )}
                </p>
                {deletePreview && (
                  <ul className="text-xs text-muted-foreground list-disc pl-5">
                    {Object.entries(deletePreview.breakdown).map(([role, count]) => (
                      <li key={role}>{count} × {role.replace("_", " ")}</li>
                    ))}
                  </ul>
                )}
                {!deletePreview && <p className="text-xs text-muted-foreground">Computing impact…</p>}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmDelete.mutate(); }}
              disabled={confirmDelete.isPending || !deletePreview}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {confirmDelete.isPending ? "Deactivating…" : "Deactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminUsersPage;
