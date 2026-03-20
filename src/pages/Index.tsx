import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import EmployeeDashboard from "./dashboards/EmployeeDashboard";
import ManagerDashboard from "./dashboards/ManagerDashboard";
import OwnerDashboard from "./dashboards/OwnerDashboard";

const Index = () => {
  const { loading, isAtLeast, roles } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Owner level and above see strategic dashboard
  if (isAtLeast("owner")) {
    return <OwnerDashboard />;
  }

  // Branch managers see daily control dashboard
  if (isAtLeast("branch_manager")) {
    return <ManagerDashboard />;
  }

  // Employees see operational dashboard
  return <EmployeeDashboard />;
};

export default Index;
