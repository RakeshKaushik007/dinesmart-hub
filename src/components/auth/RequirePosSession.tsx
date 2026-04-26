import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePosSession } from "@/hooks/usePosSession";

interface Props {
  children: React.ReactNode;
}

const RequirePosSession = ({ children }: Props) => {
  const { user, loading } = useAuth();
  const { session, ready } = usePosSession();
  const location = useLocation();

  if (loading || !ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (!session) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/pos/start?next=${next}`} replace />;
  }

  return <>{children}</>;
};

export default RequirePosSession;