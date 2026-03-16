import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShieldX } from "lucide-react";

const UnauthorizedPage = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 p-8">
        <ShieldX className="h-16 w-16 text-destructive mx-auto" />
        <h1 className="text-2xl font-bold text-foreground">Access Denied</h1>
        <p className="text-muted-foreground">You don't have permission to view this page.</p>
        <Button onClick={() => navigate("/")}>Go to Dashboard</Button>
      </div>
    </div>
  );
};

export default UnauthorizedPage;
