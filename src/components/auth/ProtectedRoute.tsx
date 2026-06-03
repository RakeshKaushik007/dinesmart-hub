import { Navigate } from "react-router-dom";
import { useEffect } from "react";
import { toast } from "sonner";
import { useAuth, type AppRole } from "@/hooks/useAuth";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: AppRole;
  allowedRoles?: AppRole[];
}

const ProtectedRoute = ({ children, requiredRole, allowedRoles }: ProtectedRouteProps) => {
  const { user, loading, isAtLeast, hasAnyRole, roles } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If no roles assigned yet, show waiting screen
  if (roles.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3 p-8 rounded-xl bg-card border border-border max-w-md">
          <h2 className="text-lg font-semibold text-foreground">Access Pending</h2>
          <p className="text-sm text-muted-foreground">
            Your account has been created but no role has been assigned yet. Please contact your admin.
          </p>
        </div>
      </div>
    );
  }

  if (requiredRole && !isAtLeast(requiredRole)) {
    return <DeniedRedirect />;
  }

  if (allowedRoles && !hasAnyRole(allowedRoles)) {
    return <DeniedRedirect />;
  }

  return <>{children}</>;
};

const DeniedRedirect = () => {
  useEffect(() => {
    toast.error("Access Denied", {
      description: "You don't have permission to view that page.",
    });
  }, []);
  return <Navigate to="/" replace />;
};

export default ProtectedRoute;
