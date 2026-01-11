import React, { Suspense } from "react";
import { LoadingOverlay } from "@/components/ui/loadingOverlay";
import { useAuth } from "@/context/authContext";

const LoginPage = React.lazy(() => import("@/pages/loginPage"));
const DashboardPage = React.lazy(() => import("@/pages/dashboardPage"));

export function AppRoutes() {
  const { isAuthenticated, logout } = useAuth();

  return (
    <Suspense fallback={<LoadingOverlay message="Loading app" />}>
      {isAuthenticated ? (
        <DashboardPage onLogout={logout} />
      ) : (
        <LoginPage />
      )}
    </Suspense>
  );
}
